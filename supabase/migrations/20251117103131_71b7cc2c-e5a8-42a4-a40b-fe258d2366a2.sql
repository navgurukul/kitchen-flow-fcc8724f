-- Replace function with two-phase batch update to avoid UNIQUE constraint violations
CREATE OR REPLACE FUNCTION update_queue_positions_batch(
  position_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  negative_case_sql text;
  position_case_sql text;
  date_case_sql text;
  ids_list text;
BEGIN
  -- Build CASE for negative positions (Phase 1)
  SELECT 
    string_agg(
      format('WHEN id = %L THEN %s', 
        (item->>'id')::uuid, 
        -(item->>'queue_position')::integer
      ), 
      ' '
    ),
    string_agg(format('%L', (item->>'id')::uuid), ', ')
  INTO negative_case_sql, ids_list
  FROM jsonb_array_elements(position_updates) AS item;

  -- Phase 1: Set all to negative positions (no conflicts possible)
  EXECUTE format(
    'UPDATE kitchen_queue SET queue_position = CASE %s END WHERE id IN (%s)',
    negative_case_sql,
    ids_list
  );

  -- Build CASE for final positive positions (Phase 2)
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

  -- Phase 2: Set to final positive positions
  EXECUTE format(
    'UPDATE kitchen_queue SET queue_position = CASE %s END WHERE id IN (%s)',
    position_case_sql,
    ids_list
  );

  -- Build CASE for last_duty_date
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

  -- Update dates
  EXECUTE format(
    'UPDATE kitchen_queue SET last_duty_date = CASE %s END WHERE id IN (%s)',
    date_case_sql,
    ids_list
  );
END;
$$;