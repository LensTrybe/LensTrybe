import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { meetingConfirmedHtml, meetingDeclinedHtml } from './emails.ts'

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
function whenLabel(date: string | null, start: string | null, end: string | null) {
  if (!date || !DATE_RE.test(date)) return 'a time to be confirmed'
  const d = new Date(date + 'T00:00:00')
  const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!start || !TIME_RE.test(start)) return day
  const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ':' + pad(m) : ''}${ap}` }
  return `${day} · ${to12(start)}${end && TIME_RE.test(end) ? ' to ' + to12(end) : ''}`
}

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
    const meetingId = String(body?.meetingId ?? body?.meeting_id ?? '')
    const kind = String(body?.kind ?? '')
    if (!UUID_RE.test(meetingId) || !['confirmed', 'declined'].includes(kind)) return json({ error: 'bad request' }, 400)

    const { data: m, error: loadErr } = await admin.from('meetings').select('*').eq('id', meetingId).maybeSingle()
    if (loadErr) console.error('meeting-notify load failed', loadErr)
    if (!m) return json({ error: 'not found' }, 404)
    if (m.creative_id !== uid) return json({ error: 'forbidden' }, 403)
    if (!isEmail(m.client_email)) return json({ skipped: 'no client email' })

    const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', m.creative_id).maybeSingle()
    const hostName = plain(prof?.business_name || 'Your LensTrybe creative', 80) || 'Your LensTrybe creative'
    const hostEmail = isEmail(prof?.business_email) ? String(prof!.business_email) : 'connect@lenstrybe.com'
    const isPhone = m.meeting_type === 'phone'
    const when = whenLabel(m.meeting_date, m.start_time, m.end_time)

    let subject = ''
    let html = ''
    if (kind === 'confirmed') {
      subject = `Your ${isPhone ? 'call' : 'meeting'} with ${hostName} is confirmed`
      html = meetingConfirmedHtml({ hostName, isPhone, when, location: m.location, description: m.description })
    } else {
      subject = `Update on your ${isPhone ? 'call' : 'meeting'} request`
      html = meetingDeclinedHtml({ hostName })
    }

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName(hostName)} (via LensTrybe) <noreply@mail.lenstrybe.com>`, to: [m.client_email], reply_to: hostEmail, subject, html }),
    })
    if (!send.ok) {
      console.error('meeting-notify resend error', send.status, await send.text().catch(() => ''))
      return json({ error: 'Could not send the email. Please try again.' }, 502)
    }
    return json({ ok: true })
  } catch (e) {
    console.error('meeting-notify failed', e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
