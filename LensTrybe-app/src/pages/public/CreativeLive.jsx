import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { MOOD_NAMES } from '../../lib/stills'
import { fmt } from '../../lib/format'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../backend/AuthContext'
import { imageUrl } from '../../backend/imageUrl'
import { loadCreative, sendEnquiry } from '../../lib/live'

// A real creative's public profile: work, packages, reviews, about, a month of their calendar
// (creative_unavailable_dates) and the enquiry that starts a thread. A signed-in client's enquiry
// opens a message thread and they get their portal link by email; anyone else goes through the
// rate-limited site-enquiry function. Expert and Elite websites (site_pages) come in the website slice.
const img = (u, w) => { try { return imageUrl(u, w) || u } catch { return u } }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CreativeLive({ id }) {
  const toast = useToast(); const nav = useNavigate(); const { user, clientAccount, profile } = useAuth()
  const [c, setC] = useState(undefined), [tab, setTab] = useState(0)
  const now = new Date(); const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [sel, setSel] = useState(null), [f, setF] = useState({ name: '', email: '', phone: '', type: '', message: '', website: '' }), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [sent, setSent] = useState(false)
  useEffect(() => { let on = true; loadCreative(id).then(x => on && setC(x)).catch(() => on && setC(null)); return () => { on = false } }, [id])
  if (c === undefined) return <main className="page" style={{ paddingTop: 96 }}><div className="wrap"><p className="fine">Loading.</p></div></main>
  if (c === null) return <main className="page" style={{ paddingTop: 96 }}><div className="wrap"><div className="ph"><div><p className="eb p">Not found</p><h1>No creative <em>at that address.</em></h1></div><p>The link may be old, or the profile has been taken down. <Link to="/creatives">Browse everyone</Link>.</p></div></div></main>
  const first = c.n.split(' ')[0]
  const u = (k, v) => { setF(o => ({ ...o, [k]: v })); setErr('') }
  const days = new Date(ym.y, ym.m + 1, 0).getDate(), pad = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7
  const key = d => ym.y + '-' + String(ym.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
  const todayKey = now.toISOString().slice(0, 10)
  const busyDay = d => c.busy.includes(key(d)) || key(d) < todayKey
  const iAmCreative = !!profile && !clientAccount
  const send = async () => {
    if (busy) return
    if (iAmCreative) return setErr('You are logged in as a creative. Enquiries come from client accounts.')
    setBusy(true); setErr('')
    try {
      const subject = [f.type, sel ? MONTHS[ym.m].slice(0, 3) + ' ' + sel : null].filter(Boolean).join(' · ') || 'Enquiry'
      await sendEnquiry(c.id, { ...f, subject, message: f.message + (sel ? '\n\nDate: ' + sel + ' ' + MONTHS[ym.m] + ' ' + ym.y : '') }, user && clientAccount ? user : null)
      setSent(true); toast('Sent. ' + first + ' usually replies within a day.')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const hero = c.cover || c.photos[0]?.url
  return (
    <main className="page" style={{ paddingTop: 96 }}><div className="wrap">
      <div className="cover">
        {hero ? <img src={img(hero, 1600)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <Still seed={c.seed} mood={c.mood} />}
        <div className="in">
          <div className="who"><div className="avx" style={c.avatar ? { backgroundImage: 'url(' + img(c.avatar, 240) + ')', backgroundSize: 'cover' } : undefined} /><div><h1>{c.n}</h1><div className="meta"><span>{c.d}</span>{c.c && <><span>·</span><span>{c.c}, {c.state}</span></>}{c.found && <span className="fb">Founding creative</span>}{c.rv > 0 && <span className="stars"><i>★★★★★</i> {c.r} · {c.rv} reviews</span>}</div></div></div>
          <div className="ctas">{c.site && /pro|expert|elite/i.test(c.tier || '') && <a className="btn g" href={'/site/' + c.id}>Website</a>}<button className="btn g" onClick={() => toast('Saved to your shortlist')}>Save</button><a className="btn p" href="#enq">Enquire <Icon name="arrow" size={14} /></a></div>
        </div>
      </div>
      <div className="plyt">
        <div>
          <div className="ptabs">{['Work', 'Packages', 'Reviews', 'About'].map((t, i) => <button key={t} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t}</button>)}</div>
          {tab === 0 && (c.photos.length ? <div className="folio">{c.photos.slice(0, 18).map((ph, i) => <div key={ph.id} className={'ph2 ' + (ph.wide || i % 7 === 0 ? 'wide' : i % 5 === 3 ? 'tall' : '')}><img src={img(ph.url, 900)} alt={ph.alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />{ph.title && <span>{ph.title}</span>}</div>)}</div> : <div className="folio">{[0, 1, 2].map(i => <div key={i} className="ph2"><Still seed={c.seed * 5 + i * 3} mood={MOOD_NAMES[(i + c.seed) % 6]} /><span>Portfolio on its way</span></div>)}</div>)}
          {tab === 1 && (c.pk.length ? <><div className="pk">{c.pk.map(([n, p, s], i) => <div key={n} className={'pc lg' + (i === 1 ? ' pop' : '')}><b>{n}</b><div className="pr">{p ? fmt(p) : 'Ask'}</div><p>{s}</p></div>)}</div><p className="fine" style={{ marginTop: 14 }}>All prices in AUD incl. GST. {first} quotes the exact job in the thread.</p></> : <p className="fine">{first} quotes each job individually. Say what you need and the quote comes back in the thread.</p>)}
          {tab === 2 && (c.reviews.length ? <div className="revs rvgrid">{c.reviews.map(r => <div key={r.id} className={'rvcard' + (r.featured ? ' pin' : '')}>
            <div className="rvtop"><i className="rvstars">{'★'.repeat(r.r)}<span>{'★'.repeat(5 - r.r)}</span></i>{r.featured && <em>Pinned</em>}</div>
            <p className="rvtext">“{r.text}”</p>
            <div className="rvwho"><span className="rvav">{(r.who || '?').trim().charAt(0).toUpperCase()}</span><div><b>{r.who}</b><small>{[r.kind, r.when ? new Date(r.when).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) : null].filter(Boolean).join(' · ')}</small></div>{!r.verified && <small className="rvsrc">Added by {c.n.split(' ')[0]}</small>}</div>
            {r.reply && <div className="rvreply"><b>{c.n} replied</b><p>{r.reply}</p></div>}
          </div>)}</div> : <p className="fine">No reviews yet. The first one comes from the first job booked here.</p>)}
          {tab === 3 && <div className="about"><p>{c.about || first + ' has not written a bio yet.'}</p><div className="kit">{c.years ? <div><b>Experience</b>{c.years} years</div> : null}{c.areas?.length ? <div><b>Works in</b>{c.areas.join(', ')}</div> : null}{c.ig ? <div><b>Instagram</b><a href={c.ig} target="_blank" rel="noreferrer">{c.ig.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')}</a></div> : null}{c.web ? <div><b>Website</b><a href={c.web} target="_blank" rel="noreferrer">{c.web.replace(/^https?:\/\//, '')}</a></div> : null}</div></div>}
        </div>
        <aside className="enq lg" id="enq">
          {c.pk.length > 0 && <div className="fr">{c.pk[Math.min(1, c.pk.length - 1)][0]} from<br /><b>{fmt(c.pk[Math.min(1, c.pk.length - 1)][1])}</b> incl. GST</div>}
          <div className="avail"><i />{c.free ? 'Taking bookings' : 'Not taking new bookings right now'}</div>
          <div><p className="eb g" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}><button type="button" className="lnk" onClick={() => setYm(o => o.m ? { y: o.y, m: o.m - 1 } : { y: o.y - 1, m: 11 })} aria-label="Previous month">‹</button>{MONTHS[ym.m]} {ym.y}<button type="button" className="lnk" onClick={() => setYm(o => o.m < 11 ? { y: o.y, m: o.m + 1 } : { y: o.y + 1, m: 0 })} aria-label="Next month">›</button></p>
            <div className="mcal">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={'h' + i} className="h">{d}</span>)}{Array.from({ length: pad }, (_, i) => <span key={'p' + i} className="h" />)}{Array.from({ length: days }, (_, i) => { const d = i + 1; const x = busyDay(d); return <span key={d} className={(x ? 'x' : '') + (sel === d ? ' sel' : '')} onClick={() => { if (!x) setSel(sel === d ? null : d) }}>{d}</span> })}</div>
            <p className="fine" style={{ marginTop: 6 }}>Grey days are taken. Pick a date to add it to your enquiry.</p></div>
          {sent ? <div className="tsys" style={{ textAlign: 'left' }}>Sent. {first} usually replies within a day{user && clientAccount ? ', and the thread is in your portal' : ', by email'}. {user && clientAccount && <Link to="/portal" style={{ color: 'var(--green-t)', fontWeight: 600 }}>Open your portal</Link>}</div> : <>
            {!(user && clientAccount) && <div className="two"><div className="field"><label htmlFor="e-name">Your name</label><input id="e-name" value={f.name} onChange={e => u('name', e.target.value)} placeholder="Harper Lee" /></div><div className="field"><label htmlFor="e-email">Email</label><input id="e-email" type="email" value={f.email} onChange={e => u('email', e.target.value)} placeholder="you@email.com" /></div></div>}
            <div className="field"><label htmlFor="e-type">Job type</label><select id="e-type" value={f.type} onChange={e => u('type', e.target.value)}><option value="">Choose</option>{c.pk.map(([n]) => <option key={n}>{n}</option>)}<option>Something else</option></select></div>
            <div className="field"><label htmlFor="e-msg">Message</label><textarea id="e-msg" rows="3" value={f.message} onChange={e => u('message', e.target.value)} placeholder={`Hi ${first}, we're getting married at Maleny Manor in November...`} /></div>
            <input type="text" value={f.website} onChange={e => u('website', e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -9999, opacity: 0 }} aria-hidden="true" />
            {err && <p className="fine" style={{ color: 'var(--pink-t)' }}>{err}</p>}
            <button className="btn p" onClick={send} disabled={busy}>{busy ? 'Sending' : 'Send enquiry'} <Icon name="arrow" size={14} /></button>
            <p className="fine">No fee to enquire. {first} replies with a quote you can accept, sign and pay in one place. LensTrybe never takes a cut.{!user && <> Have a client account? <button type="button" className="lnk" onClick={() => { try { sessionStorage.setItem('returnTo', location.pathname) } catch {} nav('/login') }}>Log in</button> and the thread lands in your portal.</>}</p>
          </>}
        </aside>
      </div>
    </div></main>
  )
}
