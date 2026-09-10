import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
const RESEND = Deno.env.get('RESEND_API_KEY') || ''
const admin = createClient(SUPABASE_URL, KEY)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: unknown) { return esc(s).replace(/\r?\n/g, '<br>') }
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"\\]/g, '').trim().slice(0, max) }
function fromName(s: string) { return s.replace(/[,;:@()\[\]<>"\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'A LensTrybe creative' }
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;:"'()\\]+@[^\s@<>,;:"'()\\]+\.[^\s@<>,;:"'()\\]+$/.test(s) }
function pad(n: number) { return String(n).padStart(2, '0') }
async function getAuthUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try { const { data, error } = await admin.auth.getUser(token); if (error || !data?.user) return null; return data.user } catch { return null }
}
function whenLabel(date: string | null, start: string | null) {
  if (!date) return 'A time they suggested'
  const d = new Date(date + 'T00:00:00')
  const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!start) return day
  const [h, m] = start.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return `${day} · ${h12}${m ? ':' + pad(m) : ''}${ap}`
}
function cap(v: unknown, max: number) { const s = typeof v === 'string' ? v.trim() : ''; return s ? s.slice(0, max) : null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    // Verify the session with Supabase Auth (not just decode the JWT).
    const user = await getAuthUser(req)
    if (!user) return json({ error: 'not authenticated' }, 401)
    const uid = user.id

    let body: any = {}
    try { body = await req.json() } catch { return json({ error: 'bad request' }, 400) }
    const creativeId = String(body?.creativeId ?? body?.creative_id ?? '')
    if (!UUID_RE.test(creativeId)) return json({ error: 'missing creativeId' }, 400)

    // The client's email always comes from their verified account.
    const clientEmail = isEmail(user.email) ? String(user.email) : null
    const title = cap(body.title, 120) || 'Phone call request'
    const clientName = cap(body.client_name, 100)
    const clientPhone = cap(body.client_phone, 40)
    const message = cap(body.message, 1000)
    const proposedDate = typeof body.proposed_date === 'string' && DATE_RE.test(body.proposed_date) ? body.proposed_date : null
    const proposedTime = typeof body.proposed_time === 'string' && TIME_RE.test(body.proposed_time) ? body.proposed_time : null

    // Rate limit: 5 requests per client per creative per day, 20 per client per day overall.
    for (const [key, max] of [['request-meeting:' + uid + ':' + creativeId, 5], ['request-meeting:' + uid, 20]] as [string, number][]) {
      const r = await admin.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: 86400 })
      if (r.error) console.error('request-meeting rate limit check failed', r.error)
      else if (r.data === false) return json({ error: 'You have sent a lot of requests today. Please try again tomorrow.' }, 429)
    }

    // Look up the creative to email them.
    const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', creativeId).maybeSingle()
    if (!prof) return json({ error: 'creative not found' }, 404)

    const payload = {
      creative_id: creativeId,
      origin: 'client',
      meeting_type: 'phone',
      status: 'requested',
      title,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      client_message: message,
      client_proposed_date: proposedDate,
      client_proposed_time: proposedTime,
      requester_user_id: uid,
    }
    const { data: row, error: insErr } = await admin.from('meetings').insert(payload).select('id').single()
    if (insErr || !row) {
      console.error('request-meeting insert failed', insErr)
      return json({ error: 'could not create request' }, 500)
    }

    // Notify the creative by email (best effort).
    if (RESEND && isEmail(prof.business_email)) {
      const when = whenLabel(proposedDate, proposedTime)
      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px;color:#111">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1DB954;margin-bottom:8px">New call request</div>
        <div style="font-size:22px;font-weight:800;margin-bottom:6px">${esc(clientName || 'A client')} wants a phone call</div>
        <div style="font-size:14px;color:#555;margin-bottom:20px">You have a new phone call request on LensTrybe.</div>
        <div style="background:#f6f6f7;border-radius:12px;padding:18px 20px;margin-bottom:24px">
          <div style="font-size:14px;margin-bottom:6px"><strong>Preferred time:</strong> ${esc(when)}</div>
          ${clientPhone ? `<div style="font-size:14px;margin-bottom:6px"><strong>Phone:</strong> ${esc(clientPhone)}</div>` : ''}
          ${clientEmail ? `<div style="font-size:14px;margin-bottom:6px"><strong>Email:</strong> ${esc(clientEmail)}</div>` : ''}
          ${message ? `<div style="font-size:14px"><strong>Message:</strong> ${nl2br(message)}</div>` : ''}
        </div>
        <a href="https://lenstrybe.com/dashboard/clients/meetings" style="display:inline-block;background:#1DB954;color:#04120a;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px">Review the request</a>
      </body></html>`
      try {
        const send = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'LensTrybe <noreply@mail.lenstrybe.com>', to: [prof.business_email], reply_to: clientEmail || 'connect@lenstrybe.com', subject: `New phone call request from ${plain(clientName || 'a client', 100)}`, html }),
        })
        if (!send.ok) console.error('request-meeting resend error', send.status, await send.text().catch(() => ''))
      } catch (e) { console.error('request-meeting email failed', e) }
    }
    return json({ ok: true, id: row.id })
  } catch (e) {
    console.error('request-meeting failed', e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
