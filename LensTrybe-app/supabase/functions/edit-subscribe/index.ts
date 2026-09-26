import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

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
<tr><td style="padding:32px 36px 0;"><a href="https://lenstrybe.com" style="display:inline-block;text-decoration:none;"><img src="https://lenstrybe.com/email-logo-white.png" width="180" height="38" alt="LensTrybe" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:38px;" /></a></td></tr>
<tr><td style="padding:22px 36px 8px;">
${kicker ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(kicker)}</div>` : ''}
<h1 style="margin:0 0 ${intro ? '10px' : '4px'};font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${heading}</h1>
${intro ? `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${intro}</p>` : ''}
</td></tr>
${panelHtml ? `<tr><td style="padding:18px 36px 0;">${panelHtml}</td></tr>` : ''}
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td></tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:12px;font-weight:400;letter-spacing:0.24em;color:${BRAND.text};">LENSTRYBE</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}
// ---- end shared ----

// The Trybe Edit sign-up from the public pages. Double opt-in: the form only sends a confirm
// link, and the address joins the list when that link is opened. Nobody can sign up someone
// else, and the answer is the same whether or not the address is already on the list.
//   { action: 'subscribe', email }  -> emails a confirm link
//   { action: 'confirm', token }    -> joins the list (source 'edit', edit_opt_in_at set)
const SITES = ['https://lenstrybe.com', 'https://www.lenstrybe.com', 'https://next.lenstrybe.com']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DONE = { ok: true, message: 'Check your inbox and tap the link to confirm.' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
    const action = String(body.action || '')
    const now = new Date().toISOString()

    if (action === 'confirm') {
      const token = String(body.token || '')
      if (!UUID_RE.test(token)) return json({ error: 'That link has expired. Subscribe again and we will send a new one.' }, 400)
      const { data: row } = await admin.from('email_subscribers').select('id, edit_confirm_sent_at').eq('edit_confirm_token', token).maybeSingle()
      const fresh = row?.edit_confirm_sent_at && Date.now() - new Date(row.edit_confirm_sent_at).getTime() < 7 * 86400000
      if (!row || !fresh) return json({ error: 'That link has expired. Subscribe again and we will send a new one.' }, 400)
      const { error } = await admin.from('email_subscribers').update({ status: 'subscribed', source: 'edit', consented_at: now, unsubscribed_at: null, edit_opt_in_at: now, edit_confirm_token: null, updated_at: now }).eq('id', row.id)
      if (error) { console.error('confirm failed', error); return json({ error: 'Something went wrong. Try the link again.' }, 500) }
      return json({ ok: true })
    }

    if (action !== 'subscribe') return json({ error: 'Unknown action' }, 400)
    const email = String(body.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'That email address doesn\'t look right.' }, 400)

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    for (const [key, max, win] of [[`edit-sub-ip:${ip}`, 8, 3600], [`edit-sub-email:${email}`, 3, 86400]] as const) {
      const { data: allowed, error } = await admin.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: win })
      if (error) { console.error('rate_limit_hit failed', error); return json({ error: 'Please try again later.' }, 503) }
      if (allowed === false) return json(DONE)
    }

    const pattern = email.replace(/[\\%_]/g, (c) => '\\' + c)
    const { data: found } = await admin.from('email_subscribers').select('id, status, edit_opt_in_at').ilike('email', pattern).limit(1)
    const row = found?.[0]
    if (row && row.status === 'subscribed' && row.edit_opt_in_at) return json(DONE)

    const token = crypto.randomUUID()
    if (row) {
      const { error } = await admin.from('email_subscribers').update({ edit_confirm_token: token, edit_confirm_sent_at: now, updated_at: now }).eq('id', row.id)
      if (error) { console.error('token update failed', error); return json({ error: 'Something went wrong. Please try again.' }, 500) }
    } else {
      const { error } = await admin.from('email_subscribers').insert({ email, status: 'pending', source: 'edit-pending', edit_confirm_token: token, edit_confirm_sent_at: now })
      if (error) { console.error('insert failed', error); return json({ error: 'Something went wrong. Please try again.' }, 500) }
    }

    const origin = req.headers.get('origin') || ''
    const site = SITES.includes(origin) ? origin : 'https://lenstrybe.com'
    const link = `${site}/edit/confirm?t=${token}`
    const resendKey = Deno.env.get('RESEND_API_KEY') || ''
    if (!resendKey) return json({ error: 'Please try again later.' }, 503)
    const html = emailShell({
      preheader: 'One tap to confirm your subscription', kicker: 'The Trybe Edit', heading: 'Confirm your subscription',
      intro: 'Tap below and The Trybe Edit lands in your inbox on the 1st of each month. One email a month, and you can unsubscribe any time.',
      ctaText: 'Yes, subscribe me', ctaUrl: link,
      footNote: "If you didn't ask for this, ignore this email and you won't hear from us.",
    })
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [email], subject: 'Confirm your subscription to The Trybe Edit', html }) })
    if (!r.ok) { console.error('resend failed', r.status, await r.text().catch(() => '')); return json({ error: 'We could not send the email. Please try again.' }, 502) }
    return json(DONE)
  } catch (err) {
    console.error('edit-subscribe error', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
