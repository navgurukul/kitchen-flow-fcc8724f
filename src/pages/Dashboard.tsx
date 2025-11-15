import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, ChefHat, Users, Calendar, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  full_name: string;
  status: string;
}

const Dashboard = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [todayTeam, setTodayTeam] = useState<TeamMember[]>([]);
  const [tomorrowTeam, setTomorrowTeam] = useState<TeamMember[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamData();
  }, [user]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // Fetch today's and tomorrow's assignments
      const { data: assignments, error: assignError } = await supabase
        .from('kitchen_assignments')
        .select('*')
        .in('assignment_date', [today, tomorrow]);

      if (assignError) throw assignError;

      // Fetch profiles for team members
      const todayAssignment = assignments?.find(a => a.assignment_date === today);
      const tomorrowAssignment = assignments?.find(a => a.assignment_date === tomorrow);

      if (todayAssignment) {
        const { data: todayProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, status')
          .in('id', todayAssignment.profile_ids);
        
        setTodayTeam(todayProfiles || []);
      }

      if (tomorrowAssignment) {
        const { data: tomorrowProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, status')
          .in('id', tomorrowAssignment.profile_ids);
        
        setTomorrowTeam(tomorrowProfiles || []);
      }

      // Fetch user's queue position (for students)
      if (role === 'student') {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id)
          .maybeSingle();

        if (profileData) {
          const { data: queueData } = await supabase
            .from('kitchen_queue')
            .select('queue_position')
            .eq('profile_id', profileData.id)
            .maybeSingle();

          if (queueData) {
            setMyPosition(queueData.queue_position);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-soft">
              <ChefHat className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                KitchenFlow
              </h1>
              <p className="text-sm text-muted-foreground capitalize">
                {role} Dashboard
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={signOut}
            className="claymorphic gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {user?.email?.split('@')[0] || 'User'}!
          </h2>
          <p className="text-muted-foreground">
            {role === 'student' 
              ? 'Check your kitchen duty schedule and position in the queue'
              : 'Manage the kitchen duty queue and student assignments'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Today's Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : todayTeam.length > 0 ? (
                <div className="space-y-2">
                  {todayTeam.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <span className="text-sm">{member.full_name}</span>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
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
                <Users className="h-5 w-5 text-primary" />
                Tomorrow's Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : tomorrowTeam.length > 0 ? (
                <div className="space-y-2">
                  {tomorrowTeam.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <span className="text-sm">{member.full_name}</span>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
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
                <ChefHat className="h-5 w-5 text-primary" />
                {role === 'student' ? 'My Position' : 'Quick Actions'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {role === 'student' ? (
                <>
                  {myPosition !== null && (
                    <div className="text-center p-4 bg-primary/10 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Your Queue Position</p>
                      <p className="text-3xl font-bold text-primary">#{myPosition}</p>
                    </div>
                  )}
                  <Button className="w-full clay-button" variant="outline">
                    Request Skip
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    className="w-full clay-button" 
                    variant="outline"
                    onClick={() => navigate('/queue-management')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Queue
                  </Button>
                  <Button className="w-full clay-button" variant="outline">
                    View Reports
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {role === 'coordinator' && (
          <Card className="clay-card mt-6">
            <CardHeader>
              <CardTitle>Coordinator Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" onClick={() => navigate('/queue-management')}>
                Full Queue Management
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
