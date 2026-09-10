import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: unknown) { return esc(s).replace(/\n/g, '<br>') }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; panelHtml?: string; ctaText?: string; ctaUrl?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', panelHtml = '', ctaText, ctaUrl, footNote = '' } = opts
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.pageBg};">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;font-family:${BRAND.font};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${BRAND.green};letter-spacing:-0.02em;">LensTrybe</div></td></tr>
<tr><td style="padding:22px 36px 8px;">
${kicker ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(kicker)}</div>` : ''}
<h1 style="margin:0 0 ${intro ? '10px' : '4px'};font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${heading}</h1>
${intro ? `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${intro}</p>` : ''}
</td></tr>
${panelHtml ? `<tr><td style="padding:18px 36px 0;">${panelHtml}</td></tr>` : ''}
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td></tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:13px;font-weight:700;color:${BRAND.text};">LensTrybe</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}
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
      html: emailShell({
        preheader: `${businessName} replied to your conversation`,
        kicker: 'New message',
        heading: `${esc(businessName)} sent you a message`,
        intro: thread.client_name ? `Hi ${esc(plain(thread.client_name, 60))},` : '',
        panelHtml: panel(`<p style="margin:0;color:${BRAND.text};font-size:15px;line-height:1.7;">${nl2br(preview(msg.body, 2000))}</p>`),
        ctaText: 'Reply in your portal',
        ctaUrl: portalUrl,
        footNote: 'You can reply straight to this email, or open your portal to see the full conversation.',
      }),
    })
    if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
    return json({ success: true })
  } catch (err) {
    console.error('send-reply-notification error', err)
    return json({ error: 'Could not send notification' }, 500)
  }
})
