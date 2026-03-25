<<<<<<< HEAD
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [signupMessage, setSignupMessage] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true })
    })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSignupMessage(null)

    if (mode === 'login') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message)
        return
      }
      navigate('/dashboard', { replace: true })
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    setSignupMessage('Check your email to confirm your account before signing in.')
  }

  return (
    <div>
      <h1>{mode === 'login' ? 'Sign in' : 'Sign up'}</h1>

      {signupMessage && <p role="status">{signupMessage}</p>}
      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
=======
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

function LoginPage() {
  const { user, loading } = useAuthUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <p>Loading session...</p>
  }

  if (user) {
    return <Navigate replace to="/dashboard" />
  }

  const handleSignIn = async (event) => {
    event.preventDefault()

    if (!supabase) {
      setErrorMessage('Supabase is not configured.')
      return
    }

    setSubmitting(true)
    setMessage('')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMessage('Signed in successfully.')
    }

    setSubmitting(false)
  }

  return (
    <section>
      <h1>LensTrybe Login</h1>
      <form onSubmit={handleSignIn}>
        <div>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
>>>>>>> origin/cursor/lenstrybe-app-initial-setup-6f7d
            required
          />
        </div>
        <div>
<<<<<<< HEAD
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">{mode === 'login' ? 'Sign in' : 'Sign up'}</button>
      </form>

      <p>
        {mode === 'login' ? (
          <>
            Need an account?{' '}
            <button type="button" onClick={() => setMode('signup')}>
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button type="button" onClick={() => setMode('login')}>
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  )
}
=======
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}
    </section>
  )
}

export default LoginPage
>>>>>>> origin/cursor/lenstrybe-app-initial-setup-6f7d
