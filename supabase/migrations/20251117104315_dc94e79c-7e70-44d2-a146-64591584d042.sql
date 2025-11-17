-- Fix date type casting in update_queue_positions_batch function
CREATE OR REPLACE FUNCTION update_queue_positions_batch(
  position_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  temp_case_sql text;
  position_case_sql text;
  date_case_sql text;
  ids_list text;
BEGIN
  -- Build CASE for temporary high positions (Phase 1: add 1000 offset)
  SELECT 
    string_agg(
      format('WHEN id = %L THEN %s', 
        (item->>'id')::uuid, 
        1000 + (item->>'queue_position')::integer
      ), 
      ' '
    ),
    string_agg(format('%L', (item->>'id')::uuid), ', ')
  INTO temp_case_sql, ids_list
  FROM jsonb_array_elements(position_updates) AS item;

  -- Phase 1: Move all to temporary high positions (1000+)
  EXECUTE format(
    'UPDATE kitchen_queue SET queue_position = CASE %s END WHERE id IN (%s)',
    temp_case_sql,
    ids_list
  );

  -- Build CASE for final positions (Phase 2)
  SELECT 
    string_agg(
      format('WHEN id = %L THEN %s', 
        (item->>'id')::uuid, 
        (item->>'queue_position')::integer
      ), 
      ' '
    )
  INTO position_case_sql
  FROM jsonb_array_elements(position_updates) AS item;

  -- Phase 2: Set to final positions
  EXECUTE format(
    'UPDATE kitchen_queue SET queue_position = CASE %s END WHERE id IN (%s)',
    position_case_sql,
    ids_list
  );

  -- Build CASE for last_duty_date with proper date casting
  SELECT 
    string_agg(
      format('WHEN id = %L THEN %s', 
        (item->>'id')::uuid,
        CASE 
          WHEN item->>'last_duty_date' = 'null' THEN 'NULL'
          ELSE format('%L::date', item->>'last_duty_date')
        END
      ), 
      ' '
    )
  INTO date_case_sql
  FROM jsonb_array_elements(position_updates) AS item;

  -- Update dates
  EXECUTE format(
    'UPDATE kitchen_queue SET last_duty_date = CASE %s END WHERE id IN (%s)',
    date_case_sql,
    ids_list
  );
END;
$$;