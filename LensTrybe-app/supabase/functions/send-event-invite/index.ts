import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ICS text escaping (RFC 5545). Used only inside the .ics attachment.
function icsEsc(s: unknown) {
  return String(s ?? '').replace(/\r(?!\n)/g, '\n').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}
// HTML escaping. Used for everything in the email body.
function htmlEsc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: unknown) { return htmlEsc(s).replace(/\r?\n/g, '<br>') }
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"\\]/g, '').trim().slice(0, max) }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/
const MAX_INVITEES = 20
// Display name for the From header: no characters that could break address parsing.
function fromName(s: string) { return s.replace(/[,;:@()\[\]<>"\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'A LensTrybe creative' }
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;:"'()\\]+@[^\s@<>,;:"'()\\]+\.[^\s@<>,;:"'()\\]+$/.test(s) }
function jsonRes(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
async function getAuthUser(admin: any, req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try { const { data, error } = await admin.auth.getUser(token); if (error || !data?.user) return null; return data.user } catch { return null }
}
function pad(n: number) { return String(n).padStart(2, '0') }
function dateCompact(d: string) { return d.replace(/-/g, '') }
function timeCompact(t: string) {
  const [h, m] = (t || '00:00').split(':')
  return `${pad(Number(h))}${pad(Number(m))}00`
}
function addDay(d: string) {
  const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + 1)
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`
}
function addHour(t: string) {
  const [h, m] = (t || '09:00').split(':').map(Number)
  const total = (h * 60 + m + 60) % (24 * 60)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}
function b64(str: string) {
  return btoa(unescape(encodeURIComponent(str)))
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Australia/Brisbane',
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+1000',
  'TZOFFSETTO:+1000',
  'TZNAME:AEST',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Only the signed-in owner of the calendar event can send its invites.
    const user = await getAuthUser(admin, req)
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401)

    let body: any = {}
    try { body = await req.json() } catch { return jsonRes({ error: 'Invalid request' }, 400) }
    // Accept only an event id. (Older clients sent the whole event; only its id is used.)
    const eventId = String(body?.event_id ?? body?.eventId ?? body?.event?.id ?? '')
    if (!UUID_RE.test(eventId)) return jsonRes({ error: 'event_id required' }, 400)

    const { data: event, error: loadErr } = await admin.from('calendar_events').select('*').eq('id', eventId).maybeSingle()
    if (loadErr) console.error('send-event-invite load failed', loadErr)
    if (!event || event.user_id !== user.id) return jsonRes({ error: 'Event not found' }, 404)
    if (!DATE_RE.test(String(event.event_date || ''))) return jsonRes({ error: 'This event has no valid date.' }, 400)
    const startTime = TIME_RE.test(String(event.start_time || '')) ? String(event.start_time) : ''
    const endTimeRaw = TIME_RE.test(String(event.end_time || '')) ? String(event.end_time) : ''

    const invitees: string[] = Array.from(new Set(
      (Array.isArray(event.invitees) ? event.invitees : [])
        .map((e: unknown) => String(e ?? '').trim().toLowerCase())
        .filter((e: string) => isEmail(e)),
    )).slice(0, MAX_INVITEES) as string[]
    if (!invitees.length) return jsonRes({ skipped: 'no invitees' })

    const allowed = await admin.rpc('rate_limit_hit', { p_key: 'event-invite:' + user.id, p_max: 60, p_window_seconds: 86400 })
    if (allowed.error) console.error('send-event-invite rate limit check failed', allowed.error)
    else if (allowed.data === false) return jsonRes({ error: 'Too many invites sent today. Please try again tomorrow.' }, 429)

    // Host details come from the caller's own profile, never from the request.
    const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', user.id).maybeSingle()
    const hostName = plain(prof?.business_name || 'A LensTrybe creative', 80) || 'A LensTrybe creative'
    const hostEmail = isEmail(prof?.business_email) ? String(prof!.business_email) : (isEmail(user.email) ? String(user.email) : 'connect@lenstrybe.com')

    const uid = `${event.id}@lenstrybe.com`
    const seq = event?.updated_at ? Math.max(0, Math.floor(new Date(event.updated_at).getTime() / 1000)) || 0 : 0
    const stampD = new Date()
    const dtstamp = `${stampD.getUTCFullYear()}${pad(stampD.getUTCMonth() + 1)}${pad(stampD.getUTCDate())}T${pad(stampD.getUTCHours())}${pad(stampD.getUTCMinutes())}${pad(stampD.getUTCSeconds())}Z`

    let dtStart: string, dtEnd: string
    if (event.all_day || !startTime) {
      dtStart = `DTSTART;VALUE=DATE:${dateCompact(event.event_date)}`
      dtEnd = `DTEND;VALUE=DATE:${addDay(event.event_date)}`
    } else {
      const endT = endTimeRaw || addHour(startTime)
      dtStart = `DTSTART;TZID=Australia/Brisbane:${dateCompact(event.event_date)}T${timeCompact(startTime)}`
      dtEnd = `DTEND;TZID=Australia/Brisbane:${dateCompact(event.event_date)}T${timeCompact(endT)}`
    }

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LensTrybe//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      VTIMEZONE,
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `SEQUENCE:${seq}`,
      `DTSTAMP:${dtstamp}`,
      dtStart,
      dtEnd,
      `SUMMARY:${icsEsc(event.title)}`,
      event.location ? `LOCATION:${icsEsc(event.location)}` : '',
      event.notes ? `DESCRIPTION:${icsEsc(event.notes)}` : '',
      `ORGANIZER;CN=${icsEsc(hostName)}:mailto:${hostEmail}`,
      ...invitees.map((em) => `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${em}`),
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    const whenLabel = (() => {
      const d = new Date(event.event_date + 'T00:00:00')
      const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      if (event.all_day || !startTime) return `${day} · All day`
      const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ':' + pad(m) : ''}${ap}` }
      const endT = endTimeRaw || addHour(startTime)
      return `${day} · ${to12(startTime)} to ${to12(endT)}`
    })()

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px;color:#111">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1DB954;margin-bottom:8px">You're invited</div>
      <div style="font-size:24px;font-weight:800;margin-bottom:6px">${htmlEsc(event.title)}</div>
      <div style="font-size:14px;color:#555;margin-bottom:20px">${htmlEsc(hostName)} has invited you to an event.</div>
      <div style="background:#f6f6f7;border-radius:12px;padding:18px 20px;margin-bottom:24px">
        <div style="font-size:14px;color:#111;margin-bottom:6px"><strong>When:</strong> ${htmlEsc(whenLabel)}</div>
        ${event.location ? `<div style="font-size:14px;color:#111;margin-bottom:6px"><strong>Where:</strong> ${htmlEsc(event.location)}</div>` : ''}
        ${event.notes ? `<div style="font-size:14px;color:#111"><strong>Notes:</strong> ${nl2br(event.notes)}</div>` : ''}
      </div>
      <div style="font-size:13px;color:#777">The attached invite (.ics) can be added to your Apple, Google or Outlook calendar. Reply to this email to reach ${htmlEsc(hostName)}.</div>
    </body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName(hostName)} (via LensTrybe) <noreply@mail.lenstrybe.com>`,
        to: invitees,
        reply_to: hostEmail,
        subject: `${hostName} invited you: ${plain(event.title, 150)}`,
        html,
        attachments: [{ filename: 'invite.ics', content: b64(ics), content_type: 'text/calendar; method=REQUEST' }],
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('send-event-invite resend error', res.status, data)
      return jsonRes({ error: 'Could not send the invite. Please try again.' }, 502)
    }
    return jsonRes({ success: true, sent: invitees.length })
  } catch (err) {
    console.error('send-event-invite failed', err)
    return jsonRes({ error: 'Could not send the invite. Please try again.' }, 500)
  }
})
