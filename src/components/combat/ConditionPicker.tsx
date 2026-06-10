import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CONDITION_ICON_MAP, ConditionImage } from './ConditionIcons'
import { TAB_CONDITIONS, TAB_BOONS, TAB_COMBAT, CONDITION_ASSETS } from '../../lib/conditionAssets'
import { CONDITION_MAP } from '../../lib/conditions'
import type { Condition } from '../../types'

interface Props {
  combatantId: string
  activeConditions: Condition[]
  onClose: () => void
}

type NewTabs = 'conditions' | 'boons' | 'combat'
const TABS: { key: NewTabs; label: string }[] = [
  { key: 'conditions', label: 'Conditions' },
  { key: 'boons', label: 'Boons' },
  { key: 'combat', label: 'Combat' },
]

export default function ConditionPicker({ combatantId, activeConditions, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<NewTabs>('conditions')
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const activeNames = new Set(activeConditions.map(c => c.condition))

  async function toggle(name: string) {
    if (toggling.has(name)) return // already in flight — prevent duplicate
    setToggling(prev => new Set(prev).add(name))
    try {
      const cond = activeConditions.find(c => c.condition === name)
      if (cond) {
        await supabase.from('conditions').delete().eq('id', cond.id)
      } else {
        // Category field is required by schema; use 'standard' for these picks
        await supabase.from('conditions').insert({ combatant_id: combatantId, condition: name, category: 'standard' })
      }
    } finally {
      setToggling(prev => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }
  }

  // Determine list of names for active tab
  let items: string[] = []
  if (activeTab === 'conditions') items = TAB_CONDITIONS
  if (activeTab === 'boons') items = TAB_BOONS
  if (activeTab === 'combat') items = TAB_COMBAT

  // Remove any weapon_mastery (Weapon Mastery) entries entirely — they should not appear in picker
  items = items.filter(name => {
    const def = CONDITION_MAP[name]
    return !(def && def.category === 'weapon_mastery')
  })

  return (
    <div
      className="fixed inset-0 flex items-end justify-center z-50 pb-0"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl fade-in"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderBottom: 'none', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', fontSize: '1rem' }}>Conditions</h3>
          <button onClick={onClose} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2.5 text-xs uppercase tracking-wider transition-all"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: activeTab === t.key ? 'var(--gold)' : 'var(--text-dim)',
                borderBottom: activeTab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                letterSpacing: '0.08em',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            {items.map(name => {
              const active = activeNames.has(name)
              const asset = CONDITION_ASSETS[name]
              return (
                <button key={name}
                  onClick={() => toggle(name)}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-center transition-all active:scale-95"
                  style={{
                    background: active ? 'rgba(201,168,76,0.15)' : 'var(--bg-raised)',
                    border: `1px solid ${active ? 'var(--gold-dark)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}>
                  <span className="condition-icon-picker" style={{ width: '70%', height: '70%' }}>
                    {asset ? (
                      <div style={{ width: '100%', height: '100%' }}>
                        <ConditionImage folder={asset.folder} filename={asset.filename} alt={name} />
                      </div>
                    ) : (() => { const Ic = CONDITION_ICON_MAP[name]; return Ic ? <Ic /> : <span style={{ fontSize: '1.2rem' }}>{name[0]}</span> })()}
                  </span>
                  <span className="text-xs leading-tight" style={{ color: active ? 'var(--gold-light)' : 'var(--text-secondary)', fontSize: '0.65rem' }}>
                    {name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
