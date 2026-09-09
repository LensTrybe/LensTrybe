import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const payload = await req.json()
    const user = payload?.record || payload?.user || payload
    const email = user?.email || payload?.email
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || payload?.name || email?.split('@')[0] || 'there'
    // Role: explicit param wins, else infer from signup metadata.
    const role = (payload?.role || user?.user_metadata?.account_kind || user?.user_metadata?.account_type || 'creative').toString().toLowerCase()
    const isClient = role === 'client'
    const isFounding = !isClient && (payload?.founding === true || payload?.founding === 'true' || user?.user_metadata?.founding === true)

    if (!email) return new Response(JSON.stringify({ error: 'No email found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
        ctaUrl: 'https://app.lenstrybe.com/dashboard/founding',
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
        ctaUrl: 'https://app.lenstrybe.com/creatives',
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
        ctaUrl: 'https://app.lenstrybe.com/dashboard',
        footNote: 'Questions? Just reply to this email and we\'ll help.',
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: email, subject, html }),
    })
    const data = await res.json()
    return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
