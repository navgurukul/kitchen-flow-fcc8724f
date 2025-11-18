import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Users, UserCheck, UserX, AlertTriangle, Info } from "lucide-react";
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
  in_queue?: boolean;
  queue_position?: number;
  in_today_team?: boolean;
  in_tomorrow_team?: boolean;
  can_change_status?: boolean;
  can_deactivate?: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive';

const StudentManagement = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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
    studentName: '',
    currentStatus: '',
    inQueue: false,
    inTodayTeam: false,
    inTomorrowTeam: false,
  });

  useEffect(() => {
    if (role !== 'coordinator') {
      navigate('/dashboard');
      return;
    }
    fetchStudents();
  }, [role, navigate]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Fetch all students
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, status, created_at')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch queue data to check if students are in queue
      const { data: queueData, error: queueError } = await supabase
        .from('kitchen_queue')
        .select('profile_id, queue_position');

      if (queueError) throw queueError;

      // Fetch TODAY's team assignments
      const today = getISTDate(0);
      const { data: todayAssignment } = await supabase
        .from('kitchen_assignments')
        .select('profile_ids')
        .eq('assignment_date', today)
        .maybeSingle();

      const todayProfileIds = todayAssignment?.profile_ids || [];

      // Fetch TOMORROW's team assignments
      const tomorrow = getISTDate(1);
      const { data: tomorrowAssignment } = await supabase
        .from('kitchen_assignments')
        .select('profile_ids')
        .eq('assignment_date', tomorrow)
        .maybeSingle();

      const tomorrowProfileIds = tomorrowAssignment?.profile_ids || [];

      // Merge all data and calculate eligibility
      const studentsWithEligibility = profilesData?.map(profile => {
        const inQueue = !!queueData?.find(q => q.profile_id === profile.id);
        const inTodayTeam = todayProfileIds.includes(profile.id);
        const inTomorrowTeam = tomorrowProfileIds.includes(profile.id);
        
        const canChangeStatus = inQueue || inTomorrowTeam;
        const canDeactivate = canChangeStatus && !inTodayTeam;

        return {
          ...profile,
          in_queue: inQueue,
          queue_position: queueData?.find(q => q.profile_id === profile.id)?.queue_position,
          in_today_team: inTodayTeam,
          in_tomorrow_team: inTomorrowTeam,
          can_change_status: canChangeStatus,
          can_deactivate: canDeactivate,
        };
      }) || [];

      setStudents(studentsWithEligibility);
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Failed to load students. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = (student: Student) => {
    // Extra validation: prevent deactivation if in today's team
    if (student.status === 'active' && student.in_today_team) {
      toast({
        title: "Cannot Deactivate",
        description: "This student is in today's kitchen team and cannot be deactivated.",
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

  const confirmStatusChange = async () => {
    if (!confirmDialog.studentId) return;

    try {
      const newStatus = confirmDialog.currentStatus === 'active' ? 'inactive' : 'active';
      
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', confirmDialog.studentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Student status updated to ${newStatus}.`,
      });

      // Refresh the students list
      await fetchStudents();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update student status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirmDialog({ open: false, studentId: null, studentName: '', currentStatus: '', inQueue: false, inTodayTeam: false, inTomorrowTeam: false });
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      student.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = students.filter(s => s.status === 'active').length;
  const inactiveCount = students.filter(s => s.status === 'inactive').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Student Management</h1>
              <p className="text-muted-foreground">Manage student activation and deactivation</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Students</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:max-w-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactive
                </Button>
              </div>
            </div>

            {/* Students Table */}
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading students...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No students found matching your filters.' 
                  : 'No students found.'}
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assignment Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>
                          <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {student.in_today_team && (
                              <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
                                Today's Team
                              </Badge>
                            )}
                            {student.in_tomorrow_team && (
                              <Badge variant="outline" className="border-blue-500 text-blue-500">
                                Tomorrow's Team
                              </Badge>
                            )}
                            {student.in_queue && (
                              <Badge variant="outline">
                                In Queue (#{student.queue_position})
                              </Badge>
                            )}
                            {!student.can_change_status && (
                              <Badge variant="secondary">
                                Not Eligible
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {!student.can_change_status ? (
                            <div className="flex items-center justify-end gap-2">
                              <Switch checked={student.status === 'active'} disabled={true} />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Only students in queue or tomorrow's team can have status changed
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          ) : student.in_today_team && student.status === 'active' ? (
                            <div className="flex items-center justify-end gap-2">
                              <Switch checked={true} disabled={true} />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Cannot deactivate - student is in today's kitchen team
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-sm text-muted-foreground">
                                {student.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                              <Switch
                                checked={student.status === 'active'}
                                onCheckedChange={() => handleStatusToggle(student)}
                              />
                            </div>
                          )}
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

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.currentStatus === 'active' ? 'Deactivate' : 'Activate'} Student?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.currentStatus === 'active' ? (
                <>
                  <p className="mb-2">
                    You are about to deactivate <strong>{confirmDialog.studentName}</strong>.
                  </p>
                  {confirmDialog.inQueue && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-500">Warning: Student is in queue</p>
                        <p className="text-muted-foreground mt-1">
                          This student will remain in the queue but marked as inactive.
                        </p>
                      </div>
                    </div>
                  )}
                  {confirmDialog.inTomorrowTeam && (
                    <p className="text-blue-600 font-semibold mb-2">
                      Note: This student is assigned to tomorrow's kitchen team.
                    </p>
                  )}
                  <p>
                    Inactive students will not appear in the "Available Students" list for adding to the queue.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You are about to activate <strong>{confirmDialog.studentName}</strong>.
                  </p>
                  {confirmDialog.inTodayTeam && (
                    <p className="mt-2 text-green-600 font-semibold">
                      Note: This student is in today's kitchen team.
                    </p>
                  )}
                  <p className="mt-2">
                    Active students can be added to the kitchen duty queue.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              {confirmDialog.currentStatus === 'active' ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentManagement;
