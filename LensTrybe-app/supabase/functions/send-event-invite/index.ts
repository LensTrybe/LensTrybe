import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function esc(s: string) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
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

  try {
    const { event, host } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const invitees: string[] = Array.isArray(event?.invitees) ? event.invitees.filter(Boolean) : []
    if (!invitees.length) {
      return new Response(JSON.stringify({ skipped: 'no invitees' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const hostName = host?.name || 'A LensTrybe creative'
    const hostEmail = host?.email || 'connect@lenstrybe.com'
    const uid = `${event.id || crypto.randomUUID()}@lenstrybe.com`
    const seq = event?.updated_at ? Math.floor(new Date(event.updated_at).getTime() / 1000) : 0
    const stampD = new Date()
    const dtstamp = `${stampD.getUTCFullYear()}${pad(stampD.getUTCMonth() + 1)}${pad(stampD.getUTCDate())}T${pad(stampD.getUTCHours())}${pad(stampD.getUTCMinutes())}${pad(stampD.getUTCSeconds())}Z`

    let dtStart: string, dtEnd: string
    if (event.all_day || !event.start_time) {
      dtStart = `DTSTART;VALUE=DATE:${dateCompact(event.event_date)}`
      dtEnd = `DTEND;VALUE=DATE:${addDay(event.event_date)}`
    } else {
      const endT = event.end_time || addHour(event.start_time)
      dtStart = `DTSTART;TZID=Australia/Brisbane:${dateCompact(event.event_date)}T${timeCompact(event.start_time)}`
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
      `SUMMARY:${esc(event.title)}`,
      event.location ? `LOCATION:${esc(event.location)}` : '',
      event.notes ? `DESCRIPTION:${esc(event.notes)}` : '',
      `ORGANIZER;CN=${esc(hostName)}:mailto:${hostEmail}`,
      ...invitees.map((em) => `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${em}`),
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    const whenLabel = (() => {
      const d = new Date(event.event_date + 'T00:00:00')
      const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      if (event.all_day || !event.start_time) return `${day} \u00b7 All day`
      const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ':' + pad(m) : ''}${ap}` }
      const endT = event.end_time || addHour(event.start_time)
      return `${day} \u00b7 ${to12(event.start_time)} \u2013 ${to12(endT)}`
    })()

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px;color:#111">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1DB954;margin-bottom:8px">You're invited</div>
      <div style="font-size:24px;font-weight:800;margin-bottom:6px">${esc(event.title)}</div>
      <div style="font-size:14px;color:#555;margin-bottom:20px">${hostName} has invited you to an event.</div>
      <div style="background:#f6f6f7;border-radius:12px;padding:18px 20px;margin-bottom:24px">
        <div style="font-size:14px;color:#111;margin-bottom:6px"><strong>When:</strong> ${whenLabel}</div>
        ${event.location ? `<div style="font-size:14px;color:#111;margin-bottom:6px"><strong>Where:</strong> ${esc(event.location)}</div>` : ''}
        ${event.notes ? `<div style="font-size:14px;color:#111"><strong>Notes:</strong> ${esc(event.notes)}</div>` : ''}
      </div>
      <div style="font-size:13px;color:#777">The attached invite (.ics) can be added to your Apple, Google or Outlook calendar. Reply to this email to reach ${hostName}.</div>
    </body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${hostName} (via LensTrybe) <noreply@mail.lenstrybe.com>`,
        to: invitees,
        reply_to: hostEmail,
        subject: `${hostName} invited you: ${event.title}`,
        html,
        attachments: [{ filename: 'invite.ics', content: b64(ics), content_type: 'text/calendar; method=REQUEST' }],
      }),
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
