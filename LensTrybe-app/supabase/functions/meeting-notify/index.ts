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
function claims(req: Request): Record<string, unknown> | null {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer /, '')
  const p = t.split('.')
  if (p.length < 2) return null
  try { return JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return null }
}
function whenLabel(date: string | null, start: string | null, end: string | null) {
  if (!date) return 'a time to be confirmed'
  const d = new Date(date + 'T00:00:00')
  const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!start) return day
  const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ':' + pad(m) : ''}${ap}` }
  return `${day} · ${to12(start)}${end ? ' – ' + to12(end) : ''}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const c = claims(req)
    const uid = c?.sub as string | undefined
    if (!uid) return json({ error: 'not authenticated' }, 401)
    const { meetingId, kind } = await req.json()
    if (!meetingId || !['confirmed', 'declined'].includes(kind)) return json({ error: 'bad request' }, 400)

    const r = await fetch(`${URL}/rest/v1/meetings?id=eq.${meetingId}&select=*`, { headers: H })
    const m = (await r.json())[0]
    if (!m) return json({ error: 'not found' }, 404)
    if (m.creative_id !== uid) return json({ error: 'forbidden' }, 403)
    if (!m.client_email) return json({ skipped: 'no client email' })

    const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${m.creative_id}&select=business_name,business_email`, { headers: H })
    const prof = (await pr.json())[0] || {}
    const hostName = prof.business_name || 'Your LensTrybe creative'
    const hostEmail = prof.business_email || 'connect@lenstrybe.com'
    const isPhone = m.meeting_type === 'phone'
    const when = whenLabel(m.meeting_date, m.start_time, m.end_time)

    let subject = ''
    let html = ''
    if (kind === 'confirmed') {
      subject = `Your ${isPhone ? 'call' : 'meeting'} with ${hostName} is confirmed`
      html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px;color:#111">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1DB954;margin-bottom:8px">Confirmed</div>
        <div style="font-size:22px;font-weight:800;margin-bottom:6px">You’re booked in with ${esc(hostName)}</div>
        <div style="font-size:14px;color:#555;margin-bottom:20px">Your ${isPhone ? 'phone call' : 'meeting'} is confirmed for the time below.</div>
        <div style="background:#f6f6f7;border-radius:12px;padding:18px 20px;margin-bottom:12px">
          <div style="font-size:14px;margin-bottom:6px"><strong>When:</strong> ${when}</div>
          <div style="font-size:14px;margin-bottom:6px"><strong>How:</strong> ${isPhone ? 'Phone call' : esc(m.location || 'Details to follow')}</div>
          ${m.description ? `<div style=\"font-size:14px\"><strong>Details:</strong> ${esc(m.description)}</div>` : ''}
        </div>
        <div style="font-size:13px;color:#777">Need to change it? Just reply to this email.</div>
      </body></html>`
    } else {
      subject = `Update on your ${isPhone ? 'call' : 'meeting'} request`
      html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px;color:#111">
        <div style="font-size:22px;font-weight:800;margin-bottom:6px">About your request with ${esc(hostName)}</div>
        <div style="font-size:14px;color:#555;margin-bottom:20px">Unfortunately ${esc(hostName)} isn’t able to make the time you requested. Feel free to reply with another time that suits you and they’ll do their best to fit you in.</div>
        <div style="font-size:13px;color:#777">Reply to this email to reach ${esc(hostName)} directly.</div>
      </body></html>`
    }

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${hostName} (via LensTrybe) <noreply@mail.lenstrybe.com>`, to: [m.client_email], reply_to: hostEmail, subject, html }),
    })
    const data = await send.json()
    return json({ ok: true, resend: data })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
