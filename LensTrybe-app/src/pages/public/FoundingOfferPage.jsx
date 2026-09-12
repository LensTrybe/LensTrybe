import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

// The Founding 100 offer, as one link Michael can send in a DM instead of explaining the
// deal every time. The terms themselves live at /founding-agreement; this page sells it.
//
// Invite only by design: there is no way to sign up from here without a code. The page's
// job is to make someone want one, and to make the ask honest enough that the creatives
// who do come in already know what they signed up for.

const GREEN = '#1DB954'
const ON_GREEN = '#04120a'
const PINK = '#FF2D78'
const BG = '#0a0a0f'

const GET = [
  ['12 months of Expert, free', 'Our top plan from the day you join, normally $74.99 a month. Nothing is charged for a year.'],
  ['$49 a month after that, for life', 'Locked in. It never goes up while you keep your founding deal. Everyone joining later pays $74.99.'],
  ['Zero commission, always', 'You keep 100% of every job. LensTrybe makes money from subscriptions, never from your work.'],
  ['A permanent Founding Creative badge', 'On your profile for good, even if you later change plans.'],
  ['A real say in what gets built', 'A direct line to me. Founding creatives shape the roadmap.'],
]

const ASK = [
  ['Get your profile live within 7 days', 'A finished listing, so clients landing on LensTrybe find real working creatives, not empty pages.'],
  ['Run your next three jobs through the platform', 'Within six months. Quote, accept, invoice, paid. Real jobs for real clients.'],
  ['A line of feedback each month', 'What worked, what did not. A sentence is plenty, and missing one never costs you the deal.'],
]

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
        @media (max-width: 640px) { .fo-wrap { padding-block: 44px 72px; } }
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
                charged for 12 months and you can cancel any time.
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
            <a className="fo-ghost" href="mailto:connect@lenstrybe.com?subject=Founding%20100">
              Ask about a place
            </a>
          </div>
          <p className="fo-note">
            Launching on the east coast on 1 October 2026, starting in South East Queensland.
          </p>
        </div>
      </div>
    </div>
  )
}
