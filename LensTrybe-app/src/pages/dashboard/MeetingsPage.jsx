import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Central Meetings hub. Aggregates every meeting for the creative across all
// projects, standalone meetings they create here, and phone-call requests
// clients send from their profile. Mirrors the project Meetings tab exactly:
// create -> send -> client accepts/declines/proposes -> confirm to calendar.

const TYPE_LABEL = { in_person: 'In person', video: 'Video call', phone: 'Phone call' }

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${ap}`
}
function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function meetingWhen(date, start, end) {
  if (!date) return 'Time to be confirmed'
  if (!start) return fmtDate(date)
  return `${fmtDate(date)} · ${fmtTime(start)}${end ? ' – ' + fmtTime(end) : ''}`
}

const STATUS = {
  draft: { label: 'Draft', color: '#8b8f9a' },
  sent: { label: 'Awaiting client', color: '#4aa3ff' },
  requested: { label: 'Call requested', color: '#FF2D78' },
  reschedule: { label: 'New time proposed', color: '#f5a524' },
  accepted: { label: 'Confirmed', color: '#1DB954' },
  declined: { label: 'Declined', color: '#f0516d' },
}

const CSS = `
.ltm{position:relative;min-height:60vh;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.ltm *{box-sizing:border-box}
.ltm .inner{max-width:1080px;margin:0 auto;position:relative;z-index:1}
.ltm .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.ltm h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0}
.ltm .sub{color:var(--lt-muted);font-size:13.5px;margin-top:4px;max-width:620px}
.ltm .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}
.ltm .btn:hover{background:var(--lt-surface-2)}
.ltm .btn svg{width:15px;height:15px}
.ltm .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700;box-shadow:0 6px 18px -8px rgba(29,185,84,0.7)}
.ltm .btn.primary:hover{background:#22c95f}
.ltm .btn.sm{padding:6px 11px;font-size:12px}
.ltm .btn.danger{color:#f0516d}
.ltm .btn.ghost{background:transparent;border-color:transparent;color:var(--lt-muted)}
.ltm .btn.ghost:hover{color:var(--lt-text);background:var(--lt-surface)}
.ltm .btn:disabled{opacity:.5;cursor:default}
.ltm .segment{display:flex;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:3px;margin-bottom:20px;flex-wrap:wrap}
.ltm .segment button{font-family:inherit;font-size:12.5px;font-weight:600;border:none;background:none;color:var(--lt-muted);padding:6px 13px;border-radius:8px;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px}
.ltm .segment button.on{background:var(--lt-border);color:var(--lt-text)}
.ltm .segment .badge{font-size:10.5px;font-weight:800;background:#FF2D78;color:#fff;border-radius:99px;padding:0 6px;min-width:16px;text-align:center}
.ltm .card{border-radius:15px;padding:16px 17px;margin-bottom:11px;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltm .mrow{display:flex;align-items:flex-start;gap:14px;justify-content:space-between;flex-wrap:wrap}
.ltm .mt{font-size:15px;font-weight:700;letter-spacing:-0.01em;margin-bottom:3px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.ltm .ds{font-size:12.5px;color:var(--lt-muted);margin-bottom:2px}
.ltm .pill{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:0.04em}
.ltm .pill .dot{width:7px;height:7px;border-radius:50%}
.ltm .tpill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--lt-muted);background:var(--lt-surface-2);border-radius:99px;padding:2px 9px}
.ltm .note{margin-top:9px;padding:10px 12px;border-radius:10px;background:var(--lt-surface);font-size:12.5px;color:var(--lt-text)}
.ltm .note b{color:var(--lt-muted);font-weight:700}
.ltm .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
.ltm .link{font-size:12px;font-weight:600;color:#1DB954;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.ltm .link:hover{text-decoration:underline}
.ltm .empty{padding:48px 20px;text-align:center;color:var(--lt-muted);font-size:14px}
.ltm .empty .big{font-size:16px;font-weight:700;color:var(--lt-text);margin-bottom:6px}
.ltm .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto}
.ltm .modalbox{width:100%;max-width:540px;border-radius:20px;padding:26px;background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.ltm .mtitle{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px}
.ltm .msub{font-size:12.5px;color:var(--lt-muted);margin-bottom:18px}
.ltm .field{margin-bottom:14px}
.ltm .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.ltm .inp{width:100%;background:var(--lt-input-bg);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none;transition:.15s}
.ltm .inp:focus{border-color:#1DB954}
.ltm select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.ltm .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ltm .mactions{display:flex;gap:10px;justify-content:flex-end;margin-top:22px}
.ltm .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300;display:flex;align-items:center;gap:9px}
.ltm .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ltm .toast.err{border-color:rgba(240,81,109,0.5)}
@media (max-width:600px){.ltm .g2{grid-template-columns:1fr}}
`

const BLANK = { title: '', project_id: '', meeting_type: 'in_person', meeting_date: '', start_time: '', end_time: '', location: '', description: '', client_name: '', client_email: '' }

export default function MeetingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [meetings, setMeetings] = useState([])
  const [projects, setProjects] = useState([])
  const [hostName, setHostName] = useState('')
  const [filter, setFilter] = useState('action')
  const [toast, setToast] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => { if (user) load() }, [user])
  function flash(msg, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 2400) }

  async function load() {
    setLoading(true)
    const [mt, pj, prof] = await Promise.all([
      supabase.from('meetings').select('*').eq('creative_id', user.id).order('created_at', { ascending: false }),
      supabase.from('projects').select('id, title').eq('creative_id', user.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('business_name').eq('id', user.id).maybeSingle(),
    ])
    setMeetings(mt.data || [])
    setProjects(pj.data || [])
    setHostName((prof.data && prof.data.business_name) || '')
    setLoading(false)
  }

  const projTitle = useMemo(() => { const m = {}; projects.forEach(p => { m[p.id] = p.title }); return m }, [projects])

  const counts = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const isAction = (m) => ['requested', 'reschedule', 'draft'].includes(m.status)
    const isUpcoming = (m) => m.status === 'accepted' && m.meeting_date && new Date(m.meeting_date) >= today
    const isSent = (m) => m.status === 'sent'
    const isPast = (m) => m.status === 'declined' || (m.status === 'accepted' && (!m.meeting_date || new Date(m.meeting_date) < today))
    return {
      action: meetings.filter(isAction).length,
      requests: meetings.filter(m => m.status === 'requested').length,
      fns: { isAction, isUpcoming, isSent, isPast },
    }
  }, [meetings])

  const shown = useMemo(() => {
    const { isAction, isUpcoming, isSent, isPast } = counts.fns
    if (filter === 'action') return meetings.filter(isAction)
    if (filter === 'upcoming') return meetings.filter(isUpcoming)
    if (filter === 'sent') return meetings.filter(isSent)
    if (filter === 'past') return meetings.filter(isPast)
    return meetings
  }, [meetings, filter, counts])

  function openNew() { setEditing(null); setForm(BLANK); setShowModal(true) }
  function openEdit(m, asPropose) {
    setEditing({ ...m, _propose: asPropose })
    setForm({
      title: m.title || '', project_id: m.project_id || '', meeting_type: m.meeting_type || 'in_person',
      meeting_date: m.meeting_date || '', start_time: m.start_time || '', end_time: m.end_time || '',
      location: m.location || '', description: m.description || '',
      client_name: m.client_name || '', client_email: m.client_email || '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.title.trim()) { flash('Add a title', 'err'); return }
    setSaving(true)
    const payload = {
      creative_id: user.id,
      project_id: form.project_id || null,
      title: form.title.trim(),
      meeting_type: form.meeting_type,
      meeting_date: form.meeting_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location || null,
      description: form.description || null,
      client_name: form.client_name || null,
      client_email: form.client_email || null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('meetings').update(payload).eq('id', editing.id)
      setSaving(false)
      if (error) { flash('Could not save', 'err'); return }
      const proposing = editing._propose
      setShowModal(false)
      await load()
      if (proposing) { const fresh = { ...editing, ...payload }; await sendMeeting(fresh) }
      else flash('Meeting updated')
    } else {
      const { data, error } = await supabase.from('meetings').insert({ ...payload, status: 'draft' }).select().single()
      setSaving(false)
      if (error) { flash('Could not create meeting', 'err'); return }
      setMeetings(prev => [data, ...prev])
      setShowModal(false)
      flash('Meeting created. Send it when you’re ready.')
    }
  }

  async function sendMeeting(m) {
    setBusyId(m.id)
    const { error } = await supabase.functions.invoke('send-meeting', { body: { meetingId: m.id, appUrl: window.location.origin, host: { name: hostName || 'Your LensTrybe creative', email: user.email } } })
    setBusyId(null)
    if (error) { flash('Could not send', 'err'); return }
    setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, status: 'sent' } : x))
    flash('Sent to the client')
  }

  async function confirmMeeting(m, useProposed) {
    const date = useProposed ? m.client_proposed_date : m.meeting_date
    const start = useProposed ? m.client_proposed_time : m.start_time
    if (!date) { flash('Set a date first', 'err'); return }
    setBusyId(m.id)
    const evPayload = { user_id: user.id, title: m.title, event_date: date, start_time: start || null, end_time: m.end_time || null, location: m.meeting_type === 'phone' ? 'Phone call' : (m.location || null), notes: m.description || null, project_id: m.project_id || null, invitees: m.client_email ? [m.client_email] : [] }
    let calId = m.calendar_event_id
    if (calId) await supabase.from('calendar_events').update({ ...evPayload, updated_at: new Date().toISOString() }).eq('id', calId)
    else { const { data: ev } = await supabase.from('calendar_events').insert(evPayload).select().single(); calId = ev && ev.id }
    const patch = { status: 'accepted', meeting_date: date, start_time: start || null, calendar_event_id: calId || null, updated_at: new Date().toISOString() }
    await supabase.from('meetings').update(patch).eq('id', m.id)
    setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, ...patch } : x))
    // Let the client know (calendar invite + confirmation email).
    if (m.origin === 'client') { try { await supabase.functions.invoke('meeting-notify', { body: { meetingId: m.id, kind: 'confirmed' } }) } catch { /* best effort */ } }
    else { try { await supabase.functions.invoke('send-event-invite', { body: { event: { ...evPayload, id: calId, updated_at: new Date().toISOString() }, host: { name: hostName, email: user.email } } }) } catch { /* best effort */ } }
    setBusyId(null)
    flash('Confirmed and added to your calendar')
  }

  async function declineRequest(m) {
    setBusyId(m.id)
    await supabase.from('meetings').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', m.id)
    setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, status: 'declined' } : x))
    try { await supabase.functions.invoke('meeting-notify', { body: { meetingId: m.id, kind: 'declined' } }) } catch { /* best effort */ }
    setBusyId(null)
    flash('Client has been let know')
  }

  async function deleteMeeting(m) {
    if (m.calendar_event_id) await supabase.from('calendar_events').delete().eq('id', m.calendar_event_id).catch(() => {})
    setMeetings(prev => prev.filter(x => x.id !== m.id))
    await supabase.from('meetings').delete().eq('id', m.id)
    flash('Meeting deleted')
  }

  const filters = [
    { key: 'action', label: 'Action needed', badge: counts.action },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'sent', label: 'Awaiting client' },
    { key: 'past', label: 'Past & closed' },
    { key: 'all', label: 'All' },
  ]

  function Row({ m }) {
    const st = STATUS[m.status] || STATUS.draft
    const busy = busyId === m.id
    return (
      <div className="card">
        <div className="mrow">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mt">
              {m.title}
              <span className="pill" style={{ background: st.color + '22', color: st.color }}><span className="dot" style={{ background: st.color }} />{st.label}</span>
              {m.origin === 'client' && <span className="tpill" style={{ background: 'rgba(255,45,120,0.14)', color: '#FF2D78' }}>Client request</span>}
            </div>
            <div className="ds">
              <span className="tpill" style={{ marginRight: 8 }}>{TYPE_LABEL[m.meeting_type] || 'Meeting'}</span>
              {meetingWhen(m.meeting_date, m.start_time, m.end_time)}
            </div>
            <div className="ds">
              {m.client_name || 'Client'}{m.client_email ? ' · ' + m.client_email : ''}{m.client_phone ? ' · ' + m.client_phone : ''}
              {m.project_id ? <> · <span className="link" onClick={() => navigate(`/dashboard/projects/${m.project_id}`)}>{projTitle[m.project_id] || 'Project'} ↗</span></> : null}
            </div>
            {(m.status === 'requested' || m.status === 'reschedule') && (m.client_proposed_date || m.client_message) && (
              <div className="note">
                {m.client_proposed_date && <div><b>Client suggested:</b> {meetingWhen(m.client_proposed_date, m.client_proposed_time)}</div>}
                {m.client_message && <div style={{ marginTop: m.client_proposed_date ? 4 : 0 }}><b>Note:</b> {m.client_message}</div>}
              </div>
            )}
            {m.status === 'accepted' && m.calendar_event_id && <div className="ds" style={{ color: '#1DB954', marginTop: 6 }}>✓ On your calendar</div>}
          </div>
        </div>
        <div className="acts">
          {m.status === 'draft' && <button className="btn primary sm" disabled={busy} onClick={() => sendMeeting(m)}>Send to client</button>}
          {m.status === 'sent' && <><button className="btn sm" disabled={busy} onClick={() => sendMeeting(m)}>Resend</button><button className="btn primary sm" disabled={busy} onClick={() => confirmMeeting(m, false)}>Confirm</button></>}
          {m.status === 'reschedule' && <><button className="btn primary sm" disabled={busy} onClick={() => confirmMeeting(m, true)}>Accept their time</button><button className="btn sm" disabled={busy} onClick={() => openEdit(m, true)}>Send new time</button></>}
          {m.status === 'requested' && <>
            <button className="btn primary sm" disabled={busy} onClick={() => confirmMeeting(m, true)}>Accept</button>
            <button className="btn sm" disabled={busy} onClick={() => openEdit(m, true)}>Propose new time</button>
            <button className="btn sm danger" disabled={busy} onClick={() => declineRequest(m)}>Decline</button>
          </>}
          {m.status === 'declined' && <button className="btn sm" disabled={busy} onClick={() => openEdit(m, true)}>Propose another time</button>}
          {m.status === 'accepted' && <button className="btn sm" onClick={() => openEdit(m, false)}>Edit</button>}
          <button className="btn sm ghost" onClick={() => deleteMeeting(m)}>Delete</button>
        </div>
      </div>
    )
  }

  const projectOptions = [{ id: '', title: 'No project (standalone)' }, ...projects]

  return (
    <div className="ltm">
      <style>{CSS}</style>
      <div className="inner">
        <div className="phead">
          <div>
            <h1>Meetings</h1>
            <div className="sub">Every call and meeting in one place. Send a request, let clients accept, decline or propose a time, and confirm it straight to your calendar.</div>
          </div>
          <button className="btn primary" onClick={openNew}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>New meeting
          </button>
        </div>

        <div className="segment">
          {filters.map(f => (
            <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
              {f.label}{f.badge ? <span className="badge">{f.badge}</span> : null}
            </button>
          ))}
        </div>

        {loading ? <div className="empty">Loading meetings…</div> : shown.length === 0 ? (
          <div className="card"><div className="empty">
            <div className="big">{filter === 'action' ? 'Nothing needs your attention' : 'No meetings here yet'}</div>
            {filter === 'action' ? 'Client call requests and time proposals will show up here.' : 'Create a meeting and send it to your client to get started.'}
          </div></div>
        ) : shown.map(m => <Row key={m.id} m={m} />)}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">{editing ? (editing._propose ? 'Propose a new time' : 'Edit meeting') : 'New meeting'}</div>
            <div className="msub">{editing && editing._propose ? 'Set a time that suits you, then send it for the client to accept.' : 'Create it, then send it to your client to accept, decline or propose a time.'}</div>

            <div className="field"><label className="lab">Title</label><input className="inp" autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Pre-shoot call" /></div>
            <div className="g2">
              <div className="field"><label className="lab">Type</label>
                <select className="inp" value={form.meeting_type} onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value }))}>
                  <option value="in_person">In person</option>
                  <option value="video">Video call</option>
                  <option value="phone">Phone call</option>
                </select>
              </div>
              <div className="field"><label className="lab">Project (optional)</label>
                <select className="inp" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                  {projectOptions.map(p => <option key={p.id || 'none'} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>
            <div className="g2">
              <div className="field"><label className="lab">Date</label><input className="inp" type="date" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} /></div>
              <div className="field"><label className="lab">{form.meeting_type === 'phone' ? 'Phone (optional)' : 'Location or link'}</label><input className="inp" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder={form.meeting_type === 'phone' ? 'Number to call' : 'Zoom, cafe…'} /></div>
            </div>
            <div className="g2">
              <div className="field"><label className="lab">Start</label><input className="inp" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
              <div className="field"><label className="lab">End</label><input className="inp" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
            </div>
            <div className="g2">
              <div className="field"><label className="lab">Client name</label><input className="inp" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} /></div>
              <div className="field"><label className="lab">Client email</label><input className="inp" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} placeholder="Where the invite is sent" /></div>
            </div>
            <div className="field"><label className="lab">Details</label><textarea className="inp" style={{ minHeight: 70, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What the meeting is about…" /></div>

            <div className="mactions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" disabled={saving || !form.title.trim()} onClick={save}>{saving ? 'Saving…' : editing ? (editing._propose ? 'Save & send' : 'Save changes') : 'Create meeting'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast show' + (toast.type === 'err' ? ' err' : '')}>{toast.type === 'err' ? '⚠' : '✓'} {toast.msg}</div>}
    </div>
  )
}
