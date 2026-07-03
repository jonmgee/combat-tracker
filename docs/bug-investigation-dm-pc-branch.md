# Bug Investigation — DM-PC Branch Findings

Date: 2026-07-03 01:45 BST
Session: RELIC-SUMMIT (id: 218e4a3b-6e6b-4e29-9b3f-32e27f82f101)
Branch: feat/unify-dm-pcs (commit 6881fc1)

---

## Pre-flight check

Migration `migration-010-dm-pc-role.sql` was never applied to the database
(`rtiklwyvnlfcgsefctut.supabase.co` — the same instance both production and
preview deployments connect to). A test insert with `role: 'dm_pc'` returned:

```
23514: new row for relation "participants" violates check constraint "participants_role_check"
```

This means the existing CHECK constraint (`role in ('dm', 'player')`) is
still in force. Every finding below must be read in light of this: the core
data-model change literally cannot work yet.

---

## Bug 1: Alert Feat swap button missing for DM-PCs

### Current state on the branch

The swap button renders at `OrderReviewScreen.tsx:349-363`:

```tsx
{!isDM && isAlertSwapTarget && (... ↔ Swap ...)}
```

There are **two cumulative gates** that exclude DM-PCs:

**Gate 1 — `!isDM`:**
This is the dominant blocker. The swap button is explicitly player-side only.
A DM-PC has no device and no non-DM viewer. The DM viewing the Order Review
screen is `role: 'dm'`, so this guard evaluates to false for everything on
the DM's screen.

**Gate 2 — `isAlertSwapTarget`** (line 261):

```tsx
const isAlertSwapTarget = isPlayerEntry && alertSwapTargets.some(...)
```

Where `alertSwapTargets` (lines 185-190):

```tsx
return players.filter(c =>
  c.id !== myAlertCombatant.id && c.participant_id !== null
)
```

And `myAlertCombatant` (lines 177-182):

```tsx
players.find(c =>
  c.participant_id !== null &&
  alertEnabledParticipantIds.has(c.participant_id) &&
  c.participant_id === me.id
)
```

This requires the viewer's own participant id to match — peer-to-peer between
two players on their own devices. The DM's participant id ≠ Claude's
participant id, so `myAlertCombatant` is null for the DM's screen, making
`alertSwapTargets` empty.

### How the lightning icon renders despite the above

The lightning badge (line ~330-340) only checks `thisHasAlert`:

```tsx
const thisHasAlert = isPlayerEntry && alertEnabledParticipantIds.has(combatant.participant_id ?? '')
```

Where `alertEnabledParticipantIds` is purely participant-based (line 169-173):

```tsx
new Set(participants.filter(p => p.alert_feat && !p.alert_used).map(p => p.id))
```

Once the migration is applied, a DM-PC participant with `alert_feat: true`
would be picked up by this filter — so the ⚡ icon would render. But the
swap button has an entirely separate render guard.

### Impact

Even after the migration is applied, DM-PCs would show the lightning badge
but have no clickable swap button. The DM needs a proxy control to trigger
the swap on behalf of a DM-PC — the current architecture assumes every
Alert Feat holder is at their own device.

---

## Bug 2: HP/max HP settings lost after Start New Combat — but participant row survives

### Database state for RELIC-SUMMIT

```json
// participants — 1 row only
[{
  "id": "8feb31da-...",
  "name": "Dungeon Master",
  "role": "dm",
  "hp_opt_in": false,
  "starting_hp": null,
  "max_hp_participant": null,
  "alert_feat": false,
  "notifications_enabled": true,
  "alert_used": false
}]

// combatants — empty
[]

// combat_state — empty
[]
```

**There is no Claude participant, no Claude combatant, no trace of Claude
at any point in the session's lifecycle.**

This contradicts Jon's report that "Claude's name persists (good)" — the
database proves Claude was never written, which means the name did not and
could not persist either. Claude appeared momentarily on the Roll for
Initiative screen (via the local React state `addPcRows`), but when Jon
clicked "Review the Order", the button call to `submitDMInitiatives` fired
and attempted a `participants.insert({ role: 'dm_pc', ... })`. That insert
was rejected by the database with the `23514` check-constraint violation.
The error handler catches it (`console.error` + `continue`), so the loop
moves on without reporting visible feedback to the user.

### What actually happens step by step

1. DM fills in Claude's row (name, init, HP, Alert Feat) — all local state
2. DM clicks "Review the Order"
3. `submitDMInitiatives` runs — triggers `participants.insert({ role: 'dm_pc', ... })`
4. Postgres returns `23514` — check constraint violation
5. The `if (partErr || !newPart)` catches it, logs `console.error`, and
   `continue`s to the next row
6. `pcInserts` receives nothing for Claude
7. `onReady` fires with an empty `pcInserts` array
8. No combatant is created for Claude
9. Claude doesn't appear in the Order Review or combat — the `addPcRows`
    local state has already reset
10. Start New Combat: combatants deleted, session returns to lobby.
    Participants still has only the Dungeon Master.

Jon's observation that "Claude's name persists" was likely a visual artifact
— the `addPcRows` local state may have briefly shown the filled-in fields
even after the insert failed, creating the impression that Claude had been
created.

### HP settings specifically

Even if the migration were applied, the write and read paths in the code
must be checked:

**Write path (InitiativeEntry.tsx ~line 90-109):**
```ts
{
  session_id: sessionId,
  name,
  role: 'dm_pc',
  hp_opt_in: row.hpEnabled,                                    // true
  starting_hp: row.hpEnabled && row.hp ? parseInt(row.hp) : null,  // 30
  max_hp_participant: row.hpEnabled && row.hp && !row.isMaxHp &&
    row.maxHp ? parseInt(row.maxHp) : row.hpEnabled && row.hp
    ? parseInt(row.hp) : null,                                    // 50
  alert_feat: row.alertFeat,                                   // true
  notifications_enabled: false,
  alert_used: false,
}
```

This writes to the correct columns. ✅

**Read path (LobbyScreen.tsx handleStartCombat ~line 122-133):**
```ts
const playerParts = participants.filter(p => p.role === 'player' || p.role === 'dm_pc')

const combatantRows = playerParts.map(p => ({
  participant_id: p.id,
  hp_enabled:     p.hp_opt_in,                                     // maps correctly
  current_hp:     p.starting_hp,                                    // maps correctly
  max_hp:         p.max_hp_participant ?? p.starting_hp,            // maps correctly (50)
}))
```

The field mapping is correct. The `'dm_pc'` filter is present (added in
this branch's LobbyScreen.tsx change). ✅

**Verdict after migration is applied:** HP settings should carry over
correctly. There is no second write that drops them — the only write is
in `submitDMInitiatives`, and the only read is in `handleStartCombat`.
The mappings are consistent.

---

## Root cause of both bugs

The migration was never applied. Every insert with `role: 'dm_pc'` is
silently rejected by Postgres. The error is caught and logged but no
visible feedback reaches the user. Once the migration is run, both the
participant creation and the HP persistence should work as coded.

The Alert Feat swap button is a separate design issue — even after the
migration, the DM needs a proxy control to trigger swaps for DM-PCs.
That's not a regression or a missing field, it's an architecture gap.
