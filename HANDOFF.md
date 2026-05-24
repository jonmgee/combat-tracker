# Combat Tracker — Handoff Notes

## Current Status

**Phase:** Phase 2 complete
**Date:** 2026-05-23
**Verified working:** 2026-05-23 21:28 PDT

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

## Phase 2 Complete

### Initiative Tracker
- DM clicks Start Combat → combatant rows created, initiative entry phase begins
- Players enter their own initiative (number input + Set button)
- DM enters initiatives for all players and adds monsters with names/initiative/HP
- DM clicks "Lock In & Begin Combat" → initiative order sorted, hidden monsters hidden from players
- Round counter in sticky header, active turn candle-flicker glow
- DM advances turn with "Next" button
- Players see "It's your turn!" banner; browser push notification fires
- Hidden monsters revealed after their first turn

### HP Tracking
- HP opt-in toggle in lobby (completely optional per character)
- Color-coded HP bars (green > 50%, amber > 25%, red ≤ 25%)
- Inline ± damage/heal editor with type-and-click interface
- Players only see their own HP; DM only sees monster HP

### Conditions
- 27 conditions across 3 tabs: Standard D&D (15), Weapon Mastery (8), Spell (8)
- Bottom sheet picker with emoji icons
- Anyone can add/remove conditions on any visible combatant
- Hidden monster conditions hidden from players

### Combatant Cards
- Position badge, name, initiative value, active turn indicator
- Conditions displayed as icon row
- HP bar shown when applicable
- "+ Condition" button on every card

### New Tables (run supabase-migration-phase2.sql)
- combatants, combat_state, conditions
- Full RLS, grants, and real-time subscriptions included

## Known Issues Fixed

- **RLS permission denied on sessions/participants** — Root cause: Postgres checks table-level grants before evaluating RLS policies. The anon role had no grants. Fix: added GRANT statements. Applied in Supabase 2026-05-23. Schema file updated.

## Next Task

TBD — Phase 3 or polish
