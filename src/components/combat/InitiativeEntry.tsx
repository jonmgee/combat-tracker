import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Combatant, Participant } from '../../types'

interface Props {
  sessionId: string
  combatants: Combatant[]
  me: Participant
  onReady: () => void
}

export default function InitiativeEntry({ sessionId, combatants, me, onReady }: Props) {
  const isDM = me.role === 'dm'

  // Initiatives keyed by combatant id
  const [initiatives, setInitiatives] = useState<Record<string, string>>({})
  // Monster rows (DM only)
  const [monsters, setMonsters] = useState<{ name: string; count: string; initiative: string; hp: string; hpEnabled: boolean }[]>([
    { name: '', count: '1', initiative: '', hp: '', hpEnabled: false }
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

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
      // Update player initiatives — any player still pending stays null (they'll roll during combat)
      for (const c of combatants) {
        const val = parseInt(initiatives[c.id] ?? '')
        if (!isNaN(val)) {
          await supabase.from('combatants').update({ initiative: val }).eq('id', c.id)
        }
      }
      // Insert monsters
      const validMonsters = monsters.filter(m => m.name.trim() && m.initiative.trim())
      if (validMonsters.length > 0) {
        // Insert each monster as a separate combatant with group count
      for (const m of validMonsters) {
        const groupCount = Math.max(1, parseInt(m.count) || 1)
        await supabase.from('combatants').insert({
          session_id:  sessionId,
          name:        m.name.trim(),
          kind:        'monster',
          initiative:  parseInt(m.initiative),
          is_hidden:   true,
          count:       groupCount,
          hp_enabled:  m.hpEnabled,
          max_hp:      m.hpEnabled && m.hp ? parseInt(m.hp) : null,
          current_hp:  m.hpEnabled && m.hp ? parseInt(m.hp) : null,
        })
      }
      }
      onReady()
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
        <div className="text-4xl mb-2">⚔️</div>
        <h1 className="text-3xl font-bold tracking-wider" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', textShadow: '0 0 16px rgba(201,168,76,0.4)' }}>
          Roll for Initiative
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
          {isDM ? 'Enter initiatives for all combatants and add monsters' : 'Enter your initiative roll'}
        </p>
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
                      type="number"
                      min={1} max={30}
                      value={hasMyCombatant ? (initiatives[myCombatant!.id] ?? '') : ''}
                      onChange={e => myCombatant && setInitiatives(p => ({ ...p, [myCombatant.id]: e.target.value }))}
                      placeholder="e.g. 17"
                      className="flex-1 px-4 py-3 rounded-lg text-2xl text-center outline-none"
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
              <div className="px-5 pt-4 pb-1">
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Players</span>
              </div>
              {combatants.filter(c => c.kind === 'player').map(c => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  {c.initiative !== null ? (
                    <span className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{c.initiative}</span>
                  ) : (
                    <input
                      type="number"
                      value={initiatives[c.id] ?? ''}
                      onChange={e => setInitiatives(p => ({ ...p, [c.id]: e.target.value }))}
                      placeholder="—"
                      className="w-16 px-2 py-1.5 rounded text-center outline-none text-sm"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
                    />
                  )}
                </div>
              ))}
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
                      className="flex-1 px-3 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={m.count}
                      onChange={e => setMonsters(ms => ms.map((x, j) => j === i ? { ...x, count: e.target.value } : x))}
                      placeholder="#"
                      className="w-12 px-2 py-2 rounded text-center text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--gold)' }}
                    />
                    <input
                      type="number"
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
                    <button onClick={() => setMonsters(ms => ms.map((x, j) => j === i ? { ...x, hpEnabled: !x.hpEnabled } : x))}
                      className="flex items-center gap-2 text-xs transition-all"
                      style={{ color: m.hpEnabled ? 'var(--gold)' : 'var(--text-dim)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                      <span>{m.hpEnabled ? '❤️' : '🩶'}</span> Track HP
                    </button>
                    {m.hpEnabled && (
                      <input
                        type="number"
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
              {saving ? 'Setting order…' : '⚔️  Lock In & Begin Combat'}
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
