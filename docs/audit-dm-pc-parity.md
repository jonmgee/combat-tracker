# Audit: DM-Added PC vs Real Player Data Model Parity

Date: 2026-07-03
Author: Geordi (automated audit)
Scope: No code changes — investigation and report only.

---

## 1. Data Structure

Both are stored as `combatants` rows with `kind: 'player'`. The difference is the `participant_id` and whether a `participants` row exists.

| Field | Real Joined Player | DM-Added PC |
|---|---|---|
| `combatants` table | ✅ row | ✅ row |
| `kind` | `'player'` | `'player'` |
| `participant_id` | UUID linking to `participants` row | `null` |
| `participants` row | ✅ (has `hp_opt_in`, `alert_feat`, `notifications_enabled`, `starting_hp`, `max_hp_participant`) | ❌ no `participants` row |
| How created | Lobby's `handleStartCombat` (from participants) or HomeScreen join flow | InitiativeEntry's `pcInserts` array |

Same `Combatant` interface, same table, same kind. The `participant_id` is the identity anchor — non-null = "belongs to a specific person at a device."

---

## 2. `participant_id` — Every Reference

| File | Line | Usage | Impact on DM-added PC |
|---|---|---|---|
| CombatScreen.tsx | 125 | `c.participant_id === me.id` — find "my" combatant for turn notification | N/A (nobody is "me" with null id) |
| CombatScreen.tsx | 200 | `c.participant_id === me.id && kind === 'player'` — late-initiative handler | N/A |
| CombatScreen.tsx | 252 | Sets `participant_id: null` on mid-combat monster summon (insert) | Monsters only |
| CombatScreen.tsx | 378 | `c.participant_id === me.id` — "is it my turn?" check | N/A |
| CombatScreen.tsx | 379 | `c.participant_id === me.id && init === null` — late-joiner detection | N/A |
| HomeScreen.tsx | 133 | `eq('participant_id', participant.id)` — find existing combatant on join | N/A |
| HomeScreen.tsx | 143 | `.is('participant_id', null)` — find unclaimed DM-added PC | **Claims the PC** |
| HomeScreen.tsx | 149 | `update({ participant_id: participant.id })` — claim it | Writes the real id |
| HomeScreen.tsx | 165 | `participant_id: participant.id` — fresh insert for joined player | N/A |
| LobbyScreen.tsx | 125 | `participant_id: p.id` — creating combatant from participant | N/A |
| InitiativeEntry.tsx | 28 | `c.participant_id === me.id` — my combatant for init entry | N/A |
| InitiativeEntry.tsx | 85 | Sets `participant_id: null` — **this is where DM-added PCs are created** | Origin point |
| OrderReviewScreen.tsx | 98 | `c.participant_id === me.id` — player visibility filter | N/A |
| OrderReviewScreen.tsx | 178–180 | `c.participant_id !== null` + `alertEnabledParticipantIds.has(...)` | **Excludes DM-added PCs from Alert Feat** |
| OrderReviewScreen.tsx | 188 | `c.participant_id !== null` — Alert swap target filter | **Excludes DM-added PCs from being swap targets** |
| OrderReviewScreen.tsx | 260 | `combatant.participant_id ?? ''` — Alert button render check | **Excludes DM-added PCs from seeing the button** |

The `participant_id !== null` check is effectively a "is this a real person?" filter in three places — all in Alert Feat logic.

---

## 3. HP Flow — Where It Currently Gets Lost

The HP data *is correctly inserted* into the combatant row by the latest `InitiativeEntry.tsx` payload:

```ts
hp_enabled: row.hpEnabled,
current_hp: row.hpEnabled && row.hp ? parseInt(row.hp) : null,
max_hp:     row.hpEnabled && row.hp ? parseInt(row.hp) : null,
```

**The problem is the rendering gate** in `CombatantCard.tsx:42`:

```ts
const canSeeHP = (isMe && combatant.hp_enabled) || (isDM && isMonster && combatant.hp_enabled)
```

For a DM-added PC (`kind: 'player'`):
- `isMe` → false (no user is attached to `participant_id: null`)
- `isDM && isMonster` → false (kind is `'player'`, not `'monster'`)

**Neither branch fires.** The HPBar never mounts. The data is in the database, the data is in the `combatant` object — but the component refuses to paint it.

