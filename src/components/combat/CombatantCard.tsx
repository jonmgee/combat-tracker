import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CONDITION_MAP } from '../../lib/conditions'
import HPBar from './HPBar'
import ConditionPicker from './ConditionPicker'
import type { Combatant, Condition, Participant } from '../../types'

interface Props {
  combatant: Combatant
  conditions: Condition[]
  isActive: boolean
  me: Participant
  position: number
}

export default function CombatantCard({ combatant, conditions, isActive, me, position }: Props) {
  const [showConditions, setShowConditions] = useState(false)
  const [showCondTooltip, setShowCondTooltip] = useState<string | null>(null)

  const isDM      = me.role === 'dm'
  const isMe      = combatant.participant_id === me.id
  const isMonster = combatant.kind === 'monster'
  const isHidden  = combatant.is_hidden

  const canSeeHP  = (isMe && combatant.hp_enabled) || (isDM && isMonster && combatant.hp_enabled)
  const showCard  = !isHidden || isDM

  async function decrementCount() {
    if (combatant.count <= 1) return
    await supabase.from('combatants').update({ count: combatant.count - 1 }).eq('id', combatant.id)
  }

  if (!showCard) return null

  return (
    <>
      <div
        className="rounded-xl parchment transition-all duration-300"
        style={{
          background: isActive ? 'var(--bg-raised)' : 'var(--bg-panel)',
          border: isActive
            ? '1px solid var(--gold)'
            : '1px solid var(--border)',
          boxShadow: isActive
            ? '0 0 20px rgba(201,168,76,0.35), 0 0 40px rgba(201,168,76,0.1)'
            : 'none',
          animation: isActive ? 'flicker 3s ease-in-out infinite' : 'none',
        }}
      >
        <div className="p-4">
          {/* ── Top row ── */}
          <div className="flex items-center gap-3">
            {/* Position badge */}
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: isActive ? 'var(--gold)' : 'var(--bg-void)',
                color: isActive ? '#1a1410' : 'var(--text-dim)',
                border: isActive ? 'none' : '1px solid var(--border)',
                fontFamily: "'Cinzel', serif",
              }}
            >
              {position}
            </div>

            {/* Name + count */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-semibold truncate"
                  style={{
                    color: isActive ? 'var(--gold-light)' : 'var(--text-primary)',
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.95rem',
                  }}
                >
                  {combatant.name}
                </span>

                {/* Monster count badge (DMs can decrement) */}
                {isMonster && combatant.count > 1 && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{ background: 'var(--bg-void)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
                  >
                    ×{combatant.count}
                    {isDM && combatant.count > 1 && (
                      <button
                        onClick={decrementCount}
                        className="text-xs leading-none transition-colors hover:opacity-70"
                        style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}
                        title="Remove one"
                      >
                        −
                      </button>
                    )}
                  </span>
                )}

                {isHidden && isDM && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', border: '1px solid var(--border)', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                    HIDDEN
                  </span>
                )}
                {isMonster && !isHidden && (
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>👹</span>
                )}
                {isActive && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', border: '1px solid var(--gold-dark)', fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: "'Inter', sans-serif" }}>
                    ACTIVE
                  </span>
                )}
              </div>
            </div>

            {/* Initiative */}
            <div className="shrink-0 text-right">
              <div className="text-xs" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>INIT</div>
              <div className="text-lg font-bold" style={{ color: 'var(--gold)', fontFamily: "'Cinzel', serif", lineHeight: 1 }}>
                {combatant.initiative ?? '—'}
              </div>
            </div>
          </div>

          {/* ── Conditions row ── */}
          {conditions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 relative">
              {conditions.map(c => {
                const def = CONDITION_MAP[c.condition]
                const isTooltipVisible = showCondTooltip === c.id
                return (
                  <span key={c.id} className="relative">
                    <span
                      className="text-lg cursor-default"
                      style={{ lineHeight: 1 }}
                      onMouseEnter={() => setShowCondTooltip(c.id)}
                      onMouseLeave={() => setShowCondTooltip(null)}
                      onClick={() => setShowCondTooltip(isTooltipVisible ? null : c.id)}
                    >
                      {def?.icon ?? '?'}
                    </span>
                    {isTooltipVisible && (
                      <span
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-xs whitespace-nowrap z-20 pointer-events-none"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                      >
                        {c.condition}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          )}

          {/* ── HP bar ── */}
          {canSeeHP && combatant.max_hp !== null && combatant.current_hp !== null && (
            <HPBar
              combatantId={combatant.id}
              currentHp={combatant.current_hp}
              maxHp={combatant.max_hp}
            />
          )}

          {/* ── Actions row ── */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowConditions(true)}
              className="flex-1 py-1.5 rounded-lg text-xs transition-all active:scale-95"
              style={{ background: 'var(--bg-void)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              + Condition
            </button>
          </div>
        </div>
      </div>

      {showConditions && (
        <ConditionPicker
          combatantId={combatant.id}
          activeConditions={conditions}
          onClose={() => setShowConditions(false)}
        />
      )}
    </>
  )
}