import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { fmt } from '../../lib/format'
import { ACTIONS, PLANS } from '../../data/workspace'

export function SectionHead({ eb, ebClass = 'g', title, em, children }) {
  return <div className="sh rv"><div><p className={'eb ' + ebClass}>{eb}</p><h2>{title} <em>{em}</em></h2></div><p>{children}</p></div>
}

// Nothing to learn: six two-second micro-interactions.
export function Bento() {
  const [draft, setDraft] = useState("Hi Harper, the 14th is open and I'd love to. Full day is $3,200, quote attached.")
  const full = useRef(draft)
  const type = () => { let i = 0; const step = () => { if (i <= full.current.length) { setDraft(full.current.slice(0, i)); i += 2; setTimeout(step, 14) } }; step() }
  return (
    <div className="bento rv">
      <div className="tile lg tilt t-pay"><div className="tv"><div className="fid"><svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M8 18V12a4 4 0 0 1 4-4h6M30 8h6a4 4 0 0 1 4 4v6M40 30v6a4 4 0 0 1-4 4h-6M18 40h-6a4 4 0 0 1-4-4v-6" /><path d="M18 20v-1a6 6 0 0 1 12 0v1M16 26c0 6 3 9 8 9s8-3 8-9M24 22v6" /></svg></div><div className="paid"><i />Paid $960</div></div><b>Pay in a tap</b><span>Deposit and balance by card, Apple Pay or Google Pay. Receipts write themselves.</span></div>
      <div className="tile lg tilt t-sign"><div className="tv"><svg viewBox="0 0 300 80" preserveAspectRatio="none"><path className="sg" d="M12 52c14-22 26-30 30-22s-4 34 6 30 20-38 30-32-2 32 8 30 22-26 30-20-4 26 6 24 18-24 30-18 4 20 12 18 24-22 36-16 8 20 20 16 26-20 40-14 10 16 22 12" /></svg></div><b>Sign with a finger</b><span>Plain English contracts, signed on a phone. Both copies filed in the thread.</span></div>
      <div className="tile lg tilt t-cal"><div className="tv"><div className="mcal2"><span>9</span><span>10</span><span>11</span><span>12</span><span>13</span><span className="d">14</span><span>15</span></div><div className="syncrow"><i />Synced to Google Calendar</div></div><b>A calendar that books itself</b><span>Accept a quote and the date locks on every calendar you use. No double bookings.</span></div>
      <div className="tile lg tilt t-lumi" onMouseEnter={type}><div className="tv"><div className="draft"><span className="lm" /><span>{draft}</span></div></div><b>Lumi drafts the reply</b><span>In your words, from your rates. You read it, you tap send.</span></div>
      <div className="tile lg tilt t-files"><div className="tv"><div className="ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(20,17,26,.08)" strokeWidth="6" /><circle className="arc" cx="40" cy="40" r="34" fill="none" stroke="#1DB954" strokeWidth="6" strokeLinecap="round" strokeDasharray="214" strokeDashoffset="214" transform="rotate(-90 40 40)" /></svg><b>412</b></div><div className="fl">photos · 2 films · delivered</div></div><b>Files that just arrive</b><span>Branded gallery, downloads that work on a phone, expiry reminders sent for you.</span></div>
      <div className="tile lg tilt t-link"><div className="tv"><div className="lnk">harperandleo.lenstrybe.com<i /></div><div className="portal"><span /><span /><span /></div></div><b>One link for the client</b><span>Quote, contract, invoice, gallery and messages behind a single link. No login to remember.</span></div>
    </div>
  )
}

