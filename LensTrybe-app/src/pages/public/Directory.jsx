import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { outside, waitlistTo } from '../../lib/region'
import Aurora from '../../components/Aurora'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { CREATIVES, freeOn } from '../../data/creatives'
import DatePicker, { fmtDate } from '../../components/DatePicker'
import SpecialtyPicker from '../../components/SpecialtyPicker'
import { matchesSpecialty, TAG_FOR } from '../../lib/specialties'
import { fmt } from '../../lib/format'

const PLACES = ['Noosa', 'Sunshine Coast', 'Brisbane', 'Gold Coast']

// Find a creative: the browsable version of the constellation. A dark opener with the lens and a
// sentence bar that hands off to the ask, then a glass filter bar and the grid on light.
export default function Directory() {
  if (outside()) return <Navigate to={waitlistTo('client')} replace />
  const nav = useNavigate()
  const [params] = useSearchParams()
  const cv = useRef(null), slot = useRef(null), bar = useRef(null)
  const [q, setQ] = useState('')
  const [disc, setDisc] = useState('all')
  const [spec, setSpec] = useState(() => { const s = params.get('s'); const name = s && Object.keys(TAG_FOR).find(k => TAG_FOR[k] === s); return new Set(name ? [name] : []) })
  const [budget, setBudget] = useState(8000), [date, setDate] = useState(null), [found, setFound] = useState(false)
  const [place, setPlace] = useState(''), [view, setView] = useState('grid'), [sort, setSort] = useState('match')
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  // The filter bar is always on screen: it rides at the foot of the viewport while the opener is showing,
  // travels up with the page as you scroll, and settles under the header where it stays.
  useEffect(() => {
    const s = slot.current, b = bar.current; if (!s || !b) return
    let raf = 0
    const place = () => {
      raf = 0
      if (innerWidth <= 900) { b.style.cssText = ''; s.style.height = ''; return }
      const r = s.getBoundingClientRect(), h = b.offsetHeight
      s.style.height = h + 'px'
      const top = Math.max(84, Math.min(r.top, innerHeight - h - 22))
      b.style.cssText = `position:fixed;left:${r.left}px;width:${r.width}px;top:${top}px;z-index:6`
      const hero = document.querySelector('.dirhero'); const hb = hero ? hero.getBoundingClientRect().bottom : 0
      b.classList.toggle('docked', top + h / 2 < hb)
      b.classList.toggle('stuck', r.top < 84)
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(place) }
    place(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on)
    const ro = new ResizeObserver(on); ro.observe(b); ro.observe(document.body)
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])
  const list = useMemo(() => {
    let l = CREATIVES.filter(x => disc === 'all' || x.t.includes(disc))
    if (spec.size) l = l.filter(x => [...spec].some(s => matchesSpecialty(x, s)))
    l = l.filter(x => x.p <= budget)
    if (date) l = l.filter(x => freeOn(x, date))
    if (found) l = l.filter(x => x.found)
    if (place) l = l.filter(x => (x.c + ' ' + x.state).toLowerCase().includes(place.toLowerCase()) || (place === 'Sunshine Coast' && ['Noosa', 'Sunshine Beach', 'Maroochydore', 'Maleny'].includes(x.c)) || (place === 'Brisbane' && ['Brisbane', 'West End', 'Fortitude Valley'].includes(x.c)))
    if (sort === 'price') l = [...l].sort((a, b) => a.p - b.p)
    if (sort === 'rating') l = [...l].sort((a, b) => b.r - a.r || b.rv - a.rv)
    return l
  }, [disc, spec, budget, date, found, place, sort])
  const active = spec.size + (budget < 8000) + (date ? 1 : 0) + found + (place ? 1 : 0) + (disc !== 'all')
  const clear = () => { setDisc('all'); setSpec(new Set()); setBudget(8000); setDate(null); setFound(false); setPlace('') }
  const ask = e => { e.preventDefault(); if (q.trim()) nav('/?q=' + encodeURIComponent(q.trim() + (date && !/\d/.test(q) ? ' on ' + fmtDate(date) : ''))) }
  return (
    <>
      <section className="hiw dirhero dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">Find a creative</p>
          <h1><span className="ln"><span>Every creative,</span></span> <span className="ln"><span>free on <em>your date.</em></span></span></h1>
          <p className="sub">Photographers and videographers across Queensland, with live calendars and real prices. Browse below, or say what you need and let the lens find them.</p>
          <form className="sbar" onSubmit={ask} role="search">
            <span className="lens" aria-hidden="true" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="A brand film for a café in Brisbane next month, $2,500" aria-label="Describe what you need" />
            <SpecialtyPicker value={spec} onChange={setSpec} disc={disc} dark />
            <DatePicker value={date} onChange={setDate} label="Any date" dark />
            <button type="submit" className="go"><span>Find them</span><Icon name="arrow" size={14} /></button>
          </form>
          <button type="button" className="browse" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}>Or browse everyone <Icon name="arrow" size={13} /></button>
        </div>
      </section>

      <div className="lt">
        <Aurora />
        <section className="sec" id="results" style={{ paddingTop: 'clamp(28px,4vw,48px)' }}><div className="wrap">
          <div className="fslot" ref={slot} />
          {createPortal(<div className="pub" style={{ display: 'contents' }}><div className="fbar lg" ref={bar}>
            <div className="seg"><button className={disc === 'all' ? 'on' : ''} onClick={() => setDisc('all')}>All</button><button className={disc === 'photo' ? 'on' : ''} onClick={() => setDisc('photo')}>Photo</button><button className={disc === 'video' ? 'on' : ''} onClick={() => setDisc('video')}>Video</button></div>
            <SpecialtyPicker value={spec} onChange={setSpec} disc={disc} />
            <div className="sel"><Icon name="pin" size={14} /><select value={place} onChange={e => setPlace(e.target.value)} aria-label="Where"><option value="">Anywhere in QLD</option>{PLACES.map(p => <option key={p}>{p}</option>)}</select></div>
            <div className="bud"><span>Up to <b>{fmt(budget)}</b></span><input type="range" min="500" max="8000" step="100" value={budget} onChange={e => setBudget(+e.target.value)} aria-label="Budget, full day" /></div>
            <DatePicker value={date} onChange={setDate} label="Any date" />
            <label className={'tog' + (found ? ' on' : '')}><input type="checkbox" checked={found} onChange={e => setFound(e.target.checked)} /><i /><span>Founding only</span></label>
            {active > 0 && <button className="clear" onClick={clear}>Clear</button>}
          </div></div>, document.body)}

          <div className="rbar rv">
            <span><b>{list.length}</b> {list.length === 1 ? 'creative' : 'creatives'}{date ? ' free ' + fmtDate(date) : ''}, sorted by <b>{sort === 'match' ? 'best match' : sort}</b></span>
            <div className="ctl">
              <div className="seg">{[['match', 'Best match'], ['price', 'Price'], ['rating', 'Rating']].map(([k, l]) => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>)}</div>
              <div className="seg"><button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><Icon name="grid" size={14} />Grid</button><button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}><Icon name="pin" size={14} />Map</button></div>
            </div>
          </div>

          {view === 'grid'
            ? (list.length ? <div className="cgrid rv">{list.map((x, i) => <Card key={x.id} x={x} i={i} date={date} />)}</div> : <div className="empty lg">Nobody matches those filters yet. Widen the budget, drop a specialty, or <Link to="/" style={{ color: 'var(--green-t)', fontWeight: 600 }}>ask the lens</Link> instead.</div>)
            : <MapView list={list} />}

          <div className="closer lg rv" style={{ marginTop: 'clamp(40px,6vw,72px)' }}>
            <div><p className="eb g">Not sure who you need?</p><h2>Say it in a sentence. <em>We'll find them.</em></h2></div>
            <div className="ctas"><Link className="btn" to="/">Try the ask <Icon name="arrow" size={14} /></Link><Link className="btn w" to="/join">Join as a creative</Link></div>
          </div>
        </div></section>
      </div>
    </>
  )
}

