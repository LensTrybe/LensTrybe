import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import Aurora from '../../components/Aurora'
import { mountLens } from '../../lib/lens'
import { useFoundingTaken } from '../../lib/founding'
import { foundingApply } from '../../lib/account'

// The Founding 100 offer: the one link to send in a DM instead of explaining the deal every time.
// The terms live at /legal/founding; this page sells it and takes applications. Nobody signs up
// from here without a code: an application is a request, a person decides, a code arrives by email.
const GET = [
  ['12 months of Trybe Complete, free', 'The top plan from the day you join, normally $74.99 a month. Nothing is charged for a year. The twelve months go to the first hundred creatives who use a code; after that it is six months, on the same price.'],
  ['$49 a month after that, for life', 'Locked in. It never goes up while you keep your founding deal. Everyone joining later pays $74.99.'],
  ['Zero commission, always', 'You keep 100% of every job. LensTrybe makes money from subscriptions, never from your work.'],
  ['A permanent Founding Creative badge', 'On your profile for good, even if you later change plans. The badge goes to the first hundred who use a code.'],
  ['A real say in what gets built', 'A direct line to Michael. Founding creatives shape the roadmap, and the workspace shows what they asked for.'],
  ['Trybe Studio spotlight for the first quarter', 'Your profile sits in the home page rotation for the first ninety days after launch, the same slot Trybe Studio pays for.'],
]
const ASK = [
  ['Get your profile live within 7 days', 'A finished listing, so clients landing on LensTrybe find real working creatives, not empty pages. The checklist in the workspace shows what is left.'],
  ['Run your next three jobs through the platform', 'Within six months. Quote, accept, invoice, paid. Real jobs for real clients.'],
  ['A line of feedback each month', 'What worked, what did not. A sentence is plenty, and missing one never costs you the deal.'],
]
const HOW = [
  ['You need a code', 'Founding places are invitation only. Each code is personal, works once, and expires fourteen days after it is sent.'],
  ['Signing up takes a minute', 'Name, email, password, then the plan page with Trybe Complete already chosen and the founding price on it. No card today.'],
  ['Then build your profile', 'Your workspace opens with the twelve-item checklist and a Founding tile that shows how you are tracking against the three asks.'],
]
const DISC = ['Photographer', 'Videographer', 'Both', 'Drone operator', 'Editor', 'Content creator', 'Other']
const REGIONS = ['South East Queensland', 'Brisbane', 'Gold Coast', 'Sunshine Coast', 'Sydney', 'Melbourne', 'Regional NSW', 'Regional Victoria', 'Adelaide', 'Perth', 'Hobart', 'Darwin', 'Canberra']

