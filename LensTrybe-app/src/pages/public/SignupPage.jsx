import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { moderateText } from '../../lib/moderateContent'
import { payWithRevolut } from '../../lib/revolut.js'
import { CREATIVE_TYPES } from '../../lib/creativeTypes'
import Input from '../../components/ui/Input'
import {
  DIVIDER_GRADIENT_STYLE,
  GLASS_CARD_GREEN,
  LIQUID_GLASS_CARD,
  LIQUID_FIELD,
  TYPO,
  glassCardAccentBorder,
} from '../../lib/glassTokensLight'
import { LiquidLensFilter, LiquidPill, LiquidSelect } from '../../components/ui/liquidGlass'
import TileField from '../../components/ui/TileField'

// Founding is invite-only via a personal code, so there is no public open offer or spot
// counter. Non-invited creatives get a 3-month free trial on any paid plan.
// SEQ coastal launch zone: in-zone continues to signup; anyone else joins the waitlist.
const LAUNCH_REGIONS = ['Sunshine Coast', 'Moreton Bay', 'Brisbane', 'Ipswich', 'Logan', 'Redland Bay', 'Gold Coast']

const STEPS = ['Plan', 'Account']

const TIERS = [
  { id: 'basic', name: 'Basic', monthly: 0, annual: 0, description: 'Get discovered for free', color: 'var(--border-default)' },
  { id: 'pro', name: 'Pro', monthly: 24.99, annual: 249.90, description: 'Start booking clients', color: 'var(--green)' },
  { id: 'expert', name: 'Expert', monthly: 74.99, annual: 749.90, description: 'Full business tools', color: 'var(--silver)' },
  { id: 'elite', name: 'Elite', monthly: 149.99, annual: 1499.90, description: 'Studio-level power', color: '#EAB308' },
]

// Launch scope lives in one place (src/lib/creativeTypes.js): Photographers and
// Videographers only. Add disciplines back there to re-enable them everywhere.
const SKILL_TYPES = CREATIVE_TYPES

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