// The morning brief types itself; overnight actions wait for a yes.
export function Agent() {
  const toast = useToast()
  const el = useRef(null); const [txt, setTxt] = useState(''); const started = useRef(false)
  const [acts, setActs] = useState(ACTIONS.filter(a => a.id !== 4))
  useEffect(() => {
    const text = "Morning, Mara. One shoot today at 10 for Coastline Realty, three listings in Noosa Heads. Two quotes are waiting on you. Blackwood paid overnight, so nothing is overdue now. And 23 November to 6 December is empty, which last year was four family sessions. I have an offer ready if you want it."
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started.current) { started.current = true; let i = 0; const step = () => { if (i <= text.length) { setTxt(text.slice(0, i)); i += 2; setTimeout(step, 16) } }; step() } }, { threshold: .4 })
    io.observe(el.current); return () => io.disconnect()
  }, [])
  const decide = (id, yes) => { setActs(a => a.map(x => x.id === id ? { ...x, done: true, skipped: !yes } : x)); toast(yes ? 'Done. Logged, and undoable for 24 hours.' : 'Skipped. Lumi will not ask again.') }
  const parts = txt.split(/(One shoot today at 10|Blackwood paid overnight|23 November to 6 December is empty)/)
  const left = acts.filter(a => !a.done).length
  return (
    <div className="agent">
      <div className="card lg rv"><h4>Monday, 7:02 am <span className="lm" /></h4><div className="morning" ref={el}>{parts.map((p, i) => i % 2 ? <b key={i}>{p}</b> : p)}{txt.length < 300 && txt && <span className="cursor" />}</div></div>
      <div className="card lg rv"><h4>Overnight, waiting for your yes <span className="pend">{left ? left + ' pending' : 'All caught up'}</span></h4>
        <div className="acts">{acts.map(a => <div key={a.id} className={'act' + (a.done ? (a.skipped ? ' no' : ' ok') : '')}><span className="t">{a.t}</span><div><b>{a.b}</b><small>{a.p}</small></div><div className="do">{a.done ? <span className="badge">{a.skipped ? 'Skipped' : a.id === 3 ? 'Sent' : 'Approved'}</span> : <><button className="y" onClick={() => decide(a.id, true)}>{a.y}</button><button onClick={() => decide(a.id, false)}>{a.n}</button></>}</div></div>)}</div>
      </div>
    </div>
  )
}

// What a commission marketplace takes, versus a flat fee.
export function Calculator() {
  const [j, setJ] = useState(4), [v, setV] = useState(1800), [c, setC] = useState(15)
  const gone = j * 12 * v * c / 100, lt = 899.88
  return (
    <div className="calc rv">
      <div className="in card lg">
        <div className="sl"><label>Jobs a month <b>{j}</b></label><input type="range" min="1" max="20" value={j} onChange={e => setJ(+e.target.value)} /></div>
        <div className="sl"><label>Average job value <b>{fmt(v)}</b></label><input type="range" min="300" max="8000" step="100" value={v} onChange={e => setV(+e.target.value)} /></div>
        <div className="sl"><label>Marketplace commission elsewhere <b>{c}%</b></label><input type="range" min="5" max="25" value={c} onChange={e => setC(+e.target.value)} /></div>
        <p className="fine">LensTrybe Expert at $74.99 a month, $899.88 a year. Founding creatives pay $0 for the first year, then $49 a month.</p>
      </div>
      <div className="out">
        <div className="o lg bad"><small>Commission taken elsewhere</small><b>{fmt(gone)}</b><span>a year, gone</span></div>
        <div className="o lg"><small>LensTrybe, flat</small><b>{fmt(lt)}</b><span>a year, whatever you earn</span></div>
        <div className="o lg good"><small>You keep</small><b>{fmt(gone - lt)}</b><span>more every year, before the clients it sends you</span></div>
      </div>
    </div>
  )
}

// Four plans, one line each.
export function Plans({ annual = false }) {
  return (
    <div className="plans lg rv">{PLANS.map(p => <div key={p.n} className={'plan' + (p.hot ? ' hot' : '')}><b>{p.n}{p.hot && <span className="tag">Most popular</span>}</b><span className="d">{p.d}</span><span className="pr">{annual ? p.a : p.m}{p.m !== 'Free' && <small>/mo</small>}<em>{p.free}</em></span><Link className="go" to="/join">{p.cta}</Link></div>)}</div>
  )
}

// The founding programme, as a dark print on the light page.
export function FoundingBand() {
  return (
    <div className="found rv">
      <Still seed={21} mood="night" />
      <div className="a">
        <p className="eb p">Founding creative programme</p>
        <h2>The first hundred set the tone.</h2>
        <p>Redeem a founding code and get Expert free for twelve months, then $49 a month locked for life, plus the permanent Founding Creative badge. In return: finish your profile in a week, run your next three jobs through the platform, and tell us one honest thing a month.</p>
        <Link className="pill" to="/founding">Apply for a code <Icon name="arrow" size={14} /></Link>
      </div>
      <div className="b">
        <div className="k"><b>$0 for 12 months</b><span>Expert, normally $74.99 a month</span></div>
        <div className="k"><b>$49 a month, for life</b><span>After the first year. Never $74.99.</span></div>
        <div className="k"><span className="cnt"><b>37</b> of 100 places redeemed. A place is claimed when a code is redeemed, not when it is sent.</span><div className="meter"><i /></div></div>
      </div>
    </div>
  )
}
