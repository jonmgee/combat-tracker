import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import HomeScreen from './components/HomeScreen'
import LobbyScreen from './components/LobbyScreen'
import CombatScreen from './components/CombatScreen'
import ErrorBoundary from './components/ErrorBoundary'
import lanternLogo from './assets/Lantern3.png'
import type { Session, Participant, CombatState } from './types'

type Screen = 'home' | 'lobby' | 'combat'

export default function App() {
  const [screen, setScreen]           = useState<Screen>('home')
  const [session, setSession]         = useState<Session | null>(null)
  const [me, setMe]                   = useState<Participant | null>(null)
  const [combatState, setCombatState] = useState<CombatState | null>(null)

  // ── Recovery picker state ──
  const [pendingRecovery, setPendingRecovery] = useState<{
    session: Session
    participant: Participant
    combatState: CombatState | null
    code: string
  } | null>(null)

  const [countdown, setCountdown] = useState(5)
  const countdownActive = useRef(true)

  // ── Safe entry to localStorage — handles SSR / private browsing ──
  function saveRecovery(sessionId: string, participantId: string) {
    try {
      localStorage.setItem('torch_recovery', JSON.stringify({ sessionId, participantId }))
    } catch { /* noop */ }
  }

  function clearRecovery() {
    try { localStorage.removeItem('torch_recovery') } catch { /* noop */ }
  }

  function handleEnterLobby(s: Session, p: Participant) {
    setSession(s)
    setMe(p)
    setPendingRecovery(null)
    setScreen('lobby')
    saveRecovery(s.id, p.id)
  }

  function handleCombatStart(state: CombatState) {
    setCombatState(state)
    setScreen('combat')
  }

  function handleEnterCombat(session: Session, participant: Participant, state: CombatState) {
    setSession(session)
    setMe(participant)
    setCombatState(state)
    setPendingRecovery(null)
    setScreen('combat')
    saveRecovery(session.id, participant.id)
  }

  const handleReturnToLobby = useCallback(() => {
    setScreen('lobby')
  }, [])

  // ── Recovery: show picker on mount if token exists ──
  useEffect(() => {
    // Handle ?clear URL param first
    const params = new URLSearchParams(window.location.search)
    if (params.has('clear')) {
      clearRecovery()
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    let raw: string | null = null
    try { raw = localStorage.getItem('torch_recovery') } catch { /* noop */ }
    if (!raw) return

    let recovery: { sessionId: string; participantId: string }
    try { recovery = JSON.parse(raw) } catch { return }

    if (!recovery.sessionId || !recovery.participantId) return

    ;(async () => {
      const { data: sess } = await supabase
        .from('sessions')
        .select()
        .eq('id', recovery.sessionId)
        .neq('status', 'ended')
        .single()
      if (!sess) { clearRecovery(); return }

      const { data: part } = await supabase
        .from('participants')
        .select()
        .eq('id', recovery.participantId)
        .eq('session_id', recovery.sessionId)
        .single()
      if (!part) { clearRecovery(); return }

      const s = sess as Session
      const p = part as Participant

      const { data: cs } = await supabase
        .from('combat_state')
        .select()
        .eq('session_id', recovery.sessionId)
        .maybeSingle()

      setPendingRecovery({
        session: s,
        participant: p,
        combatState: cs as CombatState | null,
        code: s.room_code,
      })
      setCountdown(5)
      countdownActive.current = true
    })()
  }, [])

  // ── Countdown timer for recovery picker ──
  useEffect(() => {
    if (!pendingRecovery) return
    if (countdown <= 0) {
      handleRejoin()
      return
    }
    if (!countdownActive.current) return

    const timer = setTimeout(() => {
      setCountdown(c => c - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [pendingRecovery, countdown])

  function handleRejoin() {
    if (!pendingRecovery) return
    const { session, participant, combatState } = pendingRecovery
    setSession(session)
    setMe(participant)

    if (combatState) {
      setCombatState(combatState)
      setScreen('combat')
    } else {
      setScreen('lobby')
    }
    saveRecovery(session.id, participant.id)
    setPendingRecovery(null)
  }

  function handleExitSession() {
    clearRecovery()
    setPendingRecovery(null)
    setSession(null)
    setMe(null)
    setCombatState(null)
    setScreen('home')
  }

  function cancelCountdown() {
    countdownActive.current = false
  }

  // ── Recovery picker overlay ──
  if (pendingRecovery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10" style={{ background: 'var(--bg-void)' }}>
        <div
          className="rounded-xl p-8 max-w-sm w-full text-center"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--gold-dark)', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }}
        >
          <div className="mb-4 flex justify-center">
            <img src={lanternLogo} alt="" className="h-24" style={{ filter: 'drop-shadow(0 0 16px rgba(201,168,76,0.6))' }} />
          </div>

          <h3
            className="text-xl font-bold mb-2"
            style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', letterSpacing: '0.06em' }}
          >
            Session Found
          </h3>

          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            You were in a session with room code
          </p>
          <p className="text-2xl font-bold mb-5" style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold-light)', letterSpacing: '0.15em' }}>
            {pendingRecovery.code}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => { cancelCountdown(); handleRejoin() }}
              onMouseEnter={cancelCountdown}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))', color: '#1a1410', fontFamily: "'Cinzel', serif" }}
            >
              Rejoin {countdownActive.current ? `(${countdown})` : '↗'}
            </button>

            <button
              onClick={() => { cancelCountdown(); handleExitSession() }}
              onMouseEnter={cancelCountdown}
              className="w-full py-3 rounded-lg text-sm transition-all active:scale-95"
              style={{ background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', fontFamily: "'Cinzel', serif" }}
            >
              Exit current session
            </button>
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--text-dim)' }}>
            Auto-rejoining in {countdown} second{countdown !== 1 ? 's' : ''}…
          </p>
        </div>
      </div>
    )
  }

  if (screen === 'combat' && session && me && combatState) {
    return <ErrorBoundary><CombatScreen session={session} me={me} initialState={combatState} onReturnToLobby={handleReturnToLobby} /></ErrorBoundary>
  }

  if (screen === 'lobby' && session && me) {
    return <LobbyScreen session={session} me={me} onCombatStart={handleCombatStart} />
  }

  return <HomeScreen onEnterLobby={handleEnterLobby} onEnterCombat={handleEnterCombat} />
}