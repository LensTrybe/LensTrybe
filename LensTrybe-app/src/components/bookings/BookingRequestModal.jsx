import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { LIQUID_FIELD, TYPO } from '../../lib/glassTokensLight'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'
import { TIME_OPTIONS, addDaysIso, bookingAction, fmtDayLong, fmtTime, loadBusyTimes, slotOverlaps, todayIso } from '../../lib/bookings'

// Client-facing "Request a booking" form on a creative's profile / website.
// Nothing is booked until the creative accepts.
const label = { fontSize: '13px', display: 'block', marginBottom: '6px', ...TYPO.label }
const field = { width: '100%', padding: '10px 14px', boxSizing: 'border-box', ...LIQUID_FIELD }
const emptyForm = () => ({ date: '', allDay: false, startTime: '09:00', endTime: '11:00', service: '', location: '', message: '', name: '', phone: '' })

export default function BookingRequestModal({ open, onClose, creativeId, creativeName, services = [], defaultName = '', defaultPhone = '' }) {
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm({ ...emptyForm(), name: defaultName || '', phone: defaultPhone || '' })
    setError('')
    setDone(null)
    let cancelled = false
    loadBusyTimes(creativeId, todayIso(), addDaysIso(todayIso(), 365)).then((rows) => { if (!cancelled) setBusy(rows) })
    return () => { cancelled = true }
  }, [open, creativeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { setError(''); setForm((p) => ({ ...p, [k]: v })) }
  const busyOnDay = useMemo(() => busy.filter((b) => b.date === form.date), [busy, form.date])
  const clash = useMemo(() => form.date && busyOnDay.some((b) => slotOverlaps(form, b)), [form, busyOnDay])
  const serviceNames = (services || []).map((s) => s?.name).filter(Boolean)
  const endOptions = TIME_OPTIONS.filter((t) => t.value > form.startTime)

  async function submit() {
    if (!form.date) { setError('Please choose a date.'); return }
    if (!form.allDay && form.endTime <= form.startTime) { setError('The finish time needs to be after the start time.'); return }
    if (clash) { setError(`${creativeName} is already booked at that time. Please choose another time or date.`); return }
    const text = [form.service, form.location, form.message].filter(Boolean).join('\n')
    if (text) {
      const mod = await moderateText(text)
      if (mod?.blocked) { setError(MODERATION_BLOCKED_USER_MESSAGE); return }
    }
    setSending(true)
    const res = await bookingAction('request', { creativeId, ...form })
    setSending(false)
    if (!res.ok) { setError(res.error); return }
    setDone(res.booking)
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={done ? 'Request sent' : `Request a booking with ${creativeName}`} size="md">
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, ...TYPO.body }}>
          <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            Your request for <strong>{fmtDayLong(done.booking_date)}</strong>{done.all_day ? ' (all day)' : `, ${fmtTime(done.start_time)} to ${fmtTime(done.end_time)}`} is on its way to {creativeName}.
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Nothing is booked until they accept. We'll email you as soon as they reply, and you can see it any time under Bookings in your dashboard.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => { window.location.href = '/client-dashboard?view=bookings' }}>View my bookings</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, ...TYPO.body }}>Pick a date and time. {creativeName} will accept or decline, and nothing is booked until they accept.</div>

          <div>
            <label style={label}>Date</label>
            <input type="date" style={field} min={todayIso()} max={addDaysIso(todayIso(), 365)} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', ...TYPO.body }}>
              <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#1DB954' }} /> All day
            </label>
            {!form.allDay && (
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 130px' }}>
                  <label style={label}>Start</label>
                  <select style={field} value={form.startTime} onChange={(e) => { const v = e.target.value; setError(''); setForm((p) => ({ ...p, startTime: v, endTime: p.endTime > v ? p.endTime : (TIME_OPTIONS.find((t) => t.value > v)?.value || p.endTime) })) }}>
                    {TIME_OPTIONS.slice(0, -1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <label style={label}>Finish</label>
                  <select style={field} value={form.endTime} onChange={(e) => set('endTime', e.target.value)}>
                    {endOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            )}
            {form.date && (
              <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.55, ...TYPO.body, color: clash ? '#e11d48' : 'var(--text-muted)' }}>
                {busyOnDay.length === 0
                  ? `${creativeName} has nothing booked on ${fmtDayLong(form.date)}.`
                  : clash
                    ? `${creativeName} is already booked at that time. Busy: ${busyOnDay.map((b) => (b.all_day ? 'all day' : `${fmtTime(b.start_time)} to ${fmtTime(b.end_time)}`)).join(', ')}.`
                    : `Already booked that day: ${busyOnDay.map((b) => (b.all_day ? 'all day' : `${fmtTime(b.start_time)} to ${fmtTime(b.end_time)}`)).join(', ')}. Your time is free.`}
              </div>
            )}
          </div>

          <div>
            <label style={label}>What do you need?</label>
            {serviceNames.length ? (
              <select style={field} value={form.service} onChange={(e) => set('service', e.target.value)}>
                <option value="">Choose a service (optional)</option>
                {serviceNames.map((n) => <option key={n} value={n}>{n}</option>)}
                <option value="Something else">Something else</option>
              </select>
            ) : (
              <input style={field} placeholder="e.g. Wedding photography, product shoot" value={form.service} onChange={(e) => set('service', e.target.value)} maxLength={120} />
            )}
          </div>

          <div>
            <label style={label}>Location</label>
            <input style={field} placeholder="Suburb or venue" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={200} />
          </div>

          <div>
            <label style={label}>Message</label>
            <textarea style={{ ...field, minHeight: 100, resize: 'vertical' }} placeholder="Tell them about the job: what it's for, how many people, anything they should know." value={form.message} onChange={(e) => set('message', e.target.value)} maxLength={2000} />
          </div>

          <div>
            <label style={label}>Your details</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input style={{ ...field, flex: '1 1 150px', width: 'auto' }} placeholder="Your name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />
              <input style={{ ...field, flex: '1 1 150px', width: 'auto' }} placeholder="Phone (optional)" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} />
            </div>
          </div>

          {error ? <div style={{ fontSize: 13, color: '#e11d48', ...TYPO.body }}>{error}</div> : null}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={sending || !form.date || clash} onClick={submit}>{sending ? 'Sending…' : 'Send request'}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
