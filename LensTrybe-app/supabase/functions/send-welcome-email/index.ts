import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
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
function featureRow(emoji: string, title: string, sub: string) {
  return `<div style="margin:0 0 14px;"><div style="font-size:14px;font-weight:700;color:${BRAND.text};">${emoji} ${esc(title)}</div><div style="font-size:12px;color:${BRAND.muted};margin-top:2px;line-height:1.5;">${esc(sub)}</div></div>`
}
function subhead(t: string) { return `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${BRAND.faint};margin:0 0 14px;">${esc(t)}</div>` }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:20px 22px;">${innerHtml}</td></tr></table>` }
// ---- end shared ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function jres(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }

// Welcome email, sent once per account and only ever to the account's own address.
// Callers: a signed-in user (Authorization bearer token), or the signup page straight after
// supabase.auth.signUp (email confirmation is on, so there is no session yet) passing { user_id }
// of the account it just created. In that case the account must be less than 30 minutes old.
// The founding variant is chosen from profiles.founding_member, never from the request.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jres({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const payload = await req.json().catch(() => ({})) as Record<string, any>

    // deno-lint-ignore no-explicit-any
    let user: any = null
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (token) {
      const { data } = await admin.auth.getUser(token)
      user = data?.user || null
    }
    if (!user) {
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
      const { data: allowed, error: rlErr } = await admin.rpc('rate_limit_hit', { p_key: `welcome:ip:${ip}`, p_max: 10, p_window_seconds: 3600 })
      if (rlErr || allowed === false) return jres({ error: 'Too many requests' }, 429)
      const uid = typeof payload.user_id === 'string' ? payload.user_id : ''
      if (!UUID_RE.test(uid)) return jres({ error: 'Unauthorised' }, 401)
      const { data } = await admin.auth.admin.getUserById(uid)
      const u = data?.user
      if (!u || Date.now() - new Date(u.created_at).getTime() > 30 * 60 * 1000) return jres({ success: true, skipped: true })
      user = u
    }

    const email: string | undefined = user.email
    if (!email) return jres({ error: 'No email found' }, 400)

    // Send once only.
    const { data: claimed, error: claimErr } = await admin.from('welcome_emails')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true }).select('user_id')
    if (claimErr) { console.error('welcome claim failed', claimErr); return jres({ error: 'Could not send welcome email' }, 500) }
    if (!claimed || claimed.length === 0) return jres({ success: true, skipped: 'already_sent' })

    const meta = (user.user_metadata || {}) as Record<string, any>
    const { data: prof } = await admin.from('profiles').select('business_name, founding_member').eq('id', user.id).maybeSingle()
    const { data: clientRow } = prof ? { data: null } : await admin.from('client_accounts').select('id').eq('id', user.id).maybeSingle()
    const metaRole = String(meta.account_kind || meta.account_type || '').toLowerCase()
    const isClient = !prof && (metaRole === 'client' || !!clientRow || payload?.role === 'client')
    const isFounding = !isClient && prof?.founding_member === true
    const bodyName = payload?.name || payload?.record?.user_metadata?.full_name
    const name = plain(
      meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || prof?.business_name || meta.business_name || bodyName || email.split('@')[0] || 'there',
      80,
    ) || 'there'

    let html: string
    let subject: string
    if (isFounding) {
      subject = "You're a LensTrybe founding creative"
      html = emailShell({
        preheader: "Welcome, founding creative - here's exactly what to do next",
        kicker: 'Founding creative',
        heading: `Welcome, ${esc(name)}. You're a founding creative.`,
        intro: "You've been hand-picked as one of the first creatives on LensTrybe. Here's what you get, and the three simple things we ask in return to keep your founding deal.",
        panelHtml: panel(
          subhead('What you get') +
          featureRow('&#127775;', '12 months free Expert', 'The full Expert plan free for 12 months, then $49/mo locked in for life.') +
          featureRow('&#128081;', 'A permanent founding badge', 'Shown on your profile so clients know you were one of the originals.') +
          featureRow('&#128176;', 'Zero commission, always', 'Keep 100% of what you earn.') +
          subhead('What we ask, to keep your deal') +
          featureRow('&#9989;', 'Complete your profile in 7 days', 'Get your listing to 100% so clients see a finished, credible profile.') +
          featureRow('&#128188;', 'Run your next 3 real jobs through LensTrybe', 'Send a quote, have the client accept it, then invoice and mark it paid.') +
          featureRow('&#128172;', 'Share one piece of feedback a month', 'Tell us what to build next, right from your Founding Hub.')
        ),
        ctaText: 'Open your Founding Hub',
        ctaUrl: 'https://lenstrybe.com/dashboard/founding',
        footNote: "Track all three at any time in your Founding Hub. Questions? Just reply to this email and we'll help.",
      })
    } else if (isClient) {
      subject = 'Welcome to LensTrybe!'
      html = emailShell({
        preheader: 'Welcome to LensTrybe - find and book Australia\'s best creatives',
        kicker: 'Welcome',
        heading: `Welcome, ${esc(name)}!`,
        intro: 'You\'ve just joined LensTrybe, the home of Australia\'s best photographers, videographers and visual creatives.',
        panelHtml: panel(
          subhead('Here\'s what you can do') +
          featureRow('&#128269;', 'Discover creatives', 'Browse portfolios and find the right creative for your shoot') +
          featureRow('&#128172;', 'Enquire and message', 'Reach out directly and chat with creatives in one place') +
          featureRow('&#128193;', 'Your client portal', 'Track conversations, quotes, contracts and delivered files')
        ),
        ctaText: 'Find a creative',
        ctaUrl: 'https://lenstrybe.com/creatives',
        footNote: 'Questions? Just reply to this email and we\'ll help.',
      })
    } else {
      subject = 'Welcome to LensTrybe!'
      html = emailShell({
        preheader: 'Welcome to LensTrybe - your creative business, all in one place',
        kicker: 'Welcome',
        heading: `Welcome, ${esc(name)}!`,
        intro: 'You\'ve just joined LensTrybe, the platform built to help Australian creatives run their business, showcase their work, and connect with clients.',
        panelHtml: panel(
          subhead('Here\'s what you can do') +
          featureRow('&#128248;', 'Your portfolio website', 'Showcase your work with a stunning branded profile site') +
          featureRow('&#128176;', 'Invoicing and quotes', 'Send professional invoices and quotes to clients') +
          featureRow('&#128221;', 'Contracts', 'Create and send contracts for e-signature') +
          featureRow('&#128172;', 'Client messaging', 'Two-way messaging with your clients and other creatives') +
          featureRow('&#128230;', 'File delivery', 'Deliver photos and files with secure download links')
        ),
        ctaText: 'Go to your dashboard',
        ctaUrl: 'https://lenstrybe.com/dashboard',
        footNote: 'Questions? Just reply to this email and we\'ll help.',
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: email, subject, html }),
    })
    if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
    return jres({ success: true })
  } catch (err) {
    console.error('send-welcome-email error', err)
    return jres({ error: 'Could not send welcome email' }, 500)
  }
})
