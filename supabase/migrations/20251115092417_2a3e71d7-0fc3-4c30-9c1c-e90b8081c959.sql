-- Create kitchen_queue table
CREATE TABLE public.kitchen_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL UNIQUE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_duty_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create kitchen_assignments table
CREATE TABLE public.kitchen_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_date DATE NOT NULL UNIQUE,
  team_type TEXT NOT NULL CHECK (team_type IN ('today', 'tomorrow')),
  profile_ids UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create queue_history table
CREATE TABLE public.queue_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rotation_date DATE NOT NULL,
  previous_queue JSONB NOT NULL,
  new_queue JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kitchen_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kitchen_queue
CREATE POLICY "Students can view their own queue position"
ON public.kitchen_queue
FOR SELECT
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Coordinators can view all queue positions"
ON public.kitchen_queue
FOR SELECT
USING (has_role(auth.uid(), 'coordinator'::app_role));

CREATE POLICY "Coordinators can insert queue positions"
ON public.kitchen_queue
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'coordinator'::app_role));

CREATE POLICY "Coordinators can update queue positions"
ON public.kitchen_queue
FOR UPDATE
USING (has_role(auth.uid(), 'coordinator'::app_role));

CREATE POLICY "Coordinators can delete queue positions"
ON public.kitchen_queue
FOR DELETE
USING (has_role(auth.uid(), 'coordinator'::app_role));

-- RLS Policies for kitchen_assignments
CREATE POLICY "Everyone can view assignments"
ON public.kitchen_assignments
FOR SELECT
USING (true);

CREATE POLICY "Coordinators can insert assignments"
ON public.kitchen_assignments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'coordinator'::app_role));

CREATE POLICY "Coordinators can update assignments"
ON public.kitchen_assignments
FOR UPDATE
USING (has_role(auth.uid(), 'coordinator'::app_role));

CREATE POLICY "Coordinators can delete assignments"
ON public.kitchen_assignments
FOR DELETE
USING (has_role(auth.uid(), 'coordinator'::app_role));

-- RLS Policies for queue_history
CREATE POLICY "Coordinators can view queue history"
ON public.queue_history
FOR SELECT
USING (has_role(auth.uid(), 'coordinator'::app_role));

CREATE POLICY "Coordinators can insert queue history"
ON public.queue_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'coordinator'::app_role));

-- Add trigger for updated_at on kitchen_queue
CREATE TRIGGER update_kitchen_queue_updated_at
BEFORE UPDATE ON public.kitchen_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_kitchen_queue_position ON public.kitchen_queue(queue_position);
CREATE INDEX idx_kitchen_assignments_date ON public.kitchen_assignments(assignment_date);
CREATE INDEX idx_queue_history_date ON public.queue_history(rotation_date);