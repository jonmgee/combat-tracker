import { useState } from 'react'
import HomeScreen from './components/HomeScreen'
import LobbyScreen from './components/LobbyScreen'
import type { Session, Participant } from './types'

type Screen = 'home' | 'lobby'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Participant | null>(null)

  function handleEnterLobby(s: Session, p: Participant) {
    setSession(s)
    setMe(p)
    setScreen('lobby')
  }

  if (screen === 'lobby' && session && me) {
    return <LobbyScreen session={session} me={me} />
  }

  return <HomeScreen onEnterLobby={handleEnterLobby} />
}
