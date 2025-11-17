-- Clean up existing duplicate queue positions by renumbering them sequentially
WITH numbered_queue AS (
  SELECT id, profile_id, queue_position,
         ROW_NUMBER() OVER (ORDER BY queue_position, joined_at, id) as new_position
  FROM kitchen_queue
)
UPDATE kitchen_queue
SET queue_position = numbered_queue.new_position
FROM numbered_queue
WHERE kitchen_queue.id = numbered_queue.id;

-- Add back the unique constraint on queue_position to prevent future duplicates
ALTER TABLE kitchen_queue 
ADD CONSTRAINT kitchen_queue_unique_position 
UNIQUE (queue_position);