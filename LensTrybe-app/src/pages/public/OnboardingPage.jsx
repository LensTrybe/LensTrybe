import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  moderateText,
  moderateImage,
  MODERATION_BLOCKED_USER_MESSAGE,
  PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE,
} from '../../lib/moderateContent'
import { LIQUID_GLASS, LIQUID_FIELD } from '../../lib/glassTokensLight'
import { LiquidLensFilter, LiquidPill, LiquidSelect } from '../../components/ui/liquidGlass'
import TileField from '../../components/ui/TileField'
import { CREATIVE_TYPES } from '../../lib/creativeTypes'
import useIsMobile from '../../hooks/useIsMobile'
import { resizeImage } from '../../lib/resizeImage'

const PAGE_BG = '#ffffff'
const GREEN = '#1DB954'
const PINK = '#FF2D78'

// Launch scope (Photographer, Videographer) from the shared source of truth.
const SKILL_TYPES = CREATIVE_TYPES

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

const PLAN_OPTIONS = [
  { id: 'basic', label: 'Basic', price: 'Free' },
  { id: 'pro', label: 'Pro', price: '$24.99/mo' },
  { id: 'expert', label: 'Expert', price: '$74.99/mo' },
  { id: 'elite', label: 'Elite', price: '$149.99/mo' },
]

const TAGLINE_MAX = 80

