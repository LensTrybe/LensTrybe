import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const SUPPORT_TO = 'support@lenstrybe.com'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }
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
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch (_e) { /* best effort */ }
}
// ---- end shared ----

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }

  const name = typeof body.name === 'string' ? plain(body.name, 120) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : ''
  const role = typeof body.role === 'string' ? plain(body.role, 40) : ''
  const category = typeof body.category === 'string' ? plain(body.category, 60) : ''
  const subject = typeof body.subject === 'string' ? plain(body.subject, 160) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''

  if (!/^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400)
  if (!message) return json({ error: 'Please describe your issue.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // user_id comes only from a verified session token, never from the request body.
  let userId: string | null = null
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token)
      userId = data?.user?.id || null
    } catch (_e) { userId = null }
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  for (const key of [`support:ip:${ip}`, `support:email:${email}`]) {
    const { data: allowed, error: rlErr } = await supabase.rpc('rate_limit_hit', { p_key: key, p_max: 5, p_window_seconds: 3600 })
    if (rlErr) { console.error('rate_limit_hit failed', rlErr); return json({ error: 'Could not submit your request. Please try again later.' }, 503) }
    if (allowed === false) return json({ error: 'Too many requests. Please try again later.' }, 429)
  }

  const { data: inserted, error: insErr } = await supabase.from('support_tickets').insert({
    user_id: userId, name: name || null, email, role: role || null,
    category: category || null, subject: subject || null, message, status: 'open',
  }).select('id').single()
  if (insErr) { console.error('support ticket insert failed', insErr); return json({ error: 'Could not submit your request. Please try again.' }, 500) }

  const ref = String(inserted?.id || '').slice(0, 8).toUpperCase()
  const who = [name, email].filter(Boolean).join(' · ')

  // Notify the LensTrybe support inbox (reply-to goes straight to the person).
  await sendEmail(resendKey, {
    to: SUPPORT_TO,
    replyTo: email,
    subject: `New support request${category ? ` [${category}]` : ''}: ${subject || 'No subject'}`,
    html: emailShell({
      preheader: `${name || email} needs a hand`,
      kicker: 'New support request',
      heading: esc(subject || 'New support request'),
      intro: 'A new support request just came in through LensTrybe.',
      panelHtml: panel(
        fieldRow('From', `${esc(who)}`) +
        (role ? fieldRow('Account type', esc(role)) : '') +
        (category ? fieldRow('Category', esc(category)) : '') +
        fieldRow('Reference', `#${esc(ref)}`) +
        `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.faint};margin-bottom:3px;">Message</div><div style="font-size:14px;color:${BRAND.text};line-height:1.7;">${nl2br(message)}</div>`
      ),
      ctaText: 'Open the support inbox',
      ctaUrl: 'https://lenstrybe.com/dashboard/admin',
      footNote: 'Reply directly to this email to respond to the person who raised it.',
    }),
  })

  // Confirmation to the person who raised it: fixed text with the reference number only.
  await sendEmail(resendKey, {
    to: email,
    replyTo: SUPPORT_TO,
    subject: `We've got your request${ref ? ` (#${ref})` : ''}`,
    html: emailShell({
      preheader: 'Thanks for reaching out to LensTrybe support',
      kicker: 'Support request received',
      heading: "Thanks. We're on it.",
      intro: "We've received your request and someone from the team will get back to you as soon as we can, usually within one business day.",
      panelHtml: panel(fieldRow('Reference', `#${esc(ref)}`)),
      footNote: "You can reply straight to this email if you need to add anything. If you didn't contact LensTrybe support, you can ignore this email.",
    }),
  })

  return json({ ok: true, id: inserted?.id, ref })
})
