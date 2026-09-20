import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { LIQUID_GLASS } from '../../lib/glassTokensLight'
import { LiquidLensFilter, LiquidPill } from '../../components/ui/liquidGlass'
import TileField from '../../components/ui/TileField'
import useIsMobile from '../../hooks/useIsMobile'

/* Where signing up lands.
 *
 * This used to be a red error box on the form saying to check your inbox,
 * which reads as something having gone wrong at the exact moment the person
 * has succeeded. Nothing is wrong: the account exists and there is one step
 * left, so it gets its own page and the page says so plainly.
 *
 * The address arrives in router state rather than the URL, because an email
 * address does not belong in a link that gets copied, logged or shared. */

export default function CheckEmailPage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { state } = useLocation()
  const email = state?.email || ''
  const backTo = state?.backTo || '/join/client'

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  const resend = async () => {
    if (!email) {
      setError('Go back and enter your email again so we know where to send it.')
      return
    }
    setResending(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email })
      if (err) throw err
      setResent(true)
    } catch (err) {
      setError(err.message || 'Could not send it again. Try in a minute.')
    }
    setResending(false)
  }

  const styles = {
    page: {
      minHeight: '100dvh',
      background: 'transparent',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    },
    card: {
      width: '100%',
      maxWidth: '460px',
      display: 'flex',
      flexDirection: 'column',
      gap: '22px',
      ...LIQUID_GLASS,
      position: 'relative',
      zIndex: 2,
      padding: '36px 32px',
      textAlign: 'center',
    },
    logo: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontSize: '19px',
      color: 'var(--text-primary)',
      cursor: 'pointer',
    },
    title: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      letterSpacing: '-0.02em',
      lineHeight: 1.12,
      fontSize: isMobile ? '28px' : '32px',
      color: 'var(--text-primary)',
      margin: 0,
    },
    body: { fontSize: '15.5px', lineHeight: 1.55, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: 0 },
    address: { fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' },
    note: { fontSize: '13.5px', lineHeight: 1.55, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: 0 },
    good: {
      padding: '12px 16px',
      background: 'var(--green-dim)',
      border: '1px solid rgba(29,185,84,0.3)',
      borderRadius: 'var(--radius-lg)',
      fontSize: '13.5px',
      color: '#0E7C3A',
      fontFamily: 'var(--font-ui)',
    },
    bad: {
      padding: '12px 16px',
      background: 'rgba(255,45,120,0.09)',
      border: '1px solid rgba(255,45,120,0.32)',
      borderRadius: 'var(--radius-lg)',
      fontSize: '13.5px',
      color: '#c11f5a',
      fontFamily: 'var(--font-ui)',
    },
    link: { color: '#0E7C3A', textDecoration: 'none', fontWeight: 600 },
    quiet: {
      minHeight: 44,
      padding: '0 6px',
      border: 'none',
      background: 'transparent',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)',
      fontSize: '13.5px',
      fontWeight: 600,
      cursor: 'pointer',
      textDecoration: 'underline',
    },
  }

  return (
    <div style={styles.page}>
      <LiquidLensFilter />
      {!isMobile && <TileField animated={false} opacity={0.22} minColumns={6} />}

      <div style={styles.card}>
        <div style={styles.logo} onClick={() => navigate('/')}>
          LensTrybe
        </div>

        <div aria-hidden style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: 999,
              background: 'var(--green-dim)',
              border: '1px solid rgba(29,185,84,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0E7C3A',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
        </div>

        <h1 style={styles.title}>Check your inbox</h1>

        <p style={styles.body}>
          {email ? (
            <>
              We have sent a confirmation link to <span style={styles.address}>{email}</span>. Click it and your account
              is ready.
            </>
          ) : (
            <>We have sent you a confirmation link. Click it and your account is ready.</>
          )}
        </p>

        <p style={styles.note}>
          It usually lands within a minute. If it is not there, have a look in your spam or promotions folder.
        </p>

        {resent && <div style={styles.good}>Sent again. Give it a minute to arrive.</div>}
        {error && <div style={styles.bad}>{error}</div>}

        {!resent && (
          <LiquidPill
            primary
            onClick={resend}
            disabled={resending}
            style={{ flex: '0 0 auto', display: 'inline-flex', justifyContent: 'center', padding: '14px 26px' }}
          >
            {resending ? 'Sending…' : 'Send it again'}
          </LiquidPill>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={styles.quiet} onClick={() => navigate(backTo, { replace: true })}>
            Use a different email
          </button>
          <span aria-hidden style={{ color: 'var(--border-subtle)' }}>·</span>
          <Link to="/login" style={{ ...styles.quiet, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center' }}>
            Already confirmed? Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
