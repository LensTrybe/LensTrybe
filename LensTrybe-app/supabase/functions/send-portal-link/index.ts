import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { portalLinkEmail } from './emails.ts'

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

const APP = 'https://lenstrybe.com'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }

// Emails a client the link to a portal the signed-in creative owns. Body: { portal_id }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorised' }, 401)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return json({ error: 'Unauthorised' }, 401)

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
    const portalId = typeof body.portal_id === 'string' ? body.portal_id : ''
    if (!UUID_RE.test(portalId)) return json({ error: 'portal_id required' }, 400)

    const { data: portal } = await supabase.from('client_portals')
      .select('id, creative_id, client_name, client_email, portal_token')
      .eq('id', portalId).eq('creative_id', user.id).maybeSingle()
    if (!portal) return json({ error: 'Portal not found' }, 404)
    if (!portal.client_email || !portal.portal_token) return json({ error: 'This portal has no client email' }, 400)

    for (const [key, max] of [[`send-portal-link:portal:${portal.id}`, 3], [`send-portal-link:user:${user.id}`, 30]] as [string, number][]) {
      const { data: allowed, error } = await supabase.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: 3600 })
      if (error || allowed === false) return json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', user.id).maybeSingle()
    const creativeName = plain(profile?.business_name || 'Your creative', 80)
    const clientName = plain(portal.client_name || '', 60)
    const portalUrl = `${APP}/portal/${encodeURIComponent(String(portal.portal_token))}`

    const email = portalLinkEmail({ creativeName, clientName, portalUrl, subject: plain(`${creativeName} has shared a project portal with you`, 150) })
    const res = await sendEmail(resendKey, {
      to: portal.client_email,
      replyTo: profile?.business_email || user.email || undefined,
      subject: email.subject,
      html: email.html,
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      // Resend answers 429 when the account's daily sending quota is gone. Telling
      // someone to try again in that state is wrong advice, because it cannot succeed
      // until the quota resets. Name the real reason instead.
      if (res.status === 429 || /quota/i.test(errBody)) {
        console.error('send-portal-link resend DAILY QUOTA exhausted', res.status, errBody)
        return json({ error: 'Our email service has hit its daily sending limit, so this was not sent. That is a problem on our end, not with your portal link. Sending will work again once the limit resets.' }, 503)
      }
      console.error('send-portal-link resend error', res.status, errBody)
      return json({ error: 'Could not send the portal link' }, 502)
    }
    return json({ success: true })
  } catch (err) {
    console.error('send-portal-link error', err)
    return json({ error: 'Could not send the portal link' }, 500)
  }
})
