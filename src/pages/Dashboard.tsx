import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, ChefHat, Users, Calendar } from 'lucide-react';

const Dashboard = () => {
  const { user, role, signOut } = useAuth();

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
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!
          </h2>
          <p className="text-muted-foreground">
            Manage your kitchen duties efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Today's Kitchen Team Card */}
          <Card className="claymorphic claymorphic-hover">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-lg">Today's Team</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Kitchen duty team for today
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-center py-4 bg-muted/50 rounded-lg">
                  No team assigned yet
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tomorrow's Kitchen Team Card */}
          <Card className="claymorphic claymorphic-hover">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-accent" />
                </div>
                <CardTitle className="text-lg">Tomorrow's Team</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Kitchen duty team for tomorrow
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-center py-4 bg-muted/50 rounded-lg">
                  No team assigned yet
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="claymorphic claymorphic-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {role === 'student' ? (
                <>
                  <Button className="w-full justify-start shadow-soft" variant="outline">
                    Request Skip
                  </Button>
                  <Button className="w-full justify-start shadow-soft" variant="outline">
                    View Menu
                  </Button>
                  <Button className="w-full justify-start shadow-soft" variant="outline">
                    Submit Feedback
                  </Button>
                </>
              ) : (
                <>
                  <Button className="w-full justify-start shadow-soft" variant="outline">
                    Manage Skip Requests
                  </Button>
                  <Button className="w-full justify-start shadow-soft" variant="outline">
                    Manage Users
                  </Button>
                  <Button className="w-full justify-start shadow-soft" variant="outline">
                    Update Menu
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Role-specific sections */}
        {role === 'coordinator' && (
          <div className="mt-8">
            <Card className="claymorphic">
              <CardHeader>
                <CardTitle>Coordinator Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Coordinator-specific features will appear here
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
