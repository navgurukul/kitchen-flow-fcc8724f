// import { useAuth } from "@/hooks/useAuth";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Input } from "@/components/ui/input";
// import { Switch } from "@/components/ui/switch";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// import { ArrowLeft, Users, UserCheck, UserX, AlertTriangle, Info } from "lucide-react";
// import { useNavigate } from "react-router-dom";
// import { useEffect, useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
// import { useToast } from "@/hooks/use-toast";
// import { getISTDate } from "@/lib/utils";

// interface Student {
//   id: string;
//   full_name: string;
//   email: string;
//   status: string;
//   created_at: string;
//   user_id: string;
//   role: 'coordinator' | 'student';
//   in_queue?: boolean;
//   queue_position?: number;
//   in_today_team?: boolean;
//   in_tomorrow_team?: boolean;
//   can_change_status?: boolean;
//   can_deactivate?: boolean;
//   last_queue_position?: number | null;
// }

// type StatusFilter = 'all' | 'active' | 'inactive';

// const StudentManagement = () => {
//   const { role } = useAuth();
//   const navigate = useNavigate();
//   const { toast } = useToast();
//   const [students, setStudents] = useState<Student[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
//   const [confirmDialog, setConfirmDialog] = useState<{
//     open: boolean;
//     studentId: string | null;
//     studentName: string;
//     currentStatus: string;
//     inQueue: boolean;
//     inTodayTeam: boolean;
//     inTomorrowTeam: boolean;
//   }>({
//     open: false,
//     studentId: null,
//     studentName: '',
//     currentStatus: '',
//     inQueue: false,
//     inTodayTeam: false,
//     inTomorrowTeam: false,
//   });

//   const [roleHandoffDialog, setRoleHandoffDialog] = useState<{
//     open: boolean;
//     targetStudent: Student | null;
//   }>({
//     open: false,
//     targetStudent: null,
//   });

//   useEffect(() => {
//     if (role !== 'coordinator') {
//       navigate('/dashboard');
//       return;
//     }
//     fetchStudents();
//   }, [role, navigate]);

//   const fetchStudents = async () => {
//     try {
//       setLoading(true);

//       // Fetch all students with roles from the view
//       const { data: profilesData, error: profilesError } = await supabase
//         .from('profiles_with_roles')
//         .select('id, full_name, email, status, created_at, last_queue_position, user_id, role')
//         .order('full_name');

//       if (profilesError) throw profilesError;

//       // Fetch queue data to check if students are in queue
//       const { data: queueData, error: queueError } = await supabase
//         .from('kitchen_queue')
//         .select('profile_id, queue_position');

//       if (queueError) throw queueError;

//       // Fetch TODAY's team assignments
//       const today = getISTDate(0);
//       const { data: todayAssignment } = await supabase
//         .from('kitchen_assignments')
//         .select('profile_ids')
//         .eq('assignment_date', today)
//         .maybeSingle();

//       const todayProfileIds = todayAssignment?.profile_ids || [];

//       // Fetch TOMORROW's team assignments
//       const tomorrow = getISTDate(1);
//       const { data: tomorrowAssignment } = await supabase
//         .from('kitchen_assignments')
//         .select('profile_ids')
//         .eq('assignment_date', tomorrow)
//         .maybeSingle();

//       const tomorrowProfileIds = tomorrowAssignment?.profile_ids || [];

//       // Merge all data and calculate eligibility
//       const studentsWithEligibility = profilesData?.map(profile => {
//         const inQueue = !!queueData?.find(q => q.profile_id === profile.id);
//         const inTodayTeam = todayProfileIds.includes(profile.id);
//         const inTomorrowTeam = tomorrowProfileIds.includes(profile.id);

//         const canChangeStatus = profile.status === 'inactive' ? true : (inQueue || inTomorrowTeam);
//         const canDeactivate = canChangeStatus && !inTodayTeam;

