import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fireLocalNotification } from '../lib/notifications'
import InitiativeEntry from './combat/InitiativeEntry'
import CombatantCard from './combat/CombatantCard'
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

  const isDM = me.role === 'dm'

  // ── Load combatants ──
  const loadCombatants = useCallback(async () => {
    const { data } = await supabase
      .from('combatants')
      .select('*')
      .eq('session_id', session.id)
      .order('initiative_order', { ascending: true })
    if (data) setCombatants(data as Combatant[])
  }, [session.id])

  // ── Load conditions ──
  const loadConditions = useCallback(async () => {
    const { data } = await supabase
      .from('conditions')
      .select('*')
      .in('combatant_id', combatants.map(c => c.id))
    if (data) setConditions(data as Condition[])
  }, [combatants])

  useEffect(() => { loadCombatants() }, [loadCombatants])
  useEffect(() => { if (combatants.length > 0) loadConditions() }, [combatants.length, loadConditions])

  // ── Real-time: combat state ──
  useEffect(() => {
    const channel = supabase.channel(`combat_state:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_state', filter: `session_id=eq.${session.id}` }, (payload) => {
        const next = payload.new as CombatState
        setCombatState(next)
        // Notify player if it's now their turn
        if (!isDM && next.current_combatant_id) {
          const myCombatant = combatants.find(c => c.participant_id === me.id)
          if (myCombatant && next.current_combatant_id === myCombatant.id) {
            fireLocalNotification('⚔️ Your Turn!', "It's your turn in combat!")
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, isDM, combatants, me.id])

  // ── Real-time: combatants ──
  useEffect(() => {
    const channel = supabase.channel(`combatants:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combatants', filter: `session_id=eq.${session.id}` }, () => {
        loadCombatants()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, loadCombatants])

  // ── Real-time: conditions ──
  useEffect(() => {
    if (combatants.length === 0) return
    const channel = supabase.channel(`conditions:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conditions' }, () => {
        loadConditions()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, combatants.length, loadConditions])

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
          // Sort and assign initiative order
          const all = [...combatants].filter(c => c.initiative !== null)
          const sorted = all.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
          for (let i = 0; i < sorted.length; i++) {
            await supabase.from('combatants').update({ initiative_order: i + 1 }).eq('id', sorted[i].id)
          }
          // Re-fetch to get monsters too
          const { data: allCombatants } = await supabase.from('combatants')
            .select('*').eq('session_id', session.id).order('initiative', { ascending: false })

          if (allCombatants && allCombatants.length > 0) {
            const firstId = (allCombatants as Combatant[])[0].id
            await supabase.from('combat_state').update({
              phase: 'active',
              current_combatant_id: firstId,
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

  const currentCombatant = combatants.find(c => c.id === combatState.current_combatant_id)
  const isMyTurn = !!combatants.find(c => c.id === combatState.current_combatant_id && c.participant_id === me.id)

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

      {/* ── Combatant list ── */}
      <div className="flex-1 overflow-auto px-4 py-4 flex flex-col gap-3">
        {visibleCombatants.map((c, i) => (
          <CombatantCard
            key={c.id}
            combatant={c}
            conditions={conditions.filter(cond => cond.combatant_id === c.id)}
            isActive={c.id === combatState.current_combatant_id}
            me={me}
            position={c.initiative_order ?? i + 1}
          />
        ))}

        {visibleCombatants.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--text-dim)' }}>
            <div className="text-4xl mb-3">⚔️</div>
            <p style={{ fontFamily: "'Cinzel', serif" }}>No combatants yet…</p>
          </div>
        )}
      </div>
    </div>
  )
}
