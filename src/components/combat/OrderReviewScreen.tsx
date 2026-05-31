import { useMemo, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Combatant, Participant } from '../../types'

interface Props {
  combatants: Combatant[]
  participants: Participant[]
  me: Participant
  sessionId: string
  onBeginCombat: () => void
}

export default function OrderReviewScreen({ combatants, participants: initialParticipants, me, sessionId, onBeginCombat }: Props) {
  const isDM = me.role === 'dm'

  // ── Fresh participant data — fetch directly so lobby toggles are always current ──
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  useEffect(() => {
    supabase.from('participants')
      .select('*')
      .eq('session_id', sessionId)
      .then(({ data }) => { if (data) setParticipants(data as Participant[]) })
  }, [sessionId])

  // ── Live participant data for this user (captures lobby toggles) ──
  const meRefreshed = useMemo(
    () => participants.find(p => p.id === me.id) ?? me,
    [participants, me]
  )

  // DM sees everything (including hidden monsters); players only see non-hidden + themselves
  const visible = isDM
    ? combatants
    : combatants.filter(c => !c.is_hidden || c.participant_id === me.id)
  const players = visible.filter(c => c.kind === 'player')

  // ── Tie detection for DM nudges ──
  function getInit(combatant: Combatant): number | null {
    return combatant.initiative ?? null
  }

  function tiedAbove(combatant: Combatant, list: Combatant[]): boolean {
    const idx = list.indexOf(combatant)
    if (idx <= 0) return false
    return getInit(list[idx - 1]) !== null && getInit(list[idx - 1]) === getInit(combatant)
  }

  function tiedBelow(combatant: Combatant, list: Combatant[]): boolean {
    const idx = list.indexOf(combatant)
    if (idx < 0 || idx >= list.length - 1) return false
    return getInit(list[idx + 1]) !== null && getInit(list[idx + 1]) === getInit(combatant)
  }

  async function swapBlock(listIdx: number, swapIdx: number) {
    // Swap the initiative values of two combatants (not initiative_order — those get reassigned)
    const c1 = visible[listIdx]
    const c2 = visible[swapIdx]
    if (!c1 || !c2) return

    const i1 = c1.initiative
    const i2 = c2.initiative

    await supabase.from('combatants').update({ initiative: i2 }).eq('id', c1.id)
    await supabase.from('combatants').update({ initiative: i1 }).eq('id', c2.id)

    // Trigger reload via parent subscription
  }

  // ── Alert swap ──
  // Participant IDs that have Alert and haven't used it yet
  const alertEnabledParticipantIds = useMemo(
    () => new Set(
      participants
        .filter(p => p.alert_feat && !p.alert_used)
        .map(p => p.id)
    ),
    [participants]
  )

  // My combatant — only if I have Alert and haven't used it
  const myAlertCombatant = useMemo(
    () => players.find(c =>
      c.participant_id !== null &&
      alertEnabledParticipantIds.has(c.participant_id) &&
      c.participant_id === me.id
    ),
    [players, alertEnabledParticipantIds, me.id]
  )

  // Swap targets: any PC who is NOT me (they don't need Alert — I'm the one swapping)
  const alertSwapTargets = useMemo(() => {
    if (!myAlertCombatant) return []
    return players.filter(c =>
      c.id !== myAlertCombatant.id &&
      c.participant_id !== null
    )
  }, [players, myAlertCombatant])

  async function handleAlertSwap(targetId: string) {
    if (!myAlertCombatant) return
    const target = players.find(c => c.id === targetId)
    if (!target) return

    const myInit = myAlertCombatant.initiative
    const targetInit = target.initiative
    if (myInit === null || targetInit === null) return

    // Swap initiative values in DB
    await supabase.from('combatants').update({ initiative: targetInit }).eq('id', myAlertCombatant.id)
    await supabase.from('combatants').update({ initiative: myInit }).eq('id', target.id)

    // Mark me as used (target doesn't need Alert — they just let me swap)
    await supabase.from('participants').update({ alert_used: true }).eq('id', meRefreshed.id)
  }

  // ── Render a single combatant row ──
  function renderRow(c: Combatant, idx: number, list: Combatant[]) {
    const isPlayer = c.kind === 'player'
    const isMonster = c.kind === 'monster'
    const initStr = c.initiative !== null ? c.initiative.toString() : '—'
    const tUp = isDM && tiedAbove(c, list)
    const tDown = isDM && tiedBelow(c, list)

    // Alert: does this combatant have Alert, haven't used it, and is me?
    const thisHasAlert = alertEnabledParticipantIds.has(c.participant_id ?? '')
    const isAlertSwapTarget = alertSwapTargets.some(t => t.id === c.id)

    return (
      <div
        key={c.id}
        className="flex items-center gap-3 px-5 py-3 border-t transition-all"
        style={{
          borderColor: 'var(--border)',
          background: isActiveCard(idx, list) ? 'rgba(201,168,76,0.04)' : 'transparent',
        }}
      >
        {/* Tie nudge arrows (DM only) */}
        <div className="flex flex-col items-center shrink-0" style={{ width: 16 }}>
          {tUp && (
            <button
              onClick={() => swapBlock(idx, idx - 1)}
              className="cursor-pointer transition-colors hover:opacity-70"
              style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', padding: 0, lineHeight: 1, fontSize: '0.6rem' }}
            >▲</button>
          )}
          {tDown && (
            <button
              onClick={() => swapBlock(idx, idx + 1)}
              className="cursor-pointer transition-colors hover:opacity-70"
              style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', padding: 0, lineHeight: 1, fontSize: '0.6rem' }}
            >▼</button>
          )}
        </div>

        {/* Position number */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: isPlayer ? 'var(--bg-raised)' : 'rgba(0,0,0,0.3)',
            color: isPlayer ? 'var(--gold)' : 'var(--text-dim)',
            border: `1px solid ${isPlayer ? 'var(--gold-dark)' : 'var(--border)'}`,
            fontFamily: "'Cinzel', serif",
          }}
        >
          {idx + 1}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-medium truncate"
              style={{
                color: isPlayer ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: "'Cinzel', serif",
                fontSize: '0.9rem',
              }}
            >
              {c.name}
            </span>
            {isMonster && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>👹</span>}
            {isMonster && c.is_hidden && isDM && (
              <span className="text-xs px-1 py-0.5 rounded" style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                fontSize: '0.5rem',
                letterSpacing: '0.08em',
              }}>HIDDEN</span>
            )}
          </div>
        </div>

        {/* Alert eligible indicator (DM) — player has Alert toggled */}
        {isDM && isPlayer && thisHasAlert && (
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'rgba(201,168,76,0.1)',
              color: 'var(--gold-dark)',
              border: '1px solid var(--gold-dark)',
              fontSize: '0.55rem',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}>
            ⚡
          </span>
        )}

        {/* Alert swap button (player, not DM) */}
        {!isDM && isAlertSwapTarget && (
          <button
            onClick={() => handleAlertSwap(c.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all active:scale-95"
            style={{
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid var(--gold-dark)',
              color: 'var(--gold)',
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              fontWeight: 600,
            }}
          >
            ↔ Swap
          </button>
        )}

        {/* Initiative value */}
        <div className="shrink-0 text-right min-w-[36px]">
          <div className="text-sm font-bold" style={{
            color: isPlayer ? 'var(--gold)' : 'var(--text-secondary)',
            fontFamily: "'Cinzel', serif",
            fontSize: '0.95rem',
          }}>
            {initStr}
          </div>
        </div>
      </div>
    )
  }

  // Simple alternating active-card shading for review (highest init first)
  function isActiveCard(idx: number, _list: Combatant[]) {
    return idx === 0 || idx === 1
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-void)' }}>

      {/* ── Begin Combat button (DM only) ── */}
      {isDM && (
        <div className="sticky top-0 z-20 px-5 py-3" style={{
          background: 'linear-gradient(to bottom, var(--bg-void) 0%, transparent 100%)',
        }}>
          <button
            onClick={onBeginCombat}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-150 active:scale-95 hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
              color: '#1a1410',
              fontFamily: "'Cinzel', serif",
              letterSpacing: '0.08em',
              boxShadow: '0 4px 20px rgba(201,168,76,0.5)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ⚔️  Begin Combat
          </button>
        </div>
      )}

      {/* ── Order display ── */}
      <div className="flex-1 overflow-auto py-4">
        <div className="max-w-md mx-auto px-4">

          <div className="rounded-xl parchment" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            {/* Header */}
            <div className="px-5 pt-5 pb-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="text-xs uppercase tracking-widest block" style={{ color: 'var(--text-dim)' }}>Initiative Order</span>
                <span className="text-xs mt-1 block" style={{ color: 'var(--text-dim)' }}>
                  {isDM ? 'Drag/swap tied dice, begin when ready' : 'Locked in — waiting for DM'}
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-raised)', color: 'var(--gold)', border: '1px solid var(--border)' }}>
                {visible.length}
              </span>
            </div>

            {/* Combatant rows */}
            {visible.length === 0 && (
              <div className="px-5 py-8 text-center" style={{ color: 'var(--text-dim)' }}>
                <p style={{ fontFamily: "'Cinzel', serif" }}>No combatants yet</p>
              </div>
            )}
            {visible.map((c, idx) => renderRow(c, idx, visible))}
          </div>

          {/* ── Alert swap info (players only) ── */}
          {!isDM && meRefreshed.alert_feat && (
            <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--bg-panel)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 12px rgba(201,168,76,0.1)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span>⚡</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--gold)', fontFamily: "'Cinzel', serif" }}>
                  Alert Feat
                </span>
              </div>
              {meRefreshed.alert_used ? (
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  Swapped! Your Alert feat has been used for this encounter.
                </p>
              ) : alertSwapTargets.length > 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  You can swap initiative with another player. Tap ↔ Swap next to their name above.
                </p>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  No other players in this combat. Your Alert feat will be available next time.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
