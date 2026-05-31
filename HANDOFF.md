# Handoff: React Error #310 — "Maximum update depth exceeded"

**Date:** 2026-05-31
**From:** Geordi La Forge
**To:** Claude (next engineer)

## The Problem

Clicking "⚔️ Lock In & Begin Combat" (the DM button in the initiative entry phase) causes a blank screen with React error #310 — **"Maximum update depth exceeded"** (infinite re-render loop).

This happened **after** the monster group-splitting commit (`70e6808`) was deployed. Before that commit, the combat worked fine.

## Symptoms

- Error #310 on production build (minified)
- Stack trace passes through condition icon/colour map functions (`CONDITION_ICON_MAP`, `CONDITION_COLOURS`)
- Occurs when the DM clicks the "Lock In & Begin Combat" button in `InitiativeEntry`
- The app transitions to a blank page with the `ErrorBoundary` fallback (if deployed) or a completely blank screen

## How It Works

### Flow
1. DM is on `InitiativeEntry` screen (loaded inside `CombatScreen` conditionally: `if (combatState.phase === 'initiative')`)
2. DM fills in player initiatives + monster rows, clicks "Lock In & Begin Combat"
3. `submitDMInitiatives()` collects the data and calls `onReady({ playerUpdates, monsterInserts })`
4. `onReady` (defined in `CombatScreen.tsx`) writes to Supabase, re-orders combatants, and updates `combat_state.phase` to `'active'`
5. React re-renders: `combatState.phase` is now `'active'`, so the combat view renders instead of `InitiativeEntry`

### Real-time subscriptions
All three Supabase tables have `postgres_changes` subscriptions in `CombatScreen.tsx`:
- `combat_state` — updates `setCombatState()` when anyone advances turn
- `combatants` — calls `loadAll()` to refresh combatant data
- `conditions` — calls `loadAll()` to refresh condition data

## What Has Been Tried (in order)

### 1. `loadConditions` dependency cycle (commit `276165e`)
**Problem:** `loadConditions` had `combatants` in its `useCallback` dependency array. Every `setCombatants()` gave `combatants` a new reference, which recreated `loadConditions`, which fired the `useEffect`, which called `loadConditions()` → `setConditions()` → re-render... infinite loop.

**Fix:** Changed `loadConditions` to fetch combatant IDs from the DB directly instead of reading them from `combatants` state. Dependency was reduced to just `[session.id]`.

**Result:** Still crashing.

### 2. `LanternColumnWrapper` loop (commit `d509ab8`)
**Problem:** `LanternColumnWrapper` had `combatants` in its `useEffect` dependency array. `visibleCombatants` (the prop passed to it) is computed inline every render as `isDM ? combatants : combatants.filter(...)`, which creates a new array reference on every render. So the effect fired every render → `setActiveMidY()` → re-render → infinite loop.

**Fix:** Removed `combatants` from the deps array. Used a ref for `activeId` and a `ResizeObserver` for re-measuring.

**Result:** Still crashing.

### 3. Consolidated `loadAll` (commit `03c0286`)
**Problem:** `loadCombatants` and `loadConditions` were separate `useCallback` hooks. Even though their dependency arrays were fixed, having two separate state updates in separate effects could cascade. Also the conditions subscription fired `loadConditions` which could cross-trigger.

**Fix:** Merged both into a single `loadAll` callback that fetches combatants and conditions in one shot. One `useEffect`, one subscription callback.

**Result:** Still crashing.

### 4. DB writes inside `subPaused` guard (commit `ed0811c`)
**Problem:** The DM's "Lock In" flow did DB writes outside the `subPaused` guard. `submitDMInitiatives()` in `InitiativeEntry.tsx` would write player initiatives and monster rows to Supabase BEFORE calling `onReady()` (which sets `subPaused.current = true`). Each DB write triggered the real-time subscription → `loadAll()` → `setCombatants()` → re-render. During an async function with multiple sequential `await`s, React could see these as too many nested state updates and throw #310.

**Fix:** Refactored the flow:
- `InitiativeEntry.submitDMInitiatives()` now only **collects** data and passes it to `onReady()`. No DB writes.
- `CombatScreen`'s `onReady` now receives `{ playerUpdates, monsterInserts }`, sets `subPaused = true` FIRST, then does ALL DB writes inside the guard.
- Added `try/finally` to ensure `subPaused = false` gets reset.
- Removed `sessionId` prop from `InitiativeEntry` (no longer needed since DB calls moved up).

**Result:** **Still crashing.** (Confirmed by screenshot after deploy.) This means the real cause is something else, or this fix didn't fully address it.

## The Monster Group-Splitting Commit

The breaking commit (`70e6808`) did two things:
1. Changed `submitDMInitiatives()` to insert individual rows per monster instead of one row with `count: N`
2. Introduced the `GroupCombatantCard` component with sub-card grid

These are the main differences from when the app worked.

## Components Involved

- `CombatScreen.tsx` — orchestrates data loading, subscriptions, phase rendering
- `InitiativeEntry.tsx` — DM enters initiatives + monsters, clicks Lock In
- `CombatantCard.tsx` — renders a single combatant (used when monsters are solo or players)
- `GroupCombatantCard.tsx` — renders grouped same-name monsters in sub-cards
- `ConditionIcons.tsx` — all icons + colour maps (mentioned in crash stack trace)
- `ConditionPicker.tsx` — bottom sheet for picking conditions

## Suspected But Unconfirmed

The stack trace always mentions `CONDITION_ICON_MAP` and `CONDITION_COLOURS` (the file is `ConditionIcons.tsx`). These are used in:
- `CombatantCard.tsx` (condition rendering)
- `GroupCombatantCard.tsx` (condition rendering inside sub-cards)
- `ConditionPicker.tsx` (condition grid in the bottom sheet)

The error might not be in the initiative phase at all — it might happen **after** the phase transitions to `'active'` and React tries to render the combat view with conditions. The conditions subscription fires, loads conditions, and something re-triggers.

## To Debug Locally

Use the development build to get the real error message instead of `#310`:

```bash
cd ~/combat-tracker
npx vite --port 5173
```

Open `http://localhost:5173/` in a browser (Safari or Chrome), reproduce the crash, and check the browser console. The dev build of React will show the full error message including the component name and the exact state setter causing the infinite loop.

## Current Codebase State

`main` branch at commit `ed0811c` — pushed and deployed.

Files changed in latest fix:
- `src/components/CombatScreen.tsx` — `onReady` now receives data, does DB writes inside `subPaused`
- `src/components/combat/InitiativeEntry.tsx` — collects data only, passes to `onReady`, removed `sessionId` prop

Files changed in earlier fixes (all still deployed):
- `src/components/ErrorBoundary.tsx` — error boundary to catch crashes with readable UI
- `src/components/CombatScreen.tsx` — `loadAll` consolidation, `LanternColumnWrapper` loop fix

## What Would Help

1. Read the dev-mode error message (run locally, check browser console)
2. Check if the loop is in the initiative phase or the combat phase (the error occurs after clicking Lock In, but might be during the re-render with the new combat view)
3. Check if removing conditions rendering from `GroupCombatantCard` resolves the crash (narrow the cause)
4. The `visibleCombatants` inline computation (`isDM ? combatants : combatants.filter(...)`) creates new array refs every render — may cause downstream re-renders
5. Check if the conditions subscription fires during the phase transition and triggers another `loadAll()` after the `subPaused` guard is released
