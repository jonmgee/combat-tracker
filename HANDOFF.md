# Combat Tracker — Handoff Notes

## Current Status

**Phase:** Phase 1 complete
**Date:** 2026-05-23
**Verified working:** 2026-05-23 19:09 PDT

## What Was Built

React/Vite app with Supabase integration:
- Home screen with Create Session (DM) and Join Session (player) flows
- Lobby screen with prominent room code display
- Real-time participant list via Supabase subscriptions
- DM session creation with generated 6-character room code
- Player join flow with character name and room code entry
- Start Combat button (DM only, enabled when 1+ players joined)
- Warm tavern aesthetic — Cinzel serif, gold/amber palette, candlelight feel
- Mobile-first layout

## Infrastructure

| Key | Value |
|-----|-------|
| GitHub repo | jonmgee/combat-tracker |
| Live URL | combat-tracker-54k641y7s-jon-mg-ee-s-projects.vercel.app |
| Supabase project | rtiklwyvnlfcgsefctut.supabase.co |
| Deploy target | Vercel |

## Database

**Tables created:** `sessions`, `participants`

Schema is in `supabase-schema.sql`. RLS enabled on both tables. Real-time replication enabled on both tables.

## Environment Variables (set in Vercel)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Known Issues Fixed

- **RLS permission denied on sessions/participants** — Root cause: Postgres checks table-level grants before evaluating RLS policies. The anon role had no grants. Fix: added `GRANT SELECT, INSERT, UPDATE ON sessions TO anon` and `GRANT SELECT, INSERT ON participants TO anon` (plus authenticated role). Applied directly in Supabase SQL editor on 2026-05-23. Schema file updated accordingly.

## Next Task

**Phase 2 — Initiative Tracker**

Phase 2 will add:
- Initiative order entry and tracking
- Turn management (current turn indicator with candlelight glow)
- HP tracking per combatant
- Conditions system
- Real-time sync so all players see the same state
