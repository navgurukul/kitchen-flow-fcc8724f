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
  LogOut,
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
}

interface SkipRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  requested_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
}

const Dashboard = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [todayTeam, setTodayTeam] = useState<TeamMember[]>([]);
  const [tomorrowTeam, setTomorrowTeam] = useState<TeamMember[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [skipRequest, setSkipRequest] = useState<SkipRequest | null>(null);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [submittingSkip, setSubmittingSkip] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rotationSettings, setRotationSettings] = useState<any>(null);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    fetchTeamData();
    if (role === "coordinator") {
      fetchRotationSettings();
    }
  }, [user, role]);

  // Check if skip request should be shown (valid only for today)
  const isSkipRequestToday = () => {
    if (!skipRequest || skipRequest.status === "pending") {
      return false;
    }

    // Compare the date of review_notes with today's date
    const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST timezone
    const reviewedDate = new Date(skipRequest.reviewed_at || new Date());
    const today = new Date(Date.now() + IST_OFFSET);

    // Convert both to date string (YYYY-MM-DD) for comparison
    const reviewedDateString = reviewedDate.toISOString().split('T')[0];
    const todayString = today.toISOString().split('T')[0];

    return reviewedDateString === todayString;
  };

  // Auto-dismiss skip request at midnight and refresh periodically
  useEffect(() => {
    if (!skipRequest || skipRequest.status === "pending") {
      return;
    }

    // Check immediately if still valid today
    if (!isSkipRequestToday()) {
      setSkipRequest(null);
      return;
    }

    // Set up periodic check (every minute) and midnight dismiss
    const calculateTimeUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight.getTime() - now.getTime();
    };

    const timeUntilMidnight = calculateTimeUntilMidnight();
    
    console.log(`Skip request will auto-dismiss in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`);

    // Set timeout to dismiss at midnight
    const midnightTimer = setTimeout(() => {
      console.log("Midnight reached - clearing skip request");
      setSkipRequest(null);
      fetchTeamData();
    }, timeUntilMidnight);

    // Also set up periodic check (every minute) in case of time zone issues
    const minuteTimer = setInterval(() => {
      if (!isSkipRequestToday()) {
        console.log("Skip request is no longer valid - clearing");
        setSkipRequest(null);
      }
    }, 60000); // Check every minute

    return () => {
      clearTimeout(midnightTimer);
      clearInterval(minuteTimer);
    };
  }, [skipRequest]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      // Get dates in IST timezone (UTC+5:30)
      const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const today = new Date(Date.now() + IST_OFFSET)
        .toISOString()
        .split("T")[0];
      const tomorrow = new Date(Date.now() + IST_OFFSET + 86400000)
        .toISOString()
        .split("T")[0];

      // Fetch today's and tomorrow's assignments
      const { data: assignments, error: assignError } = await supabase
        .from("kitchen_assignments")
        .select("*")
        .in("assignment_date", [today, tomorrow]);

      if (assignError) throw assignError;

      // Fetch profiles for team members
      const todayAssignment = assignments?.find(
        (a) => a.assignment_date === today
      );
      const tomorrowAssignment = assignments?.find(
        (a) => a.assignment_date === tomorrow
      );

      if (todayAssignment) {
        const { data: todayProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, status")
          .in("id", todayAssignment.profile_ids);

        setTodayTeam(todayProfiles || []);
      }

      if (tomorrowAssignment) {
        const { data: tomorrowProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, status")
          .in("id", tomorrowAssignment.profile_ids);

        setTomorrowTeam(tomorrowProfiles || []);
      }

      // Fetch user's queue position (for students)
      if (role === "student") {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user?.id)
          .maybeSingle();

        if (profileData) {
          setMyProfileId(profileData.id);

          const { data: queueData } = await supabase
            .from("kitchen_queue")
            .select("queue_position")
            .eq("profile_id", profileData.id)
            .maybeSingle();

          if (queueData) {
            setMyPosition(queueData.queue_position);
          }

          // Fetch skip request if exists
          const { data: skipData } = await supabase
            .from("skip_requests")
            .select("*")
            .eq("profile_id", profileData.id)
            .order("requested_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (skipData) {
            setSkipRequest(skipData as SkipRequest);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRotationSettings = async () => {
    const { data } = await supabase
      .from("rotation_settings")
      .select("*")
      .single();
    setRotationSettings(data);
  };

  const handlePauseRotation = async () => {
    const pausedUntil = new Date();
    pausedUntil.setHours(pausedUntil.getHours() + 24); // Add 24 hours

    const { error } = await supabase
      .from("rotation_settings")
      .update({
        is_paused: true,
        paused_by: user?.id,
        paused_at: new Date().toISOString(),
        paused_until: pausedUntil.toISOString(),
        paused_reason: pauseReason || "No reason provided",
      })
      .eq("id", rotationSettings?.id);

    if (!error) {
      toast({ title: "Queue rotation paused for 24 hours" });
      fetchRotationSettings();
      setShowPauseDialog(false);
      setPauseReason("");
    } else {
      toast({
        title: "Failed to pause rotation",
        variant: "destructive",
      });
    }
  };

  const getTimeRemaining = () => {
    if (!rotationSettings?.paused_until) return "";
    const now = new Date();
    const pausedUntil = new Date(rotationSettings.paused_until);
    const hoursLeft = Math.ceil(
      (pausedUntil.getTime() - now.getTime()) / (1000 * 60 * 60)
    );
    return hoursLeft > 0 ? `${hoursLeft} hours` : "Resuming soon...";
  };

  const handleManualRotation = async () => {
    try {
      setIsRotating(true);

      const { data, error } = await supabase.functions.invoke(
        "rotate-kitchen-queue"
      );

      console.log("Rotation response:", { data, error });

      if (error) {
        console.error("Function invoke error:", error);
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Rotation Successful",
          description: `Queue rotated! Today's team: ${data.todayTeam}, Tomorrow's team: ${data.tomorrowTeam}`,
        });
        // Refresh data to show updated assignments
        await fetchTeamData();
        // Also clear any old skip requests and refresh
        setSkipRequest(null);
      } else if (data?.message) {
        toast({
          title: "Rotation Skipped",
          description: data.message,
          variant: "destructive",
        });
      } else if (data?.error) {
        const errorMsg = data.details
          ? `${data.error} (Code: ${data.details.code || "N/A"})`
          : data.error;
        toast({
          title: "Rotation Failed",
          description: errorMsg,
          variant: "destructive",
        });
        console.error("Rotation error details:", data.details);
      }
    } catch (error: any) {
      console.error("Error triggering rotation:", error);
      const errorMessage =
        error?.message || error?.toString() || "Unknown error occurred";
      toast({
        title: "Error",
        description: `Failed to trigger rotation: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsRotating(false);
      setShowRotateDialog(false);
    }
  };

  const handleSkipRequest = async () => {
    if (!myProfileId || !myPosition || skipReason.length < 20) {
      toast({
        title: "Invalid Request",
        description: "Please provide a reason of at least 20 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmittingSkip(true);
      const { error } = await supabase.from("skip_requests").insert({
        profile_id: myProfileId,
        queue_position_at_request: myPosition,
        reason: skipReason,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Success",
        description:
          "Your skip request has been submitted. You'll be notified when it's reviewed.",
      });

      setShowSkipDialog(false);
      setSkipReason("");
      fetchTeamData(); // Refresh to show the new request
    } catch (error) {
      console.error("Error submitting skip request:", error);
      toast({
        title: "Error",
        description: "Failed to submit skip request",
        variant: "destructive",
      });
    } finally {
      setSubmittingSkip(false);
    }
  };

  const canRequestSkip =
    role === "student" &&
    myPosition !== null &&
    myPosition >= 6 &&
    myPosition <= 10 &&
    (!skipRequest || !isSkipRequestToday());

  const getSkipStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-300"
          >
            Pending Review
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-300"
          >
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-300"
          >
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <p className="text-xl  text-slate-800 text-muted-foreground font-bold capitalize">
            {role} Dashboard
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-4xl text-slate-800  font-bold mb-2">
            Welcome back, {user?.email?.split("@")[0] || "User"}!
          </h2>
          <p className="text-muted-foreground text-xl">
            {role === "student"
              ? "Check your kitchen duty schedule and position in the queue"
              : "Manage the kitchen duty queue and student assignments"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 ">
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#e91e63] " />
                Today's Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : todayTeam.length > 0 ? (
                <div className="space-y-2">
                  {todayTeam.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xl">{member.full_name}</span>
                      <Badge
                        className="text-lg"

                        variant={
                          member.status === "active" ? "default" : "secondary"
                        }
                      >
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
                    <div
                      key={member.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xl">{member.full_name}</span>
                      <Badge
                        className="text-lg"

                        variant={
                          member.status === "active" ? "default" : "secondary" 
                        }
                      >
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

          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-[#e91e63]" />
                {role === "student" ? "My Position" : "Quick Actions"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {role === "student" ? (
                <>
                  {myPosition !== null && (
                    <div className="text-center p-4 bg-pink-100 rounded-lg ">
                      <p className="text-xl text-muted-foreground mb-1">
                        Your Queue Position
                      </p>
                      <p className="text-3xl font-bold text-[#e91e63]">
                        #{myPosition}
                      </p>
                      {myPosition >= 6 && myPosition <= 10 && (
                        <p className="text-xl text-muted-foreground mt-2">
                          You're in tomorrow's team
                        </p>
                      )}
                    </div>
                  )}

                  {/* Skip Request Status */}
                  {skipRequest && isSkipRequestToday() && (
                    <div className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-medium">
                          Skip Request
                        </span>
                        {getSkipStatusBadge(skipRequest.status)}
                      </div>
                      <p className="text-xl text-muted-foreground">
                        {skipRequest.reason}
                      </p>
                      {skipRequest.review_notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-xl">
                          <p className="font-medium">Coordinator Notes:</p>
                          <p>{skipRequest.review_notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Skip Request Button */}
                  {canRequestSkip && (
                    <>
                      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xl font-medium text-blue-900">
                            Can't make it tomorrow?
                          </p>
                          <p className="text-xl text-blue-700 mt-1">
                            Request to skip and swap with position 11
                          </p>
                        </div>
                      </div>
                      <Button
                        className="w-full clay-button border-[#e91e63]   text-[#e91e63] hover:bg-[#e91e63]  hover:text-white"
                        variant="outline"
                        onClick={() => setShowSkipDialog(true)}
                      >
                        Request Skip
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Button
                    className="w-full clay-button text-[#e91e63] border-[#e91e63] bg-white  hover:text-white hover:bg-[#e91e63]"
                    variant="outline"
                    onClick={() => navigate("/queue-management")}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Queue
                  </Button>
                  <Button
                    className="w-full clay-button text-[#e91e63] border-[#e91e63] bg-white  hover:text-white hover:bg-[#e91e63]"
                    variant="outline"
                    onClick={() => navigate("/student-management")}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Students
                  </Button>
                  <Button
                    className="w-full clay-button text-[#e91e63] border-[#e91e63] bg-white hover:text-white hover:bg-[#e91e63] "
                    variant="outline"
                    onClick={() => navigate("/skip-requests")}
                  >
                    Skip Requests
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Rotation Control Card (Coordinators Only) */}
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
                      <Badge variant="destructive" className="mb-2">
                        Rotation Paused
                      </Badge>
                      <div className="text-xl space-y-2">
                        <p className="text-muted-foreground">
                          Auto-resume in: <strong>{getTimeRemaining()}</strong>
                        </p>
                        <p className="text-muted-foreground">
                          Paused at:{" "}
                          {new Date(
                            rotationSettings.paused_at
                          ).toLocaleString()}
                        </p>
                        {rotationSettings.paused_reason && (
                          <p>
                            <strong>Reason:</strong>{" "}
                            {rotationSettings.paused_reason}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge
                        variant="default"
                        className="mb-2  text-sm px-10 py-2 text-[#e91e63] border-[#e91e63] bg-white  hover:text-white hover:bg-[#e91e63]"
                      >
                        Rotation Active
                      </Badge>
                      <p className="text-xl text-muted-foreground mb-4">
                        Next rotation: Tonight at 12:00 AM
                      </p>
                      <div className="flex gap-2">
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

      {/* Skip Request Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Skip Tomorrow's Duty</DialogTitle>
            <DialogDescription>
              Your position ({myPosition}) will be swapped with the student at
              position 11. Please provide a reason for your request (minimum 20
              characters).
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
              <p className="text-xl text-muted-foreground mt-1">
                {skipReason.length}/20 characters minimum
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSkipDialog(false);
                setSkipReason("");
              }}
              disabled={submittingSkip}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSkipRequest}
              disabled={submittingSkip || skipReason.length < 20}
            >
              {submittingSkip ? "Submitting..." : "Submit Request"}
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
              This will immediately rotate the queue, just like the automatic
              midnight rotation. The top 5 active students will be assigned to
              today's team, positions 6-10 to tomorrow's team, and then the
              queue will rotate (top 5 move to bottom).
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xl text-yellow-800">
              <strong>Note:</strong> This is for testing purposes. The automated
              midnight rotation will still run as scheduled. Running this
              multiple times will rotate the queue each time.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRotateDialog(false)}
              disabled={isRotating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualRotation}
              disabled={isRotating}
              className="bg-[#e91e63] hover:bg-[#c2185b]"
            >
              {isRotating ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  Rotating...
                </>
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
              This will pause the automatic queue rotation for the next 24
              hours. It will automatically resume after that.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="e.g., Holiday, maintenance, event day..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPauseDialog(false);
                setPauseReason("");
              }}
            >
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
