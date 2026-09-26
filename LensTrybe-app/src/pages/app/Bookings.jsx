import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY as T0, iso, parse, addDays, nice } from '../../lib/store'
import { occurrences, ampm, mins, endOf, durMins, km, leaveBy, line, ics } from '../../lib/cal'
import { fmt } from '../../lib/format'
import { LIVE } from '../../lib/mode'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const long = d => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
const TODAY = parse(T0)
const H0 = 6, H1 = 21, PX = 44 // week and day views: 6 am to 9 pm, 44px an hour
const monday = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }

// Calendar: month to scan, week and day for the hours. Shoots, meetings, money and blocked days on
// one grid, drag a booking to move it, and everything reads and writes the shared store.
export default function Bookings() {
  const F = useFlows(); const { s } = F; const [p] = useSearchParams()
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('lt-cal') || 'month' } catch { return 'month' } })
  const [view, setView] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
  const [sel, setSel] = useState(T0), [drag, setDrag] = useState(null), [over, setOver] = useState(null), [menu, setMenu] = useState(false)
  useEffect(() => { if (!menu) return; const c = e => { if (!e.target.closest('.newmenu')) setMenu(false) }; document.addEventListener('click', c); return () => document.removeEventListener('click', c) }, [menu])
  useEffect(() => { try { localStorage.setItem('lt-cal', mode) } catch {} }, [mode])
  const A = s.avail
  // the window of days this view shows
  const range = useMemo(() => {
    if (mode === 'month') { const first = new Date(view.getFullYear(), view.getMonth(), 1), lead = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - lead); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d }) }
    if (mode === 'week') { const start = monday(parse(sel)); return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d }) }
    return [parse(sel)]
  }, [mode, view, sel])
  const from = iso(range[0]), to = iso(range[range.length - 1])
  const occ = useMemo(() => occurrences(s.events, from, to), [s.events, from, to])
  const byDay = useMemo(() => { const m = {}; for (const e of occ) (m[e.on] ||= []).push(e); for (const k in m) m[k].sort((a, b) => (a.time || '00:00') < (b.time || '00:00') ? -1 : 1); return m }, [occ])
  const meets = useMemo(() => { const m = {}; for (const x of s.meetings) { if (x.st === 'done') continue; const d = x.when.slice(0, 10); if (d >= from && d <= to) (m[d] ||= []).push(x) } return m }, [s.meetings, from, to])
  const money = useMemo(() => { const m = {}; for (const r of s.ledger) { if (r.k !== 'inv' || r.date < from || r.date > to) continue; (m[r.date] ||= []).push(r) } return m }, [s.ledger, from, to])
  const offDay = d => !A.days[(d.getDay() + 6) % 7]
  useEffect(() => { const b = p.get('block'); if (b) { const k = '2026-11-' + String(b).padStart(2, '0'); setView(new Date(2026, 10, 1)); setSel(k); if (!byDay[k]) F.blockDay(k) } }, [p]) // eslint-disable-line
  const upcoming = useMemo(() => occurrences(s.events, T0, addDays(T0, 120)).filter(e => e.n && e.k !== 'd' && e.k !== 'x' && e.first).sort((a, b) => a.on < b.on ? -1 : 1).slice(0, 5), [s.events])
  const list = byDay[sel] || [], e = list.find(x => x.k !== 'x') || list[0], sd = parse(sel)
  const counts = useMemo(() => { const m = String(view.getMonth() + 1).padStart(2, '0'), y = view.getFullYear(); const inM = occurrences(s.events, y + '-' + m + '-01', y + '-' + m + '-31').filter(x => x.first); return { b: inM.filter(x => x.k === 'b').length, p: inM.filter(x => x.k === 'p').length, v: inM.reduce((t, x) => t + (x.k === 'b' || x.k === 'p' ? x.v || 0 : 0), 0) } }, [s.events, view])
  const goto = k => { const d = parse(k); setSel(k); setView(new Date(d.getFullYear(), d.getMonth(), 1)) }
  const step = n => { if (mode === 'month') setView(v => new Date(v.getFullYear(), v.getMonth() + n, 1)); else goto(addDays(sel, n * (mode === 'week' ? 7 : 1))) }
  const title = mode === 'month' ? <>{MON[view.getMonth()]} <em>{view.getFullYear()}</em></> : mode === 'week' ? <>{nice(from)} <em>to {nice(to, { year: 'numeric' })}</em></> : <>{sd.toLocaleDateString('en-AU', { weekday: 'long' })} <em>{nice(sel, { year: 'numeric' })}</em></>
  const exportIcs = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics(s.events, s.meetings, s.meetingTypes)], { type: 'text/calendar' })); a.download = 'lenstrybe.ics'; a.click(); F.toast('Calendar exported. Open it in Google, Apple or Outlook.') }
  // drag and drop, month cells and week columns both accept a booking
  const dragProps = x => x.k !== 'x' && !x.rep ? { draggable: true, onDragStart: ev => { ev.dataTransfer.setData('text/plain', x.id); ev.dataTransfer.effectAllowed = 'move'; setDrag(x.id) }, onDragEnd: () => { setDrag(null); setOver(null) } } : {}
  const dropProps = k => ({ onDragOver: ev => { if (drag) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; if (over !== k) setOver(k) } }, onDragLeave: () => over === k && setOver(null), onDrop: ev => { ev.preventDefault(); const id = ev.dataTransfer.getData('text/plain') || drag; setOver(null); setDrag(null); if (id) { F.moveEvent(id, k); setSel(k) } } })
  const meetTypes = Object.fromEntries(s.meetingTypes.map(t => [t.id, t]))
  // everything you can put on a day, from one place
  const day0 = sel >= T0 ? sel : T0
  const ADD = [
    ['booking', 'Booking', 'cal', 'A shoot, on the calendar and in the thread', () => F.newBooking(day0)],
    ['meeting', 'Meeting', 'video', 'A call or consult, on the Meetings page too', () => F.newMeeting({ d: day0 })],
    ['money', 'Invoice due', 'dollar', 'An invoice with this date as the due date', () => F.newDoc('inv', { date: day0 })],
    ['off', 'Day off or block', 'x', 'Clients cannot ask for it', () => F.blockDay(day0)],
  ]
  const addMenu = (
    <div className="newmenu">
      <button className="btn w" onClick={() => setMenu(m => !m)} aria-expanded={menu}><Icon name="plus" size={15} />New<Icon name="chev" size={13} className="cv" /></button>
      {menu && <div className="menu lg">{ADD.map(([k, l, ic, d, fn]) => <button key={k} type="button" onClick={() => { setMenu(false); fn() }}><Icon name={ic} size={15} /><span><b>{l}</b><small>{d}</small></span></button>)}<small className="on">for {long(parse(day0))}</small></div>}
    </div>
  )
  const chip = x => <button key={x.oid} type="button" className={'ev ' + x.k + (x.end ? ' span' + (x.first ? ' first' : '') + (x.last ? ' last' : '') : '') + (drag === x.id ? ' lift' : '')} {...dragProps(x)} onClick={ev => { ev.stopPropagation(); setSel(x.on); if (x.k !== 'x') F.editEvent(x.id, goto) }} title={x.n + (x.time ? ' · ' + ampm(x.time) : '')}>{x.k === 'x' ? 'Blocked' + (x.n ? ' · ' + x.n : '') : <>{x.time && !x.end && mode !== 'month' && <i>{ampm(x.time)}</i>}{x.n.split(' · ')[0]}{x.rep && <em title="Repeats">↻</em>}</>}</button>

  const dayPanel = (
    <div className="card lg day">
      <div className="h"><b>{long(sd)}</b>{offDay(sd) && !e && <span className="st grey">Day off</span>}{e?.k && e.k !== 'x' && <span className={'st ' + (e.k === 'p' ? 'viewed' : e.k === 'd' ? 'grey' : 'ok')}>{e.k === 'p' ? 'Pencilled' : e.k === 'd' ? 'Delivered' : 'Booked'}</span>}{e?.k === 'x' && <span className="st grey">Blocked</span>}{!e && !offDay(sd) && <span className="st ok">Open</span>}</div>
      {e?.n && e.k !== 'x' ? <>
        <button type="button" className="dn edit" onClick={() => F.editEvent(e.id, goto)} title="Edit booking">{e.n}<Icon name="edit" size={13} /></button>
        <p>{line(e) || e.s}{e.end && <> · {nice(e.d)} to {nice(e.end)}</>}{e.rep && <> · repeats {e.rep}</>}{e.addr ? <><br /><small>{e.addr}</small></> : null}</p>
        {e.with?.length > 0 && <p className="with"><Icon name="users" size={13} />{e.with.map(x => x.n || x.em).join(', ')}</p>}
        {e.v > 0 && <p className="dv">{fmt(e.v)}</p>}
        {list.filter(x => x.k !== 'x').length > 1 && <div className="more">{list.filter(x => x.k !== 'x' && x.oid !== e.oid).map(x => <button key={x.oid} type="button" className="lnk" onClick={() => F.editEvent(x.id, goto)}>Also: {x.time ? ampm(x.time) + ' ' : ''}{x.n}</button>)}</div>}
        <div className="ctas">
          <button className="btn w sm" onClick={() => F.editEvent(e.id, goto)}><Icon name="edit" size={13} />Edit</button>
          {e.t && <Link className="btn g sm" to={'/app/thread/' + e.t}>Thread <Icon name="arrow" size={13} /></Link>}
          {e.k === 'p' && <><button className="btn g sm" onClick={() => F.confirmEvent(e.id)}>Confirm</button><button className="btn g sm" onClick={() => F.releaseEvent(e.id)}>Release</button></>}
          {sd >= TODAY && <button className="btn g sm" onClick={() => F.newMeeting({ d: sel })}>Meeting</button>}{sd >= TODAY && <button className="btn g sm" onClick={() => F.newDoc('inv', { date: sel })}>Invoice due</button>}
        </div>
      </> : e?.k === 'x' ? <>
        <p>Blocked{e.n ? ' · ' + e.n : ''}{e.end ? ' · ' + nice(e.d) + ' to ' + nice(e.end) : ''}. Clients cannot book this day.</p>
        <div className="ctas"><button className="btn w sm" onClick={() => F.openDay(e.id)}>Open the day</button></div>
      </> : <>
        <p>{sd < TODAY ? 'Nothing on this day.' : offDay(sd) ? 'A day you do not work. Clients cannot ask for it; you can still book it.' : 'Open. Clients who ask can book it.'}</p>
        {sd >= TODAY && <div className="ctas"><button className="btn w sm" onClick={() => F.newBooking(sel)}><Icon name="plus" size={13} />New booking</button><button className="btn g sm" onClick={() => F.newMeeting({ d: sel })}>Meeting</button><button className="btn g sm" onClick={() => F.newDoc('inv', { date: sel })}>Invoice due</button><button className="btn g sm" onClick={() => F.blockDay(sel)}>Block the day</button></div>}
      </>}
      {(meets[sel] || []).length > 0 && <div className="side2"><b>Meetings</b>{meets[sel].map(m => <Link key={m.id} to="/app/meetings" className="row"><span className="t">{ampm(m.when.slice(11))}</span><span>{meetTypes[m.t]?.n || 'Meeting'} · {m.who}</span><small>{m.how}</small></Link>)}</div>}
      {(money[sel] || []).length > 0 && <div className="side2"><b>Money</b>{money[sel].map(r => <Link key={r.id} to="/app/invoicing" className="row"><span className={'t ' + (r.st === 'ok' ? 'ok' : 'due')}>{r.st === 'ok' ? 'Paid' : 'Due'}</span><span>{r.who} · {r.id}</span><small>{fmt(r.v)}</small></Link>)}</div>}
    </div>
  )

  return (
    <section className="view">
      <div className="vh">
        <div><h1>{title}</h1><p>{counts.b} booked, {counts.p} pencilled, {fmt(counts.v)} on the books in {MON[view.getMonth()]}. Tap a day, drag a booking to move it.</p></div>
        <div className="acts">
          <button className="syncb" onClick={exportIcs} title="Download an .ics for Google, Apple or Outlook"><i />Google Calendar · export</button>
          <div className="tfilt seg3">{[['month', 'Month'], ['week', 'Week'], ['day', 'Day']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
          <div className="mnav"><button onClick={() => step(-1)} aria-label="Previous"><Icon name="back" size={15} /></button><button className="today" onClick={() => goto(T0)}>Today</button><button onClick={() => step(1)} aria-label="Next" className="fwd"><Icon name="back" size={15} /></button></div>
          {addMenu}
        </div>
      </div>
      <div className="grid">
        <div className={'card lg s8 calc ' + mode}>
          {mode === 'month' ? (
            <div className="mcal">
              {DOW.map(d => <div key={d} className="dh">{d}</div>)}
              {range.map(d => { const k = iso(d), xs = byDay[k] || [], x = xs.find(v => v.k !== 'x') || xs[0], out = d.getMonth() !== view.getMonth(), past = d < TODAY; return (
                <div key={k} role="button" tabIndex={0} className={'d ' + (x?.k || '') + (out ? ' out' : '') + (past ? ' past' : '') + (offDay(d) ? ' off' : '') + (k === T0 ? ' today' : '') + (k === sel ? ' sel' : '') + (over === k ? ' over' : '')} onClick={() => setSel(k)} onDoubleClick={() => x && x.k !== 'x' ? F.editEvent(x.id, goto) : d >= TODAY && F.newBooking(k)} aria-label={long(d)} aria-pressed={k === sel} onKeyDown={ev => ev.key === 'Enter' && setSel(k)} {...dropProps(k)}>
                  <span className="n">{d.getDate()}{(money[k] || []).length > 0 && <b className={'mk ' + (money[k].some(r => r.st !== 'ok') ? 'due' : 'ok')} title={money[k].map(r => r.who + ' ' + fmt(r.v)).join(', ')}>$</b>}{(meets[k] || []).length > 0 && <b className="mk m" title={meets[k].map(m => m.who).join(', ')}>{meets[k].length}</b>}</span>
                  <span className="evs">{xs.slice(0, 2).map(chip)}{xs.length > 2 && <small className="more">+{xs.length - 2}</small>}</span>
                </div>) })}
            </div>
          ) : (
            <div className="wk">
              <div className="wkh"><span className="gut" />{range.map(d => { const k = iso(d); return <button key={k} type="button" className={'wdh' + (k === T0 ? ' today' : '') + (k === sel ? ' sel' : '') + (offDay(d) ? ' off' : '')} onClick={() => setSel(k)}><small>{DOW[(d.getDay() + 6) % 7]}</small><b>{d.getDate()}</b></button> })}</div>
              <div className="allday"><span className="gut">all day</span>{range.map(d => { const k = iso(d); const xs = (byDay[k] || []).filter(x => x.k === 'x' || x.dur === 'day' || !x.time); return <div key={k} className={'col' + (over === k ? ' over' : '')} {...dropProps(k)}>{xs.map(chip)}</div> })}</div>
              <div className="hours">
                <div className="gut">{Array.from({ length: H1 - H0 }, (_, i) => <span key={i} style={{ top: i * PX }}>{ampm(String(H0 + i).padStart(2, '0') + ':00')}</span>)}</div>
                {range.map(d => { const k = iso(d); const xs = (byDay[k] || []).filter(x => x.k !== 'x' && x.dur !== 'day' && x.time); const ms = meets[k] || []; return (
                  <div key={k} className={'col' + (offDay(d) ? ' off' : '') + (k === T0 ? ' today' : '') + (over === k ? ' over' : '')} {...dropProps(k)} onDoubleClick={ev => { const y = ev.nativeEvent.offsetY; const h = Math.max(H0, Math.min(H1 - 1, H0 + Math.floor(y / PX))); if (d >= TODAY) F.newBooking(k, { time: String(h).padStart(2, '0') + ':00' }) }}>
                    {Array.from({ length: H1 - H0 }, (_, i) => <i key={i} className="ln" style={{ top: i * PX }} />)}
                    {k === T0 && <i className="now" style={{ top: (mins('09:41') - H0 * 60) / 60 * PX }} />}
                    {xs.map(x => { const top = (mins(x.time) - H0 * 60) / 60 * PX, h = Math.max(22, durMins(x) / 60 * PX - 2); const d0 = km(x.where, x.addr), lb = leaveBy(x.time, d0); return <button key={x.oid} type="button" className={'slot ' + x.k + (h < 40 ? ' tight' : '') + (drag === x.id ? ' lift' : '')} style={{ top, height: h }} {...dragProps(x)} onClick={ev => { ev.stopPropagation(); setSel(k); F.editEvent(x.id, goto) }}><b>{x.n.split(' · ')[0]}</b><small>{ampm(x.time)} to {ampm(endOf(x))}{x.where ? ' · ' + x.where : ''}</small>{lb && h > 60 && <small className="lb">leave by {ampm(lb)}</small>}</button> })}
                    {ms.map(m => { const t = m.when.slice(11), top = (mins(t) - H0 * 60) / 60 * PX, h = Math.max(22, (meetTypes[m.t]?.m || 30) / 60 * PX - 2); return <Link key={'m' + m.id} to="/app/meetings" className={'slot m' + (h < 40 ? ' tight' : '')} style={{ top, height: h }} title={m.who}><b>{meetTypes[m.t]?.n || 'Meeting'}</b><small>{m.who} · {m.how}</small></Link> })}
                  </div>) })}
              </div>
            </div>
          )}
          <div className="legend"><span><i className="b" />Booked</span><span><i className="p" />Pencilled</span><span><i className="x" />Blocked</span><span><i className="m" />Meeting</span><span><i className="o" />Open</span><span><i className="off" />Day off</span><span><b className="mk due">$</b>Money</span></div>
        </div>
        <div className="s4 side">
          {dayPanel}
          <div className="card lg"><div className="h"><b>Coming up</b><Link to="/app/availability">Availability <Icon name="arrow" size={12} /></Link></div>
            <div className="up">{upcoming.map(x => { const d = parse(x.on); return <div key={x.oid} className="d" onClick={() => goto(x.on)}><div className="dt"><small>{DOW[(d.getDay() + 6) % 7]}</small><b>{d.getDate()}</b></div><div><b>{x.n}</b><small>{line(x) || x.s}</small></div><span className={'st ' + (x.k === 'p' ? 'viewed' : 'ok')}>{x.k === 'p' ? 'Pencilled' : 'Booked'}</span></div> })}{!upcoming.length && <p className="tempty">Nothing booked yet.</p>}</div>
          </div>
          {!LIVE && !F.gapOffered() && <div className="tlumi"><span className="lm" /><div>23 Nov to 6 Dec is empty. Last year that fortnight was four family sessions. I can post a Christmas minis offer to your profile and message six families from last year.<div className="acts"><button className="y" onClick={() => F.offerGap()}>Post it</button><button onClick={() => F.toast('Noted. I will ask again on Thursday.')}>Not now</button></div></div></div>}
        </div>
      </div>
    </section>
  )
}
