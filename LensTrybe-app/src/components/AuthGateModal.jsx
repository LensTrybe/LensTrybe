import React from 'react'
import { Link } from 'react-router-dom'

const PINK = '#D946EF'
const CARD = '#111118'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   variant: 'enquire' | 'postJob' | 'applyJob' | 'applyJobClient',
 *   creativeName?: string,
 * }} props
 */
export default function AuthGateModal({ open, onClose, variant, creativeName = 'this creative' }) {
  if (!open) return null

  const copy =
    variant === 'applyJobClient'
      ? {
          title: 'Creative account required',
          body: 'Only creative accounts can apply for jobs. Log in with a creative account or join as a creative.',
          primary: { label: 'Log In', to: '/login' },
          secondary: { label: 'Join as a Creative', to: '/join' },
          footer: null,
        }
      : variant === 'enquire'
      ? {
          title: 'Sign in to contact this creative',
          body: `Create a free client account or log in to send an enquiry to ${creativeName}.`,
          primary: { label: 'Create Free Account', to: '/join/client' },
          secondary: { label: 'Log In', to: '/login' },
          footer: { label: 'Are you a creative? Join here', to: '/join' },
        }
      : variant === 'postJob'
        ? {
            title: 'Sign in to post a job',
            body: 'Create a free client account to post a job and connect with talented creatives.',
            primary: { label: 'Create Free Account', to: '/join/client' },
            secondary: { label: 'Log In', to: '/login' },
            footer: null,
          }
        : {
            title: 'Sign in to apply',
            body: 'Log in to your creative account to apply for this job.',
            primary: { label: 'Log In', to: '/login' },
            secondary: { label: 'Join as a Creative', to: '/join' },
            footer: null,
          }

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,8,16,0.88)',
    zIndex: 5000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    boxSizing: 'border-box',
  }

  return (
    <div style={overlay} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-gate-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD,
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>LensTrybe</div>
          <div style={{ color: PINK, fontSize: 11, fontWeight: 700, marginTop: 4 }}>Connect. Capture. Create.</div>
        </div>

        <h2 id="auth-gate-title" style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: '0 0 12px', lineHeight: 1.3 }}>
          {copy.title}
        </h2>
        <p style={{ color: '#888', fontSize: 14, lineHeight: 1.55, margin: '0 0 22px' }}>{copy.body}</p>

        <div style={{ display: 'grid', gap: 10 }}>
          <Link
            to={copy.primary.to}
            onClick={onClose}
            style={{
              display: 'block',
              textAlign: 'center',
              background: PINK,
              color: '#fff',
              fontWeight: 800,
              fontSize: 14,
              padding: '14px 18px',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            {copy.primary.label}
          </Link>
          <Link
            to={copy.secondary.to}
            onClick={onClose}
            style={{
              display: 'block',
              textAlign: 'center',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.22)',
              color: '#e5e5e5',
              fontWeight: 700,
              fontSize: 14,
              padding: '14px 18px',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            {copy.secondary.label}
          </Link>
        </div>

        {copy.footer ? (
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <Link
              to={copy.footer.to}
              onClick={onClose}
              style={{ color: '#888', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
            >
              {copy.footer.label}
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 16,
            background: 'none',
            border: 'none',
            color: '#666',
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
