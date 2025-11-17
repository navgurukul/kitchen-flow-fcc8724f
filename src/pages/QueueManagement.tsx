import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Plus, Trash2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

interface AssignmentInfo {
  todayDate: string;
  tomorrowDate: string;
  todayProfileIds: string[];
  tomorrowProfileIds: string[];
}

interface QueueItemProps {
  item: QueueItem;
  index: number;
  onDelete: (id: string) => void;
  assignmentInfo: AssignmentInfo | null;
}

const QueueItemDisplay = ({ item, index, onDelete, assignmentInfo }: QueueItemProps) => {
  const getAssignmentDate = () => {
    if (!assignmentInfo) return null;
    
    // Check if this profile is in today's assignment
    if (assignmentInfo.todayProfileIds.includes(item.profiles.id)) {
      return { date: assignmentInfo.todayDate, team: 'today' };
    }
    
    // Check if this profile is in tomorrow's assignment
    if (assignmentInfo.tomorrowProfileIds.includes(item.profiles.id)) {
      return { date: assignmentInfo.tomorrowDate, team: 'tomorrow' };
    }
    
    return null;
  };

  const assignmentDate = getAssignmentDate();
  const isInAssignment = assignmentDate !== null;
  const positionMatchesAssignment = 
    (index < 5 && assignmentDate?.team === 'today') ||
    (index >= 5 && index < 10 && assignmentDate?.team === 'tomorrow');

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${
        index < 5 ? 'bg-primary/10 border-primary/20' : 
        index < 10 ? 'bg-secondary/10 border-secondary/20' : 
        'bg-background'
      } ${!positionMatchesAssignment && isInAssignment ? 'border-destructive border-2' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
          {item.queue_position}
        </div>
        <div>
          <p className="font-medium">{item.profiles?.full_name}</p>
          <p className="text-sm text-muted-foreground">{item.profiles?.email}</p>
          {assignmentDate && (
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Assigned: {assignmentDate.date}
              </p>
              {!positionMatchesAssignment && (
                <Badge variant="destructive" className="text-xs">Mismatch!</Badge>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={item.profiles?.status === 'active' ? 'default' : 'secondary'}>
          {item.profiles?.status}
        </Badge>
        {index < 5 && <Badge variant="outline">Position 1-5</Badge>}
        {index >= 5 && index < 10 && <Badge variant="outline">Position 6-10</Badge>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const QueueManagement = () => {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableStudents, setAvailableStudents] = useState<Profile[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [assignmentInfo, setAssignmentInfo] = useState<AssignmentInfo | null>(null);

  useEffect(() => {
    if (role !== 'coordinator') {
      navigate('/dashboard');
      return;
    }
    fetchQueue();
    fetchAvailableStudents();
  }, [role, navigate]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('kitchen_queue')
        .select(`
          id,
          queue_position,
          profiles:profile_id (
            id,
            full_name,
            status,
            email
          )
        `)
        .order('queue_position', { ascending: true });

      if (error) throw error;
      setQueue(data || []);

      // Fetch assignment information for validation
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      const { data: assignments } = await supabase
        .from('kitchen_assignments')
        .select('assignment_date, team_type, profile_ids')
        .in('assignment_date', [today, tomorrow]);

      // Extract assignment info for validation
      const todayAssignment = assignments?.find(a => a.assignment_date === today);
      const tomorrowAssignment = assignments?.find(a => a.assignment_date === tomorrow);

      setAssignmentInfo({
        todayDate: today,
        tomorrowDate: tomorrow,
        todayProfileIds: todayAssignment?.profile_ids || [],
        tomorrowProfileIds: tomorrowAssignment?.profile_ids || []
      });
    } catch (error) {
      console.error('Error fetching queue:', error);
      toast({
        title: "Error",
        description: "Failed to load queue",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, status')
        .eq('status', 'active');

      if (profilesError) throw profilesError;

      const { data: queueData, error: queueError } = await supabase
        .from('kitchen_queue')
        .select('profile_id');

      if (queueError) throw queueError;

      const queueProfileIds = new Set(queueData?.map(q => q.profile_id) || []);
      const available = (allProfiles || []).filter(p => !queueProfileIds.has(p.id));
      
      setAvailableStudents(available);
    } catch (error) {
      console.error('Error fetching available students:', error);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedStudent) return;

    try {
      // Query database for the actual max position
      const { data: maxData, error: maxError } = await supabase
        .from('kitchen_queue')
        .select('queue_position')
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError) throw maxError;
      
      const maxPosition = maxData?.queue_position || 0;
      
      const { error } = await supabase
        .from('kitchen_queue')
        .insert({
          profile_id: selectedStudent,
          queue_position: maxPosition + 1
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student added to queue"
      });

      setAddDialogOpen(false);
      setSelectedStudent("");
      fetchQueue();
      fetchAvailableStudents();
    } catch (error) {
      console.error('Error adding student:', error);
      toast({
        title: "Error",
        description: "Failed to add student to queue",
        variant: "destructive"
      });
    }
  };

  const handleBulkInitialize = async () => {
    if (selectedStudents.size === 0) return;

    try {
      // Query database for the actual max position
      const { data: maxData, error: maxError } = await supabase
        .from('kitchen_queue')
        .select('queue_position')
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError) throw maxError;
      
      const maxPosition = maxData?.queue_position || 0;

      const studentsToAdd = Array.from(selectedStudents).map((profileId, index) => ({
        profile_id: profileId,
        queue_position: maxPosition + index + 1
      }));

      const { error } = await supabase
        .from('kitchen_queue')
        .insert(studentsToAdd);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Added ${selectedStudents.size} students to queue`
      });

      setBulkDialogOpen(false);
      setSelectedStudents(new Set());
      fetchQueue();
      fetchAvailableStudents();
    } catch (error) {
      console.error('Error initializing queue:', error);
      toast({
        title: "Error",
        description: "Failed to initialize queue",
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('kitchen_queue')
        .delete()
        .eq('id', itemToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student removed from queue"
      });

      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchQueue();
      fetchAvailableStudents();
    } catch (error) {
      console.error('Error deleting queue item:', error);
      toast({
        title: "Error",
        description: "Failed to remove student from queue",
        variant: "destructive"
      });
    }
  };

  const handleManualRotation = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('rotate-kitchen-queue', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Queue rotated successfully"
      });

      fetchQueue();
    } catch (error) {
      console.error('Error rotating queue:', error);
      toast({
        title: "Error",
        description: "Failed to rotate queue",
        variant: "destructive"
      });
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const filteredQueue = queue.filter(item =>
    item.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check for mismatches
  const hasMismatches = assignmentInfo && queue.some((item, index) => {
    const isInToday = assignmentInfo.todayProfileIds.includes(item.profiles.id);
    const isInTomorrow = assignmentInfo.tomorrowProfileIds.includes(item.profiles.id);
    
    if (isInToday && index >= 5) return true;
    if (isInTomorrow && (index < 5 || index >= 10)) return true;
    
    return false;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Queue Management</h1>
              <p className="text-muted-foreground">Manage the kitchen duty rotation queue</p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline">
            Sign Out
          </Button>
        </div>

        {/* Mismatch Warning */}
        {hasMismatches && (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Queue/Assignment Mismatch Detected! Students in the queue don't match their assigned dates.
              </p>
            </CardContent>
          </Card>
        )}

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
                className="flex-1 min-w-[200px]"
              />
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Student to Queue</DialogTitle>
                    <DialogDescription>
                      Select a student to add to the kitchen queue
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Student</Label>
                      <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a student" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStudents.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.full_name} ({student.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddStudent} disabled={!selectedStudent}>
                      Add to Queue
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Bulk Initialize
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Initialize Queue</DialogTitle>
                    <DialogDescription>
                      Select all students to add to the queue. They will be added in the order shown.
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {availableStudents.map((student) => (
                        <div key={student.id} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent">
                          <Checkbox
                            id={student.id}
                            checked={selectedStudents.has(student.id)}
                            onCheckedChange={() => toggleStudentSelection(student.id)}
                          />
                          <label
                            htmlFor={student.id}
                            className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            <div>
                              <p>{student.full_name}</p>
                              <p className="text-muted-foreground text-xs">{student.email}</p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setBulkDialogOpen(false);
                      setSelectedStudents(new Set());
                    }}>
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

              <Button onClick={handleManualRotation}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rotate Queue
              </Button>
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
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : filteredQueue.length === 0 ? (
              <p className="text-center text-muted-foreground">No students in queue</p>
            ) : (
              <div className="space-y-2">
                {filteredQueue.map((item, index) => (
                  <QueueItemDisplay
                    key={item.id}
                    item={item}
                    index={index}
                    onDelete={handleDeleteClick}
                    assignmentInfo={assignmentInfo}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student from Queue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this student from the queue? The queue positions will be automatically reordered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setItemToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QueueManagement;
