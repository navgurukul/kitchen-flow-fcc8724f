-- Create rotation_settings table for pause functionality
CREATE TABLE public.rotation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_paused boolean NOT NULL DEFAULT false,
  paused_until timestamp with time zone,
  paused_by uuid REFERENCES auth.users(id),
  paused_at timestamp with time zone,
  paused_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default record
INSERT INTO public.rotation_settings (is_paused) VALUES (false);

-- Enable RLS
ALTER TABLE public.rotation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Coordinators can view rotation settings"
  ON public.rotation_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'coordinator'::app_role));

CREATE POLICY "Coordinators can update rotation settings"
  ON public.rotation_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'coordinator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'coordinator'::app_role));

-- Add update trigger
CREATE TRIGGER update_rotation_settings_updated_at
  BEFORE UPDATE ON public.rotation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();