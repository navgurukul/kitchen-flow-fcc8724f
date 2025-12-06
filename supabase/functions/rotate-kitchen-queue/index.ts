/// <reference path="../global.d.ts" />
// @ts-ignore: ESM import from URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting kitchen queue rotation check...");

    // CHECK IF ROTATION IS PAUSED
    const { data: settings, error: settingsError } = await supabase
      .from("rotation_settings")
      .select("*")
      .single();

    if (settingsError) {
      console.error("Error fetching rotation settings:", settingsError);
      // Continue with rotation if error (fail-safe)
    }

    // Auto-resume if pause period expired
    if (settings?.is_paused && settings?.paused_until) {
      const now = new Date();
      const pausedUntil = new Date(settings.paused_until);

      if (now >= pausedUntil) {
        console.log("Auto-resuming rotation. 24-hour pause period expired.");
        await supabase
          .from("rotation_settings")
          .update({
            is_paused: false,
            paused_until: null,
          })
          .eq("id", settings.id);

        console.log(
          "Rotation auto-resumed successfully. Proceeding with queue rotation..."
        );
      } else {
        // Still paused
        const hoursLeft = Math.ceil(
          (pausedUntil.getTime() - now.getTime()) / (1000 * 60 * 60)
        );
        console.log(`Rotation is paused. Auto-resume in ${hoursLeft} hours.`);
        console.log(
          `Reason: ${settings.paused_reason || "No reason provided"}`
        );

        return new Response(
          JSON.stringify({
            success: false,
            message: `Rotation paused for ${hoursLeft} more hours`,
            paused_until: settings.paused_until,
            paused_reason: settings.paused_reason,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (settings?.is_paused) {
      // Paused but no end time set (shouldn't happen, but handle gracefully)
      console.log("Rotation is paused indefinitely.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Rotation is currently paused",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Rotation is active. Proceeding with queue rotation...");

    // CRITICAL: Before rotating, handle pending skip requests
    const { data: pendingRequests } = await supabase
      .from("skip_requests")
      .select("id")
      .eq("status", "pending");

    if (pendingRequests && pendingRequests.length > 0) {
      console.log(
        `Auto-rejecting ${pendingRequests.length} pending skip requests due to rotation`
      );

      // Mark all pending requests as expired/rejected
      const { error: rejectError } = await supabase
        .from("skip_requests")
        .update({
          status: "rejected",
          review_notes: "Expired - queue was rotated",
          reviewed_at: new Date().toISOString(),
        })
        .eq("status", "pending");

      if (rejectError) {
        console.error("Error rejecting pending requests:", rejectError);
        // Continue with rotation anyway
      }
    }

    // Get current queue ordered by position
    const { data: currentQueue, error: queueError } = await supabase
      .from("kitchen_queue")
      .select(
        `
        *,
        profiles:profile_id (
          id,
          full_name,
          status,
          user_id
        )
      `
      )
      .order("queue_position", { ascending: true });

    if (queueError) {
      console.error("Error fetching queue:", queueError);
      throw queueError;
    }

    if (!currentQueue || currentQueue.length < 10) {
      console.log("Not enough students in queue (need at least 10)");
      return new Response(
        JSON.stringify({ error: "Not enough students in queue" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get role information for all profiles in queue to filter out coordinators
    const userIds = currentQueue
      .map((item: any) => item.profiles?.user_id)
      .filter(Boolean);

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const coordinatorUserIds = new Set(
      rolesData
        ?.filter((r: any) => r.role === "coordinator")
        .map((r: any) => r.user_id) || []
    );

    // CRITICAL: Remove any coordinators from the queue before rotation
    // This handles the case where someone was promoted to coordinator after being added to the queue
    const coordinatorQueueIds = currentQueue
      .filter((item: any) => coordinatorUserIds.has(item.profiles?.user_id))
      .map((item: any) => item.id);

    if (coordinatorQueueIds.length > 0) {
      console.log(
        `Removing ${coordinatorQueueIds.length} coordinator(s) from queue before rotation`
      );

      const { error: deleteCoordError } = await supabase
        .from("kitchen_queue")
        .delete()
        .in("id", coordinatorQueueIds);

      if (deleteCoordError) {
        console.error(
          "Error removing coordinators from queue:",
          deleteCoordError
        );
        // Continue anyway - we'll filter them out
      } else {
        // Refresh the queue after deletion
        const { data: refreshedQueue, error: refreshError } = await supabase
          .from("kitchen_queue")
          .select(
            `
            *,
            profiles:profile_id (
              id,
              full_name,
              status,
              user_id
            )
          `
          )
          .order("queue_position", { ascending: true });

        if (!refreshError && refreshedQueue) {
          // Update currentQueue with refreshed data (reassign using Object.assign for const)
          currentQueue.length = 0;
          currentQueue.push(...refreshedQueue);
        }
      }
    }

    // Filter active students only AND exclude coordinators (double-check after deletion)
    const activeQueue = currentQueue.filter(
      (item: any) =>
        item.profiles?.status === "active" &&
        !coordinatorUserIds.has(item.profiles?.user_id)
    );

    if (activeQueue.length < 10) {
      console.log("Not enough active students (need at least 10)");
      return new Response(
        JSON.stringify({ error: "Not enough active students" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get today's date in IST timezone (UTC+5:30)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const today = new Date(Date.now() + IST_OFFSET).toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + IST_OFFSET + 86400000)
      .toISOString()
      .split("T")[0];

    // Take first 5 for today, next 5 for tomorrow
    const todayTeam = activeQueue.slice(0, 5);
    const tomorrowTeam = activeQueue.slice(5, 10);

    // Create assignments
    const { error: todayError } = await supabase
      .from("kitchen_assignments")
      .upsert(
        {
          assignment_date: today,
          team_type: "today",
          profile_ids: todayTeam.map((item: any) => item.profiles.id),
        },
        { onConflict: "assignment_date" }
      );

    if (todayError) {
      console.error("Error creating today assignment:", todayError);
      throw todayError;
    }

    const { error: tomorrowError } = await supabase
      .from("kitchen_assignments")
      .upsert(
        {
          assignment_date: tomorrow,
          team_type: "tomorrow",
          profile_ids: tomorrowTeam.map((item: any) => item.profiles.id),
        },
        { onConflict: "assignment_date" }
      );

    if (tomorrowError) {
      console.error("Error creating tomorrow assignment:", tomorrowError);
      throw tomorrowError;
    }

    // Rotate queue: move top 5 active students to bottom
    // IMPORTANT: We must update ALL queue items to avoid unique constraint violations
    const rotatedActiveQueue = [
      ...activeQueue.slice(5),
      ...activeQueue.slice(0, 5),
    ];

    // Get inactive/excluded items (those not in activeQueue)
    // IMPORTANT: Exclude coordinators to prevent trigger errors
    const activeIds = new Set(activeQueue.map((item: any) => item.id));
    const inactiveQueue = currentQueue.filter(
      (item: any) =>
        !activeIds.has(item.id) &&
        !coordinatorUserIds.has(item.profiles?.user_id) // Never include coordinators
    );

    // Combine: rotated active students first, then inactive at the end
    const fullRotatedQueue = [...rotatedActiveQueue, ...inactiveQueue];

    console.log(
      `Updating positions for ${fullRotatedQueue.length} items (${rotatedActiveQueue.length} active, ${inactiveQueue.length} inactive/excluded)`
    );

    // Save to history (after calculating rotated queue)
    const { error: historyError } = await supabase
      .from("queue_history")
      .insert({
        rotation_date: today,
        previous_queue: currentQueue,
        new_queue: fullRotatedQueue,
      });

    if (historyError) {
      console.error("Error saving history:", historyError);
    }

    // Batch update all positions using database function (efficient and atomic)
    const positionUpdates = fullRotatedQueue.map((item, index) => ({
      id: item.id,
      queue_position: index + 1,
      // Only update last_duty_date for items that were at positions 6-10 and are now at 1-5
      // These are the students who just completed their duty
      last_duty_date:
        index < 5 && activeIds.has(item.id)
          ? today
          : item.last_duty_date || "null",
    }));

    const { error: updateError } = await supabase.rpc(
      "update_queue_positions_batch",
      {
        position_updates: positionUpdates,
      }
    );

    if (updateError) {
      console.error("Error updating queue positions:", updateError);
      throw updateError;
    }

    console.log("Queue rotation completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        todayTeam: todayTeam.length,
        tomorrowTeam: tomorrowTeam.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in rotate-kitchen-queue:", error);

    // Better error message extraction for various error types
    let errorMessage = "Unknown error";
    let errorDetails: {
      code: unknown;
      details: unknown;
      hint: unknown;
    } | null = null;

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      // Handle Supabase/PostgreSQL error objects
      const errObj = error as Record<string, unknown>;
      errorMessage =
        (errObj.message as string) ||
        (errObj.error as string) ||
        (errObj.code as string) ||
        JSON.stringify(error);
      errorDetails = {
        code: errObj.code,
        details: errObj.details,
        hint: errObj.hint,
      };
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.error("Parsed error message:", errorMessage);
    if (errorDetails) {
      console.error("Error details:", errorDetails);
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
