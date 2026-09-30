import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../backend/AuthContext'
import { loadSite, sendEnquiry } from '../../lib/live'
import { onColour } from '../../lib/brand'
import { fmt } from '../../lib/format'
import { imageUrl } from '../../backend/imageUrl'
import { LIVE } from '../../lib/mode'

// The creative profile, rebuilt 30 Sep 2026 (Michael: "a fantastic looking, intuitive and state of
// the art profile"). One page per creative, built from what they already filled in: cover, work,
// packages, reviews, about, and a three step enquiry (date, package, a sentence). No website builder.
// Dark(ish) by Michael's call, so the photographs carry the page. /p/<address or id> while it is
// being reviewed; it replaces /creatives/<id> and /site/<address> once signed off.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
const niceDate = s => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) }
const lum = h => { const m = String(h || '').replace('#', '').match(/^([0-9a-f]{6})$/i); if (!m) return 0.5; const n = parseInt(m[1], 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }

const I = {
  back: 'M15 18l-6-6 6-6', share: 'M4 12v7h16v-7M12 3v12M7 8l5-5 5 5', close: 'M6 6l12 12M18 6L6 18', left: 'M15 18l-6-6 6-6', right: 'M9 6l6 6-6 6',
  cal: 'M4 6h16v14H4zM4 10h16M9 3v5M15 3v5', pin: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z',
  check: 'M5 12.5l4.5 4.5L19 7', arrow: 'M5 12h14M13 6l6 6-6 6', ig: 'M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 7h.01', web: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
}
function Ic({ n, s = 18, fill }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={fill ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[n]} /></svg> }

// A photo that fades in over a tiny blurred copy of itself
function Photo({ url, w, alt = '', className = '', eager, onClick, fit }) {
  const [ok, setOk] = useState(false)
  return <div className={'pf-ph ' + className + (ok ? ' ok' : '')} style={{ backgroundImage: `url("${imageUrl(url, 24, 30)}")` }} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? e => { if (e.key === 'Enter') onClick() } : undefined}>
    <img src={imageUrl(url, w)} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setOk(true)} style={fit ? { objectFit: fit } : undefined} />
  </div>
}

function Stars({ r, s = 14 }) { return <span className="pf-stars" aria-label={r + ' out of 5'}>{[1, 2, 3, 4, 5].map(i => <span key={i} className={i <= Math.round(r) ? 'on' : ''}><Ic n="star" s={s} fill /></span>)}</span> }

function Lightbox({ photos, at, onClose, onAt }) {
  const t0 = useRef(null)
  const go = useCallback(d => onAt((at + d + photos.length) % photos.length), [at, photos.length, onAt])
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = o }
  }, [go, onClose])
  useEffect(() => { [1, -1].forEach(d => { const p = photos[(at + d + photos.length) % photos.length]; if (p) { const im = new Image(); im.src = imageUrl(p.url, 1400) } }) }, [at, photos])
  const p = photos[at]
  return <div className="pf-lb" onTouchStart={e => { t0.current = e.touches[0].clientX }} onTouchEnd={e => { if (t0.current == null) return; const dx = e.changedTouches[0].clientX - t0.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); t0.current = null }}>
    <div className="pf-lb-top"><span>{at + 1} / {photos.length}</span><button onClick={onClose} aria-label="Close"><Ic n="close" s={22} /></button></div>
    <LbImg key={p.id} p={p} onClick={() => go(1)} />
    {photos.length > 1 && <><button className="pf-lb-nav l" onClick={() => go(-1)} aria-label="Previous"><Ic n="left" s={26} /></button><button className="pf-lb-nav r" onClick={() => go(1)} aria-label="Next"><Ic n="right" s={26} /></button></>}
    {p.title && <div className="pf-lb-cap">{p.title}</div>}
  </div>
}

// The grid's copy is already cached, so it shows at once and the full size sharpens over it
function LbImg({ p, onClick }) {
  const [ok, setOk] = useState(false)
  return <div className="pf-lb-stage" onClick={onClick}>
    <img src={imageUrl(p.url, 420)} alt="" aria-hidden="true" className="pf-lb-img lo" />
    <img src={imageUrl(p.url, 1400)} alt={p.alt || ''} className={'pf-lb-img hi' + (ok ? ' ok' : '')} onLoad={() => setOk(true)} />
    {!ok && <span className="pf-lb-spin" />}
  </div>
}

function MonthCal({ busy, value, onPick }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [m, setM] = useState(() => { const d = value ? new Date(value + 'T00:00:00') : new Date(today.getTime() + 7 * 864e5); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const first = (m.getDay() + 6) % 7, days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  const canBack = m > new Date(today.getFullYear(), today.getMonth(), 1)
  return <div className="pf-cal">
    <div className="pf-cal-h"><button disabled={!canBack} onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Previous month"><Ic n="left" /></button><b>{MONTHS[m.getMonth()]} {m.getFullYear()}</b><button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Next month"><Ic n="right" /></button></div>
    <div className="pf-cal-g">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={'h' + i} className="h">{d}</span>)}{Array.from({ length: first }, (_, i) => <span key={'p' + i} />)}
      {Array.from({ length: days }, (_, i) => { const d = new Date(m.getFullYear(), m.getMonth(), i + 1), k = iso(d), past = d < today, b = busy.has(k); return <button key={k} disabled={past} className={(b ? 'busy ' : '') + (value === k ? 'sel' : '')} onClick={() => onPick(k)} title={b ? 'Already booked' : 'Free'}>{i + 1}</button> })}
    </div>
    <div className="pf-cal-k"><span><i className="f" />Free</span><span><i className="b" />Already booked</span></div>
  </div>
}

