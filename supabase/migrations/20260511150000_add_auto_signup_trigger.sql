-- Auto-create user records when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  -- Insert into profiles with user info from OAuth
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    NEW.email
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add INSERT policies to allow trigger
DROP POLICY IF EXISTS "Allow insert for trigger" ON public.user_roles;
CREATE POLICY "Allow insert for trigger"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert for trigger" ON public.profiles;
CREATE POLICY "Allow insert for trigger"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);
