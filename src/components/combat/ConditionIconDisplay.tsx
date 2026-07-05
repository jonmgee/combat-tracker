import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CONDITION_ICON_MAP, ConditionImage } from './ConditionIcons'
import { CONDITION_ASSETS } from '../../lib/conditionAssets'
import type { Condition } from '../../types'

interface Props {
  conditions: Condition[]
  combatantId: string
  /** The parent-provided "which card is expanded right now" value */
  expanded: boolean
  /** Callback: pass null to close, this combatantId to open */
  onToggle: (combatantId: string | null) => void
}

function oldestFirst(list: Condition[]): Condition[] {
  return [...list].sort(
    (a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
  )
}

function renderIcon(conditionName: string, size: number) {
  const asset = CONDITION_ASSETS[conditionName]
  if (asset) {
    return <ConditionImage folder={asset.folder} filename={asset.filename} alt={conditionName} />
  }
  const Ic = CONDITION_ICON_MAP[conditionName]
  if (Ic) return <Ic />
  return <span style={{ fontSize: size * 0.4, color: 'var(--text-dim)' }}>{conditionName[0]}</span>
}

export default function ConditionIconDisplay({ conditions, combatantId, expanded, onToggle }: Props) {
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // All hooks unconditionally — before any early return
  useEffect(() => {
    if (!expanded || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 100000,
    })
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        onToggle(null)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [expanded, onToggle])

  if (conditions.length === 0) return null

  const sorted = oldestFirst(conditions)
  const first = sorted[0]
  const overflowCount = conditions.length - 1
  const open = expanded

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={e => {
          e.stopPropagation()
          e.preventDefault()
          onToggle(open ? null : combatantId)
        }}
        style={{
          position: 'relative',
          width: 52,
          height: 52,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderIcon(first.condition, 52)}
        </div>

        {/* Chevron badge — only when 2+ conditions */}
        {overflowCount > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dim)',
              fontSize: 10,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            ▼
          </div>
        )}
      </button>

      {/* Dropdown overlay */}
      {open && (
        <div
          ref={dropdownRef}
          style={{
            ...dropdownStyle,
            minWidth: 220,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            padding: 8,
          }}
        >
          {sorted.map(cond => (
            <div
              key={cond.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 6,
              }}
            >
              <div style={{ flex: 1, textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Cinzel', serif" }}>
                {cond.condition}
              </div>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 8,
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {renderIcon(cond.condition, 52)}
              </div>
              <button
                onClick={e => {
                  e.stopPropagation()
                  supabase.from('conditions').delete().eq('id', cond.id)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(200,60,50,0.7)',
                  color: '#e06050',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: 11,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}