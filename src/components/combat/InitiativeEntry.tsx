import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import rollIcon from '../../assets/rollforinitiative3.webp'
import crossedAxes from '../../assets/crossedaxes.webp'
import type { Combatant, Participant } from '../../types'

interface Props {
  combatants: Combatant[]
  participants: Participant[]
  me: Participant
  sessionId: string
  onReady: (data: { playerUpdates: { id: string; initiative: number }[]; monsterInserts: any[]; pcInserts: any[] }) => void
  /** Seeds the monster form when the DM steps back from order review */
  monsterPrefill?: { name: string; count: string; initiative: string; hp: string; hpEnabled: boolean }[]
  /** DM escape hatch — reverts the encounter and returns everyone to the lobby */
  onBackToLobby?: () => void
}

export default function InitiativeEntry({ combatants, participants: initialParticipants, me, sessionId, onReady, monsterPrefill, onBackToLobby }: Props) {
  const isDM = me.role === 'dm'

  // Initiatives keyed by combatant id
  const [initiatives, setInitiatives] = useState<Record<string, string>>({})
  // Combatants whose already-set initiative the DM has tapped to correct
  const [editingInit, setEditingInit] = useState<Set<string>>(new Set())
  // Monster rows (DM only) — seeded from prefill when stepping back from order review
  const [monsters, setMonsters] = useState<{ name: string; count: string; initiative: string; hp: string; hpEnabled: boolean }[]>(
    monsterPrefill && monsterPrefill.length > 0
      ? monsterPrefill
      : [{ name: '', count: '1', initiative: '', hp: '', hpEnabled: false }]
  )
  // DM-added PC rows with settings fields
  const [addPcRows, setAddPcRows] = useState<{
    name: string
    init: string
    hpEnabled: boolean
    hp: string
    isMaxHp: boolean
    maxHp: string
    alertFeat: boolean
  }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // ── DM-PC toggles: participants state synced from props + re-fetched after each write ──
  const [participantsState, setParticipantsState] = useState<Participant[]>(initialParticipants)
  const [participantsSaving, setParticipantsSaving] = useState<Record<string, boolean>>({})
  const [toggleError, setToggleError] = useState<string | null>(null)

  // Sync participantsState when props change (Start New Combat re-fetches)
  useEffect(() => {
    setParticipantsState(initialParticipants)
  }, [initialParticipants])

  const participantById = new Map(participantsState.map(p => [p.id, p]))

  // ── Persistent DM-PCs — have a participant row but no combatant in this encounter yet ──
  const persistentDmPcs = useMemo(() => {
    const claimedIds = new Set(combatants.map(c => c.participant_id).filter((id): id is string => id !== null))
    return participantsState.filter(p => p.role === 'dm_pc' && !claimedIds.has(p.id))
  }, [participantsState, combatants])

  // Per-encounter overrides for persistent DM-PCs (init + HP per fight — never writes to participant baseline)
  const [persistentOverrides, setPersistentOverrides] = useState<Record<string, {
    init: string
    hpEnabled: boolean
    hp: string
    isMaxHp: boolean
    maxHp: string
    alertFeat: boolean
  }>>({})

  // Re-initialise overrides when persistent list changes (new encounter loaded)
  useEffect(() => {
    const overrides: Record<string, {
      init: string; hpEnabled: boolean; hp: string; isMaxHp: boolean; maxHp: string; alertFeat: boolean
    }> = {}
    for (const p of persistentDmPcs) {
      overrides[p.id] = {
        init: '',
        hpEnabled: p.hp_opt_in,
        hp: p.starting_hp?.toString() ?? '',
        isMaxHp: !p.max_hp_participant || (p.starting_hp !== null && p.starting_hp === p.max_hp_participant),
        maxHp: p.max_hp_participant?.toString() ?? '',
        alertFeat: p.alert_feat,
      }
    }
    setPersistentOverrides(overrides)
  }, [persistentDmPcs])

  async function writeParticipantToggle(participantId: string, field: 'hp_opt_in' | 'alert_feat', currentValue: boolean) {
    const nextValue = !currentValue
    setToggleError(null)
    setParticipantsSaving(p => ({ ...p, [participantId]: true }))
    try {
      const { error: err } = await supabase.from('participants').update({ [field]: nextValue }).eq('id', participantId)
      if (err) {
        setToggleError(`Failed to update ${field === 'hp_opt_in' ? 'HP tracking' : 'Alert Feat'}`)
        console.error('[InitiativeEntry] writeParticipantToggle error', field, err)
      } else {
        setParticipantsState(prev => prev.map(p => p.id === participantId ? { ...p, [field]: nextValue } : p))
      }
    } catch (e) {
      setToggleError(`Failed to update ${field === 'hp_opt_in' ? 'HP tracking' : 'Alert Feat'}`)
    } finally {
      setParticipantsSaving(p => ({ ...p, [participantId]: false }))
    }
  }

  // My combatant (player only)
  const myCombatant = combatants.find(c => c.participant_id === me.id)

  // Which combatants still need initiative
  const pending = combatants.filter(c => c.initiative === null)
  const allPlayersDone = pending.length === 0
  async function submitPlayerInitiative() {
    if (!myCombatant) return
    const val = parseInt(initiatives[myCombatant.id] ?? '')
    if (isNaN(val)) { setError('Enter a number'); return }
    setSaving(true)
    await supabase.from('combatants').update({ initiative: val }).eq('id', myCombatant.id)
    setSaving(false)
    setError(null)
  }

  async function submitDMInitiatives() {
    setSaving(true)
    setError(null)
    try {
      // Collect player initiative updates
      const playerUpdates: { id: string; initiative: number }[] = []
      for (const c of combatants) {
        const val = parseInt(initiatives[c.id] ?? '')
        if (!isNaN(val)) {
          playerUpdates.push({ id: c.id, initiative: val })
        }
      }

      // Collect monster inserts
      const validMonsters = monsters.filter(m => m.name.trim() && m.initiative.trim())
      const monsterInserts: any[] = []
      for (const m of validMonsters) {
        const groupCount = Math.max(1, parseInt(m.count) || 1)
        for (let j = 0; j < groupCount; j++) {
          monsterInserts.push({
            name:        m.name.trim(),
            kind:        'monster',
            initiative:  parseInt(m.initiative),
            is_hidden:   true,
            count:       1,
            hp_enabled:  m.hpEnabled,
            max_hp:      m.hpEnabled && m.hp ? parseInt(m.hp) : null,
            current_hp:  m.hpEnabled && m.hp ? parseInt(m.hp) : null,
          })
        }
      }

      // DM-added PCs — create participants row first, then combatant with real participant_id
      const pcInserts: any[] = []
      for (const row of addPcRows) {
        const name = row.name.trim()
        const init = parseInt(row.init)
        if (!name || isNaN(init)) continue

        // Create a participants row with role='dm_pc'
        const { data: newPart, error: partErr } = await supabase
          .from('participants')
          .insert({
            session_id: sessionId,
            name,
            role: 'dm_pc',
            hp_opt_in: row.hpEnabled,
            starting_hp: row.hpEnabled && row.hp ? parseInt(row.hp) : null,
            max_hp_participant: row.hpEnabled && row.hp && !row.isMaxHp && row.maxHp ? parseInt(row.maxHp) : row.hpEnabled && row.hp ? parseInt(row.hp) : null,
            alert_feat: row.alertFeat,
            notifications_enabled: false,
            alert_used: false,
          })
          .select()
          .single()

        if (partErr || !newPart) {
          console.error('[InitiativeEntry] failed to create dm_pc participant', partErr)
          continue
        }

        pcInserts.push({
          name,
          kind: 'player',
          initiative: init,
          participant_id: newPart.id,
          is_hidden: false,
          hp_enabled: row.hpEnabled,
          current_hp: row.hpEnabled && row.hp ? parseInt(row.hp) : null,
          max_hp: row.hpEnabled && row.hp && !row.isMaxHp && row.maxHp ? parseInt(row.maxHp) : row.hpEnabled && row.hp ? parseInt(row.hp) : null,
          temp_hp: 0,
        })
      }

      // Persistent DM-PCs — reuse existing participant row, no participant UPDATE on HP
      for (const p of persistentDmPcs) {
        const ov = persistentOverrides[p.id]
        if (!ov) continue
        const init = parseInt(ov.init)
        if (isNaN(init)) continue

        pcInserts.push({
          name: p.name,
          kind: 'player',
          initiative: init,
          participant_id: p.id,
          is_hidden: false,
          hp_enabled: ov.hpEnabled,
          current_hp: ov.hpEnabled && ov.hp ? parseInt(ov.hp) : null,
          max_hp: ov.hpEnabled && ov.hp && !ov.isMaxHp && ov.maxHp ? parseInt(ov.maxHp) : ov.hpEnabled && ov.hp ? parseInt(ov.hp) : null,
          temp_hp: 0,
        })
      }

      onReady({ playerUpdates, monsterInserts, pcInserts })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const hasMyCombatant = !!myCombatant
  const myInitiativeSet = myCombatant?.initiative !== null

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-10" style={{ background: 'var(--bg-void)' }}>
      <div className="text-center mb-8 fade-in">
        <div className="mb-4 flex justify-center">
          <img src={rollIcon} alt="" className="w-56" style={{ maxWidth: '90vw', filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.5))' }} />
        </div>
        <h1 className="text-3xl font-bold tracking-wider" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', textShadow: '0 0 16px rgba(201,168,76,0.4)' }}>
          Roll for Initiative
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
          {isDM ? 'Enter initiatives for all combatants and add monsters' : 'Enter your initiative roll'}
        </p>
        {isDM && onBackToLobby && (
          <button
            onClick={onBackToLobby}
            className="mt-3 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            ← Back to lobby
          </button>
        )}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* ── Player: enter own initiative ── */}
        {!isDM && (
          <div className="rounded-xl parchment fade-in" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            <div className="p-5">
              {myInitiativeSet ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-2" style={{ color: 'var(--gold)' }}>
                    {myCombatant?.initiative}
                  </div>
                  <p style={{ color: 'var(--gold-light)', fontFamily: "'Cinzel', serif" }}>Initiative set!</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>Waiting for DM to begin…</p>
                </div>
              ) : (
                <>
                  <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>
                    Your Initiative Roll
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel" inputMode="numeric" pattern="\d*"
                      min={1} max={30}
                      value={hasMyCombatant ? (initiatives[myCombatant!.id] ?? '') : ''}
                      onChange={e => myCombatant && setInitiatives(p => ({ ...p, [myCombatant.id]: e.target.value }))}
                      placeholder="e.g. 17"
                      className="flex-1 min-w-0 px-4 py-3 rounded-lg text-2xl text-center outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)', caretColor: 'var(--gold)' }}
                    />
                    <button onClick={submitPlayerInitiative} disabled={saving}
                      className="px-5 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}>
                      Set
                    </button>
                  </div>
                  {error && <p className="text-xs mt-2" style={{ color: '#e07070' }}>{error}</p>}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── DM view: all players + monsters ── */}
        {isDM && (
          <>
            {/* Player initiatives */}
            <div className="rounded-xl parchment" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
              <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Players</span>
                <button onClick={() => setAddPcRows(p => [...p, { name: '', init: '', hpEnabled: false, hp: '', isMaxHp: true, maxHp: '', alertFeat: false }])}
                  className="text-xs px-2 py-1 rounded transition-all"
                  style={{ color: 'var(--gold)', border: '1px solid var(--gold-dark)', background: 'transparent' }}>
                  + Add
                </button>
              </div>
              {/* DM-added PC rows */}
              {addPcRows.map((row, i) => (
                <div key={`dm-pc-${i}`} className="px-5 py-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => setAddPcRows(rows => rows.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                      placeholder="Character name"
                      className="flex-1 min-w-0 px-3 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="tel" inputMode="numeric" pattern="\d*"
                      value={row.init}
                      onChange={e => setAddPcRows(rows => rows.map((r, j) => j === i ? { ...r, init: e.target.value } : r))}
                      placeholder="Init"
                      className="w-16 px-2 py-2 rounded text-center text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
                    />
                    {addPcRows.length > 1 && (
                      <button onClick={() => setAddPcRows(rows => rows.filter((_, j) => j !== i))}
                        className="px-2 py-1 rounded text-sm"
                        style={{ color: 'var(--text-dim)', background: 'transparent' }}>✕</button>
                    )}
                  </div>
                  {/* Track HP toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Track HP</span>
                    <button onClick={() => setAddPcRows(rows => rows.map((r, j) => j === i ? { ...r, hpEnabled: !r.hpEnabled } : r))}
                      className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5 shrink-0"
                      style={{ background: row.hpEnabled ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                      <div className="w-5 h-5 rounded-full transition-all duration-200"
                        style={{ background: row.hpEnabled ? 'var(--gold)' : 'var(--text-dim)', transform: row.hpEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
                    </button>
                  </div>
                  {row.hpEnabled && (
                    <div className="flex flex-col gap-2 fade-in">
                      <div className="flex items-center gap-3">
                        <input
                          type="tel" inputMode="numeric" pattern="\d*"
                          value={row.hp}
                          onChange={e => setAddPcRows(rows => rows.map((r, j) => j === i ? { ...r, hp: e.target.value } : r))}
                          placeholder="Starting HP"
                          className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      {/* This is my max HP checkbox */}
                      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={row.isMaxHp}
                          onChange={e => {
                            const checked = e.target.checked
                            setAddPcRows(rows => rows.map((r, j) => j === i ? { ...r, isMaxHp: checked } : r))
                          }}
                          className="rounded"
                          style={{ accentColor: 'var(--gold)' }}
                        />
                        <span>This is my max HP</span>
                      </label>
                      {/* Max HP field (shown when isMaxHp is unchecked) */}
                      {!row.isMaxHp && (
                        <input
                          type="tel" inputMode="numeric" pattern="\d*"
                          value={row.maxHp}
                          onChange={e => setAddPcRows(rows => rows.map((r, j) => j === i ? { ...r, maxHp: e.target.value } : r))}
                          placeholder="Max HP"
                          className="w-full px-3 py-1.5 rounded text-sm outline-none"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        />
                      )}
                    </div>
                  )}
                  {/* Alert Feat toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
                      <span style={{ filter: row.alertFeat ? 'none' : 'grayscale(0.6)' }}>⚡</span>
                      Alert Feat
                    </span>
                    <button onClick={() => setAddPcRows(rows => rows.map((r, j) => j === i ? { ...r, alertFeat: !r.alertFeat } : r))}
                      className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5 shrink-0"
                      style={{ background: row.alertFeat ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                      <div className="w-5 h-5 rounded-full transition-all duration-200"
                        style={{ background: row.alertFeat ? 'var(--gold)' : 'var(--text-dim)', transform: row.alertFeat ? 'translateX(20px)' : 'translateX(0)' }} />
                    </button>
                  </div>
                </div>
              ))}
              {/* Persistent DM-PCs — have participant row but no combatant this encounter */}
              {persistentDmPcs.map(p => {
                const ov = persistentOverrides[p.id]
                if (!ov) return null
                return (
                  <div key={`persistent-${p.id}`} className="px-5 py-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      <input
                        type="tel" inputMode="numeric" pattern="\d*"
                        value={ov.init}
                        onChange={e => setPersistentOverrides(prev => ({ ...prev, [p.id]: { ...prev[p.id], init: e.target.value } }))}
                        placeholder="Init"
                        className="w-16 px-2 py-1.5 rounded text-center text-sm outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
                      />
                    </div>
                    {/* Track HP toggle */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Track HP</span>
                      <button
                        onClick={() => setPersistentOverrides(prev => ({ ...prev, [p.id]: { ...prev[p.id], hpEnabled: !prev[p.id].hpEnabled } }))}
                        className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5 shrink-0"
                        style={{ background: ov.hpEnabled ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                      >
                        <div className="w-5 h-5 rounded-full transition-all duration-200"
                          style={{ background: ov.hpEnabled ? 'var(--gold)' : 'var(--text-dim)', transform: ov.hpEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
                      </button>
                    </div>
                    {ov.hpEnabled && (
                      <div className="flex flex-col gap-2 fade-in">
                        <input
                          type="tel" inputMode="numeric" pattern="\d*"
                          value={ov.hp}
                          onChange={e => setPersistentOverrides(prev => ({ ...prev, [p.id]: { ...prev[p.id], hp: e.target.value } }))}
                          placeholder="Starting HP"
                          className="w-full px-3 py-1.5 rounded text-sm outline-none"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        />
                        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={ov.isMaxHp}
                            onChange={e => setPersistentOverrides(prev => ({ ...prev, [p.id]: { ...prev[p.id], isMaxHp: e.target.checked } }))}
                            className="rounded"
                            style={{ accentColor: 'var(--gold)' }}
                          />
                          <span>This is my max HP</span>
                        </label>
                        {!ov.isMaxHp && (
                          <input
                            type="tel" inputMode="numeric" pattern="\d*"
                            value={ov.maxHp}
                            onChange={e => setPersistentOverrides(prev => ({ ...prev, [p.id]: { ...prev[p.id], maxHp: e.target.value } }))}
                            placeholder="Max HP"
                            className="w-full px-3 py-1.5 rounded text-sm outline-none"
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                          />
                        )}
                      </div>
                    )}
                    {/* Alert Feat toggle */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
                        <span style={{ filter: ov.alertFeat ? 'none' : 'grayscale(0.6)' }}>⚡</span>
                        Alert Feat
                      </span>
                      <button
                        onClick={() => setPersistentOverrides(prev => ({ ...prev, [p.id]: { ...prev[p.id], alertFeat: !prev[p.id].alertFeat } }))}
                        className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5 shrink-0"
                        style={{ background: ov.alertFeat ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                      >
                        <div className="w-5 h-5 rounded-full transition-all duration-200"
                          style={{ background: ov.alertFeat ? 'var(--gold)' : 'var(--text-dim)', transform: ov.alertFeat ? 'translateX(20px)' : 'translateX(0)' }} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {/* Joined player rows */}
              {combatants.filter(c => c.kind === 'player').map(c => {
                const cParticipant = c.participant_id ? participantById.get(c.participant_id) : null
                const isDmPc = cParticipant?.role === 'dm_pc'
                const isSavingHp = c.participant_id ? !!participantsSaving[c.participant_id] : false
                const isSavingAlert = c.participant_id ? !!participantsSaving[c.participant_id] : false
                return (
                  <div key={c.id} className="px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                      {c.initiative !== null && !editingInit.has(c.id) ? (
                        // Tap to correct a mistyped roll
                        <button
                          onClick={() => {
                            setEditingInit(prev => new Set(prev).add(c.id))
                            setInitiatives(p => ({ ...p, [c.id]: String(c.initiative) }))
                          }}
                          title="Tap to edit"
                          className="flex items-baseline gap-1.5 transition-opacity hover:opacity-70"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <span className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{c.initiative}</span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>✎</span>
                        </button>
                      ) : (
                        <input
                          type="tel" inputMode="numeric" pattern="\d*"
                          value={initiatives[c.id] ?? ''}
                          onChange={e => setInitiatives(p => ({ ...p, [c.id]: e.target.value }))}
                          placeholder="—"
                          autoFocus={editingInit.has(c.id)}
                          className="w-16 px-2 py-1.5 rounded text-center outline-none text-sm"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
                        />
                      )}
                    </div>
                    {/* DM-PC controls: HP tracking + Alert Feat — read/write from participant row directly */}
                    {isDmPc && cParticipant && (
                      <div className="flex items-center gap-4 mt-2 fade-in">
                        {/* Track HP toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Track HP</span>
                          <button
                            onClick={() => writeParticipantToggle(cParticipant.id, 'hp_opt_in', cParticipant.hp_opt_in)}
                            disabled={isSavingHp}
                            className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5 shrink-0"
                            style={{
                              background: cParticipant.hp_opt_in ? 'var(--gold-dark)' : 'var(--bg-raised)',
                              border: '1px solid var(--border-light)',
                              cursor: isSavingHp ? 'wait' : 'pointer',
                              opacity: isSavingHp ? 0.5 : 1,
                            }}
                          >
                            <div className="w-5 h-5 rounded-full transition-all duration-200"
                              style={{
                                background: cParticipant.hp_opt_in ? 'var(--gold)' : 'var(--text-dim)',
                                transform: cParticipant.hp_opt_in ? 'translateX(20px)' : 'translateX(0)',
                              }} />
                          </button>
                        </div>
                        {/* Alert Feat toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
                            <span style={{ filter: cParticipant.alert_feat ? 'none' : 'grayscale(0.6)' }}>⚡</span>
                            Alert Feat
                          </span>
                          <button
                            onClick={() => writeParticipantToggle(cParticipant.id, 'alert_feat', cParticipant.alert_feat)}
                            disabled={isSavingAlert}
                            className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5 shrink-0"
                            style={{
                              background: cParticipant.alert_feat ? 'var(--gold-dark)' : 'var(--bg-raised)',
                              border: '1px solid var(--border-light)',
                              cursor: isSavingAlert ? 'wait' : 'pointer',
                              opacity: isSavingAlert ? 0.5 : 1,
                            }}
                          >
                            <div className="w-5 h-5 rounded-full transition-all duration-200"
                              style={{
                                background: cParticipant.alert_feat ? 'var(--gold)' : 'var(--text-dim)',
                                transform: cParticipant.alert_feat ? 'translateX(20px)' : 'translateX(0)',
                              }} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {toggleError && <div className="px-5 pt-2 pb-1"><p className="text-xs" style={{ color: '#e07070' }}>{toggleError}</p></div>}
            </div>

            {/* Monster entries */}
            <div className="rounded-xl parchment" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
              <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Monsters</span>
                <button onClick={() => setMonsters(m => [...m, { name: '', count: '1', initiative: '', hp: '', hpEnabled: false }])}
                  className="text-xs px-2 py-1 rounded transition-all"
                  style={{ color: 'var(--gold)', border: '1px solid var(--gold-dark)', background: 'transparent' }}>
                  + Add
                </button>
              </div>
              {monsters.map((m, i) => (
                <div key={i} className="px-5 py-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={m.name}
                      onChange={e => setMonsters(ms => ms.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Monster name"
                      className="flex-1 min-w-0 px-3 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="tel" inputMode="numeric" pattern="\d*"
                      min={1}
                      value={m.count}
                      onChange={e => setMonsters(ms => ms.map((x, j) => j === i ? { ...x, count: e.target.value } : x))}
                      placeholder="#"
                      className="w-12 px-2 py-2 rounded text-center text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
                    />
                    <input
                      type="tel" inputMode="numeric" pattern="\d*"
                      value={m.initiative}
                      onChange={e => setMonsters(ms => ms.map((x, j) => j === i ? { ...x, initiative: e.target.value } : x))}
                      placeholder="Init"
                      className="w-16 px-2 py-2 rounded text-center text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
                    />
                    {monsters.length > 1 && (
                      <button onClick={() => setMonsters(ms => ms.filter((_, j) => j !== i))}
                        className="px-2 py-1 rounded text-sm"
                        style={{ color: 'var(--text-dim)', background: 'transparent' }}>✕</button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Track HP</span>
                    <button onClick={() => setMonsters(ms => ms.map((x, j) => j === i ? { ...x, hpEnabled: !x.hpEnabled } : x))}
                      className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5 shrink-0"
                      style={{ background: m.hpEnabled ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                      <div className="w-5 h-5 rounded-full transition-all duration-200"
                        style={{ background: m.hpEnabled ? 'var(--gold)' : 'var(--text-dim)', transform: m.hpEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
                    </button>
                    {m.hpEnabled && (
                      <input
                        type="tel" inputMode="numeric" pattern="\d*"
                        value={m.hp}
                        onChange={e => setMonsters(ms => ms.map((x, j) => j === i ? { ...x, hp: e.target.value } : x))}
                        placeholder="Max HP"
                        className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Status */}
            {!allPlayersDone && (
              <p className="text-center text-xs" style={{ color: 'var(--text-dim)' }}>
                Waiting for {pending.length} player{pending.length !== 1 ? 's' : ''} to roll…
              </p>
            )}

            {error && <p className="text-center text-xs" style={{ color: '#e07070' }}>{error}</p>}

            <button onClick={submitDMInitiatives} disabled={saving}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-150 active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif", letterSpacing: '0.08em', boxShadow: '0 4px 20px rgba(201,168,76,0.4)' }}>
              {saving ? 'Setting order…' : (<><img src={crossedAxes} alt="swords" className="h-10 transform inline-block mr-2"/>Review the Order</>)}
            </button>
          </>
        )}

        {/* ── Non-DM waiting state after setting initiative ── */}
        {!isDM && myInitiativeSet && (
          <div className="text-center py-4 fade-in">
            <span className="pulse-dot inline-block mr-2" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--glow-gold)', verticalAlign: 'middle' }} />
            <span style={{ color: 'var(--text-secondary)', fontFamily: "'Cinzel', serif", fontSize: '0.9rem' }}>
              Waiting for DM to begin combat…
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
