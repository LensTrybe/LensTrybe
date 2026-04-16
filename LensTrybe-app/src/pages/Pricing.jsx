import React, { useMemo, useState } from 'react'
import PublicNavbar from '../components/public/PublicNavbar.jsx'
import PricingCards from '../components/PricingCards.jsx'

export default function Pricing() {
  const BRAND = useMemo(
    () => ({
      bg: '#080810',
      border: '#1a1a2e',
      muted: '#888',
      text: '#fff',
      green: '#4ADE80',
    }),
    [],
  )

  const [billing, setBilling] = useState('annual') // default Annual

  const pill = (active) => ({
    background: active ? BRAND.green : 'transparent',
    color: active ? '#000' : '#bbb',
    border: active ? 'none' : `1px solid ${BRAND.border}`,
    borderRadius: 999,
    padding: '10px 18px',
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer',
    minWidth: 110,
    textAlign: 'center',
    fontFamily: 'Inter, sans-serif',
  })

  return (
    <div
      style={{
        background: BRAND.bg,
        minHeight: '100vh',
        boxSizing: 'border-box',
        fontFamily: 'Inter, sans-serif',
        color: '#fff',
      }}
    >
      <PublicNavbar />
      <div style={{ padding: '96px 32px 60px', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ textAlign: 'center', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.8px' }}>Subscription Pricing</div>
        <div style={{ color: BRAND.muted, fontSize: 16, marginTop: 10 }}>Choose the plan that fits your creative journey</div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 26 }}>
          <button type="button" onClick={() => setBilling('monthly')} style={pill(billing === 'monthly')}>
            Monthly
          </button>
          <button type="button" onClick={() => setBilling('annual')} style={pill(billing === 'annual')}>
            Annual
          </button>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: '34px auto 0',
        }}
      >
        <PricingCards billing={billing} mode="pricing" />
      </div>
      </div>
    </div>
  )
}

