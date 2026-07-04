import { useMemo, useEffect, useState } from 'react'
import lockedIcon from '../../assets/lockedin.png'
import crossedAxes from '../../assets/crossedaxes.png'
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
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)

  // Sync parent-props -> local state so updates pushed from CombatScreen are reflected here
  useEffect(() => { setCombatants(initialCombatants) }, [initialCombatants])
  useEffect(() => { setParticipants(initialParticipants) }, [initialParticipants])

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
  useEffect(() => {
    let mounted = true

    // Fetch once up-front
    const fetchParticipants = () => {
      supabase.from('participants')
        .select('*')
        .eq('session_id', sessionId)
        .then(({ data }) => { if (data && mounted) setParticipants(data as Participant[]) })
    }

    fetchParticipants()

    // Subscribe to participant changes for this session so lobby toggles (Alert, etc.) show up live
    const channel = supabase.channel(`participants:session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` }, () => {
        fetchParticipants()
      })
      .subscribe()

    // Defensive: also subscribe to combat_state changes directly so this view refreshes when others touch combat_state
    const cs = supabase.channel(`combat_state:session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_state', filter: `session_id=eq.${sessionId}` }, (payload) => {
        console.debug('[OrderReview][realtime][combat_state] payload', payload)
        reloadCombatants()
      })
      .subscribe()

    return () => {
      mounted = false
      try { supabase.removeChannel(channel) } catch (e) { /* ignore on cleanup */ }
      try { supabase.removeChannel(cs) } catch (e) { /* ignore */ }
    }
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

  // ── DM Alert proxy state ──
  // When the DM clicks ⚡ on a DM-PC row, this holds that participant_id.
  // While active, ↔ Swap buttons appear on eligible targets for the DM to click.
  const [dmSwapActive, setDmSwapActive] = useState<string | null>(null)

  const dmAlertCombatant = useMemo(
    () => isDM && dmSwapActive
      ? players.find(c => c.participant_id === dmSwapActive) ?? null
      : null,
    [players, isDM, dmSwapActive]
  )

  const dmAlertSwapTargets = useMemo(() => {
    if (!dmAlertCombatant) return []
    return players.filter(c =>
      c.id !== dmAlertCombatant.id && c.participant_id !== null
    )
  }, [players, dmAlertCombatant])

  // ── Core swap logic (shared between player and DM-proxy paths) ──
  async function performAlertSwap(
    sourceCombatant: Combatant,
    targetCombatant: Combatant,
    sourceParticipantId: string
  ) {
    const sourceInit = sourceCombatant.initiative
    const targetInit = targetCombatant.initiative
    if (sourceInit === null || targetInit === null) return

    // Swap initiative values
    await supabase.from('combatants').update({ initiative: targetInit }).eq('id', sourceCombatant.id)
    await supabase.from('combatants').update({ initiative: sourceInit }).eq('id', targetCombatant.id)
    // Mark alert used for this participant
    await supabase.from('participants').update({ alert_used: true }).eq('id', sourceParticipantId)

    console.debug('[OrderReview] swapped initiatives, recalculating orders')
    // Recalculate grouped initiative_order immediately so the pre-combat order reflects the swap
    const { data: allCombatants } = await supabase.from('combatants')
      .select('*')
      .eq('session_id', sessionId)
      .order('initiative', { ascending: false })

    if (allCombatants && allCombatants.length > 0) {
      const fresh = [...(allCombatants as Combatant[])]
      let order = 0
      for (let i = 0; i < fresh.length; i++) {
        const c = fresh[i]
        const prev = fresh[i - 1]
        const sameGroup = prev &&
          c.kind === 'monster' &&
          prev.kind === 'monster' &&
          c.name === prev.name &&
          c.initiative === prev.initiative
        if (!sameGroup) order++

        const newOrder = order
        if ((c.initiative_order ?? 0) !== newOrder) {
          await supabase.from('combatants').update({ initiative_order: newOrder }).eq('id', c.id)
        }
      }
    }

    // Reload client state
    reloadCombatants()
    // Refresh participants so alert_used state updates immediately
    supabase.from('participants').select('*').eq('session_id', sessionId)
      .then(({ data }) => { if (data) setParticipants(data as Participant[]) })

    console.debug('[OrderReview] touching combat_state.updated_at to trigger reloads')
    await supabase.from('combat_state').update({ updated_at: new Date().toISOString() }).eq('session_id', sessionId)
  }

  async function handleAlertSwap(targetId: string) {
    console.debug('[OrderReview] handleAlertSwap start', { targetId })
    if (!myAlertCombatant) return
    const target = players.find(c => c.id === targetId)
    if (!target) return
    await performAlertSwap(myAlertCombatant, target, meRefreshed.id)
    console.debug('[OrderReview] handleAlertSwap complete')
  }

  async function handleDmAlertSwap(targetId: string) {
    console.debug('[OrderReview] handleDmAlertSwap start', { targetId, dmSwapActive })
    if (!dmAlertCombatant) return
    const target = players.find(c => c.id === targetId)
    if (!target) return
    await performAlertSwap(dmAlertCombatant, target, dmSwapActive!)
    setDmSwapActive(null) // reset proxy after swap completes
    console.debug('[OrderReview] handleDmAlertSwap complete')
  }

  // ── Render a grouped entry row ──
  function renderEntry(entry: GroupedEntry, idx: number) {
    const isPlayerEntry = entry.type === 'player'
    const combatant = isPlayerEntry ? entry.combatant : entry.combatants[0]
    const initStr = getGroupInit(entry)?.toString() ?? '—'
    const tUp = isDM && tiedAbove(idx)
    const tDown = isDM && tiedBelow(idx)

    const thisHasAlert = isPlayerEntry && alertEnabledParticipantIds.has(combatant.participant_id ?? '')
    const isDmProxyActive = isDM && dmSwapActive !== null && dmSwapActive === combatant.participant_id
    const isAlertSwapTarget = isPlayerEntry && (
      (!isDM && alertSwapTargets.some(t => t.id === combatant.id)) ||
      (isDM && dmAlertSwapTargets.some(t => t.id === combatant.id))
    )

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

        {/* Alert eligible indicator (DM) — clickable button for DM-PC proxy swap */}
        {isDM && isPlayerEntry && thisHasAlert && (
          <button
            onClick={() => {
              // Clicking the active PC cancels; clicking a different one activates it
              if (isDmProxyActive) {
                setDmSwapActive(null)
              } else {
                setDmSwapActive(combatant.participant_id)
              }
            }}
            className="text-xs px-1.5 py-0.5 rounded transition-all active:scale-95"
            style={{
              background: isDmProxyActive ? 'rgba(201,168,76,0.25)' : 'rgba(201,168,76,0.1)',
              color: isDmProxyActive ? 'var(--gold)' : 'var(--gold-dark)',
              border: isDmProxyActive ? '1px solid var(--gold)' : '1px solid var(--gold-dark)',
              boxShadow: isDmProxyActive ? '0 0 10px rgba(201,168,76,0.4)' : 'none',
              fontSize: '0.55rem',
              letterSpacing: '0.08em',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isDmProxyActive ? '⚡ Cancel' : '⚡'}
          </button>
        )}

        {/* Alert swap button (player, not DM) — or DM proxy swap button */}
        {isAlertSwapTarget && (
          isDM ? (
            <button
              onClick={() => handleDmAlertSwap(combatant.id)}
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
          ) : (
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
          )
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

      {/* Begin Combat button removed from top; placed below the list to make room for hero */}

      {/* ── Order display ── */}
      <div className="flex-1 overflow-auto py-4">
        <div className="max-w-md mx-auto px-4">
          {/* Hero: image, heading, subheading — sits on the page above the boxed list */}
          <div className="text-center mb-6 fade-in">
            <div className="mb-4 flex justify-center">
              <img src={lockedIcon} alt="Locked In" className="w-36" style={{ maxWidth: '90vw', filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.5))' }} />
            </div>
            <h1 className="text-3xl font-bold tracking-wider" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', textShadow: '0 0 16px rgba(201,168,76,0.4)' }}>
              Locked In
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
              Waiting for the Dungeon Master...
            </p>
          </div>

          <div className="rounded-xl parchment" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            {/* Header */}
            <div className="px-5 pt-5 pb-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="text-xs uppercase tracking-widest block" style={{ color: 'var(--text-dim)' }}>Initiative Order</span>
              </div>
            </div>

            {/* Entry rows */}
            {groupedVisible.length === 0 && (
              <div className="px-5 py-8 text-center" style={{ color: 'var(--text-dim)' }}>
                <p style={{ fontFamily: "'Cinzel', serif" }}>No combatants yet</p>
              </div>
            )}
            {groupedVisible.map((entry, idx) => renderEntry(entry, idx))}
          </div>

          {/* Begin Combat button (DM only) placed under the list as a large pill */}
          {isDM && (
            <div className="mt-4 px-0">
              <button onClick={onBeginCombat}
                className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-150 active:scale-95 hover:brightness-110 flex items-center justify-center gap-3"
                style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif", letterSpacing: '0.08em', boxShadow: '0 4px 20px rgba(201,168,76,0.4)', border: 'none', cursor: 'pointer' }}>
                <img src={crossedAxes} alt="axes" className="h-10 transform" />
                Let Battle Commence
              </button>
            </div>
          )}

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
