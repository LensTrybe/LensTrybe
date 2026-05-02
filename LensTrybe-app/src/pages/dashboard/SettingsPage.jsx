import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'

const SUBSCRIPTION_PLAN_ORDER = { basic: 0, pro: 1, expert: 2, elite: 3 }

/** Plan rows copied from src/pages/public/PricingPage.jsx `tiers`. */
const PRICING_PAGE_TIERS = [
  {
    name: 'Basic',
    monthly: 0,
    annual: 0,
    description: 'Get discovered. Build your presence.',
    badge: null,
    borderColor: 'var(--border-default)',
    features: [
      '5 portfolio photos',
      'Public profile listing',
      '5 message replies/month',
      'Gear marketplace access',
      'Basic search placement',
    ],
    cta: 'Get Started Free',
    ctaVariant: 'secondary',
  },
  {
    name: 'Pro',
    monthly: 24.99,
    annual: 249.90,
    description: 'Start booking clients professionally.',
    badge: null,
    borderColor: 'var(--green)',
    features: [
      '20 portfolio photos, 1 video',
      '20 message replies/month',
      'Booking & scheduling',
      'Quotes & invoicing',
      'Review requests',
      'Gear marketplace listings (5)',
      'Pro badge on profile',
    ],
    cta: 'Start with Pro',
    ctaVariant: 'primary',
  },
  {
    name: 'Expert',
    monthly: 74.99,
    annual: 749.90,
    description: 'Full business tools for serious creatives.',
    badge: { label: 'Most Popular', variant: 'green' },
    borderColor: 'var(--silver)',
    features: [
      '40 photos, 5 videos',
      'Unlimited message replies',
      'Custom contracts & e-signatures',
      'CRM — 500 client records',
      'Client portals',
      'Brand kit',
      'Portfolio website',
      'LensTrybe Deliver — 50GB',
      'Business insights',
      'Homepage rotation',
      'Gear marketplace listings (15)',
    ],
    cta: 'Start with Expert',
    ctaVariant: 'secondary',
  },
  {
    name: 'Elite',
    monthly: 149.99,
    annual: 1499.90,
    description: 'Studio-level power for teams.',
    badge: { label: 'Best Value', variant: 'default' },
    borderColor: '#EAB308',
    features: [
      'Unlimited photos & videos',
      'Unlimited message replies',
      'Everything in Expert',
      'CRM — unlimited records',
      'LensTrybe Deliver — 200GB',
      'Multi-page portfolio website',
      'Custom domain',
      'Team — up to 5 members',
      'Studio profile page',
      'Team performance insights',
      'Elite spotlight on homepage',
      'Unlimited marketplace listings',
    ],
    cta: 'Start with Elite',
    ctaVariant: 'secondary',
  },
]

