-- Migration 004: Add 'order_review' phase to combat_state check constraint

-- Postgres can't ALTER CHECK constraints directly; we need to drop and recreate.
alter table combat_state drop constraint if exists combat_state_phase_check;
alter table combat_state add constraint combat_state_phase_check
  check (phase in ('initiative', 'order_review', 'active'));