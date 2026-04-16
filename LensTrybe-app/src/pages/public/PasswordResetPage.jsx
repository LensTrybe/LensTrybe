import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function PasswordResetPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleRequest() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  async function handleReset() {
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
    setTimeout(() => navigate('/login'), 2000)
  }

  const styles = {
    page: { minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' },
    card: { width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '32px' },
    logo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '8px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', fontSize: '13px', color: 'var(--error)', fontFamily: 'var(--font-ui)' },
    successBox: { background: 'var(--green-dim)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: 'var(--radius-lg)', padding: '16px', fontSize: '14px', color: 'var(--green)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, textAlign: 'center' },
    footer: { fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-ui)' },
    link: { color: 'var(--green)', textDecoration: 'none', fontWeight: 500, cursor: 'pointer' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div>
          <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
          <h1 style={styles.title}>{mode === 'request' ? 'Reset your password' : 'Set new password'}</h1>
          <p style={styles.subtitle}>
            {mode === 'request'
              ? 'Enter your email and we\'ll send you a reset link.'
              : 'Choose a new password for your account.'
            }
          </p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {done ? (
          <div style={styles.successBox}>
            {mode === 'request'
              ? '✓ Reset link sent. Check your inbox and click the link to set a new password.'
              : '✓ Password updated. Redirecting you to login…'
            }
          </div>
        ) : mode === 'request' ? (
          <div style={styles.form}>
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <Button variant="primary" size="lg" disabled={loading || !email} onClick={handleRequest}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </div>
        ) : (
          <div style={styles.form}>
            <Input
              label="New password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <Input
              label="Confirm new password"
              type="password"
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : ''}
            />
            <Button variant="primary" size="lg" disabled={loading || !password || password !== confirmPassword} onClick={handleReset}>
              {loading ? 'Updating…' : 'Update Password'}
            </Button>
          </div>
        )}

        <div style={styles.footer}>
          Remember your password?{' '}
          <span style={styles.link} onClick={() => navigate('/login')}>Back to login</span>
        </div>
      </div>
    </div>
  )
}
