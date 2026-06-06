import { useState, useCallback } from 'react'
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

  function handleEnterLobby(s: Session, p: Participant) {
    setSession(s)
    setMe(p)
    setScreen('lobby')
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
  }

  const handleReturnToLobby = useCallback(() => {
    setScreen('lobby')
  }, [])

  if (screen === 'combat' && session && me && combatState) {
    return <ErrorBoundary><CombatScreen session={session} me={me} initialState={combatState} onReturnToLobby={handleReturnToLobby} /></ErrorBoundary>
  }

  if (screen === 'lobby' && session && me) {
    return <LobbyScreen session={session} me={me} onCombatStart={handleCombatStart} />
  }

  return <HomeScreen onEnterLobby={handleEnterLobby} onEnterCombat={handleEnterCombat} />
}
