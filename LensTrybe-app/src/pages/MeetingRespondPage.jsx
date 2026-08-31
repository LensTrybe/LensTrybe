import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

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
  return dt.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function whenText(date, start, end) {
  if (!date) return 'Time to be confirmed'
  if (!start) return fmtDate(date)
  return `${fmtDate(date)} · ${fmtTime(start)}${end ? ' – ' + fmtTime(end) : ''}`
}

const S = {
  page: { minHeight: '100vh', background: '#f4f1ec', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#14111a', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: 480, background: '#fff', borderRadius: 20, boxShadow: '0 30px 80px -30px rgba(20,17,26,0.28)', padding: 32, boxSizing: 'border-box' },
  brand: { fontWeight: 900, letterSpacing: '-0.02em', fontSize: 18, marginBottom: 24 },
  eyebrow: { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1DB954', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px' },
  from: { fontSize: 14, color: '#6b6976', marginBottom: 20 },
  box: { background: '#f6f5f2', borderRadius: 12, padding: '16px 18px', marginBottom: 22 },
  row: { fontSize: 14, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#86848f', display: 'block', marginBottom: 6, marginTop: 4 },
  input: { width: '100%', border: '1px solid rgba(20,17,26,0.16)', borderRadius: 10, padding: '11px 13px', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', marginBottom: 12 },
  btnPrimary: { width: '100%', background: '#1DB954', color: '#04120a', fontWeight: 700, border: 'none', borderRadius: 11, padding: '13px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 },
  btnOutline: { width: '100%', background: '#fff', color: '#14111a', fontWeight: 600, border: '1px solid rgba(20,17,26,0.16)', borderRadius: 11, padding: '13px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 },
  btnGhost: { width: '100%', background: 'none', color: '#b0334d', fontWeight: 600, border: 'none', padding: '10px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  done: { textAlign: 'center', padding: '20px 0' },
  doneIcon: { width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
}

export default function MeetingRespondPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [meeting, setMeeting] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('view') // view | reschedule | decline
  const [done, setDone] = useState(null) // 'accepted' | 'declined' | 'reschedule'
  const [busy, setBusy] = useState(false)
  const [propDate, setPropDate] = useState('')
  const [propTime, setPropTime] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [token])

  async function load() {
    setLoading(true)
    try {
      const { data, error: e } = await supabase.functions.invoke('meeting-respond', { body: { action: 'get', token } })
      if (e || !data || data.error || !data.meeting) { setError('This meeting link is not valid or has expired.'); setLoading(false); return }
      setMeeting(data.meeting)
    } catch {
      setError('Something went wrong loading this meeting.')
    }
    setLoading(false)
  }

  async function respond(response) {
    setBusy(true)
    try {
      const { data, error: e } = await supabase.functions.invoke('meeting-respond', {
        body: { action: 'respond', token, response, proposed_date: propDate || null, proposed_time: propTime || null, message: message || null },
      })
      if (e || (data && data.error)) { setError('Could not save your response. Please try again.'); setBusy(false); return }
      setDone(response)
    } catch {
      setError('Could not save your response. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div style={S.page}>
      <style>{`input:focus,textarea:focus{border-color:#1DB954 !important}`}</style>
      <div style={S.card}>
        <div style={S.brand}>Lens<span style={{ color: '#FF2D78' }}>Trybe</span></div>

        {loading && <div style={{ color: '#86848f', fontSize: 15, padding: '20px 0' }}>Loading meeting…</div>}

        {!loading && error && !meeting && (
          <div style={{ color: '#6b6976', fontSize: 15, padding: '10px 0' }}>{error}</div>
        )}

        {!loading && meeting && done && (
          <div style={S.done}>
            <div style={{ ...S.doneIcon, background: done === 'declined' ? 'rgba(176,51,77,0.12)' : 'rgba(29,185,84,0.14)' }}>
              {done === 'declined'
                ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#b0334d" strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2.6"><path d="M20 6 9 17l-5-5" /></svg>}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>
              {done === 'accepted' && 'You’re confirmed'}
              {done === 'declined' && 'Response sent'}
              {done === 'reschedule' && 'New time suggested'}
            </div>
            <div style={{ fontSize: 14, color: '#6b6976', lineHeight: 1.5 }}>
              {done === 'accepted' && `${meeting.host} has been notified and will see this in their calendar.`}
              {done === 'declined' && `${meeting.host} has been let know you can’t make it.`}
              {done === 'reschedule' && `${meeting.host} will review your suggested time and get back to you.`}
            </div>
          </div>
        )}

        {!loading && meeting && !done && (
          <>
            <div style={S.eyebrow}>Meeting request</div>
            <h1 style={S.title}>{meeting.title}</h1>
            <div style={S.from}>from {meeting.host}</div>

            <div style={S.box}>
              <div style={S.row}><strong>When:</strong> {whenText(meeting.meeting_date, meeting.start_time, meeting.end_time)}</div>
              {meeting.location && <div style={S.row}><strong>Where:</strong> {meeting.location}</div>}
              {meeting.description && <div style={{ ...S.row, marginBottom: 0 }}><strong>Details:</strong> {meeting.description}</div>}
            </div>

            {mode === 'view' && (
              <>
                <button style={S.btnPrimary} disabled={busy} onClick={() => respond('accepted')}>{busy ? 'Saving…' : 'Yes, this works'}</button>
                <button style={S.btnOutline} disabled={busy} onClick={() => setMode('reschedule')}>Propose a new time</button>
                <button style={S.btnGhost} disabled={busy} onClick={() => setMode('decline')}>I can’t make it</button>
              </>
            )}

            {mode === 'reschedule' && (
              <>
                <label style={S.label}>Suggest a date and time</label>
                <div style={S.grid2}>
                  <input style={S.input} type="date" value={propDate} onChange={e => setPropDate(e.target.value)} />
                  <input style={S.input} type="time" value={propTime} onChange={e => setPropTime(e.target.value)} />
                </div>
                <textarea style={{ ...S.input, minHeight: 74, resize: 'vertical' }} placeholder="Add a note (optional)" value={message} onChange={e => setMessage(e.target.value)} />
                <button style={S.btnPrimary} disabled={busy || !propDate} onClick={() => respond('reschedule')}>{busy ? 'Sending…' : 'Send suggested time'}</button>
                <button style={S.btnGhost} disabled={busy} onClick={() => setMode('view')}>Back</button>
              </>
            )}

            {mode === 'decline' && (
              <>
                <label style={S.label}>Let them know (optional)</label>
                <textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} placeholder="A quick note…" value={message} onChange={e => setMessage(e.target.value)} />
                <button style={S.btnPrimary} disabled={busy} onClick={() => respond('declined')}>{busy ? 'Sending…' : 'Send response'}</button>
                <button style={S.btnGhost} disabled={busy} onClick={() => setMode('view')}>Back</button>
              </>
            )}

            {error && <div style={{ color: '#b0334d', fontSize: 13, marginTop: 10, textAlign: 'center' }}>{error}</div>}
          </>
        )}
      </div>
    </div>
  )
}
