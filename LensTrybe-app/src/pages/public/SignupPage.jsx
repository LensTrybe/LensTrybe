import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import {
  DIVIDER_GRADIENT_STYLE,
  GLASS_CARD,
  GLASS_CARD_GREEN,
  GLASS_NATIVE_FIELD,
  TYPO,
  glassCardAccentBorder,
} from '../../lib/glassTokens'

const STEPS = ['Plan', 'Account', 'Skills', 'Specialties', 'Location', 'Credentials', 'Photo', 'Review']

const TIERS = [
  { id: 'basic', name: 'Basic', monthly: 0, annual: 0, description: 'Get discovered for free', color: 'var(--border-default)' },
  { id: 'pro', name: 'Pro', monthly: 24.99, annual: 249.90, description: 'Start booking clients', color: 'var(--green)' },
  { id: 'expert', name: 'Expert', monthly: 74.99, annual: 749.90, description: 'Full business tools', color: 'var(--silver)' },
  { id: 'elite', name: 'Elite', monthly: 149.99, annual: 1499.90, description: 'Studio-level power', color: '#EAB308' },
]

const SKILL_TYPES = [
  'Photographer', 'Videographer', 'Drone Pilot', 'Video Editor',
  'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator'
]

const SPECIALTIES = {
  'Photographer': ['Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion', 'Product', 'Sports', 'Street', 'Architecture', 'Food', 'Newborn & Family', 'Maternity', 'Boudoir', 'Pet', 'School', 'Headshots', 'Documentary', 'Travel', 'Fine Art', 'Aerial', 'Night & Astro', 'Corporate'],
  'Videographer': ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport', 'Real Estate', 'Travel', 'Short Film', 'Commercial', 'Aerial', 'News & Journalism'],
  'Drone Pilot': ['Real Estate', 'Cinematic', 'Surveying', 'Events', 'Agriculture', 'Construction', 'Infrastructure', 'Mapping', 'Search & Rescue', 'Film & TV', 'Sport', 'Inspection'],
  'Video Editor': ['Colour Grading', 'Short-form / Reels', 'Wedding Films', 'VFX', 'Motion Graphics', 'Corporate', 'Music Video', 'Documentary', 'Social Media', 'Podcast', 'YouTube', 'Commercial'],
  'Photo Editor': ['Retouching', 'Culling', 'Compositing', 'Product Editing', 'Restoration', 'Fashion', 'Real Estate', 'Wedding', 'Colour Correction', 'Background Removal', 'Skin Retouching'],
  'Social Media Manager': ['Instagram & TikTok', 'Reels & Short-form', 'Brand Content', 'Content Strategy', 'Content Scheduling', 'Visual Storytelling', 'YouTube Management', 'LinkedIn Visual Content', 'Facebook & Meta Content', 'Community Management', 'Influencer Outreach', 'Analytics & Reporting'],
  'Hair & Makeup Artist': ['Bridal & Wedding', 'Editorial & Fashion', 'Commercial & Advertising', 'Film & TV', 'Portrait & Headshots', 'Special Effects (SFX)', 'Hair Styling', 'Airbrush', 'Natural & Lifestyle', 'Events & Occasions', 'Theatre & Performance', "Men's Grooming"],
  'UGC Creator': ['E-commerce & Product', 'App & Software Demos', 'Food & Beverage', 'Beauty & Skincare', 'Health & Fitness', 'Travel & Lifestyle', 'Fashion & Apparel', 'Home & Interiors', 'Pet Products', 'Unboxing & Reviews', 'Paid Ad Creative', 'Testimonial Style', 'Tech & Gadgets', 'Gaming', 'Finance & Fintech'],
}

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

/** Maximum skill types per subscription tier (Elite: no limit). */
const SKILL_TYPE_LIMIT_BY_TIER = {
  basic: 1,
  pro: 2,
  expert: 4,
  elite: Infinity,
}

