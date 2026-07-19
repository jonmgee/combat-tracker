-- Migration 013: data retention, push subscription lockdown, room size cap
--
-- Three separate fixes, applied together:
--   1. Sessions are DELETED 24h after creation, not just marked 'ended'.
--      Replaces migration 009, which left every session in the table forever.
--   2. Anonymous clients can no longer READ push_subscriptions. The stored
--      subscription jsonb contains the endpoint plus p256dh/auth keys — enough
--      to push to someone's device. The client never reads this table (it only
--      upserts and deletes by endpoint), so removing select breaks nothing.
--   3. Rooms are capped at 12 participants, enforced in the database rather
--      than the UI, so it can't be bypassed by calling the API directly.

-- ── 1. Retention: delete sessions 24h after creation ────────────────────────
-- All child tables (participants, combatants, combat_state, conditions,
-- push_subscriptions) cascade from sessions, so this clears everything.

create or replace function delete_stale_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from sessions
  where created_at < now() - interval '24 hours';
end;
$$;

-- Swap the hourly job from "end" to "delete". Tolerates the old job not
-- existing so this migration is safe to re-run.
do $$
begin
  perform cron.unschedule('end-stale-sessions-hourly');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'delete-stale-sessions-hourly',
  '0 * * * *',
  'select delete_stale_sessions()'
);

drop function if exists end_stale_sessions();

-- Backfill: clear the accumulated history in one go. Anything created less
-- than 24h ago — including a session in progress right now — is untouched.
select delete_stale_sessions();

-- ── 2. push_subscriptions: no anonymous reads ───────────────────────────────
-- service_role keeps its select (granted in migration 012) so the notify-turn
-- edge function still works.

drop policy if exists "push_subscriptions_select" on push_subscriptions;

revoke select on push_subscriptions from anon;
revoke select on push_subscriptions from authenticated;

-- ── 3. Room capacity cap ────────────────────────────────────────────────────
-- 12 includes the DM, so a DM plus 11 players. Rejoins reuse the existing
-- participant row rather than inserting, so this does not block reconnects.
-- The message text is surfaced directly in the join screen.

create or replace function enforce_room_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  participant_count integer;
begin
  select count(*) into participant_count
  from participants
  where session_id = new.session_id;

  if participant_count >= 12 then
    raise exception 'This room is full (12 players maximum).'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists participants_capacity_check on participants;

create trigger participants_capacity_check
  before insert on participants
  for each row
  execute function enforce_room_capacity();
