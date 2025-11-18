-- Create a view that combines profiles with their roles
CREATE OR REPLACE VIEW profiles_with_roles AS
SELECT 
  p.id,
  p.user_id,
  p.full_name,
  p.email,
  p.status,
  p.created_at,
  p.updated_at,
  p.last_queue_position,
  COALESCE(ur.role, 'student'::app_role) as role
FROM profiles p
LEFT JOIN user_roles ur ON p.user_id = ur.user_id;

-- Enable security invoker so the view respects RLS policies from underlying tables
ALTER VIEW profiles_with_roles SET (security_invoker = on);

-- Grant SELECT permission to authenticated users
GRANT SELECT ON profiles_with_roles TO authenticated;