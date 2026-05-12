import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserRole = "coordinator" | "student";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Fetch role when user logs in
      if (session?.user) {
        setTimeout(() => {
          fetchUserRole(session.user.id);
        }, 0);
      } else {
        setRole(null);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      // If user role doesn't exist, create it
      if (error?.code === 'PGRST116') {
        console.log("Creating user role for new user...");
        const user = await supabase.auth.getUser();
        
        // Create user_roles entry
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: "student" }]);
        
        // Create profiles entry
        const { error: profileError } = await supabase
          .from("profiles")
          .insert([{
            user_id: userId,
            full_name: user.data.user?.user_metadata?.full_name || user.data.user?.email || "User",
            email: user.data.user?.email || "unknown@example.com"
          }]);
        
        if (roleError || profileError) {
          console.error("Error creating user entries:", roleError || profileError);
          throw roleError || profileError;
        }
        
        setRole("student");
        setLoading(false);
        return;
      }

      if (error) throw error;
      setRole(data.role as UserRole);
    } catch (error: any) {
      console.error("Error fetching user role:", error);
      toast({
        title: "Error",
        description: "Failed to fetch user role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `https://localhost:8080/auth/callback`,
          // redirectTo: 'https://kitchen-flow.lovable.app/auth/callback',
          queryParams: {
            access_type: "offline",
            prompt: "consent",
            hd: "navgurukul.org",
          },
        },
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole(null);
      toast({
        title: "Success",
        description: "Signed out successfully",
      });

      // Redirect to auth page with full page reload to clear all state
      window.location.href = "/auth";
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
