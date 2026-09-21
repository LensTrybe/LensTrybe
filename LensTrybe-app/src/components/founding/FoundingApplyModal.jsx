import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { TYPO } from '../../lib/glassTokensLight'
import FoundingApplyForm from './FoundingApplyForm'

/* The founding offer application, opened from the home page hero.
 *
 * A modal rather than a link to /founding, so a creative who is interested can put
 * their hand up without leaving the page they were reading. The full offer is one
 * click away for anyone who wants the detail first.
 *
 * Escape and a click outside both close it, the page behind stops scrolling while it
 * is open, and focus returns to whatever opened it.
 */

const GREEN_TEXT = '#0E7C3A'

export default function FoundingApplyModal({ open, onClose, isMobile }) {
  const returnFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    returnFocus.current = document.activeElement

    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      const el = returnFocus.current
      if (el && typeof el.focus === 'function') el.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(20,17,26,0.42)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : '24px',
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="founding-apply-title"
        style={{
          position: 'relative',
          width: '100%', maxWidth: '640px',
          maxHeight: isMobile ? '92dvh' : 'calc(100dvh - 48px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(250,249,252,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.9)',
          borderRadius: isMobile ? '22px 22px 0 0' : '22px',
          boxShadow: '0 40px 100px -30px rgba(31,38,90,0.45), inset 0 1px 0 rgba(255,255,255,1)',
          padding: isMobile ? '22px 18px 26px' : '30px 30px 28px',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12, width: 44, height: 44,
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 26, lineHeight: 1, color: '#55535f', borderRadius: 12,
          }}
        >
          &times;
        </button>

        <div style={{
          fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: GREEN_TEXT, marginBottom: '10px',
        }}>
          Founding offer
        </div>

        <h2 id="founding-apply-title" style={{
          margin: '0 44px 8px 0', fontSize: isMobile ? '24px' : '28px', fontWeight: 600,
          letterSpacing: '-0.02em', lineHeight: 1.15, color: '#14111a', fontFamily: "'Inter', sans-serif",
        }}>
          Apply for a founding place
        </h2>

        <p style={{ margin: '0 0 20px', color: '#55535f', fontSize: '15px', ...TYPO.body }}>
          Expert free for up to twelve months, then $49 a month locked in for life. Places
          are limited and hand picked, so tell us a little about your work.{' '}
          <Link to="/founding" onClick={onClose} style={{ color: GREEN_TEXT, fontWeight: 600, textDecoration: 'none' }}>
            See the full offer
          </Link>
        </p>

        <FoundingApplyForm isMobile={isMobile} framed={false} autoFocus />
      </div>
    </div>,
    document.body,
  )
}
