import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { LIQUID_GLASS, LIQUID_FIELD } from '../lib/glassTokensLight'
import { LiquidLensFilter, LiquidPill } from '../components/ui/liquidGlass'
import TileField from '../components/ui/TileField'

/**
 * Password recovery, both halves of it.
 *
 * This page is mounted at two routes and used to assume it was only ever reached the
 * second way:
 *
 *   /forgot-password   someone clicked "Forgot your password?" and has no link yet.
 *                      They need to ask for one. There was previously nowhere on the
 *                      site to do that, so this route showed "Invalid reset link" over
 *                      two password fields that could not work, and recovery was a
 *                      dead end.
 *
 *   /reset-password    they clicked the link in the email and are setting a new
 *                      password.
 *
 * A recovery link can arrive in two shapes, and both have to be handled:
 *
 *   ?token_hash=...&type=recovery   the current flow, exchanged with verifyOtp.
 *   #access_token=...&type=recovery the older implicit flow. supabase-js picks the
 *                                   session up off the fragment by itself and fires
 *                                   PASSWORD_RECOVERY, so there is no token_hash to
 *                                   read. Checking only the query string called these
 *                                   invalid while the session was in fact live.
 *
 * So the mode is decided by what actually arrived, and an expired link offers a new one
 * rather than leaving the person somewhere they cannot act.
 */

const MUTED = '#8a8995'
const LABEL = '#565560'
const INK = '#14111a'
const GREEN = '#1DB954'

const labelStyle = { fontSize: '12px', fontWeight: 600, color: LABEL, display: 'block', marginBottom: '6px' }
const noteStyle = { color: MUTED, fontSize: '13px', lineHeight: 1.6 }
const linkStyle = { color: GREEN, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: '13px', fontFamily: 'inherit' }
const toggleStyle = {
  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
  fontSize: '12px', fontWeight: 600, padding: '4px 6px', fontFamily: 'inherit',
}

export default function PasswordResetPage() {
  const navigate = useNavigate()

  // 'checking' | 'request' | 'set' | 'sent' | 'done'
  const [mode, setMode] = useState('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function decide() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')

      if (tokenHash && type === 'recovery') {
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        if (cancelled) return
        if (otpError) {
          setError('That link has expired. Ask for a new one below.')
          setMode('request')
        } else {
          setMode('set')
        }
        return
      }

      // No token in the query string. Either supabase-js already picked a recovery
      // session up off the URL fragment, or this person arrived with no link at all.
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      const fromFragment = window.location.hash.includes('type=recovery')
      setMode(data?.session && fromFragment ? 'set' : 'request')
    }

    decide()
    return () => { cancelled = true }
  }, [])

  async function handleSendLink() {
    const address = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    setLoading(true)
    setError(null)
    // The result is deliberately not branched on. Telling someone whether an address
    // has an account here would turn this form into a way to test who is a member.
    await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    setMode('sent')
  }

  async function handleReset() {
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }
    setMode('done')
    setLoading(false)
    setTimeout(() => navigate('/login'), 2000)
  }

  const inputStyle = { ...LIQUID_FIELD, width: '100%', fontSize: '14px', boxSizing: 'border-box', paddingRight: '64px' }
  const plainInputStyle = { ...LIQUID_FIELD, width: '100%', fontSize: '14px', boxSizing: 'border-box' }

  const heading = mode === 'request' || mode === 'sent' ? 'Reset your password' : 'Set a new password'

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <LiquidLensFilter />
      <TileField animated={false} opacity={0.22} />
      <div style={{ ...LIQUID_GLASS, position: 'relative', zIndex: 2, padding: '40px', width: '100%', maxWidth: '420px' }}>
        <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em', color: INK, marginBottom: '20px' }}>{heading}</div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>{error}</div>
        )}

        {mode === 'checking' && (
          <div style={noteStyle}>Checking your link…</div>
        )}

        {mode === 'request' && (
          <>
            <p style={{ ...noteStyle, margin: '0 0 18px' }}>
              Enter the email address on your account and we'll send you a link to set a new password.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="lt-reset-email" style={labelStyle}>Email address</label>
              <input
                id="lt-reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendLink()}
                placeholder="you@example.com"
                style={plainInputStyle}
              />
            </div>
            <LiquidPill primary onClick={handleSendLink} disabled={loading} style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', padding: '14px', fontSize: '15px', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </LiquidPill>
            <div style={{ marginTop: '18px', textAlign: 'center' }}>
              <button type="button" style={linkStyle} onClick={() => navigate('/login')}>Back to sign in</button>
            </div>
          </>
        )}

        {mode === 'sent' && (
          <>
            <p style={{ ...noteStyle, margin: '0 0 8px' }}>
              If there's a LensTrybe account for <strong style={{ color: INK }}>{email.trim().toLowerCase()}</strong>, a reset link is on its way.
            </p>
            <p style={{ ...noteStyle, margin: '0 0 20px' }}>
              It can take a minute to arrive. Check your spam folder before trying again.
            </p>
            <LiquidPill primary onClick={() => navigate('/login')} style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', padding: '14px', fontSize: '15px' }}>
              Back to sign in
            </LiquidPill>
            <div style={{ marginTop: '18px', textAlign: 'center' }}>
              <button type="button" style={linkStyle} onClick={() => { setMode('request'); setError(null) }}>Use a different email</button>
            </div>
          </>
        )}

        {mode === 'set' && (
          <>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="lt-new-password" style={labelStyle}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="lt-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  style={inputStyle}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={toggleStyle}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="lt-confirm-password" style={labelStyle}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="lt-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  placeholder="Repeat new password"
                  style={inputStyle}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={toggleStyle}>
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <LiquidPill primary onClick={handleReset} disabled={loading} style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', padding: '14px', fontSize: '15px', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Updating…' : 'Set new password'}
            </LiquidPill>
          </>
        )}

        {mode === 'done' && (
          <div style={{ color: GREEN, fontSize: '15px', fontWeight: 600 }}>Password updated. Taking you to sign in…</div>
        )}
      </div>
    </div>
  )
}