function Enquiry({ c, name, pk, busy, start, signedIn, send, onClose }) {
  const [step, setStep] = useState(start.step || 0), [date, setDate] = useState(start.date || ''), [pkg, setPkg] = useState(start.pkg ?? null)
  const [f, setF] = useState({ msg: '', name: '', email: '', phone: '', website: '' }), [busyS, setBusyS] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false)
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', k); document.body.style.overflow = o } }, [onClose])
  const pkgName = pkg == null ? '' : pkg === -1 ? 'Something else' : pk[pkg]?.[0]
  const submit = async () => {
    setErr(''); if (!f.msg.trim()) return setErr('Say what you need first, one sentence is enough.')
    setBusyS(true)
    try {
      const lines = [date ? 'Date: ' + niceDate(date) : 'Date: not set yet', pkgName ? 'Package: ' + pkgName : ''].filter(Boolean).join('\n')
      await send({ name: f.name, email: f.email, phone: f.phone, website: f.website, message: f.msg.trim() + '\n\n' + lines, subject: (pkgName && pkgName !== 'Something else' ? pkgName : 'Enquiry') + (date ? ' · ' + niceDate(date) : '') })
      setDone(true)
    } catch (e) { setErr(e.message || 'Could not send. Try again.') }
    setBusyS(false)
  }
  const steps = ['When', 'What', 'Details']
  return <div className="pf-sheet-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="pf-sheet" role="dialog" aria-modal="true" aria-label={'Get a quote from ' + name}>
      <div className="pf-sheet-h">
        {c.avatar ? <img src={imageUrl(c.avatar, 44)} alt="" /> : <span className="pf-av0">{name[0]}</span>}
        <div><b>Get a quote from {name}</b><small>No fee to ask. Replies usually within a day.</small></div>
        <button onClick={onClose} aria-label="Close"><Ic n="close" s={20} /></button>
      </div>
      {done ? <div className="pf-done"><span><Ic n="check" s={30} /></span><h3>Sent to {name}</h3><p>The reply comes to {signedIn ? 'your LensTrybe inbox' : f.email || 'your email'}, with a quote you can accept, sign and pay in one place.</p><button className="pf-btn" onClick={onClose}>Back to the profile</button></div> : <>
        <div className="pf-steps">{steps.map((s, i) => <button key={s} className={i === step ? 'on' : i < step ? 'past' : ''} onClick={() => i < step && setStep(i)}><i>{i < step ? <Ic n="check" s={12} /> : i + 1}</i>{s}</button>)}</div>
        <div className="pf-sheet-b">
          {step === 0 && <>
            <h3>When is the job?</h3>
            <MonthCal busy={busy} value={date} onPick={setDate} />
            {date && <div className={'pf-avail ' + (busy.has(date) ? 'b' : 'f')}>{busy.has(date) ? <>{name} is already booked on {niceDate(date)}. You can still ask, plans change.</> : <><Ic n="check" s={15} />{name} is free on {niceDate(date)}.</>}</div>}
          </>}
          {step === 1 && <>
            <h3>What do you need?</h3>
            <div className="pf-opts">{pk.map(([n, p, d], i) => <button key={n + i} className={pkg === i ? 'on' : ''} onClick={() => setPkg(i)}><span><b>{n}</b>{d && <small>{d}</small>}</span><em>{p ? fmt(p) : 'Ask'}</em></button>)}
              <button className={pkg === -1 ? 'on' : ''} onClick={() => setPkg(-1)}><span><b>Something else</b><small>Describe it in the next step</small></span><em /></button></div>
          </>}
          {step === 2 && <>
            <h3>Tell {name} about it</h3>
            <label className="pf-f"><span>The job, in a sentence or two</span><textarea rows={4} autoFocus value={f.msg} onChange={e => setF({ ...f, msg: e.target.value })} placeholder="Product photos for our new menu, about 20 dishes, at our cafe in Paddington." /></label>
            {!signedIn && <div className="pf-row"><label className="pf-f"><span>Your name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" /></label><label className="pf-f"><span>Email</span><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" /></label></div>}
            <label className="pf-f"><span>Phone <i>(optional)</i></span><input type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
            <input className="pf-hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} aria-hidden="true" />
            <div className="pf-sum">{date ? niceDate(date) : 'No date yet'}{pkgName ? ' · ' + pkgName : ''}</div>
          </>}
          {err && <div className="pf-err">{err}</div>}
        </div>
        <div className="pf-sheet-f">
          {step > 0 ? <button className="pf-btn ghost" onClick={() => setStep(step - 1)}>Back</button> : <button className="pf-btn ghost" onClick={() => { setDate(''); setStep(1) }}>No date yet</button>}
          {step < 2 ? <button className="pf-btn" disabled={step === 0 ? !date : pkg == null} onClick={() => setStep(step + 1)}>Next <Ic n="arrow" s={16} /></button> : <button className="pf-btn" disabled={busyS} onClick={submit}>{busyS ? 'Sending' : 'Send to ' + name} <Ic n="arrow" s={16} /></button>}
        </div>
      </>}
    </div>
  </div>
}

