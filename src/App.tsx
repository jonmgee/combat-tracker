import { useState, useCallback, useEffect } from 'react'
import { supabase } from './lib/supabase'
import HomeScreen from './components/HomeScreen'
import LobbyScreen from './components/LobbyScreen'
import CombatScreen from './components/CombatScreen'
import ErrorBoundary from './components/ErrorBoundary'
import type { Session, Participant, CombatState } from './types'

type Screen = 'home' | 'lobby' | 'combat'

export default function App() {
  const [screen, setScreen]           = useState<Screen>('home')
  const [session, setSession]         = useState<Session | null>(null)
  const [me, setMe]                   = useState<Participant | null>(null)
  const [combatState, setCombatState] = useState<CombatState | null>(null)

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
    setScreen('combat')
    saveRecovery(session.id, participant.id)
  }

  const handleReturnToLobby = useCallback(() => {
    setScreen('lobby')
    // Don't clear recovery — participant is still valid
  }, [])

  // ── Recovery: auto-restore session on app reload / phone wake ──
  useEffect(() => {
    let raw: string | null = null
    try { raw = localStorage.getItem('torch_recovery') } catch { /* noop */ }
    if (!raw) return

    let recovery: { sessionId: string; participantId: string }
    try { recovery = JSON.parse(raw) } catch { return }

    if (!recovery.sessionId || !recovery.participantId) return

    ;(async () => {
      // Fetch session
      const { data: sess } = await supabase
        .from('sessions')
        .select()
        .eq('id', recovery.sessionId)
        .neq('status', 'ended')
        .single()
      if (!sess) { clearRecovery(); return }

      // Fetch participant
      const { data: part } = await supabase
        .from('participants')
        .select()
        .eq('id', recovery.participantId)
        .eq('session_id', recovery.sessionId)
        .single()
      if (!part) { clearRecovery(); return }

      const s = sess as Session
      const p = part as Participant

      setSession(s)
      setMe(p)

      // Check if combat is active
      const { data: cs } = await supabase
        .from('combat_state')
        .select()
        .eq('session_id', recovery.sessionId)
        .maybeSingle()

      if (cs) {
        setCombatState(cs as CombatState)
        setScreen('combat')
      } else {
        setScreen('lobby')
      }
    })()
  }, [])

  if (screen === 'combat' && session && me && combatState) {
    return <ErrorBoundary><CombatScreen session={session} me={me} initialState={combatState} onReturnToLobby={handleReturnToLobby} /></ErrorBoundary>
  }

  if (screen === 'lobby' && session && me) {
    return <LobbyScreen session={session} me={me} onCombatStart={handleCombatStart} />
  }

  return <HomeScreen onEnterLobby={handleEnterLobby} onEnterCombat={handleEnterCombat} />
}
