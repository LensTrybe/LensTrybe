// Supabase Edge Function: calendar-feed
//
// A private, read only iCalendar feed of one creative's work, so their LensTrybe bookings,
// client meetings and blocked out days show up in whatever calendar they already use.
// They paste the URL into Google, Apple or Outlook once and it keeps itself up to date.
//
//   GET /functions/v1/calendar-feed?token=<uuid>
//
// The token is the whole of the security, which is how every calendar subscription works
// (Google calls it a secret address). It is a random uuid, it is never guessable from the
// creative's id, and rotating it through reset_calendar_token kills every old subscription.
//
// No JWT: calendar clients cannot send one. Deployed with verify_jwt false.
//
// Times are written as floating local times, with no timezone and no Z. Bookings are stored
// as a plain date plus a plain time because a 9am shoot is 9am where the creative is
// standing. Floating means the calendar shows exactly the time they typed, and no daylight
// saving change can ever shift it, which matters with Brisbane and Sydney on different
// rules through summer.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// How much of the past to carry. Enough that a creative scrolling back a couple of months
// still sees their work, without making every refresh drag the whole history down.
const PAST_DAYS = 120
const FUTURE_DAYS = 540

// Bookings and meetings that are off. A cancelled shoot should disappear from their
// calendar, not sit there looking like work.
const DEAD_BOOKING = new Set(['cancelled', 'declined'])
const DEAD_MEETING = new Set(['cancelled', 'declined'])

function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/** RFC 5545 escaping: backslash, semicolon, comma, and newlines become \n. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 octets must be folded, or strict parsers reject the whole file. */
function fold(line: string): string {
  if (line.length <= 73) return line
  const out: string[] = []
  let rest = line
  out.push(rest.slice(0, 73))
  rest = rest.slice(73)
  while (rest.length > 72) {
    out.push(' ' + rest.slice(0, 72))
    rest = rest.slice(72)
  }
  if (rest.length) out.push(' ' + rest)
  return out.join('\r\n')
}

const dateOnly = (d: unknown) => String(d ?? '').slice(0, 10).replace(/-/g, '')

/** "09:00" or "09:00:00" to "090000". Anything unparseable gives null, so the caller can
 *  fall back to an all day event rather than writing a broken date. */
function timeOnly(t: unknown): string | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(t ?? ''))
  if (!m) return null
  return `${m[1]}${m[2]}${m[3] || '00'}`
}

/** The day after, for an all day event's exclusive DTEND. */
function nextDay(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4))
  const m = Number(yyyymmdd.slice(4, 6))
  const d = Number(yyyymmdd.slice(6, 8))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10).replace(/-/g, '')
}

/** An hour after a start time, used when a booking has no finish time recorded. */
function plusOneHour(hhmmss: string): string {
  const h = Number(hhmmss.slice(0, 2))
  const rest = hhmmss.slice(2)
  return String((h + 1) % 24).padStart(2, '0') + rest
}

type EventInput = {
  uid: string
  date: unknown
  start?: unknown
  end?: unknown
  allDay?: boolean
  summary: string
  description?: string
  location?: string
  status?: string
  stamp: string
}

function buildEvent(e: EventInput): string | null {
  const day = dateOnly(e.date)
  if (day.length !== 8) return null

  const lines: string[] = ['BEGIN:VEVENT']
  lines.push(`UID:${e.uid}`)
  lines.push(`DTSTAMP:${e.stamp}`)

  // all_day and the times cannot disagree: the bookings_guard trigger nulls both times
  // whenever all_day is set, and bookings_times_check demands both times, with the end
  // after the start, whenever it is not. So trusting the flag here is safe.
  const start = e.allDay ? null : timeOnly(e.start)
  if (start) {
    const end = timeOnly(e.end) || plusOneHour(start)
    lines.push(`DTSTART:${day}T${start}`)
    // An end at or before the start would make the event vanish in some clients, so treat
    // it as unset and give the booking an hour.
    lines.push(`DTEND:${day}T${end > start ? end : plusOneHour(start)}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day}`)
    lines.push(`DTEND;VALUE=DATE:${nextDay(day)}`)
  }

  lines.push(`SUMMARY:${esc(e.summary)}`)
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
  // A pending booking is not confirmed work, and saying so lets the creative see at a
  // glance what is still soft.
  lines.push(`STATUS:${e.status === 'tentative' ? 'TENTATIVE' : 'CONFIRMED'}`)
  lines.push('END:VEVENT')

  return lines.map(fold).join('\r\n')
}

function icsResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, max-age=0',
      // Calendar clients follow this when the user picks "download" rather than subscribe.
      'Content-Disposition': 'inline; filename="lenstrybe.ics"',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

/** An empty but valid calendar. Returned for a bad token too: a wrong URL should look like
 *  an empty calendar rather than confirm which tokens exist. */
function emptyCalendar(): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LensTrybe//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:LensTrybe',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return icsResponse(emptyCalendar(), 500)

  const token = new URL(req.url).searchParams.get('token') || ''
  if (!UUID_RE.test(token)) return icsResponse(emptyCalendar())

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: profile } = await admin
    .from('profiles')
    .select('id, business_name')
    .eq('calendar_token', token)
    .maybeSingle()

  if (!profile?.id) return icsResponse(emptyCalendar())

  const from = isoDay(-PAST_DAYS)
  const to = isoDay(FUTURE_DAYS)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const [bookingsRes, meetingsRes, availabilityRes] = await Promise.all([
    admin.from('bookings')
      .select('id, client_name, service, booking_date, start_time, end_time, location, status, notes, all_day')
      .eq('creative_id', profile.id)
      .gte('booking_date', from).lte('booking_date', to)
      .limit(1000),
    admin.from('meetings')
      .select('id, title, description, location, meeting_date, start_time, end_time, client_name, status, meeting_type')
      .eq('creative_id', profile.id)
      .gte('meeting_date', from).lte('meeting_date', to)
      .limit(1000),
    admin.from('availability')
      .select('id, date, is_available, notes, all_day, start_time, end_time')
      .eq('creative_id', profile.id)
      .eq('is_available', false)
      .gte('date', from).lte('date', to)
      .limit(1000),
  ])

  const events: string[] = []

  for (const b of bookingsRes.data || []) {
    if (DEAD_BOOKING.has(String(b.status || '').toLowerCase())) continue
    const pending = String(b.status || '').toLowerCase() === 'pending'
    const who = b.client_name || 'Client'
    const what = b.service || 'Booking'
    events.push(buildEvent({
      uid: `booking-${b.id}@lenstrybe.com`,
      date: b.booking_date,
      start: b.start_time,
      end: b.end_time,
      allDay: b.all_day === true,
      summary: pending ? `${what} with ${who} (pending)` : `${what} with ${who}`,
      description: [
        pending ? 'Not confirmed yet.' : null,
        b.notes || null,
        'Booked through LensTrybe.',
      ].filter(Boolean).join('\n'),
      location: b.location || '',
      status: pending ? 'tentative' : 'confirmed',
      stamp,
    }) || '')
  }

  for (const m of meetingsRes.data || []) {
    if (DEAD_MEETING.has(String(m.status || '').toLowerCase())) continue
    const who = m.client_name ? ` with ${m.client_name}` : ''
    events.push(buildEvent({
      uid: `meeting-${m.id}@lenstrybe.com`,
      date: m.meeting_date,
      start: m.start_time,
      end: m.end_time,
      summary: `${m.title || 'Meeting'}${who}`,
      description: [m.description || null, m.meeting_type ? `Type: ${m.meeting_type}` : null].filter(Boolean).join('\n'),
      location: m.location || '',
      status: String(m.status || '').toLowerCase() === 'requested' ? 'tentative' : 'confirmed',
      stamp,
    }) || '')
  }

  for (const a of availabilityRes.data || []) {
    events.push(buildEvent({
      uid: `unavailable-${a.id}@lenstrybe.com`,
      date: a.date,
      start: a.start_time,
      end: a.end_time,
      allDay: a.all_day !== false,
      summary: 'Unavailable',
      description: a.notes || 'Marked unavailable in LensTrybe.',
      stamp,
    }) || '')
  }

  const name = profile.business_name ? `LensTrybe, ${profile.business_name}` : 'LensTrybe'

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LensTrybe//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${esc(name)}`),
    'X-WR-CALDESC:Your LensTrybe bookings, meetings and blocked out days.',
    // A hint to the client about how often to come back. Most ignore it, none mind it.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...events.filter(Boolean),
    'END:VCALENDAR',
    '',
  ].join('\r\n')

  return icsResponse(body)
})
