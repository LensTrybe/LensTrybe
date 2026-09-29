import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { replyToClientHtml } from './emails.ts'

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
function preview(s: unknown, max: number) { const t = String(s ?? '').trim(); return t.length > max ? `${t.slice(0, max)}...` : t }

// Creative replied to a client: email the thread's client with the reply taken from the database.
// Body: { message_id }
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
    const messageId = typeof body.message_id === 'string' ? body.message_id : ''
    if (!UUID_RE.test(messageId)) return json({ error: 'message_id required' }, 400)

    const { data: msg } = await supabase.from('messages').select('id, thread_id, body, sender_type, created_at').eq('id', messageId).maybeSingle()
    if (!msg?.thread_id) return json({ error: 'Message not found' }, 404)
    const { data: thread } = await supabase.from('message_threads').select('id, creative_id, client_name, client_email').eq('id', msg.thread_id).maybeSingle()
    if (!thread) return json({ error: 'Message not found' }, 404)
    if (thread.creative_id !== user.id) return json({ error: 'Forbidden' }, 403)
    if (msg.sender_type && msg.sender_type !== 'creative') return json({ error: 'Forbidden' }, 403)
    if (!thread.client_email) return json({ success: true, skipped: 'no_recipient' })
    if (Date.now() - new Date(msg.created_at).getTime() > 15 * 60 * 1000) return json({ success: true, skipped: 'stale' })

    const once = await supabase.rpc('rate_limit_hit', { p_key: `msg-notify:msg:${msg.id}`, p_max: 1, p_window_seconds: 86400 })
    if (once.error || once.data === false) return json({ success: true, skipped: 'already_notified' })
    const perUser = await supabase.rpc('rate_limit_hit', { p_key: `msg-notify:user:${user.id}`, p_max: 60, p_window_seconds: 3600 })
    if (perUser.error || perUser.data === false) return json({ error: 'Too many requests' }, 429)

    const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', thread.creative_id).maybeSingle()
    const businessName = plain(profile?.business_name || 'Your creative', 80)
    const creativeEmail = profile?.business_email || user.email || undefined

    const emailPattern = String(thread.client_email).replace(/[\\%_]/g, (m) => `\\${m}`)
    const { data: portal } = await supabase.from('client_portals').select('portal_token')
      .eq('creative_id', thread.creative_id).ilike('client_email', emailPattern).limit(1).maybeSingle()
    const portalUrl = portal?.portal_token ? `${APP}/portal/${encodeURIComponent(String(portal.portal_token))}` : APP

    const res = await sendEmail(resendKey, {
      to: thread.client_email,
      replyTo: creativeEmail,
      subject: plain(`New message from ${businessName}`, 150),
      html: replyToClientHtml({ businessName, clientName: thread.client_name ? plain(thread.client_name, 60) : '', message: preview(msg.body, 2000), portalUrl }),
    })
    if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
    return json({ success: true })
  } catch (err) {
    console.error('send-reply-notification error', err)
    return json({ error: 'Could not send notification' }, 500)
  }
})
