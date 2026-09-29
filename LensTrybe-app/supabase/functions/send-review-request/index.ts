import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { reviewRequestEmail } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// ---- end shared ----

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

  // Only a signed-in creative can request reviews, and only for themselves.
  const user = await getAuthUser(supabase, req)
  if (!user) return json({ error: 'Not authenticated' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const creativeId = user.id
  const clientName = typeof body.client_name === 'string' ? plain(body.client_name, 100) : ''
  const clientEmail = typeof body.client_email === 'string' ? body.client_email.trim().toLowerCase() : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : ''
  if (!isEmail(clientEmail)) return json({ error: 'A valid client email is required' }, 400)
  if (!UUID_RE.test(creativeId)) return json({ error: 'Not authenticated' }, 401)

  const allowed = await supabase.rpc('rate_limit_hit', { p_key: 'review-request:' + creativeId, p_max: 30, p_window_seconds: 86400 })
  if (allowed.error) console.error('send-review-request rate limit check failed', allowed.error)
  else if (allowed.data === false) return json({ error: 'You have sent a lot of review requests today. Please try again tomorrow.' }, 429)

  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', creativeId).maybeSingle()
  const businessName = plain(profile?.business_name || 'your creative', 120)
  const reviewUrl = `https://lenstrybe.com/creatives/${encodeURIComponent(creativeId)}`

  const email = reviewRequestEmail({ businessName, clientName, message, reviewUrl })

  const res = await sendEmail(resendKey, {
    to: clientEmail,
    replyTo: isEmail(profile?.business_email) ? profile.business_email : undefined,
    subject: email.subject,
    html: email.html,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Resend answers 429 when the account's daily sending quota is gone. Telling
    // someone to try again in that state is wrong advice, because it cannot succeed
    // until the quota resets. Name the real reason instead.
    if (res.status === 429 || /quota/i.test(JSON.stringify(data ?? ''))) {
      console.error('send-review-request resend DAILY QUOTA exhausted', res.status, data)
      return json({ error: 'Our email service has hit its daily sending limit, so this was not sent. That is a problem on our end, not with your review request. Sending will work again once the limit resets.' }, 503)
    }
    console.error('send-review-request resend error', res.status, data)
    return json({ error: 'Could not send the review request. Please try again.' }, 502)
  }
  return json({ success: true })
})
