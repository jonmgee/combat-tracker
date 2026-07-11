import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/notifications'

// Register the push service worker as early as possible so it's ready
// regardless of which screen the player lands on (e.g. rejoining straight
// into combat, where the lobby never mounts).
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
