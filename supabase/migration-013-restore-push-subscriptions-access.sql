-- Migration 013: restore push_subscriptions anon access.
--
-- An app-cleanup sweep (run in a separate session) revoked the anon SELECT
-- grant AND dropped the SELECT RLS policy on push_subscriptions — but only on
-- this table. The client stores subscriptions with an upsert that returns the
-- row (needs SELECT), so it began failing with "permission denied" / RLS
-- violations, and iOS turn alerts silently stopped: no subscription was ever
-- stored. Every other table was unaffected.
--
-- This restores the state migration-011 established, consistent with the rest
-- of this anonymous app (all tables use permissive `using (true)` policies).
-- Idempotent — safe to re-run.

grant select on push_subscriptions to anon;
grant select on push_subscriptions to authenticated;

drop policy if exists push_subscriptions_select on push_subscriptions;
create policy push_subscriptions_select on push_subscriptions for select using (true);
