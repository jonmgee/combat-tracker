-- Migration 006: Add dead flag to combatants, HP fields to participants

alter table combatants
  add column if not exists dead boolean not null default false;

alter table participants
  add column if not exists starting_hp smallint,
  add column if not exists max_hp_participant smallint;
