import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { TYPO, LIQUID_GLASS, LIQUID_GLASS_CARD, LIQUID_FIELD } from '../../lib/glassTokensLight'
import { LiquidPill, LiquidSelect } from '../../components/ui/liquidGlass'
import PublicPageShell from '../../components/layout/PublicPageShell'

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

const CREATIVE_TYPES = [
  'Photographer',
  'Videographer',
  'Drone pilot',
  'Video editor',
  'Photo editor',
  'Social media manager',
  'Hair and makeup artist',
  'UGC creator',
  'Something else',
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

// Module level on purpose. Defined inside FoundingOfferPage it would be a new component
// type on every render, so React would throw the inputs away and the field you are typing
// in would lose focus after each keystroke.
function ApplyForm({ isMobile }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    creative_type: '',
    region: '',
    portfolio_url: '',
  })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e) {
    e.preventDefault()
    if (sending) return
    setErr('')
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('founding-apply', { body: form })
      if (error) {
        // invoke() throws away the function's own message on a non-2xx, so read the body.
        let msg = ''
        try {
          const parsed = await error.context.json()
          msg = parsed && parsed.error ? parsed.error : ''
        } catch {
          msg = ''
        }
        throw new Error(msg || 'Something went wrong. Please try again.')
      }
      if (data && data.error) throw new Error(data.error)
      setDone(true)
    } catch (e2) {
      setErr(e2.message || 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div style={{ ...LIQUID_GLASS, position: 'relative', zIndex: 1, padding: isMobile ? '20px' : '26px' }}>
        <div style={{ fontSize: '17px', marginBottom: '8px', color: GREEN_TEXT, ...TYPO.heading }}>Got it.</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '15px', ...TYPO.body }}>
          Your details are with me. I go through every application myself, so give it a few
          days. If you are a fit, your code arrives by email from connect@lenstrybe.com.
        </div>
      </div>
    )
  }

  const fieldStyle = { width: '100%', padding: '13px 14px', ...LIQUID_FIELD }
  const labelStyle = { display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }
  const twoUp = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }

  return (
    <form onSubmit={onSubmit} noValidate style={{ ...LIQUID_GLASS, position: 'relative', zIndex: 1, padding: isMobile ? '20px' : '26px' }}>
      <div style={twoUp}>
        <div>
          <label style={labelStyle} htmlFor="fo-name">Your name</label>
          <input id="fo-name" type="text" autoComplete="name" maxLength={120} value={form.name}
            onChange={(e) => set('name', e.target.value)} placeholder="Jess Turner" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="fo-email">Email</label>
          <input id="fo-email" type="email" autoComplete="email" maxLength={254} value={form.email}
            onChange={(e) => set('email', e.target.value)} placeholder="you@yourstudio.com.au" style={fieldStyle} />
        </div>
      </div>

      <div style={twoUp}>
        <div>
          <span style={labelStyle}>What you do</span>
          <LiquidSelect
            value={form.creative_type}
            onChange={(v) => set('creative_type', v)}
            ariaLabel="What you do"
            placeholder="Choose one"
            style={{ flex: '1 1 100%' }}
            options={[{ value: '', label: 'Choose one' }, ...CREATIVE_TYPES.map((t) => ({ value: t, label: t }))]}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="fo-region">Where you work</label>
          <input id="fo-region" type="text" maxLength={120} value={form.region}
            onChange={(e) => set('region', e.target.value)} placeholder="Brisbane and the Sunshine Coast" style={fieldStyle} />
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle} htmlFor="fo-link">A link to your work</label>
        <input id="fo-link" type="text" inputMode="url" maxLength={300} value={form.portfolio_url}
          onChange={(e) => set('portfolio_url', e.target.value)} placeholder="@yourhandle or yourwebsite.com.au" style={fieldStyle} />
        <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', ...TYPO.body }}>
          Instagram, a website, a Drive folder. Whatever shows your work best.
        </p>
      </div>

      {err && <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: PINK_TEXT, ...TYPO.body }}>{err}</p>}

      <LiquidPill type="submit" primary disabled={sending}
        style={{ flex: '0 0 auto', display: 'inline-flex', padding: '14px 26px', opacity: sending ? 0.7 : 1 }}>
        {sending ? 'Sending' : 'Apply for a place'}
      </LiquidPill>

      <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', ...TYPO.body }}>
        No spam. Your details are only used to look at your application and send you a code.
        Read our <Link to="/privacy" style={{ color: GREEN_TEXT, fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>.
      </p>
    </form>
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
          <ApplyForm isMobile={isMobile} />
        </section>
        </>
        )
      }}
    </PublicPageShell>
  )
}
