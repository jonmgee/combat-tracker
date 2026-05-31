import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CONDITION_MAP } from '../../lib/conditions'
import { CONDITION_ICON_MAP, CONDITION_COLOURS, DEFAULT_CONDITION_COLOUR, BloodiedIcon } from './ConditionIcons'
import HPBar from './HPBar'
import ConditionPicker from './ConditionPicker'
import BloodDrips from './BloodDrips'
import type { Combatant, Condition, Participant } from '../../types'

interface Props {
  combatant: Combatant
  conditions: Condition[]
  isActive: boolean
  me: Participant
  position: number
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  canSwapTarget?: boolean
  onSwapTarget?: () => void
}

export default function CombatantCard({ combatant, conditions, isActive, me, position, canMoveUp, canMoveDown, onMoveUp, onMoveDown, canSwapTarget, onSwapTarget }: Props) {
  const [showConditions, setShowConditions] = useState(false)
  const [showCondTooltip, setShowCondTooltip] = useState<string | null>(null)

  const isDM      = me.role === 'dm'
  const isMe      = combatant.participant_id === me.id
  const isMonster = combatant.kind === 'monster'
  const isHidden  = combatant.is_hidden
  const isDead    = combatant.dead

  const canSeeHP  = (isMe && combatant.hp_enabled) || (isDM && isMonster && combatant.hp_enabled)
  const showCard  = !isHidden || isDM

  // Bloodied: visible to all — true if HP is known to be below 50%
  // OR if Bloodied condition has been manually applied
  const hpBasedBloodied = combatant.hp_enabled &&
    combatant.max_hp !== null &&
    combatant.current_hp !== null &&
    combatant.current_hp < combatant.max_hp * 0.5
  const bloodiedCondition = conditions.find(c => c.condition === 'Bloodied')
  const isBloodied = hpBasedBloodied || !!bloodiedCondition

  const concentratingCondition = conditions.find(c => c.condition === 'Concentrating')
  const isConcentrating = !!concentratingCondition

  async function toggleConcentration() {
    if (isConcentrating) {
      await supabase.from('conditions').delete().eq('id', concentratingCondition!.id)
    } else {
      await supabase.from('conditions').insert({
        combatant_id: combatant.id,
        condition: 'Concentrating',
        category: 'spell',
      })
    }
  }

  async function toggleBloodied() {
    if (bloodiedCondition) {
      await supabase.from('conditions').delete().eq('id', bloodiedCondition.id)
    } else {
      await supabase.from('conditions').insert({
        combatant_id: combatant.id,
        condition: 'Bloodied',
        category: 'spell',
      })
    }
  }

  async function decrementCount() {
    if (combatant.count <= 1) return
    await supabase.from('combatants').update({ count: combatant.count - 1 }).eq('id', combatant.id)
  }

  if (!showCard) return null

  // ── Card style logic ──
  // Dead overrides everything
  // Priority: active > concentrating > bloodied > normal
  // Concentrating and bloodied can stack visually
  const cardBg = isConcentrating
    ? (isActive ? '#221a2e' : '#1c1626')
    : isBloodied
    ? (isActive ? '#261614' : '#201210')
    : isActive
    ? 'var(--bg-raised)'
    : 'var(--bg-panel)'

  const cardBorder = isDead
    ? 'rgba(60,60,60,0.4)'
    : isActive
    ? (isConcentrating ? 'rgba(140,90,220,0.7)' : '1px solid var(--gold)')
    : isConcentrating
    ? 'rgba(110,70,180,0.5)'
    : isBloodied
    ? 'rgba(160,40,30,0.4)'
    : 'var(--border)'

  const cardShadow = isActive
    ? isConcentrating
      ? '0 0 20px rgba(140,90,220,0.35), 0 0 40px rgba(120,70,200,0.15)'
      : '0 0 20px rgba(201,168,76,0.35), 0 0 40px rgba(201,168,76,0.1)'
    : isBloodied
    ? '0 0 10px rgba(160,30,20,0.2)'
    : 'none'

  // Concentration animation class
  const concAnimation = isConcentrating ? 'conc-shift' : isActive ? 'flicker' : 'none'

  return (
    <>
      <div
        className="rounded-xl parchment transition-all duration-300" data-combatant-id={combatant.id}
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          boxShadow: cardShadow,
          animation: `${concAnimation} ${isConcentrating ? '6s' : '3s'} ease-in-out infinite`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── Concentration aura layers ── */}
        {isConcentrating && (
          <>
            <div className="conc-aura-bg" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0 }}/>
            <div className="conc-glow-border" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0 }}/>
            {/* Floating rune particles */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0 }}>
              {[8, 22, 40, 58, 72, 86].map((left, i) => (
                <div key={i} className="rune-particle" style={{
                  left: `${left}%`,
                  animationDuration: `${2.4 + i * 0.35}s`,
                  animationDelay: `${i * 0.45}s`,
                  background: i % 2 === 0 ? 'rgba(180,130,255,0.8)' : 'rgba(120,180,255,0.75)',
                }}/>
              ))}
            </div>
          </>
        )}

        {/* ── Bloodied left-edge wound ── */}
        {isBloodied && (
          <>
            {/* Red seep from left */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1,
              background: 'linear-gradient(to right, rgba(160,20,10,0.28) 0%, rgba(140,10,5,0.10) 45%, transparent 75%)',
            }}/>
            {/* Wound edge bar */}
            <div style={{
              position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3,
              background: 'linear-gradient(to bottom, transparent, rgba(190,30,20,0.9), transparent)',
              borderRadius: '0 2px 2px 0', zIndex: 3,
            }}/>
            <BloodDrips count={4} />
          </>
        )}

        {/* Lantern horizontal glow wash - only when active */}
        {isActive && (
          <div className="lantern-glow-wash" />
        )}

        {/* Active gold edge */}
        {isActive && !isConcentrating && (
          <div style={{
            position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3,
            background: 'linear-gradient(to bottom, transparent, var(--gold), transparent)',
            borderRadius: '0 2px 2px 0', zIndex: 3,
          }}/>
        )}
        {/* Active + concentrating edge: purple */}
        {isActive && isConcentrating && (
          <div className="conc-edge-bar" style={{
            position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3,
            borderRadius: '0 2px 2px 0', zIndex: 3,
          }}/>
        )}

        {/* ── Card content - above all layers ── */}
        <div className="p-4" style={{ position: 'relative', zIndex: 2, opacity: isDead ? 0.5 : 1 }}>

          {/* ── Top row ── */}
          <div className="flex items-center gap-3">
            {/* Position badge */}
            <div className="shrink-0 flex flex-col items-center">
              {/* Move up */}
              {canMoveUp && (
                <button
                  onClick={onMoveUp}
                  className="cursor-pointer transition-colors hover:opacity-70"
                  style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', padding: 0, lineHeight: 1, fontSize: '0.6rem' }}
                >
                  ▲
                </button>
              )}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: isActive ? (isConcentrating ? 'rgba(140,90,220,0.8)' : 'var(--gold)') : 'var(--bg-void)',
                  color: isActive ? (isConcentrating ? '#e8d8ff' : '#1a1410') : 'var(--text-dim)',
                  border: isActive ? 'none' : '1px solid var(--border)',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {position}
              </div>
              {/* Move down */}
              {canMoveDown && (
                <button
                  onClick={onMoveDown}
                  className="cursor-pointer transition-colors hover:opacity-70"
                  style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', padding: 0, lineHeight: 1, fontSize: '0.6rem' }}
                >
                  ▼
                </button>
              )}
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-semibold truncate"
                  style={{
                    color: isConcentrating
                      ? (isActive ? '#ddd0ff' : '#c8b8f0')
                      : isBloodied
                      ? (isActive ? '#e8c8c0' : '#c8a0a0')
                      : isActive
                      ? 'var(--gold-light)'
                      : 'var(--text-primary)',
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.95rem',
                  }}
                >
                  {combatant.name}
                  {isDead && <span className="text-sm" style={{ marginLeft: 4 }}>💀</span>}
                </span>

                {isMonster && combatant.count > 1 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{ background: 'var(--bg-void)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                    ×{combatant.count}
                    {isDM && (
                      <button onClick={decrementCount}
                        className="text-xs leading-none transition-colors hover:opacity-70"
                        style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}>
                        -
                      </button>
                    )}
                  </span>
                )}

                {isDead && (
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(60,30,30,0.5)', color: '#c06060', border: '1px solid rgba(180,60,50,0.4)', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                    💀 Dead
                  </span>
                )}
                {isHidden && isDM && (
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', border: '1px solid var(--border)', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                    HIDDEN
                  </span>
                )}
                {isMonster && !isHidden && (
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>👹</span>
                )}
                {isActive && (
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: isConcentrating ? 'rgba(140,90,220,0.2)' : 'rgba(201,168,76,0.2)',
                      color: isConcentrating ? '#c0a0f0' : 'var(--gold)',
                      border: `1px solid ${isConcentrating ? 'rgba(140,90,220,0.4)' : 'var(--gold-dark)'}`,
                      fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: "'Inter', sans-serif",
                    }}>
                    ACTIVE
                  </span>
                )}
              </div>
            </div>

            {/* Initiative */}
            <div className="shrink-0 text-right">
              <div className="text-xs" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>INIT</div>
              <div className="text-lg font-bold" style={{ color: 'var(--gold)', fontFamily: "'Cinzel', serif", lineHeight: 1 }}>
                {combatant.initiative ?? '-'}
              </div>
            </div>
          </div>

          {/* ── Card-level toggles row ── */}
          {!isDead && (
            <div className="flex gap-2 mt-3">
              {/* Concentration toggle */}
              <button
                onClick={toggleConcentration}
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs transition-all active:scale-95"
                style={{
                  background: isConcentrating ? 'rgba(140,90,220,0.25)' : 'var(--bg-void)',
                  border: `1px solid ${isConcentrating ? 'rgba(140,90,220,0.5)' : 'var(--border)'}`,
                  color: isConcentrating ? '#c0a0f0' : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                <svg viewBox="0 0 14 14" fill="none" style={{ width: 12, height: 12, flexShrink: 0 }}>
                  <ellipse cx="7" cy="7" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1"/>
                  <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="0.8"/>
                  <circle cx="7" cy="7" r="0.7" fill="currentColor"/>
                </svg>
                {isConcentrating ? 'Concentrating' : 'Concentrate'}
              </button>

              {/* Bloodied toggle */}
              <button
                onClick={toggleBloodied}
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs transition-all active:scale-95"
                style={{
                  background: isBloodied ? 'rgba(140,20,15,0.3)' : 'var(--bg-void)',
                  border: `1px solid ${isBloodied ? 'rgba(180,50,40,0.55)' : 'var(--border)'}`,
                  color: isBloodied ? '#c07070' : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                <svg viewBox="0 0 11 11" fill="none" style={{ width: 11, height: 11, flexShrink: 0 }}>
                  <path d="M5.5 1 Q8.5 4.5 8.5 6.8 A3 3 0 0 1 2.5 6.8 Q2.5 4.5 5.5 1Z"
                    stroke="currentColor" strokeWidth="0.9" fill={isBloodied ? 'rgba(180,40,30,0.35)' : 'none'}/>
                </svg>
                {isBloodied ? 'Bloodied' : 'Bloody'}
              </button>
            </div>
          )}

          {/* ── Normal conditions row (card-level ones excluded) ── */}
          {conditions.some(c => c.condition !== 'Concentrating' && c.condition !== 'Bloodied') && (
            <div className="flex flex-wrap gap-1.5 mt-3 relative">
              {conditions.filter(c => c.condition !== 'Concentrating' && c.condition !== 'Bloodied').map(c => {
                const def = CONDITION_MAP[c.condition]
                const IconComp = CONDITION_ICON_MAP[c.condition]
                const colours = CONDITION_COLOURS[c.condition] ?? DEFAULT_CONDITION_COLOUR
                const isTooltipVisible = showCondTooltip === c.id

                async function removeCondition() {
                  await supabase.from('conditions').delete().eq('id', c.id)
                }

                return (
                  <span key={c.id} className="relative group">
                    {/* Standard icon chip */}
                    <span
                      className="cursor-default flex items-center justify-center relative"
                      style={{
                        width: 24, height: 24,
                        borderRadius: 4,
                        background: colours.bg,
                        border: `0.5px solid ${colours.border}`,
                        color: colours.color,
                      }}
                      onMouseEnter={() => setShowCondTooltip(c.id)}
                      onMouseLeave={() => setShowCondTooltip(null)}
                      onClick={() => setShowCondTooltip(isTooltipVisible ? null : c.id)}
                    >
                      <span style={{ width: 14, height: 14, display: 'block' }}>
                        {IconComp
                          ? <IconComp />
                          : <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{def?.icon ?? '?'}</span>
                        }
                      </span>

                      {/* X remove button — shows on hover/tap */}
                      <button
                        onClick={e => { e.stopPropagation(); removeCondition() }}
                        className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center"
                        style={{
                          width: 14, height: 14,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid rgba(180,60,50,0.8)',
                          color: '#e06050',
                          cursor: 'pointer',
                          fontSize: 10,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </span>

                    {isTooltipVisible && (
                      <span
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-xs whitespace-nowrap z-20 pointer-events-none"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
                        {c.condition}
                      </span>
                    )}
                  </span>
                )
              })}

              {/* Bloodied badge — only when bloodied and only other card-level conditions exist */}
              {isBloodied && !conditions.some(c => c.condition !== 'Concentrating' && c.condition !== 'Bloodied') && (
                <span
                  className="flex items-center gap-1"
                  style={{
                    padding: '2px 6px 2px 4px',
                    borderRadius: 4,
                    border: '0.5px solid rgba(180,50,40,0.55)',
                    background: 'rgba(140,20,15,0.3)',
                    color: '#c07070',
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.6rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <BloodiedIcon />
                  Bloodied
                </span>
              )}
            </div>
          )}

          {/* Bloodied badge when no conditions at all */}
          {isBloodied && !conditions.some(c => c.condition !== 'Concentrating' && c.condition !== 'Bloodied') && conditions.filter(c => c.condition !== 'Concentrating' && c.condition !== 'Bloodied').length === 0 && conditions.every(c => c.condition === 'Concentrating' || c.condition === 'Bloodied') && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span
                className="flex items-center gap-1"
                style={{
                  padding: '2px 6px 2px 4px',
                  borderRadius: 4,
                  border: '0.5px solid rgba(180,50,40,0.55)',
                  background: 'rgba(140,20,15,0.3)',
                  color: '#c07070',
                  fontFamily: "'Cinzel', serif",
                  fontSize: '0.6rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <BloodiedIcon />
                Bloodied
              </span>
            </div>
          )}

          {/* ── HP bar ── */}
          {canSeeHP && combatant.max_hp !== null && combatant.current_hp !== null && (
            <HPBar
              combatantId={combatant.id}
              currentHp={combatant.current_hp}
              maxHp={combatant.max_hp}
              isBloodied={isBloodied}
              isDead={isDead}
            />
          )}

          {/* ── Actions row ── */}
          {!isDead && (
            <div className="flex gap-2 mt-2">
              {canSwapTarget && (
                <button
                  onClick={onSwapTarget}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-lg text-xs transition-all active:scale-95"
                  style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid var(--gold-dark)', color: 'var(--gold)', cursor: 'pointer', fontWeight: 600 }}>
                  ↔ Alert Swap
                </button>
              )}
              <button
                onClick={() => setShowConditions(true)}
                className={`py-1.5 rounded-lg text-xs transition-all active:scale-95 ${canSwapTarget ? '' : 'flex-1'}`}
                style={{ background: 'var(--bg-void)', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}>
                + Condition
              </button>
            </div>
          )}
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
