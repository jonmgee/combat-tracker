import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CONDITION_ICON_MAP, ConditionImage, ConditionIconWrapper } from './ConditionIcons'
import { CONDITION_ASSETS } from '../../lib/conditionAssets'
import HPBar from './HPBar'
import ConditionPicker from './ConditionPicker'
import ConditionSummary from './ConditionSummary'
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

          {/* ── Outer row: [position] [name+pills | icons] [INIT] ── */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>

            {/* Position bubble */}
            <div className="shrink-0 flex flex-col items-center justify-center" style={{ gap: 2 }}>
              {canMoveUp && (
                <button onClick={onMoveUp} className="cursor-pointer transition-colors hover:opacity-70"
                  style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', padding: 0, lineHeight: 1, fontSize: '0.6rem' }}>▲</button>
              )}
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: isActive ? (isConcentrating ? 'rgba(140,90,220,0.8)' : 'var(--gold)') : 'var(--bg-void)',
                  color: isActive ? (isConcentrating ? '#e8d8ff' : '#1a1410') : 'var(--text-dim)',
                  border: isActive ? 'none' : '1px solid var(--border)',
                  fontFamily: "'Cinzel', serif",
                }}>
                {position}
              </div>
              {canMoveDown && (
                <button onClick={onMoveDown} className="cursor-pointer transition-colors hover:opacity-70"
                  style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', padding: 0, lineHeight: 1, fontSize: '0.6rem' }}>▼</button>
              )}
            </div>

            {/* Centre: name+pills on left, icons on right — stretch to same height */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 8, minWidth: 0 }}>

              {/* Left side: name row + pills row stacked */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
                {/* Name + badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate"
                    style={{
                      color: isConcentrating ? (isActive ? '#ddd0ff' : '#c8b8f0')
                        : isBloodied ? (isActive ? '#e8c8c0' : '#c8a0a0')
                        : isActive ? 'var(--gold-light)' : 'var(--text-primary)',
                      fontFamily: "'Cinzel', serif", fontSize: '0.95rem',
                    }}>
                    {combatant.name}
                    {isDead && <span className="text-sm" style={{ marginLeft: 4 }}>💀</span>}
                  </span>
                  {isMonster && combatant.count > 1 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{ background: 'var(--bg-void)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                      ×{combatant.count}
                      {isDM && (
                        <button onClick={decrementCount} className="text-xs leading-none transition-colors hover:opacity-70"
                          style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}>-</button>
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
                  {isMonster && !isHidden && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>👹</span>}
                  {isActive && (
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: isConcentrating ? 'rgba(140,90,220,0.2)' : 'rgba(201,168,76,0.2)',
                        color: isConcentrating ? '#c0a0f0' : 'var(--gold)',
                        border: `1px solid ${isConcentrating ? 'rgba(140,90,220,0.4)' : 'var(--gold-dark)'}`,
                        fontSize: '0.65rem', letterSpacing: '0.1em', fontFamily: "'Inter', sans-serif",
                      }}>ACTIVE</span>
                  )}
                </div>

                {/* Pills row */}
                {!isDead && (isDM || isMe) && (
                  <div className="flex gap-2 items-center">
                    <button onClick={toggleConcentration}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs transition-all active:scale-95"
                      style={{
                        background: isConcentrating ? 'rgba(140,90,220,0.25)' : 'var(--bg-void)',
                        border: `1px solid ${isConcentrating ? 'rgba(140,90,220,0.5)' : 'var(--border)'}`,
                        color: isConcentrating ? '#c0a0f0' : 'var(--text-dim)', cursor: 'pointer',
                      }}>
                      <svg viewBox="0 0 14 14" fill="none" style={{ width: 12, height: 12, flexShrink: 0 }}>
                        <ellipse cx="7" cy="7" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1"/>
                        <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="0.8"/>
                        <circle cx="7" cy="7" r="0.7" fill="currentColor"/>
                      </svg>
                      {isConcentrating ? 'Concentrating' : 'Concentrate'}
                    </button>
                    <button onClick={toggleBloodied}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs transition-all active:scale-95"
                      style={{
                        background: isBloodied ? 'rgba(140,20,15,0.3)' : 'var(--bg-void)',
                        border: `1px solid ${isBloodied ? 'rgba(180,50,40,0.55)' : 'var(--border)'}`,
                        color: isBloodied ? '#c07070' : 'var(--text-dim)', cursor: 'pointer',
                      }}>
                      <svg viewBox="0 0 11 11" fill="none" style={{ width: 11, height: 11, flexShrink: 0 }}>
                        <path d="M5.5 1 Q8.5 4.5 8.5 6.8 A3 3 0 0 1 2.5 6.8 Q2.5 4.5 5.5 1Z"
                          stroke="currentColor" strokeWidth="0.9" fill={isBloodied ? 'rgba(180,40,30,0.35)' : 'none'}/>
                      </svg>
                      {isBloodied ? 'Bloodied' : 'Bloody'}
                    </button>
                  </div>
                )}

                {/* Mobile: compact condition summary on its own line below the pillboxes to avoid overlap with INIT */}
                {conditions.length > 0 && (
                  <div className="condition-summary-mobile">
                    <ConditionSummary combatantId={combatant.id} activeConditions={conditions} />
                  </div>
                )}
              </div>

              {/* Right side: condition icons — fixed 56px square, flow left-to-right; Conc/Bloodied show icon when active */}
              {conditions.length > 0 && (
                <div className="condition-icons-row" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {conditions.map(c => {
                    const asset = CONDITION_ASSETS[c.condition]
                    async function removeCondition() {
                      await supabase.from('conditions').delete().eq('id', c.id)
                    }
                    return (
                      <ConditionIconWrapper conditionName={c.condition}>
                        <div key={c.id} className="group"
                          style={{ position: 'relative', flexShrink: 0, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {asset
                            ? <ConditionImage folder={asset.folder} filename={asset.filename} alt={c.condition} />
                            : (() => { const Ic = CONDITION_ICON_MAP[c.condition]; return Ic ? <Ic /> : <span style={{ fontSize: '0.7rem' }}>{c.condition[0]}</span> })()
                          }
                          <button
                            onClick={e => { e.stopPropagation(); removeCondition() }}
                            className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center"
                            style={{
                              top: 0, right: 0, width: 16, height: 16, borderRadius: '50%',
                              background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(200,60,50,0.9)',
                              color: '#e06050', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0, zIndex: 10,
                            }}>✕</button>
                        </div>
                      </ConditionIconWrapper>
                    )
                  })}
                </div>
              )}



            {/* INIT */}
            <div className="shrink-0 text-right flex flex-col justify-center">
              <div className="text-xs" style={{ color: 'var(--text-dim)', letterSpacing: '0.08em' }}>INIT</div>
              <div className="text-lg font-bold" style={{ color: 'var(--gold)', fontFamily: "'Cinzel', serif", lineHeight: 1 }}>
                {combatant.initiative ?? '-'}
              </div>
            </div>

          </div>



          {/* ── HP bar ── */}
          {canSeeHP && combatant.max_hp !== null && combatant.current_hp !== null && (
            <HPBar
              combatantId={combatant.id}
              currentHp={combatant.current_hp}
              maxHp={combatant.max_hp}
              tempHp={combatant.temp_hp}
              isBloodied={isBloodied}
              isDead={isDead}
            />
          )}

          {/* ── Temp HP setter (PC's own card only) ── */}
          {isMe && !isDead && canSeeHP && (
            <TempHpSetter combatantId={combatant.id} currentTempHp={combatant.temp_hp} />
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

              {isDM && (
                <button
                  onClick={async () => {
                    const next = !combatant.dead
                    await supabase.from('combatants').update({ dead: next }).eq('id', combatant.id)
                  }}
                  className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs transition-all active:scale-95"
                  style={{
                    background: isDead ? 'rgba(80,20,20,0.4)' : 'var(--bg-void)',
                    border: `1px solid ${isDead ? 'rgba(180,50,40,0.6)' : 'var(--border)'}`,
                    color: isDead ? '#c06060' : 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  {isDead ? '💀 Dead' : '💀 Kill'}
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

// ── Temp HP setter — inline control on PC's own card only ──
function TempHpSetter({ combatantId, currentTempHp }: { combatantId: string; currentTempHp: number }) {
  const [showInput, setShowInput] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function setTempHp() {
    const val = parseInt(value)
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    const next = Math.max(currentTempHp, val)
    await supabase.from('combatants').update({ temp_hp: next }).eq('id', combatantId)
    setValue('')
    setSaving(false)
    setShowInput(false)
  }

  async function clearTempHp() {
    setSaving(true)
    await supabase.from('combatants').update({ temp_hp: 0 }).eq('id', combatantId)
    setSaving(false)
  }

  return (
    <div className="mt-2">
      {currentTempHp > 0 ? (
        <div className="flex items-center gap-2">
          <span style={{ color: '#c0b0e0', fontSize: '0.8rem' }}>🛡️</span>
          <span className="text-xs font-mono" style={{ color: '#c0b0e0' }}>
            +{currentTempHp} temp HP
          </span>
          <button
            onClick={clearTempHp}
            disabled={saving}
            className="text-xs px-2 py-0.5 rounded transition-all"
            style={{ color: 'var(--text-dim)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ) : showInput ? (
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>🛡️</span>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Amount"
            className="w-16 px-2 py-1 rounded text-sm text-center outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            autoFocus
          />
          <button
            onClick={setTempHp}
            disabled={saving || !value}
            className="text-xs px-2 py-1 rounded transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(180,140,220,0.15)', color: '#c0a0e0', border: '1px solid rgba(180,140,220,0.3)', cursor: 'pointer', fontWeight: 600 }}
          >
            Set
          </button>
          <button
            onClick={() => setShowInput(false)}
            className="text-xs px-1.5 py-1 rounded transition-all"
            style={{ color: 'var(--text-dim)', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          className="flex items-center gap-2 cursor-pointer select-none"
          style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}
        >
          <input
            type="checkbox"
            checked={showInput}
            onChange={() => setShowInput(true)}
            style={{ accentColor: '#c0a0e0' }}
          />
          Add Temporary HP
        </label>
      )}
    </div>
  )
}
