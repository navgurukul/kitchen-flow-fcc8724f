-- Drop the unique constraint on queue_position that's causing issues during reordering
ALTER TABLE kitchen_queue 
DROP CONSTRAINT IF EXISTS kitchen_queue_queue_position_key;

-- Add a check constraint to ensure positions are always positive
ALTER TABLE kitchen_queue 
ADD CONSTRAINT kitchen_queue_position_positive 
CHECK (queue_position > 0);