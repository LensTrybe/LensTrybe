import { useEffect } from 'react'

// What a client sees: the creative's promotional poster, once, shortly after the profile
// opens. Everything shown here has already been filtered server side by
// profile_poster_public, so a switched off, expired or downgraded poster never reaches the
// page at all.
//
// Deliberately not an ad. It is a card on a dimmed profile, closes on Escape, on the
// backdrop and on an obvious close button, and once dismissed it stays shut for that
// visitor until the creative changes the poster.
//
// Top level component. Never define this inside another component's render function.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'

export default function ProfilePosterModal({ poster, imageUrl, businessName, onClose, onEnquire }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    // A modal that leaves the page scrolling behind it feels broken on a phone.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  if (!poster) return null

  const heading = String(poster.heading || '').trim()
  const body = String(poster.body || '').trim()
  const ctaLabel = String(poster.cta_label || 'Enquire now').trim() || 'Enquire now'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading || `An offer from ${businessName || 'this creative'}`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(8,7,13,0.62)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'ltPosterIn .22s ease',
      }}
    >
      <style>{`
        @keyframes ltPosterIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ltPosterCardIn { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--lt-modal-bg, #14141c)',
          border: 'var(--lt-modal-border, 1px solid rgba(255,255,255,0.08))',
          boxShadow: 'var(--lt-modal-shadow, 0 30px 80px -24px rgba(0,0,0,0.6))',
          borderRadius: 18,
          overflow: 'hidden',
          animation: 'ltPosterCardIn .26s ease',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 2,
            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(8,7,13,0.55)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {imageUrl && (
          <img
            src={imageUrl}
            alt={heading || 'Offer'}
            style={{ display: 'block', width: '100%', maxHeight: 340, objectFit: 'cover' }}
          />
        )}

        {(heading || body || poster.cta_enabled) && (
          <div style={{ padding: '20px 22px 22px' }}>
            {businessName && (
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: GREEN, marginBottom: 9 }}>
                From {businessName}
              </div>
            )}
            {heading && (
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, color: 'var(--lt-text, #fff)', marginBottom: body ? 8 : 0 }}>
                {heading}
              </div>
            )}
            {body && (
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--lt-muted, #9a9aa8)', whiteSpace: 'pre-wrap' }}>
                {body}
              </div>
            )}

            {poster.cta_enabled && (
              <button
                type="button"
                onClick={onEnquire}
                style={{
                  marginTop: 18, width: '100%', padding: '13px 20px', borderRadius: 11,
                  border: 'none', background: GREEN, color: GREEN_TEXT,
                  fontSize: 14.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {ctaLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
