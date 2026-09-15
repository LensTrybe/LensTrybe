import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function fieldRow(label: string, valueHtml: string) { return `<div style="margin:0 0 12px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.faint};margin-bottom:3px;">${esc(label)}</div><div style="font-size:14px;color:${BRAND.text};line-height:1.55;">${valueHtml}</div></div>` }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; panelHtml?: string; ctaText?: string; ctaUrl?: string; cta2Text?: string; cta2Url?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', panelHtml = '', ctaText, ctaUrl, cta2Text, cta2Url, footNote = '' } = opts
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.pageBg};">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;font-family:${BRAND.font};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><a href="https://lenstrybe.com" style="display:inline-block;text-decoration:none;"><img src="https://lenstrybe.com/email-logo-white.png" width="180" height="38" alt="LensTrybe" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:38px;" /></a></td></tr>
<tr><td style="padding:22px 36px 8px;">
${kicker ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(kicker)}</div>` : ''}
<h1 style="margin:0 0 ${intro ? '10px' : '4px'};font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${heading}</h1>
${intro ? `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${intro}</p>` : ''}
</td></tr>
${panelHtml ? `<tr><td style="padding:18px 36px 0;">${panelHtml}</td></tr>` : ''}
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td>${cta2Text && cta2Url ? `<td style="width:10px;"></td><td style="border-radius:10px;border:1px solid ${BRAND.green};"><a href="${cta2Url}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:${BRAND.green};text-decoration:none;font-family:${BRAND.font};">${esc(cta2Text)}</a></td>` : ''}</tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:12px;font-weight:400;letter-spacing:0.24em;color:${BRAND.text};">LENSTRYBE</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}
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
  const kicker = confirmed ? 'Booking confirmed' : declined ? 'Booking update' : 'Booking update'
  const heading = confirmed ? 'Your booking is confirmed' : declined ? 'An update on your booking' : 'Your booking has been updated'
  const intro = confirmed
    ? `Great news, ${esc(businessName)} has confirmed your booking.`
    : declined
      ? `${esc(businessName)} is unable to take this booking. Feel free to reach out to them to find another time.`
      : `${esc(businessName)} has updated the status of your booking.`

  const dateStr = booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('en-AU', { dateStyle: 'full' }) : ''
  const timeStr = booking.all_day
    ? 'All day'
    : [booking.start_time, booking.end_time].every(Boolean)
      ? `${String(booking.start_time).slice(0, 5)} to ${String(booking.end_time).slice(0, 5)}`
      : ''
  const panelHtml = panel(
    fieldRow('Service', esc(booking.service || 'Booking')) +
    (dateStr ? fieldRow('Date', esc(dateStr)) : '') +
    (timeStr ? fieldRow('Time', esc(timeStr)) : '') +
    (booking.location ? fieldRow('Location', esc(booking.location)) : '') +
    fieldRow('Status', `<span style="color:${confirmed ? BRAND.green : BRAND.text};text-transform:capitalize;">${esc(statusRaw || booking.status || 'updated')}</span>`)
  )

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
    html: emailShell({
      preheader: intro.replace(/<[^>]+>/g, ''),
      kicker,
      heading,
      intro,
      panelHtml,
      ctaText: 'View on LensTrybe',
      ctaUrl: 'https://lenstrybe.com/client-dashboard',
      cta2Text: addUrl ? 'Add to calendar' : undefined,
      cta2Url: addUrl,
      footNote: addUrl
        ? 'Add to calendar puts this straight in your calendar. The attached file does the same if your email app prefers it. You can reply straight to this email to reach your creative.'
        : 'You can reply straight to this email to reach your creative.',
    }),
    attachments: ics ? [{ filename: 'booking.ics', content: b64(ics) }] : undefined,
  })
  if (!res.ok) {
    console.error('send-booking-update resend error', res.status, await res.text().catch(() => ''))
    return json({ error: 'Could not send the booking update. Please try again.' }, 502)
  }

  return json({ success: true })
})
