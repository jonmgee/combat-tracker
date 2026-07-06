import React, { useState, useRef, useImperativeHandle } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from '../../lib/supabase'

interface Props {
  combatantId: string
  currentHp: number
  maxHp: number
  tempHp: number
  isBloodied?: boolean
  isDead?: boolean
  showTempBadge?: boolean
}

const HPBar = React.forwardRef(function HPBar({ combatantId, currentHp, maxHp, tempHp, isBloodied = false, isDead = false, showTempBadge = false }: Props, ref) {
  const [editing, setEditing] = useState(false)
  const [tempEditing, setTempEditing] = useState(false)
  const [delta, setDelta]     = useState('')
  const [presetDirection, setPresetDirection] = useState<1 | -1>(1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useImperativeHandle(ref, () => ({
    focusAndEdit() {
      if (!editing && !tempEditing) {
        try { flushSync(() => setEditing(true)) } catch (e) {}
        try { inputRef.current?.focus(); inputRef.current?.select(); } catch (e) {}
      }
    }
  }))

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
    ? '#3b6f2c'                                         // healthy — forest green (darkened for contrast)
    : pct > 25
    ? '#c8873a'                                         // hurt — amber
    : '#b03030'                                         // critical — red

  async function applyTempHp() {
    const val = parseInt(delta)
    if (isNaN(val)) return
    if (val <= 0) {
      // Entered 0 or negative — clear temp HP
      await supabase.from('combatants').update({ temp_hp: 0 }).eq('id', combatantId)
    } else {
      await supabase.from('combatants').update({ temp_hp: val }).eq('id', combatantId)
    }
    setDelta('')
    setTempEditing(false)
  }

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

  function handleBadgeClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (tempEditing) {
      // Already editing — apply value
      applyTempHp()
    } else {
      setDelta(tempHp > 0 ? String(tempHp) : '')
      setTempEditing(true)
      setEditing(false)
      // Focus on next tick after render
      setTimeout(() => {
        try { inputRef.current?.focus(); inputRef.current?.select(); } catch (e) {}
      }, 0)
    }
  }

  // Display string — clean, no temp HP clutter
  const hpDisplay = `${currentHp}/${maxHp}`

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-2" style={{ height: '35px' }}>
        {/* − Damage button */}
        <button
          onClick={() => { setPresetDirection(-1); if (!editing) { flushSync(() => setEditing(true)); try { inputRef.current?.focus(); inputRef.current?.select(); } catch (e) {} } else { setEditing(false) } }}
          className="flex items-center justify-center rounded-lg transition-all active:scale-95"
          style={{ width: 35, height: '100%', background: 'var(--bg-void)', color: '#c06060', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0, fontSize: '1rem', lineHeight: 1 }}
          aria-label="Deal damage"
        >
          −
        </button>

        <div className="flex-1 rounded-lg overflow-hidden relative" style={{ height: '100%', background: 'rgba(255,255,255,0.06)' }}>
          {/* Base HP bar */}
          <div style={{
            width: `${realPct}%`,
            height: '100%',
            background: barColor,
            borderRadius: '8px',
            transition: 'width 0.3s ease',
            boxShadow: isBloodied ? '0 0 6px rgba(160,30,20,0.5)' : pct <= 25 ? '0 0 5px rgba(176,48,48,0.4)' : 'none',
          }}/>

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
            color: 'var(--gold)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '1.1rem',
            fontWeight: 700,
          }}>
            <span style={{ textShadow: '0 0 6px rgba(0,0,0,0.35)' }}>{hpDisplay}</span>
          </div>

          {/* Temp HP badge — fixed pill in top-right corner of HP bar */}
          {showTempBadge && (
            <div
              onClick={handleBadgeClick}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '0 7px',
                cursor: 'pointer',
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(1px)',
                WebkitBackdropFilter: 'blur(1px)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                color: '#c8b4dc',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.2px',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              title={tempHp === 0 ? 'Add Temporary HP' : `Temporary HP: ${tempHp}`}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M10 2s4 5 4 9c0 2-1.5 3-1.5 3h-5S6 13 6 11c0-4 4-9 4-9z"/>
              </svg>
              {tempHp > 0 ? (
                <span>{tempHp}</span>
              ) : (
                <span style={{ fontSize: '0.6rem', fontWeight: 600, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Temp HP</span>
              )}
            </div>
          )}
        </div>

        {/* + Heal button */}
        <button
          onClick={() => { setPresetDirection(1); if (!editing) { flushSync(() => setEditing(true)); try { inputRef.current?.focus(); inputRef.current?.select(); } catch (e) {} } else { setEditing(false) } }}
          className="flex items-center justify-center rounded-lg transition-all active:scale-95"
          style={{ width: 35, height: '100%', background: 'var(--bg-void)', color: '#4a8e3a', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0, fontSize: '1rem', lineHeight: 1 }}
          aria-label="Heal"
        >
          +
        </button>
      </div>

      {/* Editing row — supports both HP editing and Temp HP editing */}
      {editing && !tempEditing && (
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
          <button onClick={() => applyDelta(presetDirection)}
            className="px-3 py-1.5 rounded text-sm font-bold transition-all active:scale-95"
            style={{
              background: presetDirection === 1 ? 'rgba(74,142,58,0.15)' : 'rgba(176,48,48,0.15)',
              color: presetDirection === 1 ? '#4a8e3a' : '#c06060',
              border: `1px solid ${presetDirection === 1 ? 'rgba(74,142,58,0.3)' : 'rgba(176,48,48,0.3)'}`,
            }}>
            {presetDirection === 1 ? '+' : '−'}
          </button>
        </div>
      )}

      {/* Temp HP editing row */}
      {tempEditing && (
        <div className="flex gap-1.5 mt-1 fade-in">
          <input
            ref={inputRef}
            type="tel" inputMode="numeric" pattern="\d*"
            value={delta}
            onChange={e => setDelta(e.target.value)}
            placeholder={tempHp > 0 ? 'Overtype Temp HP' : 'Enter Temp HP'}
            className="flex-1 px-2 py-1.5 rounded text-sm text-center outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <button onClick={applyTempHp}
            className="px-3 py-1.5 rounded text-sm font-bold transition-all active:scale-95"
            style={{
              background: 'rgba(200,180,220,0.15)',
              color: '#c8b4dc',
              border: '1px solid rgba(200,180,220,0.3)',
            }}>
            Set
          </button>
          <button onClick={() => { setDelta(''); setTempEditing(false) }}
            className="px-3 py-1.5 rounded text-sm font-bold transition-all active:scale-95"
            style={{
              background: 'rgba(200,200,200,0.1)',
              color: 'var(--text-dim)',
              border: '1px solid rgba(200,200,200,0.2)',
            }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
})

export default HPBar