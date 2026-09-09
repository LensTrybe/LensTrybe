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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const c = claims(req)
    const uid = c?.sub as string | undefined
    if (!uid) return json({ error: 'not authenticated' }, 401)
    const body = await req.json()
    const { creativeId, proposed_date, proposed_time, message, client_name, client_phone, title } = body
    if (!creativeId) return json({ error: 'missing creativeId' }, 400)
    const clientEmail = (c?.email as string) || body.client_email || null

    // Look up the creative to email them.
    const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${creativeId}&select=business_name,business_email`, { headers: H })
    const prof = (await pr.json())[0]
    if (!prof) return json({ error: 'creative not found' }, 404)

    const payload = {
      creative_id: creativeId,
      origin: 'client',
      meeting_type: 'phone',
      status: 'requested',
      title: (title && String(title).trim()) || 'Phone call request',
      client_name: client_name || null,
      client_email: clientEmail,
      client_phone: client_phone || null,
      client_message: message || null,
      client_proposed_date: proposed_date || null,
      client_proposed_time: proposed_time || null,
      requester_user_id: uid,
    }
    const ins = await fetch(`${URL}/rest/v1/meetings`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(payload) })
    const rows = await ins.json()
    if (!Array.isArray(rows) || !rows[0]) return json({ error: 'could not create request', detail: rows }, 500)

    // Notify the creative by email (best effort).
    if (RESEND && prof.business_email) {
      const when = whenLabel(proposed_date || null, proposed_time || null)
      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px;color:#111">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1DB954;margin-bottom:8px">New call request</div>
        <div style="font-size:22px;font-weight:800;margin-bottom:6px">${esc(client_name) || 'A client'} wants a phone call</div>
        <div style="font-size:14px;color:#555;margin-bottom:20px">You have a new phone call request on LensTrybe.</div>
        <div style="background:#f6f6f7;border-radius:12px;padding:18px 20px;margin-bottom:24px">
          <div style="font-size:14px;margin-bottom:6px"><strong>Preferred time:</strong> ${when}</div>
          ${client_phone ? `<div style=\"font-size:14px;margin-bottom:6px\"><strong>Phone:</strong> ${esc(client_phone)}</div>` : ''}
          ${clientEmail ? `<div style=\"font-size:14px;margin-bottom:6px\"><strong>Email:</strong> ${esc(clientEmail)}</div>` : ''}
          ${message ? `<div style=\"font-size:14px\"><strong>Message:</strong> ${esc(message)}</div>` : ''}
        </div>
        <a href="https://lenstrybe.com/dashboard/clients/meetings" style="display:inline-block;background:#1DB954;color:#04120a;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px">Review the request</a>
      </body></html>`
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'LensTrybe <noreply@mail.lenstrybe.com>', to: [prof.business_email], reply_to: clientEmail || 'connect@lenstrybe.com', subject: `New phone call request from ${client_name || 'a client'}`, html }),
        })
      } catch { /* best effort */ }
    }
    return json({ ok: true, id: rows[0].id })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
