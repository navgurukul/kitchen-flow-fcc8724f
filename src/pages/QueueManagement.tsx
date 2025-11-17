import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Plus, Trash2, GripVertical, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface SortableItemProps {
  item: QueueItem;
  index: number;
  onDelete: (id: string) => void;
}

const SortableQueueItem = ({ item, index, onDelete }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 rounded-lg border ${
        index < 5 ? 'bg-primary/10 border-primary/20' : 
        index < 10 ? 'bg-secondary/10 border-secondary/20' : 
        'bg-background'
      }`}
    >
      <div className="flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
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
        {index < 5 && <Badge variant="outline">Today's Team</Badge>}
        {index >= 5 && index < 10 && <Badge variant="outline">Tomorrow's Team</Badge>}
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const maxPosition = queue.length > 0 ? Math.max(...queue.map(q => q.queue_position)) : 0;
      
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
      const studentsToAdd = Array.from(selectedStudents).map((profileId, index) => ({
        profile_id: profileId,
        queue_position: index + 1
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
      await reorderQueue();
    } catch (error) {
      console.error('Error deleting queue item:', error);
      toast({
        title: "Error",
        description: "Failed to remove student from queue",
        variant: "destructive"
      });
    }
  };

  const reorderQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('kitchen_queue')
        .select('id')
        .order('queue_position', { ascending: true });

      if (error) throw error;

      const updates = (data || []).map((item, index) => ({
        id: item.id,
        queue_position: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('kitchen_queue')
          .update({ queue_position: update.queue_position })
          .eq('id', update.id);
      }

      fetchQueue();
    } catch (error) {
      console.error('Error reordering queue:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setQueue((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      
      updateQueuePositions(newItems);
      
      return newItems;
    });
  };

  const updateQueuePositions = async (reorderedQueue: QueueItem[]) => {
    try {
      const updates = reorderedQueue.map((item, index) => ({
        id: item.id,
        queue_position: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('kitchen_queue')
          .update({ queue_position: update.queue_position })
          .eq('id', update.id);
      }

      toast({
        title: "Success",
        description: "Queue order updated"
      });
    } catch (error) {
      console.error('Error updating queue positions:', error);
      toast({
        title: "Error",
        description: "Failed to update queue order",
        variant: "destructive"
      });
      fetchQueue();
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
              <p className="text-muted-foreground">Loading queue...</p>
            ) : filteredQueue.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredQueue.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {filteredQueue.map((item, index) => (
                      <SortableQueueItem
                        key={item.id}
                        item={item}
                        index={index}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No students in queue</p>
                <p className="text-sm">Use "Add Student" or "Bulk Initialize" to get started</p>
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
