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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  index: number;
}

const QueueItem = ({ item, index }: QueueItemProps) => {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${
        index < 5 ? 'bg-primary/10 border-primary/20' : 
        index < 10 ? 'bg-secondary/10 border-secondary/20' : 
        'bg-background'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
          {item.queue_position}
        </div>
        <div>
          <p className="font-medium">{item.profiles?.full_name}</p>
          <p className="text-sm text-muted-foreground">{item.profiles?.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={item.profiles?.status === 'active' ? 'default' : 'secondary'}>
          {item.profiles?.status}
        </Badge>
        {item.profiles?.status === 'inactive' && (
          <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 bg-yellow-500/10">
            ⚠️ Inactive
          </Badge>
        )}
        {index < 5 && <Badge variant="outline">Today's Team</Badge>}
        {index >= 5 && index < 10 && <Badge variant="outline">Tomorrow's Team</Badge>}
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

      {/* Automated Rotation Notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Automated Queue Rotation</p>
              <p className="text-sm text-muted-foreground">Queue automatically rotates at midnight (00:00 IST) every day</p>
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
                    <Users className="h-4 w-4 mr-2" />
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
            <p className="text-muted-foreground">Loading queue...</p>
          ) : filteredQueue.length > 0 ? (
            <div className="space-y-2">
              {filteredQueue.map((item, index) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  index={index}
                />
              ))}
            </div>
          ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No students in queue</p>
                <p className="text-sm">Use "Add Student" or "Bulk Initialize" to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QueueManagement;
