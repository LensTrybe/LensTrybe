// Shared helpers for bookings (creative dashboard, client dashboard, profile request form).
import { supabase } from './supabaseClient'

export const BOOKING_LIMIT_BASIC = 3

export const BOOKING_STATUS = {
  pending: { label: 'Requested', color: '#f59e0b', bg: 'rgba(245,158,11,0.16)' },
  confirmed: { label: 'Confirmed', color: '#1DB954', bg: 'rgba(29,185,84,0.14)' },
  completed: { label: 'Completed', color: '#4A9EFF', bg: 'rgba(74,158,255,0.16)' },
  declined: { label: 'Declined', color: '#8a8a9a', bg: 'rgba(138,138,154,0.16)' },
  cancelled: { label: 'Cancelled', color: '#FF2D78', bg: 'rgba(255,45,120,0.14)' },
}
export function bookingStatus(s) { return BOOKING_STATUS[s] || { label: s || 'Unknown', color: '#8a8a9a', bg: 'rgba(138,138,154,0.16)' } }

// 30-minute steps from 6am to 10pm, as { value: 'HH:MM', label: '6:00am' }.
export const TIME_OPTIONS = (() => {
  const out = []
  for (let m = 6 * 60; m <= 22 * 60; m += 30) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    const value = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    out.push({ value, label: fmtTime(value) })
  }
  return out
})()

export function fmtTime(t) {
  if (!t) return ''
  const [h, m] = String(t).split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m || 0).padStart(2, '0')}${ap}`
}
export function fmtDay(d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!d) return ''
  try { return new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-AU', opts) } catch { return String(d) }
}
export function fmtDayLong(d) { return fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
export function timeText(b) {
  if (!b) return ''
  if (b.all_day || !b.start_time) return 'All day'
  return `${fmtTime(b.start_time)} to ${fmtTime(b.end_time)}`
}
export function whenText(b) { return b?.booking_date ? `${fmtDay(b.booking_date)} · ${timeText(b)}` : 'Date to be confirmed' }

// Today as YYYY-MM-DD in the viewer's local time.
export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addDaysIso(iso, n) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toMin(t) { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + m }
// Does a wanted slot overlap a busy entry ({ all_day, start_time, end_time })?
export function slotOverlaps(slot, busy) {
  if (slot.allDay || busy.all_day || !busy.start_time || !busy.end_time) return true
  const s1 = toMin(slot.startTime), e1 = toMin(slot.endTime), s2 = toMin(busy.start_time), e2 = toMin(busy.end_time)
  return s1 < e2 && s2 < e1
}

// Confirmed bookings count toward the Basic limit from when they were confirmed.
export function confirmedThisMonth(bookings) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return (bookings || []).filter((b) => (b.status === 'confirmed' || b.status === 'completed') && b.confirmed_at && new Date(b.confirmed_at).getTime() >= start).length
}

// Calls the bookings Edge Function. Returns the JSON body, including error bodies
// (conflict / limit responses carry useful fields), with `ok` false on failure.
export async function bookingAction(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('bookings', { body: { action, ...payload } })
  if (!error) return { ok: true, ...(data || {}) }
  let body = null
  try { body = await error?.context?.json?.() } catch { /* not JSON */ }
  return { ok: false, error: body?.error || data?.error || error?.message || 'Something went wrong. Please try again.', ...(body || {}) }
}

export async function loadBusyTimes(creativeId, from, to) {
  const { data } = await supabase.rpc('creative_busy_times', { p_creative: creativeId, p_from: from || null, p_to: to || null })
  return data || []
}

// Prefill for a new quote or invoice made from a booking (Quotes / Invoicing read it from
// router state: navigate(path, { state: { prefillFromBooking } })).
export function bookingDocPrefill(b) {
  const when = b.booking_date ? `${fmtDayLong(b.booking_date)}, ${timeText(b)}` : ''
  const where = b.location ? ` at ${b.location}` : ''
  return {
    booking_id: b.id,
    client_name: b.client_name || '',
    client_email: b.client_email || '',
    client_phone: b.client_phone || '',
    description: b.service || '',
    notes: when ? `For your booking on ${when}${where}.` : '',
  }
}
