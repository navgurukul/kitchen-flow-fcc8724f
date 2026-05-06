-- Schedule cron job to run at midnight IST (18:30 UTC)
SELECT cron.schedule(
  'rotate-kitchen-queue-midnight',
  '30 18 * * *', -- 18:30 UTC = 00:00 IST
  $$
  SELECT net.http_post(
    url:='https://dtjnviypylwhnglzeuew.supabase.co/functions/v1/rotate-kitchen-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dmFydHNob2tmYm5neXhhYWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxOTcxNzksImV4cCI6MjA3ODc3MzE3OX0.JHGqGAeOdmgU6md_zApCcXD0E5ByclIcM8bjEgUW2bU"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);