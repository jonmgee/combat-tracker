# ~~Handoff~~ — Resolved: React Error #310

**Resolved:** 2026-05-31
**Fix commit:** `d9f01cd`

## What was wrong

React Error #310 was **not** an infinite re-render loop. It was a **Rules of Hooks violation**.

The `CombatScreen` component had a conditional early `return`:

```tsx
if (combatState.phase === 'initiative') {
    return <InitiativeEntry ... />
}
```

Everything below that early return (including a `useMemo` call at what became hook #14) only executed when `phase === 'active'`. When the DM clicked "Lock In & Begin Combat", the app would:

1. Mount with `phase='initiative'` → 13 hooks registered (early return after #13)
2. `setCombatants(sorted)` triggers a re-render → phase still `'initiative'` → 13 hooks ✓
3. WebSocket delivers `phase='active'` → React re-renders → no early return → **14 hooks** 
4. React: "Last time you had 13 hooks, now you have 14. Error #310."

## The fix

Moved the `useMemo` and all derived values (`visibleCombatants`, `groupedCombatants`, `currentCombatant`, `isMyTurn`, `myCombatantNoInit`) to **above** the early return. All hooks now register consistently on every render regardless of phase.

## Lessons learned

- React error #310 can be either "maximum update depth" OR "rendered more hooks than previous render" — the minified error code is the same for both
- Dev build gives the real error message immediately
- Four previous data-layer fixes were all chasing the wrong symptom
