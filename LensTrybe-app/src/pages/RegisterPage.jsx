import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const params = useMemo(() => new URLSearchParams(location.search || ''), [location.search])
  const emailFromUrl = params.get('email') || ''

  const [businessName, setBusinessName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(emailFromUrl)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl)
  }, [emailFromUrl])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!password) {
      setError('Password is required.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          business_name: businessName.trim() || null,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  const PAGE = {
    bg: '#0a0a0f',
    text: 'rgb(242, 242, 242)',
    card: '#13131a',
    border: '#1e1e1e',
    inner: '#1a1a24',
    innerBorder: '#202027',
    muted: '#888',
    dim: '#555',
    green: '#39ff14',
    red: '#f87171',
  }

  const font = { fontFamily: 'Inter, sans-serif' }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    color: PAGE.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 600,
    marginBottom: 8,
    ...font,
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: PAGE.inner,
    border: `1px solid ${PAGE.innerBorder}`,
    borderRadius: 10,
    padding: '12px 14px',
    color: '#e8e8e8',
    fontSize: 14,
    outline: 'none',
    ...font,
  }

  return (
    <div style={{ background: PAGE.bg, minHeight: '100vh', padding: 32, color: PAGE.text, ...font, boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Link to="/login" style={{ color: PAGE.green, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
          ← Back to login
        </Link>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: PAGE.green }}>LensTrybe</div>
          <div style={{ fontSize: 13, color: PAGE.dim, marginTop: 6 }}>Create your account</div>
        </div>

        <div style={{ marginTop: 18, background: PAGE.card, border: `1px solid ${PAGE.border}`, borderRadius: 14, padding: 28 }}>
          {error ? (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)', color: PAGE.red, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={labelStyle} htmlFor="business_name">Business Name</label>
              <input id="business_name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="first_name">First Name</label>
                <input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="last_name">Last Name</label>
                <input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
            </div>

            <div>
              <label style={labelStyle} htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required />
            </div>

            <div>
              <label style={labelStyle} htmlFor="confirm_password">Confirm Password</label>
              <input id="confirm_password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} required />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                background: PAGE.green,
                color: '#000',
                border: 'none',
                borderRadius: 10,
                padding: '14px 16px',
                fontSize: 15,
                fontWeight: 800,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                marginTop: 4,
                ...font,
              }}
            >
              {submitting ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

