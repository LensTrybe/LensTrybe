import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const FOUNDING_CAP = 500
const OFFER_END = new Date('2026-12-31T23:59:59+11:00')

const tiers = [
  {
    name: 'Basic',
    monthly: 0,
    annual: 0,
    description: 'Get discovered. Build your presence.',
    badge: null,
    borderColor: 'rgba(255,255,255,0.12)',
    features: [
      '5 portfolio photos',
      'Public profile listing',
      '5 message replies/month',
      'Gear marketplace access',
      'Basic search placement',
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Pro',
    monthly: 24.99,
    annual: 249.90,
    description: 'Start booking clients professionally.',
    badge: null,
    borderColor: 'rgba(29,185,84,0.5)',
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
  },
  {
    name: 'Expert',
    monthly: 74.99,
    annual: 749.90,
    description: 'Full business tools for serious creatives.',
    badge: { label: 'Most Popular', variant: 'green' },
    borderColor: 'rgba(192,200,216,0.5)',
    features: [
      '40 photos, 5 videos',
      'Unlimited message replies',
      'Custom contracts & e-signatures',
      'CRM: 500 client records',
      'Client portals',
      'Brand kit',
      'Portfolio website',
      'LensTrybe Deliver: 50GB',
      'Business insights',
      'Homepage rotation',
      'Gear marketplace listings (15)',
    ],
    cta: 'Start with Expert',
    foundingCta: 'Claim your spot',
  },
  {
    name: 'Elite',
    monthly: 149.99,
    annual: 1499.90,
    description: 'Studio-level power for teams.',
    badge: { label: 'Best Value', variant: 'default' },
    borderColor: 'rgba(234,179,8,0.5)',
    features: [
      'Unlimited photos & videos',
      'Unlimited message replies',
      'Everything in Expert',
      'CRM: unlimited records',
      'LensTrybe Deliver: 200GB',
      'Multi-page portfolio website',
      'Custom domain',
      'Team: up to 5 members',
      'Studio profile page',
      'Team performance insights',
      'Elite spotlight on homepage',
      'Unlimited marketplace listings',
    ],
    cta: 'Start with Elite',
  },
]

export default function PricingPage() {
  const navigate = useNavigate()
  const [annual, setAnnual] = useState(false)
  const [foundingCount, setFoundingCount] = useState(0)
  const [countLoading, setCountLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  const currentInterval = annual ? 'annual' : 'monthly'
  const offerActive = foundingCount < FOUNDING_CAP && new Date() < OFFER_END

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    async function fetchCount() {
      const { data, error } = await supabase.rpc('get_founding_member_count')
      if (!error && typeof data === 'number') {
        setFoundingCount(data)
      }
      setCountLoading(false)
    }

    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [])

  const font = 'Inter, sans-serif'

  function getPrice(tier) {
    if (tier.monthly === 0) return 'Free'
    const amount = annual ? tier.annual.toFixed(2) : tier.monthly.toFixed(2)
    return `$${amount}`
  }

  function getPricePeriod(tier) {
    if (tier.monthly === 0) return ''
    return annual ? '/yr' : '/mo'
  }

  function getStrikethroughPrice(tier) {
    const amount = annual ? tier.annual.toFixed(2) : tier.monthly.toFixed(2)
    return `$${amount}${annual ? '/yr' : '/mo'}`
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

  function handleCta(tier) {
    const planId = tier.name.toLowerCase()
    if (tier.monthly === 0) {
      navigate('/join')
      return
    }
    if (planId === 'expert' && offerActive) {
      navigate(`/signup?plan=expert&founding=1&interval=${currentInterval}`)
      return
    }
    navigate(`/join/creative?plan=${planId}`)
  }

  function renderExpertFoundingPrice(tier) {
    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: '48px',
            fontWeight: 800,
            color: '#f59e0b',
            fontFamily: font,
            lineHeight: 1,
          }}>
            FREE
          </span>
          <span style={{
            fontSize: '18px',
            color: '#8b8a9a',
            textDecoration: 'line-through',
            fontFamily: font,
          }}>
            {getStrikethroughPrice(tier)}
          </span>
        </div>
        <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: '13px', fontFamily: font, marginTop: '8px' }}>
          Free until 31 December 2026
        </div>
        <div style={{ color: '#8b8a9a', fontSize: '12px', fontFamily: font, marginTop: '4px' }}>
          Then $74.99/month (or $749.90/year) from 1 Jan 2027
        </div>
        <div style={{ marginTop: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            gap: '12px',
          }}>
            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '13px', fontFamily: font }}>
              {FOUNDING_CAP - foundingCount} spots remaining
            </span>
            <span style={{ color: '#8b8a9a', fontSize: '12px', fontFamily: font }}>
              {foundingCount} of {FOUNDING_CAP} claimed
            </span>
          </div>
          <div style={{
            height: '4px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(foundingCount / FOUNDING_CAP) * 100}%`,
              background: 'linear-gradient(90deg, #f59e0b, #d97706)',
              borderRadius: '2px',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'transparent',
      minHeight: '100vh',
      paddingBottom: '80px',
      overflowX: 'hidden',
      fontFamily: font,
    }}>
      <div style={{
        padding: isMobile ? '48px 16px 32px' : '80px 40px 48px',
        maxWidth: '1280px',
        margin: '0 auto',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#8b8a9a',
          fontFamily: font,
        }}>
          Pricing
        </div>
        <h1 style={{
          fontFamily: font,
          fontSize: isMobile ? 'clamp(24px, 9vw, 34px)' : 'clamp(36px, 5vw, 56px)',
          fontWeight: 700,
          color: '#ffffff',
          maxWidth: '600px',
          margin: 0,
          lineHeight: 1.15,
        }}>
          Simple, transparent pricing.
        </h1>
        <p style={{
          fontSize: '17px',
          color: '#8b8a9a',
          maxWidth: '480px',
          margin: 0,
          lineHeight: 1.5,
        }}>
          No commissions. No lead fees. Just a flat subscription that pays for itself with one booking.
        </p>

        {offerActive && (
          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: '12px',
            padding: '10px 20px',
            color: '#f59e0b',
            fontWeight: 600,
            fontSize: '14px',
            fontFamily: font,
            maxWidth: '560px',
          }}>
            ⭐ Founding member offer: Expert plan free until 31 December 2026
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '999px',
          padding: '4px',
          margin: '0 auto',
        }}>
          <button
            type="button"
            style={{
              padding: '6px 20px',
              borderRadius: '999px',
              border: 'none',
              background: !annual ? '#1DB954' : 'transparent',
              color: !annual ? '#000' : '#8b8a9a',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: font,
            }}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            style={{
              padding: '6px 20px',
              borderRadius: '999px',
              border: 'none',
              background: annual ? '#1DB954' : 'transparent',
              color: annual ? '#000' : '#8b8a9a',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: font,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setAnnual(true)}
          >
            Annual
            <span style={{
              fontSize: '10px',
              background: 'rgba(29,185,84,0.15)',
              color: '#1DB954',
              padding: '2px 6px',
              borderRadius: '999px',
              fontWeight: 600,
            }}>
              2 months free
            </span>
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
        gap: '16px',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: isMobile ? '0 16px' : '0 40px',
        alignItems: 'stretch',
      }}>
        {tiers.map((tier) => {
          const isExpert = tier.name === 'Expert'
          const isFoundingExpert = isExpert && offerActive
          const showGreenBadge = tier.badge && !(isExpert && offerActive)

          const cardStyle = isFoundingExpert
            ? {
                background: 'linear-gradient(160deg, #1a1508 0%, #0f0f0a 100%)',
                border: '1px solid rgba(245,158,11,0.45)',
                boxShadow: '0 0 40px rgba(245,158,11,0.12)',
              }
            : {
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${tier.borderColor}`,
                boxShadow: 'none',
              }

          return (
            <div
              key={tier.name}
              style={{
                ...cardStyle,
                borderRadius: '16px',
                padding: `${showGreenBadge || isFoundingExpert ? (isMobile ? '40px' : '44px') : (isMobile ? '24px' : '32px')} ${isMobile ? '20px' : '28px'} ${isMobile ? '24px' : '32px'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                position: 'relative',
                overflow: 'visible',
                height: '100%',
                boxSizing: 'border-box',
              }}
            >
              {isFoundingExpert && (
                <div style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  borderRadius: '20px',
                  padding: '4px 14px',
                  boxShadow: '0 0 16px rgba(245,158,11,0.5)',
                  fontFamily: font,
                  whiteSpace: 'nowrap',
                }}>
                  Founding Member
                </div>
              )}

              {showGreenBadge && tier.badge.variant === 'green' && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  background: '#1DB954',
                  color: '#000',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  padding: '6px 0',
                  borderRadius: '16px 16px 0 0',
                  fontFamily: font,
                }}>
                  {tier.badge.label}
                </div>
              )}

              {showGreenBadge && tier.badge.variant !== 'green' && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  padding: '6px 0',
                  borderRadius: '16px 16px 0 0',
                  fontFamily: font,
                }}>
                  {tier.badge.label}
                </div>
              )}

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                flexShrink: 0,
                minHeight: isMobile ? undefined : '200px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '18px', color: '#ffffff', fontWeight: 600, fontFamily: font }}>
                    {tier.name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#8b8a9a', fontFamily: font }}>
                    {tier.description}
                  </div>
                </div>

                <div>
                  {isFoundingExpert ? (
                    renderExpertFoundingPrice(tier)
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{
                          fontFamily: font,
                          fontSize: '40px',
                          fontWeight: 700,
                          color: '#ffffff',
                          lineHeight: 1,
                        }}>
                          {getPrice(tier)}
                        </span>
                        {tier.monthly > 0 && (
                          <span style={{ fontSize: '14px', color: '#8b8a9a', fontFamily: font }}>
                            {getPricePeriod(tier)}
                          </span>
                        )}
                      </div>
                      {annual && tier.monthly > 0 && (
                        <div style={{
                          fontSize: '11px',
                          color: '#1DB954',
                          fontFamily: font,
                          fontWeight: 500,
                          marginTop: '6px',
                        }}>
                          {getAnnualMonthlyEquivalent(tier)}/mo and {getAnnualSaving(tier)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                }} />
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                flex: 1,
                minHeight: 0,
              }}>
                {tier.features.map((f) => (
                  <div key={f} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '14px',
                    color: '#8b8a9a',
                    fontFamily: font,
                  }}>
                    <span style={{
                      color: isFoundingExpert ? '#f59e0b' : '#1DB954',
                      fontSize: '12px',
                      flexShrink: 0,
                      marginTop: '1px',
                    }}>
                      ✓
                    </span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleCta(tier)}
                style={{
                  minHeight: '44px',
                  marginTop: 'auto',
                  width: '100%',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: font,
                  ...(isFoundingExpert
                    ? {
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#000',
                      }
                    : tier.name === 'Pro'
                      ? {
                          background: '#1DB954',
                          color: '#000',
                        }
                      : {
                          background: 'rgba(255,255,255,0.1)',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.15)',
                        }),
                }}
              >
                {isFoundingExpert ? tier.foundingCta : tier.cta}
              </button>

              {isFoundingExpert && (
                <p style={{
                  color: '#8b8a9a',
                  fontSize: '12px',
                  textAlign: 'center',
                  margin: '-12px 0 0',
                  fontFamily: font,
                }}>
                  Card required. No charge until 1 Jan 2027.
                </p>
              )}
            </div>
          )
        })}
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
          <div style={{ fontSize: '15px', color: '#1DB954', marginBottom: 6, fontFamily: font, fontWeight: 600 }}>
            No payments until July 1st, 2026
          </div>
          <div style={{ fontSize: '13px', color: '#8b8a9a', fontFamily: font, lineHeight: 1.5 }}>
            Sign up today and enjoy full access completely free until our public launch. All paid plans also include a 14-day free trial. Your card will never be charged early.
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          color: '#8b8a9a',
          marginTop: 20,
          fontFamily: font,
        }}>
          All prices in AUD. Annual billing saves 2 months. Cancel anytime from your dashboard.
        </div>
      </div>
    </div>
  )
}
