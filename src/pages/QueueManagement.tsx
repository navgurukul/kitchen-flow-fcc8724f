import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const QueueManagement = () => {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (role !== 'coordinator') {
      navigate('/dashboard');
      return;
    }
    fetchQueue();
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
              className="clay-button"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Queue Management</h1>
              <p className="text-muted-foreground">Manage the kitchen duty rotation queue</p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline" className="clay-button">
            Sign Out
          </Button>
        </div>

        {/* Controls */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle>Queue Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleManualRotation} className="clay-button">
                <RefreshCw className="h-4 w-4 mr-2" />
                Rotate Queue
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Queue List */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle>Current Queue ({queue.length} students)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading queue...</p>
            ) : filteredQueue.length > 0 ? (
              <div className="space-y-2">
                {filteredQueue.map((item, index) => (
                  <div
                    key={item.id}
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
                      {index < 5 && <Badge variant="outline">Today's Team</Badge>}
                      {index >= 5 && index < 10 && <Badge variant="outline">Tomorrow's Team</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No students found</p>
                <p className="text-sm">Add students to the queue to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QueueManagement;
