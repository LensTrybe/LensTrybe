import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, dow, parse, addDays } from '../../lib/store'
import { fmt } from '../../lib/format'
import { occurrences, line as evLine, ampm } from '../../lib/cal'
import Chart from './Chart'
import SetupCard from './Setup'
import { completeness } from '../../lib/complete'

const BRIEF0 = "One shoot today at 10 for Coastline Realty, three listings in Noosa Heads, leave by 9:20. Two quotes are waiting on you. Blackwood paid overnight, so nothing is overdue. Ruby and Sol enquired about March 2027 and a reply is drafted. And 23 November to 6 December is empty, which last year was four family sessions."
const HI = /(One shoot today at 10|nothing is overdue|Ruby and Sol enquired|23 November to 6 December is empty|a photo, a line about you and one kind of work)/

// Today: what is on, what needs a yes, and how the month is going. Everything here is one tap
// from the thing itself, and every button changes a real record in the store.
export default function Today() {
  const F = useFlows(); const { s, nav } = F
  const [txt, setTxt] = useState('')
  const comp = completeness(s); const showSetup = !comp.complete && !s.setup?.hidden
  const BRIEF = s.setup?.joined ? 'Welcome in, ' + s.profile.n.split(' ')[0] + '. Your workspace is open, with sample bookings, quotes and clients in it so you can see how everything fits together; they clear the moment your first real enquiry lands. Your profile goes live once it has a photo, a line about you and one kind of work. The checklist above walks you through it, and I will draft the bio from your answers.' : BRIEF0
  useEffect(() => { let i = 0, t; const step = () => { if (i <= BRIEF.length) { setTxt(BRIEF.slice(0, i)); i += 3; t = setTimeout(step, 16) } }; step(); return () => clearTimeout(t) }, [BRIEF])
  const parts = txt.split(HI)
  const need = s.threads.filter(t => t.need)
  const h = new Date().getHours(), greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const owed = s.ledger.filter(r => r.k === 'inv' && r.st !== 'ok'), owedV = owed.reduce((t, r) => t + r.v, 0)
  const next90 = useMemo(() => occurrences(s.events, TODAY, addDays(TODAY, 90)).filter(e => (e.k === 'b' || e.k === 'p') && e.first).map(e => ({ ...e, d: e.on, id: e.oid })).sort((a, b) => a.d < b.d ? -1 : 1), [s.events])
  const fresh = s.events.filter(e => e.created && Date.now() - e.created < 7 * 864e5).length
  const paid = 9840 - 2100 + s.ledger.filter(r => r.k === 'inv' && r.st === 'ok' && r.date.startsWith(TODAY.slice(0, 7))).reduce((t, r) => t + r.v, 0)
  const KP = [
    ['Earned this month', fmt(paid), '▲ 18% on August', '', 'M0 24L11 20L22 22L33 14L44 16L55 9L66 11L84 3', '/app/money'],
    ['Outstanding', fmt(owedV), owed.length ? owed.length + (owed.length === 1 ? ' invoice' : ' invoices') + ', due ' + nice(owed.slice().sort((a, b) => a.date < b.date ? -1 : 1)[0].date) : 'Nothing owed', owed.length ? 'w' : '', 'M0 8L11 12L22 10L33 17L44 15L55 20L66 19L84 22', '/app/invoicing'],
    ['Booked, next 90 days', String(next90.length), (4 + fresh) + ' new this week', '', 'M0 22L11 22L22 17L33 18L44 12L55 13L66 6L84 5', '/app/bookings'],
    ['Profile views', '1,284', '▲ 41% since launch', '', 'M0 26L11 24L22 25L33 22L44 20L55 15L66 8L84 2', '/app/view-profile'],
  ]
  // today's timeline: shoots on the calendar, meetings, and money moving
  const day = useMemo(() => {
    const out = []
    s.galleries.filter(g => g.log?.[0]?.[0]?.startsWith('Today')).slice(0, 1).forEach(g => out.push({ t: '7:30', b: 'Sneak peek · ' + g.n, s: '20 photos, sent from Deliver', k: 'done', st: 'Done', to: '/app/deliver' }))
    occurrences(s.events, TODAY, TODAY).filter(e => e.k !== 'x').forEach(e => out.push({ t: e.time || '10:00', b: e.n, s: evLine(e) || e.s, k: 'now', st: 'Now', to: e.t ? '/app/thread/' + e.t : '/app/bookings' }))
    s.meetings.filter(m => m.when.startsWith(TODAY)).forEach(m => out.push({ t: m.when.slice(11), b: (m.how === 'Video' ? 'Call' : m.how) + ' · ' + m.who, s: (s.meetingTypes.find(x => x.id === m.t)?.n || 'Meeting') + ', ' + (s.meetingTypes.find(x => x.id === m.t)?.m || 20) + ' minutes', k: '', st: 'Call', to: '/app/thread/' + m.th }))
    owed.slice(0, 1).forEach(r => out.push({ t: '16:00', b: 'Balance due · ' + r.id, s: fmt(r.v) + ' · reminder goes on its own', k: '', st: 'Auto', to: '/app/invoicing' }))
    return out.sort((a, b) => a.t.padStart(5, '0') < b.t.padStart(5, '0') ? -1 : 1)
  }, [s.events, s.meetings, s.galleries, owed]) // eslint-disable-line
  const gapOffered = F.gapOffered()
  const up = [...next90.slice(0, 4).map(e => ({ id: e.id, dow: dow(e.d), d: parse(e.d).getDate(), m: nice(e.d).split(' ')[1], b: e.n, s: evLine(e) || e.s, amt: e.v ? fmt(e.v) : (e.k === 'p' ? 'Pencilled' : ''), to: e.t ? '/app/thread/' + e.t : '/app/bookings' })), ...(!gapOffered ? [{ id: 'gap', dow: 'gap', d: 23, m: 'Nov', b: '23 Nov to 6 Dec is open', s: 'Last year: four family sessions. An offer is drafted.', amt: 'Fill it', to: 'gap' }] : [])]
  const act = (e, fn) => { e.stopPropagation(); fn() }
  const replyRuby = () => F.replyRuby()
  return (
    <section className="view">
      <div className="vh">
        <div><h1>{greet}, <em>{s.profile.n.split(' ')[0]}.</em></h1><p>{parse(TODAY).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} · sunny, 26° in Noosa · {day.filter(x => x.k === 'now').length || 'no'} shoot{day.filter(x => x.k === 'now').length === 1 ? '' : 's'}, {need.length} waiting on you{!gapOffered ? ', one gap worth filling' : ''}.</p></div>
        <div className="acts"><button className="btn g" onClick={() => nav('/app/bookings')}><Icon name="cal" size={15} />Calendar</button><button className="btn w" onClick={() => F.newBooking()}><Icon name="plus" size={15} />New booking</button></div>
      </div>

      <div className="grid">
        {showSetup && <div className="s12"><SetupCard onHide={() => { F.patch('setup', { hidden: 1 }); F.toast('Hidden. It is always on Edit profile.') }} /></div>}
        <div className="card lg brief s12">
          <span className="lm" aria-hidden="true" />
          <div>
            <p>{parts.map((p, i) => i % 2 ? <b key={i}>{p}</b> : p)}{txt.length < BRIEF.length && <span className="cur" />}</p>
            <div className="bfx">
              {s.threads.find(t => t.id === 'ruby')?.need && <button className="chip p" onClick={replyRuby}>Reply to Ruby and Sol <Icon name="arrow" size={13} /></button>}
              {s.threads.find(t => t.id === 'coastline')?.need && <button className="chip" onClick={() => F.nudge('coastline')}>Nudge Coastline</button>}
              {!gapOffered && <button className="chip" onClick={() => F.offerGap()}>Fill the December gap</button>}
              <small>Lumi, 6:50 am · <Link to="/app/lumi" className="lnk">{need.length} waiting for your yes</Link></small>
            </div>
          </div>
        </div>

        <div className="s12"><div className="kp">{KP.map(([l, v, e, w, p, to]) => <div key={l} className="k lg" onClick={() => nav(to)} role="link" tabIndex={0}><small>{l}</small><b>{v}</b><em className={w}>{e}</em><svg viewBox="0 0 84 30"><path d={p} className={w} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>)}</div></div>

        <div className="card lg s5"><div className="h"><b>Today</b><Link to="/app/bookings">Calendar <Icon name="arrow" size={12} /></Link></div>
          <div className="tl">{day.map((x, i) => <div key={i} className={'e ' + x.k} onClick={() => nav(x.to)}><span className="t">{/^\d/.test(x.t) ? ampm(x.t) : x.t}</span><div><b>{x.b}</b><small>{x.s}</small></div><span className={'st ' + (x.k === 'now' ? 'now' : x.k === 'done' ? 'ok' : 'grey')}>{x.st}</span></div>)}{!day.length && <p className="tempty">A clear day. <button className="lnk" onClick={() => F.newBooking(TODAY)}>Add something</button></p>}</div>
        </div>

        <div className="card lg s7"><div className="h"><b>Needs you <span className="st ok">{need.length}</span></b><Link to="/app/threads">All threads <Icon name="arrow" size={12} /></Link></div>
          <div className="need">
            {need.map(t => {
              const q = s.ledger.find(r => r.t === t.id && r.k === 'q' && r.st !== 'ok'), c = s.ledger.find(r => r.t === t.id && r.k === 'c' && r.st === 'grey')
              return (
                <div key={t.id} className="r" onClick={() => nav('/app/thread/' + t.id)}>
                  <span className="av" style={{ background: t.g }} />
                  <div><b>{t.n} · {t.j}</b><small><i>{t.next}</i> · {t.d}</small></div>
                  <div className="do">
                    {t.id === 'ruby' && <><button className="y" onClick={e => act(e, replyRuby)}>Send reply</button><button onClick={e => act(e, () => nav('/app/thread/ruby'))}>Edit</button></>}
                    {t.id !== 'ruby' && q && <><button className="y" onClick={e => act(e, () => F.nudge(t.id))}>Nudge</button><button onClick={e => act(e, () => F.wait(t.id))}>Wait</button></>}
                    {t.id !== 'ruby' && !q && c && <><button className="y" onClick={e => act(e, () => F.sendContract(t.id))}>Send contract</button><button onClick={e => act(e, () => nav('/app/thread/' + t.id))}>Open</button></>}
                    {t.id !== 'ruby' && !q && !c && <><button className="y" onClick={e => act(e, () => F.reply(t.id))}>Reply</button><button onClick={e => act(e, () => F.wait(t.id))}>Wait</button></>}
                  </div>
                </div>
              )
            })}
            {!need.length && <p className="tempty">Inbox zero. Lumi will say when something needs a yes.</p>}
          </div>
        </div>

        <div className="card lg s7"><div className="h"><b>Money this year</b><Link to="/app/money">Ledger <Icon name="arrow" size={12} /></Link></div><Chart id="t" /></div>

        <div className="card lg s5"><div className="h"><b>Coming up</b><Link to="/app/bookings">Next 90 days <Icon name="arrow" size={12} /></Link></div>
          <div className="up">{up.map(x => <div key={x.id} className={'d' + (x.dow === 'gap' ? ' gap' : '')} onClick={() => x.to === 'gap' ? F.offerGap() : nav(x.to)}><div className="dt"><small>{x.dow === 'gap' ? x.m : x.dow}</small><b>{x.d}</b></div><div><b>{x.b}</b><small>{x.s}</small></div><span className="amt">{x.amt}</span></div>)}{!up.length && <p className="tempty">Nothing booked in the next 90 days.</p>}</div>
        </div>
      </div>
    </section>
  )
}
