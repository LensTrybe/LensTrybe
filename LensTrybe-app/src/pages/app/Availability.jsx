import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import CalTabs from './CalTabs'
import { LIVE } from '../../lib/mode'
import { TODAY, nice, parse, addDays, daysBetween, iso } from '../../lib/store'
import { occurrences } from '../../lib/cal'
import { dayStatus, nextOpen, countOpen, awayOn } from '../../lib/avail'

// Availability: the next twelve weeks at a glance, then the rules that decide them. The days you work,
// your hours, how long each kind of job takes, the buffers around jobs, seasons with their own rules,
// what clients see, the holds Lumi has pencilled, people waiting on a date, and a feed for your phone.
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], DOWL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const KINDS = ['Weddings', 'Real estate', 'Events', 'Brand', 'Headshots', 'Family']
const ST = { open: 'Open', booked: 'Booked', held: 'Held', away: 'Away', off: 'Not a work day', rest: 'Rest day', travel: 'Travel day', full: 'Week is full', closed: 'Closed', soon: 'Short notice' }
const HOURS = Array.from({ length: 16 }, (_, i) => String(i + 6).padStart(2, '0') + ':00')
const LEN = [[60, '1 hour'], [90, '90 min'], [120, '2 hours'], [180, '3 hours'], [240, 'Half day'], [480, '8 hours'], ['day', 'Full day']]
const Sw = ({ on, set }) => <span className={'sw2' + (on ? ' on' : '')} role="switch" aria-checked={!!on} onClick={set}><i /></span>
const ampm = t => { const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm') }

export default function Availability() {
  const F = useFlows(); const { s, toast } = F; const A = s.avail
  const set = p => F.setAvail(p)
  const [sel, setSel] = useState(null)
  // twelve weeks from this Monday
  const mon = addDays(TODAY, -((parse(TODAY).getDay() + 6) % 7))
  const days = useMemo(() => Array.from({ length: 84 }, (_, i) => addDays(mon, i)), [mon])
  const occ = useMemo(() => occurrences(s.events, mon, days[83]), [s.events, mon, days])
  const grid = useMemo(() => days.map(d => ({ d, ...dayStatus(s, d, occ) })), [days, s, occ])
  const to90 = addDays(TODAY, 89), xmas = '2026-12-24'
  const open90 = countOpen(s, TODAY, to90)
  const booked90 = occ.filter(e => e.on >= TODAY && e.on <= to90 && (e.k === 'b' || e.k === 'c') && e.first).length
  const sats = useMemo(() => { let n = 0, t = 0, d = TODAY; while (d <= xmas) { if (parse(d).getDay() === 6) { t++; if (dayStatus(s, d).st === 'open') n++ } d = addDays(d, 1) } return [n, t] }, [s])
  const holds = s.events.filter(e => e.k === 'p').sort((a, b) => (a.hold || '9') < (b.hold || '9') ? -1 : 1)
  const expiring = holds.filter(e => e.hold && daysBetween(TODAY, e.hold) <= 2)
  const nextSat = nextOpen(s, 1, { sat: true })[0], nextAny = nextOpen(s, A.pub?.n || 3)
  const cur = sel ? grid.find(x => x.d === sel) : null
  const clickDay = x => { setSel(x.d); if (x.st === 'booked' || x.st === 'held') return; if (x.st === 'away' && x.ev) return F.unblockDay(x.ev.id); if (x.st === 'away' && x.away) return F.removeAway(x.away.id); if (x.st === 'open' || x.st === 'soon' || x.st === 'full') F.blockDay(x.d) }
  const wl = (s.waitlist || []).filter(w => !w.offered), wlOpen = wl.filter(w => dayStatus(s, w.d).st === 'open')
  return (
    <section className="view avl">
      <div className="vh"><div><h1>Availability</h1><p>The days you take work, the rules around them, and what the ask bar can offer without asking you.</p></div><div className="acts"><CalTabs /><button className="btn g" onClick={F.calFeed}><Icon name="cal" size={15} />Subscribe on your phone</button><button className="btn w" onClick={() => F.blockDay(sel || TODAY)}><Icon name="plus" size={15} />Block days</button></div></div>
      <div className="grid">
        <div className="s12"><div className="kp">{[['Open days, next 90', String(open90), booked90 + ' booked · ' + (90 - open90 - booked90) + ' off, away or buffer', ''], ['Saturdays open to Christmas', sats[0] + ' of ' + sats[1], nextSat ? 'next one ' + nice(nextSat) : 'none open', sats[0] <= 3 ? 'w' : ''], ['Holds', String(holds.length), expiring.length ? expiring.length + ' lapse' + (expiring.length > 1 ? '' : 's') + ' in the next two days' : holds.length ? 'none lapsing soon' : 'nothing pencilled', expiring.length ? 'w' : 'n'], ['Waiting on a date', String(wl.length), wlOpen.length ? wlOpen.length + ' could be offered now' : wl.length ? 'none of their dates are open yet' : 'nobody waiting', wlOpen.length ? '' : 'n']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>

        <div className="card lg s12 avgrid">
          <div className="h"><b>The next twelve weeks</b><div className="avkey">{[['open', 'Open'], ['booked', 'Booked'], ['held', 'Held'], ['away', 'Away or blocked'], ['rest', 'Buffer'], ['off', 'Off']].map(([k, l]) => <span key={k}><i className={'st-' + k} />{l}</span>)}</div></div>
          <div className="avwk"><span />{DOW.map(d => <small key={d}>{d}</small>)}</div>
          {Array.from({ length: 12 }, (_, w) => <div key={w} className="avwk"><span className="avm">{parse(days[w * 7]).getDate() <= 7 || w === 0 ? parse(days[w * 7]).toLocaleDateString('en-AU', { month: 'short' }) : ''}</span>{grid.slice(w * 7, w * 7 + 7).map(x => <button key={x.d} type="button" className={'avd st-' + x.st + (x.d === TODAY ? ' today' : '') + (x.d < TODAY ? ' past' : '') + (sel === x.d ? ' sel' : '')} title={nice(x.d, { weekday: 'short' }) + ' · ' + x.l} onClick={() => clickDay(x)} disabled={x.d < TODAY}><b>{parse(x.d).getDate()}</b>{(x.st === 'booked' || x.st === 'held') && <small>{x.l.split(' ·')[0]}</small>}{x.st === 'away' && <small>{x.l}</small>}{(x.st === 'rest' || x.st === 'travel' || x.st === 'full' || x.st === 'closed') && <small>{ST[x.st]}</small>}</button>)}</div>)}
          <div className="avsel">{cur ? <><b>{nice(cur.d, { weekday: 'long' })}</b><span>{ST[cur.st]}{cur.l && cur.l !== ST[cur.st] ? ' · ' + cur.l : ''}</span><span className="avacts">{cur.st === 'booked' && <Link className="act2" to="/app/bookings">Open the booking</Link>}{cur.st === 'held' && <><button className="act2" onClick={() => F.confirmEvent(cur.ev.id)}>Confirm</button><button className="act2" onClick={() => F.releaseEvent(cur.ev.id)}>Release</button></>}{(cur.st === 'open' || cur.st === 'soon' || cur.st === 'full') && <button className="act2" onClick={() => F.blockDay(cur.d)}>Block</button>}{cur.st === 'away' && cur.ev && <button className="act2" onClick={() => F.unblockDay(cur.ev.id)}>Unblock</button>}{cur.st === 'away' && cur.away && <button className="act2" onClick={() => F.removeAway(cur.away.id)}>Remove away</button>}{cur.st === 'off' && <button className="act2" onClick={() => set(a => ({ days: a.days.map((v, i) => i === (parse(cur.d).getDay() + 6) % 7 ? 1 : v) }))}>Work {DOW[(parse(cur.d).getDay() + 6) % 7]}s</button>}</span></> : <span>Tap a day to block it, unblock it, or see why it is not open.</span>}</div>
        </div>

        <div className="s7 side">
          <div className="card lg"><div className="h"><b>Days and hours</b><small className="lumi-by">Tap a day to switch</small></div>
            <div className="dows">{DOW.map((d, i) => <button key={d} type="button" className={A.days[i] ? 'on' : ''} onClick={() => set(a => ({ days: a.days.map((x, j) => j === i ? (x ? 0 : 1) : x) }))}>{d}</button>)}</div>
            <div className="brows" style={{ marginTop: 14 }}>
              <label className="brow"><span>Start<small>The earliest the ask bar offers</small></span><select className="avsel2" value={A.hours?.start || '08:00'} onChange={e => set(a => ({ hours: { ...a.hours, start: e.target.value } }))}>{HOURS.map(h => <option key={h} value={h}>{ampm(h)}</option>)}</select></label>
              <label className="brow"><span>Finish<small>Last start is finish minus the job</small></span><select className="avsel2" value={A.hours?.end || '18:00'} onChange={e => set(a => ({ hours: { ...a.hours, end: e.target.value } }))}>{HOURS.map(h => <option key={h} value={h}>{ampm(h)}</option>)}</select></label>
              <label className="brow"><span>Evenings for twilight<small>Real estate can run past finish</small></span><Sw on={A.hours?.evenings} set={() => set(a => ({ hours: { ...a.hours, evenings: a.hours?.evenings ? 0 : 1 } }))} /></label>
              <label className="brow"><span>Shortest notice</span><span className="stp"><button onClick={() => set(a => ({ lead: Math.max(0, a.lead - 1) }))}>−</button><b>{A.lead} days</b><button onClick={() => set(a => ({ lead: a.lead + 1 }))}>+</button></span></label>
              <label className="brow"><span>Shoots a week, at most<small>The grid shows a week as full after this</small></span><span className="stp"><button onClick={() => set(a => ({ max: Math.max(1, a.max - 1) }))}>−</button><b>{A.max}</b><button onClick={() => set(a => ({ max: a.max + 1 }))}>+</button></span></label>
            </div>
          </div>
          <div className="card lg"><div className="h"><b>Work you take, and how long it runs</b><small className="lumi-by">Quotes and holds default from this</small></div>
            <div className="brows">{KINDS.map(k => <label key={k} className="brow"><span>{k}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{A.kinds[k] ? <select className="avsel2" value={String(A.lengths?.[k] ?? 120)} onChange={e => set(a => ({ lengths: { ...a.lengths, [k]: e.target.value === 'day' ? 'day' : Number(e.target.value) } }))}>{LEN.map(([v, l]) => <option key={v} value={String(v)}>{l}</option>)}</select> : null}<Sw on={A.kinds[k]} set={() => set(a => ({ kinds: { ...a.kinds, [k]: a.kinds[k] ? 0 : 1 } }))} /></span></label>)}</div>
          </div>
          <div className="card lg"><div className="h"><b>Buffers</b><small className="lumi-by">Days the grid blocks on its own</small></div>
            <div className="brows one">
              <label className="brow"><span>Rest day after a wedding<small>The day after any wedding is off</small></span><Sw on={A.buffers?.rest} set={() => set(a => ({ buffers: { ...a.buffers, rest: a.buffers?.rest ? 0 : 1 } }))} /></label>
              <label className="brow"><span>Travel day outside your radius<small>A day either side of anything over {A.radius} km</small></span><Sw on={A.buffers?.travel} set={() => set(a => ({ buffers: { ...a.buffers, travel: a.buffers?.travel ? 0 : 1 } }))} /></label>
              <label className="brow"><span>Gap between shoots on the same day<small>Lumi never offers a start inside it</small></span><select className="avsel2" value={String(A.buffers?.gap ?? 60)} onChange={e => set(a => ({ buffers: { ...a.buffers, gap: Number(e.target.value) } }))}>{[[0, 'None'], [30, '30 min'], [60, '1 hour'], [120, '2 hours'], [180, '3 hours']].map(([v, l]) => <option key={v} value={String(v)}>{l}</option>)}</select></label>
            </div>
          </div>
          <div className="card lg"><div className="h"><b>How far you travel</b><b style={{ color: 'var(--sig)' }}>{A.radius} km</b></div>
            <input type="range" className="rng" min="20" max="400" step="10" value={A.radius} onChange={e => set({ radius: +e.target.value })} aria-label="Travel radius" />
            <p className="tempty" style={{ textAlign: 'left', padding: '8px 0 0', fontSize: 12 }}>{LIVE ? '' : (s.profile.city || '').split(',')[0] + ' to Brisbane is 140 km, to Byron 230 km. '} Travel inside the radius is included in your quotes; beyond it, the job board shows those jobs as further out.</p>
          </div>
        </div>

        <div className="s5 side">
          <div className="card lg"><div className="h"><b>Holds</b><small className="lumi-by">Pencilled while a client decides</small></div>
            <div className="tl">{holds.map(e => { const left = e.hold ? daysBetween(TODAY, e.hold) : null; return <div key={e.id} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="cal" size={14} /></span><div><b>{e.n.split(' ·')[0]}</b><small>{nice(e.d, { weekday: 'short' })} · {e.hold ? (left < 0 ? 'lapsed ' + nice(e.hold) : left === 0 ? 'lapses today' : 'held until ' + nice(e.hold)) : 'no end date'}{e.v ? ' · $' + e.v.toLocaleString() : ''}</small></div><span style={{ display: 'flex', gap: 4 }}><button className="act2" onClick={() => F.confirmEvent(e.id)}>Confirm</button><button className="act2" onClick={() => F.extendHold(e.id)} title="Hold for another week">+7d</button><button className="act2" onClick={() => F.releaseEvent(e.id)}>Release</button></span></div> })}{!holds.length && <div className="tempty">Nothing pencilled. When a client asks and Lumi holds a date, it shows here with its expiry.</div>}</div>
          </div>
          <div className="card lg"><div className="h"><b>Away</b><button className="lnk" onClick={() => F.addAway()}>Add</button></div>
            <div className="tl">{(A.away || []).map(a => <div key={a.id} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="pin" size={14} /></span><div><b>{a.rep === 'weekly' ? 'Every ' + DOWL[a.dow] : nice(a.from) + (a.to && a.to !== a.from ? ' to ' + nice(a.to, { year: a.to.slice(0, 4) !== TODAY.slice(0, 4) ? 'numeric' : undefined }) : '')}</b><small>{a.w}{a.rep !== 'weekly' && ' · ' + (daysBetween(a.from, a.to || a.from) + 1) + (daysBetween(a.from, a.to || a.from) ? ' days' : ' day')}</small></div><button className="act2" onClick={() => F.removeAway(a.id)}>Remove</button></div>)}{s.events.filter(e => e.k === 'x' && e.d >= TODAY).map(e => <div key={e.id} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="x" size={14} /></span><div><b>{nice(e.d, { weekday: 'short' })}{e.end ? ' to ' + nice(e.end) : ''}</b><small>{e.n || 'Blocked'}</small></div><button className="act2" onClick={() => F.unblockDay(e.id)}>Unblock</button></div>)}</div>
          </div>
          <div className="card lg"><div className="h"><b>Season rules</b><button className="lnk" onClick={() => F.editSeason(null)}>Add</button></div>
            <div className="tl">{(A.seasons || []).map(x => <div key={x.id} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="clock" size={14} /></span><div><b>{x.n}</b><small>{nice(x.from)} to {nice(x.to)} · {x.closed ? 'closed' : (x.kinds?.length ? x.kinds.join(', ') : 'everything') + ' · ' + x.lead + ' days notice'}</small></div><button className="act2" onClick={() => F.editSeason(x.id)}>Edit</button></div>)}{!(A.seasons || []).length && <div className="tempty">No rules. Add one for a busy season (weddings only, three weeks notice) or a break (closed).</div>}</div>
          </div>
          <div className="card lg"><div className="h"><b>What clients see</b><Link to="/creatives/mara">Profile <Icon name="arrow" size={12} /></Link></div>
            <div className="brows one">
              <label className="brow"><span>Show your next open dates<small>On the profile and the website</small></span><Sw on={A.pub?.show} set={() => set(a => ({ pub: { ...a.pub, show: a.pub?.show ? 0 : 1 } }))} /></label>
              {A.pub?.show ? <label className="brow"><span>How many</span><span className="stp"><button onClick={() => set(a => ({ pub: { ...a.pub, n: Math.max(1, (a.pub?.n || 3) - 1) } }))}>−</button><b>{A.pub?.n || 3}</b><button onClick={() => set(a => ({ pub: { ...a.pub, n: Math.min(6, (a.pub?.n || 3) + 1) } }))}>+</button></span></label> : null}
            </div>
            {A.pub?.show ? <div className="avprev"><small>They will see</small><b>{nextSat ? 'Next open Saturday: ' + nice(nextSat) : 'No Saturdays open right now'}</b><span>{nextAny.map(d => nice(d, { weekday: 'short' })).join(' · ')}</span></div> : null}
            <div className="h" style={{ marginTop: 14 }}><b style={{ fontSize: 12.5 }}>Book instantly, no enquiry first</b></div>
            <div className="chips2">{KINDS.filter(k => A.kinds[k]).map(k => { const on = (A.pub?.instant || []).includes(k); return <button key={k} type="button" className={on ? 'on' : ''} onClick={() => set(a => ({ pub: { ...a.pub, instant: on ? (a.pub?.instant || []).filter(x => x !== k) : [...(a.pub?.instant || []), k] } }))}>{k}</button> })}</div>
            <p className="tempty" style={{ textAlign: 'left', padding: '8px 0 0', fontSize: 12 }}>Instant kinds book straight onto the calendar from your profile at your package price, with the deposit. Everything else comes in as an enquiry first.</p>
          </div>
          <div className="card lg"><div className="h"><b>Waitlist</b><button className="lnk" onClick={F.addWait}>Add</button></div>
            <div className="tl">{wl.map(w => { const st = dayStatus(s, w.d); return <div key={w.id} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="user" size={14} /></span><div><b>{w.who} · {w.kind}</b><small>Wanted {nice(w.d, { weekday: 'short' })} · {st.st === 'open' ? 'that day is open now' : st.st === 'held' ? 'held for someone else' : st.l.toLowerCase()} · since {nice(w.at)}</small></div><span style={{ display: 'flex', gap: 4 }}>{st.st === 'open' ? <button className="act2" onClick={() => F.offerDate(w.id)}>Offer it</button> : <button className="act2" onClick={() => { const alt = nextOpen(s, 1, { sat: parse(w.d).getDay() === 6 })[0]; if (alt) F.offerDate(w.id, alt); else toast('Nothing open to offer yet.') }}>Offer another</button>}<button className="act2" onClick={() => F.removeWait(w.id)}>Remove</button></span></div> })}{(s.waitlist || []).filter(w => w.offered).map(w => <div key={w.id} className="e" style={{ opacity: .6 }}><span className="t" style={{ width: 'auto' }}><Icon name="check" size={14} /></span><div><b>{w.who}</b><small>Offered {nice(w.offered)} · waiting on them</small></div>{w.tid && <Link className="act2" to={'/app/thread/' + w.tid}>Thread</Link>}</div>)}{!(s.waitlist || []).length && <div className="tempty">Nobody waiting. When a client asks for a taken date, the ask bar offers the waitlist.</div>}</div>
          </div>
          <div className="card lg"><div className="h"><b>Lumi can</b></div>
            <div className="brows one">
              <label className="brow"><span>Hold a date when a client asks<small>Pencils it for 5 days, never confirms</small></span><Sw on={A.auto.hold} set={() => set(a => ({ auto: { ...a.auto, hold: a.auto.hold ? 0 : 1 } }))} /></label>
              <label className="brow"><span>Offer gaps to the waitlist, then past clients<small>Never public</small></span><Sw on={A.auto.gap} set={() => set(a => ({ auto: { ...a.auto, gap: a.auto.gap ? 0 : 1 } }))} /></label>
              <label className="brow"><span>Quote Saturdays at the weekend rate<small>+15%, from your packages</small></span><Sw on={A.auto.sat} set={() => set(a => ({ auto: { ...a.auto, sat: a.auto.sat ? 0 : 1 } }))} /></label>
            </div>
          </div>
          {expiring.length > 0 ? <div className="tlumi"><span className="lm" /><div>{expiring[0].n.split(' ·')[0]}'s hold on {nice(expiring[0].d)} lapses {daysBetween(TODAY, expiring[0].hold) <= 0 ? 'today' : nice(expiring[0].hold)}. Nudge them, or give them a week?<div className="acts"><button className="y" onClick={() => { if (expiring[0].t) { F.say(expiring[0].t, 'me', 'Hi! Just checking in, I have ' + nice(expiring[0].d) + ' pencilled for you until ' + nice(expiring[0].hold) + '. Shall I lock it in?'); toast('Sent.') } else toast('No thread for this hold.') }}>Nudge them</button><button onClick={() => F.extendHold(expiring[0].id)}>Give them a week</button></div></div></div>
            : !A.auto.sat && !A.auto.satAsked && sats[0] > 0 ? <div className="tlumi"><span className="lm" /><div>{sats[0]} Saturday{sats[0] > 1 ? 's' : ''} open before Christmas and every one is wedding season. Turning on the weekend rate would have added $1,380 across last year's Saturday bookings.<div className="acts"><button className="y" onClick={() => { set(a => ({ auto: { ...a.auto, sat: 1 } })); toast('Weekend rate on. Quotes from now use it.') }}>Turn it on</button><button onClick={() => { set(a => ({ auto: { ...a.auto, satAsked: 1 } })); toast('Left off.') }}>Leave it</button></div></div></div>
            : wlOpen.length > 0 ? <div className="tlumi"><span className="lm" /><div>{wlOpen[0].who} wanted {nice(wlOpen[0].d)} and it is open now. Want me to offer it?<div className="acts"><button className="y" onClick={() => F.offerDate(wlOpen[0].id)}>Offer it</button></div></div></div> : null}
        </div>
      </div>
    </section>
  )
}