Contrast with `GroupCombatantCard.tsx:173`:

```ts
const canSeeHP = isDM && c.hp_enabled
```

This one doesn't check `isMonster`, so a DM-added PC that happens to be rendered as a grouped combatant *would* show its HP. The gap exists only on the individual card path.

**Fix:** one-line addition to the `canSeeHP` condition in `CombatantCard.tsx` — add `(isDM && combatant.kind === 'player' && combatant.hp_enabled)`.

---

## 4. Alert Feat / Player-Count Logic

In `OrderReviewScreen.tsx`:

```ts
const players = combatants.filter(c => c.kind === 'player')

const alertEnabledParticipantIds = participants.filter(p => p.alert_feat && !p.alert_used).map(p => p.id)

const myAlertCombatant = players.find(c =>
  c.participant_id !== null &&                    // ← excludes DM-added PCs
  alertEnabledParticipantIds.has(c.participant_id) &&
  c.participant_id === me.id
)

const alertSwapTargets = players.filter(c =>
  c.id !== myAlertCombatant.id && c.participant_id !== null  // ← excludes DM-added PCs
)
```

`alertEnabledParticipantIds` is built from the `participants` table — DM-added PCs have no participant row, so they can never be in this set. The `participant_id !== null` check then ensures combatants without a participant link are ignored.

**Why this makes sense as-is:** Alert Feat is a player-side toggle stored in participant preferences. A DM-added PC has no device to toggle it and no person to make the choice. Adding Alert Feat eligibility to DM-added PCs would require either:
- Creating phantom `participants` rows (wrong — that's not what participants are), or
- Adding an `alert_feat` field to the `combatants` table (reasonable extension)

The "No other players in this combat" message that fires for DM-added PCs is technically misleading — there *are* player-kind combatants, just none with Alert eligibility.

---

## 5. Start New Combat — Persistence

`handleNewCombat()` does:

```ts
await supabase.from('combatants').delete().eq('session_id', session.id)
// bounces everyone back to lobby
```

All combatants are nuked — real players and DM-added PCs alike. Then the DM hits "Prepare Encounter" in the lobby, which re-creates combatants from the `participants` table:

```ts
const playerParts = participants.filter(p => p.role === 'player')
const combatantRows = playerParts.map(p => ({
  participant_id: p.id
  // ...
}))
```

DM-added PCs survive zero steps of this pipeline because:
1. They have no participant row to be re-derived from
2. Nothing in `handleStartCombat` knows about them
3. Nothing persists their names/initiative/HP across the wipe

Real players survive because their participant rows are permanent and the lobby rebuilds combatants from them. DM-added PCs are ephemeral to a single combat.

---

## 6. Scope Estimate: ~2.5/5

| Item | Fix Size | Nature |
|---|---|---|
| **HPBar on individual DM-PC cards** | 1 line | Add `(isDM && combatant.kind === 'player' && combatant.hp_enabled)` to `canSeeHP` condition in `CombatantCard.tsx` |
| **Alert Feat eligibility** | Medium (3–4 files) | Needs either a per-combatant `alert_feat` field or a data model discussion. Touch `types.ts`, `OrderReviewScreen.tsx`, the insert points, and the lobby toggle. |
| **Persistence across Start New Combat** | Medium (2–3 files) | Needs either a `session_pcs` table or a mechanism to persist DM-added PC names across the combatant wipe. Touch `CombatScreen.tsx` (new-combat handler writes them somewhere), `LobbyScreen.tsx` (reads them back). |
| **Claim mechanic** | ✅ Already works | The `participant_id: null` → claim flow in `HomeScreen.tsx` fires correctly |

**Honest assessment:** Bringing DM-added PCs to full parity with real players doesn't require unifying the data model. They can stay in `combatants` with `participant_id: null`. The work is a set of targeted fixes — add the missing rendering condition (1 line), decide on Alert Feat strategy, and optionally add a persistence table. The biggest discussion point is Alert Feat, which is inherently tied to participant-level preferences. That's a design question, not a complexity question.

The parity gap items aren't structural flaws — they're gaps where code assumes `kind === 'player' + participant_id !== null` = real player, and didn't account for `kind === 'player' + participant_id === null` = DM-controlled player.