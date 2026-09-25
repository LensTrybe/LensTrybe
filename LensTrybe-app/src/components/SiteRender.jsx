import { useEffect, useState } from 'react'
import Still from './Still'
import Icon from './Icon'
import { fam, loadFont, onColour, paperOf } from '../lib/brand'
import { fmt } from '../lib/format'
import { nextOpen } from '../lib/avail'
import { nice } from '../lib/store'
import '../styles/site.css'

// The creative's website, rendered from their pages, profile, brand kit, reviews and packages.
// The same component draws the preview in the Website editor and the public profile on Expert
// and Elite, so what they edit is exactly what a client sees.
const KEYS = ['Weddings', 'Real estate', 'Brand and headshots', 'Recent work']
const GRID = { Weddings: [3, 5, 9], 'Real estate': [13, 17, 21], 'Brand and headshots': [23, 29, 31], 'Recent work': [3, 13, 23, 5, 17, 29] }
export default function SiteRender({ s, page, onPage, creative, compact = false, onEnquire }) {
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