// Friendly message for a founding code the founding-code function turned down.
function foundingCodeMessage(reason) {
  if (reason === 'expired') return 'This invite code has expired. Reply to your invite email and we can send you a fresh one.'
  if (reason === 'redeemed' || reason === 'already_redeemed') return 'This code has already been used to create an account. Try logging in instead.'
  if (reason === 'cancelled') return 'This invite code is no longer active. Reply to your invite email if you think that is a mistake.'
  if (reason === 'rate_limited') return 'Too many tries. Please wait a few minutes and try again.'
  return "We couldn't find that code. Check it matches the one in your invite email."
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
  const [googleHover, setGoogleHover] = useState(false)
  // A founding code counts only if the founding-code function confirms it is unused.
  const [foundingValid, setFoundingValid] = useState(false)
  // Launch-zone gate: in-zone creatives continue to signup; out-of-zone join the waitlist.
  const [zoneChosen, setZoneChosen] = useState(false)
  const [region, setRegion] = useState('')
  const [wlEmail, setWlEmail] = useState('')
  const [wlName, setWlName] = useState('')
  const [wlSaving, setWlSaving] = useState(false)
  const [wlDone, setWlDone] = useState(false)
  const [wlError, setWlError] = useState('')
  const [agreedFounding, setAgreedFounding] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  // Manual founding-code entry on the gate (for creatives who did not arrive via their link).
  const [codeInput, setCodeInput] = useState('')
  const [codeChecking, setCodeChecking] = useState(false)
  const [codeError, setCodeError] = useState('')
  // True when they arrived from their invite link, so the code box leads the gate.
  const [codeFromLink, setCodeFromLink] = useState(false)
  // Founding invite code (from the waitlist ?code= link or sessionStorage). When present,
  // the account is granted free Expert until 1 Oct 2027 by the database trigger on signup.
  const [foundingCode, setFoundingCode] = useState('')
  // After a successful signup we show a "verify your email" screen instead of navigating.
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  // Once the account is created we remember it, so a card retry re-opens the payment
  // window without trying to sign up again (which would error as "already registered").
  const [createdUser, setCreatedUser] = useState(null)

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
    referralCode: '',
  })

  const [referralCodeStatus, setReferralCodeStatus] = useState(null)
  const [referralCodeReferrerName, setReferralCodeReferrerName] = useState('')

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function validateReferralCode(code) {
    if (!code.trim()) { setReferralCodeStatus(null); setReferralCodeReferrerName(''); return }
    try {
      const { data } = await supabase.functions.invoke('validate-referral-code', { body: { code: code.trim().toUpperCase() } })
      if (data?.valid) {
        setReferralCodeStatus('valid')
        setReferralCodeReferrerName(data.referrer_name || '')
      } else {
        setReferralCodeStatus('invalid')
        setReferralCodeReferrerName('')
      }
    } catch {
      setReferralCodeStatus('invalid')
      setReferralCodeReferrerName('')
    }
  }

  // Out-of-zone creatives join the waitlist (reuses the same waitlist-signup function
  // as the Coming Soon page). isValidEmail is a hoisted function declaration below.
  async function submitWaitlist() {
    setWlError('')
    if (!isValidEmail(wlEmail)) { setWlError('Please enter a valid email address.'); return }
    setWlSaving(true)
    try {
      const { data, error: wlErr } = await supabase.functions.invoke('waitlist-signup', {
        body: {
          email: wlEmail.trim(),
          name: wlName.trim() || null,
          audience: 'creative',
          state: form.state || null,
          city: form.city || null,
        },
      })
      if (wlErr || data?.error) throw new Error(data?.error || 'failed')
      setWlDone(true)
    } catch {
      setWlError('Something went wrong. Please try again.')
    } finally {
      setWlSaving(false)
    }
  }

  // Manually entered founding code on the gate. Validates via the founding-code function;
  // on success it applies the founding deal and skips the launch-zone gate.
  async function applyFoundingCode() {
    const code = codeInput.trim().toUpperCase()
    if (!code) return
    setCodeChecking(true)
    setCodeError('')
    try {
      const { data } = await supabase.functions.invoke('founding-code', { body: { action: 'validate', code } })
      if (data?.valid) {
        setFoundingCode(code)
        setFoundingValid(true)
        try { sessionStorage.setItem('lt_founding_code', code) } catch { /* ignore */ }
        setForm(prev => ({ ...prev, tier: 'expert' }))
        setZoneChosen(true)
      } else {
        setCodeError(foundingCodeMessage(data?.reason))
      }
    } catch {
      setCodeError('Could not check that code. Please try again.')
    } finally {
      setCodeChecking(false)
    }
  }

  async function continueWithGoogle() {
    setError('')
    const plan = searchParams.get('plan')
    if (plan) {
      try {
        sessionStorage.setItem('lt_signup_plan', plan)
      } catch {
        /* ignore */
      }
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    })
    if (oauthError) setError(oauthError.message)
  }

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Founding invite links (/join/creative?code=...) pre-fill the code on the gate. It is
  // never applied automatically: the creative taps Apply, which checks it is still valid.
  useEffect(() => {
    let fromLink = (searchParams.get('code') || '').trim().toUpperCase()
    if (!fromLink) {
      try { fromLink = (sessionStorage.getItem('lt_founding_code') || '').trim().toUpperCase() } catch { /* ignore */ }
    }
    if (fromLink && fromLink.length <= 64) {
      setCodeInput((prev) => prev || fromLink)
      setCodeFromLink(true)
    }
  }, [searchParams])

  useEffect(() => {
    const plan = searchParams.get('plan')
    if (plan) {
      const id = plan.toLowerCase()
      const allowed = ['basic', 'pro', 'expert', 'elite']
      if (allowed.includes(id)) {
        setForm(prev => (prev.tier === id ? prev : { ...prev, tier: id }))
      }
    }
  }, [searchParams])

  // Pre-fill (and validate) a referral code arriving via an invite link, e.g.
  // /join/creative?ref=LENS-SARAH123. The creative can still edit it before paying.
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (!ref) return
    const code = ref.toUpperCase().trim()
    if (!code) return
    setForm(prev => (prev.referralCode ? prev : { ...prev, referralCode: code }))
    validateReferralCode(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // A founding invite code always means Expert (free until 1 Oct 2027, applied by the trigger).
    const effectiveTier = foundingCode ? 'expert' : (form.tier || 'basic')

    try {
      let userId = createdUser?.id
      let userEmail = createdUser?.email || email

      // Create the account once. On a retry after a cancelled card, skip signUp and go
      // straight back to the payment window (signing up again would fail as "already registered").
      if (!userId) {
        if (!isValidEmail(email)) {
          setError('Please enter a valid email address.')
          setLoading(false)
          return
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters.')
          setLoading(false)
          return
        }

        const businessNameModeration = await moderateText(form.businessName)
        if (businessNameModeration?.blocked) {
          setError(businessNameModeration.reason || 'This business name cannot be used.')
          setLoading(false)
          return
        }

        // Email confirmation is on, so signUp does NOT return a session. The database
        // trigger (handle_new_user) builds the profile from this metadata and applies the
        // founding code, so nothing here needs an authenticated session.
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              account_type: 'creative',
              marketing_opt_in: marketingOptIn ? 'true' : 'false',
              business_name: form.businessName,
              first_name: form.firstName,
              last_name: form.lastName,
              display_name_preference: form.displayNamePreference || 'business_only',
              country: form.country || 'Australia',
              city: form.city || '',
              state: form.state || '',
              subscription_tier: effectiveTier,
              ...(foundingCode ? { founding_code: foundingCode } : {}),
            },
          },
        })
        if (authError) throw authError

        userId = authData?.user?.id
        if (!userId) throw new Error('Could not create user account.')
        userEmail = email
        setCreatedUser({ id: userId, email })

        try {
          // No session yet (email confirmation is on): the function sends once, only to this
          // new account's own address, and reads the founding status from the database.
          await supabase.functions.invoke('send-welcome-email', {
            body: { user_id: userId },
          })
        } catch (welcomeEmailError) {
          console.log('send-welcome-email failed', welcomeEmailError)
        }
      }

      // A saved card is REQUIRED for every paid tier (Basic is free, so no card). No charge
      // until the free period ends (founding: 1 Oct 2027, set by the trigger). If they close
      // the popup without saving a card they cannot continue; pressing the button again
      // re-opens the payment window without recreating the account.
      if (effectiveTier !== 'basic') {
        let result
        try {
          result = await payWithRevolut({
            user: { id: userId, email: userEmail },
            tier: effectiveTier,
            billing: form.billingInterval,
            fullName: `${form.firstName} ${form.lastName}`.trim(),
            referralCode: (form.referralCode || '').trim(),
          })
        } catch (e) {
          console.log('Revolut card setup failed', e?.message)
          setError('We could not open the payment window. Press the button to try adding your card again.')
          setLoading(false)
          return
        }
        if (result !== 'success') {
          setError('A payment method is required to finish signing up. Please add a card to continue.')
          setLoading(false)
          return
        }
      }

      // Code is now on the account; clear it so it can't be reused in this browser.
      try { sessionStorage.removeItem('lt_founding_code') } catch { /* ignore */ }

      setSubmittedEmail(userEmail)
      setSubmitted(true)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'transparent',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: isMobile ? '24px 16px 48px' : '48px 24px 80px',
    },
    container: { width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '40px', position: 'relative', zIndex: 2 },
    header: { display: 'flex', flexDirection: 'column', gap: '8px' },
    logo: { fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: '-0.02em', fontSize: '19px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '8px' },
    title: { fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, fontSize: isMobile ? '26px' : '32px', color: 'var(--text-primary)' },
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
      ...LIQUID_GLASS_CARD,
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
    tierCard: (tierDef, selected) => {
      const layout = {
        padding: '20px',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }
      /** Solid + RGB triple for neon (matches TIERS accents: blue, green, silver, gold). */
      const TIER_NEON = {
        basic: { hex: '#4A9EFF', rgb: [74, 158, 255] },
        pro: { hex: '#1DB954', rgb: [29, 185, 84] },
        expert: { hex: '#C0C8D8', rgb: [192, 200, 216] },
        elite: { hex: '#EAB308', rgb: [234, 179, 8] },
      }
      const neon = TIER_NEON[tierDef.id]
      if (neon && selected) {
        const [r, g, b] = neon.rgb
        return {
          ...LIQUID_GLASS_CARD,
          ...layout,
          border: `2px solid ${neon.hex}`,
          borderTop: `2px solid ${neon.hex}`,
          borderLeft: `2px solid ${neon.hex}`,
          background: `linear-gradient(160deg, rgba(${r},${g},${b},0.12) 0%, rgba(255,255,255,0.6) 100%)`,
          boxShadow: `0 0 16px rgba(${r},${g},${b},0.22), 0 12px 30px -14px rgba(40,30,60,0.2), inset 0 1px 0 rgba(255,255,255,0.7)`,
        }
      }
      return {
        ...layout,
        ...(selected ? glassCardAccentBorder(tierDef.color) : LIQUID_GLASS_CARD),
      }
    },
    tierName: { fontSize: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', ...TYPO.heading },
    tierPrice: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', ...TYPO.stat },
    tierAnnualMeta: { fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--font-ui)', ...TYPO.body, fontWeight: 500 },
    tierDesc: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', ...TYPO.body },
    skillGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' },
    skillChip: (selected, disabled) => ({
      padding: '10px 16px',
      ...(disabled
        ? { ...LIQUID_GLASS_CARD, cursor: 'not-allowed', opacity: 0.55 }
        : selected
          ? {
              ...glassCardAccentBorder('var(--green)'),
              background: 'linear-gradient(135deg, rgba(29,185,84,0.14) 0%, rgba(29,185,84,0.05) 100%)',
            }
          : LIQUID_GLASS_CARD),
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
          : LIQUID_GLASS_CARD),
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
      ...LIQUID_GLASS_CARD,
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
    { title: 'Your location', sub: 'Clients search by location, so be discoverable.' },
    { title: 'Credentials', sub: 'Optional: add trust badges to your profile.' },
    { title: 'Profile photo', sub: 'Put a face to your business.' },
    { title: 'You\'re almost there', sub: 'Review your details before creating your account.' },
  ]

  // Launch-zone gate. Shown first for everyone except invited creatives (a valid founding
  // code bypasses it). In-zone regions continue to signup; out-of-zone joins the waitlist.
  // Founding invite code entry. Leads the gate when they came from their invite link.
  const foundingCodeBox = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '13px', ...TYPO.label }}>{codeFromLink ? 'Your founding invite code' : 'Have a founding invite code?'}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          style={{ ...LIQUID_FIELD, flex: 1, padding: '10px 14px', fontSize: '14px', textTransform: 'uppercase' }}
          placeholder="Enter your code"
          value={codeInput}
          onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError('') }}
        />
        <LiquidPill primary type="button" style={{ flex: '0 0 auto', padding: '10px 18px', fontSize: '13px', opacity: codeChecking ? 0.6 : 1 }} disabled={codeChecking} onClick={applyFoundingCode}>
          {codeChecking ? 'Checking…' : 'Apply'}
        </LiquidPill>
      </div>
      {codeError && <div style={{ fontSize: '12px', color: '#ef4444', fontFamily: 'var(--font-ui)' }}>{codeError}</div>}
    </div>
  )

  if (!zoneChosen) {
    return (
      <div style={styles.page} className="signup-page">
        <LiquidLensFilter />
        {!isMobile && <TileField animated={false} opacity={0.22} />}
        <div style={{ ...styles.container, maxWidth: '480px' }}>
          <div style={styles.header}>
            <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
            <h1 style={styles.title}>{codeFromLink ? 'Claim your founding place' : 'Where are you based?'}</h1>
            <p style={styles.subtitle}>{codeFromLink
              ? 'You have been invited to join LensTrybe as a founding creative. Tap Apply to use your code and set up your account.'
              : 'LensTrybe is launching across South East Queensland first, from the Sunshine Coast to the Gold Coast. Choose your area to get started, and we are rolling out across Australia city by city.'}</p>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          {!wlDone ? (
            <div style={styles.content}>
              {codeFromLink && (
                <>
                  <div style={{ ...GLASS_CARD_GREEN, padding: '18px' }}>{foundingCodeBox}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                    <div style={{ flex: 1, ...DIVIDER_GRADIENT_STYLE }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', ...TYPO.body }}>or join without a code</span>
                    <div style={{ flex: 1, ...DIVIDER_GRADIENT_STYLE }} />
                  </div>
                </>
              )}
              <div style={styles.skillGrid}>
                {LAUNCH_REGIONS.map((r) => (
                  <div
                    key={r}
                    style={styles.skillChip(false, false)}
                    onClick={() => { setForm(prev => ({ ...prev, city: prev.city || r, state: 'QLD' })); setRegion(r); setZoneChosen(true) }}
                  >
                    {r}
                  </div>
                ))}
              </div>

              {region !== '__other__' ? (
                <button
                  type="button"
                  onClick={() => setRegion('__other__')}
                  style={{ ...styles.passwordToggleBtn, color: 'var(--text-secondary)', textAlign: 'left', fontSize: '13px' }}
                >
                  I&apos;m somewhere else in Australia →
                </button>
              ) : (
                <div style={{ ...LIQUID_GLASS_CARD, padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>
                    We are not in your area just yet. Leave your details and we will let you know the moment LensTrybe launches near you.
                  </div>
                  <Input label="Email address" type="email" placeholder="you@example.com" value={wlEmail} onChange={e => setWlEmail(e.target.value)} />
                  <Input label="Your name (optional)" placeholder="Sarah Mitchell" value={wlName} onChange={e => setWlName(e.target.value)} />
                  <Input label="Your city" placeholder="e.g. Sydney" value={form.city} onChange={e => update('city', e.target.value)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', ...TYPO.label }}>State</label>
                    <LiquidSelect value={form.state} onChange={(v) => update('state', v)} ariaLabel="State" placeholder="Select state" options={[{ value: '', label: 'Select state' }, ...AU_STATES.map(s => ({ value: s, label: s }))]} />
                  </div>
                  {wlError && <div style={styles.errorBox}>{wlError}</div>}
                  <LiquidPill primary style={{ padding: '12px 24px', fontSize: '14px', opacity: wlSaving ? 0.6 : 1 }} disabled={wlSaving} onClick={submitWaitlist}>{wlSaving ? 'Joining…' : 'Join the waitlist'}</LiquidPill>
                </div>
              )}

              {region !== '__other__' && !codeFromLink && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                    <div style={{ flex: 1, ...DIVIDER_GRADIENT_STYLE }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', ...TYPO.body }}>or</span>
                    <div style={{ flex: 1, ...DIVIDER_GRADIENT_STYLE }} />
                  </div>
                  {foundingCodeBox}
                </>
              )}
            </div>
          ) : (
            <div style={{ ...GLASS_CARD_GREEN, padding: '20px', color: 'var(--green)', ...TYPO.body }}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>You&apos;re on the list.</div>
              <div style={{ fontSize: '14px' }}>We will email you the moment LensTrybe launches in your area. Thanks for your interest.</div>
            </div>
          )}

          <div style={styles.actions}>
            <LiquidPill style={{ flex: '0 0 auto', padding: '12px 22px', fontSize: '14px' }} onClick={() => navigate('/')}>← Back to home</LiquidPill>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={styles.page} className="signup-page">
        <LiquidLensFilter />
        {!isMobile && <TileField animated={false} opacity={0.22} />}
        <div style={{ ...styles.container, maxWidth: '480px' }}>
          <div style={styles.header}>
            <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
            <h1 style={styles.title}>Check your email</h1>
            <p style={styles.subtitle}>
              We have sent a verification link to <strong>{submittedEmail}</strong>. Click it to confirm your account, then log in to finish setting up your profile.
            </p>
          </div>

          {foundingValid && (
            <div style={{ padding: '14px 16px', fontSize: '13px', ...GLASS_CARD_GREEN, color: 'var(--green)', ...TYPO.body }}>
              Founding invite applied. Your Expert plan is free for 12 months, then $49/mo locked in for life.
            </div>
          )}

          <div style={{ ...LIQUID_GLASS_CARD, padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>
            Did not get it? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={async () => {
                setError('')
                const { error: resendErr } = await supabase.auth.resend({
                  type: 'signup',
                  email: submittedEmail,
                  options: { emailRedirectTo: `${window.location.origin}/dashboard` },
                })
                setError(resendErr ? resendErr.message : 'Verification email resent.')
              }}
              style={{ ...styles.passwordToggleBtn, color: 'var(--green)', fontWeight: 600 }}
            >
              resend the link
            </button>.
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.actions}>
            <LiquidPill primary style={{ flex: '0 0 auto', padding: '12px 24px', fontSize: '14px' }} onClick={() => navigate('/login')}>Go to login</LiquidPill>
          </div>
        </div>
      </div>
    )
  }

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
      <LiquidLensFilter />
      {!isMobile && <TileField animated={false} opacity={0.22} />}
      {!isMobile && (
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '200px', zIndex: 1, background: 'linear-gradient(180deg, rgba(246,245,243,0.9) 0%, rgba(246,245,243,0.5) 55%, rgba(246,245,243,0) 100%)' }} />
      )}
      <div style={styles.container}>

        <div style={styles.header}>
          <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
          <div style={styles.stepLabel}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</div>
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
              {foundingValid && (
                <div style={{ padding: '14px 16px', fontSize: '13px', ...GLASS_CARD_GREEN, color: 'var(--green)', ...TYPO.body, marginBottom: '4px' }}>
                  <strong>Founding invite applied.</strong> Expert is free for your first 12 months, then $49/mo locked in for life.
                </div>
              )}
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
                {TIERS.map((tier) => {
                  const isExpertOffer = tier.id === 'expert' && foundingValid
                  const selected = form.tier === tier.id
                  const cardStyle = isExpertOffer && selected
                    ? {
                        ...styles.tierCard(tier, selected),
                        border: '2px solid #f59e0b',
                        borderTop: '2px solid #f59e0b',
                        borderLeft: '2px solid #f59e0b',
                        background: 'linear-gradient(160deg, rgba(245,158,11,0.10) 0%, rgba(255,255,255,0.6) 100%)',
                        boxShadow: '0 12px 34px -14px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.7)',
                      }
                    : styles.tierCard(tier, selected)
                  return (
                  <div key={tier.id} style={cardStyle} onClick={() => update('tier', tier.id)}>
                    {isExpertOffer && (
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#f59e0b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: '4px',
                      }}>
                        Founding Member
                      </div>
                    )}
                    <div style={styles.tierName}>{tier.name}</div>
                    {isExpertOffer ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <span style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-ui)' }}>FREE</span>
                          <span style={{ textDecoration: 'line-through', color: '#8b8a9a', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                            {getPlanPrice(tier)}{getPlanPeriod(tier)}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>Free for 12 months, then $49/mo for life</div>
                      </>
                    ) : (
                      <>
                        <div style={styles.tierPrice}>{getPlanPrice(tier)}{getPlanPeriod(tier)}</div>
                        {getPlanAnnualMeta(tier) && <div style={styles.tierAnnualMeta}>{getPlanAnnualMeta(tier)}</div>}
                        {tier.monthly > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>First 3 months free</div>
                        )}
                      </>
                    )}
                    <div style={styles.tierDesc}>{tier.description}</div>
                  </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Step 1 — Account */}
          {step === 1 && (
            <>
              <LiquidPill
                onClick={() => void continueWithGoogle()}
                style={{ width: '100%', display: 'inline-flex', padding: '14px 20px', gap: '12px', fontSize: '15px' }}
              >
                <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 700, color: '#14111a', width: '24px', textAlign: 'center', lineHeight: 1 }} aria-hidden>G</span>
                Continue with Google
              </LiquidPill>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', marginBottom: '8px' }}>
                <div style={{ flex: 1, ...DIVIDER_GRADIENT_STYLE }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', ...TYPO.body }}>or</span>
                <div style={{ flex: 1, ...DIVIDER_GRADIENT_STYLE }} />
              </div>
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
              {foundingValid && (
                <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--text-secondary)', ...TYPO.body, cursor: 'pointer' }}>
                  <input type="checkbox" checked={agreedFounding} onChange={(e) => setAgreedFounding(e.target.checked)} style={{ marginTop: '3px', width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--green)' }} />
                  <span>I agree to the LensTrybe Founding Creative Agreement: a complete profile within 7 days, my next 3 real client jobs run through LensTrybe, and one piece of feedback a month, in exchange for 12 months free Expert then $49/mo locked in for life. <a href="/founding-agreement" target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>Read the Founding Creative Agreement</a>.</span>
                </label>
              )}
              {form.tier !== 'basic' && !foundingValid && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <label style={{ fontSize: '13px', ...TYPO.label }}>Referral code (optional)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      style={{ ...LIQUID_FIELD, flex: 1, padding: '10px 14px', fontSize: '14px', textTransform: 'uppercase' }}
                      placeholder="e.g. LENS-SARAH123"
                      value={form.referralCode}
                      onChange={e => { update('referralCode', e.target.value.toUpperCase()); setReferralCodeStatus(null); setReferralCodeReferrerName('') }}
                      onBlur={e => validateReferralCode(e.target.value)}
                    />
                    <LiquidPill type="button" style={{ flex: '0 0 auto', padding: '10px 18px', fontSize: '13px' }} onClick={() => validateReferralCode(form.referralCode)}>
                      Apply
                    </LiquidPill>
                  </div>
                  {referralCodeStatus === 'valid' && (
                    <div style={{ fontSize: '12px', color: 'var(--green)', fontFamily: 'var(--font-ui)' }}>
                      Code applied. You will receive 10% off your first payment{referralCodeReferrerName ? `, referred by ${referralCodeReferrerName}` : ''}.
                    </div>
                  )}
                  {referralCodeStatus === 'invalid' && (
                    <div style={{ fontSize: '12px', color: '#ef4444', fontFamily: 'var(--font-ui)' }}>
                      Invalid referral code. Please check and try again.
                    </div>
                  )}
                </div>
              )}
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
                <LiquidSelect value={form.state} onChange={(v) => update('state', v)} ariaLabel="State" placeholder="Select state" style={{ flex: '1 1 100%' }} options={[{ value: '', label: 'Select state' }, ...AU_STATES.map(s => ({ value: s, label: s }))]} />
              </div>
            </>
          )}

          {/* Step 5 — Credentials (optional) */}
          {step === 5 && (
            <>
              <div style={{ ...LIQUID_GLASS_CARD, padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>
                Credentials are optional. They appear as trust badges on your public profile. Documents are private: clients only see the badge, not the file.
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
                  : <div style={{ fontSize: '32px' }}></div>
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
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', ...TYPO.body }}>Optional: you can add this from your dashboard later.</div>
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
                <>
                  <div style={{ padding: '16px', fontSize: '13px', color: 'var(--green)', ...GLASS_CARD_GREEN, ...TYPO.body }}>
                    {foundingValid && form.tier === 'expert'
                      ? "You'll add a card to finish. You won't be charged for 12 months, then it's $49/mo locked in for life, renewing automatically until you cancel. You can cancel any time in Settings. Your Expert profile goes live immediately."
                      : "You'll add a card to finish. You won't be charged for your first 3 months, and you won't be charged at all if you cancel before then. After that your plan renews automatically at the price shown until you cancel. You can cancel any time in Settings. Your profile goes live immediately after."}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', ...TYPO.label }}>Referral code (optional)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        style={{ ...LIQUID_FIELD, flex: 1, padding: '10px 14px', fontSize: '14px', textTransform: 'uppercase' }}
                        placeholder="e.g. LENS-SARAH123"
                        value={form.referralCode}
                        onChange={e => { update('referralCode', e.target.value.toUpperCase()); setReferralCodeStatus(null); setReferralCodeReferrerName('') }}
                        onBlur={e => validateReferralCode(e.target.value)}
                      />
                      <LiquidPill type="button" style={{ flex: '0 0 auto', padding: '10px 18px', fontSize: '13px' }} onClick={() => validateReferralCode(form.referralCode)}>
                        Apply
                      </LiquidPill>
                    </div>
                    {referralCodeStatus === 'valid' && (
                      <div style={{ fontSize: '12px', color: 'var(--green)', fontFamily: 'var(--font-ui)' }}>
                        Code applied. You will receive 10% off your first payment, referred by {referralCodeReferrerName}.
                      </div>
                    )}
                    {referralCodeStatus === 'invalid' && (
                      <div style={{ fontSize: '12px', color: '#ef4444', fontFamily: 'var(--font-ui)' }}>
                        Invalid referral code. Please check and try again.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {step === STEPS.length - 1 && (
          <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--text-secondary)', ...TYPO.body, cursor: 'pointer', margin: '4px 0 12px' }}>
            <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} style={{ marginTop: '3px', width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--green)' }} />
            <span>Send me The Trybe Edit newsletter and occasional LensTrybe news (optional). Unsubscribe any time.</span>
          </label>
        )}

        <div style={styles.actions}>
          {step > 0
            ? <LiquidPill style={{ flex: '0 0 auto', padding: '12px 22px', fontSize: '14px' }} onClick={() => { setStep(s => s - 1); setError('') }}>← Back</LiquidPill>
            : <LiquidPill style={{ flex: '0 0 auto', padding: '12px 22px', fontSize: '14px' }} onClick={() => navigate('/login')}>Already have an account?</LiquidPill>
          }
          {step < STEPS.length - 1
            ? <LiquidPill primary style={{ flex: '0 0 auto', padding: '12px 24px', fontSize: '14px', opacity: !canProceed() ? 0.6 : 1 }} disabled={!canProceed()} onClick={() => { setError(''); setStep(s => s + 1) }}>Continue →</LiquidPill>
            : <LiquidPill primary style={{ flex: '0 0 auto', padding: '12px 24px', fontSize: '14px', opacity: (loading || (foundingValid && !agreedFounding)) ? 0.6 : 1 }} disabled={loading || (foundingValid && !agreedFounding)} onClick={handleSubmit}>{loading ? 'Creating account…' : form.tier === 'basic' ? 'Create Account' : 'Create Account & Pay'}</LiquidPill>
          }
        </div>

        <div style={styles.footerNote}>
          By creating an account you confirm you're 18 or over and agree to our <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>Terms and Conditions</a>, <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>Privacy Policy</a>, <a href="/cookies" target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>Cookies Policy</a> and <a href="/refunds" target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>Refund Policy</a>.
        </div>

      </div>
    </div>
  )
}
