import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

const STEPS = ['Plan', 'Account', 'Skills', 'Specialties', 'Location', 'Credentials', 'Photo', 'Review']

const TIERS = [
  { id: 'basic', name: 'Basic', price: 0, description: 'Get discovered for free', color: 'var(--border-default)' },
  { id: 'pro', name: 'Pro', price: 24.99, description: 'Start booking clients', color: 'var(--green)' },
  { id: 'expert', name: 'Expert', price: 74.99, description: 'Full business tools', color: 'var(--silver)' },
  { id: 'elite', name: 'Elite', price: 149.99, description: 'Studio-level power', color: '#EAB308' },
]

const SKILL_TYPES = [
  'Photographer', 'Videographer', 'Drone Pilot', 'Video Editor',
  'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator'
]

const SPECIALTIES = {
  'Photographer': ['Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion', 'Product', 'Sports', 'Street', 'Architecture'],
  'Videographer': ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport'],
  'Drone Pilot': ['Real Estate', 'Cinematic', 'Surveying', 'Events', 'Agriculture', 'Construction', 'Infrastructure'],
  'Video Editor': ['Colour Grading', 'Short-form/Reels', 'Wedding Films', 'VFX', 'Motion Graphics', 'Corporate', 'Music Video'],
  'Photo Editor': ['Retouching', 'Culling', 'Compositing', 'Product Editing', 'Restoration', 'Fashion'],
  'Social Media Manager': ['Instagram & TikTok', 'Reels & Short-form', 'Brand Content', 'Content Strategy', 'YouTube Management', 'LinkedIn', 'Facebook & Meta'],
  'Hair & Makeup Artist': ['Bridal & Wedding', 'Editorial & Fashion', 'Commercial', 'Film & TV', 'Portrait & Headshots', 'Special Effects', 'Hair Styling', 'Airbrush', 'Natural & Lifestyle', 'Events'],
  'UGC Creator': ['E-commerce & Product', 'App & Software', 'Food & Beverage', 'Beauty & Skincare', 'Health & Fitness', 'Travel & Lifestyle', 'Fashion & Apparel', 'Home & Interiors', 'Unboxing & Reviews', 'Paid Ad Creative'],
}

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

/** Maximum skill types per subscription tier (Elite: no limit). */
const SKILL_TYPE_LIMIT_BY_TIER = {
  basic: 1,
  pro: 2,
  expert: 4,
  elite: Infinity,
}

function maxSkillTypesForTier(tierId) {
  const n = SKILL_TYPE_LIMIT_BY_TIER[tierId]
  return n === undefined ? Infinity : n
}

function skillTypeLimitHint(tierId) {
  const tierName = TIERS.find((t) => t.id === tierId)?.name ?? 'Your'
  if (tierId === 'elite') {
    return 'Your Elite plan includes unlimited skill types.'
  }
  const max = maxSkillTypesForTier(tierId)
  if (tierId === 'basic') {
    return `Your ${tierName} plan includes up to ${max} skill type. Upgrade to Pro, Expert or Elite to add more.`
  }
  if (tierId === 'pro') {
    return `Your ${tierName} plan includes up to ${max} skill types. Upgrade to Expert or Elite to add more.`
  }
  if (tierId === 'expert') {
    return `Your ${tierName} plan includes up to ${max} skill types. Upgrade to Elite to add more.`
  }
  return `Your plan includes up to ${max} skill types.`
}

