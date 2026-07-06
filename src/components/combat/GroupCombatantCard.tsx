import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import HPBar from './HPBar'
import ConditionPicker from './ConditionPicker'
import ConditionIconDisplay from './ConditionIconDisplay'
import type { Combatant, Condition, Participant } from '../../types'

interface Props {
  combatants: Combatant[]
  conditions: Condition[]
  isActive: boolean           // is any of them the active combatant?
  activeId: string | null     // which specific one is active
  me: Participant
  sharedName: string          // e.g. "Skeletons"
  sharedInitiative: number
  expandedConditionCard: string | null
  onToggleConditionCard: (id: string | null) => void
}

export default function GroupCombatantCard({
  combatants,
  conditions,
  isActive,
  activeId,
  me,
  sharedName,
  sharedInitiative,
  expandedConditionCard,
  onToggleConditionCard,
}: Props) {
  const isDM = me.role === 'dm'
  const [showConditionsFor, setShowConditionsFor] = useState<string | null>(null)
  // optimistic revive set of IDs
  const [_optimisticAliveIds, setOptimisticAliveIds] = useState<Record<string, boolean>>({})
  const hpRefs = useRef<Record<string, any>>({})

  async function toggleBloodied(c: Combatant) {
    const existing = conditions.find(co => co.combatant_id === c.id && co.condition === 'Bloodied')
    if (existing) {
      await supabase.from('conditions').delete().eq('id', existing.id)
    } else {
      await supabase.from('conditions').insert({ combatant_id: c.id, condition: 'Bloodied', category: 'spell' })
    }
  }

  // Group card styling — neutral, no concentration/bloodied tinting at group level
  const cardBg = isActive ? 'var(--bg-raised)' : 'var(--bg-panel)'
  const cardBorder = isActive ? '1px solid var(--gold)' : 'var(--border)'
  const cardShadow = isActive ? '0 0 20px rgba(201,168,76,0.35), 0 0 40px rgba(201,168,76,0.1)' : 'none'
  const cardAnimation = isActive ? 'flicker 3s ease-in-out infinite' : 'none'

  return (
    <div
      className="rounded-xl parchment transition-all duration-300"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        animation: cardAnimation,
        position: 'relative',
      }}
    >
      {/* ── All effects per-sub-card; group just gets the active gold edge ── */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 3,
          background: 'linear-gradient(to bottom, transparent, var(--gold), transparent)',
          borderRadius: '0 2px 2px 0', zIndex: 3,
        }}/>
      )}

      {/* ── Header row ── */}
      <div className="p-4 pb-2" style={{ position: 'relative', zIndex: 2 }}>
        <div className="flex items-center gap-3">
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
                {sharedName}
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: 6 }}>
                  ×{combatants.length}
                </span>
              </span>

              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>👹</span>

              {isActive && (
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(201,168,76,0.2)',
                    color: 'var(--gold)',
                    border: '1px solid var(--gold-dark)',
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
      <div className="px-3 pb-3 grid gap-2"
        style={{
          gridTemplateColumns: combatants.length <= 3
            ? `repeat(${combatants.length}, 1fr)`
            : `repeat(3, 1fr)`,
        }}
      >
        {combatants.map((c, idx) => {
          const cConditions = conditions.filter(cond => cond.combatant_id === c.id)
          const cHpBloodied = c.hp_enabled && c.max_hp !== null && c.current_hp !== null &&
            c.current_hp < c.max_hp * 0.5
          const cBloodied = cHpBloodied || cConditions.some(cond => cond.condition === 'Bloodied')
          const cConcentrating = cConditions.some(cond => cond.condition === 'Concentrating')
          const cDead = c.dead
          const cOwns = c.participant_id === me.id
          const isSubActive = c.id === activeId && isActive
          const canSeeHP = isDM && c.hp_enabled

          return (
            <div
              key={c.id}
              data-combatant-id={c.id}
              className="rounded-lg transition-all duration-200"
              style={{
                background: cDead ? 'rgba(20,15,15,0.5)' : cBloodied ? 'rgba(30,12,10,0.6)' : 'rgba(0,0,0,0.2)',
                border: isSubActive
                  ? '1px solid var(--gold)'
                  : cBloodied
                  ? '0.5px solid rgba(160,40,30,0.25)'
                  : '0.5px solid rgba(255,255,255,0.04)',
                boxShadow: isSubActive ? '0 0 12px rgba(201,168,76,0.3)' : 'none',
                position: 'relative',
                opacity: cDead ? 0.5 : 1,
              }}
            >
              {/* Sub-card bloodied seep */}
              {cBloodied && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
                  background: 'linear-gradient(to bottom, rgba(160,20,10,0.15) 0%, transparent 60%)',
                }}/>
              )}

              {/* Sub-card concentration effects */}
              {cConcentrating && (
                <>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0,
                    background: 'linear-gradient(135deg, rgba(120,70,200,0.12) 0%, transparent 60%)',
                  }}/>
                  <div style={{
                    position: 'absolute', left: 0, top: '10%', bottom: '10%', width: 2,
                    background: 'linear-gradient(to bottom, transparent, rgba(140,90,220,0.6), transparent)',
                    borderRadius: '0 2px 2px 0', zIndex: 3,
                  }}/>
                </>
              )}

              <div className="p-2" style={{ position: 'relative', zIndex: 1 }}>
                {/* Letter label (A, B, C...) */}
                <div className="flex items-center justify-between mb-1">
                  <span style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.65rem',
                    color: cDead ? '#808080' : cBloodied ? '#c07070' : cConcentrating ? '#b090f0' : isSubActive ? 'var(--gold)' : 'var(--text-dim)',
                    fontWeight: 600,
                  }}>
                    {String.fromCharCode(65 + idx)} {cDead ? '💀' : ''}
                  </span>
                  {cConcentrating && (
                    <span style={{ color: '#b090f0', fontSize: '0.55rem' }}>✦ Conc</span>
                  )}
                </div>

                {/* HP bar (DM only, when enabled) */}
                {canSeeHP && c.max_hp !== null && c.current_hp !== null && (
                  <HPBar
                    combatantId={c.id}
                    currentHp={c.current_hp}
                    maxHp={c.max_hp}
                    tempHp={c.temp_hp}
                    isBloodied={cBloodied}
                    isDead={cDead}
                  />
                )}

                {/* Condition icon — single oldest, with dropdown overlay */}
                <ConditionIconDisplay
                  conditions={cConditions}
                  combatantId={c.id}
                  expanded={expandedConditionCard === c.id}
                  onToggle={onToggleConditionCard}
                />

                {/* Dead badge */}
                {cDead && (
                  <div className="mt-1 text-xs" style={{ color: '#c06060' }}>💀 Dead</div>
                )}

                {/* Actions */}
                {!cDead && (
                  <div className="flex gap-1 mt-1" style={{ flexWrap: 'wrap' }}>
                    {/* Bloodied toggle */}
                    <button
                      onClick={() => toggleBloodied(c)}
                      disabled={!isDM && !cOwns}
                      className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[0.55rem] transition-all active:scale-95 disabled:active:scale-100"
                      style={{
                        flex: 1,
                        background: cBloodied ? 'rgba(140,20,15,0.3)' : 'var(--bg-void)',
                        border: `0.5px solid ${cBloodied ? 'rgba(180,50,40,0.55)' : 'var(--border)'}`,
                        color: cBloodied ? '#c07070' : 'var(--text-dim)',
                        cursor: (!isDM && !cOwns) ? 'not-allowed' : 'pointer',
                        opacity: (!isDM && !cOwns) ? 0.4 : 1,
                        lineHeight: 1,
                      }}
                    >
                      <svg viewBox="0 0 11 11" fill="none" style={{ width: 9, height: 9, flexShrink: 0 }}>
                        <path d="M5.5 1 Q8.5 4.5 8.5 6.8 A3 3 0 0 1 2.5 6.8 Q2.5 4.5 5.5 1Z"
                          stroke="currentColor" strokeWidth="0.9" fill={cBloodied ? 'rgba(180,40,30,0.35)' : 'none'}/>
                      </svg>
                      {cBloodied ? '🩸' : 'Bloody'}
                    </button>

                    {/* Dead toggle (DM or owner) */}
                    {cDead ? (
                      <button
                        onClick={async () => {
                          setOptimisticAliveIds(prev => ({ ...prev, [c.id]: true }))
                          if (canSeeHP && c.max_hp !== null && c.current_hp !== null) {
                            try { hpRefs.current[c.id]?.focusAndEdit() } catch (e) {}
                          }
                          try {
                            await supabase.from('combatants').update({ dead: false }).eq('id', c.id)
                          } catch (err) {
                            setOptimisticAliveIds(prev => { const n = { ...prev }; delete n[c.id]; return n })
                            console.error('Revive failed', err)
                          }
                        }}
                        disabled={!isDM && !cOwns}
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[0.55rem] transition-all active:scale-95 disabled:active:scale-100"
                        style={{
                          flex: 1,
                          background: 'var(--bg-void)',
                          border: '0.5px solid var(--border)',
                          color: 'var(--text-dim)',
                          cursor: (!isDM && !cOwns) ? 'not-allowed' : 'pointer',
                          opacity: (!isDM && !cOwns) ? 0.4 : 1,
                          lineHeight: 1,
                        }}
                      >
                        Revive
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const next = !c.dead
                          await supabase.from('combatants').update({ dead: next }).eq('id', c.id)
                        }}
                        disabled={!isDM && !cOwns}
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[0.55rem] transition-all active:scale-95 disabled:active:scale-100"
                        style={{
                          flex: 1,
                          background: cDead ? 'rgba(80,20,20,0.4)' : 'var(--bg-void)',
                          border: `0.5px solid ${cDead ? 'rgba(180,50,40,0.6)' : 'var(--border)'}`,
                          color: cDead ? '#c06060' : 'var(--text-dim)',
                          cursor: (!isDM && !cOwns) ? 'not-allowed' : 'pointer',
                          opacity: (!isDM && !cOwns) ? 0.4 : 1,
                          lineHeight: 1,
                        }}
                      >
                        {cDead ? '💀' : '💀 Kill'}
                      </button>
                    )}

                    {/* Condition picker */}
                    <button
                      onClick={() => setShowConditionsFor(c.id)}
                      className="flex-1 py-1 rounded text-[0.55rem] transition-all active:scale-95"
                      style={{ background: 'var(--bg-void)', border: '0.5px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer' }}>
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