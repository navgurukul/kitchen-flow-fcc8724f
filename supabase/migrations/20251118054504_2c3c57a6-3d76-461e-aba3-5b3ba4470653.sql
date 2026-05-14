-- Schedule cron job to run at midnight IST (18:30 UTC)
SELECT cron.schedule(
  'rotate-kitchen-queue-midnight',
  '30 18 * * *', -- 18:30 UTC = 00:00 IST
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