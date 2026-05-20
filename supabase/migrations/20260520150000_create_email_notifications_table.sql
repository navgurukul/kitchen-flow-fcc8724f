-- Create email_notifications table to log all sent emails
CREATE TABLE public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  assignment_date DATE NOT NULL,
  team_type TEXT NOT NULL CHECK (team_type IN ('today', 'tomorrow')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster queries
CREATE INDEX idx_email_notifications_profile_id ON public.email_notifications(profile_id);
CREATE INDEX idx_email_notifications_date ON public.email_notifications(assignment_date);
CREATE INDEX idx_email_notifications_status ON public.email_notifications(status);

-- RLS Policy - Coordinators can view all notifications
CREATE POLICY "Coordinators can view email notifications"
ON public.email_notifications
FOR SELECT
USING (has_role(auth.uid(), 'coordinator'::app_role));

-- RLS Policy - Students can view their own notifications
CREATE POLICY "Students can view their own email notifications"
ON public.email_notifications
FOR SELECT
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS Policy - Only service role can insert (edge functions)
CREATE POLICY "Service role can insert email notifications"
ON public.email_notifications
FOR INSERT
WITH CHECK (true);
