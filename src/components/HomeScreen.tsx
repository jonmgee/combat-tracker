import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateRoomCode } from '../lib/utils'
import type { Session, Participant, CombatState } from '../types'

interface Props {
  onEnterLobby: (session: Session, participant: Participant) => void
  onEnterCombat: (session: Session, participant: Participant, state: CombatState) => void
}

export default function HomeScreen({ onEnterLobby, onEnterCombat }: Props) {
  const [mode, setMode] = useState<'idle' | 'join'>('idle')
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreateSession() {
    setLoading(true)
    setError(null)
    try {
      const code = generateRoomCode()

      const { data: session, error: sessionErr } = await supabase
        .from('sessions')
        .insert({ room_code: code, status: 'lobby' })
        .select()
        .single()

      if (sessionErr || !session) throw new Error(sessionErr?.message ?? 'Failed to create session')

      const { data: participant, error: partErr } = await supabase
        .from('participants')
        .insert({ session_id: session.id, name: 'Dungeon Master', role: 'dm' })
        .select()
        .single()

      if (partErr || !participant) throw new Error(partErr?.message ?? 'Failed to register DM')

      onEnterLobby(session, participant)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinSession() {
    if (!playerName.trim()) { setError('Enter your character name'); return }
    if (!roomCode.trim())   { setError('Enter a room code'); return }
    setLoading(true)
    setError(null)
    try {
      const { data: session, error: findErr } = await supabase
        .from('sessions')
        .select()
        .eq('room_code', roomCode.trim().toUpperCase())
        .neq('status', 'ended')
        .single()

      if (findErr || !session) throw new Error('Room not found. Check the code and try again.')

      const { data: participant, error: partErr } = await supabase
        .from('participants')
        .insert({ session_id: session.id, name: playerName.trim(), role: 'player' })
        .select()
        .single()

      if (partErr || !participant) throw new Error(partErr?.message ?? 'Failed to join session')

      // Check if combat has already started
      const { data: combatState } = await supabase
        .from('combat_state')
        .select()
        .eq('session_id', session.id)
        .single()

      if (combatState) {
        // Combat has started — insert combatant
        await supabase.from('combatants').insert({
          session_id:     session.id,
          participant_id: participant.id,
          name:           playerName.trim(),
          kind:           'player',
          initiative:     null,
          initiative_order: null,
          is_hidden:      false,
          hp_enabled:     false,
        })

        onEnterCombat(session, participant, combatState as CombatState)
      } else {
        // Still in lobby phase — go to lobby
        onEnterLobby(session, participant)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10"
      style={{ background: 'var(--bg-void)' }}
    >
      {/* ── Title ── */}
      <div className="text-center mb-10 fade-in">
        {/* Candle glyph */}
        <div className="text-5xl mb-3" style={{ filter: 'drop-shadow(0 0 12px #C9A84C)' }}>🕯️</div>
        <h1
          className="text-4xl font-bold tracking-wider mb-2"
          style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', textShadow: '0 0 20px rgba(201,168,76,0.4)' }}
        >
          Combat Tracker
        </h1>
        <p style={{ color: 'var(--text-dim)', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', letterSpacing: '0.1em' }}>
          TABLETOP RPG · INITIATIVE & COMBAT
        </p>
      </div>

      {/* ── Panel ── */}
      <div
        className="w-full max-w-sm rounded-xl parchment fade-in"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          animationDelay: '0.1s',
        }}
      >
        {mode === 'idle' && (
          <div className="p-7 flex flex-col gap-4">
            <h2
              className="text-center text-lg font-semibold mb-2"
              style={{ fontFamily: "'Cinzel', serif", color: 'var(--text-secondary)', letterSpacing: '0.08em' }}
            >
              Enter the Fray
            </h2>

            {/* Create Session */}
            <button
              onClick={handleCreateSession}
              disabled={loading}
              className="w-full py-4 rounded-lg font-semibold text-base transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
                color: '#1a1410',
                fontFamily: "'Cinzel', serif",
                letterSpacing: '0.06em',
                boxShadow: '0 4px 16px rgba(201,168,76,0.3)',
              }}
            >
              {loading ? 'Preparing…' : '⚔️  Create Session (DM)'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>OR</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* Join Session */}
            <button
              onClick={() => { setMode('join'); setError(null) }}
              className="w-full py-4 rounded-lg font-semibold text-base transition-all duration-150 active:scale-95"
              style={{
                background: 'transparent',
                color: 'var(--gold)',
                border: '1px solid var(--gold-dark)',
                fontFamily: "'Cinzel', serif",
                letterSpacing: '0.06em',
              }}
            >
              🛡️  Join Session
            </button>

            {error && (
              <p className="text-center text-sm" style={{ color: '#e07070' }}>{error}</p>
            )}
          </div>
        )}

        {mode === 'join' && (
          <div className="p-7 flex flex-col gap-4 fade-in">
            <button
              onClick={() => { setMode('idle'); setError(null) }}
              className="flex items-center gap-1 text-sm mb-1 transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← Back
            </button>

            <h2
              className="text-lg font-semibold mb-1"
              style={{ fontFamily: "'Cinzel', serif", color: 'var(--text-secondary)', letterSpacing: '0.08em' }}
            >
              Join the Battle
            </h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. KX7BQ2"
                className="w-full px-4 py-3 rounded-lg text-lg font-mono tracking-widest text-center outline-none transition-all"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--gold)',
                  caretColor: 'var(--gold)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--gold-dark)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-light)')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                Character Name
              </label>
              <input
                type="text"
                maxLength={40}
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Aragorn, son of Arathorn…"
                className="w-full px-4 py-3 rounded-lg outline-none transition-all"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  caretColor: 'var(--gold)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--gold-dark)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-light)')}
              />
            </div>

            <button
              onClick={handleJoinSession}
              disabled={loading}
              className="w-full py-4 rounded-lg font-semibold text-base mt-2 transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
                color: '#1a1410',
                fontFamily: "'Cinzel', serif",
                letterSpacing: '0.06em',
                boxShadow: '0 4px 16px rgba(201,168,76,0.3)',
              }}
            >
              {loading ? 'Joining…' : 'Enter the Room'}
            </button>

            {error && (
              <p className="text-center text-sm" style={{ color: '#e07070' }}>{error}</p>
            )}
          </div>
        )}
      </div>

      <p className="mt-8 text-xs" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
        Phase 1 · Session Management
      </p>
    </div>
  )
}
