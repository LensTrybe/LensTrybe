import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function PasswordResetPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session)
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      await supabase.auth.signOut()
      setTimeout(() => navigate('/login'), 2500)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: '#0a0a0f',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
    color: '#fff', fontSize: '14px', fontFamily: 'Inter, sans-serif',
    outline: 'none', boxSizing: 'border-box', paddingRight: '44px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Reset Password</div>

        {success ? (
          <div style={{ color: '#1DB954', fontSize: '15px', fontWeight: 600 }}>✓ Password updated! Redirecting to login…</div>
        ) : !ready ? (
          <div style={{ color: '#666', fontSize: '14px' }}>
            Verifying your reset link…
            <br /><br />
            <a href="/login" style={{ color: '#1DB954', fontSize: '13px' }}>Back to login</a>
          </div>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '28px' }}>Enter your new password below.</p>
            {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>{error}</div>}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#888', display: 'block', marginBottom: '6px' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={inputStyle} />
                <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '16px', padding: 0 }}>{showPassword ? '🙈' : '👁'}</button>
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#888', display: 'block', marginBottom: '6px' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" onKeyDown={e => e.key === 'Enter' && handleReset()} style={inputStyle} />
                <button onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '16px', padding: 0 }}>{showConfirm ? '🙈' : '👁'}</button>
              </div>
            </div>
            <button onClick={handleReset} disabled={loading} style={{ width: '100%', padding: '12px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