export default function Profile({ slug: slugProp }) {
  const params = useParams(); const slug = slugProp || params.slug; const { user, clientAccount } = useAuth()
  const [d, setD] = useState(undefined), [lb, setLb] = useState(null), [enq, setEnq] = useState(null), [all, setAll] = useState(false), [scrolled, setScrolled] = useState(false), [cols, setCols] = useState(3), [copied, setCopied] = useState(false)
  useEffect(() => { let on = true; if (!LIVE) { setD(null); return } loadSite(slug).then(x => on && setD(x)).catch(() => on && setD(null)); return () => { on = false } }, [slug])
  useEffect(() => { const f = () => setScrolled(window.scrollY > window.innerHeight * 0.55); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f) }, [])
  useEffect(() => { const f = () => setCols(window.innerWidth < 640 ? 2 : window.innerWidth < 1100 ? 3 : 4); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  useEffect(() => { if (d?.c) document.title = d.c.n + (d.c.d ? ' · ' + d.c.d : '') + ' · LensTrybe' }, [d])
  const c = d?.c
  const busy = useMemo(() => new Set(c?.busy || []), [c])
  const photos = c?.photos || []
  const shown = all ? photos : photos.slice(0, cols * 3)
  const colsOf = useMemo(() => { const out = Array.from({ length: cols }, () => []); shown.forEach((p, i) => out[i % cols].push([p, i])); return out }, [shown, cols])

  if (d === undefined) return <div className="pf pf-load"><style>{CSS}</style><span /></div>
  if (d === null || !c) return <div className="pf pf-none"><style>{CSS}</style><div><h1>Profile not found</h1><p>This profile isn't available. Check the link and try again.</p><Link className="pf-btn" to="/creatives">Find a creative</Link></div></div>

  const name = c.n, accent = d.brand.accent && lum(d.brand.accent) > 0.06 ? d.brand.accent : '#1DB954', onAcc = onColour(accent)
  const cover = c.cover || photos[0]?.url || '', pk = c.pk || [], from = pk.length ? Math.min(...pk.map(p => p[1]).filter(Boolean)) : 0
  const kinds = [...new Set(Object.values(c.specBy || {}).flat().concat(c.specAny || []))]
  const disc = (d.profile.skill_types || []).join(' and ') || 'Creative'
  const where = [c.c, c.state].filter(Boolean).join(', ')
  const signedIn = !!(user && clientAccount)
  const send = f => sendEnquiry(c.id, f, signedIn ? user : null)
  const open = (start = {}) => setEnq(start)
  const share = async () => { const url = window.location.origin + '/p/' + (d.profile.custom_domain || c.id); try { if (navigator.share) { await navigator.share({ title: name, url }); return } await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* cancelled */ } }
  const bio = String(c.about || '').split(/\n+/).filter(Boolean)
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return <div className="pf" style={{ '--acc': accent, '--on': onAcc }}>
    <style>{CSS}</style>

    <header className={'pf-bar' + (scrolled ? ' on' : '')}>
      <Link to="/creatives" className="pf-back"><Ic n="back" s={16} /><span>Find a creative</span></Link>
      <div className="pf-bar-mid">{c.avatar && <img src={imageUrl(c.avatar, 28)} alt="" />}<b>{name}</b><nav>{photos.length > 0 && <button onClick={() => go('work')}>Work</button>}{pk.length > 0 && <button onClick={() => go('packages')}>Packages</button>}<button onClick={() => go('reviews')}>Reviews</button><button onClick={() => go('about')}>About</button></nav></div>
      <div className="pf-bar-r"><button className="pf-icon" onClick={share} aria-label="Share this profile"><Ic n="share" s={17} />{copied && <em>Link copied</em>}</button><button className="pf-btn sm" onClick={() => open()}>Get a quote</button></div>
    </header>

    <section className="pf-hero">
      {cover ? <Photo url={cover} w={1600} eager className="pf-cover" /> : <div className="pf-cover pf-cover0" />}
      <div className="pf-hero-in">
        <div className="pf-hero-l">
          <div className="pf-who">{c.avatar ? <img src={imageUrl(c.avatar, 64)} alt="" /> : <span className="pf-av0 lg">{name[0]}</span>}<span>{disc}{where && <> · <Ic n="pin" s={13} /> {where}</>}</span></div>
          <h1>{name}</h1>
          {c.d && c.d !== disc && <p className="pf-tag">{c.d}</p>}
          <div className="pf-chips">
            {c.rv ? <span className="pf-chip"><Stars r={c.r} s={12} /> {c.r} · {c.rv} {c.rv === 1 ? 'review' : 'reviews'}</span> : <span className="pf-chip">New on LensTrybe</span>}
            {c.found && <span className="pf-chip acc">Founding creative</span>}
            {c.free && <span className="pf-chip"><i className="dot" />Taking bookings</span>}
          </div>
          <div className="pf-ctas"><button className="pf-btn lg" onClick={() => open()}>Get a quote <Ic n="arrow" s={17} /></button><button className="pf-btn ghost lg" onClick={() => open({ step: 0 })}><Ic n="cal" s={17} />Check a date</button></div>
        </div>
        {from > 0 && <div className="pf-from"><small>Packages from</small><b>{fmt(from)}</b></div>}
      </div>
      {photos.length > 0 && <button className="pf-scroll" onClick={() => go('work')} aria-label="See the work"><span /></button>}
    </section>

    <main className="pf-main">
      {photos.length > 0 && <section id="work" className="pf-sec">
        <div className="pf-sec-h"><h2>The work</h2><span>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span></div>
        {kinds.length > 0 && <div className="pf-kinds">{kinds.map(k => <span key={k}>{k}</span>)}</div>}
        <div className="pf-grid">{colsOf.map((col, ci) => <div key={ci} className="pf-col">{col.map(([p, i]) => <Photo key={p.id} url={p.url} w={cols === 2 ? 360 : 420} alt={p.alt} className="pf-tile" eager={i < cols * 2} onClick={() => setLb(i)} />)}</div>)}</div>
        {photos.length > cols * 3 && <div className="pf-more"><button className="pf-btn ghost" onClick={() => { if (all) go('work'); setAll(!all) }}>{all ? 'Show fewer' : <><Ic n="grid" s={16} />Show all {photos.length} photos</>}</button></div>}
      </section>}

      {pk.length > 0 && <section id="packages" className="pf-sec">
        <div className="pf-sec-h"><h2>Packages</h2><span>Prices in AUD</span></div>
        <div className="pf-pk">{pk.map(([n, p, desc], i) => <div key={n + i} className="pf-card">
          <b className="pf-pk-n">{n}</b>
          <div className="pf-pk-p">{p ? fmt(p) : 'On request'}</div>
          {desc && <p>{desc}</p>}
          <button className="pf-btn ghost full" onClick={() => open({ step: 0, pkg: i })}>Choose this</button>
        </div>)}</div>
        <p className="pf-fine"><Ic n="shield" s={14} />No fee to ask. {name} sends a quote you can accept, sign and pay in one place, and LensTrybe never takes a cut.</p>
      </section>}

      <section id="reviews" className="pf-sec">
        <div className="pf-sec-h"><h2>Reviews</h2>{c.rv > 0 && <span><Stars r={c.r} /> {c.r} from {c.rv}</span>}</div>
        {c.reviews?.length ? <div className="pf-revs">{c.reviews.slice(0, 6).map(r => <figure key={r.id} className="pf-card pf-rev">
          <Stars r={r.r} />
          <blockquote>{r.text}</blockquote>
          <figcaption><b>{r.who}</b><span>{[r.kind, r.when && new Date(r.when).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })].filter(Boolean).join(' · ')}</span>{r.verified && <em><Ic n="check" s={12} />Booked through LensTrybe</em>}</figcaption>
          {r.reply && <div className="pf-reply"><b>{name} replied</b>{r.reply}</div>}
        </figure>)}</div>
          : <div className="pf-card pf-empty"><Ic n="shield" s={22} /><div><b>No reviews yet</b><p>Reviews on LensTrybe only come from real bookings, so every one that appears here is genuine.</p></div></div>}
      </section>

      <section id="about" className="pf-sec pf-about">
        <div className="pf-about-img">{c.avatar ? <Photo url={c.avatar} w={520} alt={name} /> : <div className="pf-ph pf-cover0" />}</div>
        <div>
          <h2>About {name}</h2>
          {bio.length ? bio.map((t, i) => <p key={i} className="pf-bio">{t}</p>) : <p className="pf-bio">{c.d}</p>}
          <dl className="pf-facts">
            {kinds.length > 0 && <div><dt>Shoots</dt><dd>{kinds.join(', ')}</dd></div>}
            {where && <div><dt>Based in</dt><dd>{where}</dd></div>}
            {c.areas?.length > 0 && <div><dt>Travels to</dt><dd>{c.areas.join(', ')}</dd></div>}
            {c.years && <div><dt>Experience</dt><dd>{c.years} years</dd></div>}
          </dl>
          {(c.ig || c.web) && <div className="pf-links">{c.ig && <a href={c.ig} target="_blank" rel="noopener noreferrer"><Ic n="ig" s={16} />Instagram</a>}{c.web && <a href={c.web} target="_blank" rel="noopener noreferrer"><Ic n="web" s={16} />Website</a>}</div>}
        </div>
      </section>

      <section className="pf-end">
        <h2>Tell {name} about your job</h2>
        <p>Pick a date, choose a package, add a sentence. That's it.</p>
        <button className="pf-btn lg" onClick={() => open()}>Get a quote <Ic n="arrow" s={17} /></button>
      </section>
    </main>

    <footer className="pf-foot"><Link to="/"><img src="/logo-white.svg" alt="LensTrybe" /></Link><span>Connect. Capture. Create. · No commission, ever.</span><Link to="/creatives">More creatives</Link></footer>

    <div className="pf-dock">{from > 0 ? <div><small>From</small><b>{fmt(from)}</b></div> : <div><b>{name}</b></div>}<button className="pf-btn ghost" onClick={() => open({ step: 0 })} aria-label="Check a date"><Ic n="cal" s={17} /></button><button className="pf-btn" onClick={() => open()}>Get a quote</button></div>

    {lb != null && <Lightbox photos={photos} at={lb} onAt={setLb} onClose={() => setLb(null)} />}
    {enq && <Enquiry c={c} name={name} pk={pk} busy={busy} start={enq} signedIn={signedIn} send={send} onClose={() => setEnq(null)} />}
  </div>
}

