-- Create a function to batch update queue positions efficiently
CREATE OR REPLACE FUNCTION update_queue_positions_batch(
  position_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  update_item jsonb;
BEGIN
  -- Loop through the updates within a single transaction
  FOR update_item IN SELECT * FROM jsonb_array_elements(position_updates)
  LOOP
    UPDATE kitchen_queue
    SET 
      queue_position = (update_item->>'queue_position')::integer,
      last_duty_date = CASE 
        WHEN update_item->>'last_duty_date' = 'null' THEN NULL
        ELSE (update_item->>'last_duty_date')::date
      END
    WHERE id = (update_item->>'id')::uuid;
  END LOOP;
END;
$$;