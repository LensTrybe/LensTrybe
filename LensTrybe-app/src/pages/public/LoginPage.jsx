import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { LT_GOOGLE_OAUTH_PENDING_KEY } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function LoginPage() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const userId = data.user.id

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      navigate('/dashboard', { replace: true })
      return
    }

    const { data: client } = await supabase
      .from('client_accounts')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (client) {
      navigate('/')
      return
    }

    navigate('/')
  }

  const styles = {
    page: {
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '24px' : '40px 24px',
    },
    card: { width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '32px' },
    header: { display: 'flex', flexDirection: 'column', gap: '8px' },
    logo: { fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '8px', cursor: 'pointer' },
    title: { fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    passwordWrap: { position: 'relative' },
    showBtn: {
      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
      fontSize: '12px', fontFamily: 'var(--font-ui)', padding: '4px',
    },
    forgotLink: {
      fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none',
      textAlign: 'right', display: 'block', marginTop: '-8px',
      fontFamily: 'var(--font-ui)', cursor: 'pointer',
    },
    divider: { display: 'flex', alignItems: 'center', gap: '12px' },
    dividerLine: { flex: 1, height: '1px', background: 'var(--border-subtle)' },
    dividerText: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    errorBox: {
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 'var(--radius-lg)', padding: '12px 16px',
      fontSize: '13px', color: 'var(--error)', fontFamily: 'var(--font-ui)',
    },
    footer: { fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-ui)' },
    link: { color: 'var(--green)', textDecoration: 'none', fontWeight: 500 },
  }

  return (
    <div style={styles.page} className="login-page">
      <style>{`
        @media (max-width: 767px) {
          .login-page button { min-height: 44px; }
          .login-page input, .login-page textarea, .login-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
          <h1 style={styles.title}>Welcome back.</h1>
          <p style={styles.subtitle}>Sign in to your account to continue.</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form style={styles.form} onSubmit={handleLogin}>
          <Input
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <div style={styles.passwordWrap}>
            <Input
              type={showPassword ? 'text' : 'password'}
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              style={styles.showBtn}
              onClick={() => setShowPassword(p => !p)}
            >
              {showPassword ? '👁' : '👁‍🗨'}
            </button>
          </div>
          <span style={styles.forgotLink} onClick={() => navigate('/forgot-password')}>
            Forgot your password?
          </span>
          <Button
            variant="primary"
            size="lg"
            disabled={loading || !email || !password}
            onClick={handleLogin}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem(LT_GOOGLE_OAUTH_PENDING_KEY, '1')
              } catch {
                /* ignore */
              }
              void supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } })
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '11px 16px', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
              color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)',
              cursor: 'pointer', transition: 'all var(--transition-fast)', width: '100%', fontWeight: 500,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>or sign in with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        <div style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/join" style={styles.link}>Join as a Creative</Link>
          {' '}or{' '}
          <Link to="/join/client" style={styles.link}>join as a Client</Link>
        </div>
      </div>
    </div>
  )
}
