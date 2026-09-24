import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { mountLens } from '../../lib/lens'
import { CREATIVES, parseBrief, scoreCreative, TAG_LABEL } from '../../data/creatives'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { fmt } from '../../lib/format'

const HINTS = [
  ['Wedding in Noosa, 14 Nov', 'A wedding photographer in Noosa on 14 November, around $3,000'],
  ['Brand film, Brisbane', 'Brand film for a café in Brisbane next month, $2,500'],
  ['Real estate, Gold Coast', 'Real estate photos and video, Gold Coast, three listings this week'],
  ['Conference, March', 'Event photographer for a 200 person conference in Brisbane in March'],
]
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// The ask: one sentence in, a constellation of matches around the living lens.
export default function Ask({ onOpen }) {
  const cv = useRef(null), lens = useRef(null), field = useRef(null), input = useRef(null), stage = useRef(null)
  const [q, setQ] = useState('')
  const [live, setLive] = useState(false)
  const [think, setThink] = useState(false)
  const [brief, setBrief] = useState(null)
  const [orbs, setOrbs] = useState([])
  const [line, setLine] = useState('')
  const [pos, setPos] = useState([])
  const aimAt = i => { const p = pos[i]; if (!p) return; lens.current?.aim({ x: p.x - p.cx, y: -(p.y - p.cy) }) }
  const touched = useRef(false)
  const ph = 'A wedding photographer in Noosa on 14 November, around $3,000'

  useEffect(() => { lens.current = mountLens(cv.current); return () => lens.current?.destroy() }, [])

  const layout = useCallback((n) => {
    const el = field.current, sec = el?.parentElement; if (!el || !sec || innerWidth <= 700) return
    const W = el.clientWidth, cx = W / 2
    const secTop = sec.getBoundingClientRect().top
    // the ring and the orbit live between the ask bar and the answer line pinned at the foot of the hero
    const top = stage.current ? stage.current.getBoundingClientRect().bottom - secTop + 12 : innerHeight * .4
    const lumi = sec.querySelector('.lumi-line'), lumiH = lumi ? Math.max(lumi.offsetHeight, 48) + 44 : 60
    let avail = Math.max(260, innerHeight - lumiH - top)
    // on short screens everything scales down together rather than piling up under the bar
    const k = Math.min(1, Math.max(.6, avail / 640))
    sec.style.setProperty('--k', k)
    const orbTop = 64 * k, orbBottom = 64 * k + 84 * Math.max(k, .85)
    // the arc runs from -30deg to 210deg, so it reaches .5ry above the centre and ry below it.
    // below a floor the labels would collide, so the hero grows a little instead and the page scrolls
    const ry = Math.max(205, (avail - orbTop - orbBottom) / 1.5)
    const needH = top + orbTop + ry * 1.5 + orbBottom + lumiH
    sec.style.minHeight = needH > innerHeight ? needH + 'px' : ''
    const H = sec.clientHeight
    avail = Math.max(avail, H - lumiH - top)
    const cy = top + orbTop + ry * .5
    const Rpx = Math.min(ry / 1.15, W * .17, H * .3)
    // width is the one thing a laptop has plenty of, so the orbit spreads sideways before it squeezes
    const rx = Math.min(W / 2 - 150, 640, Math.max(Rpx * 2.1, ry * 1.9))
    lens.current?.layout({ cy: cy / H, r: Rpx / H })
    const order = [0, 5, 1, 4, 2, 3]
    setPos(Array.from({ length: n }, (_, j) => { const i = order[j] ?? j; const a0 = -Math.PI / 6, span = Math.PI * 1.33; const a = a0 + i * (span / Math.max(1, n - 1)); const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, ang = Math.atan2(y - cy, x - cx)
      // beams run from the very centre of the lens to the orb's edge: light leaving the logo and landing on the creative
      const orbR = (j === 0 ? 64 : j < 3 ? 55 : 46) * k + 8
      return { x, y, cx, cy, sx: cx, sy: cy, ex: x - Math.cos(ang) * orbR, ey: y - Math.sin(ang) * orbR } }))
  }, [])

  const run = useCallback((text) => {
    const b = parseBrief(text)
    const ranked = CREATIVES.map(x => ({ ...x, s: scoreCreative(x, b) })).sort((a, c) => c.s - a.s).slice(0, 6)
    setBrief(b); setThink(true); lens.current?.think(true); setLine('')
    setTimeout(() => {
      setThink(false); lens.current?.think(false); lens.current?.live(true); setLive(true)
      setOrbs(ranked.map(o => ({ ...o, in: false })))
      requestAnimationFrame(() => layout(ranked.length))
      const top = ranked[0], free = ranked.filter(x => x.free).length, inb = b.budget ? ranked.filter(x => x.p <= b.budget).length : null
      const first = n => n.split(' ')[0]
      const others = ranked.slice(1).filter(x => x.free).slice(0, 2).map(x => first(x.n))
      const tail = others.length ? ` ${others.join(' and ')} ${others.length > 1 ? 'are' : 'is'} also free that day.` : ''
      const full = `${ranked.length} match. ${free} are free${b.date ? ' on ' + b.date : ''}${inb !== null ? ', ' + inb + ' inside your budget' : ''}. ${first(top.n)} is the closest fit: ${top.why}${tail}`
      // the creatives arrive as Lumi names them: the closest fit blooms on its name, the rest follow in fit order
      const nameAt = full.indexOf(first(top.n) + ' is the closest'), tailAt = tail ? full.indexOf(tail) : -1
      const show = k => setOrbs(os => os.map((o, j) => j === k ? { ...o, in: true } : o))
      let i = 0, shown = 0
      const step = () => {
        if (i >= nameAt && shown === 0) { show(0); shown = 1 }
        if (tailAt > 0 && i >= tailAt + 1 && shown === 1) { shown = 2; ranked.slice(1).forEach((_, k) => setTimeout(() => show(k + 1), k * 140)) }
        if (i <= full.length) { setLine(full.slice(0, i)); i += 2; setTimeout(step, reduce() ? 0 : 14) }
        else if (shown < 2) { shown = 2; ranked.slice(1).forEach((_, k) => setTimeout(() => show(k + 1), k * 140)) }
      }
      setTimeout(step, 600)
    }, reduce() ? 50 : 1400)
  }, [layout])

  useEffect(() => { if (live && line) { const t = setTimeout(() => layout(orbs.length), 250); return () => clearTimeout(t) } }, [live, line.length > 0, orbs.length, layout])
  useEffect(() => { const on = () => layout(orbs.length); addEventListener('resize', on); return () => removeEventListener('resize', on) }, [orbs.length, layout])
  useEffect(() => { if (live) { const t = setTimeout(() => layout(orbs.length), 900); return () => clearTimeout(t) } else { lens.current?.layout({ cy: .5, r: .34 }); if (field.current?.parentElement) field.current.parentElement.style.minHeight = '' } }, [live, orbs.length, layout])

  const [params] = useSearchParams()
  useEffect(() => { const q0 = params.get('q'); if (q0) { touched.current = true; setQ(q0); const t = setTimeout(() => run(q0), 400); return () => clearTimeout(t) } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const submit = e => { e.preventDefault(); touched.current = true; if (!q.trim()) return; run(q.trim()) }
  const hint = t => { touched.current = true; setQ(t); run(t) }
  const first = line.indexOf('.') + 1

  return (
    <section className={'ask dark darkhero' + (live ? ' live' : '') + (think ? ' think' : '')} id="ask">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="stage" ref={stage}>
        <h1><span className="ln"><span>Tell us what you need.</span></span> <span className="ln"><span>We'll <em>find them.</em></span></span></h1>
        <p className="sub">One sentence. Photographers and videographers across Australia, matched on the work, the date, the place and the budget. No commissions, ever.</p>
        <form className={'bar lg refract chroma tilt' + (think ? ' think' : '')} onSubmit={submit} autoComplete="off" role="search">
          <span className="lens" aria-hidden="true" />
          <input ref={input} value={q} placeholder={ph} aria-label="Describe what you need" onChange={e => { touched.current = true; setQ(e.target.value) }} />
          <button type="button" className="mic" aria-label="Speak instead"><Icon name="mic" size={18} /></button>
          <button type="submit" className="go"><span>Find them</span><Icon name="arrow" size={14} /></button>
        </form>
        {brief && <div className="brief">
          {brief.tags.length > 0 && <span className="lg"><i />{brief.tags.map(t => TAG_LABEL[t]).join(' + ')}</span>}
          {brief.place && <span className="lg"><i />{brief.place.replace(/\b\w/g, c => c.toUpperCase())}</span>}
          {brief.date && <span className="lg"><i />{brief.date}</span>}
          {brief.budget && <span className="lg"><i />Around {fmt(brief.budget)}</span>}
        </div>}
        <div className="hints">{HINTS.map(([l, t]) => <button key={l} type="button" className="lg" onClick={() => hint(t)}>{l}</button>)}</div>
        <Link className="postjob" to={'/jobs' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '')}>{live ? 'Not quite right? Post it as a job and they reply to you' : 'Or post a job and let them come to you'}<Icon name="arrow" size={12} /></Link>
      </div>
      <div className="cfield" ref={field}>
        {orbs.map((o, i) => (
          <div key={o.id} className={'orb' + (o.in ? ' in' : '') + (i === 0 ? ' best' : '')} onPointerEnter={() => aimAt(i)} onPointerLeave={() => lens.current?.aim(null)} style={{ left: pos[i]?.x, top: pos[i]?.y, '--fit': Math.max(0, Math.min(1, (o.s - 50) / 50)), '--sz': 'calc(' + (i === 0 ? 128 : i < 3 ? 110 : 92) + 'px * var(--k, 1))' }}>
            <button type="button" aria-label={'Open ' + o.n} onClick={e => { document.documentElement.style.setProperty('--ox', e.clientX + 'px'); document.documentElement.style.setProperty('--oy', e.clientY + 'px'); onOpen(o) }}>
              <div className="ph"><Still seed={o.seed} mood={o.mood} style={{ borderRadius: '50%' }} /><span className={'fit' + (o.s >= 80 ? '' : o.s >= 55 ? ' mid' : ' low')}>{i === 0 ? 'Closest fit · ' : ''}{o.s}%</span></div>
              <b>{o.n}</b><small>{o.short} · {o.c}</small><span className={'av' + (o.free ? '' : ' no')}><i />{o.free ? 'Free on the date' : 'Booked that day'}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="lumi-line lg"><span className="lm" /><span>{first > 0 && line.length >= first ? <><b>{line.slice(0, first)}</b>{line.slice(first)}</> : line}{line && <span className="cursor" />}</span></div>
      <Link className="scroll-cue" to="/how-it-works">How it works<i /></Link>
    </section>
  )
}
