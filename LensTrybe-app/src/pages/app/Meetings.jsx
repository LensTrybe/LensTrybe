import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY } from '../../lib/store'
import { LIVE } from '../../lib/mode'
import * as live from '../../lib/live'

// Meetings: calls and consults booked from your link, synced to the calendar, prepped by Lumi.
const when = s => { const d = new Date(s); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase() }
const day = s => new Date(s).getDate(), dow = s => new Date(s).toLocaleDateString('en-AU', { weekday: 'short' })

export default function Meetings() {
  const F = useFlows(); const { s, toast, upd } = F; const M = s.meetings, TYPES = s.meetingTypes
  const [f, setF] = useState('up'), [sel, setSel] = useState(M.find(x => x.st !== 'done')?.id)
  const stOf = x => x.st === 'done' ? 'done' : x.when.startsWith(TODAY) ? 'today' : 'up'
  const list = useMemo(() => M.filter(m => f === 'all' || (f === 'up' ? m.st !== 'done' : m.st === 'done')).sort((a, b) => f === 'done' ? (a.when < b.when ? 1 : -1) : (a.when < b.when ? -1 : 1)), [M, f])
  const m = M.find(x => x.id === sel) || list[0], T = m && (TYPES.find(t => t.id === m.t) || TYPES[0])
  const wk = M.filter(x => x.st !== 'done' && x.when >= TODAY && x.when < '2026-09-28').length
  // live: what the row is up to, in words
  const LST = { draft: ['grey', 'Not sent'], sent: ['sent', 'Invite sent'], accepted: ['ok', 'Confirmed'], reschedule: ['viewed', 'Time suggested'], declined: ['pink', 'Declined'], cancelled: ['pink', 'Cancelled'] }
  const lst = x => LST[x.status] || ['grey', x.status || '']
  const after = async (fn, msg) => { try { await fn(); await F.refreshLive(); if (msg) toast(msg) } catch (e) { toast(e.message) } }
  const liveReschedule = () => F.open({ title: 'New time · ' + m.who, sub: 'They get a fresh invite email with the new time.', cta: 'Send new time', fields: [{ k: 'd', l: 'Date', type: 'date', required: true, half: true, value: m.when.slice(0, 10), min: TODAY }, { k: 'time', l: 'Time', type: 'time', required: true, half: true, value: m.when.slice(11) }, { k: 'how', l: 'How', type: 'select', value: m.how, options: ['Video', 'Phone', 'In person'] }], submit: v => after(() => live.rescheduleMeeting(m.live.id, v.d, v.time, v.how), 'New time sent to ' + m.who.split(' ')[0] + '.') })
  const liveCancel = () => F.confirm({ title: 'Cancel with ' + m.who + '?', body: 'They get an email saying you cannot make it.', cta: 'Cancel meeting', danger: true, onYes: () => { after(() => live.declineMeeting(m.live.id), 'Cancelled. ' + m.who.split(' ')[0] + ' has been told.'); setSel(null) } })
  const liveDelete = () => F.confirm({ title: 'Delete this meeting?', body: 'It comes off your list. Nothing is sent.', cta: 'Delete', danger: true, onYes: () => { after(() => live.deleteMeeting(m.live.id)); setSel(null) } })
  const reschedule = () => LIVE ? liveReschedule() : F.open({ title: 'Reschedule · ' + m.who, sub: 'They get the new time by text and email, and both calendars move.', cta: 'Move it', fields: [{ k: 'd', l: 'Date', type: 'date', required: true, half: true, value: m.when.slice(0, 10), min: TODAY }, { k: 'time', l: 'Time', type: 'time', required: true, half: true, value: m.when.slice(11) }, { k: 'how', l: 'How', type: 'select', value: m.how, options: ['Video', 'Phone', 'In person'] }], submit: v => { upd('meetings', m.id, { when: v.d + 'T' + v.time, how: v.how, st: v.d === TODAY ? 'today' : 'up' }); F.say(m.th, 'sys', 'Meeting moved to ' + when(v.d + 'T' + v.time)); toast('Moved. ' + m.who.split(' ')[0] + ' has the new time.') } })
  const cancel = () => LIVE ? liveCancel() : F.confirm({ title: 'Cancel with ' + m.who + '?', body: 'They get a message from you. The slot opens up on your link.', cta: 'Cancel meeting', danger: true, onYes: () => { F.del('meetings', m.id); F.say(m.th, 'sys', 'Meeting cancelled · ' + when(m.when)); setSel(null); toast('Cancelled. ' + m.who.split(' ')[0] + ' knows.') } })
  const done = () => F.open({ title: 'After the call', sub: 'A line or two goes into the thread and onto the client.', cta: 'Done', fields: [{ k: 'notes', l: 'What was said', type: 'textarea', rows: 5, placeholder: 'Decisions, dates, anything to follow up' }, { k: 'next', l: 'Next', type: 'select', value: '', options: [['', 'Nothing yet'], ['q', 'Send a quote'], ['book', 'Book the date'], ['c', 'Send the contract']] }], submit: v => { upd('meetings', m.id, { st: 'done', notes: v.notes }); if (v.notes) F.say(m.th, 'sys', 'Call notes · ' + v.notes); if (v.next === 'q') F.newDoc('q', { client: m.th }); else if (v.next === 'book') F.newBooking('', { client: m.th }); else if (v.next === 'c') F.newDoc('c', { client: m.th }); toast('Done. Notes are in the thread.') } })
  const remind = () => { F.say(m.th, 'me', `Hi ${m.who.split(' ')[0]}, looking forward to our ${T.n.toLowerCase()} ${when(m.when)}. ${m.how === 'Video' ? 'The link is in this thread.' : 'I will call you.'}`); toast('Reminder sent to ' + m.who.split(' ')[0] + '.') }
  const editType = t => F.open({ title: t ? t.n : 'New meeting type', cta: 'Save', fields: [{ k: 'n', l: 'Name', required: true, value: t?.n || '' }, { k: 'm', l: 'Minutes', type: 'number', half: true, value: t?.m || 30, min: 5, step: 5 }, { k: 'on', l: 'On your link', type: 'toggle', value: t ? !!t.on : true, half: true }, { k: 'd', l: 'One line', value: t?.d || '' }], alt: t ? { l: 'Remove', on: () => F.del('meetingTypes', t.id) } : undefined, submit: v => { if (t) upd('meetingTypes', t.id, { ...v, on: v.on ? 1 : 0 }); else F.add('meetingTypes', { id: v.n.toLowerCase().replace(/[^a-z0-9]+/g, '-'), n: v.n, m: v.m, d: v.d, on: v.on ? 1 : 0 }, 'any'); toast('Saved.') } })
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Meetings</h1><p>Calls and consults booked from your link, on the calendar the moment they land.</p></div>
        <div className="acts">{!LIVE && <span className="syncb"><i />Google Calendar · synced</span>}<button className="btn w" onClick={() => F.newMeeting()}><Icon name="plus" size={15} />{LIVE ? 'Propose a meeting' : 'New meeting'}</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {(LIVE ? [['Coming up', String(M.filter(x => x.st !== 'done').length), M.filter(x => x.st !== 'done').slice(0, 2).map(x => x.who).join(', ') || 'nothing proposed', ''], ['Waiting on a reply', String(M.filter(x => x.status === 'sent').length), 'invites sent, not yet answered', ''], ['Time suggested', String(M.filter(x => x.status === 'reschedule').length), 'clients who want a different time', M.some(x => x.status === 'reschedule') ? 'w' : ''], ['Confirmed', String(M.filter(x => x.status === 'accepted').length), 'both sides said yes', '']] : [['This week', String(wk), list.filter(x => x.st !== 'done').slice(0, 2).map(x => x.who.split(' ·')[0]).join(', ') || 'nothing booked', ''], ['Booked from your link', '4', 'this month', 'n'], ['Turned into bookings', '3 of 4', 'discovery calls, this quarter', ''], ['No-shows', '0', 'reminders go 24h and 1h before', 'n']]).map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8">
          <div className="h"><div className="tfilt" style={{ padding: 0 }}>{[['up', 'Coming up'], ['done', 'Past'], ['all', 'All']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}<i>{M.filter(x => k === 'all' || (k === 'up' ? x.st !== 'done' : x.st === 'done')).length}</i></button>)}</div></div>
          <div className="up mt">
            {list.map(x => { const t = TYPES.find(y => y.id === x.t) || TYPES[0], st = stOf(x); return (
              <div key={x.id} className={'d' + (m?.id === x.id ? ' on' : '') + (st === 'today' ? ' now' : '')} onClick={() => setSel(x.id)}>
                <div className="dt"><small>{dow(x.when)}</small><b>{day(x.when)}</b></div>
                <span className="av" style={{ background: x.g }} />
                <div><b>{x.who}</b><small>{LIVE ? (x.title || 'Meeting') + ' · ' : t.n + ' · ' + t.m + ' min · '}{x.how} · {when(x.when).split(' · ')[1]}</small></div>
                {LIVE ? <span className={'st ' + lst(x)[0]}>{lst(x)[1]}</span> : <span className={'st ' + (st === 'today' ? 'now' : st === 'done' ? 'grey' : 'ok')}>{st === 'today' ? 'Today' : st === 'done' ? 'Done' : 'Booked'}</span>}
              </div>) })}
            {!list.length && <div className="tempty">Nothing here. <button className="lnk" onClick={() => F.newMeeting()}>Book one</button></div>}
          </div>

          {!LIVE && <><div className="h" style={{ marginTop: 22 }}><b>Your booking link</b><span className="lnkrow inl"><Icon name="globe" size={13} /><span>mara.lenstrybe.com/meet</span><button onClick={() => { try { navigator.clipboard?.writeText('https://mara.lenstrybe.com/meet')?.catch(() => {}) } catch {} toast('Link copied') }}>Copy</button></span></div>
          <div className="mtypes">
            {TYPES.map(t => <div key={t.id} className={'mtype' + (t.on ? '' : ' off')}><div style={{ cursor: 'pointer' }} onClick={() => editType(t)}><b>{t.n} <small>{t.m} min</small></b><span>{t.d}</span></div><label className={'sw2' + (t.on ? ' on' : '')}><input type="checkbox" checked={!!t.on} onChange={() => upd('meetingTypes', t.id, { on: t.on ? 0 : 1 })} /><i /></label></div>)}
          </div>
          <p className="tempty" style={{ textAlign: 'left', padding: '10px 2px 0', fontSize: 12 }}>Clients pick a type and a time from your <Link to="/app/availability" className="lnk">availability</Link>. Booked days never show. <button className="lnk" onClick={() => editType(null)}>Add a type</button></p></>}
        </div>

        {m && <div className="s4 side">
          <div className="card lg">
            <div className="h"><b style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="av" style={{ background: m.g, width: 30, height: 30, borderRadius: 10 }} />{m.who}</b>{LIVE ? <span className={'st ' + lst(m)[0]}>{lst(m)[1]}</span> : <span className={'st ' + (stOf(m) === 'today' ? 'now' : m.st === 'done' ? 'grey' : 'ok')}>{stOf(m) === 'today' ? 'Today' : m.st === 'done' ? 'Done' : 'Booked'}</span>}</div>
            <div className="kv"><span>What</span><b>{LIVE ? (m.title || 'Meeting') : T.n + ' · ' + T.m + ' min'}</b></div>
            <div className="kv"><span>When</span><b>{when(m.when)}</b></div>
            {LIVE && m.proposed && m.status === 'reschedule' && <div className="kv"><span>They suggest</span><b>{when(m.proposed.d + 'T' + (m.proposed.t || '09:00'))}</b></div>}
            <div className="kv"><span>How</span><b>{m.how}{LIVE ? (m.where ? ' · ' + m.where : '') : m.how === 'Video' ? ' · link in the thread' : ''}</b></div>
            {LIVE ? <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {m.status === 'draft' && <button className="btn w sm" onClick={() => after(() => live.sendMeetingLive(m.live.id), 'Invite sent.')}>Send invite <Icon name="arrow" size={13} /></button>}
              {m.status === 'reschedule' && <button className="btn w sm" onClick={() => after(() => live.confirmMeeting(m.live, true), 'Confirmed at their time. They have been emailed.')}>Confirm their time <Icon name="check" size={13} /></button>}
              {m.status === 'sent' && <button className="btn w sm" onClick={() => after(() => live.confirmMeeting(m.live, false), 'Confirmed. They have been emailed.')}>Mark confirmed <Icon name="check" size={13} /></button>}
              {m.th && s.threads.some(t => t.id === m.th) && <Link className="btn g sm" to={'/app/thread/' + m.th}>Thread</Link>}
              {m.st !== 'done' && <><button className="btn g sm" onClick={reschedule}>{m.status === 'reschedule' ? 'Counter with a time' : 'New time'}</button><button className="btn g sm" onClick={cancel}>Cancel</button></>}
              {(m.st === 'done' || m.status === 'draft') && <button className="btn g sm" onClick={liveDelete}>Delete</button>}
            </div> : <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {m.st !== 'done' && <button className="btn w sm" onClick={done}>{m.how === 'Video' ? 'Join' : 'Call'}, then notes <Icon name="arrow" size={13} /></button>}
              <Link className="btn g sm" to={'/app/thread/' + m.th}>Thread</Link>
              {m.st !== 'done' && <><button className="btn g sm" onClick={reschedule}>Reschedule</button><button className="btn g sm" onClick={remind}>Remind</button><button className="btn g sm" onClick={cancel}>Cancel</button></>}
            </div>}
          </div>
          <div className="card lg"><div className="h"><b>{LIVE ? (m.notes ? 'From the client' : 'Details') : m.st === 'done' ? 'Notes' : 'Before the call'}</b>{!LIVE && <small className="lumi-by"><span className="lm" style={{ width: 12, height: 12 }} />Lumi</small>}</div><p className="note2">{m.notes || m.prep || 'Nothing yet.'}</p></div>
          {!LIVE && m.id === 1 && m.st !== 'done' && <div className="tlumi"><span className="lm" /><div>Album selection is at 2:30. I've opened the proof with the two speech spreads they asked about. Want the anniversary session mentioned at the end?<div className="acts"><button className="y" onClick={() => { upd('meetings', 1, { prep: m.prep + ' Raise the first anniversary session at the end.' }); toast('Added to your notes for the call.') }}>Yes, note it</button><button onClick={() => toast('Left out.')}>Not this time</button></div></div></div>}
          {!LIVE && m.id === 2 && m.st !== 'done' && !s.ledger.some(r => r.t === 'ruby' && r.k === 'q') && <div className="tlumi"><span className="lm" /><div>Ruby's quote is drafted but not sent. Sending it before the call means they see the price first; sending after means you set it up. Your call.<div className="acts"><button className="y" onClick={() => F.newDoc('q', { client: 'ruby', d: 'Full day, Maleny', v: 3200 })}>Send now</button><button onClick={() => toast('Held until after the call.')}>After the call</button></div></div></div>}
        </div>}
      </div>
    </section>
  )
}
