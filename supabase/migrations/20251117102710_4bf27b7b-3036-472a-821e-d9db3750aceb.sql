-- Replace the function with proper batch update using CASE statements
CREATE OR REPLACE FUNCTION update_queue_positions_batch(
  position_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  position_case_sql text;
  date_case_sql text;
  ids_list text;
BEGIN
  -- Build the CASE statement for queue_position
  SELECT 
    string_agg(
      format('WHEN id = %L THEN %s', 
        (item->>'id')::uuid, 
        (item->>'queue_position')::integer
      ), 
      ' '
    ),
    string_agg(format('%L', (item->>'id')::uuid), ', ')
  INTO position_case_sql, ids_list
  FROM jsonb_array_elements(position_updates) AS item;

  -- Execute single UPDATE with CASE for all positions atomically
  EXECUTE format(
    'UPDATE kitchen_queue SET queue_position = CASE %s END WHERE id IN (%s)',
    position_case_sql,
    ids_list
  );

  -- Build the CASE statement for last_duty_date
  SELECT 
    string_agg(
      format('WHEN id = %L THEN %s', 
        (item->>'id')::uuid,
        CASE 
          WHEN item->>'last_duty_date' = 'null' THEN 'NULL'
          ELSE format('%L', (item->>'last_duty_date')::date)
        END
      ), 
      ' '
    )
  INTO date_case_sql
  FROM jsonb_array_elements(position_updates) AS item;

  -- Execute single UPDATE with CASE for all dates atomically
  EXECUTE format(
    'UPDATE kitchen_queue SET last_duty_date = CASE %s END WHERE id IN (%s)',
    date_case_sql,
    ids_list
  );
END;
$$;