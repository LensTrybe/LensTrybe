import React, { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PublicNavbar from '../components/public/PublicNavbar.jsx'
import { supabase } from '../lib/supabaseClient.js'

const PINK = '#D946EF'

function passwordStrength(password) {
  const p = String(password || '')
  if (p.length < 6) return { score: 0, label: 'Too short', width: '8%', color: '#f87171' }
  let s = 0
  if (p.length >= 8) s += 1
  if (p.length >= 12) s += 1
  if (/[0-9]/.test(p)) s += 1
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s += 1
  if (/[^a-zA-Z0-9]/.test(p)) s += 1
  const capped = Math.min(s, 4)
  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very strong']
  const colors = ['#f87171', '#fbbf24', '#a78bfa', '#4ADE80', '#4ADE80']
  const widths = ['25%', '40%', '55%', '75%', '100%']
  return { score: capped, label: labels[capped], width: widths[capped], color: colors[capped] }
}

export default function ClientSignupPage() {
  const navigate = useNavigate()
  const BRAND = useMemo(
    () => ({
      bg: '#080810',
      pink: PINK,
      card: '#0f0f18',
      border: '#1a1a2e',
      muted: '#888',
    }),
    [],
  )

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = useMemo(() => passwordStrength(password), [password])

  const inputStyle = {
    background: '#13131a',
    border: `1px solid ${BRAND.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
  }

  const labelStyle = {
    color: BRAND.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: 800,
    letterSpacing: '0.06em',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setLoading(true)
    try {
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            account_kind: 'client',
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            company_name: companyName.trim() || '',
          },
        },
      })
      if (signErr) {
        setError(signErr.message)
        setLoading(false)
        return
      }

      const uid = data?.user?.id
      if (uid && data?.session) {
        const { error: rowErr } = await supabase.from('client_accounts').upsert(
          {
            id: uid,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            company_name: companyName.trim() || null,
            account_type: 'client',
          },
          { onConflict: 'id' },
        )
        if (rowErr) {
          setError(rowErr.message)
          setLoading(false)
          return
        }
      }

      navigate('/find-a-creative?welcome=1')
    } catch (err) {
      setError(err?.message ? String(err.message) : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: BRAND.bg, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <PublicNavbar />
      <div
        style={{
          paddingTop: 96,
          paddingBottom: 48,
          display: 'flex',
          justifyContent: 'center',
          boxSizing: 'border-box',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            background: BRAND.card,
            border: `1px solid ${BRAND.border}`,
            borderRadius: 16,
            padding: 40,
            width: 460,
            maxWidth: '92vw',
            boxSizing: 'border-box',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Create a client account</div>
          <div style={{ color: BRAND.muted, fontSize: 14, marginBottom: 28 }}>
            Find creatives, post jobs, and send enquiries — free to join.
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>First name *</label>
                <div style={{ height: 8 }} />
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Last name *</label>
                <div style={{ height: 8 }} />
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} required />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email *</label>
              <div style={{ height: 8 }} />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={inputStyle}
                required
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Company or business name</label>
              <div style={{ height: 8 }} />
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Password *</label>
              <div style={{ height: 8 }} />
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 44 }}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: '#1f1f2a',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: strength.width,
                      background: strength.color,
                      transition: 'width 0.2s ease, background 0.2s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 6, fontWeight: 600 }}>
                  Password strength: <span style={{ color: strength.color }}>{strength.label}</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Confirm password *</label>
              <div style={{ height: 8 }} />
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 44 }}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    display: 'flex',
                  }}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: 'pointer',
                marginBottom: 20,
                fontSize: 13,
                color: '#ccc',
                lineHeight: 1.45,
              }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" style={{ color: PINK, fontWeight: 700 }}>
                  Terms &amp; Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" style={{ color: PINK, fontWeight: 700 }}>
                  Privacy Policy
                </Link>{' '}
                *
              </span>
            </label>

            {error ? (
              <div
                style={{
                  background: '#2a1a1a',
                  border: '1px solid #f87171',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#f87171',
                  fontSize: 13,
                  marginBottom: 16,
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: PINK,
                color: '#fff',
                fontWeight: 800,
                borderRadius: 10,
                padding: 14,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                fontSize: 15,
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: BRAND.muted }}>
            Are you a creative?{' '}
            <Link to="/join" style={{ color: PINK, fontWeight: 700, textDecoration: 'none' }}>
              Join as a Creative
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
