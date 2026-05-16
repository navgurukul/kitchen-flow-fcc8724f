
-- Unschedule the existing cron job (if it exists)
DO $$
BEGIN
  PERFORM cron.unschedule(1);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Reschedule to run at midnight IST (00:00)
SELECT cron.schedule(
  'rotate-kitchen-queue-midnight',
  '0 0 * * *', -- Midnight (00:00)
  $$
  SELECT net.http_post(
    url:=current_setting('app.project_url') || '/functions/v1/rotate-kitchen-queue',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body:=jsonb_build_object('time', now())
  ) as request_id;
  $$
);
