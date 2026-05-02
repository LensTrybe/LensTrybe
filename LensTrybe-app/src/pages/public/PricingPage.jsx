import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

const tiers = [
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

export default function PricingPage() {
  const navigate = useNavigate()
  const [annual, setAnnual] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const styles = {
    page: { background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: '80px', overflowX: 'hidden' },
    header: {
      padding: isMobile ? '48px 16px 32px' : '80px 40px 48px',
      maxWidth: '1280px',
      margin: '0 auto',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
    },
    eyebrow: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)',
    },
    title: {
      fontFamily: 'var(--font-display)',
      fontSize: isMobile ? 'clamp(24px, 9vw, 34px)' : 'clamp(36px, 5vw, 56px)',
      color: 'var(--text-primary)',
      fontWeight: 400,
      maxWidth: '600px',
    },
    subtitle: {
      fontSize: '17px',
      color: 'var(--text-secondary)',
      maxWidth: '480px',
      lineHeight: 1.7,
      fontFamily: 'var(--font-ui)',
    },
    toggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-full)',
      padding: '4px',
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
      background: 'var(--green-dim)',
      color: 'var(--green)',
      padding: '2px 6px',
      borderRadius: 'var(--radius-full)',
      fontWeight: 600,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
      gap: '16px',
      maxWidth: '1280px',
      margin: '0 auto',
      padding: isMobile ? '0 16px' : '0 40px',
    },
    card: (borderColor, hasBadge) => ({
      background: 'var(--bg-elevated)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-xl)',
      padding: `${hasBadge ? (isMobile ? '40px' : '44px') : (isMobile ? '24px' : '32px')} ${isMobile ? '20px' : '28px'} ${isMobile ? '24px' : '32px'}`,
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
      fontSize: '14px',
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
      fontFamily: "'Playfair Display', serif",
      fontSize: '40px',
      color: 'var(--text-primary)',
      lineHeight: 1,
    },
    pricePeriod: {
      fontSize: '14px',
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
      fontSize: '14px',
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
  }

  function getPrice(tier) {
    if (tier.monthly === 0) return 'Free'
    const amount = annual ? tier.annual.toFixed(2) : tier.monthly.toFixed(2)
    return `$${amount}`
  }

  function getPricePeriod(tier) {
    if (tier.monthly === 0) return ''
    return annual ? '/yr' : '/mo'
  }

  function getAnnualMonthlyEquivalent(tier) {
    if (tier.monthly === 0) return null
    return `$${(tier.annual / 12).toFixed(2)}`
  }

  function getAnnualSaving(tier) {
    if (tier.monthly === 0) return null
    const saving = (tier.monthly * 12 - tier.annual).toFixed(0)
    return `Save $${saving}/yr`
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.eyebrow}>Pricing</div>
        <h1 style={styles.title}>Simple, transparent pricing.</h1>
        <p style={styles.subtitle}>
          No commissions. No lead fees. Just a flat subscription that pays for itself with one booking.
        </p>

        <div style={{ ...styles.toggle, margin: '0 auto' }}>
          <button style={styles.toggleBtn(!annual)} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button style={styles.toggleBtn(annual)} onClick={() => setAnnual(true)}>
            Annual
            <span style={styles.saveBadge}>2 months free</span>
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {tiers.map((tier, i) => (
          <div key={i} style={styles.card(tier.borderColor, !!tier.badge)}>
            {tier.badge && (
              <div style={{
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
              }}>
                {tier.badge.label}
              </div>
            )}

            <div style={styles.cardHeader}>
              <div style={styles.tierName}>{tier.name}</div>
              <div style={styles.tierDesc}>{tier.description}</div>
            </div>

            <div>
              <div style={styles.price}>
                <span style={styles.priceAmount}>{getPrice(tier)}</span>
                {tier.monthly > 0 && <span style={styles.pricePeriod}>{getPricePeriod(tier)}</span>}
              </div>
              {annual && tier.monthly > 0 && (
                <div style={styles.annualNote}>{getAnnualMonthlyEquivalent(tier)}/mo and {getAnnualSaving(tier)}</div>
              )}
            </div>

            <div style={styles.divider} />

            <div style={styles.featureList}>
              {tier.features.map((f, j) => (
                <div key={j} style={styles.featureItem}>
                  <span style={styles.featureCheck}>✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <Button
              variant={tier.ctaVariant}
              size="md"
              style={{ minHeight: '44px' }}
              onClick={() => navigate(tier.monthly === 0 ? '/join' : `/join/creative?plan=${tier.name.toLowerCase()}`)}
            >
              {tier.cta}
            </Button>
          </div>
        ))}
      </div>

      <div style={{
        maxWidth: '800px',
        margin: '32px auto 0',
        padding: isMobile ? '0 16px' : '0 40px',
      }}>
        <div style={{
          background: 'rgba(29,185,84,0.08)',
          border: '1px solid rgba(29,185,84,0.25)',
          borderRadius: '12px',
          padding: '20px 28px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1DB954', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
            🎉 No payments until July 1st, 2026
          </div>
          <div style={{ fontSize: '13px', color: '#8b8a9a', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
            Sign up today and enjoy full access completely free until our public launch. All paid plans also include a 14-day free trial — your card will never be charged early.
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 20 }}>
          All prices in AUD. Annual billing saves 2 months. Cancel anytime from your dashboard.
        </div>
      </div>
    </div>
  )
}