export default function Founding() {
  const nav = useNavigate()
  const taken = useFoundingTaken()
  const left = taken == null ? null : Math.max(0, 100 - taken)
  const cv = useRef(null)
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  const [code, setCode] = useState(''), [cerr, setCerr] = useState('')
  const [f, setF] = useState({ name: '', biz: '', email: '', link: '', disc: '', region: '', note: '' }), [err, setErr] = useState(''), [sent, setSent] = useState(false)
  const u = (k, v) => { setF(o => ({ ...o, [k]: v })); setErr('') }
  const redeem = e => { e.preventDefault(); const c = code.trim().toUpperCase(); if (!/^[A-Z0-9][A-Z0-9-]{2,62}[A-Z0-9]$/.test(c)) return setCerr('That does not look like a code. Copy it from your invite email.'); nav('/join?code=' + encodeURIComponent(c)) }
  const [busy, setBusy] = useState(false)
  const apply = async e => {
    e.preventDefault()
    if (busy) return
    if (!f.name.trim()) return setErr('Your name, so the reply can start with it.')
    if (!/.+@.+\..+/.test(f.email)) return setErr('A real email, that is where the code goes.')
    if (!f.link.trim()) return setErr('An Instagram handle or a website. The work is what decides it.')
    setBusy(true)
    try { await foundingApply(f); setSent(true); document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    catch (x) { setErr(x.message || 'Something went wrong sending that. Try again.') }
    finally { setBusy(false) }
  }
  const toApply = () => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })
  return (
    <>
    <section className="hiw fdtop dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="in">
      <div className="fdhero">
        <p className="eb">Invitation only</p>
        <h1><span className="ln"><span>The first hundred</span></span> <span className="ln"><span>creatives <em>on LensTrybe.</em></span></span></h1>
        <p className="sub">A home for Australian photographers and videographers where you keep everything you earn. No commission on your jobs, ever. Michael is hand-picking a hundred creatives to start it with, and the deal they get never comes back.</p>
        <div className="fdcount lg d"><div className="n"><b>{left ?? '…'}</b><span>of 100 founding places left</span></div><div className="bar"><i style={{ width: (left == null ? 0 : 100 - left) + '%' }} /></div><small>A place is taken when a code is used, not when it is sent. More codes go out than there are places, so holding one does not hold a place.</small></div>
        <div className="ctas"><button className="btn w lg" onClick={() => document.getElementById('fcode')?.focus()}>I have a code <Icon name="arrow" size={14} /></button><button className="btn g lg" onClick={toApply}>Ask for a code</button></div>
      </div>

      <form className="fdredeem lg d" onSubmit={redeem}>
        <div><b>Have a code?</b><span>It is filled into the signup for you. Trybe Complete is chosen, the founding price is on the plan page, and nothing is charged for a year.</span></div>
        <div className="fdcode"><input id="fcode" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setCerr('') }} placeholder="Your invite code" aria-label="Founding code" autoComplete="off" spellCheck={false} /><button type="submit" className="btn w">Redeem <Icon name="arrow" size={14} /></button></div>
        {cerr && <p className="fderr">{cerr}</p>}
      </form>
      </div>
    </section>

    <div className="lt"><Aurora />
    <main className="page fdp"><div className="wrap">

      <section className="fdsec rv"><h2>What you get</h2><div className="fdgrid">{GET.map(([t, d]) => <div key={t} className="lg fdcard"><b>{t}</b><p>{d}</p></div>)}</div></section>
      <section className="fdsec rv"><h2>What is asked in return</h2><p className="lede">This is a partnership, not a giveaway. A directory of half-finished profiles helps nobody, so the founding deal comes with three commitments.</p><div className="fdgrid three">{ASK.map(([t, d], i) => <div key={t} className="lg fdcard"><i>{i + 1}</i><b>{t}</b><p>{d}</p></div>)}</div><p className="fine">Fall behind and you get an email and fourteen days to put it right. Nothing happens silently, and if the founding deal ends your account stays, it just moves to the standard price. The full terms are in the <Link to="/legal/founding">Founding Creative Agreement</Link>.</p></section>
      <section className="fdsec rv"><h2>How it works</h2><div className="fdgrid three">{HOW.map(([t, d], i) => <div key={t} className="lg fdcard"><i>{i + 1}</i><b>{t}</b><p>{d}</p></div>)}</div><p className="fine">Launching on the east coast on 1 October 2026, starting in South East Queensland. Anyone redeeming after the first hundred: Trybe Complete free for six months, the same $49 a month for life, no badge.</p></section>

      <section id="apply" className="fdapply rv">
        <div className="fdah"><h2>Want one of the places?</h2><p className="lede">Say who you are and show the work. Michael reads every one of these himself, and if you are a fit a code is on its way within a few days.</p></div>
        {sent ? (
          <div className="lg fdsent"><i><Icon name="check" size={18} /></i><b>Application in.</b><p>Thanks {f.name.split(' ')[0]}. A reply lands at <strong>{f.email}</strong> within a few days, and if it is a yes the code comes with it. Codes work once and expire fourteen days after they are sent, so keep an eye on the inbox.</p><div className="row"><Link className="btn g" to="/creatives">See who is already here</Link><button className="btn g" onClick={() => { setSent(false); setF({ name: '', biz: '', email: '', link: '', disc: '', region: '', note: '' }) }}>Apply for someone else</button></div></div>
        ) : (
          <form className="lg fdform" onSubmit={apply}>
            <div className="two"><div className="field"><label htmlFor="fa-n">Your name</label><input id="fa-n" value={f.name} onChange={e => u('name', e.target.value)} placeholder="Jess Turner" autoComplete="name" /></div><div className="field"><label htmlFor="fa-b">Business name <small>optional</small></label><input id="fa-b" value={f.biz} onChange={e => u('biz', e.target.value)} placeholder="Turner Photography" autoComplete="organization" /></div></div>
            <div className="two"><div className="field"><label htmlFor="fa-e">Email</label><input id="fa-e" type="email" value={f.email} onChange={e => u('email', e.target.value)} placeholder="you@yourstudio.com.au" autoComplete="email" /></div><div className="field"><label htmlFor="fa-l">Instagram or website</label><input id="fa-l" value={f.link} onChange={e => u('link', e.target.value)} placeholder="@yourhandle or yourwebsite.com.au" /></div></div>
            <div className="two"><div className="field"><label htmlFor="fa-d">What you do <small>optional</small></label><select id="fa-d" value={f.disc} onChange={e => u('disc', e.target.value)}><option value="">Choose one</option>{DISC.map(d => <option key={d}>{d}</option>)}</select></div><div className="field"><label htmlFor="fa-r">Where you work <small>optional</small></label><input id="fa-r" list="fa-regions" value={f.region} onChange={e => u('region', e.target.value)} placeholder="Brisbane and the Sunshine Coast" /><datalist id="fa-regions">{REGIONS.map(r => <option key={r} value={r} />)}</datalist></div></div>
            <div className="field"><label htmlFor="fa-t">Anything else <small>optional</small></label><textarea id="fa-t" rows={3} value={f.note} onChange={e => u('note', e.target.value)} placeholder="What you shoot, how long you have been at it, what you would want from the platform." /></div>
            {err && <p className="fderr">{err}</p>}
            <div className="row"><button type="submit" className="btn p lg" disabled={busy} style={busy ? { opacity: .6 } : undefined}>{busy ? 'Sending…' : <>Send my application <Icon name="arrow" size={14} /></>}</button><span className="fine">Applications are read in the order they arrive. Read the <Link to="/legal/privacy">privacy policy</Link>.</span></div>
          </form>
        )}
      </section>
    </div></main>
    </div>
    </>
  )
}
