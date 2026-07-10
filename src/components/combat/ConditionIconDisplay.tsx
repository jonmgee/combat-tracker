import { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '../../lib/supabase'
import { CONDITION_ICON_MAP, ConditionImage } from './ConditionIcons'
import { CONDITION_ASSETS } from '../../lib/conditionAssets'
import { CONDITION_MAP } from '../../lib/conditions'
import type { Condition } from '../../types'

interface Props {
  conditions: Condition[]
  combatantId: string
  expanded: boolean
  onToggle: (combatantId: string | null) => void
  /** Tile size in px — cards use the default, group sub-cards go smaller */
  size?: number
}

function oldestFirst(list: Condition[]): Condition[] {
  return [...list].sort(
    (a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime()
  )
}

function iconTile(conditionName: string) {
  const asset = CONDITION_ASSETS[conditionName]
  if (asset) {
    return <ConditionImage folder={asset.folder} filename={asset.filename} alt={conditionName} />
  }
  const Ic = CONDITION_ICON_MAP[conditionName]
  if (Ic) return <Ic />
  return <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{conditionName[0]}</span>
}

export default function ConditionIconDisplay({ conditions, combatantId, expanded, onToggle, size = 54 }: Props) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // All hooks unconditionally — before any early return
  useEffect(() => {
    if (!expanded || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const dropdownWidth = Math.min(320, window.innerWidth - 16)
    let left = rect.left
    if (left + dropdownWidth > window.innerWidth - 8) left = window.innerWidth - dropdownWidth - 8
    if (left < 8) left = 8
    // Flip above if there's no room below
    const estHeight = Math.min(conditions.length * 64 + 16, 340)
    let top = rect.bottom + 4
    if (top + estHeight > window.innerHeight - 8) top = Math.max(8, rect.top - estHeight - 4)
    setMenuPos({ top, left })
  }, [expanded, conditions.length])

  useEffect(() => {
    if (!expanded) return
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        rowRef.current &&
        !rowRef.current.contains(e.target as Node)
      ) {
        onToggle(null)
        setMenuPos(null)
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
  const open = expanded

  return (
    <div ref={rowRef} style={{ position: 'relative' }}>
      {/* Full row of condition tiles — uses the card's width instead of a single padded icon */}
      <button
        onClick={e => {
          e.stopPropagation()
          e.preventDefault()
          onToggle(open ? null : combatantId)
          if (open) setMenuPos(null)
        }}
        aria-label={`${conditions.length} condition${conditions.length !== 1 ? 's' : ''} — tap for details`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        {sorted.map(cond => (
          <span
            key={cond.id}
            title={cond.condition}
            style={{
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.18),
              overflow: 'hidden',
              flexShrink: 0,
              display: 'block',
              boxShadow: open ? '0 0 0 1px var(--gold-dark)' : '0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            {iconTile(cond.condition)}
          </span>
        ))}
      </button>

      {/* Portal dropdown to body so it escapes any parent stacking context */}
      {open && menuPos && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 100000,
            width: Math.min(320, window.innerWidth - 16),
            maxHeight: 340,
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            padding: 8,
          }}
        >
          {sorted.map(cond => {
            const def = CONDITION_MAP[cond.condition]
            return (
              <div
                key={cond.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px',
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {iconTile(cond.condition)}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, fontFamily: "'Cinzel', serif" }}>
                    {cond.condition}
                  </div>
                  {def?.desc && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.35, marginTop: 2 }}>
                      {def.desc}
                    </div>
                  )}
                </div>
                <button
                  onClick={async e => {
                    e.stopPropagation()
                    // NB: the Supabase builder only executes when awaited
                    await supabase.from('conditions').delete().eq('id', cond.id)
                  }}
                  aria-label={`Remove ${cond.condition}`}
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
                    marginTop: 2,
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
