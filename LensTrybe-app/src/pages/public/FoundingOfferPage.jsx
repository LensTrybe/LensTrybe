import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

// The Founding 100 offer, as one link Michael can send in a DM instead of explaining the
// deal every time. The terms themselves live at /founding-agreement; this page sells it.
//
// Still invitation only: nobody signs up from here. What the form at the bottom does is
// let a creative put their hand up, so Michael has their details in the admin panel and
// decides who gets a code. An application is a request, never a place.

const GREEN = '#1DB954'
const ON_GREEN = '#04120a'
const PINK = '#FF2D78'
const BG = '#0a0a0f'

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

// Module level on purpose. Defined inside FoundingOfferPage it would be a new component
// type on every render, so React would throw the inputs away and the field you are typing
// in would lose focus after each keystroke.
function ApplyForm() {
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

  const set = (key) => (e) => {
    const { value } = e.target
    setForm((f) => ({ ...f, [key]: value }))
  }

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
      <div className="fo-card">
        <p className="fo-done">
          <b>Got it.</b> Your details are with me. I go through every application myself, so
          give it a few days. If you are a fit, your code arrives by email from
          connect@lenstrybe.com.
        </p>
      </div>
    )
  }

  return (
    <form className="fo-form" onSubmit={onSubmit} noValidate>
      <div className="fo-two">
        <div>
          <label className="fo-label" htmlFor="fo-name">Your name</label>
          <input
            id="fo-name"
            className="fo-in"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            placeholder="Jess Turner"
          />
        </div>
        <div>
          <label className="fo-label" htmlFor="fo-email">Email</label>
          <input
            id="fo-email"
            className="fo-in"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@yourstudio.com.au"
          />
        </div>
      </div>

      <div className="fo-two">
        <div>
          <label className="fo-label" htmlFor="fo-type">What you do</label>
          <select id="fo-type" className="fo-in" value={form.creative_type} onChange={set('creative_type')}>
            <option value="">Choose one</option>
            {CREATIVE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="fo-label" htmlFor="fo-region">Where you work</label>
          <input
            id="fo-region"
            className="fo-in"
            type="text"
            value={form.region}
            onChange={set('region')}
            placeholder="Brisbane and the Sunshine Coast"
          />
        </div>
      </div>

      <div>
        <label className="fo-label" htmlFor="fo-link">A link to your work</label>
        <input
          id="fo-link"
          className="fo-in"
          type="text"
          inputMode="url"
          value={form.portfolio_url}
          onChange={set('portfolio_url')}
          placeholder="@yourhandle or yourwebsite.com.au"
        />
        <p className="fo-hint">Instagram, a website, a Drive folder. Whatever shows your work best.</p>
      </div>

      {err && <p className="fo-err">{err}</p>}

      <button className="fo-submit" type="submit" disabled={sending}>
        {sending ? 'Sending' : 'Apply for a place'}
      </button>

      <p className="fo-hint">
        No spam. Your details are only used to look at your application and send you a code.
        Read our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </form>
  )
}

