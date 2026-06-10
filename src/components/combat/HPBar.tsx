import { useState, useRef } from 'react'
import { flushSync } from 'react-dom'
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
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      // Try a couple of focus strategies to ensure mobile keyboards reliably open and the field is visible.
      try { inputRef.current?.scrollIntoView({ block: 'center' }) } catch (e) { /* ignore */ }
      // Microtask focus
      requestAnimationFrame(() => {
        try {  } catch(e){}
        try { inputRef.current?.focus() } catch (e) { /* ignore */ }
        try { inputRef.current?.select() } catch (e) { /* ignore */ }
      })
      // Backup delayed focus for slower devices/browsers
      setTimeout(() => {
        try {  } catch(e){}
        try { inputRef.current?.scrollIntoView({ block: 'center' }) } catch (e) { /* ignore */ }
        try { inputRef.current?.blur() } catch (e) {}
        try { inputRef.current?.focus() } catch (e) { /* ignore */ }
        try { inputRef.current?.select() } catch (e) { /* ignore */ }
      }, 120)
    }
  }, [editing])

  // Dead state — show skull
  if (isDead) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-3 mb-2">
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
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 rounded-full overflow-hidden relative" style={{ height: '14px', background: 'rgba(255,255,255,0.06)' }}>
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
          {/* HP label centered inside bar */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: 'var(--text-contrast, #fff)',
            fontFamily: "'Cinzel', serif",
            fontSize: '0.85rem',
            fontWeight: 600,
          }}>
            <span style={{ textShadow: '0 0 6px rgba(0,0,0,0.5)' }}>{hpDisplay}</span>
          </div>
        </div>
        {/* Large pill button for editing HP */}
        <button
          onClick={() => { if (!editing) { flushSync(() => setEditing(true)); try { inputRef.current?.focus(); inputRef.current?.select(); } catch (e) {} } else { setEditing(false) } }}
          className="px-3 py-2 rounded-full font-semibold transition-all flex items-center justify-center"
          style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer', minWidth: 88 }}
          aria-label="Adjust HP"
        >
          +-HP
        </button>
      </div>
 
      {editing && (
        <div className="flex gap-1.5 mt-1 fade-in">
          <input
            ref={inputRef}
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