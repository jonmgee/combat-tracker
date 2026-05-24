import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CONDITIONS, CATEGORY_LABELS } from '../../lib/conditions'
import type { Condition, ConditionCategory } from '../../types'

interface Props {
  combatantId: string
  activeConditions: Condition[]
  onClose: () => void
}

const CATEGORIES: ConditionCategory[] = ['standard', 'weapon_mastery', 'spell']

export default function ConditionPicker({ combatantId, activeConditions, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<ConditionCategory>('standard')
  const activeNames = new Set(activeConditions.map(c => c.condition))

  async function toggle(name: string, category: ConditionCategory) {
    if (activeNames.has(name)) {
      const cond = activeConditions.find(c => c.condition === name)
      if (cond) await supabase.from('conditions').delete().eq('id', cond.id)
    } else {
      await supabase.from('conditions').insert({ combatant_id: combatantId, condition: name, category })
    }
  }

  const filtered = CONDITIONS.filter(c => c.category === activeTab)

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
          {CATEGORIES.map(cat => (
            <button key={cat}
              onClick={() => setActiveTab(cat)}
              className="flex-1 py-2.5 text-xs uppercase tracking-wider transition-all"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: activeTab === cat ? 'var(--gold)' : 'var(--text-dim)',
                borderBottom: activeTab === cat ? '2px solid var(--gold)' : '2px solid transparent',
                letterSpacing: '0.08em',
              }}>
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Conditions grid */}
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(c => {
              const active = activeNames.has(c.name)
              return (
                <button key={c.name}
                  onClick={() => toggle(c.name, c.category)}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-center transition-all active:scale-95"
                  style={{
                    background: active ? 'rgba(201,168,76,0.15)' : 'var(--bg-raised)',
                    border: `1px solid ${active ? 'var(--gold-dark)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}>
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-xs leading-tight" style={{ color: active ? 'var(--gold-light)' : 'var(--text-secondary)', fontSize: '0.65rem' }}>
                    {c.name}
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
