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
            required
          />
        </div>
        <div>
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
