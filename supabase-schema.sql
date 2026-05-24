-- Combat Tracker — Phase 1 Schema
-- Run this in your Supabase SQL editor (Project → SQL Editor → New Query)

-- ── Sessions ──────────────────────────────────────────────────────────────────
create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null unique,
  status     text not null default 'lobby' check (status in ('lobby', 'active', 'ended')),
  created_at timestamptz not null default now()
);

-- Index for room code lookups (used on every join)
create index if not exists sessions_room_code_idx on sessions (room_code);

-- ── Participants ──────────────────────────────────────────────────────────────
create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  name        text not null,
  role        text not null default 'player' check (role in ('dm', 'player')),
  joined_at   timestamptz not null default now()
);

-- Index for participant lookups by session
create index if not exists participants_session_id_idx on participants (session_id);

-- ── Table-level grants ───────────────────────────────────────────────────────
-- Postgres checks table grants BEFORE evaluating RLS policies.
-- Without these, the anon key gets "permission denied" even with valid policies.
grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant select, insert, update on sessions     to anon;
grant select, insert          on participants to anon;

grant select, insert, update on sessions     to authenticated;
grant select, insert          on participants to authenticated;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS on both tables
alter table sessions     enable row level security;
alter table participants enable row level security;

-- Sessions: anyone can read; anyone can insert; DM can update status
create policy "sessions_select" on sessions for select using (true);
create policy "sessions_insert" on sessions for insert with check (true);
create policy "sessions_update" on sessions for update using (true);

-- Participants: anyone can read and insert (joining a session)
create policy "participants_select" on participants for select using (true);
create policy "participants_insert" on participants for insert with check (true);

-- ── Real-time ─────────────────────────────────────────────────────────────────
-- Enable real-time replication for the participants table
-- (Do this in Supabase Dashboard → Database → Replication → Tables,
--  or run the statement below)
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table sessions;