export function Card({ x, i = 0, date = null }) {
  const free = freeOn(x, date), when = date ? fmtDate(date) : '14 Nov'
  const kind = x.t.includes('video') && !x.t.includes('photo') ? 'Videographer' : x.t.includes('video') ? 'Photo + video' : 'Photographer'
  return (
    <Link className="ccard lg" to={'/creatives/' + x.id} style={{ '--i': i }}>
      <div className="img"><Still seed={x.seed + 40} mood={x.mood} />
        <div className="tp"><span className="tag">{kind}</span><span className={'av' + (free ? '' : ' busy')}><i />{free ? 'Free ' + when : 'Booked ' + when}</span></div>
      </div>
      <div className="bot">
        <div className="row"><b>{x.n}</b>{x.found && <span className="fb">Founding</span>}</div>
        <small>{x.d} · {x.c}</small>
        <div className="row2"><span className="stars"><i>★</i>{x.r} · {x.rv} reviews</span><span className="pr">From <b>{fmt(x.p)}</b></span></div>
      </div>
    </Link>
  )
}

function MapView({ list }) {
  const pins = { mara: [52, 26], priya: [46, 50], ellie: [28, 56], jono: [38, 78], tane: [60, 40], beck: [36, 44], lena: [56, 32], ari: [44, 66] }
  return (
    <div className="map lg rv">
      <svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><pattern id="gridp" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="rgba(20,17,26,.06)" /></pattern></defs>
        <rect width="900" height="560" fill="#e6eae4" /><rect width="900" height="560" fill="url(#gridp)" />
        <path d="M0 0H560c30 60 10 120 40 170s90 80 80 150-40 110-20 170L640 560H0z" fill="#dfe4dc" /><path d="M560 0c30 60 10 120 40 170s90 80 80 150-40 110-20 170L640 560H900V0z" fill="#c9dbe6" />
        <text x="430" y="150" fontFamily="Inter,sans-serif" fontSize="12" fill="rgba(20,17,26,.5)" fontWeight="600">NOOSA</text><text x="380" y="290" fontFamily="Inter,sans-serif" fontSize="12" fill="rgba(20,17,26,.5)" fontWeight="600">MAROOCHYDORE</text><text x="230" y="330" fontFamily="Inter,sans-serif" fontSize="12" fill="rgba(20,17,26,.5)" fontWeight="600">MALENY</text><text x="330" y="450" fontFamily="Inter,sans-serif" fontSize="12" fill="rgba(20,17,26,.5)" fontWeight="600">BRISBANE</text><text x="220" y="520" fontFamily="Inter,sans-serif" fontSize="12" fill="rgba(20,17,26,.5)" fontWeight="600">GOLD COAST</text>
      </svg>
      {list.map(x => pins[x.id] && <Link key={x.id} className="pin" to={'/creatives/' + x.id} style={{ left: pins[x.id][0] + '%', top: pins[x.id][1] + '%' }}><span className="b">{x.n.split(' ')[0]} · from {fmt(x.p)}</span><span className="d" /></Link>)}
    </div>
  )
}
