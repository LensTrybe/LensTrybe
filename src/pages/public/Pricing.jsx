import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { Calculator, FoundingBand } from './Sections'
import WorkspacePeek from './WorkspacePeek'
import { PLANS } from '../../data/workspace'

const ROWS = [
  ['Public profile and listing', '✓', '✓', '✓', '✓'], ['Portfolio photos', '5', '20 + video', '40 + video', 'Unlimited'], ['Bookings a month', '3', '5', 'Unlimited', 'Unlimited'], ['Quotes clients can accept', '', '✓', '✓', '✓'], ['Branded invoices and payment', '', '', '✓', '✓'], ['Contracts and e-signatures', '', '', '✓', '✓'], ['CRM client records', '', '25', '500', 'Unlimited'], ['Branded client portals', '', '', '✓', '✓'], ['Deliver storage', '', '', '50 GB', '200 GB'], ['Your own website', '', 'Home and contact', 'Five pages', 'Five pages, own domain'], ['Lumi, your AI assistant', '', '5 messages a month', 'Unlimited', 'Unlimited'], ['Team members', '', '', '', 'Up to 5'], ['Elite spotlight on the homepage', '', '', '', '✓'],
]
const KEYS = {
  Basic: ['Public profile and listing', 'Five portfolio photos', 'Three bookings a month', 'Found by the ask bar'],
  Pro: ['Twenty photos plus video', 'Quotes clients can accept', 'CRM for 25 clients', 'Home and contact page', 'Lumi, five messages a month'],
  Expert: ['Unlimited bookings', 'Quotes, contracts, e-signatures', 'Branded invoices and payment', 'Branded client portals', '50 GB delivery', 'Five page website', 'Lumi, unlimited'],
  Elite: ['Everything in Expert', 'Team of five', 'Your own domain', '200 GB delivery', 'Elite spotlight on the homepage', 'Unlimited CRM'],
}
const FAQ = [
  ['Do you take a commission?', 'No. Never. You pay the flat subscription and keep every dollar of every job. Clients pay you directly.'],
  ['What does "three months free" mean?', 'Any paid plan is free for your first three months. You add a card, you are not charged until month four, and you can cancel before then and pay nothing.'],
  ['Can I change plans?', 'Any time. Upgrades apply immediately and downgrades apply at the end of the period you have paid for.'],
  ['Is GST included?', 'Yes. Every price on this page is in Australian dollars with GST included, and your invoices from us are tax invoices.'],
  ['What about the founding programme?', 'The first hundred creatives who redeem a founding code get Expert free for twelve months, then $49 a month locked for life. The band at the foot of this page has the details.'],
]

// Pricing: a dark opener with the lens, four glass plans, the full comparison, the maths and a short FAQ.
export default function Pricing() {
  const [annual, setAnnual] = useState(false)
  const [open, setOpen] = useState(0)
  const cv = useRef(null)
  const [lead, setLead] = useState(true)
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  // the lead-in rides at the foot of the screen and fades away as the plans come into view
  useEffect(() => {
    const on = () => { const el = document.getElementById('plans'); if (!el) return; setLead(el.getBoundingClientRect().top > innerHeight - 40) }
    on(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); return () => { removeEventListener('scroll', on); removeEventListener('resize', on) }
  }, [])
  return (
    <>
      <section className="hiw price dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">Pricing</p>
          <h1><span className="ln"><span>Pays for itself</span></span> <span className="ln"><span>with <em>one booking.</em></span></span></h1>
          <p className="sub">No commissions. No lead fees. Four plans, and the first three months of any paid plan are free.</p>
          <WorkspacePeek />
        </div>
        <button type="button" className={'downto' + (lead ? '' : ' gone')} onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} aria-label="See the four plans">
          <span className="glow" aria-hidden="true" />
          <span className="pill">
            <span className="prices">{PLANS.map(p => <b key={p.n}><small>{p.n}</small>{p.m}</b>)}</span>
            <span className="cta">See the four plans <i><Icon name="back" size={14} /></i></span>
          </span>
        </button>
      </section>

      <div className="lt">
        <Aurora />
        <section className="sec" id="plans" style={{ paddingTop: 'clamp(36px,5vw,64px)', scrollMarginTop: 70 }}><div className="wrap">
          <div className="billing rv">
            <div className="seg2 lite" role="tablist">
              <button role="tab" aria-selected={!annual} className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>Monthly</button>
              <button role="tab" aria-selected={annual} className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>Annual <i>2 months free</i></button>
            </div>
          </div>
          <div className="pgrid rv">
            {PLANS.map(p => (
              <div key={p.n} className={'pcard lg' + (p.hot ? ' hot' : '')}>
                {p.hot && <span className="pop">Most popular</span>}
                <b className="pn">{p.n}</b>
                <span className="pd">{p.d}</span>
                <div className="ppr"><span className="amt">{annual ? p.a : p.m}</span>{p.m !== 'Free' && <span className="per">/ month{annual ? ', billed yearly' : ''}</span>}</div>
                <span className="pfree"><i />{p.free}</span>
                <ul>{KEYS[p.n].map(k => <li key={k}><Icon name="check" size={14} />{k}</li>)}</ul>
                <Link className={'btn ' + (p.hot ? 'k' : 'w')} to="/join">{p.cta}<Icon name="arrow" size={14} /></Link>
              </div>
            ))}
          </div>
          <p className="fine" style={{ marginTop: 16 }}>Annual billing saves two months. Cancel anytime and keep access to the end of the period. Annual plans get a full refund within 14 days of first payment. <Link to="/legal/refunds" style={{ color: 'var(--green-t)' }}>Refund policy</Link>.</p>
        </div></section>

        <section className="sec" id="compare" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">Compare</p><h2>Everything, <em>side by side.</em></h2></div></div>
          <div className="cmpwrap lg rv">
            <table className="cmp2"><thead><tr><th>What you get</th>{PLANS.map(p => <th key={p.n} className={p.hot ? 'hot' : ''}>{p.n}</th>)}</tr></thead>
              <tbody>{ROWS.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 3 ? 'hot' : ''}>{c === '✓' ? <span className="tick"><Icon name="check" size={13} /></span> : c === '' ? <span className="no">·</span> : c}</td>)}</tr>)}</tbody></table>
          </div>
        </div></section>

        <section className="sec" id="keep" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">The maths</p><h2>Keep <em>all of it.</em></h2></div></div>
          <p className="lead rv">Commission marketplaces take a cut of every job, forever. LensTrybe charges a flat subscription. Move the sliders to see the difference for your year.</p>
          <Calculator />
        </div></section>

        <section className="sec" id="faq" style={{ paddingTop: 0 }}><div className="wrap faqwrap">
          <div className="stephead centre rv"><div><p className="eb g">Questions</p><h2>Short answers, <em>no asterisks.</em></h2></div></div>
          <div className="faq rv">{FAQ.map(([q, a], i) => (
            <div key={q} className={'fq lg' + (open === i ? ' on' : '')}>
              <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><span>{q}</span><i>+</i></button>
              <p>{a}</p>
            </div>
          ))}</div>
        </div></section>

        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><FoundingBand /></div></section>
      </div>
    </>
  )
}