//         return {
//           id: profile.id,
//           full_name: profile.full_name,
//           email: profile.email,
//           status: profile.status,
//           created_at: profile.created_at,
//           user_id: profile.user_id,
//           role: profile.role,
//           in_queue: inQueue,
//           queue_position: queueData?.find(q => q.profile_id === profile.id)?.queue_position,
//           in_today_team: inTodayTeam,
//           in_tomorrow_team: inTomorrowTeam,
//           can_change_status: canChangeStatus,
//           can_deactivate: canDeactivate,
//           last_queue_position: profile.last_queue_position,
//         };
//       }) || [];

//       setStudents(studentsWithEligibility);
//     } catch (error: any) {
//       console.error('Error fetching students:', error);
//       toast({
//         title: "Error",
//         description: "Failed to load students. Please try again.",
//         variant: "destructive",
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleStatusToggle = (student: Student) => {
//     // Extra validation: prevent deactivation if in today's team
//     if (student.status === 'active' && student.in_today_team) {
//       toast({
//         title: "Cannot Deactivate",
//         description: "This student is in today's kitchen team and cannot be deactivated.",
//         variant: "destructive",
//       });
//       return;
//     }

//     setConfirmDialog({
//       open: true,
//       studentId: student.id,
//       studentName: student.full_name,
//       currentStatus: student.status,
//       inQueue: student.in_queue || false,
//       inTodayTeam: student.in_today_team || false,
//       inTomorrowTeam: student.in_tomorrow_team || false,
//     });
//   };

//   const handleQueueBackfill = async (deactivatedStudentId: string) => {
//     try {
//       console.log('Starting queue backfill for deactivated student:', deactivatedStudentId);

//       // Step 0: GET AND SAVE the student's current queue position BEFORE deletion
//       const { data: queueRecord, error: fetchError } = await supabase
//         .from('kitchen_queue')
//         .select('queue_position')
//         .eq('profile_id', deactivatedStudentId)
//         .single();

//       if (fetchError) throw fetchError;

//       if (queueRecord) {
//         // Save the position to the profiles table
//         const { error: saveError } = await supabase
//           .from('profiles')
//           .update({ last_queue_position: queueRecord.queue_position })
//           .eq('id', deactivatedStudentId);

//         if (saveError) throw saveError;

//         console.log(`Saved queue position ${queueRecord.queue_position} for student ${deactivatedStudentId}`);
//       }

//       // Step 1: Remove deactivated student from queue
//       const { error: deleteError } = await supabase
//         .from('kitchen_queue')
//         .delete()
//         .eq('profile_id', deactivatedStudentId);

//       if (deleteError) throw deleteError;

//       // Step 2: Get current queue
//       const { data: currentQueue, error: queueError } = await supabase
//         .from('kitchen_queue')
//         .select('id, profile_id, queue_position')
//         .order('queue_position', { ascending: true });

//       if (queueError) throw queueError;

//       // Step 3: Find next available active student (not in queue)
//       const queueProfileIds = currentQueue?.map(q => q.profile_id) || [];

//       const { data: availableStudent, error: availableError } = await supabase
//         .from('profiles')
//         .select('id, full_name')
//         .eq('status', 'active')
//         .not('id', 'in', `(${queueProfileIds.join(',')})`)
//         .order('created_at', { ascending: true })
//         .limit(1)
//         .maybeSingle();

//       if (availableError) throw availableError;

//       // Step 4: Add available student to end of queue (if found)
//       if (availableStudent) {
//         const newPosition = (currentQueue?.length || 0) + 1;

//         const { error: insertError } = await supabase
//           .from('kitchen_queue')
//           .insert({
//             profile_id: availableStudent.id,
//             queue_position: newPosition,
//             joined_at: new Date().toISOString(),
//           });

//         if (insertError) throw insertError;

//         console.log(`Added ${availableStudent.full_name} to queue at position ${newPosition}`);

//         toast({
//           title: "Queue Backfilled",
//           description: `${availableStudent.full_name} has been added to the queue.`,
//         });
//       } else {
//         console.log('No available active students to backfill');
//         toast({
//           title: "Queue Updated",
//           description: "Student removed from queue. No active students available for backfill.",
//         });
//       }

//       // Step 5: Reorder all positions sequentially (1, 2, 3, 4, ...)
//       const { data: finalQueue, error: finalQueueError } = await supabase
//         .from('kitchen_queue')
//         .select('id, queue_position, last_duty_date')
//         .order('queue_position', { ascending: true });

//       if (finalQueueError) throw finalQueueError;

//       if (finalQueue && finalQueue.length > 0) {
//         const positionUpdates = finalQueue.map((item, index) => ({
//           id: item.id,
//           queue_position: index + 1,
//           last_duty_date: item.last_duty_date || 'null'
//         }));

//         const { error: updateError } = await supabase.rpc('update_queue_positions_batch', {
//           position_updates: positionUpdates
//         });

//         if (updateError) throw updateError;
//       }

//       console.log('Queue backfill completed successfully');
//     } catch (error) {
//       console.error('Error in queue backfill:', error);
//       toast({
//         title: "Warning",
//         description: "Student deactivated but queue backfill may have failed. Please check queue manually.",
//         variant: "default",
//       });
//     }
//   };

//   const handleQueueRestoration = async (activatedStudentId: string) => {
//     try {
//       console.log('Starting queue restoration for activated student:', activatedStudentId);

//       // Step 1: Check if student has a saved position
//       const { data: profile, error: profileError } = await supabase
//         .from('profiles')
//         .select('last_queue_position, full_name')
//         .eq('id', activatedStudentId)
//         .single();

//       if (profileError) throw profileError;

//       const savedPosition = profile.last_queue_position;

//       // If no saved position, student was never in queue or position already used
//       if (!savedPosition) {
//         console.log('No saved queue position found - student will not be added to queue');
//         toast({
//           title: "Student Activated",
//           description: `${profile.full_name} is now active but not added to queue (no previous position found).`,
//         });
//         return;
//       }

//       console.log(`Found saved position: ${savedPosition}`);

//       // Step 2: Get current queue to check if position is still valid
//       const { data: currentQueue, error: queueError } = await supabase
//         .from('kitchen_queue')
//         .select('id, profile_id, queue_position, last_duty_date')
//         .order('queue_position', { ascending: true });

//       if (queueError) throw queueError;

//       const currentQueueLength = currentQueue?.length || 0;

//       // Determine insertion position (cap at current queue length + 1)
//       const insertPosition = Math.min(savedPosition, currentQueueLength + 1);

//       console.log(`Inserting at position ${insertPosition} (saved: ${savedPosition}, current queue length: ${currentQueueLength})`);

//       // Step 3: Shift everyone at insertion position and below down by 1
//       if (currentQueue && currentQueue.length > 0) {
//         // Create update array: everyone at insertPosition or higher gets +1
//         const shiftUpdates = currentQueue
//           .filter(item => item.queue_position >= insertPosition)
//           .map(item => ({
//             id: item.id,
//             queue_position: item.queue_position + 1,
//             last_duty_date: item.last_duty_date || 'null'
//           }));

//         if (shiftUpdates.length > 0) {
//           const { error: shiftError } = await supabase.rpc('update_queue_positions_batch', {
//             position_updates: shiftUpdates
//           });

//           if (shiftError) throw shiftError;
//           console.log(`Shifted ${shiftUpdates.length} students down to make room`);
//         }
//       }

//       // Step 4: Insert student at their saved position
//       const { error: insertError } = await supabase
//         .from('kitchen_queue')
//         .insert({
//           profile_id: activatedStudentId,
//           queue_position: insertPosition,
//           joined_at: new Date().toISOString(),
//         });

//       if (insertError) throw insertError;

//       // Step 5: Clear the saved position (it's been used)
//       const { error: clearError } = await supabase
//         .from('profiles')
//         .update({ last_queue_position: null })
//         .eq('id', activatedStudentId);

//       if (clearError) throw clearError;

//       console.log('Queue restoration completed successfully');

//       toast({
//         title: "Queue Restored",
//         description: `${profile.full_name} has been restored to position ${insertPosition} in the queue.`,
//       });

//     } catch (error) {
//       console.error('Error in queue restoration:', error);
//       // Don't throw - status update already succeeded
//       toast({
//         title: "Warning",
//         description: "Student activated but queue restoration may have failed. You can manually add them to the queue.",
//         variant: "default",
//       });
//     }
//   };

//   const confirmStatusChange = async () => {
//     if (!confirmDialog.studentId) return;

//     try {
//       const student = students.find(s => s.id === confirmDialog.studentId);
//       const newStatus = confirmDialog.currentStatus === 'active' ? 'inactive' : 'active';

//       const { error } = await supabase
//         .from('profiles')
//         .update({ status: newStatus })
//         .eq('id', confirmDialog.studentId);

//       if (error) throw error;

//       // If deactivating a student who is in the queue, handle backfill
//       if (newStatus === 'inactive' && student?.in_queue) {
//         await handleQueueBackfill(confirmDialog.studentId);
//       }

//       // If activating a student, try to restore their queue position
//       if (newStatus === 'active') {
//         await handleQueueRestoration(confirmDialog.studentId);
//       }

//       toast({
//         title: "Success",
//         description: `Student ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`,
//       });

//       // Refresh the students list
//       await fetchStudents();
//     } catch (error: any) {
//       console.error('Error updating status:', error);
//       toast({
//         title: "Error",
//         description: "Failed to update student status. Please try again.",
//         variant: "destructive",
//       });
//     } finally {
//       setConfirmDialog({ open: false, studentId: null, studentName: '', currentStatus: '', inQueue: false, inTodayTeam: false, inTomorrowTeam: false });
//     }
//   };

//   const handleRoleHandoff = async (targetStudent: Student) => {
//     const { data: { user } } = await supabase.auth.getUser();
//     if (!user) {
//       toast({
//         title: "Error",
//         description: "You must be logged in to perform this action.",
//         variant: "destructive",
//       });
//       return;
//     }

//     if (user.id === targetStudent.user_id) {
//       toast({
//         title: "Invalid Action",
//         description: "You are already a coordinator.",
//       });
//       return;
//     }

//     if (targetStudent.role === 'coordinator') {
//       toast({
//         title: "Invalid Action",
//         description: `${targetStudent.full_name} is already a coordinator.`,
//       });
//       return;
//     }

//     try {
//       const { error: promoteError } = await supabase
//         .from('user_roles')
//         .update({ role: 'coordinator' })
//         .eq('user_id', targetStudent.user_id);

//       if (promoteError) throw promoteError;

//       const { error: demoteError } = await supabase
//         .from('user_roles')
//         .update({ role: 'student' })
//         .eq('user_id', user.id);

//       if (demoteError) throw demoteError;

//       toast({
//         title: "Coordinator Role Transferred",
//         description: `${targetStudent.full_name} is now the coordinator. You have been returned to student role.`,
//       });

//       await fetchStudents();

//       setTimeout(() => {
//         toast({
//           title: "Access Changed",
//           description: "Redirecting to dashboard as you are no longer a coordinator...",
//         });
//         navigate('/');
//       }, 2000);

//     } catch (error: any) {
//       console.error('Error during role handoff:', error);
//       toast({
//         title: "Error",
//         description: "Failed to transfer coordinator role. Please try again.",
//         variant: "destructive",
//       });
//     }
//   };

//   const filteredStudents = students.filter(student => {
//     const matchesSearch =
//       student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       student.email.toLowerCase().includes(searchTerm.toLowerCase());

//     const matchesStatus =
//       statusFilter === 'all' ||
//       student.status === statusFilter;

//     return matchesSearch && matchesStatus;
//   });

//   const activeCount = students.filter(s => s.status === 'active').length;
//   const inactiveCount = students.filter(s => s.status === 'inactive').length;

//   return (
//     <div className="min-h-screen bg-background">
//       <div className="container mx-auto p-6 space-y-6">
//         {/* Header */}
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-4">
//             <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
//               <ArrowLeft className="h-5 w-5" />
//             </Button>
//             <div>
//               <h1 className="text-3xl font-bold">Student Management</h1>
//               <p className="text-muted-foreground">Manage student activation and deactivation</p>
//             </div>
//           </div>
//         </div>

//         {/* Stats Cards */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Total Students</CardTitle>
//               <Users className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{students.length}</div>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Active Students</CardTitle>
//               <UserCheck className="h-4 w-4 text-green-500" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-green-500">{activeCount}</div>
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">Inactive Students</CardTitle>
//               <UserX className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Filters */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Students</CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <div className="flex flex-col md:flex-row gap-4">
//               <Input
//                 placeholder="Search by name or email..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="md:max-w-sm"
//               />
//               <div className="flex gap-2">
//                 <Button
//                   variant={statusFilter === 'all' ? 'default' : 'outline'}
//                   onClick={() => setStatusFilter('all')}
//                 >
//                   All
//                 </Button>
//                 <Button
//                   variant={statusFilter === 'active' ? 'default' : 'outline'}
//                   onClick={() => setStatusFilter('active')}
//                 >
//                   Active
//                 </Button>
//                 <Button
//                   variant={statusFilter === 'inactive' ? 'default' : 'outline'}
//                   onClick={() => setStatusFilter('inactive')}
//                 >
//                   Inactive
//                 </Button>
//               </div>
//             </div>

//             {/* Students Table */}
//             {loading ? (
//               <div className="text-center py-8 text-muted-foreground">Loading students...</div>
//             ) : filteredStudents.length === 0 ? (
//               <div className="text-center py-8 text-muted-foreground">
//                 {searchTerm || statusFilter !== 'all'
//                   ? 'No students found matching your filters.'
//                   : 'No students found.'}
//               </div>
//             ) : (
//               <div className="border rounded-lg">
//                 <Table>
//                   <TableHeader>
//                     <TableRow>
//                       <TableHead>Name</TableHead>
//                       <TableHead>Email</TableHead>
//                       {/* <TableHead>Status</TableHead> */}
//                       <TableHead>Role</TableHead>
//                       {/* <TableHead>Assignment Status</TableHead> */}
//                       <TableHead className="text-right">Actions</TableHead>
//                     </TableRow>
//                   </TableHeader>
//                   <TableBody>
//                     {filteredStudents.map((student) => (
//                       <TableRow key={student.id}>
//                         <TableCell className="font-medium">{student.full_name}</TableCell>
//                         <TableCell>{student.email}</TableCell>
//                         {/* <TableCell>
//                           <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
//                             {student.status}
//                           </Badge>
//                         </TableCell> */}
//                         <TableCell>
//                           <div className="flex items-center gap-2">
//                             <Badge
//                               variant={student.role === 'coordinator' ? 'default' : 'secondary'}
//                               className={student.role === 'coordinator' ? 'bg-purple-500' : ''}
//                             >
//                               {student.role === 'coordinator' ? '👑 Coordinator' : '🎓 Student'}
//                             </Badge>
//                             {student.role === 'student' && (
//                               <TooltipProvider>
//                                 <Tooltip>
//                                   <TooltipTrigger asChild>
//                                     <Button
//                                       size="sm"
//                                       variant="outline"
//                                       onClick={() => setRoleHandoffDialog({
//                                         open: true,
//                                         targetStudent: student,
//                                       })}
//                                       className="h-7 px-2 text-xs"
//                                     >
//                                       Promote
//                                     </Button>
//                                   </TooltipTrigger>
//                                   <TooltipContent>
//                                     <p>Transfer coordinator role to {student.full_name}</p>
//                                   </TooltipContent>
//                                 </Tooltip>
//                               </TooltipProvider>
//                             )}
//                           </div>
//                         </TableCell>
//                         {/* <TableCell>
//                           <div className="flex flex-wrap gap-1">
//                             {student.in_today_team && (
//                               <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
//                                 Today's Team
//                               </Badge>
//                             )}
//                             {student.in_tomorrow_team && (
//                               <Badge variant="outline" className="border-blue-500 text-blue-500">
//                                 Tomorrow's Team
//                               </Badge>
//                             )}
//                             {student.in_queue && (
//                               <Badge variant="outline">
//                                 In Queue (#{student.queue_position})
//                               </Badge>
//                             )}
//                             {student.status === 'inactive' && student.last_queue_position && (
//                               <Badge variant="secondary" className="border-purple-500 text-purple-500">
//                                 Saved Position: #{student.last_queue_position}
//                               </Badge>
//                             )}
//                             {!student.can_change_status && (
//                               <Badge variant="secondary">
//                                 Not Eligible
//                               </Badge>
//                             )}
//                           </div>
//                         </TableCell> */}
//                         <TableCell className="text-right">
//                           {!student.can_change_status ? (
//                             <div className="flex items-center justify-end gap-2">
//                               <Switch checked={student.status === 'active'} disabled={true} />
//                               <TooltipProvider>
//                                 <Tooltip>
//                                   <TooltipTrigger>
//                                     <Info className="h-4 w-4 text-muted-foreground" />
//                                   </TooltipTrigger>
//                                   <TooltipContent>
//                                     Only students in queue or tomorrow's team can have status changed
//                                   </TooltipContent>
//                                 </Tooltip>
//                               </TooltipProvider>
//                             </div>
//                           ) : student.in_today_team && student.status === 'active' ? (
//                             <div className="flex items-center justify-end gap-2">
//                               <Switch checked={true} disabled={true} />
//                               <TooltipProvider>
//                                 <Tooltip>
//                                   <TooltipTrigger>
//                                     <AlertTriangle className="h-4 w-4 text-orange-500" />
//                                   </TooltipTrigger>
//                                   <TooltipContent>
//                                     Cannot deactivate - student is in today's kitchen team
//                                   </TooltipContent>
//                                 </Tooltip>
//                               </TooltipProvider>
//                             </div>
//                           ) : (
//                             <div className="flex items-center justify-end gap-2">
//                               <span className="text-sm text-muted-foreground">
//                                 {student.status === 'active' ? 'Active' : 'Inactive'}
//                               </span>
//                               <Switch
//                                 checked={student.status === 'active'}
//                                 onCheckedChange={() => handleStatusToggle(student)}
//                               />
//                             </div>
//                           )}
//                         </TableCell>
//                       </TableRow>
//                     ))}
//                   </TableBody>
//                 </Table>
//               </div>
//             )}
//           </CardContent>
//         </Card>
//       </div>

//       {/* Confirmation Dialog */}
//       <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, open: false })}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>
//               {confirmDialog.currentStatus === 'active' ? 'Deactivate' : 'Activate'} Student?
//             </AlertDialogTitle>
//             <AlertDialogDescription>
//               {confirmDialog.currentStatus === 'active' ? (
//                 <>
//                   <p className="mb-2">
//                     You are about to deactivate <strong>{confirmDialog.studentName}</strong>.
//                   </p>
//                   {confirmDialog.inQueue && (
//                     <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-2">
//                       <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
//                       <div className="text-sm">
//                         <p className="font-medium text-yellow-500">Student is in queue</p>
//                         <p className="text-muted-foreground mt-1">
//                           They will be automatically removed from the queue and replaced with the next available active student.
//                         </p>
//                       </div>
//                     </div>
//                   )}
//                   {confirmDialog.inTomorrowTeam && (
//                     <p className="text-blue-600 font-semibold mb-2">
//                       Note: This student is assigned to tomorrow's kitchen team.
//                     </p>
//                   )}
//                   <p>
//                     Inactive students will not appear in the "Available Students" list for adding to the queue.
//                   </p>
//                 </>
//               ) : (() => {
//                 const student = students.find(s => s.id === confirmDialog.studentId);
//                 const hasSavedPosition = student?.last_queue_position;

//                 return (
//                   <>
//                     <p className="mb-2">
//                       Are you sure you want to activate <strong>{confirmDialog.studentName}</strong>?
//                     </p>
//                     {hasSavedPosition && (
//                       <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-2">
//                         <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
//                         <div className="text-sm">
//                           <p className="font-medium text-blue-500">Queue Position Restoration</p>
//                           <p className="text-muted-foreground mt-1">
//                             This student will be restored to position #{hasSavedPosition} in the queue.
//                           </p>
//                         </div>
//                       </div>
//                     )}
//                     {!hasSavedPosition && (
//                       <p className="text-sm text-muted-foreground mt-2">
//                         This student will be activated but not automatically added to the queue.
//                       </p>
//                     )}
//                   </>
//                 );
//               })()}
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction onClick={confirmStatusChange}>
//               {confirmDialog.currentStatus === 'active' ? 'Deactivate' : 'Activate'}
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>

//       {/* Role Handoff Confirmation Dialog */}
//       <AlertDialog
//         open={roleHandoffDialog.open}
//         onOpenChange={(open) => setRoleHandoffDialog({ open, targetStudent: null })}
//       >
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>⚠️ Transfer Coordinator Role</AlertDialogTitle>
//             <AlertDialogDescription>
//               {roleHandoffDialog.targetStudent && (
//                 <>
//                   <p className="mb-3">
//                     You are about to transfer the coordinator role to{' '}
//                     <strong>{roleHandoffDialog.targetStudent.full_name}</strong>.
//                   </p>

//                   <div className="space-y-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
//                     <div className="flex items-start gap-2">
//                       <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
//                       <div className="text-sm">
//                         <p className="font-medium text-yellow-600 dark:text-yellow-400">
//                           This action will:
//                         </p>
//                         <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
//                           <li>Grant {roleHandoffDialog.targetStudent.full_name} full coordinator access</li>
//                           <li><strong>Remove YOUR coordinator privileges</strong></li>
//                           <li>You will be demoted to Student role</li>
//                           <li>You will be redirected to the dashboard</li>
//                         </ul>
//                       </div>
//                     </div>
//                   </div>

//                   <p className="mt-3 text-sm text-muted-foreground">
//                     Only one coordinator can exist at a time. Are you sure you want to proceed?
//                   </p>
//                 </>
//               )}
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction
//               onClick={() => {
//                 if (roleHandoffDialog.targetStudent) {
//                   handleRoleHandoff(roleHandoffDialog.targetStudent);
//                 }
//                 setRoleHandoffDialog({ open: false, targetStudent: null });
//               }}
//               className="bg-yellow-500 hover:bg-yellow-600"
//             >
//               Yes, Transfer Role
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   );
// };

// export default StudentManagement;

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
              <CardTitle className="text-sm font-medium">
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
              <CardTitle className="text-sm font-medium">
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
              <CardTitle className="text-sm font-medium">
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
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="border rounded-lg">
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
                                    className="h-7 px-3 text-xs text-muted-foreground hover:bg-purple-100 hover:text-purple-700"
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

                        {/* ✅ Status Column Cell */}
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
                              />
                            ) : (
                              <Switch
                                checked={student.status === "active"}
                                onCheckedChange={() =>
                                  handleStatusToggle(student)
                                }
                              />
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
