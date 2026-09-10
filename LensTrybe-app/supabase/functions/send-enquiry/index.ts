import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: unknown) { return esc(s).replace(/\n/g, '<br>') }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function fieldRow(label: string, valueHtml: string) { return `<div style="margin:0 0 12px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.faint};margin-bottom:3px;">${esc(label)}</div><div style="font-size:14px;color:${BRAND.text};line-height:1.55;">${valueHtml}</div></div>` }
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
const FRESH_MS = 15 * 60 * 1000
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }
function preview(s: unknown, max: number) { const t = String(s ?? '').trim(); return t.length > max ? `${t.slice(0, max)}...` : t }
function likeEscape(s: string) { return s.replace(/[\\%_]/g, (m) => `\\${m}`) }

// Sends the "new enquiry" emails for a thread that was JUST created (portfolio website form via
// submit_website_enquiry, or a signed-in client's profile enquiry). Each thread is notified once only.
// Body: { thread_id }. Any other field (for example portal_token) is ignored.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
    const threadId = typeof body.thread_id === 'string' ? body.thread_id : ''
    if (!UUID_RE.test(threadId)) return json({ error: 'thread_id required' }, 400)

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    const limit = async (key: string, max: number, win: number) => {
      const { data, error } = await supabase.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: win })
      if (error) { console.error('rate_limit_hit failed', error); return true }
      return data === false
    }
    if (await limit(`send-enquiry:ip:${ip}`, 20, 3600)) return json({ error: 'Too many requests' }, 429)

    const { data: thread } = await supabase.from('message_threads')
      .select('id, creative_id, client_name, client_email, subject, created_at, enquiry_notified_at')
      .eq('id', threadId).maybeSingle()
    if (!thread) return json({ error: 'Thread not found' }, 404)
    if (thread.enquiry_notified_at || Date.now() - new Date(thread.created_at).getTime() > FRESH_MS) {
      return json({ success: true, skipped: true })
    }

    const clientEmail = String(thread.client_email || '').trim().toLowerCase()
    if (clientEmail && await limit(`send-enquiry:to:${clientEmail}`, 5, 3600)) return json({ error: 'Too many requests' }, 429)
    if (await limit(`send-enquiry:creative:${thread.creative_id}`, 30, 3600)) return json({ error: 'Too many requests' }, 429)

    // Claim the thread atomically so a replay can never send twice.
    const { data: claimed } = await supabase.from('message_threads')
      .update({ enquiry_notified_at: new Date().toISOString() })
      .eq('id', threadId).is('enquiry_notified_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) return json({ success: true, skipped: true })

    const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', thread.creative_id).maybeSingle()
    const { data: messages } = await supabase.from('messages').select('body').eq('thread_id', threadId).order('created_at', { ascending: true }).limit(1)
    const firstMessage = preview(messages?.[0]?.body || '', 3000)

    const businessName = plain(profile?.business_name || 'LensTrybe Creative', 80)
    const creativeEmail = profile?.business_email || null
    const clientName = plain(thread.client_name || 'A client', 80)
    const subjectText = plain(thread.subject || 'General enquiry', 150)

    // In-app notification for the creative (best effort).
    try {
      await supabase.from('notifications').insert({
        user_id: thread.creative_id,
        type: 'enquiry',
        title: `New enquiry from ${clientName}`,
        body: subjectText,
        link: '/dashboard/clients/messages',
        meta: { thread_id: threadId },
      })
    } catch (_e) { /* non-blocking */ }

    // Look up (or create) the client's portal. The link is only ever emailed to the client's own address.
    let portalToken = ''
    if (clientEmail) {
      const { data: existingPortal } = await supabase.from('client_portals').select('portal_token')
        .eq('creative_id', thread.creative_id).ilike('client_email', likeEscape(clientEmail)).limit(1).maybeSingle()
      if (existingPortal?.portal_token) portalToken = String(existingPortal.portal_token)
      else {
        const { data: newPortal } = await supabase.from('client_portals')
          .insert({ creative_id: thread.creative_id, client_name: plain(thread.client_name || clientEmail, 200), client_email: clientEmail })
          .select('portal_token').single()
        portalToken = newPortal?.portal_token ? String(newPortal.portal_token) : ''
      }
    }
    const portalUrl = portalToken ? `${APP}/portal/${encodeURIComponent(portalToken)}` : APP

    // Auto-capture / update the CRM contact for this client (dedupe by exact email).
    if (clientEmail) {
      try {
        const { data: existing } = await supabase.from('crm_contacts').select('id')
          .eq('creative_id', thread.creative_id).ilike('email', likeEscape(clientEmail)).limit(1).maybeSingle()
        if (existing) {
          await supabase.from('crm_contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', existing.id)
        } else {
          await supabase.from('crm_contacts').insert({ creative_id: thread.creative_id, name: plain(thread.client_name || clientEmail, 200), email: clientEmail, status: 'Lead', tags: ['Enquiry'], last_contacted_at: new Date().toISOString() })
        }
      } catch (_e) { /* best effort: never block the enquiry on CRM capture */ }
    }

    // Notify the creative of the new enquiry (reply-to goes straight to the client).
    if (creativeEmail) {
      const panelHtml = panel(
        fieldRow('From', `${esc(clientName)} &middot; <a href="mailto:${esc(encodeURIComponent(clientEmail).replace(/%40/g, '@'))}" style="color:${BRAND.green};text-decoration:none;">${esc(clientEmail)}</a>`) +
        fieldRow('Subject', esc(subjectText)) +
        `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.faint};margin-bottom:3px;">Message</div><div style="font-size:14px;color:${BRAND.text};line-height:1.7;">${nl2br(firstMessage)}</div>`
      )
      const res = await sendEmail(resendKey, {
        to: creativeEmail,
        replyTo: clientEmail || undefined,
        subject: plain(`New enquiry from ${clientName}`, 150),
        html: emailShell({
          preheader: `${clientName} wants to work with you`,
          kicker: 'New enquiry',
          heading: `${esc(clientName)} wants to work with you`,
          intro: 'A new enquiry just landed in your inbox.',
          panelHtml,
          ctaText: 'Reply in your dashboard',
          ctaUrl: `${APP}/dashboard/clients/messages`,
          footNote: 'Tip: you can reply directly to this email and it will reach the client.',
        }),
      })
      if (!res.ok) console.error('resend (creative) failed', res.status)
    }

    // Confirmation to the client: fixed text, with their portal link.
    if (clientEmail) {
      const greetName = plain(thread.client_name || '', 40)
      const res = await sendEmail(resendKey, {
        to: clientEmail,
        replyTo: creativeEmail || undefined,
        subject: plain(`Your enquiry to ${businessName} has been received`, 150),
        html: emailShell({
          preheader: `${businessName} has received your enquiry`,
          kicker: 'Enquiry received',
          heading: 'Your enquiry has been received',
          intro: `${greetName ? `Hi ${esc(greetName)}, t` : 'T'}hanks for reaching out to <span style="color:${BRAND.text};">${esc(businessName)}</span>. They'll be in touch soon.`,
          panelHtml: panel(`<p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.7;">You can track your conversation and view anything ${esc(businessName)} shares with you through your personal client portal below.</p>`),
          ctaText: 'Open my portal',
          ctaUrl: portalUrl,
          footNote: "Keep this email. It contains your unique portal link. If you didn't make this enquiry, you can ignore this email.",
        }),
      })
      if (!res.ok) console.error('resend (client) failed', res.status)
    }

    return json({ success: true })
  } catch (err) {
    console.error('send-enquiry error', err)
    return json({ error: 'Could not send enquiry notification' }, 500)
  }
})
