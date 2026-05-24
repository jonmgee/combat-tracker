-- Combat Tracker — Phase 2 Migration
-- Run this in your Supabase SQL editor AFTER the Phase 1 schema.

-- ── Alter participants ────────────────────────────────────────────────────────
alter table participants
  add column if not exists hp_opt_in boolean not null default false;

-- ── Combatants ────────────────────────────────────────────────────────────────
create table if not exists combatants (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references sessions(id) on delete cascade,
  participant_id    uuid references participants(id) on delete set null,
  name              text not null,
  kind              text not null default 'player' check (kind in ('player', 'monster')),
  initiative        smallint,
  initiative_order  smallint,
  is_hidden         boolean not null default false,
  has_taken_turn    boolean not null default false,
  count             integer not null default 1,
  hp_enabled        boolean not null default false,
  max_hp            smallint,
  current_hp        smallint,
  created_at        timestamptz not null default now()
);

create index if not exists combatants_session_id_idx on combatants (session_id);
create index if not exists combatants_participant_id_idx on combatants (participant_id);

-- ── Combat state ──────────────────────────────────────────────────────────────
create table if not exists combat_state (
  session_id            uuid primary key references sessions(id) on delete cascade,
  current_combatant_id  uuid references combatants(id) on delete set null,
  round_number          integer not null default 1,
  phase                 text not null default 'initiative' check (phase in ('initiative', 'active')),
  updated_at            timestamptz not null default now()
);

-- ── Conditions ────────────────────────────────────────────────────────────────
create table if not exists conditions (
  id             uuid primary key default gen_random_uuid(),
  combatant_id   uuid not null references combatants(id) on delete cascade,
  condition      text not null,
  category       text not null check (category in ('standard', 'weapon_mastery', 'spell')),
  applied_at     timestamptz not null default now()
);

create index if not exists conditions_combatant_id_idx on conditions (combatant_id);

-- ── Grants ────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on combatants   to anon;
grant select, insert, update, delete on combat_state to anon;
grant select, insert, delete         on conditions   to anon;
grant select, insert, update         on participants to anon;

grant select, insert, update, delete on combatants   to authenticated;
grant select, insert, update, delete on combat_state to authenticated;
grant select, insert, delete         on conditions   to authenticated;
grant select, insert, update         on participants to authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table combatants   enable row level security;
alter table combat_state enable row level security;
alter table conditions   enable row level security;

create policy "combatants_select"   on combatants   for select using (true);
create policy "combatants_insert"   on combatants   for insert with check (true);
create policy "combatants_update"   on combatants   for update using (true);
create policy "combatants_delete"   on combatants   for delete using (true);

create policy "combat_state_select" on combat_state for select using (true);
create policy "combat_state_insert" on combat_state for insert with check (true);
create policy "combat_state_update" on combat_state for update using (true);

create policy "conditions_select"   on conditions   for select using (true);
create policy "conditions_insert"   on conditions   for insert with check (true);
create policy "conditions_delete"   on conditions   for delete using (true);

-- ── Real-time ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table combatants;
alter publication supabase_realtime add table combat_state;
alter publication supabase_realtime add table conditions;
