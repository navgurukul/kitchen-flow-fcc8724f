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
            reviewed_by: coordinatorProfile.id,
            reviewed_at: new Date().toISOString(),
            review_notes: `Request invalidated - student moved from position ${request.queue_position_at_request} to ${studentQueue.queue_position}`
          })
          .eq('id', requestId);

        return new Response(
          JSON.stringify({ 
            error: `Student is no longer in positions 6-10. Current position: ${studentQueue.queue_position}`,
            invalidated: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (studentQueue.profiles.status !== 'active') {
        return new Response(
          JSON.stringify({ error: 'Student is inactive - cannot perform swap' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Get recently approved skip requests from today to exclude from swap
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { data: recentApprovals } = await supabase
        .from('skip_requests')
        .select('profile_id')
        .eq('status', 'approved')
        .gte('reviewed_at', todayStart.toISOString());
      
      const excludedProfileIds = recentApprovals?.map(r => r.profile_id) || [];
      
      console.log('Excluded profile IDs from today\'s approved requests:', excludedProfileIds);
      
      // 5. Find next eligible student from position 11 onwards (excluding recently swapped)
      let eligibleStudentQuery = supabase
        .from('kitchen_queue')
        .select(`
          *,
          profiles:profile_id (
            full_name,
            status
          )
        `)
        .gte('queue_position', 11)
        .eq('profiles.status', 'active')
        .order('queue_position', { ascending: true });
      
      // Exclude recently approved profile_ids if any exist
      if (excludedProfileIds.length > 0) {
        eligibleStudentQuery = eligibleStudentQuery.not('profile_id', 'in', `(${excludedProfileIds.join(',')})`);
      }
      
      const { data: eligibleStudent, error: eligibleError } = await eligibleStudentQuery
        .limit(1)
        .maybeSingle();

      if (eligibleError || !eligibleStudent) {
        console.error('No eligible student found:', eligibleError);
        return new Response(
          JSON.stringify({ 
            error: 'No eligible student available for swap. All students after position 10 have already been involved in skip approvals today or are inactive.' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Selected eligible student:', {
        name: eligibleStudent.profiles.full_name,
        position: eligibleStudent.queue_position
      });

      // 6. Update request status FIRST (before swap)
      const { error: updateReqError } = await supabase
        .from('skip_requests')
        .update({
          status: 'approved',
          reviewed_by: coordinatorProfile.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || `Swapped position ${studentQueue.queue_position} with ${eligibleStudent.profiles.full_name} at position ${eligibleStudent.queue_position}`
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
          queue_position: eligibleStudent.queue_position,
          last_duty_date: studentQueue.last_duty_date || 'null'
        },
        {
          id: eligibleStudent.id,
          queue_position: studentQueue.queue_position,
          last_duty_date: eligibleStudent.last_duty_date || 'null'
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
        student2: eligibleStudent.profiles.full_name,
        position2: eligibleStudent.queue_position
      });

      // 8. Update tomorrow's kitchen_assignments to reflect the swap
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      const { data: tomorrowAssignment, error: assignmentError } = await supabase
        .from('kitchen_assignments')
        .select('*')
        .eq('assignment_date', tomorrow)
        .maybeSingle();

      if (tomorrowAssignment && !assignmentError) {
        // Swap the profile IDs in the assignment array
        const updatedProfileIds = tomorrowAssignment.profile_ids.map((id: string) => {
          if (id === request.profile_id) return eligibleStudent.profile_id;
          if (id === eligibleStudent.profile_id) return request.profile_id;
          return id;
        });

        const { error: updateError } = await supabase
          .from('kitchen_assignments')
          .update({ profile_ids: updatedProfileIds })
          .eq('id', tomorrowAssignment.id);

        if (updateError) {
          console.error('Failed to update tomorrow assignment:', updateError);
        } else {
          console.log('Tomorrow assignment updated successfully');
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Skip request approved and positions swapped',
          swapped: {
            student1: request.profiles.full_name,
            originalPosition: studentQueue.queue_position,
            student2: eligibleStudent.profiles.full_name,
            newPosition: eligibleStudent.queue_position
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
