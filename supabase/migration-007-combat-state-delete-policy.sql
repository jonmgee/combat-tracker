-- Migration 007: Add RLS DELETE policy for combat_state
-- This was missing from Phase 2 — combat_state had INSERT/SELECT/UPDATE policies
-- but no DELETE policy, which silently blocked the "Start New Combat" reset flow.
-- Without this, combatants delete OK but combat_state stays, so the DELETE
-- real-time event never fires and players don't get bounced to lobby.

create policy "combat_state_delete" on combat_state for delete using (true);