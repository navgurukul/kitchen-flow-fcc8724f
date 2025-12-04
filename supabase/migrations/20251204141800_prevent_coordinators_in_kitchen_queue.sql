-- Migration: Prevent coordinators from being assigned kitchen duties
-- Description: Ensures users with the 'coordinator' role are completely exempt from kitchen queue and duty assignments
-- Created: 2025-12-04

-- ============================================================================
-- Create a helper function to check if a profile belongs to a coordinator
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_coordinator_profile(profile_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  SELECT ur.role INTO user_role
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE p.id = profile_uuid;
  
  RETURN COALESCE(user_role = 'coordinator'::app_role, false);
END;
$$;

-- Grant execute permission
GRANT
EXECUTE ON FUNCTION public.is_coordinator_profile (UUID) TO authenticated;

COMMENT ON FUNCTION public.is_coordinator_profile (UUID) IS 'Helper function that checks if a given profile_id belongs to a user with the coordinator role.';

-- ============================================================================
-- Clean up existing coordinators from kitchen_queue (if any)
-- ============================================================================
-- Remove any coordinators that may already be in the queue before adding constraint
DELETE FROM public.kitchen_queue
WHERE
    profile_id IN (
        SELECT p.id
        FROM public.profiles p
            JOIN public.user_roles ur ON p.user_id = ur.user_id
        WHERE
            ur.role = 'coordinator'::app_role
    );

-- Reorder queue positions after cleanup to ensure sequential positions
WITH
    numbered_queue AS (
        SELECT id, ROW_NUMBER() OVER (
                ORDER BY queue_position
            ) as new_position
        FROM public.kitchen_queue
        ORDER BY queue_position
    )
UPDATE public.kitchen_queue kq
SET
    queue_position = nq.new_position
FROM numbered_queue nq
WHERE
    kq.id = nq.id;

-- ============================================================================
-- Add CHECK constraint to kitchen_queue table to prevent coordinator insertion
-- ============================================================================
-- This prevents coordinators from being added to the kitchen queue at the database level
ALTER TABLE public.kitchen_queue
ADD CONSTRAINT no_coordinators_in_queue CHECK (
    NOT public.is_coordinator_profile (profile_id)
);

COMMENT ON CONSTRAINT no_coordinators_in_queue ON public.kitchen_queue IS 'Ensures that users with the coordinator role cannot be added to the kitchen queue, preventing them from being assigned kitchen duties.';

-- ============================================================================
-- Update RLS policy to prevent coordinators from being added to queue
-- ============================================================================
-- Drop existing INSERT policy and recreate with coordinator check
DROP POLICY IF EXISTS "Coordinators can insert queue positions" ON public.kitchen_queue;

CREATE POLICY "Coordinators can insert queue positions" ON public.kitchen_queue FOR INSERT
WITH
    CHECK (
        has_role (
            auth.uid (),
            'coordinator'::app_role
        )
        AND NOT public.is_coordinator_profile (profile_id)
    );

-- ============================================================================
-- Create a trigger function to prevent coordinators from being added to queue
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_coordinator_in_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_coordinator_profile(NEW.profile_id) THEN
    RAISE EXCEPTION 'Coordinators cannot be added to the kitchen queue';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_prevent_coordinator_in_queue ON public.kitchen_queue;

CREATE TRIGGER trigger_prevent_coordinator_in_queue
  BEFORE INSERT OR UPDATE ON public.kitchen_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_coordinator_in_queue();

COMMENT ON FUNCTION public.prevent_coordinator_in_queue () IS 'Trigger function that prevents coordinators from being inserted or updated into the kitchen queue.';