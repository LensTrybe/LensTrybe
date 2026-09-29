import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { meetingRequestHtml } from './emails.ts'

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
  if (!date || !DATE_RE.test(date)) return 'Time to be confirmed'
  const d = new Date(date + 'T00:00:00')
  const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!start || !TIME_RE.test(start)) return day
  const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ':' + pad(m) : ''}${ap}` }
  return `${day} · ${to12(start)}${end && TIME_RE.test(end) ? ' to ' + to12(end) : ''}`
}

// Fixed base for the client response link (never taken from the request).
const APP_BASE = 'https://lenstrybe.com'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    // Only the signed-in creative who owns the meeting can send it.
    const user = await getAuthUser(req)
    if (!user) return json({ error: 'Not authenticated' }, 401)

    let body: any = {}
    try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
    const meetingId = String(body?.meetingId ?? body?.meeting_id ?? '')
    if (!UUID_RE.test(meetingId)) return json({ error: 'missing meetingId' }, 400)

    const { data: m, error: loadErr } = await admin.from('meetings').select('*').eq('id', meetingId).maybeSingle()
    if (loadErr) console.error('send-meeting load failed', loadErr)
    if (!m || m.creative_id !== user.id) return json({ error: 'not found' }, 404)
    if (!isEmail(m.client_email)) return json({ skipped: 'no client email' })
    if (!m.response_token || !UUID_RE.test(String(m.response_token))) return json({ error: 'This meeting cannot be sent yet.' }, 400)

    const allowed = await admin.rpc('rate_limit_hit', { p_key: 'send-meeting:' + user.id, p_max: 60, p_window_seconds: 86400 })
    if (allowed.error) console.error('send-meeting rate limit check failed', allowed.error)
    else if (allowed.data === false) return json({ error: 'Too many meeting emails sent today. Please try again tomorrow.' }, 429)

    // Host details come from the caller's own profile.
    const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', user.id).maybeSingle()
    const hostName = plain(prof?.business_name || 'Your LensTrybe creative', 80) || 'Your LensTrybe creative'
    const hostEmail = isEmail(prof?.business_email) ? String(prof!.business_email) : (isEmail(user.email) ? String(user.email) : 'connect@lenstrybe.com')
    const link = `${APP_BASE}/meeting/${encodeURIComponent(String(m.response_token))}`
    const when = whenLabel(m.meeting_date, m.start_time, m.end_time)

    const html = meetingRequestHtml({ hostName, title: m.title, when, location: m.location, description: m.description, link })

    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName(hostName)} (via LensTrybe) <noreply@mail.lenstrybe.com>`,
        to: [m.client_email],
        reply_to: hostEmail,
        subject: `${hostName} would like to meet: ${plain(m.title, 150)}`,
        html,
      }),
    })
    if (!send.ok) {
      const errBody = await send.text().catch(() => '')
      // Resend answers 429 when the account's daily sending quota is gone. Telling
      // someone to try again in that state is wrong advice, because it cannot succeed
      // until the quota resets. Name the real reason instead.
      if (send.status === 429 || /quota/i.test(errBody)) {
        console.error('send-meeting resend DAILY QUOTA exhausted', send.status, errBody)
        return json({ error: 'Our email service has hit its daily sending limit, so this was not sent. That is a problem on our end, not with your meeting. Sending will work again once the limit resets.' }, 503)
      }
      console.error('send-meeting resend error', send.status, errBody)
      return json({ error: 'Could not send the meeting email. Please try again.' }, 502)
    }
    const { error: upErr } = await admin.from('meetings').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', meetingId)
    if (upErr) console.error('send-meeting status update failed', upErr)
    return json({ ok: true })
  } catch (e) {
    console.error('send-meeting failed', e)
    return json({ error: 'Could not send the meeting. Please try again.' }, 500)
  }
})
