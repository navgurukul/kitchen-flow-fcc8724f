import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, action, reviewNotes } = await req.json();

    if (!requestId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${action} for request ${requestId} by user ${user.id}`);

    // Verify coordinator role
    const { data: coordinatorProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!coordinatorProfile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isCoordinator } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'coordinator'
    });

    if (!isCoordinator) {
      return new Response(
        JSON.stringify({ error: 'Only coordinators can approve/reject skip requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve') {
      // 1. Get request and verify it's still pending
      const { data: request, error: requestError } = await supabase
        .from('skip_requests')
        .select(`
          *,
          profiles:profile_id (
            id,
            full_name,
            status
          )
        `)
        .eq('id', requestId)
        .eq('status', 'pending')
        .single();

      if (requestError || !request) {
        return new Response(
          JSON.stringify({ error: 'Request not found or already processed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Get current position for requesting student
      const { data: studentQueue, error: queueError } = await supabase
        .from('kitchen_queue')
        .select(`
          *,
          profiles:profile_id (
            status
          )
        `)
        .eq('profile_id', request.profile_id)
        .single();

      if (queueError || !studentQueue) {
        return new Response(
          JSON.stringify({ error: 'Student not found in queue' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. CRITICAL: Verify position is still 6-10
      if (studentQueue.queue_position < 6 || studentQueue.queue_position > 10) {
        // Mark request as invalidated
        await supabase
          .from('skip_requests')
          .update({ 
            status: 'rejected',
            review_notes: 'Position changed - student no longer in tomorrow\'s team (positions 6-10)',
            reviewed_by: coordinatorProfile.id,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', requestId);
        
        return new Response(
          JSON.stringify({ error: 'Student position has changed - request invalidated' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Verify student is still active
      if (studentQueue.profiles.status !== 'active') {
        return new Response(
          JSON.stringify({ error: 'Student is no longer active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 5. Get student at position 11 and verify they exist and are active
      const { data: position11Student, error: pos11Error } = await supabase
        .from('kitchen_queue')
        .select(`
          *,
          profiles:profile_id (
            full_name,
            status
          )
        `)
        .eq('queue_position', 11)
        .single();

      if (pos11Error || !position11Student) {
        return new Response(
          JSON.stringify({ error: 'Queue too short - no student at position 11 available for swap' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (position11Student.profiles.status !== 'active') {
        return new Response(
          JSON.stringify({ error: 'Student at position 11 is inactive - cannot perform swap' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 6. Update request status FIRST (before swap)
      const { error: updateReqError } = await supabase
        .from('skip_requests')
        .update({
          status: 'approved',
          reviewed_by: coordinatorProfile.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || `Swapped position ${studentQueue.queue_position} with ${position11Student.profiles.full_name} at position 11`
        })
        .eq('id', requestId);

      if (updateReqError) {
        console.error('Failed to update request status:', updateReqError);
        return new Response(
          JSON.stringify({ error: 'Failed to update request status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 7. NOW perform the swap
      const swapUpdates = [
        {
          id: studentQueue.id,
          queue_position: 11,
          last_duty_date: studentQueue.last_duty_date || 'null'
        },
        {
          id: position11Student.id,
          queue_position: studentQueue.queue_position,
          last_duty_date: position11Student.last_duty_date || 'null'
        }
      ];

      const { error: swapError } = await supabase.rpc('update_queue_positions_batch', {
        position_updates: swapUpdates
      });

      if (swapError) {
        console.error('Swap failed:', swapError);
        // Rollback request status to pending
        await supabase
          .from('skip_requests')
          .update({ status: 'pending' })
          .eq('id', requestId);
        
        return new Response(
          JSON.stringify({ error: 'Failed to swap positions - request reverted to pending' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Swap successful:', {
        student1: request.profiles.full_name,
        position1: studentQueue.queue_position,
        student2: position11Student.profiles.full_name,
        position2: 11
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Skip request approved and positions swapped',
          swapped: {
            student1: request.profiles.full_name,
            originalPosition: studentQueue.queue_position,
            student2: position11Student.profiles.full_name,
            newPosition: 11
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      // Reject the request
      const { error: rejectError } = await supabase
        .from('skip_requests')
        .update({
          status: 'rejected',
          reviewed_by: coordinatorProfile.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || 'Request rejected by coordinator'
        })
        .eq('id', requestId)
        .eq('status', 'pending');

      if (rejectError) {
        console.error('Failed to reject request:', rejectError);
        return new Response(
          JSON.stringify({ error: 'Failed to reject request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Request rejected:', requestId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Skip request rejected',
          action: 'rejected'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be "approve" or "reject"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in handle-skip-request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
