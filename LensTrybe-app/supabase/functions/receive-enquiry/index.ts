import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : ''
  const clientEmail = typeof body.client_email === 'string' ? body.client_email.trim() : ''
  const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'General enquiry'
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!clientEmail || !clientName || !message) return json({ error: 'client_name, client_email, and message are required' }, 400)

  let creativeId = typeof body.creative_id === 'string' ? body.creative_id.trim() : ''
  if (!creativeId) {
    const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
    if (profiles && profiles.length > 0) creativeId = profiles[0].id
  }
  if (!creativeId) return json({ error: 'Could not resolve creative_id' }, 400)

  let thread: Record<string, unknown> | null = null
  const { data: existingThread } = await supabase.from('message_threads').select('*').eq('creative_id', creativeId).eq('client_email', clientEmail).order('created_at', { ascending: false }).limit(1).single()

  if (existingThread) {
    thread = existingThread
    await supabase.from('message_threads').update({ last_message_at: new Date().toISOString(), unread_count: (existingThread.unread_count || 0) + 1 }).eq('id', existingThread.id)
  } else {
    const { data: newThread, error: threadErr } = await supabase.from('message_threads').insert({ creative_id: creativeId, client_name: clientName, client_email: clientEmail, subject, last_message_at: new Date().toISOString(), unread_count: 1 }).select().single()
    if (threadErr || !newThread) return json({ error: 'Failed to create thread', detail: threadErr?.message }, 500)
    thread = newThread
  }

  const { error: msgErr } = await supabase.from('messages').insert({ creative_id: creativeId, thread_id: thread.id, sender_type: 'client', sender_name: clientName, sender_email: clientEmail, subject, body: message, read: false })
  if (msgErr) console.error('Message insert error:', msgErr.message)

  let portalToken = ''
  const { data: existingPortal } = await supabase.from('client_portals').select('portal_token').eq('creative_id', creativeId).eq('client_email', clientEmail).single()
  if (existingPortal) portalToken = existingPortal.portal_token
  else {
    const { data: newPortal } = await supabase.from('client_portals').insert({ creative_id: creativeId, client_name: clientName, client_email: clientEmail }).select().single()
    portalToken = newPortal?.portal_token || ''
  }
  const portalUrl = `https://lenstrybe.com/portal/${portalToken}`

  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', creativeId).single()
  const businessName = profile?.business_name || 'Your creative'
  const creativeEmailForNotif = profile?.business_email

  if (creativeEmailForNotif) {
    const panelHtml = panel(
      fieldRow('From', `${esc(clientName)} &middot; <a href="mailto:${esc(clientEmail)}" style="color:${BRAND.green};text-decoration:none;">${esc(clientEmail)}</a>`) +
      fieldRow('Subject', esc(subject)) +
      `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.faint};margin-bottom:3px;">Message</div><div style="font-size:14px;color:${BRAND.text};line-height:1.7;">${nl2br(message)}</div>`
    )
    await sendEmail(resendKey, {
      to: creativeEmailForNotif,
      replyTo: clientEmail,
      subject: `New enquiry from ${clientName}`,
      html: emailShell({ preheader: `${clientName} wants to work with you`, kicker: 'New enquiry', heading: `${esc(clientName)} wants to work with you`, intro: 'A new enquiry just landed in your inbox.', panelHtml, ctaText: 'Reply in your dashboard', ctaUrl: 'https://lenstrybe.com/dashboard/clients/messages', footNote: 'Tip: you can reply directly to this email and it will reach the client.' }),
    })
  }

  await sendEmail(resendKey, {
    to: clientEmail,
    replyTo: creativeEmailForNotif || undefined,
    subject: `Your enquiry to ${businessName} has been received`,
    html: emailShell({ preheader: `${businessName} has received your enquiry`, kicker: 'Enquiry received', heading: 'Your enquiry has been received', intro: `Hi ${esc(clientName)}, thanks for reaching out to <span style="color:${BRAND.text};">${esc(businessName)}</span>. They'll be in touch soon.`, panelHtml: panel(`<p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.7;">You can track your conversation and view anything ${esc(businessName)} shares with you through your personal client portal below.</p>`), ctaText: 'Open my portal', ctaUrl: portalUrl, footNote: 'Keep this email. It contains your unique portal link.' }),
  })

  return json({ success: true, thread_id: thread.id, portal_token: portalToken })
})
