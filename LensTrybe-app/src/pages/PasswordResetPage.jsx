import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function PasswordResetPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Supabase puts the token in the URL hash as access_token
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const type = hashParams.get('type')

    if (accessToken && type === 'recovery') {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => { setValidSession(true); setChecking(false) })
        .catch(() => { setError('Invalid or expired reset link.'); setChecking(false) })
    } else {
      setError('Invalid reset link. Please request a new one.')
      setChecking(false)
    }
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
      setTimeout(() => navigate('/dashboard'), 2500)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Reset Password</div>

        {checking ? (
          <div style={{ color: '#666', fontSize: '14px' }}>Verifying link…</div>
        ) : success ? (
          <div style={{ color: '#1DB954', fontSize: '15px', fontWeight: 600 }}>✓ Password updated! Redirecting to dashboard…</div>
        ) : !validSession ? (
          <div>
            <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '20px' }}>{error}</div>
            <a href="/login" style={{ color: '#1DB954', fontSize: '14px' }}>Back to login</a>
          </div>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '28px' }}>Enter your new password below.</p>
            {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>{error}</div>}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#888', display: 'block', marginBottom: '6px' }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                style={{ width: '100%', padding: '11px 14px', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#888', display: 'block', marginBottom: '6px' }}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                style={{ width: '100%', padding: '11px 14px', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '14px', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <button
              onClick={handleReset}
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
