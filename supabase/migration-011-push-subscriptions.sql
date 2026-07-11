-- Migration 011: Web Push subscriptions for "it's your turn" notifications
-- One row per (participant, device). endpoint is globally unique per the
-- Push API spec, so we upsert on it. The notify-turn edge function reads these
-- with the service role; the anon client manages its own rows.

create table if not exists push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  session_id     uuid not null references sessions(id) on delete cascade,
  endpoint       text not null unique,
  subscription   jsonb not null,
  created_at     timestamptz not null default now()
);

create index if not exists push_subscriptions_participant_idx on push_subscriptions (participant_id);

-- Table grants (checked before RLS) — anon manages its own subscription rows
grant select, insert, update, delete on push_subscriptions to anon;
grant select, insert, update, delete on push_subscriptions to authenticated;

alter table push_subscriptions enable row level security;

-- Anonymous app, permissive policies matching the rest of the schema
create policy "push_subscriptions_select" on push_subscriptions for select using (true);
create policy "push_subscriptions_insert" on push_subscriptions for insert with check (true);
create policy "push_subscriptions_update" on push_subscriptions for update using (true);
create policy "push_subscriptions_delete" on push_subscriptions for delete using (true);