export default function FoundingOfferPage() {
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

  return (
    <div style={{ background: BG, color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .fo-wrap { max-width: 880px; margin: 0 auto; padding-inline: 20px; padding-block: 64px 96px; }
        .fo-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: ${PINK}; margin: 0 0 14px; }
        .fo-h1 { font-size: clamp(32px, 6vw, 52px); line-height: 1.08; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 18px; text-wrap: balance; }
        .fo-lede { font-size: 17px; line-height: 1.6; color: #b4b4c2; max-width: 60ch; margin: 0 0 28px; }
        .fo-h2 { font-size: clamp(22px, 3.4vw, 28px); font-weight: 700; letter-spacing: -0.01em; margin: 0 0 18px; }
        .fo-card { background: #14141d; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 22px 24px; }
        .fo-rows { display: flex; flex-direction: column; gap: 2px; }
        .fo-row { padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.07); }
        .fo-row:first-child { border-top: none; }
        .fo-rt { font-size: 16.5px; font-weight: 650; margin-bottom: 5px; }
        .fo-rb { font-size: 14.5px; line-height: 1.55; color: #9a9aa8; max-width: 62ch; }
        .fo-section { margin-top: 56px; }
        .fo-cta { display: inline-flex; align-items: center; justify-content: center; padding: 15px 30px; border-radius: 999px; background: ${GREEN}; color: ${ON_GREEN}; font-weight: 700; font-size: 16px; text-decoration: none; }
        .fo-ghost { display: inline-flex; align-items: center; justify-content: center; padding: 15px 28px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); color: #fff; font-weight: 600; font-size: 15.5px; text-decoration: none; }
        .fo-btns { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
        .fo-meter { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 26px; }
        .fo-meter b { font-size: 30px; font-weight: 800; color: ${GREEN}; font-variant-numeric: tabular-nums; }
        .fo-meter span { font-size: 14.5px; color: #9a9aa8; }
        .fo-bar { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.09); overflow: hidden; max-width: 340px; margin-top: 10px; }
        .fo-bar > div { height: 100%; background: ${GREEN}; }
        .fo-note { font-size: 13.5px; line-height: 1.6; color: #7a7a88; margin-top: 14px; }
        .fo-note a { color: ${GREEN}; font-weight: 600; text-decoration: none; }
        .fo-form { display: grid; gap: 14px; margin-top: 4px; }
        .fo-two { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
        .fo-label { display: block; font-size: 13px; font-weight: 600; color: #b4b4c2; margin-bottom: 6px; }
        .fo-in { width: 100%; box-sizing: border-box; background: #0f0f16; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; padding: 13px 14px; color: #fff; font-size: 16px; font-family: inherit; }
        .fo-in:focus { outline: none; border-color: ${GREEN}; }
        .fo-in::placeholder { color: #6a6a78; }
        select.fo-in { appearance: none; cursor: pointer; background-image: linear-gradient(45deg, transparent 50%, #9a9aa8 50%), linear-gradient(135deg, #9a9aa8 50%, transparent 50%); background-position: calc(100% - 20px) calc(50% + 2px), calc(100% - 15px) calc(50% + 2px); background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; padding-right: 40px; }
        select.fo-in option { background: #14141d; color: #fff; }
        .fo-hint { font-size: 12.5px; color: #7a7a88; margin: 6px 0 0; line-height: 1.55; }
        .fo-hint a { color: ${GREEN}; font-weight: 600; text-decoration: none; }
        .fo-submit { appearance: none; border: 0; cursor: pointer; padding: 15px 30px; border-radius: 999px; background: ${GREEN}; color: ${ON_GREEN}; font-weight: 700; font-size: 16px; font-family: inherit; justify-self: start; }
        .fo-submit[disabled] { opacity: 0.55; cursor: default; }
        .fo-err { font-size: 14px; color: ${PINK}; line-height: 1.5; margin: 0; }
        .fo-done { font-size: 16px; line-height: 1.6; color: #fff; margin: 0; }
        .fo-done b { color: ${GREEN}; }
        @media (max-width: 640px) { .fo-wrap { padding-block: 44px 72px; } .fo-two { grid-template-columns: 1fr; } }
      `}</style>

      <div className="fo-wrap">
        <p className="fo-eyebrow">Invitation only</p>
        <h1 className="fo-h1">The first 100 creatives on LensTrybe</h1>
        <p className="fo-lede">
          LensTrybe is a home for Australian photographers and videographers where you keep
          everything you earn. No commission on your jobs, ever. I am hand-picking 100
          creatives to start it with me, and the deal they get never comes back.
        </p>

        {left != null && (
          <div>
            <div className="fo-meter">
              <b>{left}</b>
              <span>of 100 founding places left</span>
            </div>
            <div className="fo-bar" aria-hidden="true">
              <div style={{ width: `${Math.min(100, ((100 - left) / 100) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="fo-section">
          <h2 className="fo-h2">What you get</h2>
          <div className="fo-card fo-rows">
            {GET.map(([t, b]) => (
              <div className="fo-row" key={t}>
                <div className="fo-rt">{t}</div>
                <div className="fo-rb">{b}</div>
              </div>
            ))}
          </div>
          <p className="fo-note">
            A place is taken when a creative uses their code, not when I send one. I invite
            more people than there are places, so holding a code does not hold a place.
          </p>
        </div>

        <div className="fo-section">
          <h2 className="fo-h2">What I ask in return</h2>
          <p className="fo-lede" style={{ marginBottom: 18 }}>
            This is a partnership, not a giveaway. A directory of half-finished profiles helps
            nobody, so the founding deal comes with three commitments.
          </p>
          <div className="fo-card fo-rows">
            {ASK.map(([t, b]) => (
              <div className="fo-row" key={t}>
                <div className="fo-rt">{t}</div>
                <div className="fo-rb">{b}</div>
              </div>
            ))}
          </div>
          <p className="fo-note">
            If you fall behind, you get an email and 14 days to put it right. Nothing happens
            silently. The full terms are in the{' '}
            <Link to="/founding-agreement">Founding Creative Agreement</Link>.
          </p>
        </div>

        <div className="fo-section">
          <h2 className="fo-h2">How it works</h2>
          <div className="fo-card fo-rows">
            <div className="fo-row">
              <div className="fo-rt">You need a code</div>
              <div className="fo-rb">
                Founding places are invitation only. Each code is personal, works once, and
                expires 14 days after I send it.
              </div>
            </div>
            <div className="fo-row">
              <div className="fo-rt">Signing up takes a few minutes</div>
              <div className="fo-rb">
                Your code is filled in for you. You add a card at the end, but nothing is
                charged during your free period and you can cancel any time.
              </div>
            </div>
            <div className="fo-row">
              <div className="fo-rt">Then build your profile</div>
              <div className="fo-rb">
                Your Founding Hub shows exactly what is left to do and how you are tracking.
              </div>
            </div>
          </div>

          <div className="fo-btns" style={{ marginTop: 22 }}>
            <Link className="fo-cta" to="/join/creative">I have a code</Link>
            <a className="fo-ghost" href="#apply">Ask for a code</a>
          </div>
          <p className="fo-note">
            Launching on the east coast on 1 October 2026, starting in South East Queensland.
          </p>
        </div>

        <div className="fo-section" id="apply">
          <h2 className="fo-h2">Want one of the places?</h2>
          <p className="fo-lede" style={{ marginBottom: 22 }}>
            Tell me who you are and show me your work. I read every one of these myself, and
            if you are a fit I will send you a code.
          </p>
          <ApplyForm />
        </div>
      </div>
    </div>
  )
}
