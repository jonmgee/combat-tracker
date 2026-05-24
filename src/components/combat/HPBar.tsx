import { useState } from 'react'
import { supabase } from '../../lib/supabase'
 
interface Props {
  combatantId: string
  currentHp: number
  maxHp: number
  isBloodied?: boolean
}
 
export default function HPBar({ combatantId, currentHp, maxHp, isBloodied = false }: Props) {
  const [editing, setEditing] = useState(false)
  const [delta, setDelta]     = useState('')
 
  const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
 
  // Warm tavern palette instead of clinical greens
  const barColor = isBloodied
    ? 'linear-gradient(to right, #6a1010, #a83030)'   // bloodied — deep red
    : pct > 50
    ? '#4a8e3a'                                         // healthy — forest green
    : pct > 25
    ? '#c8873a'                                         // hurt — amber
    : '#b03030'                                         // critical — red
 
  async function applyDelta(sign: 1 | -1) {
    const val = parseInt(delta)
    if (isNaN(val) || val <= 0) return
    const next = Math.max(0, Math.min(maxHp, currentHp + sign * val))
    await supabase.from('combatants').update({ current_hp: next }).eq('id', combatantId)
    setDelta('')
    setEditing(false)
  }
 
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: '5px', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: barColor,
            borderRadius: '9999px',
            transition: 'width 0.3s ease',
            boxShadow: isBloodied ? '0 0 6px rgba(160,30,20,0.5)' : pct <= 25 ? '0 0 5px rgba(176,48,48,0.4)' : 'none',
          }}/>
        </div>
        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)', minWidth: '48px', textAlign: 'right' }}>
          {currentHp}/{maxHp}
        </span>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-xs px-1.5 py-0.5 rounded transition-all"
          style={{ color: 'var(--text-dim)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>
          {editing ? '✕' : '±'}
        </button>
      </div>
 
      {editing && (
        <div className="flex gap-1.5 mt-1 fade-in">
          <input
            type="number"
            value={delta}
            onChange={e => setDelta(e.target.value)}
            placeholder="Amount"
            className="flex-1 px-2 py-1.5 rounded text-sm text-center outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <button onClick={() => applyDelta(1)}
            className="px-3 py-1.5 rounded text-sm font-bold transition-all active:scale-95"
            style={{ background: 'rgba(74,142,58,0.15)', color: '#4a8e3a', border: '1px solid rgba(74,142,58,0.3)' }}>
            +
          </button>
          <button onClick={() => applyDelta(-1)}
            className="px-3 py-1.5 rounded text-sm font-bold transition-all active:scale-95"
            style={{ background: 'rgba(176,48,48,0.15)', color: '#c06060', border: '1px solid rgba(176,48,48,0.3)' }}>
            −
          </button>
        </div>
      )}
    </div>
  )
}
 