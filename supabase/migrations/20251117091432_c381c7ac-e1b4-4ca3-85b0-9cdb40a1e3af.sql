-- Add email domain validation to handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate that email is from @navgurukul.org domain
  IF NEW.email NOT LIKE '%@navgurukul.org' THEN
    RAISE EXCEPTION 'Only @navgurukul.org email addresses are allowed to sign up'
      USING HINT = 'Please use your NavGurukul Google account to sign in';
  END IF;
  
  -- Extract full name from Google OAuth metadata or use email username
  INSERT INTO public.profiles (user_id, full_name, email, status)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'active'
  );
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;