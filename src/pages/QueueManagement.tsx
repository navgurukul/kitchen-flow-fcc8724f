import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Users, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface QueueItem {
  id: string;
  queue_position: number;
  profiles: {
    id: string;
    full_name: string;
    status: string;
    email: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  status: string;
}

interface QueueItemProps {
  item: QueueItem;
  section: "today" | "tomorrow" | "remaining";
}

const QueueItem = ({ item, section }: QueueItemProps) => {
  const bgColor = 
    section === "today" ? "bg-pink-100 border-pink-300" :
    section === "tomorrow" ? "bg-blue-100 border-blue-300" :
    "bg-white border-gray-200";

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${bgColor}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
          {item.queue_position}
        </div>
        <div>
          <p className="font-medium">{item.profiles?.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {item.profiles?.email}
          </p>
        </div>
      </div>
    </div>
  );
};

const QueueManagement = () => {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [todayTeam, setTodayTeam] = useState<QueueItem[]>([]);
  const [tomorrowTeam, setTomorrowTeam] = useState<QueueItem[]>([]);
  const [remainingQueue, setRemainingQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableStudents, setAvailableStudents] = useState<Profile[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (role !== "coordinator") {
      navigate("/dashboard");
      return;
    }
    fetchQueue();
    fetchAvailableStudents();
  }, [role, navigate]);

  const fetchQueue = async () => {
    try {
      const shouldShowLoading =
        todayTeam.length === 0 &&
        tomorrowTeam.length === 0 &&
        remainingQueue.length === 0;
      if (shouldShowLoading) {
        setLoading(true);
      }
      
      // Get IST dates like Dashboard does
      const IST_OFFSET = 5.5 * 60 * 60 * 1000;
      const today = new Date(Date.now() + IST_OFFSET)
        .toISOString()
        .split("T")[0];
      const tomorrow = new Date(Date.now() + IST_OFFSET + 86400000)
        .toISOString()
        .split("T")[0];

      const [assignmentsResult, allQueueResult] = await Promise.all([
        supabase
          .from("kitchen_assignments")
          .select("*")
          .in("assignment_date", [today, tomorrow]),
        supabase
          .from("kitchen_queue")
          .select(
            `
          id,
          queue_position,
          profiles:profile_id (
            id,
            full_name,
            status,
            email
          )
        `
          )
          .order("queue_position", { ascending: true }),
      ]);

      if (assignmentsResult.error) throw assignmentsResult.error;
      if (allQueueResult.error) throw allQueueResult.error;

      const assignments = assignmentsResult.data;

      const todayAssignment = assignments?.find(
        (a) => a.assignment_date === today
      );
      const tomorrowAssignment = assignments?.find(
        (a) => a.assignment_date === tomorrow
      );

      const [todayProfilesResult, tomorrowProfilesResult] = await Promise.all([
        todayAssignment?.profile_ids?.length
          ? supabase
              .from("profiles")
              .select("id, full_name, email, status")
              .in("id", todayAssignment.profile_ids)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; email: string; status: string }>, error: null }),
        tomorrowAssignment?.profile_ids?.length
          ? supabase
              .from("profiles")
              .select("id, full_name, email, status")
              .in("id", tomorrowAssignment.profile_ids)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; email: string; status: string }>, error: null }),
      ]);

      if (todayProfilesResult.error) throw todayProfilesResult.error;
      if (tomorrowProfilesResult.error) throw tomorrowProfilesResult.error;

      if (todayAssignment) {
        const todayProfiles = todayProfilesResult.data;

        const todayTeamData = (todayAssignment.profile_ids || [])
          .map((profileId: string, index: number) => {
            const profile = todayProfiles?.find((p) => p.id === profileId);
            return {
              id: profileId,
              queue_position: index + 1,
              profiles: {
                id: profile?.id || profileId,
                full_name: profile?.full_name || "Unknown",
                email: profile?.email || "",
                status: profile?.status || "active",
              },
            };
          });
        setTodayTeam(todayTeamData);
      }

      if (tomorrowAssignment) {
        const tomorrowProfiles = tomorrowProfilesResult.data;

        const tomorrowTeamData = (tomorrowAssignment.profile_ids || [])
          .map((profileId: string, index: number) => {
            const profile = tomorrowProfiles?.find((p) => p.id === profileId);
            return {
              id: profileId,
              queue_position: index + 6,
              profiles: {
                id: profile?.id || profileId,
                full_name: profile?.full_name || "Unknown",
                email: profile?.email || "",
                status: profile?.status || "active",
              },
            };
          });
        setTomorrowTeam(tomorrowTeamData);
      }

      const allQueue = allQueueResult.data;

      const assignedProfileIds = new Set<string>([
        ...(todayAssignment?.profile_ids || []),
        ...(tomorrowAssignment?.profile_ids || []),
      ]);

      const remaining = (allQueue || []).filter((item) => {
        const profileId = item.profiles?.id || "";
        return item.queue_position > 10 && !assignedProfileIds.has(profileId);
      });
      setRemainingQueue(remaining);

      setQueue(allQueue || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
      toast({
        title: "Error",
        description: "Failed to load queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles_with_roles")
        .select("id, full_name, email, status")
        .eq("status", "active")
        .neq("role", "coordinator");

      if (profilesError) throw profilesError;

      const { data: queueData, error: queueError } = await supabase
        .from("kitchen_queue")
        .select("profile_id");

      if (queueError) throw queueError;

      const queueProfileIds = new Set(
        queueData?.map((q) => q.profile_id) || []
      );
      const available = (allProfiles || []).filter(
        (p) => !queueProfileIds.has(p.id)
      );

      setAvailableStudents(available);
    } catch (error) {
      console.error("Error fetching available students:", error);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedStudent) return;

    try {
      const { data: maxData, error: maxError } = await supabase
        .from("kitchen_queue")
        .select("queue_position")
        .order("queue_position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError) throw maxError;

      const maxPosition = maxData?.queue_position || 0;

      const { error } = await supabase.from("kitchen_queue").insert({
        profile_id: selectedStudent,
        queue_position: maxPosition + 1,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student added to queue",
      });

      setAddDialogOpen(false);
      setSelectedStudent("");
      fetchQueue();
      fetchAvailableStudents();
    } catch (error) {
      console.error("Error adding student:", error);
      toast({
        title: "Error",
        description: "Failed to add student to queue",
        variant: "destructive",
      });
    }
  };

  const handleBulkInitialize = async () => {
    if (selectedStudents.size === 0) return;

    try {
      const { data: maxData, error: maxError } = await supabase
        .from("kitchen_queue")
        .select("queue_position")
        .order("queue_position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError) throw maxError;

      const maxPosition = maxData?.queue_position || 0;

      const studentsToAdd = Array.from(selectedStudents).map(
        (profileId, index) => ({
          profile_id: profileId,
          queue_position: maxPosition + index + 1,
        })
      );

      const { error } = await supabase
        .from("kitchen_queue")
        .insert(studentsToAdd);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Added ${selectedStudents.size} students to queue`,
      });

      setBulkDialogOpen(false);
      setSelectedStudents(new Set());
      fetchQueue();
      fetchAvailableStudents();
    } catch (error) {
      console.error("Error initializing queue:", error);
      toast({
        title: "Error",
        description: "Failed to initialize queue",
        variant: "destructive",
      });
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const filteredQueue = queue.filter(
    (item) =>
      item.profiles?.full_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5 text-[#e91e63]" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Queue Management
              </h1>
              <p className="text-muted-foreground">
                Manage the kitchen duty rotation queue
              </p>
            </div>
          </div>
          {/* <Button onClick={signOut} variant="outline">
          Sign Out
        </Button> */}
        </div>

        <Card className="border-pink-300 bg-rose-100">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#e91e63] " />
              <div>
                <p className="font-medium text-foreground">
                  Automated Queue Rotation
                </p>
                <p className="text-xl text-muted-foreground">
                  Queue automatically rotates at midnight (00:00 IST) every day
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Queue Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] "
              />

              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="hover:bg-[#e91e63] hover:text-white border-[#e91e63]">
                    <Users className="h-4 w-4 mr-2  " />
                    Add New Students
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Initialize Queue</DialogTitle>
                    <DialogDescription>
                      Select all students to add to the queue. They will be
                      added in the order shown.
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {availableStudents.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent"
                        >
                          <Checkbox
                            id={student.id}
                            checked={selectedStudents.has(student.id)}
                            onCheckedChange={() =>
                              toggleStudentSelection(student.id)
                            }
                          />
                          <label
                            htmlFor={student.id}
                            className="flex-1 cursor-pointer text-2xl font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            <div>
                              <p>{student.full_name}</p>
                              <p className="text-muted-foreground text-xl">
                                {student.email}
                              </p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBulkDialogOpen(false);
                        setSelectedStudents(new Set());
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleBulkInitialize}
                      disabled={selectedStudents.size === 0}
                    >
                      Add {selectedStudents.size} Students
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Queue List */}
        <Card>
          <CardHeader>
            <CardTitle>Current Queue ({queue.length} students)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground ">Loading queue...</p>
            ) : todayTeam.length > 0 || tomorrowTeam.length > 0 || remainingQueue.length > 0 ? (
              <div className="space-y-6">
                {/* Today's Team */}
                {todayTeam.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-pink-700">📅 Today's Team</h3>
                    <div className="space-y-2">
                      {todayTeam.map((item) => (
                        <QueueItem key={item.id} item={item} section="today" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tomorrow's Team */}
                {tomorrowTeam.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-blue-700">📆 Tomorrow's Team</h3>
                    <div className="space-y-2">
                      {tomorrowTeam.map((item) => (
                        <QueueItem key={item.id} item={item} section="tomorrow" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Remaining */}
                {remainingQueue.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">📋 Remaining Queue</h3>
                    <div className="space-y-2">
                      {remainingQueue.map((item) => (
                        <QueueItem key={item.id} item={item} section="remaining" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8  text-muted-foreground">
                <p>No students in queue</p>
                <p className="text-xl">
                  Use "Add Student" or "Bulk Initialize" to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QueueManagement;
