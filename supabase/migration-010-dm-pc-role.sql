-- Migration 010: Extend participants role to include 'dm_pc'
-- DM-added PCs get a real participants row with role='dm_pc',
-- so they have participant-level settings (HP, Alert Feat) and
-- survive Start New Combat via the same rebuild path as real players.

alter table participants drop constraint if exists participants_role_check;
alter table participants add constraint participants_role_check
  check (role in ('dm', 'player', 'dm_pc'));