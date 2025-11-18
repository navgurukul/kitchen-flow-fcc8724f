-- Add column to store the last known queue position before deactivation
ALTER TABLE profiles 
ADD COLUMN last_queue_position INTEGER NULL;

COMMENT ON COLUMN profiles.last_queue_position IS 
'Stores the queue position when a student was deactivated, used to restore their position on reactivation';