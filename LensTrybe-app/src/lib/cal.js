import { addDays, parse, iso, TODAY } from './store'

// Calendar maths shared by the Calendar page, Today and the booking flows.
// Distances from Noosaville, for the "leave by" line. Anything unknown is treated as local.
const KM = [['brisbane', 140], ['byron', 230], ['gold coast', 210], ['maleny', 45], ['montville', 40], ['maroochydore', 30], ['caloundra', 60], ['noosa heads', 8], ['sunshine beach', 10], ['noosaville', 2], ['tewantin', 4], ['peregian', 15], ['coolum', 22], ['eumundi', 18], ['gympie', 65], ['nambour', 35], ['mooloolaba', 32], ['hastings', 8], ['south brisbane', 142], ['studio', 0]]
export const km = (where = '', addr = '') => { const t = (where + ' ' + addr).toLowerCase(); const hit = KM.find(([k]) => t.includes(k)); return hit ? hit[1] : (t.trim() ? 20 : 0) }
export const mins = t => { const [h, m] = (t || '10:00').split(':').map(Number); return h * 60 + (m || 0) }
export const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }
export const ampm = t => { const m = mins(t); const h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm') }
// leave by: distance at 70 km/h plus 15 minutes for the bag and the car park
export const leaveBy = (time, distance) => distance > 12 ? hhmm(mins(time) - Math.round(distance / 70 * 60) - 15) : ''
export const durMins = e => e.dur === 'day' ? 600 : Number(e.dur) || 120
export const endOf = e => hhmm(mins(e.time || '10:00') + durMins(e))
export const durLabel = d => d === 'day' ? 'Full day' : d >= 60 ? (d / 60) + (d === 60 ? ' hour' : ' hours') : d + ' min'
export const DURS = [[60, '1 hour'], [90, '90 minutes'], [120, '2 hours'], [180, '3 hours'], [240, 'Half day'], [360, '6 hours'], [480, '8 hours'], ['day', 'Full day']]
export const REPS = [['', 'Once'], ['weekly', 'Every week'], ['fortnightly', 'Every fortnight'], ['monthly', 'Every month']]

// One line under a booking: time, place, leave-by. Written once so Today and the panel agree.
export const line = e => { const d = km(e.where, e.addr); const lb = e.time ? leaveBy(e.time, d) : ''; return [e.time ? ampm(e.time) + (e.dur ? ' to ' + ampm(endOf(e)) : '') : '', e.where, lb ? 'leave by ' + ampm(lb) : ''].filter(Boolean).join(' · ') }

// Expand repeats and multi-day bookings into the days between from and to (inclusive).
// Occurrences carry the parent's id plus `on` (the day) and `oid` (unique per occurrence).
export function occurrences(events, from, to) {
  const out = []
  for (const e of events) {
    const push = (d0) => { const last = e.end && e.end > d0 ? addDays(d0, Math.round((parse(e.end) - parse(e.d)) / 864e5)) : d0; let d = d0, i = 0; while (d <= last && i < 31) { if (d >= from && d <= to) out.push({ ...e, on: d, oid: e.id + '@' + d0, first: d === d0, last: d === last, span: i }); d = addDays(d, 1); i++ } }
    if (!e.rep) { push(e.d); continue }
    let d = e.d, n = 0; const until = e.until || addDays(to, 0)
    while (d <= to && d <= until && n < 60) { if (!(e.skip || []).includes(d)) push(d); d = e.rep === 'weekly' ? addDays(d, 7) : e.rep === 'fortnightly' ? addDays(d, 14) : (() => { const x = parse(d); x.setMonth(x.getMonth() + 1); return iso(x) })(); n++ }
  }
  return out
}

// .ics for Google, Apple or Outlook. Booked and pencilled shoots, blocked days, meetings.
export function ics(events, meetings = [], types = []) {
  const stamp = (d, t) => d.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '')
  const esc = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n')
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LensTrybe//Workspace//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:LensTrybe']
  for (const e of events) {
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '@lenstrybe.com', 'DTSTAMP:' + stamp(TODAY, '00:00'))
    if (e.k === 'x' || e.dur === 'day' || !e.time) { L.push('DTSTART;VALUE=DATE:' + stamp(e.d), 'DTEND;VALUE=DATE:' + stamp(addDays(e.end || e.d, 1))) }
    else { L.push('DTSTART:' + stamp(e.d, e.time), 'DTEND:' + stamp(e.d, endOf(e))) }
    if (e.rep) L.push('RRULE:FREQ=' + (e.rep === 'monthly' ? 'MONTHLY' : 'WEEKLY') + (e.rep === 'fortnightly' ? ';INTERVAL=2' : '') + (e.until ? ';UNTIL=' + stamp(e.until) : ''))
    L.push('SUMMARY:' + esc(e.k === 'x' ? 'Blocked' + (e.n ? ' · ' + e.n : '') : (e.k === 'p' ? '[Pencilled] ' : '') + e.n))
    if (e.where || e.addr) L.push('LOCATION:' + esc([e.where, e.addr].filter(Boolean).join(', ')))
    if (e.s) L.push('DESCRIPTION:' + esc(e.s))
    L.push('END:VEVENT')
  }
  for (const m of meetings) { const t = types.find(x => x.id === m.t); const [d, tm] = m.when.split('T'); L.push('BEGIN:VEVENT', 'UID:meet-' + m.id + '@lenstrybe.com', 'DTSTAMP:' + stamp(TODAY, '00:00'), 'DTSTART:' + stamp(d, tm), 'DTEND:' + stamp(d, hhmm(mins(tm) + (t?.m || 30))), 'SUMMARY:' + esc((t?.n || 'Meeting') + ' · ' + m.who), 'DESCRIPTION:' + esc(m.how + (m.prep ? ' · ' + m.prep : '')), 'END:VEVENT') }
  L.push('END:VCALENDAR')
  return L.join('\r\n')
}
