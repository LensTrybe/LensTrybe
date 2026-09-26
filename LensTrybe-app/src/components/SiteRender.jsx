import { useEffect, useState } from 'react'
import Still from './Still'
import Icon from './Icon'
import { fam, loadFont, onColour, paperOf } from '../lib/brand'
import { fmt } from '../lib/format'
import { nextOpen } from '../lib/avail'
import { nice } from '../lib/store'
import { imageUrl } from '../backend/imageUrl'
import '../styles/site.css'

// The creative's website, rendered from their pages, profile, brand kit, reviews and packages.
// The same component draws the preview in the Website editor and the public profile on Expert
// and Elite, so what they edit is exactly what a client sees.
const KEYS = ['Weddings', 'Real estate', 'Brand and headshots', 'Recent work']
const GRID = { Weddings: [3, 5, 9], 'Real estate': [13, 17, 21], 'Brand and headshots': [23, 29, 31], 'Recent work': [3, 13, 23, 5, 17, 29] }
const im = (u, w) => { if (!u) return u; try { return imageUrl(u, w) || u } catch { return u } }
const Ph = ({ url, seed, mood, tall, rad, w = 700 }) => <span className={'ws-ph' + (tall ? ' tall' : '')} style={{ borderRadius: rad }}>{url ? <img src={im(url, w)} alt="" loading="lazy" /> : <Still seed={seed} mood={mood} />}</span>
const money = v => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return n ? fmt(n) : String(v || '') }
// live: the real site. Pages, photos, packages, reviews and calendar come from the creative's own data.
function LiveSite({ s, page, onPage, compact, live }) {
  const b = s.brand, P = paperOf(b.paper), acc = b.accent, pages = s.pages.filter(p => p.on), pg = pages.find(p => p.id === page) || pages[0]
  useEffect(() => { loadFont(b.head); loadFont(b.body) }, [b.head, b.body])
  const [f, setF] = useState({ name: '', email: '', message: '' }), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [err, setErr] = useState('')
  const H = fam(b.head), Bf = fam(b.body), rad = (b.radius ?? 12) + 'px', c = live.c || {}, photos = c.photos || [], first = String(b.name || '').split(' ')[0]
  const heroUrl = pg?.img || (pg?.id === 'home' ? c.cover || photos[0]?.url : photos[['gallery', 'about', 'services', 'contact'].indexOf(pg?.id) + 1]?.url || c.cover || photos[0]?.url)
  const revs = (c.reviews || []).filter(r => r.r >= 4).sort((a, x) => (x.featured ? 1 : 0) - (a.featured ? 1 : 0)).slice(0, 3)
  const logo = b.logo ? <img src={b.logo} alt="" /> : <span className="wmark" style={{ background: acc }} />
  const today = new Date().toISOString().slice(0, 10)
  const nextOpenSat = (() => { const d = new Date(); for (let i = 1; i < 200; i++) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i); if (x.getDay() !== 6) continue; const k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); if (k > today && !(c.busy || []).includes(k)) return x } return null })()
  const send = async () => { if (busy) return; if (!f.message.trim()) return setErr('Say what you need first.'); if (!f.name.trim() || !/\S+@\S+\.\S+/.test(f.email)) return setErr('Add your name and email so ' + first + ' can reply.'); if (!live.send) return setErr('This is the preview. On your live site this sends an enquiry.'); setBusy(true); setErr(''); try { await live.send(f); setSent(true) } catch (e) { setErr(e.message || 'Could not send. Try again.') } finally { setBusy(false) } }
  const ask = key => <div key={key} className="ws-sec"><b>{key === 'Ask bar' ? 'Ask' : 'Ask in one sentence'}</b>{sent ? <p className="ws-p">Sent. {first} will reply to {f.email} soon.</p> : <><div className="ws-ask" style={{ borderRadius: rad }}><input value={f.message} onChange={e => { setF(o => ({ ...o, message: e.target.value })); setErr('') }} placeholder="What you need, where and when" maxLength={2000} /><button style={{ background: acc, color: onColour(acc), borderRadius: rad }} onClick={send} disabled={busy}>{busy ? 'Sending' : 'Send'}</button></div>{f.message.trim() && <div className="ws-ask ws-ask2" style={{ borderRadius: rad, marginTop: 6 }}><input value={f.name} onChange={e => { setF(o => ({ ...o, name: e.target.value })); setErr('') }} placeholder="Your name" maxLength={120} /><input value={f.email} onChange={e => { setF(o => ({ ...o, email: e.target.value })); setErr('') }} placeholder="Your email" type="email" maxLength={200} /></div>}{err ? <small className="ws-fine" style={{ color: '#d0455f' }}>{err}</small> : <small className="ws-fine">No fee to ask. {first} replies with a quote you can accept, sign and pay in one place.</small>}</>}</div>
  const sec = ([name]) => {
    if (name === 'Hero') return null
    if (name === 'Recent work' || name === 'All work') { const list = name === 'All work' ? photos : photos.slice(0, 6); return <div key={name} className="ws-sec"><b>{name === 'All work' ? 'Work' : name}</b>{list.length ? <div className="ws-grid six">{list.map(x => <Ph key={x.id} url={x.url} rad={`calc(${rad} * .6)`} />)}</div> : <p className="ws-p">Photos from the portfolio show here.</p>}</div> }
    if (name === 'Packages') return <div key={name} className="ws-sec"><b>{name}</b>{(c.pk || []).length ? <div className="ws-pk">{c.pk.map(([n, pr, d], i) => <div key={n + i} className="ws-pc" style={{ borderRadius: rad }}><b style={{ fontFamily: H }}>{n}</b>{pr ? <span style={{ color: acc }}>{money(pr)}</span> : null}{d && <small>{d}</small>}</div>)}</div> : <p className="ws-p">Packages from the profile show here.</p>}</div>
    if (name === 'What clients say' || name === 'Three things clients say') return revs.length ? <div key={name} className="ws-sec"><b>What clients say</b><div className="ws-revs">{revs.map(r => <div key={r.id} className="ws-rev" style={{ borderRadius: rad }}><i style={{ color: acc }}>{'★'.repeat(r.r)}</i><p>{r.text}</p><small>{r.who}{r.kind ? ' · ' + r.kind : ''}</small></div>)}</div></div> : null
    if (name === 'Portrait and story') return <div key={name} className="ws-sec ws-about"><Ph url={pg.img || c.avatar || photos[0]?.url} seed={9} mood="rose" tall rad={rad} w={500} /><div><b>About</b><p style={{ whiteSpace: 'pre-line' }}>{c.about || ''}</p></div></div>
    if (name === 'Ask bar' || name === 'Ask in one sentence') return ask(name)
    if (name === 'Booking link') return <div key={name} className="ws-sec"><b>Book a date</b><div className="ws-book" style={{ borderRadius: rad }}><span>Next open Saturday</span><b style={{ fontFamily: H }}>{nextOpenSat ? nextOpenSat.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Ask for dates'}</b><button style={{ background: acc, color: onColour(acc), borderRadius: rad }} onClick={() => setF(o => ({ ...o, message: o.message || ('Is ' + (nextOpenSat ? nextOpenSat.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'a Saturday soon') + ' free?') }))}>{nextOpenSat ? 'Ask for it' : 'Ask'}</button></div></div>
    if (name === 'Where I work') return <div key={name} className="ws-sec"><b>{name}</b><p className="ws-p">{[c.c, c.state].filter(Boolean).join(', ') || 'Australia'}{(c.areas || []).length ? '. Also ' + c.areas.join(', ') + '.' : '.'}</p></div>
    return null
  }
  return (
    <div className={'wsite' + (compact ? ' compact' : '')} style={{ '--acc': acc, '--pp': P[2], '--pi': P[3], '--rad': rad, fontFamily: Bf, background: P[2], color: P[3] }}>
      <nav className="ws-nav"><span className="ws-brand" style={{ fontFamily: H }}>{logo}{b.name}</span>{pages.length > 1 && pages.map(p => <button key={p.id} type="button" className={pg?.id === p.id ? 'on' : ''} onClick={() => onPage?.(p.id)}>{p.n}</button>)}{pages.some(p => p.id === 'contact') && <button type="button" className="ws-cta" style={{ background: acc, color: onColour(acc), borderRadius: rad }} onClick={() => onPage?.('contact')}>Ask</button>}</nav>
      {pg && <>
        <div className="ws-hero">{heroUrl ? <img className="ws-himg" src={im(heroUrl, 1600)} alt="" /> : <Still seed={3} mood="golden" />}<div className="in"><h2 style={{ fontFamily: H }}>{pg.h}</h2>{pg.p && <p style={{ whiteSpace: 'pre-line' }}>{pg.p}</p>}</div></div>
        <div className="ws-body">{pg.secs.filter(x => x[1]).map(sec)}</div>
      </>}
      <footer className="ws-foot"><span style={{ color: acc }}>{b.name}</span><span>{[c.c, c.state].filter(Boolean).join(', ')}{live.profileUrl ? <> · <a href={live.profileUrl} style={{ color: 'inherit' }}>LensTrybe profile</a></> : null}</span></footer>
    </div>
  )
}
export default function SiteRender({ s, page, onPage, creative, compact = false, onEnquire, live }) {
  if (live) return <LiveSite s={s} page={page} onPage={onPage} compact={compact} live={live} />
  return <DemoSite s={s} page={page} onPage={onPage} creative={creative} compact={compact} onEnquire={onEnquire} />
}
function DemoSite({ s, page, onPage, creative, compact = false, onEnquire }) {
  const b = s.brand, P = paperOf(b.paper), acc = b.accent, pages = s.pages.filter(p => p.on), pg = pages.find(p => p.id === page) || pages[0]
  const [msg, setMsg] = useState('')
  useEffect(() => { loadFont(b.head); loadFont(b.body) }, [b.head, b.body])
  const c = creative || {}, pk = (s.packages && s.packages.length ? s.packages : c.pk) || [['Elopement', 1400, '3 hours · 120 photos'], ['Full day', 3200, '10 hours · 400+ photos'], ['Weekend', 4900, '2 days · second shooter']]
  const revs = (s.reviews || []).filter(r => r.n >= 4).slice(0, 3)
  const H = fam(b.head), Bf = fam(b.body), rad = (b.radius ?? 12) + 'px'
  const logo = dark => (dark ? (b.logoLight || b.logo || b.mark) : (b.logo || b.mark)) ? <img src={dark ? (b.logoLight || b.logo || b.mark) : (b.logo || b.mark)} alt="" /> : <span className="wmark" style={{ background: acc }} />
  const hero = pg?.id === 'work' ? 5 : pg?.id === 'about' ? 9 : pg?.id === 'pricing' ? 13 : pg?.id === 'contact' ? 17 : 3
  const sec = ([name]) => {
    if (name === 'Hero') return null
    if (KEYS.includes(name)) return <div key={name} className="ws-sec"><b>{name}</b><div className={'ws-grid' + (name === 'Recent work' ? ' six' : '')}>{GRID[name].map((sd, i) => <span key={sd} className="ws-ph" style={{ borderRadius: `calc(${rad} * .6)` }}><Still seed={sd} mood={['dusk', 'forest', 'golden', 'rose', 'cool', 'night'][(sd + i) % 6]} /></span>)}</div></div>
    if (name === 'Packages') return <div key={name} className="ws-sec"><b>{name}</b><div className="ws-pk">{pk.map(([n, p, d], i) => <div key={n} className={'ws-pc' + (i === 1 ? ' pop' : '')} style={{ borderRadius: rad, borderColor: i === 1 ? acc : undefined }}><b style={{ fontFamily: H }}>{n}</b><span style={{ color: acc }}>{fmt(p)}</span><small>{d}</small></div>)}</div></div>
    if (name === 'What is included') return <div key={name} className="ws-sec"><b>{name}</b><ul className="ws-list">{['Two photographers on a full day', 'A private online gallery within eight weeks', 'Sneak peek inside a week', 'Travel included within 150 km', 'Print rights for personal use'].map(x => <li key={x}><Icon name="check" size={13} style={{ color: acc }} />{x}</li>)}</ul></div>
    if (name === 'Questions') return <div key={name} className="ws-sec"><b>{name}</b><div className="ws-faq">{[['Do you travel?', 'Anywhere in Queensland worth driving to. Further by arrangement.'], ['How do we book?', 'Send a date below. A quote comes back the same day; a deposit holds it.'], ['Raw files?', 'No. The edit is the work.']].map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div>
    if (name === 'Three things clients say') return <div key={name} className="ws-sec"><b>{name}</b><div className="ws-revs">{revs.map(r => <div key={r.id} className="ws-rev" style={{ borderRadius: rad }}><i style={{ color: acc }}>{'★'.repeat(r.n)}</i><p>{r.t}</p><small>{r.who} · {r.job}</small></div>)}</div></div>
    if (name === 'Portrait and story') return <div key={name} className="ws-sec ws-about"><span className="ws-ph tall" style={{ borderRadius: rad }}><Still seed={9} mood="rose" /></span><div><b>{name}</b><p>{c.about || s.profile.bio}</p></div></div>
    if (name === 'How I work') return <div key={name} className="ws-sec"><b>{name}</b><div className="ws-steps">{['You send a date', 'A quote the same day', 'Deposit holds it', 'The day, as it happens', 'Gallery in eight weeks'].map((x, i) => <span key={x}><i style={{ background: acc, color: onColour(acc) }}>{i + 1}</i>{x}</span>)}</div></div>
    if (name === 'Gear, for the nerds') return <div key={name} className="ws-sec"><b>{name}</b><p className="ws-p">Sony A1 × 2, 35mm and 85mm primes, a Mavic for the listings, and a second body that has been dropped in the Noosa River once.</p></div>
    if (name === 'Ask bar' || name === 'Ask in one sentence') return <div key={name} className="ws-sec"><b>{name === 'Ask bar' ? 'Ask' : name}</b><div className="ws-ask" style={{ borderRadius: rad }}><input value={msg} onChange={e => setMsg(e.target.value)} placeholder="A wedding at Maleny Manor on 7 November, about 90 guests" /><button style={{ background: acc, color: onColour(acc), borderRadius: rad }} onClick={() => onEnquire?.(msg)}>Send</button></div><small className="ws-fine">No fee to ask. {s.profile.n.split(' ')[0]} replies with a quote you can accept, sign and pay in one place.</small></div>
    if (name === 'Booking link') { const A = s.avail || {}; const sat = nextOpen(s, 1, { sat: true })[0], more = A.pub?.show ? nextOpen(s, A.pub?.n || 3) : []; const inst = A.pub?.instant || []; return <div key={name} className="ws-sec"><b>Book a date</b><div className="ws-book" style={{ borderRadius: rad }}><span>{sat ? 'Next open Saturday' : 'Saturdays'}</span><b style={{ fontFamily: H }}>{sat ? nice(sat) : 'Booked out'}</b><button style={{ background: acc, color: onColour(acc), borderRadius: rad }} onClick={() => onEnquire?.(sat ? nice(sat, { weekday: 'long' }) : 'a date')}>{sat ? 'Hold it' : 'Join the waitlist'}</button></div>{more.length > 0 && <p className="ws-p ws-open">Also open {more.map(d => nice(d, { weekday: 'short' })).join(', ')}.{inst.length ? ' ' + inst.join(' and ') + ' can be booked straight away, no enquiry needed.' : ''}</p>}</div> }
    if (name === 'Where I work') return <div key={name} className="ws-sec"><b>{name}</b><p className="ws-p">{s.profile.city}, and anywhere within {s.avail?.radius || 150} km at no extra cost. Brisbane, the Gold Coast and the hinterland every week.</p></div>
    if (name === 'Where I work') return <div key={name} className="ws-sec"><b>{name}</b><p className="ws-p">{s.profile.city}, and anywhere within 150 km at no extra cost. Brisbane, the Gold Coast and the hinterland every week.</p></div>
    return <div key={name} className="ws-sec"><b>{name}</b><span className="ws-bar" /></div>
  }
  return (
    <div className={'wsite' + (compact ? ' compact' : '')} style={{ '--acc': acc, '--pp': P[2], '--pi': P[3], '--rad': rad, fontFamily: Bf, background: P[2], color: P[3] }}>
      <nav className="ws-nav"><span className="ws-brand" style={{ fontFamily: H }}>{logo(b.paper === 'dark')}{b.name}</span>{pages.map(p => <button key={p.id} type="button" className={pg?.id === p.id ? 'on' : ''} onClick={() => onPage?.(p.id)}>{p.n}</button>)}<button type="button" className="ws-cta" style={{ background: acc, color: onColour(acc), borderRadius: rad }} onClick={() => onPage?.('contact')}>Ask</button></nav>
      {pg && <>
        <div className="ws-hero"><Still seed={hero} mood={pg.id === 'about' ? 'rose' : pg.id === 'work' ? 'cool' : 'golden'} /><div className="in"><h2 style={{ fontFamily: H }}>{pg.h}</h2><p>{pg.p}</p>{pg.id === 'home' && <button type="button" className="ws-heroask" style={{ borderRadius: rad }} onClick={() => onPage?.('contact')}>A wedding photographer in Noosa on 14 November, around $3,000 <b style={{ background: acc, color: onColour(acc), borderRadius: rad }}>Ask</b></button>}</div></div>
        <div className="ws-body">{pg.secs.filter(x => x[1]).map(sec)}</div>
      </>}
      <footer className="ws-foot"><span style={{ color: acc }}>{b.foot}</span><span>{b.name}{b.phone ? ' · ' + s.settings.phone : ''}{b.abn ? ' · ABN ' + s.settings.abn : ''}</span></footer>
    </div>
  )
}
