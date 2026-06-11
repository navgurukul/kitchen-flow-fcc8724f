import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth error:', error);
          setError(error.message);
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        if (data?.session) {
          console.log('Login successful!', data.session.user);
          // Redirect to dashboard on success
          setTimeout(() => navigate('/dashboard'), 500);
        } else {
          setError('No session found');
          setTimeout(() => navigate('/auth'), 3000);
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTimeout(() => navigate('/auth'), 3000);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Login Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="inline-block animate-spin">
          <div className="w-8 h-8 border-4 border-pink-300 border-t-pink-600 rounded-full"></div>
        </div>
        <p className="mt-4 text-gray-600">Processing login...</p>
      </div>
    </div>
  );
}
