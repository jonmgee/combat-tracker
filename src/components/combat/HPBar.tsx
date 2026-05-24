import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  combatantId: string
  currentHp: number
  maxHp: number
}

export default function HPBar({ combatantId, currentHp, maxHp }: Props) {
  const [editing, setEditing] = useState(false)
  const [delta, setDelta]     = useState('')

  const pct     = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const barColor = pct > 50 ? '#4ade80' : pct > 25 ? '#facc15' : '#f87171'

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
      {/* Bar */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 rounded-full overflow-hidden" style={{ height: '6px', background: 'var(--bg-void)' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '9999px', transition: 'width 0.3s ease' }} />
        </div>
        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)', minWidth: '48px', textAlign: 'right' }}>
          {currentHp}/{maxHp}
        </span>
        <button onClick={() => setEditing(e => !e)}
          className="text-xs px-1.5 py-0.5 rounded transition-all"
          style={{ color: 'var(--text-dim)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>
          {editing ? '✕' : '±'}
        </button>
      </div>

      {/* Inline editor */}
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
            style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
            +
          </button>
          <button onClick={() => applyDelta(-1)}
            className="px-3 py-1.5 rounded text-sm font-bold transition-all active:scale-95"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
            −
          </button>
        </div>
      )}
    </div>
  )
}
