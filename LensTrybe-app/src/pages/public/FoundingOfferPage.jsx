import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { TYPO, LIQUID_GLASS, LIQUID_GLASS_CARD, LIQUID_FIELD } from '../../lib/glassTokensLight'
import { LiquidPill, LiquidSelect } from '../../components/ui/liquidGlass'
import PublicPageShell from '../../components/layout/PublicPageShell'
import FoundingApplyForm from '../../components/founding/FoundingApplyForm'

// The Founding 100 offer, as one link Michael can send in a DM or put in a bio instead of
// explaining the deal every time. The terms themselves live at /founding-agreement; this
// page sells it, and the form at the bottom lets an interested creative put their hand up.
//
// Still invitation only: nobody signs up from here. An application is a request, never a
// place, and a person decides what happens next.
//
// Built on the public site's liquid-glass language (glassTokensLight + TileField), the
// same as Home, Pricing and Upcoming Features. It used to be a one-off black page with its
// own CSS, which read as a different website once the light header sat on top of it.

// Brand green and pink are too light for text on the site's near-white background, so
// small bold type uses the darkened pair the rest of the public site uses.
const GREEN_TEXT = '#0E7C3A'
const PINK_TEXT = '#c11f5a'

const GET = [
  ['12 months of Expert, free', 'Our top plan from the day you join, normally $74.99 a month. Nothing is charged for a year. The 12 months go to the first 100 creatives who use a code. After that it is 6 months, on the same locked rate.'],
  ['$49 a month after that, for life', 'Locked in. It never goes up while you keep your founding deal. Everyone joining later pays $74.99.'],
  ['Zero commission, always', 'You keep 100% of every job. LensTrybe makes money from subscriptions, never from your work.'],
  ['A permanent Founding Creative badge', 'On your profile for good, even if you later change plans. The badge goes to the first 100 who use a code.'],
  ['A real say in what gets built', 'A direct line to me. Founding creatives shape the roadmap.'],
]

const ASK = [
  ['Get your profile live within 7 days', 'A finished listing, so clients landing on LensTrybe find real working creatives, not empty pages.'],
  ['Run your next three jobs through the platform', 'Within six months. Quote, accept, invoice, paid. Real jobs for real clients.'],
  ['A line of feedback each month', 'What worked, what did not. A sentence is plenty, and missing one never costs you the deal.'],
]

const HOW = [
  ['You need a code', 'Founding places are invitation only. Each code is personal, works once, and expires 14 days after I send it.'],
  ['Signing up takes a few minutes', 'Your code is filled in for you. You add a card at the end, but nothing is charged during your free period and you can cancel any time.'],
  ['Then build your profile', 'Your Founding Hub shows exactly what is left to do and how you are tracking.'],
]

function Card({ title, body }) {
  return (
    <div style={{ ...LIQUID_GLASS_CARD, borderRadius: '16px', padding: '20px' }}>
      <div style={{ fontSize: '16px', marginBottom: '8px', ...TYPO.heading }}>{title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px', ...TYPO.body }}>{body}</div>
    </div>
  )
}

function SectionHeading({ title, lede, isMobile }) {
  return (
    <>
      <h2 style={{ fontSize: isMobile ? '26px' : '34px', margin: '0 0 8px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>{title}</h2>
      {lede && <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', maxWidth: '64ch', ...TYPO.body }}>{lede}</p>}
    </>
  )
}

export default function FoundingOfferPage() {
  const navigate = useNavigate()
  const [taken, setTaken] = useState(null)

  useEffect(() => {
    let live = true
    supabase.rpc('founding_places_used')
      .then(({ data, error }) => {
        const n = Number(data)
        if (live && !error && Number.isFinite(n)) setTaken(n)
      })
      .catch(() => {})
    return () => { live = false }
  }, [])

  // Only ever shown when we have a real number. A sales page saying "NaN places left"
  // is worse than a sales page with no counter at all.
  const left = Number.isFinite(taken) ? Math.max(0, Math.min(100, 100 - taken)) : null

  const scrollToApply = () => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <PublicPageShell>
      {({ isMobile }) => {
        const cardGrid = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px' }
        return (
        <>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: PINK_TEXT }}>Invitation only</p>
          <h1 style={{ margin: 0, fontSize: isMobile ? '36px' : '52px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)' }}>
            The first 100 creatives on LensTrybe
          </h1>
          <p style={{ margin: '16px auto 0', maxWidth: '660px', color: 'var(--text-secondary)', fontSize: '16px', ...TYPO.body }}>
            LensTrybe is a home for Australian photographers and videographers where you keep
            everything you earn. No commission on your jobs, ever. I am hand-picking 100
            creatives to start it with me, and the deal they get never comes back.
          </p>

          {left != null && (
            <div style={{ ...LIQUID_GLASS_CARD, borderRadius: '16px', padding: '16px 20px', margin: '26px auto 0', maxWidth: '340px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '9px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '30px', fontWeight: 700, color: GREEN_TEXT, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{left}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>of 100 founding places left</span>
              </div>
              <div aria-hidden style={{ height: '6px', borderRadius: '999px', background: 'rgba(20,17,26,0.09)', overflow: 'hidden', marginTop: '12px' }}>
                <div style={{ height: '100%', width: `${100 - left}%`, background: GREEN_TEXT }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '26px' }}>
            <LiquidPill primary style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px' }} onClick={() => navigate('/join/creative')}>
              I have a code
            </LiquidPill>
            <LiquidPill style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px' }} onClick={scrollToApply}>
              Ask for a code
            </LiquidPill>
          </div>
        </div>

        <section style={{ marginBottom: '56px' }}>
          <SectionHeading title="What you get" isMobile={isMobile} />
          <div style={cardGrid}>
            {GET.map(([t, b]) => <Card key={t} title={t} body={b} />)}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '68ch', ...TYPO.body }}>
            A place is taken when a creative uses their code, not when I send one. I invite
            more people than there are places, so holding a code does not hold a place.
          </p>
        </section>

        <section style={{ marginBottom: '56px' }}>
          <SectionHeading
            title="What I ask in return"
            lede="This is a partnership, not a giveaway. A directory of half-finished profiles helps nobody, so the founding deal comes with three commitments."
            isMobile={isMobile}
          />
          <div style={cardGrid}>
            {ASK.map(([t, b]) => <Card key={t} title={t} body={b} />)}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '68ch', ...TYPO.body }}>
            If you fall behind, you get an email and 14 days to put it right. Nothing happens
            silently. The full terms are in the{' '}
            <Link to="/founding-agreement" style={{ color: GREEN_TEXT, fontWeight: 600, textDecoration: 'none' }}>Founding Creative Agreement</Link>.
          </p>
        </section>

        <section style={{ marginBottom: '56px' }}>
          <SectionHeading title="How it works" isMobile={isMobile} />
          <div style={cardGrid}>
            {HOW.map(([t, b]) => <Card key={t} title={t} body={b} />)}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: '13.5px', color: 'var(--text-muted)', ...TYPO.body }}>
            Launching on the east coast on 1 October 2026, starting in South East Queensland.
          </p>
        </section>

        <section id="apply" style={{ margin: '0 auto', maxWidth: '640px', scrollMarginTop: '90px' }}>
          <SectionHeading
            title="Want one of the places?"
            lede="Tell me who you are and show me your work. I read every one of these myself, and if you are a fit I will send you a code."
            isMobile={isMobile}
          />
          <FoundingApplyForm isMobile={isMobile} />
        </section>
        </>
        )
      }}
    </PublicPageShell>
  )
}
