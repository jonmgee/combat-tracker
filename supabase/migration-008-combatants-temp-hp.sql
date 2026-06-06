-- Migration 008: Add temp_hp column to combatants
-- Temp HP is a separate buffer: damage hits temp first, then real HP.
-- Temp HP does not stack — only the highest source applies.
-- Cleared on combat reset (combatants are deleted and recreated).

alter table combatants add column if not exists temp_hp smallint not null default 0;