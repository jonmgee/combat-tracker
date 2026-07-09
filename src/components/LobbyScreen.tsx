import { useEffect, useState } from 'react'
import lanternLogo from '../assets/Lantern3.webp'
import crossedAxes from '../assets/crossedaxes.webp'
import { supabase } from '../lib/supabase'
import { requestNotificationPermission, registerServiceWorker } from '../lib/notifications'
import type { Session, Participant, CombatState } from '../types'

interface Props {
  session: Session
  me: Participant
  onCombatStart: (state: CombatState) => void
}

export default function LobbyScreen({ session, me, onCombatStart }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading]           = useState(false)
  const [copied, setCopied]             = useState(false)
  const [showQr, setShowQr]             = useState(false)
  const [hpOptIn, setHpOptIn]           = useState(me.hp_opt_in)
  const [startingHp, setStartingHp]     = useState('')
  const [maxHpInput, setMaxHpInput]     = useState('')
  const [isMaxHp, setIsMaxHp]           = useState(true)
  const [notifEnabled, setNotifEnabled] = useState(me.notifications_enabled)
  const [alertFeat, setAlertFeat]       = useState(me.alert_feat)

  const isDM      = me.role === 'dm'
  const canStart  = isDM // gate removed — DM may proceed with zero players

  // ── Initial load ──
  useEffect(() => {
    supabase.from('participants').select('*').eq('session_id', session.id)
      .order('joined_at', { ascending: true })
      .then(({ data }) => { if (data) setParticipants(data as Participant[]) })
  }, [session.id])

  // ── Real-time participants ──
  useEffect(() => {
    const channel = supabase.channel(`lobby:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${session.id}` }, () => {
        supabase.from('participants').select('*').eq('session_id', session.id)
          .order('joined_at', { ascending: true })
          .then(({ data }) => { if (data) setParticipants(data as Participant[]) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id])

  // ── Watch for DM starting combat (for players) ──
  useEffect(() => {
    if (isDM) return
    const channel = supabase.channel(`combat_state:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_state', filter: `session_id=eq.${session.id}` }, (payload) => {
        const state = payload.new as CombatState
        if (state?.phase) onCombatStart(state)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id, isDM, onCombatStart])

  // ── Register SW for notifications ──
  useEffect(() => {
    registerServiceWorker()
  }, [])

  async function toggleHpOptIn() {
    const next = !hpOptIn
    setHpOptIn(next)
    if (next) {
      // Show entry panel — don't save hp_opt_in until they hit Save
      setStartingHp(me.starting_hp?.toString() ?? '')
      setMaxHpInput(me.max_hp_participant?.toString() ?? '')
      setIsMaxHp(!me.max_hp_participant)
    } else {
      await supabase.from('participants').update({ hp_opt_in: false }).eq('id', me.id)
    }
  }

  async function saveHp() {
    const hp = parseInt(startingHp)
    if (isNaN(hp) || hp <= 0) return
    const max = isMaxHp ? hp : parseInt(maxHpInput)
    if (!isMaxHp && (isNaN(max) || max <= 0 || max < hp)) return
    await supabase.from('participants').update({
      hp_opt_in: true,
      starting_hp: hp,
      max_hp_participant: isMaxHp ? null : max,
    }).eq('id', me.id)
  }

  function hpSummary(): string | null {
    const sh = me.starting_hp
    const mh = me.max_hp_participant
    if (sh === null && mh === null) return null
    if (mh) return `HP: ${sh}/${mh}`
    if (sh) return `HP: ${sh}`
    return null
  }

  async function toggleNotifications() {
    const next = !notifEnabled
    setNotifEnabled(next)
    await supabase.from('participants').update({ notifications_enabled: next }).eq('id', me.id)
    if (next) {
      const granted = await requestNotificationPermission()
      if (!granted) alert('Notifications blocked. You can enable them in your browser settings.')
    }
  }

  async function toggleAlertFeat() {
    const next = !alertFeat
    setAlertFeat(next)
    await supabase.from('participants').update({ alert_feat: next }).eq('id', me.id)
  }

  async function handleStartCombat() {
    setLoading(true)
    try {
      // Update session status
      await supabase.from('sessions').update({ status: 'active' }).eq('id', session.id)

      // Create a combatant row for each player participant (real + DM-added)
      const playerParts = participants.filter(p => p.role === 'player') // dm_pc are created per-encounter by InitiativeEntry
      const combatantRows = playerParts.map(p => ({
        session_id:     session.id,
        participant_id: p.id,
        name:           p.name,
        kind:           'player',
        is_hidden:      false,
        hp_enabled:     p.hp_opt_in,
        current_hp:     p.starting_hp,
        max_hp:         p.max_hp_participant ?? p.starting_hp,
      }))
      await supabase.from('combatants').insert(combatantRows)

      // Create combat_state row
      const { data: state } = await supabase.from('combat_state')
        .insert({ session_id: session.id, phase: 'initiative', round_number: 1 })
        .select().single()

      if (state) onCombatStart(state as CombatState)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(session.room_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-10" style={{ background: 'var(--bg-void)' }}>

      {/* ── Header ── */}
      <div className="text-center mb-8 fade-in">
        <div className="mb-2 flex justify-center">
          <img src={lanternLogo} alt="Lantern" className="h-28" style={{ filter: 'drop-shadow(0 0 20px #C9A84C)' }} />
        </div>
        <h1 className="text-3xl font-bold tracking-wider" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', textShadow: '0 0 16px rgba(201,168,76,0.4)' }}>
          {isDM ? 'Your War Room' : 'The Lobby'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
          {isDM ? 'Share the code. When ready, begin.' : 'Waiting for the Dungeon Master…'}
        </p>
      </div>

      {/* ── Room code ── */}
      <div className="w-full max-w-sm rounded-xl mb-5 parchment fade-in"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--gold-dark)', boxShadow: '0 0 24px rgba(201,168,76,0.15)', animationDelay: '0.05s' }}>
        <div className="p-6 text-center">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Room Code</p>
          <div className="text-5xl font-bold tracking-widest mb-4 candle-flicker"
            style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', letterSpacing: '0.25em' }}>
            {session.room_code}
          </div>
          <div className="flex justify-center gap-3 mt-3">
            <button onClick={copyCode}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95"
              style={{ background: copied ? 'var(--bg-raised)' : 'transparent', color: copied ? 'var(--gold-light)' : 'var(--text-dim)', border: '1px solid var(--border-light)', letterSpacing: '0.06em' }}>
              {copied ? '✓ Copied' : 'Copy Code'}
            </button>
            {showQr ? (
              <button onClick={() => setShowQr(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95"
                style={{ background: 'var(--bg-raised)', color: 'var(--gold)', border: '1px solid var(--gold-dark)', letterSpacing: '0.06em' }}>
                ✕ Close QR
              </button>
            ) : isDM && (
              <button onClick={() => setShowQr(true)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95"
                style={{ background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border-light)', letterSpacing: '0.06em' }}>
                QR Code
              </button>
            )}
          </div>

          {showQr && (
            <div className="mt-4 fade-in">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('https://torchandturn.com/?join=' + session.room_code)}`}
                alt="QR code to join this room"
                className="mx-auto"
                style={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
              />
              <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>Scan with a phone camera to join</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Participants ── */}
      <div className="w-full max-w-sm rounded-xl mb-5 parchment fade-in"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', animationDelay: '0.1s' }}>
        <div className="px-5 pt-5 pb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Adventurers</span>
        </div>
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {participants.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3.5 fade-in">
              <span className="pulse-dot shrink-0" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--glow-gold)', display: 'inline-block' }} />
              <span className="flex-1 text-base" style={{ color: p.id === me.id ? 'var(--gold-light)' : 'var(--text-primary)', fontWeight: p.id === me.id ? 600 : 400 }}>
                {p.name}
              </span>
              {p.role === 'player' && p.hp_opt_in && (
                <span className="text-xs" title="HP tracking enabled" style={{ color: 'var(--text-dim)' }}>❤️</span>
              )}
              <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                style={{ background: p.role === 'dm' ? 'rgba(201,168,76,0.15)' : 'var(--bg-raised)', color: p.role === 'dm' ? 'var(--gold)' : 'var(--text-dim)', border: p.role === 'dm' ? '1px solid var(--gold-dark)' : '1px solid var(--border)', fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                {p.role === 'dm' ? 'DM' : 'Player'}
              </span>
            </li>
          ))}
          {participants.length === 0 && (
            <li className="px-5 py-6 text-center" style={{ color: 'var(--text-dim)' }}>
              <span className="text-2xl block mb-2">⚔️</span>
              <span className="text-sm">No adventurers yet…</span>
            </li>
          )}
        </ul>
      </div>

      {/* ── Player options ── */}
      {!isDM && (
        <div className="w-full max-w-sm flex flex-col gap-3 mb-5 fade-in" style={{ animationDelay: '0.12s' }}>
              {/* HP opt-in */}
          <div className="w-full rounded-xl"
            style={{ background: 'var(--bg-panel)', border: `1px solid ${hpOptIn ? 'var(--gold-dark)' : 'var(--border)'}` }}>
            <button onClick={toggleHpOptIn}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all duration-150 active:scale-95"
              style={{ background: 'transparent' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">❤️</span>
                <div className="text-left">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Track my HP</div>
                  <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Optional — only you will see it</div>
                </div>
              </div>
              <div className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5"
                style={{ background: hpOptIn ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)' }}>
                <div className="w-5 h-5 rounded-full transition-all duration-200"
                  style={{ background: hpOptIn ? 'var(--gold)' : 'var(--text-dim)', transform: hpOptIn ? 'translateX(20px)' : 'translateX(0)' }} />
              </div>
            </button>

            {/* HP entry panel — shown when toggle is ON but no HP saved yet */}
            {hpOptIn && (me.starting_hp === null || hpSummary() === null) && (
              <div className="px-5 pb-4 fade-in" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="pt-3 flex flex-col gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>Current HP</label>
                    <input
                      type="tel" inputMode="numeric" pattern="\d*"
                      min={1}
                      value={startingHp}
                      onChange={e => setStartingHp(e.target.value)}
                      placeholder="e.g. 42"
                      className="w-full px-3 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMaxHp}
                      onChange={e => setIsMaxHp(e.target.checked)}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>This is my max HP</span>
                  </label>

                  {!isMaxHp && (
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--text-dim)' }}>Max HP</label>
                      <input
                        type="tel" inputMode="numeric" pattern="\d*"
                        min={1}
                        value={maxHpInput}
                        onChange={e => setMaxHpInput(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full px-3 py-2 rounded text-sm outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  )}

                  <button
                    onClick={saveHp}
                    disabled={!startingHp || parseInt(startingHp) <= 0}
                    className="w-full py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--gold-dark)', color: '#1a1410' }}
                  >
                    Save HP
                  </button>
                </div>
              </div>
            )}

            {/* HP summary — shown when HP is saved */}
            {hpOptIn && hpSummary() !== null && (
              <div className="px-5 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="pt-2 text-sm" style={{ color: 'var(--gold-light)', fontFamily: "'Cinzel', serif", letterSpacing: '0.04em' }}>
                  {hpSummary()}
                </div>
              </div>
            )}
          </div>

          {/* Notification toggle */}
          <button onClick={toggleNotifications}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all duration-150 active:scale-95"
            style={{ background: 'var(--bg-panel)', border: `1px solid ${notifEnabled ? 'var(--gold-dark)' : 'var(--border)'}` }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">🔔</span>
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Turn notifications</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Get an alert when it's your turn</div>
              </div>
            </div>
            <div className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5"
              style={{ background: notifEnabled ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)' }}>
              <div className="w-5 h-5 rounded-full transition-all duration-200"
                style={{ background: notifEnabled ? 'var(--gold)' : 'var(--text-dim)', transform: notifEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
          </button>

          {/* Alert Feat toggle */}
          <button onClick={toggleAlertFeat}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl transition-all duration-150 active:scale-95"
            style={{ background: 'var(--bg-panel)', border: `1px solid ${alertFeat ? 'var(--gold-dark)' : 'var(--border)'}` }}>
            <div className="flex items-center gap-3">
              <span className="text-xl" style={{ filter: alertFeat ? 'none' : 'grayscale(0.6)' }}>⚡</span>
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Alert Feat</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Swap initiative with an ally once per encounter</div>
              </div>
            </div>
            <div className="rounded-full w-11 h-6 flex items-center transition-all duration-200 px-0.5"
              style={{ background: alertFeat ? 'var(--gold-dark)' : 'var(--bg-raised)', border: '1px solid var(--border-light)' }}>
              <div className="w-5 h-5 rounded-full transition-all duration-200"
                style={{ background: alertFeat ? 'var(--gold)' : 'var(--text-dim)', transform: alertFeat ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
          </button>
        </div>
      )}

      {/* ── DM action / Player waiting ── */}
      <div className="w-full max-w-sm fade-in" style={{ animationDelay: '0.15s' }}>
        {isDM ? (
          <>
            <button onClick={handleStartCombat} disabled={!canStart || loading}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canStart ? 'linear-gradient(135deg, var(--gold-dark), var(--gold))' : 'var(--bg-raised)', color: canStart ? '#1a1410' : 'var(--text-dim)', fontFamily: "'Cinzel', serif", letterSpacing: '0.08em', boxShadow: canStart ? '0 4px 20px rgba(201,168,76,0.4)' : 'none', border: canStart ? 'none' : '1px solid var(--border)' }}>
              {loading ? 'Preparing battle…' : canStart ? (<><img src={crossedAxes} alt="swords" className="h-10 transform inline-block mr-2"/>Prepare Encounter</>) : 'Waiting for Players…'}
            </button>

          </>
        ) : (
          <div className="w-full py-4 rounded-xl text-center" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            <span className="pulse-dot inline-block mr-2" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--glow-gold)', verticalAlign: 'middle' }} />
            <span style={{ color: 'var(--text-secondary)', fontFamily: "'Cinzel', serif", letterSpacing: '0.06em', fontSize: '0.95rem' }}>
              Waiting for DM to start…
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
