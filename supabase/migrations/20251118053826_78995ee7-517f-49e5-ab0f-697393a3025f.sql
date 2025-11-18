
-- Unschedule the existing cron job
SELECT cron.unschedule(1);

-- Reschedule to run at midnight IST (00:00)
SELECT cron.schedule(
  'rotate-kitchen-queue-midnight',
  '0 0 * * *', -- Midnight (00:00)
  $$
  SELECT net.http_post(
    url:='https://jtvartshokfbngyxaako.supabase.co/functions/v1/rotate-kitchen-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dmFydHNob2tmYm5neXhhYWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxOTcxNzksImV4cCI6MjA3ODc3MzE3OX0.JHGqGAeOdmgU6md_zApCcXD0E5ByclIcM8bjEgUW2bU"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
