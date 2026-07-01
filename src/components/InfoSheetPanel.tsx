import { useEffect, type ReactNode } from 'react'
import ReactDOM from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Reusable bottom-sheet panel following the same visual pattern as
 * ConditionSheetPanel — portal-based, same z-index stack, same bg+rounded
 * treatment, Escape-to-close, click-outside-to-close.
 */
export default function InfoSheetPanel({ open, onClose, title, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const popoverRoot =
    (typeof document !== 'undefined' && document.getElementById('popover-root')) || null

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 100000,
          pointerEvents: 'auto',
        }}
      />

      {/* Sheet body */}
      <div
        onClick={(e) => { e.stopPropagation() }}
        style={{
          zIndex: 100001,
          width: '100%',
          maxWidth: 720,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          background: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          padding: 16,
          boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: '1.1rem',
              fontFamily: "'Cinzel', serif",
              color: 'var(--gold)',
              letterSpacing: '0.06em',
            }}
          >
            {title}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.25rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  )

  return ReactDOM.createPortal(sheet, popoverRoot || document.body)
}