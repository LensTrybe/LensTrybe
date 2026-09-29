import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { bookingUpdateHtml } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
type Attachment = { filename: string; content: string }
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string; attachments?: Attachment[] }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  if (args.attachments?.length) body.attachments = args.attachments
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// ---- end shared ----

// ---- Add to calendar ----
//
// A confirmed booking the client never puts in their calendar is a no show waiting to
// happen. Attaching a calendar file means one tap in Gmail, Apple Mail or Outlook puts it
// there. The creative's own copy comes from their LensTrybe feed instead, so this file is
// only ever for the client.
//
// Times are floating, with no timezone, matching the calendar-feed function. A 2pm shoot is
// 2pm where everyone is standing, and no daylight saving change can shift it.

/** RFC 5545 escaping: backslash, semicolon, comma, and newlines become \n. */
function icsEsc(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}
/** Lines over 75 octets must be folded or strict parsers reject the whole file. */
function icsFold(line: string): string {
  if (line.length <= 73) return line
  const out: string[] = [line.slice(0, 73)]
  let rest = line.slice(73)
  while (rest.length > 72) { out.push(' ' + rest.slice(0, 72)); rest = rest.slice(72) }
  if (rest.length) out.push(' ' + rest)
  return out.join('\r\n')
}
function icsTime(t: unknown): string | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(t ?? ''))
  return m ? `${m[1]}${m[2]}${m[3] || '00'}` : null
}
function icsNextDay(yyyymmdd: string): string {
  const dt = new Date(Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8))))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10).replace(/-/g, '')
}
/** UTF-8 safe base64, which plain btoa is not. */
function b64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

// deno-lint-ignore no-explicit-any
function icsForBooking(booking: any, businessName: string, replyTo?: string): string | null {
  const day = String(booking.booking_date ?? '').slice(0, 10).replace(/-/g, '')
  if (day.length !== 8) return null

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LensTrybe//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT']
  // Same UID as the creative's feed, so re-sending replaces the event instead of doubling it.
  lines.push(`UID:booking-${booking.id}@lenstrybe.com`)
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`)

  // all_day and the times cannot disagree: bookings_guard nulls both times whenever all_day
  // is set, and bookings_times_check demands both, end after start, whenever it is not.
  const start = booking.all_day ? null : icsTime(booking.start_time)
  if (start) {
    lines.push(`DTSTART:${day}T${start}`)
    lines.push(`DTEND:${day}T${icsTime(booking.end_time) || start}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day}`)
    lines.push(`DTEND;VALUE=DATE:${icsNextDay(day)}`)
  }

  lines.push(`SUMMARY:${icsEsc(`${booking.service || 'Booking'} with ${businessName}`)}`)
  if (booking.location) lines.push(`LOCATION:${icsEsc(booking.location)}`)
  lines.push(`DESCRIPTION:${icsEsc(`Booked through LensTrybe.${replyTo ? `\nAny questions, reply to ${replyTo}.` : ''}`)}`)
  lines.push('STATUS:CONFIRMED')
  // A day's notice, which is the reminder a client actually wants for a shoot.
  lines.push('BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(`${booking.service || 'Booking'} with ${businessName} tomorrow`)}`, 'END:VALARM')
  lines.push('END:VEVENT', 'END:VCALENDAR', '')

  return lines.map(icsFold).join('\r\n')
}
// ---- end add to calendar ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/.test(s) }
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }
async function getAuthUser(admin: any, req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try { const { data, error } = await admin.auth.getUser(token); if (error || !data?.user) return null; return data.user } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Only the signed-in creative who owns the booking can notify its client.
  const user = await getAuthUser(supabase, req)
  if (!user) return json({ error: 'Not authenticated' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const bookingId = String(body.booking_id || body.bookingId || '')
  if (!UUID_RE.test(bookingId)) return json({ error: 'booking_id required' }, 400)

  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (!booking || booking.creative_id !== user.id) return json({ error: 'Booking not found' }, 404)
  if (!isEmail(booking.client_email)) return json({ error: 'booking has no client email', skipped: true }, 200)
  // The status always comes from the saved booking, never from the request.
  const statusRaw = String(booking.status || '').toLowerCase().trim()

  const allowed = await supabase.rpc('rate_limit_hit', { p_key: 'booking-update:' + user.id, p_max: 100, p_window_seconds: 86400 })
  if (allowed.error) console.error('send-booking-update rate limit check failed', allowed.error)
  else if (allowed.data === false) return json({ error: 'Too many booking updates sent today. Please try again tomorrow.' }, 429)

  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', user.id).maybeSingle()
  const businessName = plain(profile?.business_name || 'Your creative', 120)

  // Map status to a friendly, positive message.
  const confirmed = statusRaw === 'confirmed' || statusRaw === 'accepted'
  const declined = statusRaw === 'declined' || statusRaw === 'cancelled' || statusRaw === 'canceled'

  // Only a confirmed booking belongs in anyone's calendar. Sending one for a decline would
  // put work in the client's diary that is not happening.
  const replyTo = isEmail(profile?.business_email) ? profile.business_email : undefined
  const ics = confirmed ? icsForBooking(booking, businessName, replyTo) : null
  // One tap on a phone hands the event to the calendar app, which is far more reliable than
  // hoping the client's mail app does something sensible with an attachment. Zoho, for one,
  // files it into its own calendar and looks like it did nothing.
  const addUrl = confirmed && booking.view_token
    ? `${supabaseUrl}/functions/v1/calendar-feed?booking=${booking.view_token}`
    : undefined

  const res = await sendEmail(resendKey, {
    to: booking.client_email,
    replyTo,
    subject: confirmed ? `Your booking with ${businessName} is confirmed` : `An update on your booking with ${businessName}`,
    html: bookingUpdateHtml({
      businessName, confirmed, declined,
      service: booking.service, bookingDate: booking.booking_date, allDay: booking.all_day, startTime: booking.start_time, endTime: booking.end_time, location: booking.location,
      status: statusRaw || booking.status || 'updated', addUrl,
    }),
    attachments: ics ? [{ filename: 'booking.ics', content: b64(ics) }] : undefined,
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    // Resend answers 429 when the account's daily sending quota is gone. Telling
    // someone to try again in that state is wrong advice, because it cannot succeed
    // until the quota resets. Name the real reason instead.
    if (res.status === 429 || /quota/i.test(errBody)) {
      console.error('send-booking-update resend DAILY QUOTA exhausted', res.status, errBody)
      return json({ error: 'Our email service has hit its daily sending limit, so this was not sent. That is a problem on our end, not with your booking update. Sending will work again once the limit resets.' }, 503)
    }
    console.error('send-booking-update resend error', res.status, errBody)
    return json({ error: 'Could not send the booking update. Please try again.' }, 502)
  }

  return json({ success: true })
})
