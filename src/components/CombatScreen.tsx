import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import lanternLogo from '../assets/Lantern3.png'
import { fireLocalNotification } from '../lib/notifications'
import InitiativeEntry from './combat/InitiativeEntry'
import CombatantCard from './combat/CombatantCard'
import LanternColumn from './combat/LanternColumn'
import GroupCombatantCard from './combat/GroupCombatantCard'
import OrderReviewScreen from './combat/OrderReviewScreen'
import type { Session, Participant, Combatant, CombatState, Condition } from '../types'

interface Props {
  session: Session
  me: Participant
  initialState: CombatState
  onReturnToLobby: () => void
}

export default function CombatScreen({ session, me, initialState, onReturnToLobby }: Props) {
  const [combatState, setCombatState]   = useState<CombatState>(initialState)
  const [combatants, setCombatants]     = useState<Combatant[]>([])
  const [conditions, setConditions]     = useState<Condition[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [advancing, setAdvancing]       = useState(false)
  const [lateInit, setLateInit]         = useState('')
  const [lateInitSaving, setLateInitSaving] = useState(false)
  const [lateHpOptIn, setLateHpOptIn]   = useState(false)
  const [lateCurrentHp, setLateCurrentHp] = useState('')
  const [lateMaxHp, setLateMaxHp]       = useState('')
  const [lateIsMaxHp, setLateIsMaxHp]   = useState(true)
  // ── Mid-combat monster summon ──
  const [showSummon, setShowSummon]       = useState(false)
  const [summonName, setSummonName]       = useState('')
  const [summonInit, setSummonInit]       = useState('')
  const [summonHpOpt, setSummonHpOpt]     = useState(false)
  const [summonHp, setSummonHp]           = useState('')
  const [summonSaving, setSummonSaving]   = useState(false)

  const isDM = me.role === 'dm'
  const subPaused = useRef(false)

  // ── Load everything (combatants + conditions + participants) in one shot ──
  const loadAll = useCallback(async () => {

    async function runOnce() {
      const { data: combatantsData } = await supabase
        .from('combatants')
        .select('*')
        .eq('session_id', session.id)
        .order('initiative_order', { ascending: true })
      if (combatantsData) setCombatants(combatantsData as Combatant[])

      const { data: combatantIds } = await supabase
        .from('combatants')
        .select('id')
        .eq('session_id', session.id)

      let conditionsCount = 0
      if (!combatantIds || combatantIds.length === 0) {
        setConditions([])
      } else {
        const { data: conditionsData } = await supabase
          .from('conditions')
          .select('*')
          .in('combatant_id', combatantIds.map(c => c.id))
        if (conditionsData) {
          setConditions(conditionsData as Condition[])
          conditionsCount = (conditionsData as Condition[]).length
        }
      }

      // Load participants (for Alert feat detection)
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', session.id)
      if (participantsData) setParticipants(participantsData as Participant[])

      return { combatantsData, conditionsCount, participantsData }
    }

    try {
      await runOnce()
    } catch (err) {
      // One gentle retry — some realtime errors (406) appear transient
      try {
        await new Promise(r => setTimeout(r, 200))
        await runOnce()
      } catch (err2) {
        console.error('[loadAll] failed after retry', err2)
      }
    }
  }, [session.id])

  // Load once on mount
  useEffect(() => { loadAll() }, [loadAll])

  // ── Real-time: combat state ──
  const combatantsRef = useRef(combatants)
  combatantsRef.current = combatants

  useEffect(() => {
    const channel = supabase.channel(`combat_state:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_state', filter: `session_id=eq.${session.id}` }, (payload) => {
        const next = payload.new as CombatState | null

        // Detect DELETE — DM reset combat, return to lobby
        if (payload.eventType === 'DELETE') {
          onReturnToLobby()
          return
        }

        if (!next) return
        setCombatState(next)

        // Reload combatants/participants when combat_state changes so UI stays in sync across clients
        // (guard with subPaused to avoid stepping on local multi-row updates)
        if (!subPaused.current) {
          loadAll()
        }

        // Notify player if it's now their turn - use ref to avoid dep on combatants
        if (!isDM && next.current_combatant_id && me.notifications_enabled) {
          const currentCombatants = combatantsRef.current
          const myCombatant = currentCombatants.find(c => c.participant_id === me.id)
          if (myCombatant && next.current_combatant_id === myCombatant.id) {
            fireLocalNotification('⚔️ Your Turn!', "It's your turn in combat!")
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, isDM, me.id, loadAll, onReturnToLobby])

  // ── Real-time: combatants ──
  useEffect(() => {
    const channel = supabase.channel(`combatants:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combatants', filter: `session_id=eq.${session.id}` }, () => {
        if (!subPaused.current) loadAll()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, loadAll])

  // ── Real-time: conditions ──
  useEffect(() => {
    const channel = supabase.channel(`conditions:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conditions' }, () => {
        loadAll()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, loadAll])

  // ── Fallback: detect session going back to lobby (covers any missed DELETE event) ──
  useEffect(() => {
    const channel = supabase.channel(`session_reset:${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` }, (payload) => {
        const next = payload.new as { status: string }
        if (next.status === 'lobby') {
          onReturnToLobby()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, onReturnToLobby])

  // ── Assign grouped initiative_order to combatants ──
  // Same-name monsters with the same initiative share an order number,
  // so the whole group acts as one turn slot
  async function assignGroupedInitiativeOrders(list: Combatant[]) {
    const sorted = [...list].sort((a, b) => {
      const ia = a.initiative ?? -1
      const ib = b.initiative ?? -1
      return ib - ia
    })

    let order = 0
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i]
      const prev = sorted[i - 1]
      // Same group as previous?
      const sameGroup = prev &&
        c.kind === 'monster' &&
        prev.kind === 'monster' &&
        c.name === prev.name &&
        c.initiative === prev.initiative

      if (!sameGroup) order++
      await supabase.from('combatants').update({ initiative_order: order }).eq('id', c.id)
    }
  }

  // ── Late-joiner submits initiative + HP ──
  async function handleLateInitiative() {
    const val = parseInt(lateInit)
    if (isNaN(val) || val < 1 || val > 30) return
    setLateInitSaving(true)

    const myCombatant = combatants.find(c => c.participant_id === me.id && c.kind === 'player')
    if (!myCombatant) { setLateInitSaving(false); return }

    const updateFields: Record<string, unknown> = { initiative: val }

    if (lateHpOptIn) {
      const cur = parseInt(lateCurrentHp)
      if (!isNaN(cur) && cur > 0) {
        updateFields.hp_enabled = true
        updateFields.current_hp = cur
        updateFields.max_hp = lateIsMaxHp ? cur : Math.max(cur, parseInt(lateMaxHp) || 0)
        updateFields.temp_hp = 0
      }
    }

    await supabase.from('combatants').update(updateFields).eq('id', myCombatant.id)

    const { data: fresh } = await supabase.from('combatants')
      .select('*')
      .eq('session_id', session.id)
    if (fresh) {
      await assignGroupedInitiativeOrders(fresh)
      setCombatants(fresh as Combatant[])
    }

    setLateInit('')
    setLateInitSaving(false)
  }

  // ── Mid-combat monster summon (DM only) ──
  async function handleSummon() {
    const name = summonName.trim()
    const init = parseInt(summonInit)
    if (!name || isNaN(init) || summonSaving) return
    setSummonSaving(true)
    try {
      subPaused.current = true

      // Insert the new monster row
      const row = {
        session_id: session.id,
        name,
        kind: 'monster' as const,
        initiative: init,
        is_hidden: false,
        has_taken_turn: false,
        dead: false,
        count: 1,
        hp_enabled: summonHpOpt,
        max_hp: summonHpOpt && summonHp ? parseInt(summonHp) : null,
        current_hp: summonHpOpt && summonHp ? parseInt(summonHp) : null,
        temp_hp: 0,
        participant_id: null,
      }
      await supabase.from('combatants').insert(row)

      // Reload and re-sort via existing grouped-order logic
      const { data: fresh } = await supabase.from('combatants')
        .select('*').eq('session_id', session.id)
      if (fresh) {
        await assignGroupedInitiativeOrders(fresh)
        setCombatants(fresh as Combatant[])
      }

      // Reset form
      setShowSummon(false)
      setSummonName('')
      setSummonInit('')
      setSummonHpOpt(false)
      setSummonHp('')
    } finally {
      subPaused.current = false
      setSummonSaving(false)
    }
  }

  // ── Advance turn (DM only) ──
  // Skips to the next combatant in a different group (different initiative_order)
  async function advanceTurn() {
    if (!isDM || advancing) return
    setAdvancing(true)

    const ordered = [...combatants].sort((a, b) => (a.initiative_order ?? 0) - (b.initiative_order ?? 0))
    const currentIdx = ordered.findIndex(c => c.id === combatState.current_combatant_id)
    const currentOrder = ordered[currentIdx]?.initiative_order

    // Walk forward to find next combatant with a different initiative_order (and not dead)
    let nextIdx = (currentIdx + 1) % ordered.length
    let safety = 0
    while (nextIdx !== currentIdx && safety < ordered.length) {
      const candidate = ordered[nextIdx]
      if (!candidate.dead && candidate.initiative_order !== currentOrder) break
      nextIdx = (nextIdx + 1) % ordered.length
      safety++
    }
    const next = ordered[nextIdx]

    // If we looped back to the same combatant (all are dead), don't advance
    if (next.id === combatState.current_combatant_id) {
      setAdvancing(false)
      return
    }

    const newRound = nextIdx <= currentIdx ? combatState.round_number + 1 : combatState.round_number

    if (next.is_hidden) {
      // Reveal entire monster group (same name, same initiative) when any member becomes active
      if (next.kind === 'monster') {
        await supabase.from('combatants')
          .update({ is_hidden: false, has_taken_turn: true })
          .eq('session_id', session.id)
          .eq('name', next.name)
          .eq('initiative', next.initiative)
      } else {
        await supabase.from('combatants').update({ is_hidden: false, has_taken_turn: true }).eq('id', next.id)
      }
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

  // ── Derived values (must be above early return to keep hook order consistent) ──
  const visibleCombatants = isDM
    ? combatants
    : combatants.filter(c => !c.is_hidden || c.kind === 'player')

  // ── Group adjacent same-name monsters, exclude all-dead groups ──
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
        const monsters = visibleCombatants.slice(i, j)
        // Exclude group if ALL are dead
        if (monsters.every(m => m.dead)) {
          i = j
          continue
        }
        const count = j - i
        if (count > 1) {
          groups.push({
            type: 'group',
            combatants: monsters,
            name: c.name,
            initiative: c.initiative ?? 0,
          })
        } else {
          groups.push({ type: 'single', combatant: monsters[0] })
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

  // ── Tie-breaking reorder (DM only) ──
  function getGroupInitiative(entry: typeof groupedCombatants[0]): number | null {
    return entry.type === 'single'
      ? (entry.combatant.initiative ?? null)
      : (entry.initiative ?? null)
  }

  async function swapBlocks(idx: number, swapIdx: number) {
    // Swap the initiative_order values between two blocks (ties only)
    subPaused.current = true
    try {
      const block = groupedCombatants[idx]
      const swapBlock = groupedCombatants[swapIdx]

      const blockOrder = block.type === 'group'
        ? (block.combatants[0].initiative_order ?? 1)
        : (block.combatant.initiative_order ?? 1)
      const swapOrder = swapBlock.type === 'group'
        ? (swapBlock.combatants[0].initiative_order ?? 1)
        : (swapBlock.combatant.initiative_order ?? 1)

      const combatantsInBlock = block.type === 'group' ? block.combatants : [block.combatant]
      const combatantsInSwap = swapBlock.type === 'group' ? swapBlock.combatants : [swapBlock.combatant]

      // Give every member of this block the swap block's order
      for (const c of combatantsInBlock) {
        await supabase.from('combatants').update({ initiative_order: swapOrder }).eq('id', c.id)
      }
      // Give every member of the swap block this block's order
      for (const c of combatantsInSwap) {
        await supabase.from('combatants').update({ initiative_order: blockOrder }).eq('id', c.id)
      }

      await loadAll()
    } finally {
      subPaused.current = false
    }
  }

  // ── New combat (DM only): reset session back to lobby ──
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleNewCombat() {
    if (!isDM || resetting) return
    setResetting(true)
    try {
      // Delete combatants first (cascade deletes conditions)
      const { error: combatantsErr } = await supabase.from('combatants').delete().eq('session_id', session.id)
      if (combatantsErr) console.error('[newCombat] combatants delete err:', combatantsErr)

      // Delete combat_state — subscription will fire DELETE and bounce everyone to lobby
      const { error: stateErr } = await supabase.from('combat_state').delete().eq('session_id', session.id)
      if (stateErr) console.error('[newCombat] combat_state delete err:', stateErr)

      // Update session status back to lobby
      await supabase.from('sessions').update({ status: 'lobby' }).eq('id', session.id)

      // Reset per-encounter participant flags (Alert feat resets each combat)
      await supabase.from('participants').update({ alert_used: false }).eq('session_id', session.id)

      // Bounce DM back to lobby directly (in case DELETE event doesn't fire for the caller)
      onReturnToLobby()
    } catch (e) {
      console.error('[newCombat]', e)
    } finally {
      setResetting(false)
      setShowResetConfirm(false)
    }
  }

  // ── Begin combat from order review ──
  async function handleBeginCombat() {
    // Reload combatants sorted by existing initiative_order (nudges + swaps preserved)
    const { data: fresh } = await supabase.from('combatants')
      .select('*').eq('session_id', session.id).order('initiative_order', { ascending: true })
    const freshList = (fresh ?? []) as Combatant[]
    setCombatants(freshList)

    if (freshList.length > 0) {
      const first = freshList[0]
      // Reveal the first combatant (and its group if it's a monster)
      if (first.kind === 'monster') {
        await supabase.from('combatants')
          .update({ is_hidden: false, has_taken_turn: true })
          .eq('session_id', session.id)
          .eq('name', first.name)
          .eq('initiative', first.initiative)
      } else {
        await supabase.from('combatants').update({ is_hidden: false, has_taken_turn: true }).eq('id', first.id)
      }

      await supabase.from('combat_state').update({
        phase: 'active',
        current_combatant_id: first.id,
        updated_at: new Date().toISOString(),
      }).eq('session_id', session.id)
    }
  }

  // ── Order review phase ──
  if (combatState.phase === 'order_review') {
    return (
      <OrderReviewScreen
        combatants={combatants}
        participants={participants}
        me={me}
        sessionId={session.id}
        onBeginCombat={handleBeginCombat}
      />
    )
  }

  // ── Initiative entry phase ──
  if (combatState.phase === 'initiative') {
    return (
      <InitiativeEntry
        combatants={combatants}
        participants={participants}
        me={me}
        sessionId={session.id}
        onReady={async ({ playerUpdates, monsterInserts, pcInserts }) => {
          // Pause subscription-driven loads while we write
          subPaused.current = true

          try {
            // Apply player initiative updates
            for (const { id, initiative } of playerUpdates) {
              await supabase.from('combatants').update({ initiative }).eq('id', id)
            }

            // Insert monster rows
            if (monsterInserts.length > 0) {
              const rows = monsterInserts.map(m => ({ ...m, session_id: session.id }))
              await supabase.from('combatants').insert(rows)
            }

            // Insert DM-added PCs
            if (pcInserts.length > 0) {
              const rows = pcInserts.map(pc => ({ ...pc, session_id: session.id }))
              await supabase.from('combatants').insert(rows)
            }

            // Fetch ALL combatants fresh and assign grouped orders
            const { data: fresh } = await supabase.from('combatants')
              .select('*').eq('session_id', session.id)
            const freshList = (fresh ?? []) as Combatant[]

            await assignGroupedInitiativeOrders(freshList)

            // Re-fetch sorted by initiative_order so first combatant is correct
            const { data: freshSorted } = await supabase.from('combatants')
              .select('*').eq('session_id', session.id).order('initiative_order', { ascending: true })
            const orderedList = (freshSorted ?? []) as Combatant[]
            setCombatants(orderedList)

            // Reload participants fresh (captures lobby toggles like alert_feat)
            const { data: freshParticipants } = await supabase
              .from('participants')
              .select('*')
              .eq('session_id', session.id)
            if (freshParticipants) setParticipants(freshParticipants as Participant[])

            // Transition to order_review phase — DM reviews, nudges ties, Alert swaps happen here
            await supabase.from('combat_state').update({
              phase: 'order_review',
              current_combatant_id: null,
              updated_at: new Date().toISOString(),
            }).eq('session_id', session.id)
          } finally {
            // Re-enable subscriptions
            subPaused.current = false
          }
        }}
      />
    )
  }

  // ── Active combat ──

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-void)' }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-5 py-3 flex items-center justify-between"
        style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
      >
        <div>
          <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Round</div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', lineHeight: 1 }}>
              {combatState.round_number}
            </div>
            {isDM && (
              <button
                onClick={() => setShowSummon(true)}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
              >
                + Add Monster
              </button>
            )}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Now Acting</div>
          <div className="text-sm font-semibold" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold-light)' }}>
            {currentCombatant?.name ?? '-'}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs mb-1 uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {session.room_code}
          </div>
          {isDM && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={advanceTurn}
                disabled={advancing}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
              >
                {advancing ? '...' : 'Next Turn ▶'}
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-xs transition-all hover:opacity-70"
                style={{ color: 'var(--text-dim)', fontFamily: "'Cinzel', serif", letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Start New Combat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Late-joiner: initiative + HP setup ── */}
      {!isDM && myCombatantNoInit && (
        <div
          className="px-5 py-4 text-center"
          style={{ background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid var(--gold-dark)' }}
        >
          <p style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', fontSize: '0.9rem', marginBottom: 8 }}>
            ⚔️  Roll for Initiative — you joined mid-combat!
          </p>

          {/* HP toggle */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>❤️ Track HP</span>
            <button
              onClick={() => setLateHpOptIn(o => !o)}
              className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5"
              style={{ background: lateHpOptIn ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)' }}
            >
              <div className="w-5 h-5 rounded-full transition-all duration-200"
                style={{ background: lateHpOptIn ? 'var(--gold)' : 'var(--text-dim)', transform: lateHpOptIn ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>

          {/* HP inputs */}
          {lateHpOptIn && (
            <div className="flex flex-col items-center gap-2 mb-3 fade-in">
              <div className="flex gap-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>Current HP</label>
                  <input type="tel" inputMode="numeric" pattern="\d*" value={lateCurrentHp} onChange={e => setLateCurrentHp(e.target.value)}
                    min={0}
                    placeholder="e.g. 30"
                    className="w-20 px-3 py-2 rounded text-center text-sm outline-none"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
                </div>
                {!lateIsMaxHp && (
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>Max HP</label>
                    <input type="tel" inputMode="numeric" pattern="\d*" value={lateMaxHp} onChange={e => setLateMaxHp(e.target.value)}
                      min={0}
                      placeholder="e.g. 40"
                      className="w-20 px-3 py-2 rounded text-center text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={lateIsMaxHp} onChange={e => setLateIsMaxHp(e.target.checked)}
                  style={{ accentColor: 'var(--gold)' }} />
                Current HP is my max HP
              </label>
            </div>
          )}

          {/* Initiative input */}
          <div className="flex justify-center gap-2">
            <input
              type="tel" inputMode="numeric" pattern="\d*"
              min={1} max={30}
              value={lateInit}
              onChange={e => setLateInit(e.target.value)}
              placeholder="INIT"
              className="w-20 px-3 py-2 rounded text-center text-lg outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
            />
            <button
              onClick={handleLateInitiative}
              disabled={lateInitSaving}
              className="px-4 py-2 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
            >
              {lateInitSaving ? '...' : 'Set'}
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

          {/* Lantern - tracks active card position */}
          <LanternColumnWrapper activeId={combatState.current_combatant_id} />

          <div className="flex flex-col gap-3">
            {(() => {
              return groupedCombatants.map((g, groupIndex) => {
                const thisInit = getGroupInitiative(g)
                const prevInit = groupIndex > 0 ? getGroupInitiative(groupedCombatants[groupIndex - 1]) : null
                const nextInit = groupIndex < groupedCombatants.length - 1 ? getGroupInitiative(groupedCombatants[groupIndex + 1]) : null
                const tiedAbove = isDM && thisInit !== null && thisInit === prevInit
                const tiedBelow = isDM && thisInit !== null && thisInit === nextInit

                if (g.type === 'group') {
                  const pos = g.combatants[0].initiative_order ?? 1
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
                      canMoveUp={tiedAbove}
                      canMoveDown={tiedBelow}
                      onMoveUp={() => swapBlocks(groupIndex, groupIndex - 1)}
                      onMoveDown={() => swapBlocks(groupIndex, groupIndex + 1)}
                    />
                  )
                } else {
                  const pos = g.combatant.initiative_order ?? 1
                  return (
                    <CombatantCard
                      key={g.combatant.id}
                      combatant={g.combatant}
                      conditions={conditions.filter(cond => cond.combatant_id === g.combatant.id)}
                      isActive={g.combatant.id === combatState.current_combatant_id}
                      me={me}
                      position={pos}
                      canMoveUp={tiedAbove}
                      canMoveDown={tiedBelow}
                      onMoveUp={() => swapBlocks(groupIndex, groupIndex - 1)}
                      onMoveDown={() => swapBlocks(groupIndex, groupIndex + 1)}
                      canSwapTarget={false}
                      onSwapTarget={undefined}
                    />
                  )
                }
              })
            })()}

            {visibleCombatants.length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--text-dim)' }}>
                <div className="text-4xl mb-3">⚔️</div>
                <p style={{ fontFamily: "'Cinzel', serif" }}>No combatants yet...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Summon monster modal (DM only) ── */}
      {showSummon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full mx-4"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--gold-dark)', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }}
          >
            <h3
              className="text-lg font-bold mb-4 text-center"
              style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', letterSpacing: '0.06em' }}
            >
              🐾 Summon Monster
            </h3>

            {/* Name */}
            <label className="block text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>
              Name
            </label>
            <input
              type="text"
              value={summonName}
              onChange={e => setSummonName(e.target.value)}
              placeholder="e.g. Zombie"
              className="w-full px-3 py-2 rounded text-sm outline-none mb-4"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            />

            {/* Initiative */}
            <label className="block text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>
              Initiative Roll
            </label>
            <input
              type="tel" inputMode="numeric" pattern="\d*"
              min={1} max={30}
              value={summonInit}
              onChange={e => setSummonInit(e.target.value)}
              placeholder="e.g. 14"
              className="w-full px-3 py-2 rounded text-sm outline-none mb-4"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
            />

            {/* Track HP toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Track HP</span>
              <button
                onClick={() => setSummonHpOpt(o => !o)}
                className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5"
                style={{ background: summonHpOpt ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)' }}
              >
                <div className="w-5 h-5 rounded-full transition-all duration-200"
                  style={{ background: summonHpOpt ? 'var(--gold)' : 'var(--text-dim)', transform: summonHpOpt ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>

            {/* HP input (conditional) */}
            {summonHpOpt && (
              <div className="mb-4 fade-in">
                <label className="block text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>
                  HP
                </label>
                <input
                  type="tel" inputMode="numeric" pattern="\d*"
                  value={summonHp}
                  onChange={e => setSummonHp(e.target.value)}
                  placeholder="e.g. 40"
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSummon(false)
                  setSummonName('')
                  setSummonInit('')
                  setSummonHpOpt(false)
                  setSummonHp('')
                }}
                className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all active:scale-95"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)', fontFamily: "'Cinzel', serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSummon}
                disabled={summonSaving || !summonName.trim() || !summonInit.trim()}
                className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
              >
                {summonSaving ? 'Summoning…' : 'Summon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirmation modal ── */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="rounded-xl p-8 max-w-sm w-full mx-4 text-center"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--gold-dark)', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }}
          >
            <div className="mb-4 flex justify-center">
              <img src={lanternLogo} alt="" className="h-24" style={{ filter: 'drop-shadow(0 0 16px rgba(201,168,76,0.6))' }} />
            </div>
            <h3
              className="text-xl font-bold mb-2"
              style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', letterSpacing: '0.06em' }}
            >
              Braced for a new battle?
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              This will end the current combat and return everyone to the lobby for a new encounter.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all active:scale-95"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)', fontFamily: "'Cinzel', serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleNewCombat}
                disabled={resetting}
                className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
              >
                {resetting ? 'Resetting…' : '"Once more unto the breach…"'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── LanternColumnWrapper ──
// Measures card positions after render and passes the active card's midpoint
// to LanternColumn so the lantern centres on it.
// Uses a ref + resize observer to avoid re-render loops from unstable array props.
function LanternColumnWrapper({ activeId }: { activeId: string | null }) {
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
  }, []) // intentionally empty - activeId read via ref, combatants not needed for positioning

  return <LanternColumn activeMidY={activeMidY} />
}
