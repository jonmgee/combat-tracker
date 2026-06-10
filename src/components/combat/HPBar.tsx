import { useState } from 'react'
import { supabase } from '../../lib/supabase'
 
interface Props {
  combatantId: string
  currentHp: number
  maxHp: number
  tempHp: number
  isBloodied?: boolean
  isDead?: boolean
}
 
export default function HPBar({ combatantId, currentHp, maxHp, tempHp, isBloodied = false, isDead = false }: Props) {
  const [editing, setEditing] = useState(false)
  const [delta, setDelta]     = useState('')

  // Dead state — show skull
  if (isDead) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono" style={{ color: 'var(--text-dim)', minWidth: '48px', textAlign: 'left' }}>
            💀 0/0
          </span>
        </div>
      </div>
    )
  }

  const effectiveHp = currentHp + tempHp
 
  const pct = Math.max(0, Math.min(100, (effectiveHp / maxHp) * 100))
  const realPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
 
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

    if (sign === 1) {
      // Healing — only affects real HP, not temp HP (5e rule: temp HP can't be healed)
      const next = Math.min(maxHp, currentHp + val)
      await supabase.from('combatants').update({ current_hp: next }).eq('id', combatantId)
    } else {
      // Damage — hits temp HP first
      let remaining = val
      let newTemp = tempHp
      let newHp = currentHp

      if (newTemp > 0) {
        if (remaining >= newTemp) {
          remaining -= newTemp
          newTemp = 0
        } else {
          newTemp -= remaining
          remaining = 0
        }
      }

      if (remaining > 0) {
        newHp = Math.max(0, newHp - remaining)
      }

      if (newHp <= 0) {
        await supabase.from('combatants').update({ current_hp: 0, temp_hp: 0, dead: true }).eq('id', combatantId)
      } else {
        await supabase.from('combatants').update({ current_hp: newHp, temp_hp: newTemp }).eq('id', combatantId)
      }
    }

    setDelta('')
    setEditing(false)
  }

  // Display string: show "hp+temp/max" when temp HP present
  const hpDisplay = tempHp > 0
    ? `${currentHp}+${tempHp}/${maxHp}`
    : `${currentHp}/${maxHp}`
 
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 rounded-full overflow-hidden relative" style={{ height: '5px', background: 'rgba(255,255,255,0.06)' }}>
          {/* Base HP bar */}
          <div style={{
            width: `${realPct}%`,
            height: '100%',
            background: barColor,
            borderRadius: '9999px',
            transition: 'width 0.3s ease',
            boxShadow: isBloodied ? '0 0 6px rgba(160,30,20,0.5)' : pct <= 25 ? '0 0 5px rgba(176,48,48,0.4)' : 'none',
          }}/>
          {/* Temp HP overlay — sits on top, lighter colour */}
          {tempHp > 0 && (
            <div style={{
              position: 'absolute',
              right: `${100 - Math.min(100, (effectiveHp / maxHp) * 100)}%`,
              left: `${realPct}%`,
              top: 0,
              bottom: 0,
              background: 'rgba(200,180,220,0.5)',
              borderRadius: '0 9999px 9999px 0',
              transition: 'left 0.3s ease, right 0.3s ease',
            }}/>
          )}
        </div>
        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)', minWidth: '60px', textAlign: 'right' }}>
          {hpDisplay}
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
            type="tel" inputMode="numeric" pattern="\d*"
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