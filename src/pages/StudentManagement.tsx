import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Info,
  Trash2,
  Crown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getISTDate } from "@/lib/utils";

interface Student {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  user_id: string;
  role: "coordinator" | "student";
  in_queue?: boolean;
  queue_position?: number;
  in_today_team?: boolean;
  in_tomorrow_team?: boolean;
  can_change_status?: boolean;
  can_deactivate?: boolean;
  last_queue_position?: number | null;
}

type StatusFilter = "all" | "active" | "inactive";

const StudentManagement = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // States
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    studentId: string | null;
    studentName: string;
    currentStatus: string;
    inQueue: boolean;
    inTodayTeam: boolean;
    inTomorrowTeam: boolean;
  }>({
    open: false,
    studentId: null,
    studentName: "",
    currentStatus: "",
    inQueue: false,
    inTodayTeam: false,
    inTomorrowTeam: false,
  });

  const [roleHandoffDialog, setRoleHandoffDialog] = useState<{
    open: boolean;
    targetStudent: Student | null;
  }>({
    open: false,
    targetStudent: null,
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    student: Student | null;
  }>({
    open: false,
    student: null,
  });

  useEffect(() => {
    if (role !== "coordinator") {
      navigate("/dashboard");
      return;
    }
    fetchStudents();
  }, [role, navigate]);

  const fetchStudents = async () => {
    try {
      setLoading(true);

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles_with_roles")
        .select(
          "id, full_name, email, status, created_at, last_queue_position, user_id, role"
        )
        .order("full_name");

      if (profilesError) throw profilesError;

      const { data: queueData, error: queueError } = await supabase
        .from("kitchen_queue")
        .select("profile_id, queue_position");

      if (queueError) throw queueError;

      const today = getISTDate(0);
      const { data: todayAssignment } = await supabase
        .from("kitchen_assignments")
        .select("profile_ids")
        .eq("assignment_date", today)
        .maybeSingle();

      const todayProfileIds = todayAssignment?.profile_ids || [];

      const tomorrow = getISTDate(1);
      const { data: tomorrowAssignment } = await supabase
        .from("kitchen_assignments")
        .select("profile_ids")
        .eq("assignment_date", tomorrow)
        .maybeSingle();

      const tomorrowProfileIds = tomorrowAssignment?.profile_ids || [];

      const studentsWithEligibility =
        profilesData?.map((profile) => {
          const inQueue = !!queueData?.find((q) => q.profile_id === profile.id);
          const inTodayTeam = todayProfileIds.includes(profile.id);
          const inTomorrowTeam = tomorrowProfileIds.includes(profile.id);

          const canChangeStatus =
            profile.status === "inactive" ? true : inQueue || inTomorrowTeam;
          const canDeactivate = canChangeStatus && !inTodayTeam;

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            status: profile.status,
            created_at: profile.created_at,
            user_id: profile.user_id,
            role: profile.role,
            in_queue: inQueue,
            queue_position: queueData?.find((q) => q.profile_id === profile.id)
              ?.queue_position,
            in_today_team: inTodayTeam,
            in_tomorrow_team: inTomorrowTeam,
            can_change_status: canChangeStatus,
            can_deactivate: canDeactivate,
            last_queue_position: profile.last_queue_position,
          };
        }) || [];

      setStudents(studentsWithEligibility);
    } catch (error: any) {
      console.error("Error fetching students:", error);
      toast({
        title: "Error",
        description: "Failed to load students.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = (student: Student) => {
    if (student.status === "active" && student.in_today_team) {
      toast({
        title: "Cannot Deactivate",
        description: "This student is in today's kitchen team.",
        variant: "destructive",
      });
      return;
    }

    setConfirmDialog({
      open: true,
      studentId: student.id,
      studentName: student.full_name,
      currentStatus: student.status,
      inQueue: student.in_queue || false,
      inTodayTeam: student.in_today_team || false,
      inTomorrowTeam: student.in_tomorrow_team || false,
    });
  };

  const handleQueueBackfill = async (deactivatedStudentId: string) => {
    try {
      const { data: queueRecord } = await supabase
        .from("kitchen_queue")
        .select("queue_position")
        .eq("profile_id", deactivatedStudentId)
        .single();
      if (queueRecord) {
        await supabase
          .from("profiles")
          .update({ last_queue_position: queueRecord.queue_position })
          .eq("id", deactivatedStudentId);
      }
      await supabase
        .from("kitchen_queue")
        .delete()
        .eq("profile_id", deactivatedStudentId);

      const { data: currentQueue } = await supabase
        .from("kitchen_queue")
        .select("id, profile_id")
        .order("queue_position", { ascending: true });
      const queueProfileIds = currentQueue?.map((q) => q.profile_id) || [];
      // Exclude coordinators from backfill - they should never be in kitchen queue
      const { data: availableStudent } = await supabase
        .from("profiles_with_roles")
        .select("id")
        .eq("status", "active")
        .neq("role", "coordinator")
        .not("id", "in", `(${queueProfileIds.join(",")})`)
        .limit(1)
        .maybeSingle();

      if (availableStudent) {
        const newPosition = (currentQueue?.length || 0) + 1;
        await supabase.from("kitchen_queue").insert({
          profile_id: availableStudent.id,
          queue_position: newPosition,
          joined_at: new Date().toISOString(),
        });
      }

      const { data: finalQueue } = await supabase
        .from("kitchen_queue")
        .select("id")
        .order("queue_position", { ascending: true });
      if (finalQueue) {
        const positionUpdates = finalQueue.map((item, index) => ({
          id: item.id,
          queue_position: index + 1,
          last_duty_date: "null",
        }));
        await supabase.rpc("update_queue_positions_batch", {
          position_updates: positionUpdates,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQueueRestoration = async (activatedStudentId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("last_queue_position")
        .eq("id", activatedStudentId)
        .single();
      if (!profile?.last_queue_position) return;

      const savedPosition = profile.last_queue_position;
      const { data: currentQueue } = await supabase
        .from("kitchen_queue")
        .select("id, queue_position")
        .order("queue_position", { ascending: true });
      const insertPosition = Math.min(
        savedPosition,
        (currentQueue?.length || 0) + 1
      );

      if (currentQueue && currentQueue.length > 0) {
        const shiftUpdates = currentQueue
          .filter((i) => i.queue_position >= insertPosition)
          .map((i) => ({
            id: i.id,
            queue_position: i.queue_position + 1,
            last_duty_date: "null",
          }));
        if (shiftUpdates.length > 0)
          await supabase.rpc("update_queue_positions_batch", {
            position_updates: shiftUpdates,
          });
      }

      await supabase.from("kitchen_queue").insert({
        profile_id: activatedStudentId,
        queue_position: insertPosition,
        joined_at: new Date().toISOString(),
      });
      await supabase
        .from("profiles")
        .update({ last_queue_position: null })
        .eq("id", activatedStudentId);
    } catch (e) {
      console.error(e);
    }
  };

  const confirmStatusChange = async () => {
    if (!confirmDialog.studentId) return;
    try {
      const student = students.find((s) => s.id === confirmDialog.studentId);
      const newStatus =
        confirmDialog.currentStatus === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", confirmDialog.studentId);
      if (error) throw error;

      if (newStatus === "inactive" && student?.in_queue)
        await handleQueueBackfill(confirmDialog.studentId);
      if (newStatus === "active")
        await handleQueueRestoration(confirmDialog.studentId);

      toast({
        title: "Success",
        description: `Student ${
          newStatus === "active" ? "activated" : "deactivated"
        }.`,
      });
      await fetchStudents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Update failed.",
        variant: "destructive",
      });
    } finally {
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  const handleDeleteStudent = async () => {
    const student = deleteDialog.student;
    if (!student) return;

    try {
      setLoading(true);

      // Use the database function for complete deletion
      const { error: functionError } = await supabase.rpc(
        "delete_student_completely",
        {
          student_profile_id: student.id,
        }
      );

      if (functionError) {
        console.error("Delete function error:", functionError);
        throw functionError;
      }

      toast({
        title: "Student Deleted",
        description: `${student.full_name} has been permanently removed from the system.`,
      });

      await fetchStudents();
    } catch (error: any) {
      console.error("Error deleting student:", error);

      const errorMessage = error?.message || "Unknown error occurred";

      toast({
        title: "Deletion Failed",
        description:
          errorMessage.includes("permission") ||
          errorMessage.includes("coordinator")
            ? "You don't have permission to delete students. Only coordinators can perform this action."
            : `Failed to delete student: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDeleteDialog({ open: false, student: null });
    }
  };

  const handleRoleHandoff = async (targetStudent: Student) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await supabase
        .from("user_roles")
        .update({ role: "coordinator" })
        .eq("user_id", targetStudent.user_id);
      await supabase
        .from("user_roles")
        .update({ role: "student" })
        .eq("user_id", user.id);
      window.location.href = "/";
    } catch (e) {
      console.error(e);
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      (statusFilter === "all" || student.status === statusFilter) &&
      (student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Student Management</h1>
              <p className="text-muted-foreground">
                Manage student activation and deactivation
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">
                Total Students
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">
                Active Students
              </CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {students.filter((s) => s.status === "active").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium">
                Inactive Students
              </CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {students.filter((s) => s.status === "inactive").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:max-w-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "active" ? "default" : "outline"}
                  onClick={() => setStatusFilter("active")}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === "inactive" ? "default" : "outline"}
                  onClick={() => setStatusFilter("inactive")}
                >
                  Inactive
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center  py-8">Loading...</div>
            ) : (
              <div className="border  rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      {/* ✅ Status Column Wapas Aa Gaya (Action se pehle) */}
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.full_name}
                        </TableCell>
                        <TableCell>{student.email}</TableCell>

                        <TableCell>
                          {student.role === "coordinator" ? (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
                              👑 Coordinator
                            </Badge>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setRoleHandoffDialog({
                                        open: true,
                                        targetStudent: student,
                                      })
                                    }
                                    className="h-7 px-3 text-sm text-muted-foreground hover:bg-purple-100 hover:text-purple-700"
                                  >
                                    Promote
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Promote to Coordinator</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
 
                        <TableCell>
                          {student.status === "active" ? (
                            <Badge
                              variant="outline"
                              className="text-green-600 bg-green-50 border-green-200"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-muted-foreground"
                            >
                              Inactive
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!student.can_change_status ? (
                            
<Switch
    checked={student.status === "active"}
    disabled={true}
    className="
        h-6 w-12           
        data-[state=checked]:bg-black
        bg-rose-400        
        switch-custom-thumb"/>
) : (
    <Switch
        checked={student.status === "active"}
        onCheckedChange={() => handleStatusToggle(student)}
        className="
            h-6 w-12          
            data-[state=checked]:bg-emerald-500  
            bg-rose-400        
            border-0          
            switch-custom-thumb "/>
                           )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              onClick={() =>
                                setDeleteDialog({ open: true, student })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DIALOGS */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ ...confirmDialog, open: false })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.currentStatus === "active"
                ? "Deactivate"
                : "Activate"}{" "}
              Student?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.currentStatus === "active"
                ? "Student will be removed from queue."
                : "Student will be restored to queue if possible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, student: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Delete Student?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteDialog.student?.full_name}</strong>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={roleHandoffDialog.open}
        onOpenChange={(open) =>
          setRoleHandoffDialog({ open, targetStudent: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Role?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                roleHandoffDialog.targetStudent &&
                handleRoleHandoff(roleHandoffDialog.targetStudent)
              }
            >
              Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentManagement;
