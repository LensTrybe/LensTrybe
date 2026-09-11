import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', pink: '#FF2D78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe Billing <noreply@mail.lenstrybe.com>'
const REPLY_TO = 'billing@lenstrybe.com'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
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

const SUB_URL = 'https://lenstrybe.com/dashboard/settings/subscription'
function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
function tierLabel(t: unknown) { const s = String(t || '').toLowerCase(); if (!s || s === 'basic') return 'LensTrybe'; return 'LensTrybe ' + s.charAt(0).toUpperCase() + s.slice(1) }
function money(minor: unknown, currency: unknown) {
  const n = Number(minor); if (!Number.isFinite(n)) return ''
  const cur = String(currency || 'AUD').toUpperCase()
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur }).format(n / 100) } catch { return `${(n / 100).toFixed(2)} ${cur}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !serviceKey || !resendKey) {
    console.error('send-billing-email: missing env')
    return json({ error: 'Not configured' }, 500)
  }

  // Internal only: called by the billing Edge Functions with the service role key.
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!safeEqual(bearer, serviceKey)) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const userId = (body.user_id || body.userId) as string
  const kind = String(body.kind || '').toLowerCase() // 'active' | 'failed' | 'cancelled' | 'downgraded'
  const tier = tierLabel(body.tier)
  const amountStr = money(body.amount_minor ?? body.amount, body.currency)
  if (!userId || !kind) return json({ error: 'user_id and kind required' }, 400)

  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', userId).single()
  const to = profile?.business_email
  if (!to) return json({ error: 'no creative email', skipped: true }, 200)
  const name = profile?.business_name || 'there'

  let subject = '', kicker = '', heading = '', intro = '', ctaText = 'Manage subscription', footNote = ''
  if (kind === 'active') {
    subject = `You're on ${tier}`
    kicker = 'Subscription active'
    heading = `You're on ${esc(tier)}`
    intro = `Hi ${esc(name)}, your subscription is active. Thanks for being part of LensTrybe.`
    footNote = 'You can view or change your plan any time from your dashboard.'
  } else if (kind === 'failed') {
    subject = 'Your LensTrybe payment did not go through'
    kicker = 'Action needed'
    heading = 'Your payment did not go through'
    intro = `Hi ${esc(name)}, we could not process your latest ${esc(tier)} payment. Please update your card so you don't lose access to your features.`
    ctaText = 'Update payment details'
    footNote = "Updating your card now is the fastest fix. We'll also retry automatically each day for up to 7 days, after which your account moves to the free Basic plan."
  } else if (kind === 'cancelled') {
    subject = 'Your LensTrybe subscription has been cancelled'
    kicker = 'Subscription cancelled'
    heading = 'Your subscription has been cancelled'
    intro = `Hi ${esc(name)}, your ${esc(tier)} subscription has been cancelled. You'll keep access until the end of your current billing period, then move to the free Basic plan.`
    ctaText = 'Resubscribe'
    footNote = 'Changed your mind? You can pick a plan again any time.'
  } else if (kind === 'downgraded') {
    subject = 'Your LensTrybe plan has moved to Basic'
    kicker = 'Plan changed'
    heading = 'Your plan has moved to Basic'
    intro = `Hi ${esc(name)}, we tried a few times but could not collect your ${esc(tier)} payment, so your account is now on the free Basic plan. Your profile and work are safe.`
    ctaText = 'Choose a plan'
    footNote = 'You can pick a paid plan again any time to get your features back.'
  } else {
    return json({ error: 'unknown kind' }, 400)
  }

  const panelHtml = amountStr
    ? panel(fieldRow('Plan', esc(tier)) + fieldRow('Amount', esc(amountStr)))
    : panel(fieldRow('Plan', esc(tier)))

  const billingFootNote = `${footNote} Questions about your subscription? Just reply to this email and the LensTrybe team will help.`
  await sendEmail(resendKey, { to, subject, html: emailShell({ preheader: subject, kicker, heading, intro, panelHtml, ctaText, ctaUrl: kind === 'failed' ? `${SUB_URL}?card=update` : SUB_URL, footNote: billingFootNote }), replyTo: REPLY_TO })
  return json({ success: true })
})
