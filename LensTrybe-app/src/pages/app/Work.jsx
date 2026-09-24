import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, iso } from '../../lib/store'
import { fmt } from '../../lib/format'

const Tiles = ({ t }) => <div className="s12"><div className="kp">{t.map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
const Head = ({ h, p, children }) => <div className="vh"><div><h1>{h}</h1><p>{p}</p></div><div className="acts">{children}</div></div>
const Sw = ({ on, set }) => <span className={'sw2' + (on ? ' on' : '')} role="switch" aria-checked={!!on} onClick={set}><i /></span>

/* Availability: the days you take work, the days you don't, how far you travel, and how the ask bar reads it. */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export function Availability() {
  const F = useFlows(); const { s, toast } = F; const A = s.avail
  const { days, kinds, radius, lead, max, away, auto } = A
  const setDays = fn => F.patch('avail', a => ({ days: fn(a.days) })), setKinds = fn => F.patch('avail', a => ({ kinds: fn(a.kinds) })), setRadius = v => F.patch('avail', { radius: v }), setLead = fn => F.patch('avail', a => ({ lead: fn(a.lead) })), setMax = fn => F.patch('avail', a => ({ max: fn(a.max) })), setAway = fn => F.patch('avail', a => ({ away: fn(a.away) })), setAuto = fn => F.patch('avail', a => ({ auto: fn(a.auto) }))
  const openDays = 90 - s.events.filter(e => e.d >= TODAY && e.d <= '2026-12-21').length - Math.round(90 / 7 * days.filter(d => !d).length)
  const addAway = () => F.open({ title: 'Away', sub: 'Blocked on the calendar and hidden from the ask bar.', cta: 'Add', fields: [{ k: 'from', l: 'From', type: 'date', required: true, half: true, min: TODAY }, { k: 'to', l: 'To', type: 'date', required: true, half: true, min: TODAY }, { k: 'w', l: 'What', placeholder: 'Bali' }], submit: v => { const f = new Date(v.from), t = new Date(v.to); const lab = f.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' to ' + t.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: t.getFullYear() !== 2026 ? 'numeric' : undefined }); setAway(a => [...a, [lab, v.w || 'Away']]); let d = v.from, n = 0; while (d <= v.to && n < 60) { if (!s.events.some(e => e.d === d)) F.add('events', { d, k: 'x', n: v.w || 'Away' }, 'ev'); const x = new Date(d); x.setDate(x.getDate() + 1); d = iso(x); n++ } toast('Away ' + lab + '. Blocked on the calendar.') } })
  return (
    <section className="view">
      <Head h="Availability" p="The days you take work, how far you travel, and what the ask bar can offer without asking you."><Link className="btn g" to="/app/bookings"><Icon name="cal" size={15} />Calendar</Link><button className="btn w" onClick={() => toast('Saved. The ask bar uses it from now.')}>Saved</button></Head>
      <div className="grid">
        <Tiles t={[['Open days, next 90', String(openDays), s.events.filter(e => e.d >= TODAY && e.d <= '2026-12-21' && e.k !== 'x').length + ' booked, ' + s.events.filter(e => e.d >= TODAY && e.d <= '2026-12-21' && e.k === 'x').length + ' blocked', ''], ['Saturdays open', (13 - s.events.filter(e => e.d >= TODAY && e.d <= '2026-12-21' && new Date(e.d).getDay() === 6).length) + ' of 13', 'to Christmas', 'w'], ['Travel', radius + ' km', 'from Noosaville', 'n'], ['Lead time', lead + ' days', 'shortest notice you take', 'n']]} />
        <div className="s7 side">
          <div className="card lg"><div className="h"><b>Days you work</b><small className="lumi-by">Tap to switch</small></div>
            <div className="dows">{DOW.map((d, i) => <button key={d} type="button" className={days[i] ? 'on' : ''} onClick={() => setDays(a => a.map((x, j) => j === i ? (x ? 0 : 1) : x))}>{d}</button>)}</div>
            <div className="brows" style={{ marginTop: 14 }}>
              <label className="brow"><span>Shortest notice</span><span className="stp"><button onClick={() => setLead(l => Math.max(0, l - 1))}>−</button><b>{lead} days</b><button onClick={() => setLead(l => l + 1)}>+</button></span></label>
              <label className="brow"><span>Shoots a week, at most</span><span className="stp"><button onClick={() => setMax(m => Math.max(1, m - 1))}>−</button><b>{max}</b><button onClick={() => setMax(m => m + 1)}>+</button></span></label>
            </div>
          </div>
          <div className="card lg"><div className="h"><b>Work you take</b></div>
            <div className="brows">{Object.entries(kinds).map(([k, v]) => <label key={k} className="brow"><span>{k}</span><Sw on={v} set={() => setKinds(a => ({ ...a, [k]: a[k] ? 0 : 1 }))} /></label>)}</div>
          </div>
          <div className="card lg"><div className="h"><b>How far you travel</b><b style={{ color: 'var(--sig)' }}>{radius} km</b></div>
            <input type="range" className="rng" min="20" max="400" step="10" value={radius} onChange={e => setRadius(+e.target.value)} aria-label="Travel radius" />
            <p className="tempty" style={{ textAlign: 'left', padding: '8px 0 0', fontSize: 12 }}>Noosaville to Brisbane is 140 km, to Byron 230 km. Travel inside the radius is included in your quotes; beyond it Lumi adds it.</p>
          </div>
        </div>
        <div className="s5 side">
          <div className="card lg"><div className="h"><b>Away</b><button className="lnk" onClick={addAway}>Add</button></div>
            <div className="tl">{away.map(([d, w], i) => <div key={d + i} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="pin" size={14} /></span><div><b>{d}</b><small>{w}</small></div><button className="act2" onClick={() => setAway(a => a.filter((_, j) => j !== i))}>Remove</button></div>)}</div>
          </div>
          <div className="card lg"><div className="h"><b>Lumi can</b></div>
            <div className="brows one">
              <label className="brow"><span>Hold a date when a client asks<small>Pencils it, never confirms</small></span><Sw on={auto.hold} set={() => setAuto(a => ({ ...a, hold: a.hold ? 0 : 1 }))} /></label>
              <label className="brow"><span>Offer gaps to past clients<small>Never public</small></span><Sw on={auto.gap} set={() => setAuto(a => ({ ...a, gap: a.gap ? 0 : 1 }))} /></label>
              <label className="brow"><span>Quote Saturdays at the weekend rate<small>+15%, from your packages</small></span><Sw on={auto.sat} set={() => setAuto(a => ({ ...a, sat: a.sat ? 0 : 1 }))} /></label>
            </div>
          </div>
          {!auto.sat && !auto.satAsked && <div className="tlumi"><span className="lm" /><div>Seven Saturdays open before Christmas and every one is wedding season. Turning on the weekend rate would have added $1,380 across last year's Saturday bookings.<div className="acts"><button className="y" onClick={() => { setAuto(a => ({ ...a, sat: 1 })); toast('Weekend rate on. Quotes from now use it.') }}>Turn it on</button><button onClick={() => { setAuto(a => ({ ...a, satAsked: 1 })); toast('Left off.') }}>Leave it</button></div></div></div>}
        </div>
      </div>
    </section>
  )
}
