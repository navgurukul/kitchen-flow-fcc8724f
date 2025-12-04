-- Migration: Add DELETE policies for complete student deletion
-- Description: Allows coordinators to properly delete student profiles and all related data
-- Created: 2025-12-04

-- ============================================================================
-- Add DELETE policy for profiles table
-- ============================================================================
CREATE POLICY "Coordinators can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (
    public.has_role (auth.uid (), 'coordinator')
);

-- ============================================================================
-- Add DELETE policy for skip_requests table
-- ============================================================================
CREATE POLICY "Coordinators can delete skip requests" ON public.skip_requests FOR DELETE TO authenticated USING (
    public.has_role (auth.uid (), 'coordinator')
);

-- ============================================================================
-- Add DELETE policy for user_roles table
-- ============================================================================
CREATE POLICY "Coordinators can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (
    public.has_role (auth.uid (), 'coordinator')
);

-- ============================================================================
-- Create function for complete student deletion
-- ============================================================================
-- This function ensures atomic deletion of all student-related data
CREATE OR REPLACE FUNCTION public.delete_student_completely(student_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_user_id UUID;
BEGIN
  -- Check if caller is a coordinator
  IF NOT public.has_role(auth.uid(), 'coordinator') THEN
    RAISE EXCEPTION 'Only coordinators can delete students';
  END IF;

  -- Get the user_id associated with this profile
  SELECT user_id INTO student_user_id
  FROM public.profiles
  WHERE id = student_profile_id;
  
  IF student_user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found with id: %', student_profile_id;
  END IF;
  
  -- Delete from kitchen_queue (has CASCADE, but explicit for transaction safety)
  DELETE FROM public.kitchen_queue 
  WHERE profile_id = student_profile_id;
  
  -- Delete from skip_requests (has CASCADE, but explicit for clarity)
  DELETE FROM public.skip_requests 
  WHERE profile_id = student_profile_id;
  
  -- Delete from user_roles
  DELETE FROM public.user_roles 
  WHERE user_id = student_user_id;
  
  -- Delete profile (this will cascade to any other related tables)
  DELETE FROM public.profiles 
  WHERE id = student_profile_id;
  
  -- Log the deletion for audit purposes
  RAISE NOTICE 'Successfully deleted student profile: % (user_id: %)', student_profile_id, student_user_id;
  
  -- Note: auth.users deletion requires admin privileges
  -- The Supabase Auth user record should be handled separately if needed
END;
$$;

-- Grant execute permission to authenticated users
-- (The function itself checks for coordinator role)
GRANT
EXECUTE ON FUNCTION public.delete_student_completely (UUID) TO authenticated;

-- ============================================================================
-- Add comment for documentation
-- ============================================================================
COMMENT ON FUNCTION public.delete_student_completely (UUID) IS 'Completely deletes a student and all related data including profile, queue entries, skip requests, and user roles. Only coordinators can execute this function.';