import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
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
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:13px;font-weight:700;color:${BRAND.text};">LensTrybe</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://app.lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">app.lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
function money(v: unknown) { const n = Number(v); if (!Number.isFinite(n)) return ''; try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n) } catch { return `$${n}` } }
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

  const quoteId = (body.quote_id || body.quoteId) as string
  const portalToken = (body.portal_token || body.portalToken) as string
  const action = String(body.action || '').toLowerCase()
  if (!quoteId || !portalToken) return json({ error: 'quote_id and portal_token required' }, 400)
  if (action !== 'accept' && action !== 'decline') return json({ error: 'action must be accept or decline' }, 400)

  // Authenticate via the portal token: it maps to a client + creative.
  const { data: portal } = await supabase.from('client_portals').select('creative_id, client_email, client_name').eq('portal_token', portalToken).maybeSingle()
  if (!portal) return json({ error: 'Invalid portal' }, 403)

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle()
  if (!quote) return json({ error: 'Quote not found' }, 404)

  // The quote must belong to this portal's client + creative.
  if (quote.creative_id !== portal.creative_id || (quote.client_email || '').toLowerCase() !== (portal.client_email || '').toLowerCase()) {
    return json({ error: 'This quote does not belong to your portal' }, 403)
  }

  // Only respond to a quote that is still open.
  const current = String(quote.status || '').toLowerCase()
  if (current === 'accepted' || current === 'declined') return json({ error: 'This quote has already been responded to', status: current }, 409)

  const newStatus = action === 'accept' ? 'accepted' : 'declined'
  const { error: upErr } = await supabase.from('quotes').update({ status: newStatus }).eq('id', quoteId)
  if (upErr) return json({ error: upErr.message }, 500)

  // Notify the creative.
  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', quote.creative_id).single()
  const creativeEmail = profile?.business_email
  const clientName = portal.client_name || quote.client_name || 'Your client'
  const accepted = newStatus === 'accepted'
  if (creativeEmail) {
    const panelHtml = panel(
      fieldRow('Quote', `#${esc(String(quoteId).slice(0, 8).toUpperCase())}`) +
      (quote.amount != null ? fieldRow('Amount', esc(money(quote.amount))) : '') +
      fieldRow('Response', `<span style="color:${accepted ? BRAND.green : BRAND.text};text-transform:capitalize;">${esc(newStatus)}</span>`)
    )
    await sendEmail(resendKey, {
      to: creativeEmail,
      replyTo: portal.client_email || undefined,
      subject: accepted ? `${clientName} accepted your quote` : `${clientName} declined your quote`,
      html: emailShell({
        preheader: accepted ? `${clientName} accepted your quote` : `${clientName} declined your quote`,
        kicker: accepted ? 'Quote accepted' : 'Quote declined',
        heading: accepted ? `${esc(clientName)} accepted your quote` : `${esc(clientName)} declined your quote`,
        intro: accepted ? 'Nice work. You can move ahead when you are ready.' : `${esc(clientName)} has declined this quote. You may want to follow up with them.`,
        panelHtml,
        ctaText: 'View in your dashboard',
        ctaUrl: 'https://app.lenstrybe.com/dashboard/finance/quotes',
        footNote: 'Tip: you can reply directly to this email to reach the client.',
      }),
    })
  }

  return json({ success: true, status: newStatus })
})
