import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  moderateText,
  moderateImage,
  MODERATION_BLOCKED_USER_MESSAGE,
  PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE,
} from '../../lib/moderateContent'

const PAGE_BG = '#0a0a0f'
const GREEN = '#1DB954'
const PINK = '#FF2D78'

const SKILL_TYPES = [
  'Photographer',
  'Videographer',
  'Drone Pilot',
  'Video Editor',
  'Photo Editor',
  'Social Media Manager',
  'Hair & Makeup Artist',
  'UGC Creator',
]

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

const PLAN_OPTIONS = [
  { id: 'basic', label: 'Basic', price: 'Free' },
  { id: 'pro', label: 'Pro', price: '$24.99/mo' },
  { id: 'expert', label: 'Expert', price: '$74.99/mo' },
  { id: 'elite', label: 'Elite', price: '$149.99/mo' },
]

function firstNameFromUser(user) {
  const meta = user?.user_metadata || {}
  const full = meta.full_name || meta.name || ''
  const part = String(full).trim().split(/\s+/).filter(Boolean)[0]
  return part || 'there'
}

function displayNameFromGoogle(user) {
  const meta = user?.user_metadata || {}
  return String(meta.full_name || meta.name || '').trim()
}

function googleAvatarUrl(user) {
  const meta = user?.user_metadata || {}
  const u = meta.avatar_url || meta.picture
  return typeof u === 'string' && u.trim() ? u.trim() : ''
}

