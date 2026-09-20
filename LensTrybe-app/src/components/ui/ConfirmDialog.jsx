import { createPortal } from 'react-dom'

/* The ask before anything is deleted. Reach for useConfirm rather than this
 * directly: the hook holds the open state and the busy state for you. */

/** Portalled into `.lt-dash`, never document.body.
 *
 *  A fixed element inside a card with backdrop-filter is positioned against
 *  that card rather than the window, so a dialog opened from inside a glass
 *  panel lands hundreds of pixels down the page. `.lt-dash` is above every
 *  such card and carries the --lt-* tokens, so the dialog both pins to the
 *  window and stays themed. document.body would pin correctly and lose every
 *  token, which renders an unstyled box. */
function host() {
  if (typeof document === 'undefined') return null
  // Falls back to body outside the dashboard, where .lt-dash does not exist.
  // Every colour below carries a var() fallback for exactly that case, so the
  // dialog degrades to a plain light one rather than an invisible box.
  return document.querySelector('.lt-dash') || document.body
}

export default function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onClose,
}) {
  const target = host()
  if (!target) return null

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--lt-modal-bg, #ffffff)',
          border: 'var(--lt-modal-border, 1px solid rgba(20,17,26,0.14))',
          boxShadow: 'var(--lt-modal-shadow, 0 40px 100px -30px rgba(31,38,90,0.4))',
          backdropFilter: 'var(--lt-modal-blur, blur(30px) saturate(180%))',
          WebkitBackdropFilter: 'var(--lt-modal-blur, blur(30px) saturate(180%))',
          borderRadius: 18,
          padding: '22px 24px 20px',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--lt-text, #14111a)', lineHeight: 1.35 }}>{title}</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--lt-muted, #565560)', marginTop: 9 }}>
          {body || 'This cannot be undone.'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              minHeight: 44,
              padding: '0 18px',
              borderRadius: 10,
              background: 'var(--lt-input-bg, rgba(255,255,255,0.72))',
              border: '1px solid var(--lt-border, rgba(20,17,26,0.14))',
              color: 'var(--lt-text, #14111a)',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              minHeight: 44,
              padding: '0 18px',
              borderRadius: 10,
              border: 'none',
              background: danger ? '#FF2D78' : '#1DB954',
              color: danger ? '#ffffff' : '#04120a',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    target,
  )
}