const PRICE_IDS = {
  pro_monthly: 'price_1TKKXSHW7LVs8k6s2IW7TXsd',
  pro_annual: 'price_1TKKXVHW7LVs8k6snGkHjQE5',
  expert_monthly: 'price_1TKKXYHW7LVs8k6sboOI02xE',
  expert_annual: 'price_1TKKXbHW7LVs8k6shpoFmKAi',
  elite_monthly: 'price_1TKKXjHW7LVs8k6sQNNIkiCf',
  elite_annual: 'price_1TKKXfHW7LVs8k6s99ish4aV',
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

function getCheckoutPriceId(tierId, billingInterval = 'monthly') {
  const interval = billingInterval === 'annual' ? 'annual' : 'monthly'
  return PRICE_IDS[`${tierId}_${interval}`] || ''
}

export default function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const emailPrefillApplied = useRef(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [form, setForm] = useState({
    tier: 'pro',
    billingInterval: 'monthly',
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

  useEffect(() => {
    const plan = searchParams.get('plan')
    if (!plan) return
    const id = plan.toLowerCase()
    const allowed = ['basic', 'pro', 'expert', 'elite']
    if (!allowed.includes(id)) return
    setForm(prev => (prev.tier === id ? prev : { ...prev, tier: id }))
  }, [searchParams])

  useEffect(() => {
    if (emailPrefillApplied.current) return
    const raw = location.state?.email
    if (!raw || typeof raw !== 'string') return
    const trimmed = raw.trim()
    if (!trimmed) return
    emailPrefillApplied.current = true
    setForm(prev => ({ ...prev, email: trimmed }))
    navigate('/join/creative', { replace: true, state: {} })
  }, [location.state, navigate])

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

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    const email = String(form.email || '').trim()
    const password = String(form.password || '')
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (authError) throw authError

      const userId = authData?.user?.id
      if (!userId) throw new Error('Could not create user account.')

      /** Same path and bucket as EditProfilePage `handleAvatarUpload`. */
      let avatarUrl = null
      if (form.avatarFile instanceof File) {
        const ext = form.avatarFile.name.split('.').pop() || 'jpg'
        const path = `${userId}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('portfolio')
          .upload(path, form.avatarFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(path)
        avatarUrl = urlData.publicUrl
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        business_name: form.businessName,
        skill_types: form.skillTypes,
        specialties: form.specialties,
        city: form.city,
        state: form.state,
        country: form.country || 'Australia',
        subscription_tier: form.tier || 'basic',
        display_name_preference: form.displayNamePreference || 'business_name',
        account_type: 'creative',
        avatar_url: avatarUrl,
      })
      if (profileError) throw profileError

      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            record: {
              email,
              user_metadata: { full_name: `${form.firstName} ${form.lastName}` }
            }
          }
        })
      } catch (welcomeEmailError) {
        console.log('send-welcome-email failed', welcomeEmailError)
      }

      if (form.tier !== 'basic') {
        const priceId = getCheckoutPriceId(form.tier, form.billingInterval)
        if (!priceId) {
          throw new Error(`Missing Stripe price ID for ${form.tier} (${form.billingInterval || 'monthly'})`)
        }
        const requestBody = { priceId, userId, email }
        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout-session', {
          body: requestBody
        })
        if (checkoutError) {
          console.log('[SignupPage] create-checkout-session error', {
            error: checkoutError,
            data: checkoutData,
            requestBody,
          })
          throw checkoutError
        }
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
      background: 'transparent',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: isMobile ? '24px 16px 48px' : '48px 24px 80px',
    },
    container: { width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '40px' },
    header: { display: 'flex', flexDirection: 'column', gap: '8px' },
    logo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '8px' },
    title: { fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', ...TYPO.heading },
    subtitle: { fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body },
    progress: { display: 'flex', gap: '6px' },
    progressDot: (active, done) => ({
      height: '3px',
      flex: 1,
      borderRadius: 'var(--radius-full)',
      background: done ? 'var(--green)' : active ? 'var(--green)' : 'var(--border-default)',
      opacity: done ? 1 : active ? 1 : 0.4,
      transition: 'all var(--transition-base)',
    }),
    stepLabel: { fontSize: '11px', ...TYPO.label },
    content: { display: 'flex', flexDirection: 'column', gap: '20px' },
    tierGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' },
    billingToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      ...GLASS_CARD,
      borderRadius: 'var(--radius-full)',
      padding: '4px',
      width: 'fit-content',
      margin: '0 auto 6px',
    },
    billingToggleBtn: (active) => ({
      padding: '6px 20px',
      borderRadius: 'var(--radius-full)',
      border: 'none',
      background: active ? 'var(--green)' : 'transparent',
      color: active ? '#000' : 'var(--text-secondary)',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      fontFamily: 'var(--font-ui)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }),
    saveBadge: {
      fontSize: '10px',
      background: 'var(--green-dim)',
      color: 'var(--green)',
      padding: '2px 6px',
      borderRadius: 'var(--radius-full)',
      fontWeight: 600,
    },
    tierCard: (selected, color) => ({
      ...(selected ? glassCardAccentBorder(color) : GLASS_CARD),
      padding: '20px',
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }),
    tierName: { fontSize: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', ...TYPO.heading },
    tierPrice: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', ...TYPO.stat },
    tierAnnualMeta: { fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--font-ui)', ...TYPO.body, fontWeight: 500 },
    tierDesc: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', ...TYPO.body },
    skillGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' },
    skillChip: (selected, disabled) => ({
      padding: '10px 16px',
      ...(disabled
        ? { ...GLASS_CARD, cursor: 'not-allowed', opacity: 0.55 }
        : selected
          ? {
              ...glassCardAccentBorder('var(--green)'),
              background: 'linear-gradient(135deg, rgba(29,185,84,0.14) 0%, rgba(29,185,84,0.05) 100%)',
            }
          : GLASS_CARD),
      borderRadius: 'var(--radius-lg)',
      color: disabled ? 'var(--text-muted)' : selected ? 'var(--green)' : 'var(--text-secondary)',
      fontSize: '13px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all var(--transition-base)',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
      ...TYPO.body,
      fontWeight: selected ? 500 : 400,
    }),
    skillLimitHint: {
      fontSize: '13px',
      color: 'var(--text-muted)',
      margin: 0,
      marginTop: '4px',
      ...TYPO.body,
    },
    specialtyWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    specialtyChip: (selected) => ({
      padding: '6px 14px',
      ...(selected
        ? {
            ...glassCardAccentBorder('var(--green)'),
            background: 'linear-gradient(135deg, rgba(29,185,84,0.14) 0%, rgba(29,185,84,0.05) 100%)',
          }
          : GLASS_CARD),
      borderRadius: 'var(--radius-full)',
      color: selected ? 'var(--green)' : 'var(--text-secondary)',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      fontFamily: 'var(--font-ui)',
      ...TYPO.body,
    }),
    row: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' },
    sectionTitle: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', marginBottom: '-8px', ...TYPO.heading },
    avatarUpload: {
      ...GLASS_CARD,
      border: '2px dashed rgba(255,255,255,0.12)',
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
    footerNote: { fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', ...TYPO.body },
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

  function getPlanPrice(tier) {
    if (tier.monthly === 0) return 'Free'
    return form.billingInterval === 'annual' ? `$${tier.annual.toFixed(2)}` : `$${tier.monthly.toFixed(2)}`
  }

  function getPlanPeriod(tier) {
    if (tier.monthly === 0) return ''
    return form.billingInterval === 'annual' ? '/yr' : '/mo'
  }

  function getPlanAnnualMeta(tier) {
    if (tier.monthly === 0 || form.billingInterval !== 'annual') return null
    const monthlyEquivalent = (tier.annual / 12).toFixed(2)
    const saving = (tier.monthly * 12 - tier.annual).toFixed(0)
    return `$${monthlyEquivalent}/mo · Save $${saving}/yr`
  }

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
            <>
              <div style={styles.billingToggle}>
                <button type="button" style={styles.billingToggleBtn(form.billingInterval === 'monthly')} onClick={() => update('billingInterval', 'monthly')}>
                  Monthly
                </button>
                <button type="button" style={styles.billingToggleBtn(form.billingInterval === 'annual')} onClick={() => update('billingInterval', 'annual')}>
                  Annual
                  <span style={styles.saveBadge}>2 months free</span>
                </button>
              </div>
              <div style={styles.tierGrid}>
                {TIERS.map(tier => (
                  <div key={tier.id} style={styles.tierCard(form.tier === tier.id, tier.color)} onClick={() => update('tier', tier.id)}>
                    <div style={styles.tierName}>{tier.name}</div>
                    <div style={styles.tierPrice}>{getPlanPrice(tier)}{getPlanPeriod(tier)}</div>
                    {getPlanAnnualMeta(tier) && <div style={styles.tierAnnualMeta}>{getPlanAnnualMeta(tier)}</div>}
                    <div style={styles.tierDesc}>{tier.description}</div>
                  </div>
                ))}
              </div>
            </>
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
                <label style={{ fontSize: '13px', ...TYPO.label }}>State</label>
                <select value={form.state} onChange={e => update('state', e.target.value)} style={{ padding: '10px 14px', cursor: 'pointer', color: form.state ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '15px', ...GLASS_NATIVE_FIELD }}>
                  <option value="">Select state</option>
                  {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Step 5 — Credentials (optional) */}
          {step === 5 && (
            <>
              <div style={{ ...GLASS_CARD, padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>
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
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>
                  {form.avatarPreview ? 'Click to change photo' : 'Click to upload profile photo'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', ...TYPO.body }}>JPG or PNG, max 5MB</div>
              </div>
              <input id="avatar-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files[0]
                if (file) {
                  update('avatarFile', file)
                  update('avatarPreview', URL.createObjectURL(file))
                }
              }} />
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', ...TYPO.body }}>Optional — you can add this from your dashboard later.</div>
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
              ].map((row, i, arr) => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0' }}>
                    <span style={{ fontSize: '13px', ...TYPO.label }}>{row.label}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', textAlign: 'right', maxWidth: '60%', ...TYPO.body }}>{row.value}</span>
                  </div>
                  {i < arr.length - 1 ? <div style={DIVIDER_GRADIENT_STYLE} aria-hidden /> : null}
                </div>
              ))}
              {form.tier !== 'basic' && (
                <div style={{ padding: '16px', fontSize: '13px', color: 'var(--green)', ...GLASS_CARD_GREEN, ...TYPO.body }}>
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
