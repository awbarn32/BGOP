-- ============================================================
-- BGOP Migration 005: CRON job schedules for edge functions
-- ============================================================
-- Requires: pg_cron and pg_net extensions (enabled by default on Supabase)
-- All times are UTC. Bangkok (ICT) = UTC+7.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- service-reminder: daily at 01:00 UTC (08:00 Bangkok)
-- ============================================================
SELECT cron.schedule(
  'bgop-service-reminder',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url      := 'https://ugmbbcjxvvyadtahetgt.supabase.co/functions/v1/service-reminder',
    headers  := '{"Content-Type": "application/json"}'::jsonb,
    body     := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- ar-followup: every Monday at 02:00 UTC (09:00 Bangkok)
-- ============================================================
SELECT cron.schedule(
  'bgop-ar-followup',
  '0 2 * * 1',
  $$
  SELECT net.http_post(
    url      := 'https://ugmbbcjxvvyadtahetgt.supabase.co/functions/v1/ar-followup',
    headers  := '{"Content-Type": "application/json"}'::jsonb,
    body     := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- dormant-segmentation: every Sunday at 02:00 UTC
-- ============================================================
SELECT cron.schedule(
  'bgop-dormant-segmentation',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url      := 'https://ugmbbcjxvvyadtahetgt.supabase.co/functions/v1/dormant-segmentation',
    headers  := '{"Content-Type": "application/json"}'::jsonb,
    body     := '{}'::jsonb
  ) AS request_id;
  $$
);
