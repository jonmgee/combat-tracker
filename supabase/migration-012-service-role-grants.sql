-- Migration 012: grant the notify-turn edge function's role access to the
-- tables it reads. The function runs as service_role, but the original schema
-- only granted privileges to anon/authenticated — so its combatant/participant/
-- subscription lookups failed with "permission denied" and silently sent nothing.

grant select on combatants                 to service_role;
grant select on participants               to service_role;
grant select, delete on push_subscriptions to service_role;
