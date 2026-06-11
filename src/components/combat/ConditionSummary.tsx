import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { CONDITION_ASSETS } from '../../lib/conditionAssets'
import { CONDITION_ICON_MAP, ConditionImage } from './ConditionIcons'
import { CONDITION_MAP } from '../../lib/conditions'
import { supabase } from '../../lib/supabase'
import type { Condition } from '../../types'

function ConditionSheetPanel({ open, onClose, combatantId, activeConditions }: { open: boolean; onClose: () => void; combatantId: string; activeConditions: Condition[] }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !activeConditions || activeConditions.length === 0) return null

  async function removeCondition(id: string) {
    try {
      await supabase.from('conditions').delete().eq('id', id)
    } catch (err) {
      console.error('Failed to remove condition', err)
    }
  }

  const ordered = [...activeConditions].sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime())
  const headerAsset = CONDITION_ASSETS[ordered[0].condition]
  void headerAsset

  return (
    open ? ReactDOM.createPortal(sheet, popoverRoot || document.body) : null
  )
}

export default function ConditionSummary({ combatantId, activeConditions }: { combatantId: string; activeConditions: Condition[] }) {
  const [open, setOpen] = useState(false)

  if (!activeConditions || activeConditions.length === 0) return null

  const ordered = [...activeConditions].sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime())
  const headerAsset = CONDITION_ASSETS[ordered[0].condition]
  const IconNode = headerAsset
    ? <ConditionImage folder={headerAsset.folder} filename={headerAsset.filename} alt={ordered[0].condition} />
    : (CONDITION_ICON_MAP[ordered[0].condition] ? React.createElement(CONDITION_ICON_MAP[ordered[0].condition]) : <span style={{ fontSize: '0.8rem' }}>{ordered[0].condition[0]}</span>)

  return (
    <div className="condition-summary" style={{ display: 'none', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 48 }}>
      <button
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`conditions-sheet-${combatantId}`}
        className="cond-summary-btn"
        onClick={e => { e.stopPropagation(); setOpen(s => !s) }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', justifyContent: 'flex-start', flexWrap: 'wrap' }}
      >
        {ordered.map(c => {
          const asset = CONDITION_ASSETS[c.condition]
          const iconNode = asset
            ? <ConditionImage folder={asset.folder} filename={asset.filename} alt={c.condition} />
            : (() => { const Ic = CONDITION_ICON_MAP[c.condition]; return Ic ? <Ic /> : <span style={{ fontSize: '0.7rem' }}>{c.condition[0]}</span> })()
          return (
            <div key={c.id} style={{ width: 30, height: 30, borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
              {iconNode}
            </div>
          )
        })}
      </button>

      <ConditionSheetPanel open={open} onClose={() => setOpen(false)} combatantId={combatantId} activeConditions={activeConditions} />
    </div>
  )
}
