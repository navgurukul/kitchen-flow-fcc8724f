-- Fix: Reschedule cron job to run at midnight IST (18:30 UTC)
-- Current: '0 0 * * *' runs at 00:00 UTC (05:30 IST - morning!)
-- Correct: '30 18 * * *' runs at 18:30 UTC (00:00 IST - midnight!)

-- Unschedule the existing incorrect cron job
DO $$
BEGIN
  PERFORM cron.unschedule('rotate-kitchen-queue-midnight');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Reschedule to run at midnight IST (18:30 UTC)
SELECT cron.schedule(
  'rotate-kitchen-queue-midnight',
  '30 18 * * *', -- 18:30 UTC = 00:00 IST (midnight)
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
