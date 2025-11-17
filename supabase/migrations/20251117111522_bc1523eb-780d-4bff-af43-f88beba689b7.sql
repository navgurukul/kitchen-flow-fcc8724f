-- Create skip_requests table
CREATE TABLE public.skip_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  queue_position_at_request integer NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Request metadata
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Review metadata
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,
  review_notes text,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skip_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Students can view their own skip requests"
  ON public.skip_requests FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Students can create skip requests"
  ON public.skip_requests FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Coordinators can view all skip requests"
  ON public.skip_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'coordinator'));

CREATE POLICY "Coordinators can update skip requests"
  ON public.skip_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'coordinator'));

-- Trigger for updated_at
CREATE TRIGGER update_skip_requests_updated_at
  BEFORE UPDATE ON public.skip_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_skip_requests_profile_id ON public.skip_requests(profile_id);
CREATE INDEX idx_skip_requests_status ON public.skip_requests(status);
CREATE INDEX idx_skip_requests_requested_at ON public.skip_requests(requested_at);