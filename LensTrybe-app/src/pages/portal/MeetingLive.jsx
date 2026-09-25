import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { TokenShell, Loading, NotOurs } from './TokenShell'
import { loadMeeting, respondMeeting, isUuid } from '../../lib/live'

// /meeting/:token — a meeting the creative proposed. Yes, suggest another time, or can't make it.
// meeting-respond does the checking and tells the creative; nothing here needs a login.
const fmtTime = t => { if (!t) return ''; const [h, m] = String(t).split(':').map(Number); const d = new Date(); d.setHours(h, m || 0); return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase() }
const fmtDate = d => { if (!d) return ''; const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

export default function MeetingLive() {
  const { token } = useParams()
  const [m, setM] = useState(undefined), [mode, setMode] = useState('view'), [done, setDone] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [note, setNote] = useState('')
  useEffect(() => { let on = true; if (!isUuid(token)) return setM(null); loadMeeting(token).then(x => on && setM(x)).catch(() => on && setM(null)); return () => { on = false } }, [token])
  if (m === undefined) return <Loading text="Opening the meeting." />
  if (m === null) return <NotOurs what="meeting link" />
  const host = m.host || 'Your creative'
  const go = async r => { setBusy(true); setErr(''); try { await respondMeeting(token, r, { date, time, message: note }); setDone(r) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const already = ['confirmed', 'accepted', 'declined'].includes(String(m.status || '').toLowerCase())
  return (
    <TokenShell creative={{ business_name: host }} sub="Meeting request">
      <div className="pjob lg tdoc">
        {done ? <div className="tdone"><span className={'tick' + (done === 'declined' ? ' no' : '')}><Icon name={done === 'declined' ? 'x' : 'check'} size={16} /></span><div><b>{done === 'accepted' ? 'You are confirmed.' : done === 'declined' ? 'Response sent.' : 'New time suggested.'}</b><small>{done === 'accepted' ? host + ' has been told and it is in their calendar.' : done === 'declined' ? host + ' knows you cannot make it.' : host + ' will look at your time and come back to you.'}</small></div></div> : <>
          <div className="pjhead"><div><p className="eb g">Meeting request</p><h1>{m.title || 'Meeting'}</h1><p className="sub">from {host}</p></div>
            <div className="pnext"><small>When</small><b>{m.meeting_date ? fmtDate(m.meeting_date) : 'Time to be confirmed'}</b>{m.start_time && <span>{fmtTime(m.start_time)}{m.end_time ? ' to ' + fmtTime(m.end_time) : ''}</span>}</div></div>
          {(m.location || m.meeting_type || m.description) && <div className="tkv">{m.meeting_type && <div><span>How</span><b>{m.meeting_type}</b></div>}{m.location && <div><span>Where</span><b>{m.location}</b></div>}{m.description && <div><span>Details</span><b>{m.description}</b></div>}</div>}
          {already && <div className="tsys">You have already answered this one ({String(m.status).toLowerCase()}). Answering again replaces it.</div>}
          {mode === 'view' && <div className="trow col">
            <button className="btn p" onClick={() => go('accepted')} disabled={busy}>{busy ? 'Saving' : 'Yes, this works'} <Icon name="check" size={14} /></button>
            <button className="btn g" onClick={() => setMode('reschedule')} disabled={busy}>Suggest another time</button>
            <button className="lnk pinkish" onClick={() => setMode('decline')} disabled={busy}>I can't make it</button>
          </div>}
          {mode === 'reschedule' && <>
            <div className="two"><div className="field"><label htmlFor="mt-d">Date</label><input id="mt-d" type="date" value={date} onChange={e => setDate(e.target.value)} /></div><div className="field"><label htmlFor="mt-t">Time</label><input id="mt-t" type="time" value={time} onChange={e => setTime(e.target.value)} /></div></div>
            <div className="field"><label htmlFor="mt-n">A note, optional</label><textarea id="mt-n" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Mornings are best for us" /></div>
            <div className="trow"><button className="btn p" onClick={() => go('reschedule')} disabled={busy || !date}>{busy ? 'Sending' : 'Send suggested time'} <Icon name="arrow" size={14} /></button><button className="btn g" onClick={() => setMode('view')} disabled={busy}>Back</button></div>
          </>}
          {mode === 'decline' && <>
            <div className="field"><label htmlFor="mt-n2">Let {host} know, optional</label><textarea id="mt-n2" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="A quick note" /></div>
            <div className="trow"><button className="btn p" onClick={() => go('declined')} disabled={busy}>{busy ? 'Sending' : 'Send response'} <Icon name="arrow" size={14} /></button><button className="btn g" onClick={() => setMode('view')} disabled={busy}>Back</button></div>
          </>}
          {err && <p className="fine" style={{ color: 'var(--pink-t)' }}>{err}</p>}
        </>}
      </div>
      <p className="fine" style={{ textAlign: 'center', marginTop: 18 }}>No account needed. <Link to="/" style={{ color: 'var(--green-t)' }}>lenstrybe.com</Link></p>
    </TokenShell>
  )
}
