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

type GroupedEntry =
  | { type: 'player'; combatant: Combatant }
  | { type: 'monster'; combatants: Combatant[]; name: string; count: number; initiative: number; isHidden: boolean }

export default function OrderReviewScreen({ combatants: initialCombatants, participants: initialParticipants, me, sessionId, onBeginCombat }: Props) {
  const isDM = me.role === 'dm'

  // ── Own combatants state — re-fetched after every swap/nudge so screen stays in sync ──
  const [combatants, setCombatants] = useState<Combatant[]>(initialCombatants)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    supabase.from('combatants')
      .select('*')
      .eq('session_id', sessionId)
      .order('initiative_order', { ascending: true })
      .then(({ data }) => {
        if (data) {
          // Client-side sort: initiative desc, then initiative_order as tiebreaker
          const sorted = [...(data as Combatant[])].sort((a, b) => {
            const ia = a.initiative ?? -1
            const ib = b.initiative ?? -1
            if (ib !== ia) return ib - ia
            return (a.initiative_order ?? 0) - (b.initiative_order ?? 0)
          })
          setCombatants(sorted)
        }
      })
  }, [sessionId, revision])

  function reloadCombatants() {
    setRevision(r => r + 1)
  }

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

  // ── Grouped rows: players individually, same-name same-initiative monsters as one entry ──
  const groupedVisible = useMemo(() => {
    const raw = isDM ? combatants : combatants.filter(c => !c.is_hidden || c.participant_id === me.id)
    const groups: GroupedEntry[] = []
    let i = 0
    while (i < raw.length) {
      const c = raw[i]
      if (c.kind === 'player') {
        groups.push({ type: 'player', combatant: c })
        i++
      } else {
        let j = i + 1
        while (
          j < raw.length &&
          raw[j].kind === 'monster' &&
          raw[j].name === c.name &&
          raw[j].initiative === c.initiative
        ) { j++ }
        groups.push({
          type: 'monster',
          combatants: raw.slice(i, j),
          name: c.name,
          count: j - i,
          initiative: c.initiative ?? 0,
          isHidden: c.is_hidden,
        })
        i = j
      }
    }
    return groups
  }, [combatants, isDM, me.id])

  // Players as individual combatants (for Alert swap logic)
  const players = combatants.filter(c => c.kind === 'player')

  function getGroupInit(entry: GroupedEntry): number | null {
    if (entry.type === 'player') return entry.combatant.initiative ?? null
    return entry.initiative
  }

  function tiedAbove(idx: number): boolean {
    if (idx <= 0) return false
    const a = getGroupInit(groupedVisible[idx])
    const b = getGroupInit(groupedVisible[idx - 1])
    return a !== null && a === b
  }

  function tiedBelow(idx: number): boolean {
    if (idx >= groupedVisible.length - 1) return false
    const a = getGroupInit(groupedVisible[idx])
    const b = getGroupInit(groupedVisible[idx + 1])
    return a !== null && a === b
  }

  async function swapBlock(listIdx: number, swapIdx: number) {
    const entry1 = groupedVisible[listIdx]
    const entry2 = groupedVisible[swapIdx]
    if (!entry1 || !entry2) return

    // Swap initiative_order values (effectively trading places in turn order)
    const order1 = entry1.type === 'player' ? entry1.combatant.initiative_order : entry1.combatants[0].initiative_order
    const order2 = entry2.type === 'player' ? entry2.combatant.initiative_order : entry2.combatants[0].initiative_order
    if (order1 === null || order2 === null) return

    const ids1 = entry1.type === 'player' ? [entry1.combatant.id] : entry1.combatants.map(c => c.id)
    const ids2 = entry2.type === 'player' ? [entry2.combatant.id] : entry2.combatants.map(c => c.id)

    for (const id of ids1) await supabase.from('combatants').update({ initiative_order: order2 }).eq('id', id)
    for (const id of ids2) await supabase.from('combatants').update({ initiative_order: order1 }).eq('id', id)
    reloadCombatants()
  }

  // ── Alert swap ──
  const alertEnabledParticipantIds = useMemo(
    () => new Set(
      participants.filter(p => p.alert_feat && !p.alert_used).map(p => p.id)
    ),
    [participants]
  )

  const myAlertCombatant = useMemo(
    () => players.find(c =>
      c.participant_id !== null &&
      alertEnabledParticipantIds.has(c.participant_id) &&
      c.participant_id === me.id
    ),
    [players, alertEnabledParticipantIds, me.id]
  )

  const alertSwapTargets = useMemo(() => {
    if (!myAlertCombatant) return []
    return players.filter(c =>
      c.id !== myAlertCombatant.id && c.participant_id !== null
    )
  }, [players, myAlertCombatant])

  async function handleAlertSwap(targetId: string) {
    if (!myAlertCombatant) return
    const target = players.find(c => c.id === targetId)
    if (!target) return
    const myInit = myAlertCombatant.initiative
    const targetInit = target.initiative
    if (myInit === null || targetInit === null) return

    await supabase.from('combatants').update({ initiative: targetInit }).eq('id', myAlertCombatant.id)
    await supabase.from('combatants').update({ initiative: myInit }).eq('id', target.id)
    await supabase.from('participants').update({ alert_used: true }).eq('id', meRefreshed.id)
    reloadCombatants()
    // Refresh participants so alert_used state updates immediately
    supabase.from('participants').select('*').eq('session_id', sessionId)
      .then(({ data }) => { if (data) setParticipants(data as Participant[]) })
  }

  // ── Render a grouped entry row ──
  function renderEntry(entry: GroupedEntry, idx: number) {
    const isPlayerEntry = entry.type === 'player'
    const combatant = isPlayerEntry ? entry.combatant : entry.combatants[0]
    const initStr = getGroupInit(entry)?.toString() ?? '—'
    const tUp = isDM && tiedAbove(idx)
    const tDown = isDM && tiedBelow(idx)

    const thisHasAlert = isPlayerEntry && alertEnabledParticipantIds.has(combatant.participant_id ?? '')
    const isAlertSwapTarget = isPlayerEntry && alertSwapTargets.some(t => t.id === combatant.id)

    return (
      <div
        key={combatant.id}
        className="flex items-center gap-3 px-5 py-3 border-t transition-all"
        style={{
          borderColor: 'var(--border)',
          background: idx === 0 || idx === 1 ? 'rgba(201,168,76,0.04)' : 'transparent',
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
            background: isPlayerEntry ? 'var(--bg-raised)' : 'rgba(0,0,0,0.3)',
            color: isPlayerEntry ? 'var(--gold)' : 'var(--text-dim)',
            border: `1px solid ${isPlayerEntry ? 'var(--gold-dark)' : 'var(--border)'}`,
            fontFamily: "'Cinzel', serif",
          }}
        >
          {idx + 1}
        </div>

        {/* Name + count badge for monsters */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-medium truncate"
              style={{
                color: isPlayerEntry ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: "'Cinzel', serif",
                fontSize: '0.9rem',
              }}
            >
              {isPlayerEntry ? combatant.name : entry.name}
            </span>
            {!isPlayerEntry && (
              <>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>👹</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>×{entry.count}</span>
                {entry.isHidden && isDM && (
                  <span className="text-xs px-1 py-0.5 rounded" style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text-dim)',
                    border: '1px solid var(--border)',
                    fontSize: '0.5rem',
                    letterSpacing: '0.08em',
                  }}>HIDDEN</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Alert eligible indicator (DM) — player has Alert toggled */}
        {isDM && isPlayerEntry && thisHasAlert && (
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
            onClick={() => handleAlertSwap(combatant.id)}
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
            color: isPlayerEntry ? 'var(--gold)' : 'var(--text-secondary)',
            fontFamily: "'Cinzel', serif",
            fontSize: '0.95rem',
          }}>
            {initStr}
          </div>
        </div>
      </div>
    )
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
            ⚔️  Let Battle Commence
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
                {groupedVisible.length}
              </span>
            </div>

            {/* Entry rows */}
            {groupedVisible.length === 0 && (
              <div className="px-5 py-8 text-center" style={{ color: 'var(--text-dim)' }}>
                <p style={{ fontFamily: "'Cinzel', serif" }}>No combatants yet</p>
              </div>
            )}
            {groupedVisible.map((entry, idx) => renderEntry(entry, idx))}
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
                  You may swap your initiative with a willing ally. Tap ↔ Swap next to their name above.
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
