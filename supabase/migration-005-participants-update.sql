-- Migration 005: Add UPDATE RLS policy for participants table
-- Without this, lobby toggles (hp_opt_in, notifications_enabled, alert_feat, alert_used) silently fail

create policy "participants_update"
  on participants
  for update
  using (true)
  with check (true);
