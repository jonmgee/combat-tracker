import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, Participant } from '../types'

interface Props {
  session: Session
  me: Participant
}

export default function LobbyScreen({ session, me }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const isDM = me.role === 'dm'
  const players = participants.filter(p => p.role === 'player')
  const canStart = isDM && players.length >= 1

  // ── Initial load ──
  useEffect(() => {
    supabase
      .from('participants')
      .select('*')
      .eq('session_id', session.id)
      .order('joined_at', { ascending: true })
      .then(({ data }) => { if (data) setParticipants(data) })
  }, [session.id])

  // ── Real-time subscription ──
  useEffect(() => {
    const channel = supabase
      .channel(`lobby:${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${session.id}` },
        () => {
          // Re-fetch on any change
          supabase
            .from('participants')
            .select('*')
            .eq('session_id', session.id)
            .order('joined_at', { ascending: true })
            .then(({ data }) => { if (data) setParticipants(data) })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session.id])

  async function handleStartCombat() {
    if (!canStart) return
    setLoading(true)
    await supabase
      .from('sessions')
      .update({ status: 'active' })
      .eq('id', session.id)
    // Phase 2 will navigate to the combat screen
    setLoading(false)
    alert('Combat started! (Phase 2 will open the tracker here)')
  }

  function copyCode() {
    navigator.clipboard.writeText(session.room_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-5 py-10"
      style={{ background: 'var(--bg-void)' }}
    >
      {/* ── Header ── */}
      <div className="text-center mb-8 fade-in">
        <div className="text-4xl mb-2" style={{ filter: 'drop-shadow(0 0 10px #C9A84C)' }}>🕯️</div>
        <h1
          className="text-3xl font-bold tracking-wider"
          style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', textShadow: '0 0 16px rgba(201,168,76,0.4)' }}
        >
          {isDM ? 'Your War Room' : 'The Lobby'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
          {isDM ? 'Share the code. When ready, begin.' : 'Waiting for the Dungeon Master…'}
        </p>
      </div>

      {/* ── Room code panel ── */}
      <div
        className="w-full max-w-sm rounded-xl mb-5 parchment fade-in"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--gold-dark)',
          boxShadow: '0 0 24px rgba(201,168,76,0.15)',
          animationDelay: '0.05s',
        }}
      >
        <div className="p-6 text-center">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
            Room Code
          </p>
          <div
            className="text-5xl font-bold tracking-widest mb-4 candle-flicker"
            style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', letterSpacing: '0.25em' }}
          >
            {session.room_code}
          </div>
          <button
            onClick={copyCode}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95"
            style={{
              background: copied ? 'var(--bg-raised)' : 'transparent',
              color: copied ? 'var(--gold-light)' : 'var(--text-dim)',
              border: '1px solid var(--border-light)',
              letterSpacing: '0.06em',
            }}
          >
            {copied ? '✓ Copied' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* ── Participants panel ── */}
      <div
        className="w-full max-w-sm rounded-xl mb-5 parchment fade-in"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animationDelay: '0.1s',
        }}
      >
        <div className="px-5 pt-5 pb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Adventurers
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: 'var(--bg-raised)', color: 'var(--gold)', border: '1px solid var(--border-light)' }}
          >
            {participants.length}
          </span>
        </div>

        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {participants.map(p => (
            <li
              key={p.id}
              className="flex items-center gap-3 px-5 py-3.5 fade-in"
            >
              {/* Status dot */}
              <span
                className="pulse-dot shrink-0"
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: 'var(--gold)',
                  boxShadow: '0 0 6px var(--glow-gold)',
                  display: 'inline-block',
                }}
              />
              <span
                className="flex-1 text-base"
                style={{
                  color: p.id === me.id ? 'var(--gold-light)' : 'var(--text-primary)',
                  fontWeight: p.id === me.id ? 600 : 400,
                }}
              >
                {p.name}
              </span>
              <span
                className="text-xs uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                style={{
                  background: p.role === 'dm' ? 'rgba(201,168,76,0.15)' : 'var(--bg-raised)',
                  color: p.role === 'dm' ? 'var(--gold)' : 'var(--text-dim)',
                  border: p.role === 'dm' ? '1px solid var(--gold-dark)' : '1px solid var(--border)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                }}
              >
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

      {/* ── DM action / Player waiting ── */}
      <div className="w-full max-w-sm fade-in" style={{ animationDelay: '0.15s' }}>
        {isDM ? (
          <button
            onClick={handleStartCombat}
            disabled={!canStart || loading}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canStart
                ? 'linear-gradient(135deg, var(--gold-dark), var(--gold))'
                : 'var(--bg-raised)',
              color: canStart ? '#1a1410' : 'var(--text-dim)',
              fontFamily: "'Cinzel', serif",
              letterSpacing: '0.08em',
              boxShadow: canStart ? '0 4px 20px rgba(201,168,76,0.4)' : 'none',
              border: canStart ? 'none' : '1px solid var(--border)',
            }}
          >
            {loading ? 'Starting…' : canStart ? '⚔️  Start Combat' : 'Waiting for Players…'}
          </button>
        ) : (
          <div
            className="w-full py-4 rounded-xl text-center"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}
          >
            <span className="pulse-dot inline-block mr-2" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--glow-gold)', verticalAlign: 'middle' }} />
            <span style={{ color: 'var(--text-secondary)', fontFamily: "'Cinzel', serif", letterSpacing: '0.06em', fontSize: '0.95rem' }}>
              Waiting for DM to start…
            </span>
          </div>
        )}

        {isDM && !canStart && (
          <p className="text-center text-xs mt-3" style={{ color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
            At least one player must join before combat can begin
          </p>
        )}
      </div>
    </div>
  )
}
