-- Migration 009: Auto-end stale sessions after 24 hours
-- Runs hourly via pg_cron. Ends any lobby/active session whose
-- created_at is more than 24 hours old.
--
-- To apply: paste the whole block into Supabase SQL Editor and run.
-- If pg_cron is not yet enabled, first run:
--   create extension if not exists pg_cron;

-- Step 1: Enable pg_cron (safe to run even if already enabled)
create extension if not exists pg_cron;

-- Step 2: Create the cleanup function
create or replace function end_stale_sessions()
returns void
language plpgsql
security definer
as $$
begin
  update sessions
  set status = 'ended'
  where status in ('lobby', 'active')
    and created_at < now() - interval '24 hours';
end;
$$;

-- Step 3: Schedule it to run every hour
select cron.schedule(
  'end-stale-sessions-hourly',
  '0 * * * *',
  'select end_stale_sessions()'
);