import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser.js'
import { supabase } from '../lib/supabaseClient.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuthUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#39ff14', fontSize: 13, fontFamily: 'system-ui' }}>Loading...</div>
      </div>
    )
  }

  if (user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!supabase) { setError('Supabase is not configured.'); return }
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setSubmitting(false); return }
    navigate('/dashboard', { replace: true })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-bg {
          min-height: 100vh;
          background: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .login-bg::before {
          content: '';
          position: absolute;
          top: -30%;
          left: -20%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-bg::after {
          content: '';
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-card {
          width: 420px;
          max-width: 90vw;
          position: relative;
          z-index: 1;
        }

        .login-brand {
          text-align: center;
          margin-bottom: 36px;
        }

        .login-brand-name {
          font-size: 32px;
          font-weight: 900;
          color: #39ff14;
          letter-spacing: -0.5px;
        }

        .login-brand-tagline {
          font-size: 13px;
          color: #444;
          margin-top: 6px;
        }

        .login-form-card {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 16px;
          padding: 36px;
        }

        .login-form-title {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }

        .login-form-sub {
          font-size: 13px;
          color: #555;
          margin-bottom: 28px;
        }

        .login-field {
          margin-bottom: 18px;
        }

        .login-field label {
          display: block;
          font-size: 12px;
          color: #888;
          font-weight: 600;
          margin-bottom: 7px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .login-field input {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          padding: 12px 14px;
          color: #e8e8e8;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }

        .login-field input:focus {
          border-color: #39ff14;
          background: #1e1e1e;
        }

        .login-field input::placeholder {
          color: #3a3a3a;
        }

        .login-error {
          background: #2a1a1a;
          border: 1px solid #4a2a2a;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #f87171;
          margin-bottom: 18px;
        }

        .login-submit {
          width: 100%;
          background: #39ff14;
          color: #000;
          border: none;
          border-radius: 10px;
          padding: 13px;
          font-size: 15px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          margin-top: 4px;
        }

        .login-submit:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .login-submit:active {
          transform: translateY(0);
        }

        .login-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .login-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 12px;
          color: #333;
        }

        .login-footer a {
          color: #39ff14;
          text-decoration: none;
        }

        .login-footer a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="login-bg">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-name">LensTrybe</div>
            <div className="login-brand-tagline">For creatives, by creatives</div>
          </div>

          <div className="login-form-card">
            <div className="login-form-title">Welcome back</div>
            <div className="login-form-sub">Sign in to your creative dashboard</div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="login-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="login-submit" type="submit" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>
          </div>

          <div className="login-footer">
            Not a member yet? <a href="https://lenstrybe.com" target="_blank" rel="noopener noreferrer">Join LensTrybe</a>
          </div>
        </div>
      </div>
    </>
  )
}