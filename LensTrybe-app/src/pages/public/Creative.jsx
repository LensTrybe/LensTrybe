import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { CREATIVES } from '../../data/creatives'
import { MOOD_NAMES } from '../../lib/stills'
import { fmt } from '../../lib/format'
import { useToast } from '../../components/Toast'
import SiteRender from '../../components/SiteRender'
import { useStore, nice } from '../../lib/store'
import { dayStatus, nextOpen } from '../../lib/avail'

const SITE_PLANS = ['Expert', 'Elite']

const TITLES = ['Harper and Leo, Maleny', 'First look, Noosa', 'Sunshine Beach', 'Rehearsal dinner', 'Getting ready', 'Golden hour, Coolum', 'The speeches', 'Last dance, Montville', 'Elopement, Glass House']
// A creative's public profile, and the enquiry that starts a thread.
export default function Creative() {
  const { id } = useParams(); const toast = useToast(); const { s } = useStore()
  const c = CREATIVES.find(x => x.id === id) || CREATIVES[0]
  const [tab, setTab] = useState(0); const [sel, setSel] = useState(14); const [msg, setMsg] = useState('')
  const [page, setPage] = useState('home')
  const first = c.n.split(' ')[0], live = c.id === 'mara'
  const booked = live ? Array.from({ length: 30 }, (_, i) => i + 1).filter(d => dayStatus(s, '2026-11-' + String(d).padStart(2, '0')).st !== 'open') : [7, 8, 21, 28]
  const A = s.avail, pubShow = live && A.pub?.show, nextSat = pubShow ? nextOpen(s, 1, { sat: true })[0] : null, nextAny = pubShow ? nextOpen(s, A.pub?.n || 3) : [], instant = live ? (A.pub?.instant || []) : []
  // Expert and Elite: the public profile is the creative's website, straight from their Website editor and brand kit.
  // Basic and Pro: the standard LensTrybe profile below.
  const mine = c.id === 'mara' && SITE_PLANS.includes(s.plan.name)
  if (mine) return (
    <main className="page csite" style={{ paddingTop: 96 }}><div className="wrap">
      <SiteRender s={s} page={page} onPage={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} creative={c} onEnquire={m => toast(m ? 'Sent. ' + first + ' usually replies in ' + c.resp + '.' : 'Say what you need first, one sentence is enough.')} />
      <p className="fine" style={{ textAlign: 'center', marginTop: 18 }}>{c.n} on LensTrybe · {c.rv} verified reviews · {c.found ? 'Founding creative · ' : ''}<Link to="/creatives" style={{ color: 'var(--green-t)' }}>More creatives</Link></p>
    </div></main>
  )
  return (
    <main className="page" style={{ paddingTop: 96 }}><div className="wrap">
      <div className="cover">
        <Still seed={c.seed} mood={c.mood} />
        <div className="in">
          <div className="who"><div className="avx" /><div><h1>{c.n}</h1><div className="meta"><span>{c.d}</span><span>·</span><span>{c.c}, {c.state} · travels statewide</span>{c.found && <span className="fb">Founding creative</span>}<span className="stars"><i>★★★★★</i> {c.r} · {c.rv} reviews</span></div></div></div>
          <div className="ctas"><button className="btn g" onClick={() => toast('Saved to your shortlist')}>Save</button><a className="btn p" href="#enq">Enquire <Icon name="arrow" size={14} /></a></div>
        </div>
      </div>
      <div className="plyt">
        <div>
          <div className="ptabs">{['Work', 'Packages', 'Reviews', 'About'].map((t, i) => <button key={t} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t}</button>)}</div>
          {tab === 0 && <div className="folio">{['wide', '', '', 'tall', '', '', '', 'wide', ''].map((k, i) => <div key={i} className={'ph2 ' + k}><Still seed={c.seed * 5 + i * 3} mood={MOOD_NAMES[(i + c.seed) % 6]} /><span>{TITLES[i]}</span></div>)}</div>}
          {tab === 1 && <><div className="pk">{c.pk.map(([n, p, s], i) => <div key={n} className={'pc lg' + (i === 1 ? ' pop' : '')}><b>{n}</b><div className="pr">{fmt(p)}<small> · {s.split(' · ')[0]}</small></div><p>{s}</p></div>)}</div><p className="fine" style={{ marginTop: 14 }}>All prices in AUD, incl. GST. A 30% deposit secures the date. Quotes are private between you and {first}.</p></>}
          {tab === 2 && <div className="revs">
            <div className="rc lg"><div className="h"><b>Harper and Leo</b><i>★★★★★</i></div><p>{first} was invisible when we needed her to be and everywhere when it mattered. The sneak peek arrived while we were still at the reception.</p><small>Maleny · October 2026 · Verified booking</small></div>
            <div className="rc lg"><div className="h"><b>Coastline Realty</b><i>★★★★★</i></div><p>Booked after seeing the work. The quote and contract took five minutes total, and the files were in our portal the next day.</p><small>Noosa Heads · September 2026 · Verified booking</small></div>
            <div className="rc lg"><div className="h"><b>Ana and Tom</b><i>★★★★☆</i></div><p>Beautiful work and easy to deal with. Gallery took the full two weeks, which was said up front.</p><small>Sunshine Beach · August 2026 · Verified booking</small></div>
          </div>}
          {tab === 3 && <div className="about"><p>{c.about}</p><div className="kit"><div><b>Shoots on</b>Sony A1 × 2, 35mm and 85mm primes</div><div><b>Turnaround</b>Sneak peek in 48 hours, gallery in 2 weeks</div><div><b>Travel</b>Included within 150km of {c.c}</div><div><b>Insurance</b>Public liability, $20m</div></div></div>}
        </div>
        <aside className="enq lg" id="enq">
          <div className="fr">{c.pk[1][0]} from<br /><b>{fmt(c.pk[1][1])}</b> incl. GST</div>
          <div className="avail"><i />Responds in {c.resp}</div>
          {pubShow && <div className="nextopen"><b>{nextSat ? 'Next open Saturday: ' + nice(nextSat) : 'Saturdays are booked out for now'}</b><span>{nextAny.length ? 'Also open ' + nextAny.map(d => nice(d, { weekday: 'short' })).join(', ') : ''}</span></div>}
          {instant.length > 0 && <div className="instant"><Icon name="spark" size={13} />Book {instant.map(k => k.toLowerCase()).join(' and ')} instantly, no enquiry needed</div>}
          <div><p className="eb g" style={{ marginBottom: 8 }}>November 2026</p>
            <div className="mcal">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={'h' + i} className="h">{d}</span>)}{Array.from({ length: 6 }, (_, i) => <span key={'p' + i} className="h" />)}{Array.from({ length: 30 }, (_, i) => { const d = i + 1; const x = booked.includes(d); return <span key={d} className={(x ? 'x' : '') + (sel === d ? ' sel' : '')} onClick={() => { if (!x) { setSel(d); toast(`${d} Nov selected`) } }}>{d}</span> })}</div></div>
          <div className="field"><label htmlFor="e-type">Job type</label><select id="e-type">{c.pk.map(([n]) => <option key={n}>{n}</option>)}<option>Something else</option></select></div>
          <div className="field"><label htmlFor="e-msg">Message</label><textarea id="e-msg" rows="3" value={msg} onChange={e => setMsg(e.target.value)} placeholder={`Hi ${first}, we're getting married at Maleny Manor on ${sel} Nov...`} /></div>
          <button className="btn p" onClick={() => toast(`Enquiry sent. ${first} usually replies in ${c.resp}.`)}>Send enquiry <Icon name="arrow" size={14} /></button>
          <p className="fine">No fee to enquire. {first} replies with a quote you can accept, sign and pay in one place. LensTrybe never takes a cut. <Link to="/portal/harper-leo" style={{ color: 'var(--green-t)' }}>See what the thread looks like</Link>.</p>
        </aside>
      </div>
    </div></main>
  )
}
