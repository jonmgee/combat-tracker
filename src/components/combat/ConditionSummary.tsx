import { CONDITION_ASSETS } from '../../lib/conditionAssets'
import { CONDITION_ICON_MAP } from './ConditionIcons'

export default function ConditionSummary({ combatantId, activeConditions }: { combatantId: string; activeConditions: any[] }) {
  const first = activeConditions[0]
  const extra = Math.max(0, activeConditions.length - 1)

  if (!first) return null

  const asset = CONDITION_ASSETS[first.condition]
  const Icon = asset ? () => <img src={`/assets/Condition Icons/${asset.folder}/${asset.filename}`} alt={first.condition} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : (CONDITION_ICON_MAP[first.condition] || (() => <span style={{ fontSize: '0.7rem' }}>{first.condition[0]}</span>))

  return (
    <div className="condition-summary" style={{ display: 'none', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <button aria-haspopup="dialog" aria-expanded="false" aria-controls={`conditions-sheet-${combatantId}`} className="cond-summary-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon />
        </div>
        {extra > 0 && (
          <div style={{ minWidth: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            +{extra}
          </div>
        )}
      </button>

      {/* Bottom sheet element placeholder — actual sheet is rendered at app root. */}
    </div>
  )
}