function readStoredPlanTier() {
  try {
    const raw = sessionStorage.getItem('lt_signup_plan')
    if (!raw) return 'basic'
    const id = raw.toLowerCase().trim()
    if (['basic', 'pro', 'expert', 'elite'].includes(id)) return id
  } catch {
    /* ignore */
  }
  return 'basic'
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState(null)
  const [step, setStep] = useState(0)
  const [stepEnter, setStepEnter] = useState(true)

  const [businessName, setBusinessName] = useState('')
  const [skillTypes, setSkillTypes] = useState([])
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('Australia')
  const [tier, setTier] = useState('basic')

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const bumpStep = useCallback((next) => {
    setStepEnter(false)
    window.setTimeout(() => {
      setStep(next)
      setStepEnter(true)
    }, 160)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session?.user) {
        navigate('/join', { replace: true })
        return
      }
      const u = session.user
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', u.id)
        .single()

      if (cancelled) return
      if (prof?.id) {
        navigate('/dashboard', { replace: true })
        return
      }
      if (profErr && profErr.code !== 'PGRST116') {
        console.warn('[OnboardingPage] profile lookup', profErr)
      }

      setUser(u)
      const suggestion = displayNameFromGoogle(u)
      setBusinessName(suggestion)
      const av = googleAvatarUrl(u)
      if (av) setAvatarPreview(av)
      setTier(readStoredPlanTier())
      setChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  function toggleSkill(s) {
    setSkillTypes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function onPickPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const canStep1 = businessName.trim().length > 0
  const canStep2 = skillTypes.length > 0 && city.trim().length > 0 && state.length > 0

  async function completeSetup() {
    if (!user?.id) return
    setSubmitting(true)
    setError('')

    const mod = await moderateText(businessName.trim())
    if (mod?.blocked) {
      setError(mod.reason || MODERATION_BLOCKED_USER_MESSAGE)
      setSubmitting(false)
      return
    }

    let publicUrl = null
    if (avatarFile instanceof File) {
      try {
        const imgMod = await moderateImage(avatarFile)
        if (imgMod?.blocked) {
          setError(PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE)
          setSubmitting(false)
          return
        }
        if (imgMod?.flagged) {
          console.warn('[OnboardingPage] avatar flagged (upload allowed)', imgMod?.reason ?? '')
        }
      } catch (modErr) {
        setError(modErr?.message || 'Could not verify your profile photo. Try again or skip changing the photo.')
        setSubmitting(false)
        return
      }
      const ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('portfolio').upload(path, avatarFile, { upsert: true })
      if (upErr) {
        setError(upErr.message)
        setSubmitting(false)
        return
      }
      const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(path)
      publicUrl = urlData?.publicUrl ?? null
    }

    const metaAv = googleAvatarUrl(user)
    const avatarUrl = publicUrl || metaAv || null

    const row = {
      id: user.id,
      business_name: businessName.trim(),
      skill_types: skillTypes,
      specialties: [],
      city: city.trim(),
      state,
      country: country.trim() || 'Australia',
      subscription_tier: tier || 'basic',
      account_type: 'creative',
      avatar_url: avatarUrl,
      display_name_preference: 'business_name',
      founding_member: true,
      founding_member_since: new Date().toISOString(),
    }

    const { error: insErr } = await supabase.from('profiles').insert(row)
    if (insErr) {
      setError(insErr.message)
      setSubmitting(false)
      return
    }

    try {
      sessionStorage.removeItem('lt_signup_plan')
    } catch {
      /* ignore */
    }

    try {
      await supabase.functions.invoke('send-welcome-email', {
        body: {
          record: {
            email: user.email,
            user_metadata: { full_name: businessName.trim() },
          },
        },
      })
    } catch (welcomeErr) {
      console.log('send-welcome-email failed', welcomeErr)
    }

    const t = tier || 'basic'
    if (t === 'basic') {
      navigate('/dashboard', { replace: true })
    } else {
      navigate(`/pricing?plan=${encodeURIComponent(t)}`, { replace: true })
    }
  }

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: '6px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '15px',
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: 'none',
  }

  const btnPrimary = {
    padding: '12px 22px',
    borderRadius: '10px',
    border: 'none',
    background: GREEN,
    color: '#000',
    fontWeight: 700,
    fontSize: '15px',
    fontFamily: "'Inter', system-ui, sans-serif",
    cursor: submitting ? 'wait' : 'pointer',
    opacity: submitting ? 0.75 : 1,
  }

  const btnGhost = {
    padding: '12px 22px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#fff',
    fontWeight: 600,
    fontSize: '15px',
    fontFamily: "'Inter', system-ui, sans-serif",
    cursor: 'pointer',
  }

  if (checking || !user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: PAGE_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        Loading…
      </div>
    )
  }

  const welcomeName = firstNameFromUser(user)
  const progress = ((step + 1) / 3) * 100

  return (
    <div
      className="onboarding-root"
      style={{
        minHeight: '100vh',
        background: PAGE_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px 16px 48px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .onboarding-root * { box-sizing: border-box; }
        .onboarding-root input::placeholder,
        .onboarding-root select { color: rgba(255,255,255,0.45); }
        .onboarding-root select option { background: #12121a; color: #fff; }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          padding: '32px 28px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: PINK, letterSpacing: '0.06em' }}>
              STEP {step + 1} OF 3
            </span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>LensTrybe</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${GREEN}, ${PINK})`,
                borderRadius: 999,
                transition: 'width 0.35s ease',
              }}
            />
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#fca5a5',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            opacity: stepEnter ? 1 : 0,
            transform: stepEnter ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}
        >
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
                Welcome to LensTrybe, {welcomeName}!
              </h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                Let&apos;s set up your creative profile. You can change these details later in settings.
              </p>

              <div>
                <span style={labelStyle}>Profile photo</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: `2px solid ${GREEN}`,
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%' }} />
                    )}
                  </div>
                  <button type="button" style={btnGhost} onClick={() => fileRef.current?.click()}>
                    Change photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickPhoto} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Business name (required)</label>
                <input
                  style={inputStyle}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your studio or brand name"
                  autoComplete="organization"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" style={btnPrimary} disabled={!canStep1} onClick={() => bumpStep(1)}>
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>Your creative work</h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>
                What type of creative are you? Choose at least one.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {SKILL_TYPES.map((s) => {
                  const on = skillTypes.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: on ? `2px solid ${GREEN}` : '1px solid rgba(255,255,255,0.14)',
                        background: on ? 'rgba(29,185,84,0.12)' : 'rgba(255,255,255,0.04)',
                        color: on ? '#fff' : 'rgba(255,255,255,0.85)',
                        fontSize: '13px',
                        fontWeight: on ? 600 : 500,
                        cursor: 'pointer',
                        fontFamily: "'Inter', system-ui, sans-serif",
                        textAlign: 'center',
                        lineHeight: 1.3,
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>

              <div>
                <label style={labelStyle}>City or suburb</label>
                <input
                  style={inputStyle}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Brisbane"
                  autoComplete="address-level2"
                />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer', color: state ? '#fff' : 'rgba(255,255,255,0.45)' }}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">Select state</option>
                  {AU_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <input
                  style={inputStyle}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Australia"
                  autoComplete="country-name"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
                <button type="button" style={btnGhost} onClick={() => bumpStep(0)}>
                  Back
                </button>
                <button type="button" style={btnPrimary} disabled={!canStep2} onClick={() => bumpStep(2)}>
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>Choose your plan</h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>
                Pick the tier that fits you. You can change this later in subscription settings.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {PLAN_OPTIONS.map((p) => {
                  const selected = tier === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTier(p.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: selected ? `2px solid ${GREEN}` : '1px solid rgba(255,255,255,0.14)',
                        background: selected ? 'rgba(29,185,84,0.1)' : 'rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>{p.label}</span>
                      <span style={{ color: PINK, fontWeight: 600, fontSize: '14px' }}>{p.price}</span>
                    </button>
                  )
                })}
              </div>
              {tier !== 'basic' ? (
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                  You&apos;ll be redirected to complete payment after setup.
                </p>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
                <button type="button" style={btnGhost} disabled={submitting} onClick={() => bumpStep(1)}>
                  Back
                </button>
                <button type="button" style={btnPrimary} disabled={submitting} onClick={() => void completeSetup()}>
                  {submitting ? 'Saving…' : 'Complete setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
