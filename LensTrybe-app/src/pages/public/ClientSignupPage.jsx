import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function ClientSignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const emailPrefillApplied = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
  })

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (emailPrefillApplied.current) return
    const raw = location.state?.email
    if (!raw || typeof raw !== 'string') return
    const trimmed = raw.trim()
    if (!trimmed) return
    emailPrefillApplied.current = true
    setForm(prev => ({ ...prev, email: trimmed }))
    navigate('/join/client', { replace: true, state: {} })
  }, [location.state, navigate])

  const canSubmit = form.firstName && form.lastName && form.email && form.password && form.password === form.confirmPassword

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Sign up with email confirmation disabled redirect
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/client-dashboard`,
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            account_type: 'client',
          }
        }
      })
      if (authError) throw authError

      const userId = authData.user.id
      const session = authData.session

      // If session exists (email confirmation disabled), insert directly
      if (session) {
        const { error: clientError } = await supabase.from('client_accounts').insert({
          id: userId,
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          company_name: form.company || null,
        })
        if (clientError) throw clientError
        navigate('/client-dashboard')
      } else {
        // Email confirmation required — show message
        setError('Please check your email and click the confirmation link to complete signup.')
        setLoading(false)
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    },
    card: { width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '32px' },
    header: { display: 'flex', flexDirection: 'column', gap: '8px' },
    logo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '8px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    errorBox: {
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 'var(--radius-lg)',
      padding: '12px 16px',
      fontSize: '13px',
      color: 'var(--error)',
      fontFamily: 'var(--font-ui)',
    },
    divider: { display: 'flex', alignItems: 'center', gap: '12px' },
    dividerLine: { flex: 1, height: '1px', background: 'var(--border-subtle)' },
    dividerText: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    footer: { fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-ui)' },
    link: { color: 'var(--green)', textDecoration: 'none', fontWeight: 500 },
    freeNote: {
      padding: '14px 16px',
      background: 'var(--green-dim)',
      border: '1px solid rgba(29,185,84,0.3)',
      borderRadius: 'var(--radius-lg)',
      fontSize: '13px',
      color: 'var(--green)',
      fontFamily: 'var(--font-ui)',
    },
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.header}>
          <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
          <h1 style={styles.title}>Find your creative.</h1>
          <p style={styles.subtitle}>Create a free client account to enquire, book and manage projects.</p>
        </div>

        <div style={styles.freeNote}>
          ✓ Free forever — clients never pay to use LensTrybe
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.row}>
            <Input label="First name" placeholder="Alex" value={form.firstName} onChange={e => update('firstName', e.target.value)} />
            <Input label="Last name" placeholder="Johnson" value={form.lastName} onChange={e => update('lastName', e.target.value)} />
          </div>
          <Input label="Email address" type="email" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
          <Input label="Company (optional)" placeholder="Your business name" value={form.company} onChange={e => update('company', e.target.value)} />
          <div style={{ position: 'relative' }}>
            <Input label="Password" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={form.password} onChange={e => update('password', e.target.value)} />
            <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px', marginTop: '10px' }}>
              {''}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Input label="Confirm password" type={showConfirm ? 'text' : 'password'} placeholder="Repeat your password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} error={form.confirmPassword && form.password !== form.confirmPassword ? 'Passwords do not match' : ''} />
            <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px', marginTop: '10px' }}>
              {''}
            </button>
          </div>

          <Button variant="primary" size="lg" disabled={loading || !canSubmit} onClick={handleSubmit}>
            {loading ? 'Creating account…' : 'Create Free Account'}
          </Button>
        </form>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>are you a creative?</span>
          <div style={styles.dividerLine} />
        </div>

        <div style={styles.footer}>
          <Link to="/join" style={styles.link}>Join as a Creative</Link>
          {' '}or{' '}
          <Link to="/login" style={styles.link}>sign in to existing account</Link>
        </div>

      </div>
    </div>
  )
}