const CSS = `
.pf{--bg:#0e0e13;--s1:#16161d;--s2:#1d1d26;--ln:rgba(255,255,255,.09);--tx:#f5f5f7;--mu:#a3a2b1;--di:#6f6e7d;background:var(--bg);color:var(--tx);min-height:100dvh;font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:clip}
.pf *{box-sizing:border-box}.pf button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}.pf a{color:inherit;text-decoration:none}
.pf-load{display:grid;place-items:center}.pf-load span{width:34px;height:34px;border-radius:50%;border:2px solid var(--ln);border-top-color:#1DB954;animation:pfspin .8s linear infinite}@keyframes pfspin{to{transform:rotate(360deg)}}
.pf-none{display:grid;place-items:center;text-align:center;padding:24px}.pf-none h1{font-size:28px;margin:0 0 8px}.pf-none p{color:var(--mu);margin:0 0 20px}
.pf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;background:var(--acc)!important;color:var(--on)!important;font-weight:650;font-size:15px;letter-spacing:-.01em;transition:transform .15s,filter .15s,opacity .15s;white-space:nowrap}
.pf-btn:hover{filter:brightness(1.08)}.pf-btn:active{transform:scale(.97)}.pf-btn:disabled{opacity:.4;cursor:default;filter:none}
.pf-btn.ghost{background:rgba(255,255,255,.08)!important;color:var(--tx)!important;box-shadow:inset 0 0 0 1px var(--ln)}.pf-btn.ghost:hover{background:rgba(255,255,255,.13)!important}
.pf-btn.lg{height:52px;padding:0 26px;font-size:16px}.pf-btn.sm{height:38px;padding:0 16px;font-size:14px}.pf-btn.full{width:100%}
.pf-ph{position:relative;overflow:hidden;background-size:cover;background-position:center;background-color:var(--s1)}
.pf-ph img{display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .5s ease,transform .6s ease}.pf-ph.ok img{opacity:1}
.pf-bar{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;gap:16px;height:64px;padding:0 max(20px,env(safe-area-inset-left));transition:background .3s,box-shadow .3s}
.pf-bar.on{background:rgba(14,14,19,.94);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);box-shadow:0 1px 0 var(--ln)}
.pf-back{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:550;padding:8px 12px 8px 8px;border-radius:999px;background:rgba(0,0,0,.35);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}.pf-bar.on .pf-back{background:none}
.pf-bar-mid{flex:1;display:flex;align-items:center;gap:10px;min-width:0;opacity:0;transform:translateY(-4px);transition:opacity .25s,transform .25s;pointer-events:none}.pf-bar.on .pf-bar-mid{opacity:1;transform:none;pointer-events:auto}
.pf-bar-mid img{width:28px;height:28px;border-radius:50%;object-fit:cover}.pf-bar-mid b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-bar-mid nav{display:flex;gap:2px;margin-left:14px}.pf-bar-mid nav button{font-size:14px;color:var(--mu);padding:8px 12px;border-radius:999px}.pf-bar-mid nav button:hover{color:var(--tx);background:rgba(255,255,255,.06)}
.pf-bar-r{display:flex;align-items:center;gap:8px;margin-left:auto}.pf-bar-r .pf-btn{opacity:0;pointer-events:none;transition:opacity .25s}.pf-bar.on .pf-bar-r .pf-btn{opacity:1;pointer-events:auto}
.pf-icon{position:relative;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.35);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}.pf-bar.on .pf-icon{background:rgba(255,255,255,.07)}
.pf-icon em{position:absolute;top:46px;right:0;font-style:normal;font-size:12px;background:var(--s2);padding:6px 10px;border-radius:8px;white-space:nowrap}
.pf-hero{position:relative;height:min(88vh,860px);min-height:560px;display:flex;align-items:flex-end}
.pf-cover{position:absolute;inset:0}.pf-cover img{object-position:center 40%;animation:pfzoom 14s ease-out both}@keyframes pfzoom{from{transform:scale(1.07)}to{transform:scale(1)}}
.pf-cover0{background:radial-gradient(120% 90% at 70% 10%,#2a2a36,#0e0e13)}
.pf-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,14,19,.55) 0%,rgba(14,14,19,0) 22%,rgba(14,14,19,0) 42%,rgba(14,14,19,.72) 72%,var(--bg) 100%);pointer-events:none}
.pf-hero-in{position:relative;z-index:2;width:100%;max-width:1280px;margin:0 auto;padding:0 32px 64px;display:flex;align-items:flex-end;justify-content:space-between;gap:32px}
.pf-hero-l{max-width:760px;animation:pfup .8s .1s ease both}@keyframes pfup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.pf-who{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:550;color:rgba(255,255,255,.86)}.pf-who img{width:48px;height:48px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(255,255,255,.9)}.pf-who span{display:inline-flex;align-items:center;gap:5px}
.pf-av0{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--acc);color:var(--on);font-weight:700}.pf-av0.lg{width:48px;height:48px;font-size:20px}
.pf-hero h1{font-size:clamp(44px,7.6vw,104px);line-height:.95;font-weight:700;letter-spacing:-.045em;margin:18px 0 0;text-wrap:balance;text-shadow:0 2px 30px rgba(0,0,0,.3)}
.pf-tag{font-size:clamp(17px,1.6vw,21px);line-height:1.45;color:rgba(255,255,255,.82);margin:16px 0 0;max-width:600px}
.pf-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.pf-chip{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border-radius:999px;font-size:13px;font-weight:550;background:rgba(255,255,255,.1);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.pf-chip.acc{background:color-mix(in srgb,var(--acc) 22%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 50%,transparent)}.pf-chip .dot{width:7px;height:7px;border-radius:50%;background:#1DB954;box-shadow:0 0 0 3px rgba(29,185,84,.25)}
.pf-ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}
.pf-from{text-align:right;animation:pfup .8s .25s ease both;flex-shrink:0}.pf-from small{display:block;font-size:13px;color:rgba(255,255,255,.7)}.pf-from b{font-size:40px;letter-spacing:-.03em;font-weight:700}
.pf-scroll{position:absolute;z-index:3;left:50%;bottom:18px;transform:translateX(-50%);width:26px;height:40px;border-radius:14px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35)}.pf-scroll span{position:absolute;left:50%;top:8px;width:3px;height:8px;margin-left:-1.5px;border-radius:2px;background:#fff;animation:pfdot 1.8s infinite}@keyframes pfdot{0%{opacity:0;transform:translateY(0)}30%{opacity:1}100%{opacity:0;transform:translateY(12px)}}
.pf-main{max-width:1280px;margin:0 auto;padding:0 32px}
.pf-sec{padding:72px 0 8px;scroll-margin-top:72px}.pf-sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:22px}
.pf-sec h2,.pf-end h2{font-size:clamp(28px,3.4vw,40px);font-weight:700;letter-spacing:-.035em;margin:0}.pf-sec-h>span{color:var(--mu);font-size:14px;display:inline-flex;align-items:center;gap:8px}
.pf-kinds{display:flex;flex-wrap:wrap;gap:6px;margin:-8px 0 22px}.pf-kinds span{font-size:13px;color:var(--mu);padding:6px 12px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--ln)}
.pf-grid{display:flex;gap:10px;align-items:flex-start}.pf-col{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}
.pf-tile{border-radius:12px;cursor:zoom-in;min-height:120px}.pf-tile img{height:auto}.pf-tile.ok{min-height:0}.pf-tile:hover img{transform:scale(1.035)}.pf-tile:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.pf-more{display:flex;justify-content:center;margin-top:26px}
.pf-card{background:var(--s1);border-radius:18px;box-shadow:inset 0 0 0 1px var(--ln)}
.pf-pk{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.pf-pk .pf-card{padding:26px;display:flex;flex-direction:column;gap:6px;transition:transform .2s,box-shadow .2s}.pf-pk .pf-card:hover{transform:translateY(-3px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 55%,transparent),0 18px 40px rgba(0,0,0,.35)}
.pf-pk-n{font-size:15px;color:var(--mu);font-weight:600}.pf-pk-p{font-size:38px;font-weight:700;letter-spacing:-.035em}.pf-pk .pf-card p{color:var(--mu);margin:0 0 14px;font-size:15px;line-height:1.55;flex:1}
.pf-fine{display:flex;align-items:center;gap:8px;color:var(--di);font-size:13.5px;margin:18px 0 0;line-height:1.5}.pf-fine svg{flex-shrink:0}
.pf-stars{display:inline-flex;gap:1px;color:rgba(255,255,255,.2)}.pf-stars .on{color:#f5b301}
.pf-revs{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.pf-rev{margin:0;padding:24px}.pf-rev blockquote{margin:12px 0 16px;font-size:17px;line-height:1.55;letter-spacing:-.01em}
.pf-rev figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:13px;color:var(--mu)}.pf-rev figcaption b{color:var(--tx);font-size:14px}.pf-rev em{display:inline-flex;align-items:center;gap:4px;font-style:normal;color:#5fd68c}
.pf-reply{margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--s2);font-size:14px;color:var(--mu);line-height:1.5}.pf-reply b{display:block;color:var(--tx);font-size:13px;margin-bottom:4px}
.pf-empty{display:flex;gap:16px;align-items:flex-start;padding:24px;color:var(--mu)}.pf-empty svg{flex-shrink:0;color:var(--acc);margin-top:2px}.pf-empty b{color:var(--tx);font-size:16px}.pf-empty p{margin:4px 0 0;line-height:1.55;font-size:15px}
.pf-about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:56px;align-items:center}.pf-about-img .pf-ph{aspect-ratio:4/5;border-radius:22px}.pf-about h2{margin-bottom:18px}
.pf-bio{font-size:18px;line-height:1.7;color:#d6d5de;margin:0 0 14px}
.pf-facts{display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;margin:26px 0 0;padding:22px 0 0;box-shadow:0 -1px 0 var(--ln)}.pf-facts dt{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--di);font-weight:600}.pf-facts dd{margin:5px 0 0;font-size:15px;line-height:1.5}
.pf-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.pf-links a{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;font-size:14px;font-weight:550;box-shadow:inset 0 0 0 1px var(--ln)}.pf-links a:hover{background:rgba(255,255,255,.06)}
.pf-end{margin:88px 0 0;padding:64px 32px;text-align:center;border-radius:28px;background:radial-gradient(90% 120% at 50% 0%,color-mix(in srgb,var(--acc) 20%,var(--s1)),var(--s1));box-shadow:inset 0 0 0 1px var(--ln)}.pf-end p{color:var(--mu);font-size:17px;margin:12px 0 26px}
.pf-foot{max-width:1280px;margin:0 auto;padding:40px 32px 48px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;color:var(--di);font-size:13px}.pf-foot img{height:22px;display:block;opacity:.8}.pf-foot a:last-child{margin-left:auto;color:var(--mu)}
.pf-dock{display:none}
.pf-lb{position:fixed;inset:0;z-index:80;background:#000;display:grid;place-items:center;animation:pffade .2s ease}@keyframes pffade{from{opacity:0}}
.pf-lb-stage{position:relative;display:grid;place-items:center;width:100vw;height:100dvh}.pf-lb-img{grid-area:1/1;width:100vw;height:100dvh;object-fit:contain;user-select:none;-webkit-user-select:none}.pf-lb-img.lo{animation:pffade .2s ease;filter:blur(6px);transform:scale(1.001)}.pf-lb-img.hi{opacity:0;transition:opacity .35s}.pf-lb-img.hi.ok{opacity:1}.pf-lb-spin{position:absolute;width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;animation:pfspin .8s linear infinite}
.pf-lb-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:16px 16px 16px 22px;font-size:14px;color:rgba(255,255,255,.75);z-index:2;background:linear-gradient(rgba(0,0,0,.5),transparent)}.pf-lb-top button{width:44px;height:44px;display:grid;place-items:center;border-radius:50%}.pf-lb-top button:hover{background:rgba(255,255,255,.1)}
.pf-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.08)}.pf-lb-nav:hover{background:rgba(255,255,255,.16)}.pf-lb-nav.l{left:18px}.pf-lb-nav.r{right:18px}
.pf-lb-cap{position:absolute;bottom:22px;left:0;right:0;text-align:center;font-size:14px;color:rgba(255,255,255,.8)}
.pf-sheet-bg{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:grid;place-items:center;padding:20px;animation:pffade .2s ease}
.pf-sheet{width:100%;max-width:540px;max-height:calc(100dvh - 40px);display:flex;flex-direction:column;background:var(--s1);border-radius:24px;box-shadow:inset 0 0 0 1px var(--ln),0 30px 80px rgba(0,0,0,.5);animation:pfup .3s ease;overflow:hidden}
.pf-sheet-h{display:flex;align-items:center;gap:12px;padding:18px 18px 14px 22px}.pf-sheet-h img{width:40px;height:40px;border-radius:50%;object-fit:cover}.pf-sheet-h div{flex:1;min-width:0}.pf-sheet-h b{display:block;font-size:16px}.pf-sheet-h small{color:var(--mu);font-size:13px}.pf-sheet-h>button{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;flex-shrink:0}.pf-sheet-h>button:hover{background:rgba(255,255,255,.07)}
.pf-steps{display:flex;gap:6px;padding:0 22px 6px}.pf-steps button{flex:1;display:flex;align-items:center;gap:7px;font-size:13px;color:var(--di);padding:10px 0;border-top:2px solid var(--ln);cursor:default;white-space:nowrap;overflow:hidden}.pf-steps button.past{cursor:pointer;color:var(--mu);border-color:color-mix(in srgb,var(--acc) 60%,transparent)}.pf-steps button.on{color:var(--tx);border-color:var(--acc)}
.pf-steps i{font-style:normal;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--s2);flex-shrink:0}.pf-steps .on i,.pf-steps .past i{background:var(--acc);color:var(--on)}
.pf-sheet-b{padding:10px 22px 8px;overflow-y:auto;-webkit-overflow-scrolling:touch}.pf-sheet-b h3{font-size:22px;letter-spacing:-.02em;margin:8px 0 16px}
.pf-sheet-f{display:flex;justify-content:space-between;gap:10px;padding:14px 22px 20px;box-shadow:0 -1px 0 var(--ln)}
.pf-cal{background:var(--s2);border-radius:16px;padding:14px}.pf-cal-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.pf-cal-h b{font-size:15px}.pf-cal-h button{width:36px;height:36px;border-radius:50%;display:grid;place-items:center}.pf-cal-h button:hover:not(:disabled){background:rgba(255,255,255,.08)}.pf-cal-h button:disabled{opacity:.25;cursor:default}
.pf-cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.pf-cal-g .h{text-align:center;font-size:11px;color:var(--di);font-weight:600;padding:4px 0}
.pf-cal-g button{height:40px;border-radius:10px;font-size:14px;font-weight:550;display:grid;place-items:center;transition:background .15s}.pf-cal-g button:hover:not(:disabled){background:rgba(255,255,255,.08)}.pf-cal-g button:disabled{color:var(--di);opacity:.45;cursor:default}
.pf-cal-g button.busy{color:var(--di);text-decoration:line-through}.pf-cal-g button.sel{background:var(--acc)!important;color:var(--on);text-decoration:none}
.pf-cal-k{display:flex;gap:16px;margin-top:10px;font-size:12px;color:var(--mu)}.pf-cal-k span{display:flex;align-items:center;gap:6px}.pf-cal-k i{width:8px;height:8px;border-radius:50%}.pf-cal-k .f{background:var(--tx)}.pf-cal-k .b{background:var(--di)}
.pf-avail{display:flex;align-items:center;gap:8px;margin-top:12px;padding:12px 14px;border-radius:12px;font-size:14px;line-height:1.45}.pf-avail.f{background:rgba(29,185,84,.12);color:#7fe0a3}.pf-avail.b{background:rgba(245,158,11,.12);color:#f7c46b}
.pf-opts{display:flex;flex-direction:column;gap:8px}.pf-opts button{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:16px 18px;border-radius:14px;background:var(--s2);box-shadow:inset 0 0 0 1px var(--ln);transition:box-shadow .15s}
.pf-opts button span{display:flex;flex-direction:column;gap:3px}.pf-opts b{font-size:15px}.pf-opts small{font-size:13px;color:var(--mu)}.pf-opts em{font-style:normal;font-weight:700;font-size:17px}.pf-opts button.on{box-shadow:inset 0 0 0 2px var(--acc)}
.pf-f{display:block;margin-bottom:12px}.pf-f span{display:block;font-size:13px;font-weight:550;color:var(--mu);margin-bottom:6px}.pf-f i{font-style:normal;color:var(--di);font-weight:400}
.pf-f input,.pf-f textarea{width:100%;font:inherit;font-size:16px;color:var(--tx);background:var(--s2);border:0;border-radius:12px;padding:13px 14px;box-shadow:inset 0 0 0 1px var(--ln);outline:none;resize:vertical}.pf-f input:focus,.pf-f textarea:focus{box-shadow:inset 0 0 0 2px var(--acc)}
.pf-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pf-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.pf-sum{font-size:13px;color:var(--mu);padding:4px 0 6px}.pf-err{margin:8px 0 4px;padding:11px 14px;border-radius:12px;background:rgba(255,45,120,.12);color:#ff8fb4;font-size:14px}
.pf-done{text-align:center;padding:20px 28px 30px}.pf-done span{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--acc);color:var(--on);animation:pfpop .4s cubic-bezier(.2,1.4,.4,1)}@keyframes pfpop{from{transform:scale(.4);opacity:0}}
.pf-done h3{font-size:24px;letter-spacing:-.02em;margin:18px 0 8px}.pf-done p{color:var(--mu);line-height:1.55;margin:0 auto 22px;max-width:380px}
@media (max-width:900px){.pf-about{grid-template-columns:1fr;gap:28px}.pf-about-img{max-width:420px}.pf-bar-mid nav{display:none}}
@media (max-width:640px){
  .pf-bar{height:56px;padding:0 12px}.pf-back span{display:none}.pf-back{padding:8px}.pf-bar-r .pf-btn{display:none}
  .pf-hero{height:auto;min-height:0;display:block}.pf-cover{position:relative;height:58vh;min-height:360px}.pf-hero::after{height:58vh;min-height:360px;background:linear-gradient(180deg,rgba(14,14,19,.5) 0%,rgba(14,14,19,0) 25%,rgba(14,14,19,0) 55%,var(--bg) 100%)}
  .pf-hero-in{flex-direction:column;align-items:stretch;padding:0 16px 8px;margin-top:-96px;gap:0}.pf-from,.pf-scroll{display:none}
  .pf-hero h1{font-size:44px;margin-top:14px}.pf-tag{font-size:16px;margin-top:10px}.pf-ctas{display:none}.pf-chips{margin-top:16px}
  .pf-main{padding:0 16px}.pf-sec{padding-top:48px}.pf-grid,.pf-col{gap:6px}.pf-tile{border-radius:8px}
  .pf-pk{grid-template-columns:1fr}.pf-pk .pf-card{padding:20px}.pf-pk-p{font-size:32px}.pf-revs{grid-template-columns:1fr}
  .pf-bio{font-size:16px}.pf-facts{grid-template-columns:1fr}
  .pf-end{margin-top:56px;padding:40px 20px;border-radius:22px}.pf-foot{padding:32px 16px 110px}
  .pf-dock{display:flex;align-items:center;gap:8px;position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:45;padding:8px 8px 8px 18px;border-radius:999px;background:rgba(29,29,38,.86);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);box-shadow:inset 0 0 0 1px var(--ln),0 12px 30px rgba(0,0,0,.45)}
  .pf-dock div{flex:1;min-width:0;line-height:1.1}.pf-dock small{display:block;font-size:11px;color:var(--mu)}.pf-dock b{font-size:18px;letter-spacing:-.02em}.pf-dock .ghost{width:44px;padding:0}
  .pf-sheet-bg{padding:0;place-items:end stretch}.pf-sheet{max-width:none;border-radius:24px 24px 0 0;max-height:92dvh;padding-bottom:env(safe-area-inset-bottom)}.pf-row{grid-template-columns:1fr}
  .pf-lb-nav{display:none}
}
@media (prefers-reduced-motion:reduce){.pf *{animation:none!important;transition:none!important}}
`
