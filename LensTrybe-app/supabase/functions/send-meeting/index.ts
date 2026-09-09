import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
const RESEND = Deno.env.get('RESEND_API_KEY') || ''
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function esc(s: unknown) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function pad(n: number) { return String(n).padStart(2, '0') }
function whenLabel(date: string | null, start: string | null, end: string | null) {
  if (!date) return 'Time to be confirmed'
  const d = new Date(date + 'T00:00:00')
  const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!start) return day
  const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ':' + pad(m) : ''}${ap}` }
  return `${day} · ${to12(start)}${end ? ' – ' + to12(end) : ''}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { meetingId, appUrl, host } = await req.json()
    if (!meetingId) return json({ error: 'missing meetingId' }, 400)
    const r = await fetch(`${URL}/rest/v1/meetings?id=eq.${meetingId}&select=*`, { headers: H })
    const m = (await r.json())[0]
    if (!m) return json({ error: 'not found' }, 404)
    if (!m.client_email) return json({ skipped: 'no client email' })

    const hostName = host?.name || 'A LensTrybe creative'
    const hostEmail = host?.email || 'connect@lenstrybe.com'
    const base = (appUrl || 'https://lenstrybe.com').replace(/\/$/, '')
    const link = `${base}/meeting/${m.response_token}`
    const when = whenLabel(m.meeting_date, m.start_time, m.end_time)

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px;color:#111">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1DB954;margin-bottom:8px">Meeting request</div>
      <div style="font-size:24px;font-weight:800;margin-bottom:6px">${esc(m.title)}</div>
      <div style="font-size:14px;color:#555;margin-bottom:20px">${esc(hostName)} would like to meet with you. Let them know if this time works.</div>
      <div style="background:#f6f6f7;border-radius:12px;padding:18px 20px;margin-bottom:24px">
        <div style="font-size:14px;color:#111;margin-bottom:6px"><strong>When:</strong> ${when}</div>
        ${m.location ? `<div style=\"font-size:14px;color:#111;margin-bottom:6px\"><strong>Where:</strong> ${esc(m.location)}</div>` : ''}
        ${m.description ? `<div style=\"font-size:14px;color:#111\"><strong>Details:</strong> ${esc(m.description)}</div>` : ''}
      </div>
      <a href="${link}" style="display:inline-block;background:#1DB954;color:#04120a;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px">Accept, decline or propose a time</a>
      <div style="font-size:13px;color:#777;margin-top:22px">Or paste this link into your browser:<br>${link}</div>
    </body></html>`

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${hostName} (via LensTrybe) <noreply@mail.lenstrybe.com>`,
        to: [m.client_email],
        reply_to: hostEmail,
        subject: `${hostName} would like to meet: ${m.title}`,
        html,
      }),
    })
    const data = await send.json()
    await fetch(`${URL}/rest/v1/meetings?id=eq.${meetingId}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'sent', updated_at: new Date().toISOString() }) })
    return json({ ok: true, resend: data })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
