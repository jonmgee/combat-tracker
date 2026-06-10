import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { CONDITION_ASSETS } from '../../lib/conditionAssets'
import { CONDITION_ICON_MAP, ConditionImage } from './ConditionIcons'
import { CONDITION_MAP } from '../../lib/conditions'
import { supabase } from '../../lib/supabase'
import type { Condition } from '../../types'

export default function ConditionSummary({ combatantId, activeConditions }: { combatantId: string; activeConditions: Condition[] }) {
  const [open, setOpen] = useState(false)

  // Handle escape to close when open
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!activeConditions || activeConditions.length === 0) return null

  async function removeCondition(id: string) {
    try {
      await supabase.from('conditions').delete().eq('id', id)
    } catch (err) {
      console.error('Failed to remove condition', err)
    }
  }

  // sort by applied_at ascending (order of application)
  const ordered = [...activeConditions].sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime())


  // header icon for sheet (use first ordered condition)
  const headerAsset = CONDITION_ASSETS[ordered[0].condition]
  const IconNode = headerAsset
    ? <ConditionImage folder={headerAsset.folder} filename={headerAsset.filename} alt={ordered[0].condition} />
    : (CONDITION_ICON_MAP[ordered[0].condition] ? React.createElement(CONDITION_ICON_MAP[ordered[0].condition]) : <span style={{ fontSize: '0.8rem' }}>{ordered[0].condition[0]}</span>)

  const popoverRoot = (typeof document !== 'undefined' && document.getElementById('popover-root')) || null

  const sheet = (
    <div
      id={`conditions-sheet-${combatantId}`}
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none' }}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100000, pointerEvents: 'auto' }} />

      {/* Sheet panel */}
      <div
        onClick={e => { e.stopPropagation(); }}
        style={{
          zIndex: 100001,
          width: '100%', maxWidth: 720, borderTopLeftRadius: 12, borderTopRightRadius: 12,
          background: 'var(--bg-panel)', color: 'var(--text-primary)', padding: 16, boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          pointerEvents: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {IconNode}
            </div>
            <div style={{ fontWeight: 700 }}>Conditions</div>
          </div>
          <div>
            <button type="button" aria-label="Close conditions" onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ordered.map(cond => {
            const asset = CONDITION_ASSETS[cond.condition]
            const Def = CONDITION_MAP[cond.condition]
            const Icon = asset ? <ConditionImage folder={asset.folder} filename={asset.filename} alt={cond.condition} /> : (CONDITION_ICON_MAP[cond.condition] ? React.createElement(CONDITION_ICON_MAP[cond.condition]) : <span style={{ fontSize: '0.8rem' }}>{cond.condition[0]}</span>)
            return (
              <div key={cond.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {Icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{cond.condition}</div>
                  {Def?.desc && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 4 }}>{Def.desc}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button type="button" aria-label={`Remove ${cond.condition}`} onClick={(e) => { e.stopPropagation(); if (e.nativeEvent && typeof (e.nativeEvent as any).stopImmediatePropagation === 'function') try { (e.nativeEvent as any).stopImmediatePropagation() } catch (err) {} removeCondition(cond.id); }} style={{ background: 'transparent', border: '1px solid rgba(200,60,50,0.9)', color: '#e06050', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )

  return (
    <div className="condition-summary" style={{ display: 'none', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto', minWidth: 48 }}>
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

      {open && (
        ReactDOM.createPortal(
          sheet,
          popoverRoot || document.body
        )
      )}
    </div>
  )
}
