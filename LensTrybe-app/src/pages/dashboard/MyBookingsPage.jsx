import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import {
  BOOKING_LIMIT_BASIC, TIME_OPTIONS, bookingAction, bookingStatus, confirmedThisMonth,
  fmtDay, fmtDayLong, fmtTime, timeText, todayIso,
} from '../../lib/bookings'

// Creative bookings: requests from clients (accept / decline), bookings they add
// themselves, rescheduling, completing and cancelling. Client-facing changes go through
// the bookings Edge Function so the client is notified.

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const AMBER = '#f59e0b'
const BLUE = '#4A9EFF'

function StyleBlock() {
  return (
    <style>{`
      .ltb-page { display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
      .ltb-glass { background: var(--lt-glass-bg); border: var(--lt-glass-border); box-shadow: var(--lt-glass-shadow); backdrop-filter: var(--lt-glass-blur); -webkit-backdrop-filter: var(--lt-glass-blur); border-radius: 18px; }
      .ltb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltb-btn:disabled { opacity: .55; cursor: default; }
      .ltb-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltb-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
      .ltb-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border-color: var(--lt-border); }
      .ltb-btn-ghost:hover:not(:disabled) { background: var(--lt-surface-2); }
      .ltb-btn-danger { background: transparent; color: ${PINK}; border-color: rgba(255,45,120,0.45); }
      .ltb-chip { padding: 7px 15px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); display: inline-flex; align-items: center; gap: 7px; }
      .ltb-chip.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltb-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: ${AMBER}; color: #1a1204; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
      .ltb-card { display: grid; grid-template-columns: 64px minmax(0,1fr) auto; gap: 16px; align-items: center; padding: 14px 18px; border-top: 1px solid var(--lt-hairline); cursor: pointer; transition: background .12s ease; }
      .ltb-card:first-child { border-top: none; }
      .ltb-card:hover { background: var(--lt-surface-2); }
      .ltb-date { width: 64px; height: 64px; border-radius: 14px; background: var(--lt-surface-2); border: 1px solid var(--lt-border); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
      .ltb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltb-modal { width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); }
      .ltb-mhead { padding: 16px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: 0; background: var(--lt-modal-bg); z-index: 1; }
      .ltb-label { font-size: 11px; font-weight: 700; color: var(--lt-faint); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
      .ltb-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; background: var(--lt-input-bg); border: 1px solid var(--lt-input-border); color: var(--lt-text); font-family: inherit; font-size: 14px; outline: none; }
      .ltb-input:focus { border-color: ${GREEN}; }
      .ltb-box { font-size: 14px; color: var(--lt-text); line-height: 1.65; padding: 12px 14px; background: var(--lt-surface-2); border: 1px solid var(--lt-border); border-radius: 12px; white-space: pre-wrap; }
      @media (max-width: 767px) {
        .ltb-card { grid-template-columns: 54px minmax(0,1fr); }
        .ltb-card .ltb-card-actions { grid-column: 1 / -1; justify-content: flex-start !important; }
        .ltb-date { width: 54px; height: 54px; }
        .ltb-overlay { padding: 12px; }
        .ltb-page button { min-height: 40px; }
      }
    `}</style>
  )
}

function StatusPill({ status }) {
  const m = bookingStatus(status)
  return <span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: m.color, background: m.bg, whiteSpace: 'nowrap' }}>{m.label}</span>
}

