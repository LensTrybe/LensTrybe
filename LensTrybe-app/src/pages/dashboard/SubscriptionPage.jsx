import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 0,
    annualPrice: 0,
    priceIdMonthly: null,
    priceIdAnnual: null,
    color: '#6b7280',
    features: ['Public profile', '5 portfolio photos', '5 message replies/month', 'Gear marketplace access'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 24.99,
    annualPrice: 249.90,
    priceIdMonthly: 'price_1TGVFZHW7LVs8k6sElcIwbzg',
    priceIdAnnual: 'price_1T7V1rHW7LVs8k6sZjddvm2E',
    color: '#1DB954',
    features: ['20 portfolio photos', '1 portfolio video', '20 message replies/month', 'Invoicing & quotes', 'Booking system', 'Review requests'],
  },
  {
    id: 'expert',
    name: 'Expert',
    monthlyPrice: 74.99,
    annualPrice: 749.90,
    priceIdMonthly: 'price_1TGVM3HW7LVs8k6szXy5QvSW',
    priceIdAnnual: 'price_1TJV35HW7LVs8k6s7CU1RBeu',
    color: '#a855f7',
    features: ['40 portfolio photos', '5 portfolio videos', 'Unlimited messages', 'Contracts & CRM', 'Client portal', 'Brand kit', 'LensTrybe Deliver (50GB)', 'Business insights'],
  },
  {
    id: 'elite',
    name: 'Elite',
    monthlyPrice: 149.99,
    annualPrice: 1499.90,
    priceIdMonthly: 'price_1TGVMDHW7LVs8k6sKePKDibF',
    priceIdAnnual: 'price_1TJUfqHW7LVs8k6s0SdahBua',
    color: '#EAB308',
    features: ['Unlimited portfolio', 'Unlimited messages', 'Team members (up to 5)', 'LensTrybe Deliver (200GB)', 'Elite spotlight', 'Multi-page portfolio website', 'Everything in Expert'],
  },
]

export default function SubscriptionPage() {
  const { user, profile } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [billing, setBilling] = useState('monthly')
  const [loading, setLoading] = useState(null)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function selectPlan(plan) {
    if (!user?.id) return
    if (plan.id === tier) return
    if (plan.id === 'basic') {
      // Downgrade to basic — open billing portal to cancel
      setLoading('basic')
      const { data } = await supabase.functions.invoke('create-stripe-portal', {
        body: { userId: user.id, email: user.email, name: profile?.business_name ?? user.email, returnUrl: window.location.href },
      })
      if (data?.url) window.location.href = data.url
      else showToast('Could not open billing portal', 'error')
      setLoading(null)
      return
    }

    // Upgrade/change plan — create checkout session
    setLoading(plan.id)
    const priceId = billing === 'annual' ? plan.priceIdAnnual : plan.priceIdMonthly
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        priceId,
        userId: user.id,
        email: user.email,
        name: profile?.business_name ?? user.email,
        successUrl: 'https://lenstrybe.com/dashboard/settings?upgraded=true',
        cancelUrl: window.location.href,
      },
    })
    if (data?.url) {
      window.location.href = data.url
    } else {
      showToast('Could not start checkout: ' + (error?.message ?? 'Unknown error'), 'error')
    }
    setLoading(null)
  }

  const tierColors = { basic: '#6b7280', pro: '#1DB954', expert: '#a855f7', elite: '#EAB308' }
  const currentColor = tierColors[tier] ?? '#6b7280'

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-ui)' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400, margin: '0 0 8px' }}>Subscription</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Current plan:</span>
          <span style={{ padding: '4px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, background: `${currentColor}22`, border: `1px solid ${currentColor}44`, color: currentColor }}>
            {tier?.charAt(0).toUpperCase() + tier?.slice(1)}
          </span>
        </div>
      </div>

      {/* Billing toggle */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', marginBottom: '32px', width: 'fit-content' }}>
        {['monthly', 'annual'].map(b => (
          <button key={b} type="button" onClick={() => setBilling(b)} style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: billing === b ? 'var(--bg-base)' : 'transparent', color: billing === b ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {b === 'monthly' ? 'Monthly' : 'Annual'}
            {b === 'annual' && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#1DB954', fontWeight: 700 }}>2 months free</span>}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === tier
          const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice
          const isLoading = loading === plan.id

          return (
            <div key={plan.id} style={{ background: 'var(--bg-elevated)', border: `2px solid ${isCurrent ? plan.color : 'var(--border-default)'}`, borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
              {isCurrent && (
                <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', padding: '3px 14px', background: plan.color, borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: plan.id === 'pro' || plan.id === 'elite' ? '#000' : '#fff', whiteSpace: 'nowrap' }}>
                  Current Plan
                </div>
              )}
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: plan.color, marginBottom: '4px' }}>{plan.name}</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {price === 0 ? 'Free' : `$${price}`}
                  {price > 0 && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>/{billing === 'annual' ? 'yr' : 'mo'}</span>}
                </div>
                {billing === 'annual' && price > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>${(price / 12).toFixed(2)}/mo equivalent</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span style={{ color: plan.color, flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void selectPlan(plan)}
                disabled={isCurrent || isLoading}
                style={{
                  padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: isCurrent ? 'default' : 'pointer', fontFamily: 'var(--font-ui)', border: 'none', transition: 'all 0.15s',
                  background: isCurrent ? 'var(--bg-base)' : plan.color,
                  color: isCurrent ? 'var(--text-muted)' : plan.id === 'pro' || plan.id === 'elite' ? '#000' : '#fff',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? 'Loading…' : isCurrent ? 'Current Plan' : plan.id === 'basic' ? 'Downgrade to Free' : tier === 'basic' || PLANS.findIndex(p => p.id === plan.id) > PLANS.findIndex(p => p.id === tier) ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Subscriptions are billed in AUD. Annual plans are paid upfront. You can manage or cancel your subscription at any time.
        {' '}
        <button type="button" onClick={() => navigate('/dashboard/settings')} style={{ background: 'none', border: 'none', color: '#1DB954', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-ui)', padding: 0 }}>Back to Settings</button>
      </div>
    </div>
  )
}
