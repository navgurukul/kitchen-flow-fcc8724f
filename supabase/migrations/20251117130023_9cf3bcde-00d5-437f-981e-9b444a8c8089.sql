-- Allow all authenticated users to view all profiles
-- This enables students to see the full team list on the Dashboard
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);