import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

const Auth = () => {
  const { signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="min-h-screen  flex items-center justify-center p-4 gradient-subtle">
      <Card className="w-full max-w-md claymorphic  ">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center  ">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-medium">
              <ChefHat className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              KitchenFlow
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Automated Kitchen Duty Management
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Sign in with your NavGurukul Google account
            </p>
            
            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full h-12 border-pink-400  text-base shadow-medium gap-3"
            >
              <FcGoogle className="w-6 h-6" />
              Sign in with Google
            </Button>
            
            <div className="text-center text-xs text-muted-foreground mt-4">
              Only @navgurukul.org email addresses are allowed
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
