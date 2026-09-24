import { TODAY, iso, parse, addDays, dow } from './store'
import { occurrences, km } from './cal'

// One answer for "is this day open?" used by the Availability page, the calendar, the public profile,
// the ask bar and the job board. Reads the calendar plus every rule on the Availability page.
const DOW7 = d => (parse(d).getDay() + 6) % 7   // 0 = Monday
const WED = e => /wedding|elope|day 2/i.test(e.n || '')

export const KIND_KEY = { Wedding: 'Weddings', Event: 'Events', 'Real estate': 'Real estate', Headshots: 'Headshots', Brand: 'Brand', Family: 'Family' }

// Away rules cover a day when the day sits in their range, or matches a weekly repeat
export const awayOn = (A, d) => (A.away || []).find(a => a.rep === 'weekly' ? a.dow === DOW7(d) && d >= (a.from || TODAY) : d >= a.from && d <= (a.to || a.from))
export const seasonOn = (A, d) => (A.seasons || []).find(x => d >= x.from && d <= x.to)

// The status of a single day, with the thing that made it so
export function dayStatus(s, d, occ) {
  const A = s.avail || {}
  const list = occ ? occ.filter(e => e.on === d) : occurrences(s.events, d, d)
  const booked = list.find(e => e.k === 'b' || e.k === 'c'), held = list.find(e => e.k === 'p'), blocked = list.find(e => e.k === 'x')
  if (booked) return { st: 'booked', l: booked.n, ev: booked }
  if (held) return { st: 'held', l: held.n, ev: held }
  const aw = awayOn(A, d); if (aw) return { st: 'away', l: aw.w || 'Away', away: aw }
  if (blocked) return { st: 'away', l: blocked.n || 'Blocked', ev: blocked }
  const se = seasonOn(A, d); if (se?.closed) return { st: 'closed', l: se.n }
  if (!(A.days || [])[DOW7(d)]) return { st: 'off', l: 'Not a working day' }
  const B = A.buffers || {}
  if (B.rest) { const y = addDays(d, -1); const prev = occurrences(s.events, y, y).find(e => (e.k === 'b' || e.k === 'c') && WED(e)); if (prev) return { st: 'rest', l: 'Rest day after ' + prev.n.split(' ·')[0] } }
  if (B.travel) { for (const n of [-1, 1]) { const o = addDays(d, n); const far = occurrences(s.events, o, o).find(e => (e.k === 'b' || e.k === 'c') && km(e.where, e.addr) > (A.radius || 150)); if (far) return { st: 'travel', l: 'Travel ' + (n < 0 ? 'back from ' : 'to ') + (far.where || far.n.split(' ·')[0]) } } }
  if (A.max) { const mon = addDays(d, -DOW7(d)); const week = occurrences(s.events, mon, addDays(mon, 6)).filter(e => (e.k === 'b' || e.k === 'c') && e.first); if (week.length >= A.max) return { st: 'full', l: A.max + ' shoots that week already' } }
  const lead = se?.lead ?? A.lead ?? 0; if (d < addDays(TODAY, lead)) return { st: 'soon', l: 'Inside your ' + lead + ' day notice' }
  return { st: 'open', l: 'Open' }
}

// Next n open dates from today; sat=true keeps to Saturdays
export function nextOpen(s, n = 3, { sat = false, kind } = {}) {
  const out = []; let d = TODAY, i = 0
  while (out.length < n && i < 200) { if (!sat || parse(d).getDay() === 6) { const st = dayStatus(s, d); if (st.st === 'open' && (!kind || kindOpen(s, kind, d))) out.push(d) } d = addDays(d, 1); i++ }
  return out
}
export const kindOpen = (s, kind, d) => { const A = s.avail; const key = KIND_KEY[kind] || kind; const se = d ? seasonOn(A, d) : null; if (se?.kinds?.length) return se.kinds.includes(key); return !!A.kinds?.[key] }
export const countOpen = (s, from, to) => { let n = 0, d = from; const occ = occurrences(s.events, from, to); while (d <= to) { if (dayStatus(s, d, occ).st === 'open') n++; d = addDays(d, 1) } return n }
export const label = d => dow(d) + ' ' + parse(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
export { iso, parse, addDays }
