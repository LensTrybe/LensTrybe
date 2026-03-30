import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser.js'
import { supabase } from '../lib/supabaseClient.js'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuthUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="login-page">
        <p className="login-status">Loading session...</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">LensTrybe</div>
        <h1 className="login-title">Sign in</h1>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
