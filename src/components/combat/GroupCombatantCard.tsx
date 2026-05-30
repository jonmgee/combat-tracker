import { useState } from 'react'
import { CONDITION_ICON_MAP, CONDITION_COLOURS, DEFAULT_CONDITION_COLOUR, BloodiedIcon } from './ConditionIcons'
import HPBar from './HPBar'
import ConditionPicker from './ConditionPicker'
import BloodDrips from './BloodDrips'
import type { Combatant, Condition, Participant } from '../../types'

interface Props {
  combatants: Combatant[]
  conditions: Condition[]
  isActive: boolean           // is any of them the active combatant?
  activeId: string | null     // which specific one is active
  me: Participant
  position: number            // position of the first member (lowest slot)
  sharedName: string          // e.g. "Skeletons"
  sharedInitiative: number
}

export default function GroupCombatantCard({
  combatants,
  conditions,
  isActive,
  activeId,
  me,
  position,
  sharedName,
  sharedInitiative,
}: Props) {
  const isDM = me.role === 'dm'
  const [showConditionsFor, setShowConditionsFor] = useState<string | null>(null)

  // Any bloodied in the group? (for card-level tint)
  const anyBloodied = combatants.some(c => {
    const hpBased = c.hp_enabled && c.max_hp !== null && c.current_hp !== null &&
      c.current_hp < c.max_hp * 0.5
    const condBased = conditions.some(cond => cond.combatant_id === c.id && cond.condition === 'Bloodied')
    return hpBased || condBased
  })

  // Any concentrating?
  const anyConcentrating = combatants.some(c =>
    conditions.some(cond => cond.combatant_id === c.id && cond.condition === 'Concentrating')
  )

  // Group-level styling
  const cardBg = anyConcentrating
    ? (isActive ? '#221a2e' : '#1c1626')
    : anyBloodied
    ? (isActive ? '#261614' : '#201210')
    : isActive
    ? 'var(--bg-raised)'
    : 'var(--bg-panel)'

  const cardBorder = isActive
    ? (anyConcentrating ? 'rgba(140,90,220,0.7)' : '1px solid var(--gold)')
    : anyConcentrating
    ? 'rgba(110,70,180,0.5)'
    : anyBloodied
    ? 'rgba(160,40,30,0.4)'
    : 'var(--border)'

  const cardShadow = isActive
    ? anyConcentrating
      ? '0 0 20px rgba(140,90,220,0.35), 0 0 40px rgba(120,70,200,0.15)'
      : '0 0 20px rgba(201,168,76,0.35), 0 0 40px rgba(201,168,76,0.1)'
    : anyBloodied
    ? '0 0 10px rgba(160,30,20,0.2)'
    : 'none'

  const concAnimation = anyConcentrating ? 'conc-shift' : isActive ? 'flicker' : 'none'

  return (
    <div
      className="rounded-xl parchment transition-all duration-300"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        animation: `${concAnimation} ${anyConcentrating ? '6s' : '3s'} ease-in-out infinite`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Group-level visual effects ── */}
      {anyBloodied && (
        <>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1,
            background: 'linear-gradient(to right, rgba(160,20,10,0.28) 0%, rgba(140,10,5,0.10) 45%, transparent 75%)',
          }}/>
          <div style={{
            position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3,
            background: 'linear-gradient(to bottom, transparent, rgba(190,30,20,0.9), transparent)',
            borderRadius: '0 2px 2px 0', zIndex: 3,
          }}/>
          <BloodDrips count={4} />
        </>
      )}

      {isActive && !anyConcentrating && (
        <div style={{
          position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3,
          background: 'linear-gradient(to bottom, transparent, var(--gold), transparent)',
          borderRadius: '0 2px 2px 0', zIndex: 3,
        }}/>
      )}
      {isActive && anyConcentrating && (
        <div className="conc-edge-bar" style={{
          position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3,
          borderRadius: '0 2px 2px 0', zIndex: 3,
        }}/>
      )}

      {/* ── Header row ── */}
      <div className="p-4 pb-2" style={{ position: 'relative', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: isActive ? (anyConcentrating ? 'rgba(140,90,220,0.8)' : 'var(--gold)') : 'var(--bg-void)',
              color: isActive ? (anyConcentrating ? '#e8d8ff' : '#1a1410') : 'var(--text-dim)',
              border: isActive ? 'none' : '1px solid var(--border)',
              fontFamily: "'Cinzel', serif",
            }}
          >
            {position}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold truncate"
                style={{
                  color: anyConcentrating
                    ? (isActive ? '#ddd0ff' : '#c8b8f0')
                    : anyBloodied
                    ? (isActive ? '#e8c8c0' : '#c8a0a0')
                    : isActive
                    ? 'var(--gold-light)'
                    : 'var(--text-primary)',
                  fontFamily: "'Cinzel', serif",
                  fontSize: '0.95rem',
                }}
              >
                {sharedName}
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: 6 }}>
                  ×{combatants.length}
                </span>
              </span>

              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>👹</span>

              {isActive && (
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: anyConcentrating ? 'rgba(140,90,220,0.2)' : 'rgba(201,168,76,0.2)',
                    color: anyConcentrating ? '#c0a0f0' : 'var(--gold)',
                    border: `1px solid ${anyConcentrating ? 'rgba(140,90,220,0.4)' : 'var(--gold-dark)'}`,
                    fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: "'Inter', sans-serif",
                  }}>
                  ACTIVE
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xs" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>INIT</div>
            <div className="text-lg font-bold" style={{ color: 'var(--gold)', fontFamily: "'Cinzel', serif", lineHeight: 1 }}>
              {sharedInitiative ?? '-'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-cards grid ── */}
      <div className="px-3 pb-3 grid gap-2" style={{
        gridTemplateColumns: `repeat(${Math.min(combatants.length, 4)}, 1fr)`,
      }}>
        {combatants.map((c, idx) => {
          const cConditions = conditions.filter(cond => cond.combatant_id === c.id)
          const cHpBloodied = c.hp_enabled && c.max_hp !== null && c.current_hp !== null &&
            c.current_hp < c.max_hp * 0.5
          const cBloodied = cHpBloodied || cConditions.some(cond => cond.condition === 'Bloodied')
          const cConcentrating = cConditions.some(cond => cond.condition === 'Concentrating')
          const isSubActive = c.id === activeId && isActive
          const canSeeHP = isDM && c.hp_enabled

          return (
            <div
              key={c.id}
              data-combatant-id={c.id}
              className="rounded-lg transition-all duration-200"
              style={{
                background: cBloodied ? 'rgba(30,12,10,0.6)' : 'rgba(0,0,0,0.2)',
                border: isSubActive
                  ? '1px solid var(--gold)'
                  : cBloodied
                  ? '0.5px solid rgba(160,40,30,0.25)'
                  : '0.5px solid rgba(255,255,255,0.04)',
                boxShadow: isSubActive ? '0 0 12px rgba(201,168,76,0.3)' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Sub-card bloodied seep */}
              {cBloodied && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
                  background: 'linear-gradient(to bottom, rgba(160,20,10,0.15) 0%, transparent 60%)',
                }}/>
              )}

              <div className="p-2" style={{ position: 'relative', zIndex: 1 }}>
                {/* Numbered label */}
                <div className="flex items-center justify-between mb-1">
                  <span style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.65rem',
                    color: cBloodied ? '#c07070' : isSubActive ? 'var(--gold)' : 'var(--text-dim)',
                    fontWeight: 600,
                  }}>
                    #{idx + 1}
                  </span>
                  {cConcentrating && (
                    <span style={{ color: '#b090f0', fontSize: '0.55rem' }}>
                      ✦ Conc
                    </span>
                  )}
                </div>

                {/* HP bar (DM only, when enabled) */}
                {canSeeHP && c.max_hp !== null && c.current_hp !== null && (
                  <HPBar
                    combatantId={c.id}
                    currentHp={c.current_hp}
                    maxHp={c.max_hp}
                    isBloodied={cBloodied}
                  />
                )}

                {/* Conditions row */}
                {cConditions.filter(co => co.condition !== 'Concentrating' && co.condition !== 'Bloodied').length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {cConditions
                      .filter(co => co.condition !== 'Concentrating' && co.condition !== 'Bloodied')
                      .map(co => {
                        const colours = CONDITION_COLOURS[co.condition] ?? DEFAULT_CONDITION_COLOUR
                        const Icon = CONDITION_ICON_MAP[co.condition]
                        return (
                          <div key={co.id}
                            style={{
                              padding: '1px 4px 1px 3px',
                              borderRadius: 3,
                              border: `0.5px solid ${colours.border}`,
                              background: colours.bg,
                              color: colours.color,
                              fontSize: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            {Icon && <span style={{ width: 10, height: 10, display: 'flex' }}><Icon /></span>}
                            <span>{co.condition}</span>
                          </div>
                        )
                      })}
                  </div>
                )}

                {/* Bloodied badge (no other conditions) */}
                {cBloodied && cConditions.filter(co => co.condition !== 'Concentrating' && co.condition !== 'Bloodied').length === 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <span style={{
                      padding: '1px 4px 1px 3px',
                      borderRadius: 3,
                      border: '0.5px solid rgba(180,50,40,0.55)',
                      background: 'rgba(140,20,15,0.3)',
                      color: '#c07070',
                      fontFamily: "'Cinzel', serif",
                      fontSize: '0.5rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}>
                      <BloodiedIcon />
                      Bloodied
                    </span>
                  </div>
                )}

                {/* Actions */}
                {isDM && (
                  <div className="flex gap-1 mt-1.5">
                    <button
                      onClick={() => setShowConditionsFor(c.id)}
                      className="flex-1 py-1 rounded text-xs transition-all active:scale-95"
                      style={{ background: 'var(--bg-void)', border: '0.5px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.6rem' }}>
                      + Cond
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Condition pickers (one per sub-card) ── */}
      {showConditionsFor && (
        <ConditionPicker
          combatantId={showConditionsFor}
          activeConditions={conditions.filter(c => c.combatant_id === showConditionsFor)}
          onClose={() => setShowConditionsFor(null)}
        />
      )}
    </div>
  )
}