function DateBlock({ date }) {
  if (!date) return <div className="ltb-date"><span style={{ fontSize: 12, color: 'var(--lt-faint)' }}>TBC</span></div>
  const d = new Date(`${date}T00:00:00`)
  return (
    <div className="ltb-date">
      <span style={{ fontSize: 11, fontWeight: 700, color: PINK, textTransform: 'uppercase' }}>{d.toLocaleDateString('en-AU', { month: 'short' })}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{d.getDate()}</span>
      <span style={{ fontSize: 10.5, color: 'var(--lt-faint)' }}>{d.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
    </div>
  )
}

function Field({ label, children }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div style={{ minWidth: 0 }}>
      <div className="ltb-label">{label}</div>
      <div style={{ fontSize: 14, color: 'var(--lt-text)', overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
}

function Overlay({ onClose, title, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="ltb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ltb-modal" role="dialog" aria-modal="true">
        <div className="ltb-mhead">
          <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--lt-text)' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
      </div>
    </div>
  )
}

function ClashWarning({ clashes, onForce, busy, forceLabel }) {
  if (!clashes?.length) return null
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${AMBER}66`, background: 'rgba(245,158,11,0.1)', fontSize: 13.5, color: 'var(--lt-text)', lineHeight: 1.55 }}>
      <strong>This overlaps with {clashes.length === 1 ? 'another booking' : `${clashes.length} other bookings`}:</strong>
      <ul style={{ margin: '6px 0 10px', paddingLeft: 18 }}>
        {clashes.map((c, i) => <li key={i}>{c.client_name || 'A booking'}{c.service ? ` (${c.service})` : ''}, {c.all_day || !c.start_time ? 'all day' : `${fmtTime(c.start_time)} to ${fmtTime(c.end_time)}`}</li>)}
      </ul>
      <button type="button" className="ltb-btn ltb-btn-ghost" onClick={onForce} disabled={busy}>{busy ? 'Working…' : forceLabel}</button>
    </div>
  )
}

function LimitNotice({ message, onUpgrade }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${PINK}66`, background: 'rgba(255,45,120,0.08)', fontSize: 13.5, color: 'var(--lt-text)', lineHeight: 1.55, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <span style={{ flex: '1 1 240px' }}>{message}</span>
      <button type="button" className="ltb-btn ltb-btn-primary" onClick={onUpgrade}>Upgrade to Pro</button>
    </div>
  )
}

const emptyForm = () => ({ clientName: '', clientEmail: '', clientPhone: '', service: '', date: todayIso(), allDay: false, startTime: '09:00', endTime: '11:00', location: '', notes: '', note: '', notifyClient: true })

// Add a booking, or change the date / time / details of an existing one.
function BookingForm({ mode, booking, services, onClose, onSaved, onUpgrade }) {
  const editing = mode === 'edit'
  const [form, setForm] = useState(() => editing ? {
    ...emptyForm(),
    clientName: booking.client_name || '', clientEmail: booking.client_email || '', service: booking.service || '',
    date: booking.booking_date || todayIso(), allDay: !!booking.all_day,
    startTime: booking.start_time ? String(booking.start_time).slice(0, 5) : '09:00',
    endTime: booking.end_time ? String(booking.end_time).slice(0, 5) : '11:00',
    location: booking.location || '', notifyClient: !!booking.client_email,
  } : emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clashes, setClashes] = useState(null)
  const [limit, setLimit] = useState('')
  const set = (k, v) => { setError(''); setClashes(null); setForm((p) => ({ ...p, [k]: v })) }

  async function save(force = false) {
    if (!editing && !form.clientName.trim()) { setError("Please add the client's name."); return }
    if (!form.date) { setError('Please choose a date.'); return }
    if (!form.allDay && form.endTime <= form.startTime) { setError('The finish time needs to be after the start time.'); return }
    setSaving(true)
    const payload = { date: form.date, allDay: form.allDay, startTime: form.startTime, endTime: form.endTime, location: form.location, service: form.service, notifyClient: form.notifyClient && !!form.clientEmail, force }
    const res = editing
      ? await bookingAction('reschedule', { ...payload, bookingId: booking.id, note: form.note })
      : await bookingAction('create', { ...payload, clientName: form.clientName, clientEmail: form.clientEmail, clientPhone: form.clientPhone, notes: form.notes })
    setSaving(false)
    if (res.conflict) { setClashes(res.clashes || []); return }
    if (res.code === 'BOOKING_LIMIT_BASIC') { setLimit(res.error); return }
    if (!res.ok) { setError(res.error); return }
    onSaved(res.booking, editing ? 'Booking updated.' : 'Booking added.')
  }

  const endOptions = TIME_OPTIONS.filter((t) => t.value > form.startTime)
  return (
    <Overlay onClose={onClose} title={editing ? 'Change booking' : 'New booking'}>
      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div><label className="ltb-label">Client name</label><input className="ltb-input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} maxLength={120} placeholder="e.g. Sam Taylor" /></div>
          <div><label className="ltb-label">Client email</label><input className="ltb-input" type="email" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} maxLength={200} placeholder="Optional" /></div>
          <div><label className="ltb-label">Client phone</label><input className="ltb-input" value={form.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} maxLength={40} placeholder="Optional" /></div>
        </div>
      )}
      {editing && <div style={{ fontSize: 14, color: 'var(--lt-muted)' }}>Booking with <strong style={{ color: 'var(--lt-text)' }}>{booking.client_name || 'your client'}</strong></div>}
      <div>
        <label className="ltb-label">Service</label>
        <input className="ltb-input" list="ltb-services" value={form.service} onChange={(e) => set('service', e.target.value)} maxLength={120} placeholder="e.g. Wedding photography" />
        <datalist id="ltb-services">{(services || []).map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div><label className="ltb-label">Date</label><input className="ltb-input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
        {!form.allDay && (
          <>
            <div>
              <label className="ltb-label">Start</label>
              <select className="ltb-input" value={form.startTime} onChange={(e) => { const v = e.target.value; setClashes(null); setForm((p) => ({ ...p, startTime: v, endTime: p.endTime > v ? p.endTime : (TIME_OPTIONS.find((t) => t.value > v)?.value || p.endTime) })) }}>
                {TIME_OPTIONS.slice(0, -1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="ltb-label">Finish</label>
              <select className="ltb-input" value={form.endTime} onChange={(e) => set('endTime', e.target.value)}>
                {endOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--lt-text)', cursor: 'pointer', marginTop: -6 }}>
        <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN }} /> All day
      </label>
      <div><label className="ltb-label">Location</label><input className="ltb-input" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={200} placeholder="Suburb or venue" /></div>
      {!editing && <div><label className="ltb-label">Private notes</label><textarea className="ltb-input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} placeholder="Only you can see these" style={{ resize: 'vertical' }} /></div>}
      {editing && form.notifyClient && <div><label className="ltb-label">Note to the client (optional)</label><textarea className="ltb-input" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={1000} placeholder="e.g. Moved to the afternoon for better light" style={{ resize: 'vertical' }} /></div>}
      {(editing ? !!booking.client_email : !!form.clientEmail) && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--lt-text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.notifyClient} onChange={(e) => set('notifyClient', e.target.checked)} style={{ width: 16, height: 16, accentColor: GREEN }} /> {editing ? 'Email the client the new details' : 'Email the client a booking confirmation'}
        </label>
      )}
      <ClashWarning clashes={clashes} busy={saving} onForce={() => save(true)} forceLabel={editing ? 'Save anyway' : 'Book anyway'} />
      {limit && <LimitNotice message={limit} onUpgrade={onUpgrade} />}
      {error && <div style={{ fontSize: 13, color: PINK }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="ltb-btn ltb-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="ltb-btn ltb-btn-primary" onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add booking'}</button>
      </div>
    </Overlay>
  )
}

// Booking details with the actions that fit its status.
function BookingDetail({ booking, onClose, onChanged, onEdit, onUpgrade }) {
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState('') // '' | 'decline' | 'cancel'
  const [clashes, setClashes] = useState(null)
  const [limit, setLimit] = useState('')
  const [error, setError] = useState('')
  const b = booking

  async function run(action, payload, okMsg) {
    setBusy(action); setError(''); setLimit('')
    const res = await bookingAction(action, { bookingId: b.id, ...payload })
    setBusy('')
    if (res.conflict) { setClashes(res.clashes || []); return }
    if (res.code === 'BOOKING_LIMIT_BASIC') { setLimit(res.error); return }
    if (!res.ok) { setError(res.error); return }
    onChanged(res.booking, okMsg)
  }

  const upcoming = b.status === 'confirmed'
  return (
    <Overlay onClose={onClose} title={b.status === 'pending' ? 'Booking request' : 'Booking'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <DateBlock date={b.booking_date} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--lt-text)' }}>{b.client_name || 'Client'}</div>
          <div style={{ fontSize: 13.5, color: 'var(--lt-muted)', marginTop: 2 }}>{b.booking_date ? fmtDayLong(b.booking_date) : 'Date to be confirmed'} · {timeText(b)}</div>
          <div style={{ marginTop: 6 }}><StatusPill status={b.status} /></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <Field label="Service">{b.service}</Field>
        <Field label="Location">{b.location}</Field>
        <Field label="Email">{b.client_email ? <a href={`mailto:${b.client_email}`} style={{ color: GREEN, textDecoration: 'none' }}>{b.client_email}</a> : null}</Field>
        <Field label="Phone">{b.client_phone ? <a href={`tel:${String(b.client_phone).replace(/[^\d+]/g, '')}`} style={{ color: GREEN, textDecoration: 'none' }}>{b.client_phone}</a> : null}</Field>
      </div>

      {b.message && <div><div className="ltb-label">Message from the client</div><div className="ltb-box">{b.message}</div></div>}
      {b.notes && <div><div className="ltb-label">Your private notes</div><div className="ltb-box">{b.notes}</div></div>}
      {b.response_note && <div><div className="ltb-label">{b.status === 'cancelled' ? 'Cancellation reason' : 'Your note to the client'}</div><div className="ltb-box">{b.response_note}</div></div>}
      {b.status === 'cancelled' && b.cancelled_by && <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>Cancelled by {b.cancelled_by === 'client' ? 'the client' : 'you'}{b.cancelled_at ? ` on ${fmtDay(b.cancelled_at.slice(0, 10))}` : ''}.</div>}

      <ClashWarning clashes={clashes} busy={!!busy} onForce={() => run('respond', { decision: 'accept', force: true }, 'Booking accepted. The client has been told.')} forceLabel="Accept anyway" />
      {limit && <LimitNotice message={limit} onUpgrade={onUpgrade} />}

      {(mode === 'decline' || mode === 'cancel') && (
        <div>
          <label className="ltb-label">{mode === 'decline' ? 'Message to the client (optional)' : 'Reason (optional, shared with the client)'}</label>
          <textarea className="ltb-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} style={{ resize: 'vertical' }}
            placeholder={mode === 'decline' ? "e.g. I'm already booked that weekend, but I'd love to help another time." : 'e.g. Unwell, so I need to cancel. Sorry for the short notice.'} />
        </div>
      )}
      {error && <div style={{ fontSize: 13, color: PINK }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {b.status === 'pending' && mode !== 'decline' && (
          <>
            <button type="button" className="ltb-btn ltb-btn-ghost" onClick={() => setMode('decline')} disabled={!!busy}>Decline</button>
            <button type="button" className="ltb-btn ltb-btn-primary" onClick={() => run('respond', { decision: 'accept' }, 'Booking accepted. The client has been told.')} disabled={!!busy}>{busy === 'respond' ? 'Accepting…' : 'Accept booking'}</button>
          </>
        )}
        {b.status === 'pending' && mode === 'decline' && (
          <>
            <button type="button" className="ltb-btn ltb-btn-ghost" onClick={() => setMode('')} disabled={!!busy}>Back</button>
            <button type="button" className="ltb-btn ltb-btn-danger" onClick={() => run('respond', { decision: 'decline', note }, 'Request declined. The client has been told.')} disabled={!!busy}>{busy ? 'Declining…' : 'Decline request'}</button>
          </>
        )}
        {upcoming && mode !== 'cancel' && (
          <>
            <button type="button" className="ltb-btn ltb-btn-danger" onClick={() => setMode('cancel')} disabled={!!busy}>Cancel booking</button>
            <button type="button" className="ltb-btn ltb-btn-ghost" onClick={onEdit} disabled={!!busy}>Change date or time</button>
            <button type="button" className="ltb-btn ltb-btn-ghost" style={{ color: BLUE, borderColor: 'rgba(74,158,255,0.45)' }} onClick={() => run('complete', {}, 'Marked as completed.')} disabled={!!busy}>{busy === 'complete' ? 'Saving…' : 'Mark completed'}</button>
          </>
        )}
        {upcoming && mode === 'cancel' && (
          <>
            <button type="button" className="ltb-btn ltb-btn-ghost" onClick={() => setMode('')} disabled={!!busy}>Keep booking</button>
            <button type="button" className="ltb-btn ltb-btn-danger" onClick={() => run('cancel', { reason: note }, b.client_email ? 'Booking cancelled. The client has been told.' : 'Booking cancelled.')} disabled={!!busy}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>
          </>
        )}
      </div>
    </Overlay>
  )
}

export default function MyBookingsPage() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bookings, setBookings] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(null) // { mode: 'new' | 'edit', booking? }
  const [toast, setToast] = useState(null)
  const isBasic = !['pro', 'expert', 'elite'].includes(String(tier || 'basic').toLowerCase())

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    const [{ data }, { data: svc }] = await Promise.all([
      supabase.from('bookings').select('*').eq('creative_id', user.id).order('booking_date', { ascending: true, nullsFirst: false }),
      supabase.from('portfolio_services').select('name').eq('creative_id', user.id).order('sort_order', { ascending: true }),
    ])
    setBookings(data ?? [])
    setServices((svc ?? []).map((s) => s.name).filter(Boolean))
    setLoading(false)
  }, [user?.id])
  useEffect(() => { load() }, [load])

  // Deep links: ?booking=<id> opens it, ?new=1 opens the add form.
  useEffect(() => {
    if (loading) return
    const id = searchParams.get('booking')
    if (id) {
      const b = bookings.find((x) => x.id === id)
      if (b) { setSelectedId(id); setTab(b.status === 'pending' ? 'requests' : tabFor(b)) }
    }
    if (searchParams.get('new') === '1') setForm({ mode: 'new' })
    if (id || searchParams.get('new')) setSearchParams({}, { replace: true })
  }, [loading, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const today = todayIso()
  function tabFor(b) {
    if (b.status === 'pending') return 'requests'
    if (b.status === 'declined' || b.status === 'cancelled') return 'cancelled'
    if (b.status === 'completed' || (b.booking_date && b.booking_date < today)) return 'past'
    return 'upcoming'
  }
  const groups = useMemo(() => {
    const g = { requests: [], upcoming: [], past: [], cancelled: [] }
    for (const b of bookings) g[tabFor(b)].push(b)
    g.past.reverse()
    g.cancelled.sort((a, b2) => String(b2.updated_at || '').localeCompare(String(a.updated_at || '')))
    return g
  }, [bookings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!loading && groups.requests.length && tab === 'upcoming' && !groups.upcoming.length) setTab('requests') }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const used = confirmedThisMonth(bookings)
  const selected = bookings.find((b) => b.id === selectedId) || null
  const list = groups[tab] || []
  const next = groups.upcoming[0]

  function applyChange(updated, msg) {
    setBookings((prev) => {
      const exists = prev.some((b) => b.id === updated.id)
      const arr = exists ? prev.map((b) => (b.id === updated.id ? updated : b)) : [...prev, updated]
      return arr.sort((a, b) => String(a.booking_date || '9999').localeCompare(String(b.booking_date || '9999')))
    })
    if (msg) showToast(msg)
  }

  const TABS = [
    { key: 'requests', label: 'Requests' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Declined & cancelled' },
  ]
  const emptyText = {
    requests: 'No booking requests waiting. Clients can request a booking from your profile.',
    upcoming: 'No upcoming bookings yet.',
    past: 'No past bookings.',
    cancelled: 'Nothing declined or cancelled.',
  }

  return (
    <>
      <StyleBlock />
      <div className="ltb-page">
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: toast.type === 'success' ? GREEN : '#ef4444', color: toast.type === 'success' ? GREEN_DARK : '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 12px 30px -12px rgba(0,0,0,0.4)', maxWidth: 'calc(100vw - 32px)' }}>{toast.msg}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Bookings</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Requests from clients, and every upcoming and past booking in one place.</p>
          </div>
          <button type="button" className="ltb-btn ltb-btn-primary" onClick={() => setForm({ mode: 'new' })}>+ New booking</button>
        </div>

        {isBasic && (
          <div className="ltb-glass" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, color: 'var(--lt-text)', lineHeight: 1.5 }}>
              <strong>Basic plan:</strong> {Math.min(used, BOOKING_LIMIT_BASIC)} of {BOOKING_LIMIT_BASIC} bookings confirmed this month.{used >= BOOKING_LIMIT_BASIC ? ' New requests will wait until next month or until you upgrade.' : ' Clients can always send requests.'}
              <div style={{ height: 6, borderRadius: 999, background: 'var(--lt-surface-2)', marginTop: 8, maxWidth: 280, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (used / BOOKING_LIMIT_BASIC) * 100)}%`, height: '100%', background: used >= BOOKING_LIMIT_BASIC ? PINK : GREEN }} />
              </div>
            </div>
            <button type="button" className="ltb-btn ltb-btn-ghost" onClick={() => navigate('/dashboard/settings/subscription')}>Unlimited bookings with Pro</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Waiting for you', value: groups.requests.length, color: groups.requests.length ? AMBER : 'var(--lt-text)' },
            { label: 'Upcoming', value: groups.upcoming.length, color: GREEN },
            { label: 'Next booking', value: next ? fmtDay(next.booking_date) : 'None', color: 'var(--lt-text)', small: true },
          ].map((s) => (
            <div key={s.label} className="ltb-glass" style={{ flex: '1 1 150px', borderRadius: 16, padding: '14px 18px' }}>
              <div style={{ fontSize: s.small ? 17 : 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`ltb-chip${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}{t.key === 'requests' && groups.requests.length > 0 ? <span className="ltb-count">{groups.requests.length}</span> : null}
            </button>
          ))}
        </div>

        <div className="ltb-glass" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>Loading bookings…</div>
          ) : list.length === 0 ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>{emptyText[tab]}</div>
          ) : list.map((b) => (
            <div key={b.id} className="ltb-card" onClick={() => setSelectedId(b.id)}>
              <DateBlock date={b.booking_date} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{b.client_name || 'Client'}</span>
                  <StatusPill status={b.status} />
                  {b.origin === 'client' && b.status !== 'pending' && <span style={{ fontSize: 11, color: 'var(--lt-faint)' }}>Requested by client</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: 3 }}>{timeText(b)}{b.service ? ` · ${b.service}` : ''}{b.location ? ` · ${b.location}` : ''}</div>
                {b.status === 'pending' && b.message && <div style={{ fontSize: 12.5, color: 'var(--lt-faint)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{b.message}”</div>}
              </div>
              <div className="ltb-card-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {b.status === 'pending'
                  ? <button type="button" className="ltb-btn ltb-btn-primary" onClick={(e) => { e.stopPropagation(); setSelectedId(b.id) }}>Review</button>
                  : <span style={{ fontSize: 18, color: 'var(--lt-faint)' }}>›</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && !form && (
        <BookingDetail
          key={selected.id + selected.status}
          booking={selected}
          onClose={() => setSelectedId(null)}
          onChanged={(u, msg) => { applyChange(u, msg); if (u.status !== selected.status) setTab(tabFor(u)) }}
          onEdit={() => setForm({ mode: 'edit', booking: selected })}
          onUpgrade={() => navigate('/dashboard/settings/subscription')}
        />
      )}
      {form && (
        <BookingForm
          mode={form.mode}
          booking={form.booking}
          services={services}
          onClose={() => setForm(null)}
          onSaved={(b, msg) => { applyChange(b, msg); setForm(null); setSelectedId(null); setTab(tabFor(b)) }}
          onUpgrade={() => navigate('/dashboard/settings/subscription')}
        />
      )}
    </>
  )
}
