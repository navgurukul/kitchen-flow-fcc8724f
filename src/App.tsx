import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

 
import Layout from  '@/components/Layout'; 

 
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import QueueManagement from "./pages/QueueManagement";
import StudentManagement from "./pages/StudentManagement";
import SkipRequests from "./pages/SkipRequests";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        {/* Uncomment Toaster/Sonner when you need them for notifications */}
        <Toaster />
        <Sonner /> 
        <BrowserRouter>
          <Routes>
            {/* 1. Routes WITHOUT Layout (e.g., Auth, 404) */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* 2. Routes WITH Layout (All other main pages) */}
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
             
              
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/queue-management" element={<QueueManagement />} />
              <Route path="/student-management" element={<StudentManagement />} />
              <Route path="/skip-requests" element={<SkipRequests />} />
            </Route>
            <Route path="*" element={<NotFound />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;