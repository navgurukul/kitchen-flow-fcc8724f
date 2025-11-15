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

    console.log('Starting kitchen queue rotation...');

    // Get current queue ordered by position
    const { data: currentQueue, error: queueError } = await supabase
      .from('kitchen_queue')
      .select(`
        *,
        profiles:profile_id (
          id,
          full_name,
          status,
          user_id
        )
      `)
      .order('queue_position', { ascending: true });

    if (queueError) {
      console.error('Error fetching queue:', queueError);
      throw queueError;
    }

    if (!currentQueue || currentQueue.length < 10) {
      console.log('Not enough students in queue (need at least 10)');
      return new Response(
        JSON.stringify({ error: 'Not enough students in queue' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter active students only
    const activeQueue = currentQueue.filter(
      (item: any) => item.profiles?.status === 'active'
    );

    if (activeQueue.length < 10) {
      console.log('Not enough active students (need at least 10)');
      return new Response(
        JSON.stringify({ error: 'Not enough active students' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Take first 5 for today, next 5 for tomorrow
    const todayTeam = activeQueue.slice(0, 5);
    const tomorrowTeam = activeQueue.slice(5, 10);

    // Create assignments
    const { error: todayError } = await supabase
      .from('kitchen_assignments')
      .upsert({
        assignment_date: today,
        team_type: 'today',
        profile_ids: todayTeam.map((item: any) => item.profiles.id)
      }, { onConflict: 'assignment_date' });

    if (todayError) {
      console.error('Error creating today assignment:', todayError);
      throw todayError;
    }

    const { error: tomorrowError } = await supabase
      .from('kitchen_assignments')
      .upsert({
        assignment_date: tomorrow,
        team_type: 'tomorrow',
        profile_ids: tomorrowTeam.map((item: any) => item.profiles.id)
      }, { onConflict: 'assignment_date' });

    if (tomorrowError) {
      console.error('Error creating tomorrow assignment:', tomorrowError);
      throw tomorrowError;
    }

    // Save to history
    const { error: historyError } = await supabase
      .from('queue_history')
      .insert({
        rotation_date: today,
        previous_queue: currentQueue,
        new_queue: currentQueue
      });

    if (historyError) {
      console.error('Error saving history:', historyError);
    }

    // Rotate queue: move top 5 to bottom
    const rotatedQueue = [...activeQueue.slice(5), ...activeQueue.slice(0, 5)];
    
    // Update positions
    for (let i = 0; i < rotatedQueue.length; i++) {
      const { error: updateError } = await supabase
        .from('kitchen_queue')
        .update({
          queue_position: i + 1,
          last_duty_date: i < 5 ? today : rotatedQueue[i].last_duty_date
        })
        .eq('id', rotatedQueue[i].id);

      if (updateError) {
        console.error('Error updating position:', updateError);
      }
    }

    console.log('Queue rotation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        todayTeam: todayTeam.length,
        tomorrowTeam: tomorrowTeam.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in rotate-kitchen-queue:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
