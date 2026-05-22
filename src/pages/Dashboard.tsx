import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ChefHat,
  Users,
  Calendar,
  Settings,
  AlertCircle,
  Clock,
  RotateCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  full_name: string;
  status: string;
  position: number;
}

interface SkipRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  requested_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  queue_position_at_request: number;
}

// ─────────────────────────────────────────────────────────────
// HELPERS (outside component — no stale closure issues)
// ─────────────────────────────────────────────────────────────

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5h 30m in ms

/** Today's date string in IST → "YYYY-MM-DD" */
const getTodayIST = (): string =>
  new Date(Date.now() + IST_OFFSET).toISOString().split("T")[0];

/** Start of today (midnight IST) as UTC ISO string */
const getTodayStartIST = (): string => {
  const d = new Date(Date.now() + IST_OFFSET);
  const year  = parseInt(d.toISOString().slice(0, 4));
  const month = parseInt(d.toISOString().slice(5, 7)) - 1;
  const day   = parseInt(d.toISOString().slice(8, 10));
  // midnight IST in UTC = midnight IST - 5h30m
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET).toISOString();
};

/**
 * Should the skip request be shown in the UI?
 *
 * Rules:
 *  1. pending   → show only if position at time of request === current position
 *                 (agar rotation ho gaya aur wapas 6-10 aaya toh pending bhi hide)
 *  2. approved/rejected → show only if:
 *       a. position 6-10 ke andar ho
 *       b. current position === position at time of request
 *          (matlab koi rotation nahi hua beech mein)
 *       c. reviewed today (purana decision mat dikhao)
 *
 * KEY INSIGHT: queue_position_at_request === currentPosition
 * ensures that if rotation happened and student came back to 6-10,
 * the OLD request is NOT shown — because positions won't match.
 */