// Two ways in:
//   create   Google sign in, no profile row yet. The wizard builds it, then asks for a plan.
//   complete Email and password signup. handle_new_user already built the profile and, for a
//            founding code, already set Expert and the founding badge. The wizard only fills
//            the gaps, and must never touch tier, founding status or the welcome email.
const MODE_CREATE = 'create'
const MODE_COMPLETE = 'complete'

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
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState(MODE_CREATE)
  const [step, setStep] = useState(0)
  const [stepEnter, setStepEnter] = useState(true)

  const [businessName, setBusinessName] = useState('')
  const [tagline, setTagline] = useState('')
  const [skillTypes, setSkillTypes] = useState([])
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('Australia')
  const [selectedTier, setSelectedTier] = useState('basic')

  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // create asks for a plan at the end, complete does not: their tier is already set.
  const totalSteps = mode === MODE_CREATE ? 3 : 2
  const lastStep = totalSteps - 1

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
        .select('id, business_name, tagline, skill_types, city, state, country, avatar_url, onboarded_at')
        .eq('id', u.id)
        .maybeSingle()

      if (cancelled) return
      if (profErr && profErr.code !== 'PGRST116') {
        console.warn('[OnboardingPage] profile lookup', profErr)
      }

      // Already been through it. Nothing to do here.
      if (prof?.onboarded_at) {
        navigate('/dashboard', { replace: true })
        return
      }

      if (prof?.id) {
        // The trigger already built this profile, so keep whatever it put there and
        // only ask for what is still missing.
        setMode(MODE_COMPLETE)
        setBusinessName(prof.business_name || '')
        setTagline(prof.tagline || '')
        setSkillTypes(Array.isArray(prof.skill_types) ? prof.skill_types : [])
        setCity(prof.city || '')
        setState(prof.state || '')
        setCountry(prof.country || 'Australia')
        if (prof.avatar_url) setAvatarPreview(prof.avatar_url)
      } else {
        setMode(MODE_CREATE)
        setBusinessName(displayNameFromGoogle(u))
        const av = googleAvatarUrl(u)
        if (av) setAvatarPreview(av)
        setSelectedTier(readStoredPlanTier())
      }

      setUser(u)
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

  const canStep1 = businessName.trim().length > 0 && tagline.trim().length > 0
  const canStep2 = skillTypes.length > 0 && city.trim().length > 0 && state.length > 0

  // Nobody gets locked out of their own dashboard by a setup screen. Skipping marks them
  // onboarded so the redirect stops, and the dashboard banner takes over from there.
  async function skipForNow() {
    if (!user?.id || mode !== MODE_COMPLETE) return
    setSubmitting(true)
    setError('')
    const { error: skipErr } = await supabase
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', user.id)
    if (skipErr) {
      setError(skipErr.message)
      setSubmitting(false)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  async function uploadAvatar() {
    if (!(avatarFile instanceof File)) return { url: null, ok: true }
    try {
      const imgMod = await moderateImage(avatarFile)
      if (imgMod?.blocked) {
        setError(PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE)
        return { url: null, ok: false }
      }
      if (imgMod?.flagged) {
        console.warn('[OnboardingPage] avatar flagged (upload allowed)', imgMod?.reason ?? '')
      }
    } catch (modErr) {
      setError(modErr?.message || 'Could not verify your profile photo. Try again or skip changing the photo.')
      return { url: null, ok: false }
    }
    const ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('portfolio').upload(path, await resizeImage(avatarFile), { upsert: true })
    if (upErr) {
      setError(upErr.message)
      return { url: null, ok: false }
    }
    const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(path)
    return { url: urlData?.publicUrl ?? null, ok: true }
  }

  async function completeSetup() {
    if (!user?.id) return
    setSubmitting(true)
    setError('')

    const nameMod = await moderateText(businessName.trim())
    if (nameMod?.blocked) {
      setError(nameMod.reason || MODERATION_BLOCKED_USER_MESSAGE)
      setSubmitting(false)
      return
    }
    const tagMod = await moderateText(tagline.trim())
    if (tagMod?.blocked) {
      setError(tagMod.reason || MODERATION_BLOCKED_USER_MESSAGE)
      setSubmitting(false)
      return
    }

    const { url: publicUrl, ok } = await uploadAvatar()
    if (!ok) {
      setSubmitting(false)
      return
    }

    const now = new Date().toISOString()

    if (mode === MODE_COMPLETE) {
      // Only the fields the wizard actually asked for. No tier, no account_type, no
      // founding columns: those belong to the trigger and the billing webhooks, and the
      // a_guard_profile_privileged trigger would refuse them from here anyway.
      const patch = {
        business_name: businessName.trim(),
        tagline: tagline.trim(),
        skill_types: skillTypes,
        city: city.trim(),
        state,
        country: country.trim() || 'Australia',
        onboarded_at: now,
      }
      // Never blank an existing photo just because they did not pick a new one.
      if (publicUrl) patch.avatar_url = publicUrl

      const { error: updErr } = await supabase.from('profiles').update(patch).eq('id', user.id)
      if (updErr) {
        setError(updErr.message)
        setSubmitting(false)
        return
      }
      navigate('/dashboard', { replace: true })
      return
    }

    const metaAv = googleAvatarUrl(user)
    const avatarUrl = publicUrl || metaAv || null

    const row = {
      id: user.id,
      business_name: businessName.trim(),
      tagline: tagline.trim(),
      skill_types: skillTypes,
      specialties: [],
      city: city.trim(),
      state,
      country: country.trim() || 'Australia',
      // Everyone starts on Basic. A paid plan is granted by the server once payment
      // is set up (revolut-webhook), and the founding badge only via a founding code.
      // The database enforces this too, so the browser can't grant itself a tier.
      subscription_tier: 'basic',
      account_type: 'creative',
      avatar_url: avatarUrl,
      display_name_preference: 'business_name',
      onboarded_at: now,
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

    // Only on the create path. An email signup was already welcomed when they confirmed.
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

    const t = selectedTier || 'basic'
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
    color: 'rgba(20,17,26,0.72)',
    marginBottom: '6px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }

  const inputStyle = {
    ...LIQUID_FIELD,
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '15px',
  }

  const hintStyle = {
    margin: '6px 0 0',
    fontSize: '12px',
    color: 'rgba(20,17,26,0.55)',
    lineHeight: 1.45,
  }

  if (checking || !user) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: PAGE_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(20,17,26,0.5)',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        Loading…
      </div>
    )
  }

  const welcomeName = firstNameFromUser(user)
  const progress = ((step + 1) / totalSteps) * 100

  // Shown on the last step, so the reason for every field above it is clear before they finish.
  const listingNote = (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid rgba(29,185,84,0.4)',
        background: 'rgba(29,185,84,0.08)',
        fontSize: '13px',
        lineHeight: 1.5,
        color: 'rgba(20,17,26,0.8)',
      }}
    >
      <strong style={{ color: '#0f7a37' }}>This is what gets you found.</strong> A photo, a tagline
      and at least one creative type is all it takes to appear in Find a Creative. Finish here and
      you are listed straight away.
    </div>
  )

  return (
    <div
      className="onboarding-root"
      style={{
        minHeight: '100dvh',
        background: 'transparent',
        position: 'relative',
        overflow: 'hidden',
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
        .onboarding-root select { color: rgba(20,17,26,0.6); color-scheme: light; }
        .onboarding-root select option { background: #ffffff; color: #14111a; }
      `}</style>
      <LiquidLensFilter />
      <TileField animated={false} opacity={0.22} minColumns={isMobile ? 2 : 6} />

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          padding: '32px 28px',
          ...LIQUID_GLASS,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: PINK, letterSpacing: '0.06em' }}>
              STEP {step + 1} OF {totalSteps}
            </span>
            <span style={{ fontSize: '12px', color: 'rgba(20,17,26,0.5)' }}>LensTrybe</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: 'rgba(20,17,26,0.1)',
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
              color: '#b91c1c',
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
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                Welcome to LensTrybe, {welcomeName}!
              </h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(20,17,26,0.65)', lineHeight: 1.5 }}>
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
                      background: 'rgba(20,17,26,0.06)',
                    }}
                  >
                    {avatarPreview ? (
                      <img loading="lazy" decoding="async" src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%' }} />
                    )}
                  </div>
                  <LiquidPill type="button" style={{ flex: '0 0 auto', padding: '11px 20px', fontSize: '14px' }} onClick={() => fileRef.current?.click()}>
                    {avatarPreview ? 'Change photo' : 'Add a photo'}
                  </LiquidPill>
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

              <div>
                <label style={labelStyle}>Tagline (required)</label>
                <input
                  style={inputStyle}
                  value={tagline}
                  maxLength={TAGLINE_MAX}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Brisbane wedding photographer"
                />
                <p style={hintStyle}>
                  One line that says what you do and where. It is the first thing a client reads on
                  your card in search. {TAGLINE_MAX - tagline.length} characters left.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <LiquidPill primary type="button" disabled={!canStep1} style={{ flex: '0 0 auto', padding: '12px 24px', fontSize: '15px', opacity: !canStep1 ? 0.6 : 1 }} onClick={() => bumpStep(1)}>
                  Next
                </LiquidPill>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Your creative work</h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(20,17,26,0.65)' }}>
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
                        border: on ? `2px solid ${GREEN}` : '1px solid rgba(20,17,26,0.14)',
                        background: on ? 'rgba(29,185,84,0.12)' : 'rgba(20,17,26,0.04)',
                        color: on ? '#0f7a37' : 'rgba(20,17,26,0.85)',
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
                <LiquidSelect value={state} onChange={setState} ariaLabel="State" placeholder="Select state" style={{ flex: '1 1 100%' }} options={[{ value: '', label: 'Select state' }, ...AU_STATES.map((s) => ({ value: s, label: s }))]} />
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

              {mode === MODE_COMPLETE ? listingNote : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
                <LiquidPill type="button" disabled={submitting} style={{ flex: '0 0 auto', padding: '12px 22px', fontSize: '15px' }} onClick={() => bumpStep(0)}>
                  Back
                </LiquidPill>
                {mode === MODE_CREATE ? (
                  <LiquidPill primary type="button" disabled={!canStep2} style={{ flex: '0 0 auto', padding: '12px 24px', fontSize: '15px', opacity: !canStep2 ? 0.6 : 1 }} onClick={() => bumpStep(2)}>
                    Next
                  </LiquidPill>
                ) : (
                  <LiquidPill primary type="button" disabled={submitting || !canStep2} style={{ flex: '0 0 auto', padding: '12px 24px', fontSize: '15px', opacity: submitting || !canStep2 ? 0.6 : 1 }} onClick={() => void completeSetup()}>
                    {submitting ? 'Saving…' : 'Finish setup'}
                  </LiquidPill>
                )}
              </div>
            </div>
          )}

          {step === 2 && mode === MODE_CREATE && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Choose your plan</h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(20,17,26,0.65)' }}>
                Pick the tier that fits you. You can change this later in subscription settings.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {PLAN_OPTIONS.map((p) => {
                  const isBasic = p.id === 'basic'
                  const paidSelected = selectedTier === p.id
                  let cardBorder
                  let cardBackground
                  if (!isBasic) {
                    cardBorder = paidSelected ? `2px solid ${GREEN}` : '1px solid rgba(20,17,26,0.14)'
                    cardBackground = paidSelected ? 'rgba(29,185,84,0.1)' : 'rgba(20,17,26,0.04)'
                  }
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedTier(p.id)}
                      style={
                        isBasic
                          ? {
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              textAlign: 'left',
                              padding: '16px',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              border: selectedTier === 'basic' ? '2px solid #4A9EFF' : '1px solid rgba(20,17,26,0.08)',
                              background: selectedTier === 'basic' ? 'rgba(74,158,255,0.08)' : 'rgba(20,17,26,0.03)',
                              boxShadow:
                                selectedTier === 'basic' ? '0 0 0 2px #4A9EFF, 0 0 20px rgba(74,158,255,0.4)' : 'none',
                              transition: 'all 0.2s ease',
                            }
                          : {
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '14px 16px',
                              borderRadius: 12,
                              border: cardBorder,
                              background: cardBackground,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }
                      }
                    >
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>{p.label}</span>
                      <span style={{ color: PINK, fontWeight: 600, fontSize: '14px' }}>{p.price}</span>
                    </button>
                  )
                })}
              </div>
              {selectedTier !== 'basic' ? (
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(20,17,26,0.55)' }}>
                  You&apos;ll be redirected to complete payment after setup.
                </p>
              ) : null}

              {listingNote}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
                <LiquidPill type="button" disabled={submitting} style={{ flex: '0 0 auto', padding: '12px 22px', fontSize: '15px' }} onClick={() => bumpStep(1)}>
                  Back
                </LiquidPill>
                <LiquidPill primary type="button" disabled={submitting} style={{ flex: '0 0 auto', padding: '12px 24px', fontSize: '15px', opacity: submitting ? 0.6 : 1 }} onClick={() => void completeSetup()}>
                  {submitting ? 'Saving…' : 'Complete setup'}
                </LiquidPill>
              </div>
            </div>
          )}
        </div>

        {mode === MODE_COMPLETE && step === lastStep ? (
          <div style={{ marginTop: '18px', textAlign: 'center' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void skipForNow()}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 4px',
                color: 'rgba(20,17,26,0.55)',
                fontSize: '13px',
                fontFamily: "'Inter', system-ui, sans-serif",
                textDecoration: 'underline',
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              I&apos;ll finish this later
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