/** Copied from PricingPage.jsx `styles` (toggle + plan cards only). */
const PRICING_COMPARE_STYLES = {
  toggle: {
    ...GLASS_CARD,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: 'var(--radius-full)',
    padding: '4px',
    width: 'fit-content',
  },
  toggleBtn: (active) => ({
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
    background: GLASS_CARD_GREEN.background,
    color: 'var(--green)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-full)',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    maxWidth: '1280px',
    width: '100%',
  },
  card: (borderColor, hasBadge) => ({
    ...glassCardAccentBorder(borderColor),
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--radius-xl)',
    padding: `${hasBadge ? '44px' : '32px'} 28px 32px`,
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'relative',
    overflow: 'hidden',
  }),
  cardHeader: { display: 'flex', flexDirection: 'column', gap: '8px' },
  tierName: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
  },
  tierDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    lineHeight: 1.5,
  },
  price: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  priceAmount: {
    fontFamily: 'var(--font-display)',
    fontSize: '40px',
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  pricePeriod: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
  },
  annualNote: {
    fontSize: '11px',
    color: 'var(--green)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 500,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    lineHeight: 1.4,
  },
  featureCheck: {
    color: 'var(--green)',
    fontSize: '12px',
    flexShrink: 0,
    marginTop: '1px',
  },
  divider: {
    height: '1px',
    background: 'var(--border-subtle)',
  },
  badgeStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    background: 'var(--green)',
    color: '#000000',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textAlign: 'center',
    padding: '6px 0',
    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
    fontFamily: 'var(--font-ui)',
  },
  /** Matches Button.jsx primary / secondary used on PricingPage CTAs. */
  upgradeLink: (ctaVariant) => ({
    fontFamily: 'var(--font-ui)',
    fontWeight: 500,
    borderRadius: 'var(--radius-lg)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '13px',
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    outline: 'none',
    textDecoration: 'none',
    width: '100%',
    boxSizing: 'border-box',
    ...(ctaVariant === 'primary'
      ? { background: 'var(--green)', color: '#000000', border: 'none' }
      : {
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-strong)',
        }),
  }),
}

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('subscription')
  const [showCancel, setShowCancel] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [cancelStep, setCancelStep] = useState(1)
  const [deleteStep, setDeleteStep] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [exitReason, setExitReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentEmailInput, setCurrentEmailInput] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)
  const [pricingAnnual, setPricingAnnual] = useState(true)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const tierColors = { basic: 'var(--text-muted)', pro: 'var(--green)', expert: 'var(--silver)', elite: '#EAB308' }
  const tierColor = tierColors[tier] ?? 'var(--text-muted)'

  const EXIT_REASONS = [
    'Too expensive',
    'Not getting enough enquiries',
    'Missing a feature I need',
    'Using a different platform',
    'Temporary break — I will be back',
    'Other',
  ]

  async function openBillingPortal() {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-portal', {
        body: {
          userId: user.id,
          email: user.email,
          name: profile?.business_name ?? user.email,
          returnUrl: 'https://lenstrybe.com/dashboard/settings',
        },
      })
      console.log('Portal response:', data, error)
      if (data?.url) {
        window.location.href = data.url
      } else {
        alert('Error: ' + (data?.error ?? JSON.stringify(data) ?? error?.message ?? 'Unknown'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function cancelSubscription() {
    setLoading(true)
    await supabase.functions.invoke('cancel-subscription', {
      body: { userId: user.id, reason: exitReason }
    })
    setShowCancel(false)
    setCancelStep(1)
    setLoading(false)
    navigate('/dashboard')
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setLoading(true)
    await supabase.functions.invoke('delete-account', {
      body: { userId: user.id }
    })
    await supabase.auth.signOut()
    navigate('/')
    setLoading(false)
  }

  async function updateEmail() {
    if (String(currentEmailInput || '').trim().toLowerCase() !== String(user?.email || '').trim().toLowerCase()) {
      setEmailMsg({ text: "That doesn't match your current email address.", error: true })
      return
    }
    if (!newEmail || !newEmail.includes('@')) { setEmailMsg({ text: 'Please enter a valid email.', error: true }); return }
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      setEmailMsg({ text: error.message, error: true })
    } else {
      setEmailMsg({ text: 'Confirmation sent to your new email address. Click the link to confirm the change.', error: false })
      setCurrentEmailInput('')
      setNewEmail('')
    }
    setEmailLoading(false)
  }

  function maskEmail(email) {
    const raw = String(email || '').trim()
    const at = raw.indexOf('@')
    if (at <= 0) return raw
    const local = raw.slice(0, at)
    const domain = raw.slice(at)
    const visible = local.slice(0, 2)
    const maskedCount = Math.max(local.length - 2, 1)
    return `${visible}${'*'.repeat(maskedCount)}${domain}`
  }

  function getPricingComparePrice(pt) {
    if (pt.monthly === 0) return 'Free'
    const amount = pricingAnnual ? pt.annual.toFixed(2) : pt.monthly.toFixed(2)
    return `$${amount}`
  }

  function getPricingComparePeriod(pt) {
    if (pt.monthly === 0) return ''
    return pricingAnnual ? '/yr' : '/mo'
  }

  function getPricingAnnualMeta(pt) {
    if (pt.monthly === 0 || !pricingAnnual) return null
    const monthlyEquivalent = (pt.annual / 12).toFixed(2)
    const saving = (pt.monthly * 12 - pt.annual).toFixed(0)
    return `$${monthlyEquivalent}/mo · Save $${saving}/yr`
  }

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { ...TYPO.body, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tabs: { display: 'flex', ...GLASS_CARD, borderRadius: 'var(--radius-lg)', overflow: 'hidden', width: 'fit-content' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400 }),
    card: { ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
    sectionTitle: { ...TYPO.heading, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    sectionSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    tierCard: { ...glassCardAccentBorder(tierColor), borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
    tierName: { fontFamily: 'var(--font-display)', fontSize: '28px', color: tierColor, fontWeight: 400 },
    tierSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    dangerCard: { background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    dangerTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--error)', fontFamily: 'var(--font-ui)' },
    dangerText: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
    stepTitle: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', fontWeight: 400 },
    stepText: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7 },
    reasonOption: (selected) => ({ padding: '12px 16px', borderRadius: 'var(--radius-lg)', border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`, background: selected ? 'var(--green-dim)' : 'var(--bg-subtle)', cursor: 'pointer', fontSize: '13px', color: selected ? 'var(--green)' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)', transition: 'all var(--transition-fast)' }),
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    featureList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    featureItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    plansSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
  }

  const tierFeatures = {
    basic: ['Public profile', '5 portfolio photos', '5 message replies/month'],
    pro: ['20 portfolio photos', '20 message replies', 'Invoicing & quotes', 'Booking system'],
    expert: ['40 portfolio photos', 'Unlimited messages', 'Contracts', 'CRM', 'Brand kit', 'Deliver 50GB', 'Insights'],
    elite: ['Unlimited everything', 'Team members', 'Studio profile', 'Elite spotlight', 'Deliver 200GB'],
  }

  return (
    <div style={{ ...styles.page, padding: isMobile ? '16px' : styles.page.padding, overflowX: 'hidden' }} className="settings-page">
      <style>{`
        @media (max-width: 767px) {
          .settings-page { padding: 16px !important; }
          .settings-page h1, .settings-page h2 { font-size: 24px !important; }
          .settings-page button { min-height: 44px; }
          .settings-page input, .settings-page textarea, .settings-page select { width: 100% !important; font-size: 14px !important; }
          .settings-page [style*="grid-template-columns: repeat(4, 1fr)"] { grid-template-columns: 1fr !important; }
          .settings-page [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Manage your subscription, password and account.</p>
      </div>

      <div style={styles.tabs}>
        {['subscription', 'password', 'danger'].map(t => (
          <button key={t} style={styles.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t === 'danger' ? 'Danger Zone' : (t === 'password' ? 'Email & Password' : t.charAt(0).toUpperCase() + t.slice(1))}
          </button>
        ))}
      </div>

      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.tierCard}>
            <div>
              <div style={styles.tierName}>{tier.charAt(0).toUpperCase() + tier.slice(1)} Plan</div>
              <div style={styles.tierSub}>
                {tier === 'basic' ? 'Free forever' : 'Billed monthly or annually'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {tier !== 'elite' && (
                <Button variant="primary" size="sm" onClick={() => navigate('/pricing')}>Upgrade Plan</Button>
              )}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>What's included in your plan</div>
            <div style={styles.featureList}>
              {(tierFeatures[tier] ?? []).map((f, i) => (
                <div key={i} style={styles.featureItem}>
                  <span style={{ color: 'var(--green)', fontSize: '12px' }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            {tier !== 'elite' && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/pricing')}>
                See full feature comparison →
              </Button>
            )}
          </div>

          {tier !== 'basic' && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.sectionTitle}>Billing</div>
                  <div style={styles.sectionSub}>Manage your payment method, invoices and billing details.</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void openBillingPortal()}
                    style={{ padding: '9px 18px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? 'Loading…' : 'Manage Billing'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/settings/subscription')}
                    style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                  >
                    Change Plan
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={styles.plansSection}>
            <div style={styles.sectionTitle}>Compare plans</div>
            <div style={PRICING_COMPARE_STYLES.toggle}>
              <button type="button" style={PRICING_COMPARE_STYLES.toggleBtn(!pricingAnnual)} onClick={() => setPricingAnnual(false)}>
                Monthly
              </button>
              <button type="button" style={PRICING_COMPARE_STYLES.toggleBtn(pricingAnnual)} onClick={() => setPricingAnnual(true)}>
                Annual
                <span style={PRICING_COMPARE_STYLES.saveBadge}>2 months free</span>
              </button>
            </div>
            <div style={PRICING_COMPARE_STYLES.grid}>
              {PRICING_PAGE_TIERS.map((pt, i) => {
                const planKey = pt.name.toLowerCase()
                const planRank = SUBSCRIPTION_PLAN_ORDER[planKey] ?? 0
                const currentRank = SUBSCRIPTION_PLAN_ORDER[tier] ?? 0
                const isCurrent = planKey === tier
                const showUpgrade = planRank > currentRank
                return (
                  <div key={i} style={PRICING_COMPARE_STYLES.card(pt.borderColor, !!pt.badge)}>
                    {pt.badge && (
                      <div style={PRICING_COMPARE_STYLES.badgeStrip}>
                        {pt.badge.label}
                      </div>
                    )}

                    <div style={PRICING_COMPARE_STYLES.cardHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={PRICING_COMPARE_STYLES.tierName}>{pt.name}</div>
                        {isCurrent && (
                          <Badge variant="green" size="sm">Current Plan</Badge>
                        )}
                      </div>
                      <div style={PRICING_COMPARE_STYLES.tierDesc}>{pt.description}</div>
                    </div>

                    <div>
                      <div style={PRICING_COMPARE_STYLES.price}>
                        <span style={PRICING_COMPARE_STYLES.priceAmount}>{getPricingComparePrice(pt)}</span>
                        {pt.monthly > 0 && <span style={PRICING_COMPARE_STYLES.pricePeriod}>{getPricingComparePeriod(pt)}</span>}
                      </div>
                      {pricingAnnual && pt.monthly > 0 && (
                        <div style={PRICING_COMPARE_STYLES.annualNote}>{getPricingAnnualMeta(pt)}</div>
                      )}
                    </div>

                    <div style={PRICING_COMPARE_STYLES.divider} />

                    <div style={PRICING_COMPARE_STYLES.featureList}>
                      {pt.features.map((f, j) => (
                        <div key={j} style={PRICING_COMPARE_STYLES.featureItem}>
                          <span style={PRICING_COMPARE_STYLES.featureCheck}>✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    {showUpgrade && (
                      <Link to="/pricing" style={PRICING_COMPARE_STYLES.upgradeLink(pt.ctaVariant)}>
                        Upgrade
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'password' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...GLASS_CARD, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Update Email</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>A confirmation link will be sent to your new email address.</div>
            {emailMsg && (
              <div style={{ fontSize: '13px', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: emailMsg.error ? 'rgba(239,68,68,0.1)' : 'rgba(29,185,84,0.1)', color: emailMsg.error ? '#ef4444' : '#1DB954' }}>
                {emailMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                value={currentEmailInput}
                onChange={e => setCurrentEmailInput(e.target.value)}
                placeholder="Current email"
                type="email"
                style={{ flex: 1, padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="New email address"
                type="email"
                style={{ flex: 1, padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' }}
              />
              <button
                onClick={updateEmail}
                disabled={emailLoading}
                style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: emailLoading ? 0.6 : 1 }}
              >
                {emailLoading ? 'Sending…' : 'Update Email'}
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Change Password</div>
            <div style={styles.sectionSub}>Send a password reset link to your email address.</div>
            <div style={styles.row}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                {maskEmail(user?.email)}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await supabase.auth.resetPasswordForEmail(user.email)
                  alert('Password reset email sent. Check your inbox.')
                }}
              >
                Send Reset Email
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tier !== 'basic' && (
            <div style={styles.dangerCard}>
              <div style={styles.dangerTitle}>Cancel Subscription</div>
              <div style={styles.dangerText}>
                Cancel your subscription and downgrade to Basic. You keep access until the end of your current billing period.
              </div>
              <div>
                <Button variant="secondary" size="sm" onClick={() => { setShowCancel(true); setCancelStep(1) }}>
                  Cancel Subscription
                </Button>
              </div>
            </div>
          )}

          <div style={styles.dangerCard}>
            <div style={styles.dangerTitle}>Delete Account</div>
            <div style={styles.dangerText}>
              Permanently delete your account. Your profile is removed from search immediately. All data is deleted after 30 days. This cannot be undone.
            </div>
            <div>
              <Button variant="danger" size="sm" onClick={() => { setShowDelete(true); setDeleteStep(1) }}>
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      <Modal isOpen={showCancel} onClose={() => { setShowCancel(false); setCancelStep(1) }} title="Cancel Subscription" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {cancelStep === 1 && (
            <>
              <div style={styles.stepTitle}>What you'll lose</div>
              <div style={styles.featureList}>
                {(tierFeatures[tier] ?? []).map((f, i) => (
                  <div key={i} style={{ ...styles.featureItem, color: 'var(--error)' }}>
                    <span style={{ color: 'var(--error)', fontSize: '12px' }}>✗</span>
                    {f}
                  </div>
                ))}
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowCancel(false)}>Keep My Plan</Button>
                <Button variant="secondary" onClick={() => setCancelStep(2)}>Continue to Cancel →</Button>
              </div>
            </>
          )}
          {cancelStep === 2 && (
            <>
              <div style={styles.stepTitle}>Downgrade to Basic instead?</div>
              <div style={styles.stepText}>
                Basic is free and keeps your profile live. You lose business tools but stay discoverable to clients.
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setCancelStep(3)}>No, cancel my subscription</Button>
                <Button variant="primary" onClick={async () => {
                  await supabase.from('profiles').update({ subscription_tier: 'basic' }).eq('id', user.id)
                  setShowCancel(false)
                }}>Downgrade to Basic</Button>
              </div>
            </>
          )}
          {cancelStep === 3 && (
            <>
              <div style={styles.stepTitle}>Why are you leaving?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {EXIT_REASONS.map(r => (
                  <div key={r} style={styles.reasonOption(exitReason === r)} onClick={() => setExitReason(r)}>{r}</div>
                ))}
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowCancel(false)}>Keep My Plan</Button>
                <Button variant="danger" disabled={loading} onClick={cancelSubscription}>
                  {loading ? 'Cancelling…' : 'Confirm Cancellation'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDelete} onClose={() => { setShowDelete(false); setDeleteStep(1); setDeleteConfirm('') }} title="Delete Account" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {deleteStep === 1 && (
            <>
              <div style={styles.stepTitle}>Are you sure?</div>
              <div style={styles.stepText}>
                Deleting your account will immediately remove your profile from search results. All your data — portfolio, invoices, messages, reviews — will be permanently deleted after 30 days. You have a 30-day window to reactivate.
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
                <Button variant="danger" onClick={() => setDeleteStep(2)}>I understand, continue →</Button>
              </div>
            </>
          )}
          {deleteStep === 2 && (
            <>
              <div style={styles.stepTitle}>Type DELETE to confirm</div>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
              />
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
                <Button variant="danger" disabled={deleteConfirm !== 'DELETE' || loading} onClick={deleteAccount}>
                  {loading ? 'Deleting…' : 'Delete My Account'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