export default function SignupPage() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [form, setForm] = useState({
    tier: 'pro',
    email: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    firstName: '',
    lastName: '',
    displayNamePreference: 'business_only',
    legalName: '',
    skillTypes: [],
    specialties: [],
    city: '',
    state: '',
    country: 'Australia',
    bio: '',
    avatarFile: null,
    avatarPreview: null,
  })

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /** If the user changes plan, trim skill types so they never exceed the new tier limit. */
  useEffect(() => {
    const max = maxSkillTypesForTier(form.tier)
    if (!Number.isFinite(max)) return
    setForm((prev) => {
      if (prev.skillTypes.length <= max) return prev
      return { ...prev, skillTypes: prev.skillTypes.slice(0, max) }
    })
  }, [form.tier])

  function toggleSkillType(skill) {
    setForm((prev) => {
      const has = prev.skillTypes.includes(skill)
      if (has) {
        return { ...prev, skillTypes: prev.skillTypes.filter((s) => s !== skill) }
      }
      const max = maxSkillTypesForTier(prev.tier)
      if (Number.isFinite(max) && prev.skillTypes.length >= max) {
        return prev
      }
      return { ...prev, skillTypes: [...prev.skillTypes, skill] }
    })
  }

  function toggleArray(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }))
  }

  function canProceed() {
    if (step === 1) return form.email && form.password && form.password === form.confirmPassword && form.businessName && form.firstName && form.lastName
    if (step === 2) return form.skillTypes.length > 0
    if (step === 3) return form.specialties.length > 0
    if (step === 4) return form.city && form.state
    return true
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (authError) throw authError

      const userId = authData.user.id

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        business_name: form.businessName,
        full_name: `${form.firstName} ${form.lastName}`,
        first_name: form.firstName,
        last_name: form.lastName,
        display_name_preference: form.displayNamePreference,
        legal_name: form.legalName,
        skill_types: form.skillTypes,
        specialties: form.specialties,
        city: form.city,
        state: form.state,
        country: form.country,
        bio: form.bio,
        subscription_tier: form.tier,
      })
      if (profileError) throw profileError

      if (form.tier !== 'basic') {
        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout-session', {
          body: { tier: form.tier, userId }
        })
        if (checkoutError) throw checkoutError
        if (checkoutData?.url) {
          window.location.href = checkoutData.url
          return
        }
      }

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: isMobile ? '24px 16px 48px' : '48px 24px 80px',
    },
    container: { width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '40px' },
    header: { display: 'flex', flexDirection: 'column', gap: '8px' },
    logo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '8px' },
    title: { fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    progress: { display: 'flex', gap: '6px' },
    progressDot: (active, done) => ({
      height: '3px',
      flex: 1,
      borderRadius: 'var(--radius-full)',
      background: done ? 'var(--green)' : active ? 'var(--green)' : 'var(--border-default)',
      opacity: done ? 1 : active ? 1 : 0.4,
      transition: 'all var(--transition-base)',
    }),
    stepLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase' },
    content: { display: 'flex', flexDirection: 'column', gap: '20px' },
    tierGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' },
    tierCard: (selected, color) => ({
      padding: '20px',
      borderRadius: 'var(--radius-xl)',
      border: `1px solid ${selected ? color : 'var(--border-default)'}`,
      background: selected ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }),
    tierName: { fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    tierPrice: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    tierDesc: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    skillGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' },
    skillChip: (selected, disabled) => ({
      padding: '10px 16px',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${
        disabled
          ? 'var(--border-default)'
          : selected
            ? 'var(--green)'
            : 'var(--border-default)'
      }`,
      background: disabled ? 'var(--bg-base)' : selected ? 'var(--green-dim)' : 'var(--bg-elevated)',
      color: disabled ? 'var(--text-muted)' : selected ? 'var(--green)' : 'var(--text-secondary)',
      fontSize: '13px',
      fontWeight: selected ? 500 : 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      transition: 'all var(--transition-base)',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
    }),
    skillLimitHint: {
      fontSize: '13px',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)',
      lineHeight: 1.55,
      margin: 0,
      marginTop: '4px',
    },
    specialtyWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    specialtyChip: (selected) => ({
      padding: '6px 14px',
      borderRadius: 'var(--radius-full)',
      border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`,
      background: selected ? 'var(--green-dim)' : 'transparent',
      color: selected ? 'var(--green)' : 'var(--text-secondary)',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      fontFamily: 'var(--font-ui)',
    }),
    row: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' },
    sectionTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', marginBottom: '-8px' },
    avatarUpload: {
      border: '2px dashed var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      padding: '40px',
      textAlign: 'center',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      transition: 'border-color var(--transition-base)',
    },
    avatarPreview: { width: '80px', height: '80px', borderRadius: 'var(--radius-full)', objectFit: 'cover' },
    errorBox: {
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 'var(--radius-lg)',
      padding: '12px 16px',
      fontSize: '13px',
      color: 'var(--error)',
      fontFamily: 'var(--font-ui)',
    },
    actions: { display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' },
    footerNote: { fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-ui)' },
    passwordToggleBtn: {
      border: 'none',
      background: 'transparent',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      fontFamily: 'var(--font-ui)',
      fontSize: '12px',
      fontWeight: 500,
      padding: '2px 0',
      minHeight: '32px',
      lineHeight: 1,
    },
  }

  const availableSpecialties = form.skillTypes.flatMap(s => SPECIALTIES[s] ?? [])
  const uniqueSpecialties = [...new Set(availableSpecialties)]

  const stepTitles = [
    { title: 'Choose your plan', sub: 'You can upgrade or downgrade anytime.' },
    { title: 'Create your account', sub: 'Your business details and login credentials.' },
    { title: 'Your creative skills', sub: 'Select all categories that apply to you.' },
    { title: 'Your specialties', sub: 'Choose your areas of focus.' },
    { title: 'Your location', sub: 'Clients search by location — be discoverable.' },
    { title: 'Credentials', sub: 'Optional — add trust badges to your profile.' },
    { title: 'Profile photo', sub: 'Put a face to your business.' },
    { title: 'You\'re almost there', sub: 'Review your details before creating your account.' },
  ]

  return (
    <div style={styles.page} className="signup-page">
      <style>{`
        @media (max-width: 767px) {
          .signup-page button { min-height: 44px; }
          .signup-page button.password-field-toggle { min-height: 32px; }
          .signup-page input, .signup-page textarea, .signup-page select { width: 100% !important; font-size: 14px !important; }
          .signup-page [style*="height: 3px"] { min-height: 3px; }
          .signup-page [style*="justify-content: space-between"] > button { width: 100%; }
        }
      `}</style>
      <div style={styles.container}>

        <div style={styles.header}>
          <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
          <div style={styles.stepLabel}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
          <h1 style={styles.title}>{stepTitles[step].title}</h1>
          <p style={styles.subtitle}>{stepTitles[step].sub}</p>
        </div>

        <div style={styles.progress}>
          {STEPS.map((_, i) => (
            <div key={i} style={styles.progressDot(i === step, i < step)} />
          ))}
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.content}>

          {/* Step 0 — Plan */}
          {step === 0 && (
            <div style={styles.tierGrid}>
              {TIERS.map(tier => (
                <div key={tier.id} style={styles.tierCard(form.tier === tier.id, tier.color)} onClick={() => update('tier', tier.id)}>
                  <div style={styles.tierName}>{tier.name}</div>
                  <div style={styles.tierPrice}>{tier.price === 0 ? 'Free' : `$${tier.price}/mo`}</div>
                  <div style={styles.tierDesc}>{tier.description}</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 1 — Account */}
          {step === 1 && (
            <>
              <Input label="Business name" placeholder="Golden Hour Studio" value={form.businessName} onChange={e => update('businessName', e.target.value)} />
              <div style={styles.row}>
                <Input label="First name" placeholder="Sarah" value={form.firstName} onChange={e => update('firstName', e.target.value)} />
                <Input label="Last name" placeholder="Mitchell" value={form.lastName} onChange={e => update('lastName', e.target.value)} />
              </div>
              <Input label="Email address" type="email" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                suffix={(
                  <button
                    type="button"
                    className="password-field-toggle"
                    onClick={(e) => { e.preventDefault(); setShowPassword((v) => !v) }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={styles.passwordToggleBtn}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                )}
              />
              <Input
                label="Confirm password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={e => update('confirmPassword', e.target.value)}
                error={form.confirmPassword && form.password !== form.confirmPassword ? 'Passwords do not match' : ''}
                suffix={(
                  <button
                    type="button"
                    className="password-field-toggle"
                    onClick={(e) => { e.preventDefault(); setShowConfirmPassword((v) => !v) }}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    style={styles.passwordToggleBtn}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                )}
              />
            </>
          )}

          {/* Step 2 — Skills */}
          {step === 2 && (() => {
            const maxSkills = maxSkillTypesForTier(form.tier)
            const unlimited = !Number.isFinite(maxSkills)
            const atSkillLimit = !unlimited && form.skillTypes.length >= maxSkills
            return (
              <>
                <div style={styles.skillGrid}>
                  {SKILL_TYPES.map((skill) => {
                    const selected = form.skillTypes.includes(skill)
                    const disabled = atSkillLimit && !selected
                    return (
                      <div
                        key={skill}
                        style={styles.skillChip(selected, disabled)}
                        onClick={() => {
                          if (disabled) return
                          toggleSkillType(skill)
                        }}
                      >
                        {skill}
                      </div>
                    )
                  })}
                </div>
                <p style={styles.skillLimitHint}>{skillTypeLimitHint(form.tier)}</p>
              </>
            )
          })()}

          {/* Step 3 — Specialties */}
          {step === 3 && (
            <div style={styles.specialtyWrap}>
              {uniqueSpecialties.map(spec => (
                <div key={spec} style={styles.specialtyChip(form.specialties.includes(spec))} onClick={() => toggleArray('specialties', spec)}>
                  {spec}
                </div>
              ))}
            </div>
          )}

          {/* Step 4 — Location */}
          {step === 4 && (
            <>
              <Input label="City or suburb" placeholder="Brisbane" value={form.city} onChange={e => update('city', e.target.value)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>State</label>
                <select value={form.state} onChange={e => update('state', e.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', color: form.state ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Select state</option>
                  {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Step 5 — Credentials (optional) */}
          {step === 5 && (
            <>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
                Credentials are optional. They appear as trust badges on your public profile. Documents are private — clients only see the badge, not the file.
              </div>
              <Input label="ABN or ACN (optional)" placeholder="12 345 678 901" value={form.abn ?? ''} onChange={e => update('abn', e.target.value)} />
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                You can upload insurance certificates, Blue Cards, police checks and other credentials from your dashboard after signing up.
              </div>
            </>
          )}

          {/* Step 6 — Photo */}
          {step === 6 && (
            <>
              <div style={styles.avatarUpload} onClick={() => document.getElementById('avatar-upload').click()}>
                {form.avatarPreview
                  ? <img src={form.avatarPreview} alt="Preview" style={styles.avatarPreview} />
                  : <div style={{ fontSize: '32px' }}>📷</div>
                }
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                  {form.avatarPreview ? 'Click to change photo' : 'Click to upload profile photo'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>JPG or PNG, max 5MB</div>
              </div>
              <input id="avatar-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files[0]
                if (file) {
                  update('avatarFile', file)
                  update('avatarPreview', URL.createObjectURL(file))
                }
              }} />
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center' }}>Optional — you can add this from your dashboard later.</div>
            </>
          )}

          {/* Step 7 — Review */}
          {step === 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Plan', value: TIERS.find(t => t.id === form.tier)?.name },
                { label: 'Business', value: form.businessName },
                { label: 'Name', value: `${form.firstName} ${form.lastName}` },
                { label: 'Email', value: form.email },
                { label: 'Skills', value: form.skillTypes.join(', ') },
                { label: 'Location', value: `${form.city}, ${form.state}` },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                </div>
              ))}
              {form.tier !== 'basic' && (
                <div style={{ padding: '16px', background: 'var(--green-dim)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: 'var(--radius-lg)', fontSize: '13px', color: 'var(--green)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
                  After creating your account you'll be taken to Stripe to complete payment. Your profile goes live immediately after.
                </div>
              )}
            </div>
          )}

        </div>

        <div style={styles.actions}>
          {step > 0
            ? <Button variant="ghost" size="md" onClick={() => { setStep(s => s - 1); setError('') }}>← Back</Button>
            : <Button variant="ghost" size="md" onClick={() => navigate('/login')}>Already have an account?</Button>
          }
          {step < STEPS.length - 1
            ? <Button variant="primary" size="md" disabled={!canProceed()} onClick={() => { setError(''); setStep(s => s + 1) }}>Continue →</Button>
            : <Button variant="primary" size="md" disabled={loading} onClick={handleSubmit}>{loading ? 'Creating account…' : form.tier === 'basic' ? 'Create Account' : 'Create Account & Pay'}</Button>
          }
        </div>

        <div style={styles.footerNote}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </div>

      </div>
    </div>
  )
}
