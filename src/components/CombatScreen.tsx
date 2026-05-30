import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fireLocalNotification } from '../lib/notifications'
import InitiativeEntry from './combat/InitiativeEntry'
import CombatantCard from './combat/CombatantCard'
import LanternColumn from './combat/LanternColumn'
import GroupCombatantCard from './combat/GroupCombatantCard'
import type { Session, Participant, Combatant, CombatState, Condition } from '../types'
 
interface Props {
  session: Session
  me: Participant
  initialState: CombatState
}
 
export default function CombatScreen({ session, me, initialState }: Props) {
  const [combatState, setCombatState]   = useState<CombatState>(initialState)
  const [combatants, setCombatants]     = useState<Combatant[]>([])
  const [conditions, setConditions]     = useState<Condition[]>([])
  const [advancing, setAdvancing]       = useState(false)
  const [lateInit, setLateInit]         = useState('')
  const [lateInitSaving, setLateInitSaving] = useState(false)
 
  const isDM = me.role === 'dm'
  const subPaused = useRef(false)
 
  // ── Load combatants ──
  const loadCombatants = useCallback(async () => {
    const { data } = await supabase
      .from('combatants')
      .select('*')
      .eq('session_id', session.id)
      .order('initiative_order', { ascending: true })
    if (data) setCombatants(data as Combatant[])
  }, [session.id])
 
  // ── Load conditions (fetches combatant IDs from DB to avoid depending on state) ──
  const loadConditions = useCallback(async () => {
    const { data: combatantIds } = await supabase
      .from('combatants')
      .select('id')
      .eq('session_id', session.id)
    if (!combatantIds || combatantIds.length === 0) {
      setConditions([])
      return
    }
    const { data } = await supabase
      .from('conditions')
      .select('*')
      .in('combatant_id', combatantIds.map(c => c.id))
    if (data) setConditions(data as Condition[])
  }, [session.id])
 
  useEffect(() => { loadCombatants() }, [loadCombatants])
  useEffect(() => { loadConditions() }, [loadConditions])
 
  // ── Real-time: combat state ──
  const combatantsRef = useRef(combatants)
  combatantsRef.current = combatants

  useEffect(() => {
    const channel = supabase.channel(`combat_state:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_state', filter: `session_id=eq.${session.id}` }, (payload) => {
        const next = payload.new as CombatState
        setCombatState(next)
        // Notify player if it's now their turn — use ref to avoid dep on combatants
        if (!isDM && next.current_combatant_id) {
          const currentCombatants = combatantsRef.current
          const myCombatant = currentCombatants.find(c => c.participant_id === me.id)
          if (myCombatant && next.current_combatant_id === myCombatant.id) {
            fireLocalNotification('⚔️ Your Turn!', "It's your turn in combat!")
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, isDM, me.id])
 
  // ── Real-time: combatants ──
  useEffect(() => {
    const channel = supabase.channel(`combatants:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combatants', filter: `session_id=eq.${session.id}` }, () => {
        if (!subPaused.current) loadCombatants()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, loadCombatants])
 
  // ── Real-time: conditions ──
  useEffect(() => {
    const channel = supabase.channel(`conditions:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conditions' }, () => {
        loadConditions()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, loadConditions])
 
  // ── Late-joiner submits initiative ──
  async function handleLateInitiative() {
    const val = parseInt(lateInit)
    if (isNaN(val)) return
    setLateInitSaving(true)

    const myCombatant = combatants.find(c => c.participant_id === me.id && c.kind === 'player')
    if (!myCombatant) { setLateInitSaving(false); return }

    // Update initiative on the combatant
    await supabase.from('combatants').update({ initiative: val }).eq('id', myCombatant.id)

    // Re-fetch all combatants with initiatives to recalculate order
    const { data: fresh } = await supabase.from('combatants')
      .select('*')
      .eq('session_id', session.id)
    if (fresh) {
      // Sort all by initiative descending, 0 values last
      const sorted = fresh
        .filter(c => c.initiative !== null)
        .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))

      // Reassign initiative_order
      for (let i = 0; i < sorted.length; i++) {
        await supabase.from('combatants').update({ initiative_order: i + 1 }).eq('id', sorted[i].id)
      }

      setCombatants(fresh as Combatant[])
    }

    setLateInit('')
    setLateInitSaving(false)
  }

  // ── Advance turn (DM only) ──
  async function advanceTurn() {
    if (!isDM || advancing) return
    setAdvancing(true)
 
    const ordered = [...combatants].sort((a, b) => (a.initiative_order ?? 0) - (b.initiative_order ?? 0))
    const currentIdx = ordered.findIndex(c => c.id === combatState.current_combatant_id)
    const nextIdx    = (currentIdx + 1) % ordered.length
    const next       = ordered[nextIdx]
    const newRound   = nextIdx === 0 ? combatState.round_number + 1 : combatState.round_number
 
    // If next is a hidden monster, reveal it (first turn rule)
    if (next.is_hidden) {
      await supabase.from('combatants').update({ is_hidden: false, has_taken_turn: true }).eq('id', next.id)
    } else if (next.kind === 'monster' && !next.has_taken_turn) {
      await supabase.from('combatants').update({ has_taken_turn: true }).eq('id', next.id)
    }
 
    await supabase.from('combat_state').update({
      current_combatant_id: next.id,
      round_number: newRound,
      updated_at: new Date().toISOString(),
    }).eq('session_id', session.id)
 
    setAdvancing(false)
  }
 
  // ── Initiative entry phase ──
  if (combatState.phase === 'initiative') {
    return (
      <InitiativeEntry
        sessionId={session.id}
        combatants={combatants}
        me={me}
        onReady={async () => {
          // Pause subscription-driven loads while we set up the combat order
          subPaused.current = true

          // Fetch ALL combatants fresh (monsters were just inserted, not in closed-over state)
          const { data: fresh } = await supabase.from('combatants')
            .select('*').eq('session_id', session.id)

          // Sort: players with no initiative sink to the bottom
          const sorted = (fresh ?? [])
            .sort((a, b) => {
              const ia = a.initiative ?? -1
              const ib = b.initiative ?? -1
              return ib - ia
            })

          for (let i = 0; i < sorted.length; i++) {
            await supabase.from('combatants').update({ initiative_order: i + 1 }).eq('id', sorted[i].id)
          }

          setCombatants(sorted)

          // Re-enable subscriptions
          subPaused.current = false

          if (sorted.length > 0) {
            const first = sorted[0]
            // If the first combatant is a hidden monster, reveal it immediately
            if (first.is_hidden || (first.kind === 'monster' && !first.has_taken_turn)) {
              await supabase.from('combatants').update({ is_hidden: false, has_taken_turn: true }).eq('id', first.id)
            }
            await supabase.from('combat_state').update({
              phase: 'active',
              current_combatant_id: first.id,
              updated_at: new Date().toISOString(),
            }).eq('session_id', session.id)
          }
        }}
      />
    )
  }
 
  // ── Active combat ──
  const visibleCombatants = isDM
    ? combatants
    : combatants.filter(c => !c.is_hidden || c.kind === 'player')

  // ── Group adjacent same-name monsters ──
  const groupedCombatants = useMemo(() => {
    type GroupedEntry =
      | { type: 'single'; combatant: Combatant }
      | { type: 'group'; combatants: Combatant[]; name: string; initiative: number }
    const groups: GroupedEntry[] = []
    let i = 0
    while (i < visibleCombatants.length) {
      const c = visibleCombatants[i]
      if (c.kind === 'monster') {
        // Walk forward to collect same-name monsters
        let j = i + 1
        while (j < visibleCombatants.length &&
               visibleCombatants[j].kind === 'monster' &&
               visibleCombatants[j].name === c.name) {
          j++
        }
        const count = j - i
        if (count > 1) {
          groups.push({
            type: 'group',
            combatants: visibleCombatants.slice(i, j),
            name: c.name,
            initiative: c.initiative ?? 0,
          })
        } else {
          groups.push({ type: 'single', combatant: c })
        }
        i = j
      } else {
        groups.push({ type: 'single', combatant: c })
        i++
      }
    }
    return groups
  }, [visibleCombatants])
 
  const currentCombatant = combatants.find(c => c.id === combatState.current_combatant_id)
  const isMyTurn = !!combatants.find(c => c.id === combatState.current_combatant_id && c.participant_id === me.id)
  const myCombatantNoInit = !isDM && !!combatants.find(c => c.participant_id === me.id && c.initiative === null && c.kind === 'player')
 
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-void)' }}>
 
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-5 py-3 flex items-center justify-between"
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        <div>
          <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Round</div>
          <div className="text-3xl font-bold" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', lineHeight: 1 }}>
            {combatState.round_number}
          </div>
        </div>
 
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Now Acting</div>
          <div className="text-sm font-semibold" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold-light)' }}>
            {currentCombatant?.name ?? '—'}
          </div>
        </div>
 
        <div className="text-right">
          <div className="text-xs mb-1 uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {session.room_code}
          </div>
          {isDM && (
            <button
              onClick={advanceTurn}
              disabled={advancing}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
            >
              {advancing ? '…' : 'Next ▶'}
            </button>
          )}
        </div>
      </div>
 
      {/* ── Late-joiner initiative prompt ── */}
      {!isDM && myCombatantNoInit && (
        <div
          className="px-5 py-4 text-center"
          style={{ background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid var(--gold-dark)' }}
        >
          <p style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', fontSize: '0.9rem', marginBottom: 8 }}>
            ⚔️  Roll Initiative — you joined mid-combat!
          </p>
          <div className="flex justify-center gap-2">
            <input
              type="number"
              min={1} max={30}
              value={lateInit}
              onChange={e => setLateInit(e.target.value)}
              placeholder="Roll"
              className="w-20 px-3 py-2 rounded text-center text-lg outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
            />
            <button
              onClick={handleLateInitiative}
              disabled={lateInitSaving}
              className="px-4 py-2 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
            >
              {lateInitSaving ? '…' : 'Set'}
            </button>
          </div>
        </div>
      )}

      {/* ── Your turn banner (players) ── */}
      {!isDM && isMyTurn && (
        <div
          className="px-5 py-3 text-center candle-flicker"
          style={{ background: 'rgba(201,168,76,0.12)', borderBottom: '1px solid var(--gold-dark)' }}
        >
          <span style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.08em' }}>
            ⚔️  It's your turn!
          </span>
        </div>
      )}
 
      {/* ── Combatant list with lantern ── */}
      <div className="flex-1 overflow-auto py-4">
        <div className="relative px-4" id="combatant-list-wrap" style={{ paddingLeft: '56px' }}>
 
          {/* Lantern — tracks active card position */}
          <LanternColumnWrapper
            combatants={visibleCombatants}
            activeId={combatState.current_combatant_id}
          />
 
          <div className="flex flex-col gap-3">
            {(() => {
              let idx = 0
              return groupedCombatants.map((g) => {
                if (g.type === 'group') {
                  const pos = g.combatants[0].initiative_order ?? idx + 1
                  idx += g.combatants.length
                  return (
                    <GroupCombatantCard
                      key={g.combatants[0].id}
                      combatants={g.combatants}
                      conditions={conditions}
                      isActive={g.combatants.some(c => c.id === combatState.current_combatant_id)}
                      activeId={combatState.current_combatant_id}
                      me={me}
                      position={pos}
                      sharedName={g.name}
                      sharedInitiative={g.initiative}
                    />
                  )
                } else {
                  const pos = g.combatant.initiative_order ?? idx + 1
                  idx++
                  return (
                    <CombatantCard
                      key={g.combatant.id}
                      combatant={g.combatant}
                      conditions={conditions.filter(cond => cond.combatant_id === g.combatant.id)}
                      isActive={g.combatant.id === combatState.current_combatant_id}
                      me={me}
                      position={pos}
                    />
                  )
                }
              })
            })()}

            {visibleCombatants.length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--text-dim)' }}>
                <div className="text-4xl mb-3">⚔️</div>
                <p style={{ fontFamily: "'Cinzel', serif" }}>No combatants yet…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
 
// ── LanternColumnWrapper ──
// Measures card positions after render and passes the active card's midpoint
// to LanternColumn so the lantern centres on it.
// Uses a ref + resize observer to avoid re-render loops from unstable array props.
function LanternColumnWrapper({
  combatants,
  activeId,
}: {
  combatants: Combatant[]
  activeId: string | null
}) {
  const [activeMidY, setActiveMidY] = useState(60)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  useEffect(() => {
    // Measure once on mount, then only on resize
    function measure() {
      const wrap = document.getElementById('combatant-list-wrap')
      const id = activeIdRef.current
      if (!wrap || !id) return
      const cards = wrap.querySelectorAll<HTMLElement>('[data-combatant-id]')
      cards.forEach(el => {
        if (el.dataset.combatantId === id) {
          const wrapRect = wrap.getBoundingClientRect()
          const cardRect = el.getBoundingClientRect()
          setActiveMidY(cardRect.top - wrapRect.top + cardRect.height / 2)
        }
      })
    }

    const raf = requestAnimationFrame(measure)

    // Also re-measure on resize
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure)
    })
    const wrapEl = document.getElementById('combatant-list-wrap')
    if (wrapEl) ro.observe(wrapEl)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, []) // intentionally empty — activeId read via ref, combatants not needed for positioning
 
  return <LanternColumn activeMidY={activeMidY} />
}
 