const isSkipRequestActive = (
  req: SkipRequest | null,
  currentPosition: number | null
): boolean => {
  if (!req) return false;
  if (currentPosition === null) return false;

  // Position must still be 6-10
  if (currentPosition < 6 || currentPosition > 10) return false;

  // ✅ CORE FIX: Current position must match the position when request was made.
  // If rotation happened and student came back to 6-10 with a different position,
  // this check will FAIL → old request hidden, fresh skip allowed.
  if (req.queue_position_at_request !== currentPosition) return false;

  // For pending: position match is enough
  if (req.status === "pending") return true;

  // For reviewed: also check it was reviewed today
  if (!req.reviewed_at) return false;
  const reviewedDay = new Date(new Date(req.reviewed_at).getTime() + IST_OFFSET)
    .toISOString()
    .split("T")[0];
  return reviewedDay === getTodayIST();
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, role } = useAuth();
  const navigate   = useNavigate();
  const { toast }  = useToast();

  const [todayTeam,         setTodayTeam]         = useState<TeamMember[]>([]);
  const [tomorrowTeam,      setTomorrowTeam]       = useState<TeamMember[]>([]);
  const [myPosition,        setMyPosition]         = useState<number | null>(null);
  const [myProfileId,       setMyProfileId]        = useState<string | null>(null);
  const [skipRequest,       setSkipRequest]        = useState<SkipRequest | null>(null);
  const [showSkipDialog,    setShowSkipDialog]     = useState(false);
  const [skipReason,        setSkipReason]         = useState("");
  const [submittingSkip,    setSubmittingSkip]     = useState(false);
  const [loading,           setLoading]            = useState(true);
  const [rotationSettings,  setRotationSettings]   = useState<any>(null);
  const [showPauseDialog,   setShowPauseDialog]    = useState(false);
  const [pauseReason,       setPauseReason]        = useState("");
  const [showRotateDialog,  setShowRotateDialog]   = useState(false);
  const [isRotating,        setIsRotating]         = useState(false);

  // ── Derived: can this student request a skip? ──────────────
  //  • Role = student
  //  • Position 6–10 (tomorrow's team)
  //  • No active skip request already exists
  const canRequestSkip =
    role === "student" &&
    myPosition !== null &&
    myPosition >= 6 &&
    myPosition <= 10 &&
    !isSkipRequestActive(skipRequest, myPosition);

  // ─────────────────────────────────────────────────────────
  // FETCH TEAM DATA
  // ─────────────────────────────────────────────────────────
  const fetchTeamData = async () => {
    try {
      if (todayTeam.length === 0 && tomorrowTeam.length === 0) setLoading(true);

      const today    = getTodayIST();
      const tomorrow = new Date(Date.now() + IST_OFFSET + 86_400_000)
        .toISOString().split("T")[0];

      // ── Assignments ──────────────────────────────────────
      const { data: assignments, error: assignError } = await supabase
        .from("kitchen_assignments")
        .select("*")
        .in("assignment_date", [today, tomorrow]);

      if (assignError) throw assignError;

      const todayAssignment    = assignments?.find((a) => a.assignment_date === today);
      const tomorrowAssignment = assignments?.find((a) => a.assignment_date === tomorrow);

      // ── Profiles for both teams ───────────────────────────
      const [todayProfilesResult, tomorrowProfilesResult] = await Promise.all([
        todayAssignment?.profile_ids?.length
          ? supabase.from("profiles").select("id, full_name, status").in("id", todayAssignment.profile_ids)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; status: string }>, error: null }),
        tomorrowAssignment?.profile_ids?.length
          ? supabase.from("profiles").select("id, full_name, status").in("id", tomorrowAssignment.profile_ids)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; status: string }>, error: null }),
      ]);

      if (todayProfilesResult.error)    throw todayProfilesResult.error;
      if (tomorrowProfilesResult.error) throw tomorrowProfilesResult.error;

      // ── Build today's team ───────────────────────────────
      setTodayTeam(
        todayAssignment
          ? (todayAssignment.profile_ids || []).map((pid: string, i: number) => {
              const p = todayProfilesResult.data?.find((x) => x.id === pid);
              return { id: p?.id || pid, full_name: p?.full_name || "Unknown", status: p?.status || "active", position: i + 1 };
            })
          : []
      );

      // ── Build tomorrow's team ────────────────────────────
      setTomorrowTeam(
        tomorrowAssignment
          ? (tomorrowAssignment.profile_ids || []).map((pid: string, i: number) => {
              const p = tomorrowProfilesResult.data?.find((x) => x.id === pid);
              return { id: p?.id || pid, full_name: p?.full_name || "Unknown", status: p?.status || "active", position: i + 6 };
            })
          : []
      );

      // ── Student-specific data ────────────────────────────
      if (role === "student") {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user?.id)
          .maybeSingle();

        if (profileData) {
          setMyProfileId(profileData.id);

          // Determine current queue position
          const todayIdx    = todayAssignment?.profile_ids?.indexOf(profileData.id) ?? -1;
          const tomorrowIdx = tomorrowAssignment?.profile_ids?.indexOf(profileData.id) ?? -1;

          let newPosition: number | null = null;
          if (todayIdx >= 0) {
            newPosition = todayIdx + 1;
          } else if (tomorrowIdx >= 0) {
            newPosition = tomorrowIdx + 6;
          } else {
            const { data: queueData } = await supabase
              .from("kitchen_queue")
              .select("queue_position")
              .eq("profile_id", profileData.id)
              .maybeSingle();
            newPosition = queueData?.queue_position ?? null;
          }
          setMyPosition(newPosition);

          // ── Fetch skip request (only today's) ─────────────
          // Fetch any request submitted today (pending OR reviewed today)
          const { data: skipData } = await supabase
            .from("skip_requests")
            .select("*")
            .eq("profile_id", profileData.id)
            .gte("requested_at", getTodayStartIST())   // only today's requests
            .order("requested_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Use the helper WITH the freshly computed position so we don't
          // rely on stale myPosition state
          if (skipData && isSkipRequestActive(skipData as SkipRequest, newPosition)) {
            setSkipRequest(skipData as SkipRequest);
          } else {
            setSkipRequest(null);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast({ title: "Error", description: "Failed to load team data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchRotationSettings = async () => {
    const { data } = await supabase.from("rotation_settings").select("*").single();
    setRotationSettings(data);
  };

  // ─────────────────────────────────────────────────────────
  // INITIAL LOAD
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTeamData();
    if (role === "coordinator") fetchRotationSettings();
  }, [user, role]);

  // ─────────────────────────────────────────────────────────
  // REAL-TIME SUBSCRIPTIONS (student only)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myProfileId || role !== "student") return;

    // 1️⃣  Listen for skip_request INSERT / UPDATE for this student
    //     → coordinator ne approve/reject kiya toh turant UI update ho
    const skipChannel = supabase
      .channel(`skip-req-${myProfileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "skip_requests", filter: `profile_id=eq.${myProfileId}` },
        (payload) => {
          console.log("[realtime] skip_request change:", payload);

          if (payload.eventType === "DELETE") {
            setSkipRequest(null);
            return;
          }

          const updated = payload.new as SkipRequest;

          // Use current myPosition from state for the active-check
          setMyPosition((currentPos) => {
            const active = isSkipRequestActive(updated, currentPos);
            if (active) {
              setSkipRequest(updated);

              if (updated.status === "approved") {
                toast({
                  title: "✅ Skip Request Approved!",
                  description: updated.review_notes
                    ? `Coordinator: ${updated.review_notes}`
                    : "Your skip request has been approved.",
                });
                // Refresh to get updated position after swap
                setTimeout(fetchTeamData, 500);
              } else if (updated.status === "rejected") {
                toast({
                  title: "❌ Skip Request Rejected",
                  description: updated.review_notes
                    ? `Coordinator: ${updated.review_notes}`
                    : "Your skip request was rejected.",
                  variant: "destructive",
                });
              }
            } else {
              setSkipRequest(null);
            }
            return currentPos; // position unchanged here
          });
        }
      )
      .subscribe();

    // 2️⃣  Listen for kitchen_assignments changes
    //     → rotation hone pe position recalculate karo + skip request clear karo
    const assignmentChannel = supabase
      .channel(`assignments-${myProfileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_assignments" },
        (payload) => {
          console.log("[realtime] kitchen_assignments change — rotation detected:", payload);
          // Clear skip request immediately; fetchTeamData will re-evaluate
          setSkipRequest(null);
          fetchTeamData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(skipChannel);
      supabase.removeChannel(assignmentChannel);
    };
  }, [myProfileId, role]);

  // ─────────────────────────────────────────────────────────
  // MIDNIGHT AUTO-REFRESH  (fallback if realtime misses it)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const now       = new Date();
    const midnight  = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ms = midnight.getTime() - now.getTime();

    const timer = setTimeout(() => {
      setSkipRequest(null);
      fetchTeamData();
    }, ms);

    return () => clearTimeout(timer);
  }, []); // runs once on mount

  // ─────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────

  const handleSkipRequest = async () => {
    if (!myProfileId || myPosition === null) return;

    if (skipReason.length < 20) {
      toast({ title: "Too short", description: "Reason must be at least 20 characters.", variant: "destructive" });
      return;
    }

    // Double-safety: block if active request already exists
    if (isSkipRequestActive(skipRequest, myPosition)) {
      toast({ title: "Already submitted", description: "You already have an active skip request.", variant: "destructive" });
      return;
    }

    try {
      setSubmittingSkip(true);

      const { data: inserted, error } = await supabase
        .from("skip_requests")
        .insert({
          profile_id: myProfileId,
          queue_position_at_request: myPosition,
          reason: skipReason,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Immediately reflect in state — don't wait for realtime
      setSkipRequest(inserted as SkipRequest);

      toast({ title: "Request Submitted ✅", description: "You'll be notified when the coordinator reviews it." });
      setShowSkipDialog(false);
      setSkipReason("");
    } catch (error) {
      console.error("Error submitting skip request:", error);
      toast({ title: "Error", description: "Failed to submit skip request.", variant: "destructive" });
    } finally {
      setSubmittingSkip(false);
    }
  };

  const handlePauseRotation = async () => {
    const pausedUntil = new Date();
    pausedUntil.setHours(pausedUntil.getHours() + 24);

    const { error } = await supabase
      .from("rotation_settings")
      .update({
        is_paused:     true,
        paused_by:     user?.id,
        paused_at:     new Date().toISOString(),
        paused_until:  pausedUntil.toISOString(),
        paused_reason: pauseReason || "No reason provided",
      })
      .eq("id", rotationSettings?.id);

    if (!error) {
      toast({ title: "Queue rotation paused for 24 hours" });
      fetchRotationSettings();
      setShowPauseDialog(false);
      setPauseReason("");
    } else {
      toast({ title: "Failed to pause rotation", variant: "destructive" });
    }
  };

  const handleManualRotation = async () => {
    try {
      setIsRotating(true);
      const { data, error } = await supabase.functions.invoke("rotate-kitchen-queue");

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Rotation Successful",
          description: `Today's team: ${data.todayTeam}, Tomorrow's team: ${data.tomorrowTeam}`,
        });
        setSkipRequest(null);
        await fetchTeamData();
      } else if (data?.message) {
        toast({ title: "Rotation Skipped", description: data.message, variant: "destructive" });
      } else if (data?.error) {
        toast({
          title: "Rotation Failed",
          description: data.details ? `${data.error} (Code: ${data.details.code || "N/A"})` : data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to trigger rotation: ${error?.message || "Unknown error"}`, variant: "destructive" });
    } finally {
      setIsRotating(false);
      setShowRotateDialog(false);
    }
  };

  const getTimeRemaining = () => {
    if (!rotationSettings?.paused_until) return "";
    const hoursLeft = Math.ceil(
      (new Date(rotationSettings.paused_until).getTime() - Date.now()) / (1000 * 60 * 60)
    );
    return hoursLeft > 0 ? `${hoursLeft} hours` : "Resuming soon...";
  };

  // ─────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────
  const getSkipStatusBadge = (status: SkipRequest["status"]) => {
    const map = {
      pending:  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pending Review ⏳</Badge>,
      approved: <Badge variant="outline" className="bg-green-50  text-green-700  border-green-300" >Approved ✅</Badge>,
      rejected: <Badge variant="outline" className="bg-red-50    text-red-700    border-red-300"   >Rejected ❌</Badge>,
    };
    return map[status] ?? <Badge>{status}</Badge>;
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  const activeSkipRequest = isSkipRequestActive(skipRequest, myPosition) ? skipRequest : null;

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <p className="text-xl text-slate-800 text-muted-foreground font-bold capitalize">
            {role} Dashboard
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-4xl text-slate-800 font-bold mb-2">
            Welcome back, {user?.email?.split("@")[0] || "User"}!
          </h2>
          <p className="text-muted-foreground text-xl">
            {role === "student"
              ? "Check your kitchen duty schedule and position in the queue"
              : "Manage the kitchen duty queue and student assignments"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">

          {/* ── Today's Team ── */}
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#e91e63]" />
                Today's Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : todayTeam.length > 0 ? (
                <div className="space-y-2">
                  {todayTeam.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded bg-pink-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink-200 flex items-center justify-center font-bold text-sm text-pink-700">
                          {member.position}
                        </div>
                        <span className="text-base font-medium">{member.full_name}</span>
                      </div>
                      <Badge className="text-xs" variant={member.status === "active" ? "default" : "secondary"}>
                        {member.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No team assigned yet</p>
              )}
            </CardContent>
          </Card>

          {/* ── Tomorrow's Team ── */}
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#e91e63]" />
                Tomorrow's Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : tomorrowTeam.length > 0 ? (
                <div className="space-y-2">
                  {tomorrowTeam.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded bg-blue-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center font-bold text-sm text-blue-700">
                          {member.position}
                        </div>
                        <span className="text-base font-medium">{member.full_name}</span>
                      </div>
                      <Badge className="text-xs" variant={member.status === "active" ? "default" : "secondary"}>
                        {member.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No team assigned yet</p>
              )}
            </CardContent>
          </Card>

          {/* ── My Position / Quick Actions ── */}
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-[#e91e63]" />
                {role === "student" ? "My Position" : "Quick Actions"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {role === "student" ? (
                <>
                  {/* Queue Position */}
                  {myPosition !== null && (
                    <div className="text-center p-4 bg-pink-100 rounded-lg">
                      <p className="text-xl text-muted-foreground mb-1">Your Queue Position</p>
                      <p className="text-3xl font-bold text-[#e91e63]">#{myPosition}</p>
                      {myPosition >= 1 && myPosition <= 5 && (
                        <p className="text-sm text-muted-foreground mt-2">You're in today's team 🍳</p>
                      )}
                      {myPosition >= 6 && myPosition <= 10 && (
                        <p className="text-sm text-muted-foreground mt-2">You're in tomorrow's team</p>
                      )}
                    </div>
                  )}

                  {/*
                    ── Skip Request Status Box ──
                    Conditions to show:
                      • pending   → show always (waiting for review)
                      • approved  → show only if position still 6-10
                      • rejected  → show only if position still 6-10
                    Once rotation happens → position moves → box disappears automatically
                  */}
                  {activeSkipRequest && (
                    <div className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold">Skip Request</span>
                        {getSkipStatusBadge(activeSkipRequest.status)}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Your reason: </span>
                        {activeSkipRequest.reason}
                      </p>

                      {/* Coordinator note — only after review */}
                      {activeSkipRequest.status !== "pending" && activeSkipRequest.review_notes && (
                        <div className="mt-1 p-2 bg-muted rounded text-sm">
                          <p className="font-medium">Coordinator's Note:</p>
                          <p>{activeSkipRequest.review_notes}</p>
                        </div>
                      )}

                      {/* Waiting state */}
                      {activeSkipRequest.status === "pending" && (
                        <p className="text-xs text-muted-foreground italic">
                          Waiting for coordinator to review…
                        </p>
                      )}
                    </div>
                  )}

                  {/*
                    ── Request Skip Button ──
                    Show ONLY when:
                      • Position is 6-10
                      • No active skip request exists (pending or reviewed today)
                    i.e. canRequestSkip === true
                  */}
                  {canRequestSkip && (
                    <>
                      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">Can't make it tomorrow?</p>
                          <p className="text-sm text-blue-700 mt-0.5">Request to skip and swap with position 11</p>
                        </div>
                      </div>
                      <Button
                        className="w-full clay-button border-[#e91e63] text-[#e91e63] hover:bg-[#e91e63] hover:text-white"
                        variant="outline"
                        onClick={() => setShowSkipDialog(true)}
                      >
                        Request Skip
                      </Button>
                    </>
                  )}
                </>
              ) : (
                // ── Coordinator Quick Actions ──
                <>
                  <Button
                    className="w-full clay-button text-[#e91e63] border-[#e91e63] bg-white hover:text-white hover:bg-[#e91e63]"
                    variant="outline"
                    onClick={() => navigate("/queue-management")}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Queue
                  </Button>
                  <Button
                    className="w-full clay-button text-[#e91e63] border-[#e91e63] bg-white hover:text-white hover:bg-[#e91e63]"
                    variant="outline"
                    onClick={() => navigate("/student-management")}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Students
                  </Button>
                  <Button
                    className="w-full clay-button text-[#e91e63] border-[#e91e63] bg-white hover:text-white hover:bg-[#e91e63]"
                    variant="outline"
                    onClick={() => navigate("/skip-requests")}
                  >
                    Skip Requests
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Rotation Control (Coordinator only) ── */}
          {role === "coordinator" && (
            <Card className="clay-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#e91e63]" />
                  Rotation Control
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rotationSettings?.is_paused ? (
                    <>
                      <Badge variant="destructive">Rotation Paused</Badge>
                      <div className="text-sm space-y-2 mt-2">
                        <p className="text-muted-foreground">
                          Auto-resume in: <strong>{getTimeRemaining()}</strong>
                        </p>
                        <p className="text-muted-foreground">
                          Paused at: {new Date(rotationSettings.paused_at).toLocaleString()}
                        </p>
                        {rotationSettings.paused_reason && (
                          <p><strong>Reason:</strong> {rotationSettings.paused_reason}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge
                        variant="default"
                        className="text-sm px-6 py-1.5 text-[#e91e63] border border-[#e91e63] bg-white"
                      >
                        Rotation Active
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Next rotation: Tonight at 12:00 AM
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowPauseDialog(true)}
                          className="flex-1 bg-[#e91e63] text-white hover:bg-white hover:border-[#e91e63] hover:text-[#e91e63]"
                        >
                          Pause for 24 Hours
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowRotateDialog(true)}
                          className="flex-1 border-[#e91e63] text-[#e91e63] hover:bg-[#e91e63] hover:text-white"
                        >
                          <RotateCw className="h-4 w-4 mr-2" />
                          Test Rotation
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </main>

      {/* ════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════ */}

      {/* Skip Request Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Skip Tomorrow's Duty</DialogTitle>
            <DialogDescription>
              Your position ({myPosition}) will be swapped with the student at position 11.
              Please provide a reason (minimum 20 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="skip-reason">Reason for Skip Request</Label>
              <Textarea
                id="skip-reason"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="E.g., Doctor's appointment, family emergency, etc."
                rows={4}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {skipReason.length}/20 characters minimum
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSkipDialog(false); setSkipReason(""); }} disabled={submittingSkip}>
              Cancel
            </Button>
            <Button onClick={handleSkipRequest} disabled={submittingSkip || skipReason.length < 20}>
              {submittingSkip ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Rotation Confirmation Dialog */}
      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger Manual Rotation</DialogTitle>
            <DialogDescription>
              This will immediately rotate the queue. Top 5 → today's team, positions 6–10 → tomorrow's team, then queue rotates.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This is for testing. The automated midnight rotation will still run as scheduled.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotateDialog(false)} disabled={isRotating}>
              Cancel
            </Button>
            <Button onClick={handleManualRotation} disabled={isRotating} className="bg-[#e91e63] hover:bg-[#c2185b]">
              {isRotating ? (
                <><RotateCw className="h-4 w-4 mr-2 animate-spin" />Rotating…</>
              ) : (
                "Rotate Now"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Rotation Dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Queue Rotation</DialogTitle>
            <DialogDescription>
              Pauses automatic rotation for 24 hours. Auto-resumes after that.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="e.g., Holiday, maintenance, event day…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPauseDialog(false); setPauseReason(""); }}>
              Cancel
            </Button>
            <Button onClick={handlePauseRotation}>Pause for 24 Hours</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Dashboard;