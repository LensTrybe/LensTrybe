import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser.js'
import { getPriceId, redirectToCheckout } from '../lib/stripe.js'

export default function PricingCards({
  billing,
  selectedTier,
  onSelectTier,
  mode = 'pricing', // 'pricing' | 'signup'
}) {
  const navigate = useNavigate()
  const { user } = useAuthUser()

  const BRAND = useMemo(
    () => ({
      card: '#0f0f18',
      border: '#1a1a2e',
      muted: '#888',
      text: '#fff',
      pink: '#D946EF',
      green: '#4ADE80',
      gold: '#EAB308',
    }),
    [],
  )

  const [expanded, setExpanded] = useState({
    basic: false,
    pro: false,
    expert: false,
    elite: false,
  })

  const [checkoutLoading, setCheckoutLoading] = useState('')

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 980 : false))
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 980)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isAnnual = billing === 'annual'

  const tier = String(selectedTier || '').toLowerCase()

  const cardBase = {
    background: BRAND.card,
    border: `1px solid ${BRAND.border}`,
    borderRadius: 16,
    padding: 26,
    boxSizing: 'border-box',
    color: BRAND.text,
    fontFamily: 'Inter, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  }

  const check = (text) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ color: BRAND.green, fontWeight: 900, lineHeight: '20px' }}>✓</div>
      <div style={{ color: '#cfcfcf', fontSize: 13, lineHeight: 1.55 }}>{text}</div>
    </div>
  )

  const sectionHeading = (label, first) => (
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.12em',
        color: BRAND.muted,
        marginTop: first ? 0 : 16,
        textTransform: 'uppercase',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {label}
    </div>
  )

  const toggleMore = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

  const MoreToggle = ({ k }) => {
    const open = !!expanded[k]
    return (
      <button
        type="button"
        onClick={() => toggleMore(k)}
        style={{
          marginTop: 14,
          background: 'none',
          border: 'none',
          color: BRAND.muted,
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 900,
          fontSize: 12,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <span style={{ color: BRAND.pink }}>{open ? 'Hide features' : 'See all features'}</span>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
            color: BRAND.muted,
          }}
        >
          ▾
        </span>
      </button>
    )
  }

  const Expand = ({ k, children }) => {
    const open = !!expanded[k]
    return (
      <div
        style={{
          maxHeight: open ? 4000 : 0,
          overflow: 'hidden',
          transition: 'max-height 280ms ease',
          marginTop: open ? 14 : 0,
        }}
        aria-hidden={!open}
      >
        <div style={{ display: 'grid', gap: 10 }}>{children}</div>
      </div>
    )
  }

  const Price = ({ main, sub }) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.5px' }}>{main}</div>
      {sub ? <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 6 }}>{sub}</div> : null}
    </div>
  )

  const BadgeRow = ({ badges }) => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
      {badges.map((b) => (
        <span
          key={b}
          style={{
            background: '#1e2a1e',
            border: `1px solid ${BRAND.green}`,
            color: BRAND.green,
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
        >
          {b}
        </span>
      ))}
    </div>
  )

  const selectedPill = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#1e2a1e',
        border: `1px solid ${BRAND.green}`,
        color: BRAND.green,
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      ✓ Selected
    </div>
  )

  const basicSelected = tier === 'basic'
  const proSelected = tier === 'pro'
  const expertSelected = tier === 'expert'
  const eliteSelected = tier === 'elite'

  const startCheckout = async (t) => {
    if (mode !== 'pricing') return
    if (!user) {
      navigate('/join')
      return
    }
    const priceId = getPriceId(t, billing)
    if (!priceId) return
    setCheckoutLoading(String(t))
    try {
      await redirectToCheckout(priceId, user)
    } catch (e) {
      alert(e?.message || 'Checkout failed.')
      setCheckoutLoading('')
    }
  }

  const selectPaidTier = (t) => {
    if (mode === 'signup') {
      onSelectTier?.(t)
      return
    }
    startCheckout(t)
  }

  const BasicCard = () => (
    <div style={{ ...cardBase, border: basicSelected ? `2px solid ${BRAND.green}` : cardBase.border }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>Basic</div>
      <Price main="Free" sub="" />
      <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 10 }}>
        Get your profile live and start getting discovered. No credit card required, ever.
      </div>

      <button
        type="button"
        onClick={() => {
          if (mode === 'signup') {
            onSelectTier?.('basic')
            return
          }
          if (user) navigate('/dashboard')
          else navigate('/join')
        }}
        style={{
          marginTop: 18,
          width: '100%',
          background: '#f2f2f2',
          border: 'none',
          color: '#000',
          fontWeight: 900,
          borderRadius: 10,
          padding: '12px 14px',
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Get Started Free
      </button>

      <div style={{ marginTop: 12 }}>{basicSelected ? selectedPill : null}</div>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {check('Public creative profile')}
        {check('5 portfolio photos, no video')}
        {check('5 message replies/month')}
        {check('Availability calendar')}
      </div>

      <MoreToggle k="basic" />
      <Expand k="basic">
        {sectionHeading('PROFILE & DISCOVERY', true)}
        {check('Public creative profile')}
        {check('5 portfolio photos, no video')}
        {check('1 skill type active')}
        {check('City-level location (50km radius)')}
        {check('Credentials badges (ABN, Insurance, Blue Card, etc.)')}
        {sectionHeading('MESSAGING & REPLIES')}
        {check('5 client message replies/month')}
        {sectionHeading('MARKETPLACE')}
        {check('Browse gear marketplace (view only)')}
        {check('Browse job board (view only)')}
      </Expand>
    </div>
  )

  const ProCard = () => (
    <div style={{ ...cardBase, border: proSelected ? `2px solid ${BRAND.pink}` : `1px solid ${BRAND.pink}` }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>Pro</div>
      {isAnnual ? <Price main="A$249.90/yr" sub="A$20.83/mo" /> : <Price main="A$24.99/mo" sub="" />}
      <BadgeRow badges={[...(isAnnual ? ['2 months free'] : []), '14-day free trial']} />
      <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 10 }}>More visibility, more replies and business tools.</div>

      <button
        type="button"
        onClick={() => selectPaidTier('pro')}
        disabled={mode === 'pricing' && checkoutLoading === 'pro'}
        style={{
          marginTop: 18,
          width: '100%',
          background: BRAND.pink,
          border: 'none',
          color: '#fff',
          fontWeight: 900,
          borderRadius: 10,
          padding: '12px 14px',
          cursor: mode === 'pricing' && checkoutLoading === 'pro' ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          opacity: mode === 'pricing' && checkoutLoading === 'pro' ? 0.75 : 1,
        }}
      >
        {mode === 'pricing' && checkoutLoading === 'pro' ? 'Redirecting…' : 'Select Plan'}
      </button>

      <div style={{ marginTop: 12 }}>{proSelected ? selectedPill : null}</div>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {check('20 portfolio photos, 1 video')}
        {check('20 message replies/month')}
        {check('Pink Pro badge')}
        {check('Booking & invoicing')}
      </div>

      <MoreToggle k="pro" />
      <Expand k="pro">
        {sectionHeading('PROFILE & DISCOVERY', true)}
        {check('Public creative profile')}
        {check('20 portfolio photos, 1 video')}
        {check('2 active skill types')}
        {check('State-wide location scope')}
        {check('Pink Pro badge on profile & search')}
        {check('Credentials badges (ABN, Insurance, Blue Card, etc.)')}
        {check('Star ratings & reviews displayed')}
        {check('Import up to 5 past client reviews')}
        {check('Response time badge (auto-calculated)')}
        {check('Search card cover image')}
        {sectionHeading('MESSAGING & REPLIES')}
        {check('20 client message replies/month')}
        {sectionHeading('BUSINESS TOOLS')}
        {check('Booking & scheduling system')}
        {check('Basic invoicing')}
        {check('Client review request system')}
        {sectionHeading('MARKETPLACE')}
        {check('Post gear listings (up to 5 active)')}
        {check('Apply to job board briefs')}
        {check('Full sponsor discount codes unlocked')}
      </Expand>
    </div>
  )

  const ExpertCard = () => (
    <div
      style={{
        ...cardBase,
        border: expertSelected ? '1px solid rgba(217,70,239,1)' : '1px solid rgba(217,70,239,0.7)',
        boxShadow: expertSelected
          ? '0 0 0 2px rgba(217,70,239,0.8), 0 0 0 3px rgba(74,222,128,0.35), 0 0 50px rgba(217,70,239,0.12)'
          : '0 0 0 1px rgba(74,222,128,0.25), 0 0 40px rgba(217,70,239,0.10)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg, rgba(217,70,239,1) 0%, rgba(74,222,128,1) 100%)',
          color: '#000',
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: '0.4px',
        }}
      >
        MOST POPULAR
      </div>

      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 28 }}>Expert</div>
      {isAnnual ? <Price main="A$749.90/yr" sub="A$62.49/mo" /> : <Price main="A$74.99/mo" sub="" />}
      <BadgeRow badges={[...(isAnnual ? ['2 months free'] : []), '14-day free trial']} />
      <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 10 }}>Complete toolkit for serious professionals.</div>

      <button
        type="button"
        onClick={() => selectPaidTier('expert')}
        disabled={mode === 'pricing' && checkoutLoading === 'expert'}
        style={{
          marginTop: 18,
          width: '100%',
          background: 'linear-gradient(90deg, rgba(217,70,239,1) 0%, rgba(74,222,128,1) 100%)',
          border: 'none',
          color: '#000',
          fontWeight: 900,
          borderRadius: 10,
          padding: '12px 14px',
          cursor: mode === 'pricing' && checkoutLoading === 'expert' ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          opacity: mode === 'pricing' && checkoutLoading === 'expert' ? 0.75 : 1,
        }}
      >
        {mode === 'pricing' && checkoutLoading === 'expert' ? 'Redirecting…' : 'Select Plan'}
      </button>

      <div style={{ marginTop: 12 }}>{expertSelected ? selectedPill : null}</div>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {check('40 portfolio photos, 5 videos')}
        {check('Unlimited message replies')}
        {check('Gradient glow badge')}
        {check('CRM, contracts & client portal')}
      </div>

      <MoreToggle k="expert" />
      <Expand k="expert">
        {sectionHeading('PROFILE & DISCOVERY', true)}
        {check('Public creative profile')}
        {check('40 portfolio photos, 5 videos')}
        {check('4 active skill types')}
        {check('National location scope')}
        {check('Expert gradient glow badge (pink→green)')}
        {check('Homepage rotation, Featured Creatives section')}
        {check('Single-page portfolio website (name.lenstrybe.com)')}
        {check('Credentials badges (ABN, Insurance, Blue Card, etc.)')}
        {check('Star ratings & reviews displayed')}
        {check('Import up to 5 past client reviews')}
        {check('Response time badge (auto-calculated)')}
        {check('Search card cover image')}
        {sectionHeading('MESSAGING & REPLIES')}
        {check('Unlimited message replies')}
        {sectionHeading('BUSINESS TOOLS')}
        {check('Booking & scheduling system')}
        {check('Full invoicing & quotes (bank details on invoices)')}
        {check('Custom contracts & e-signatures')}
        {check('CRM up to 500 client records + pipeline view')}
        {check('Client portal (unique link, no login required)')}
        {check('Brand kit (logo, colour & font across all outputs)')}
        {check('Business insights dashboard')}
        {check('Client review request system')}
        {sectionHeading('LENSTRYBE DELIVER')}
        {check('Branded content delivery galleries')}
        {check('Password-protected & invoice-gated galleries')}
        {check('Watermarking on preview images')}
        {check('50GB total storage')}
        {sectionHeading('MARKETPLACE')}
        {check('Post gear listings (up to 15 active)')}
        {check('Apply to job board briefs')}
        {check('Full sponsor discount codes unlocked')}
      </Expand>
    </div>
  )

  const EliteCard = () => (
    <div style={{ ...cardBase, border: eliteSelected ? `2px solid ${BRAND.gold}` : `1px solid ${BRAND.gold}` }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: BRAND.gold }}>Elite</div>
      {isAnnual ? <Price main="A$1,499.90/yr" sub="A$124.99/mo" /> : <Price main="A$149.99/mo" sub="" />}
      <BadgeRow badges={[...(isAnnual ? ['2 months free'] : []), '14-day free trial']} />
      <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 10 }}>Everything unlimited, gold badge, #1 placement.</div>

      <button
        type="button"
        onClick={() => selectPaidTier('elite')}
        disabled={mode === 'pricing' && checkoutLoading === 'elite'}
        style={{
          marginTop: 18,
          width: '100%',
          background: BRAND.gold,
          border: 'none',
          color: '#111',
          fontWeight: 900,
          borderRadius: 10,
          padding: '12px 14px',
          cursor: mode === 'pricing' && checkoutLoading === 'elite' ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          opacity: mode === 'pricing' && checkoutLoading === 'elite' ? 0.75 : 1,
        }}
      >
        {mode === 'pricing' && checkoutLoading === 'elite' ? 'Redirecting…' : 'Select Plan'}
      </button>

      <div style={{ marginTop: 12 }}>{eliteSelected ? selectedPill : null}</div>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {check('Unlimited portfolio media')}
        {check('Gold Elite badge')}
        {check('Elite Spotlight on homepage')}
        {check('Up to 5 team members')}
      </div>

      <MoreToggle k="elite" />
      <Expand k="elite">
        {sectionHeading('PROFILE & DISCOVERY', true)}
        {check('Public creative profile')}
        {check('Unlimited portfolio photos & videos')}
        {check('All 8 skill types active')}
        {check('National location scope')}
        {check('Gold Elite badge, #1 search placement always')}
        {check('Elite Spotlight, always-visible homepage section')}
        {check('Homepage rotation, Featured Creatives section')}
        {check('Multi-page portfolio website with custom domain')}
        {check('Studio Profile page to showcase your whole team')}
        {check('Credentials badges (ABN, Insurance, Blue Card, etc.)')}
        {check('Star ratings & reviews displayed')}
        {check('Import up to 5 past client reviews')}
        {check('Response time badge (auto-calculated)')}
        {check('Search card cover image')}
        {sectionHeading('MESSAGING & REPLIES')}
        {check('Unlimited message replies')}
        {sectionHeading('TEAM')}
        {check('Up to 5 team members under one subscription')}
        {check('Team performance insights per member')}
        {sectionHeading('BUSINESS TOOLS')}
        {check('Booking & scheduling system')}
        {check('Full invoicing & quotes (bank details on invoices)')}
        {check('Custom contracts & e-signatures')}
        {check('Unlimited CRM client records')}
        {check('Client portal (unique link, no login required)')}
        {check('Brand kit (logo, colour & font across all outputs)')}
        {check('Business insights dashboard')}
        {check('Client review request system')}
        {sectionHeading('LENSTRYBE DELIVER')}
        {check('Branded content delivery galleries')}
        {check('Password-protected & invoice-gated galleries')}
        {check('Watermarking on preview images')}
        {check('200GB total storage')}
        {sectionHeading('MARKETPLACE')}
        {check('Unlimited gear marketplace listings')}
        {check('Apply to job board briefs')}
        {check('Full sponsor discount codes unlocked')}
      </Expand>
    </div>
  )

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
        gap: 18,
        alignItems: 'start',
      }}
    >
      <BasicCard />
      <ProCard />
      <ExpertCard />
      <EliteCard />
    </div>
  )
}

