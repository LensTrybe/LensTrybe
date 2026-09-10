import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const RESEND = Deno.env.get('RESEND_API_KEY') || ''
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function esc(s: unknown) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function str(v: unknown, max: number) { return typeof v === 'string' ? v.trim().slice(0, max) : '' }
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) }

// Public enquiry form on a creative's LensTrybe website (PublicSitePage). Anonymous.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
    if (typeof body.website === 'string' && body.website) return json({ ok: true }) // honeypot

    const creativeId = str(body.creativeId, 64)
    const name = plain(str(body.name, 120), 120)
    const email = str(body.email, 254).toLowerCase()
    const phone = plain(str(body.phone, 40), 40)
    const message = str(body.message, 5000)
    if (!UUID_RE.test(creativeId) || !name || !EMAIL_RE.test(email)) return json({ error: 'missing fields' }, 400)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    for (const [key, max] of [[`site-enquiry:ip:${ip}`, 10], [`site-enquiry:email:${email}`, 5], [`site-enquiry:creative:${creativeId}`, 50]] as [string, number][]) {
      const { data: allowed, error: rlErr } = await sb.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: 3600 })
      if (rlErr) { console.error('rate_limit_hit failed', rlErr); return json({ error: 'Please try again later.' }, 503) }
      if (allowed === false) return json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    // Look up the creative (name + email for notification). Only published websites accept enquiries.
    const { data: prof } = await sb.from('profiles').select('business_name, business_email')
      .eq('id', creativeId).eq('portfolio_website_active', true).maybeSingle()
    if (!prof) return json({ error: 'site not found' }, 404)

    // CRM lead: only ever INSERT a new contact. Anonymous input never edits an existing contact.
    try {
      const pattern = email.replace(/[\\%_]/g, (m) => `\\${m}`) // exact, case-insensitive match (no wildcards)
      const { data: found } = await sb.from('crm_contacts').select('id').eq('creative_id', creativeId).ilike('email', pattern).limit(1).maybeSingle()
      if (!found) {
        await sb.from('crm_contacts').insert({
          creative_id: creativeId,
          name,
          email,
          phone: phone || null,
          notes: message || null,
          status: 'Lead',
          tags: ['Website enquiry'],
          last_contacted_at: new Date().toISOString(),
        })
      }
    } catch (e) { console.error('crm capture failed', e) }

    // In-app notification for the creative (best effort).
    try {
      await sb.from('notifications').insert({
        user_id: creativeId,
        type: 'enquiry',
        title: `New website enquiry from ${name}`,
        body: message ? message.slice(0, 140) : null,
        link: '/dashboard/clients/crm',
        meta: { source: 'website' },
      })
    } catch { /* ignore */ }

    // Email the creative (reply-to goes straight to the enquirer).
    if (RESEND && prof.business_email) {
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:#1DB954;letter-spacing:-0.02em;">LensTrybe</div></td></tr>
        <tr><td style="padding:22px 36px 8px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#1DB954;margin-bottom:10px;">New website enquiry</div>
        <h1 style="margin:0 0 10px;font-size:23px;line-height:1.25;font-weight:800;color:#ffffff;">${esc(name)} got in touch</h1>
        <p style="margin:0;color:#9a9aa8;font-size:15px;line-height:1.6;">Someone enquired through your LensTrybe website. They've been added to your CRM.</p>
        </td></tr>
        <tr><td style="padding:18px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b1b26;border:1px solid rgba(255,255,255,0.08);border-radius:12px;"><tr><td style="padding:18px 20px;">
        <div style="font-size:14px;color:#ffffff;margin-bottom:6px;"><strong>Email:</strong> <a href="mailto:${esc(email)}" style="color:#1DB954;text-decoration:none;">${esc(email)}</a></div>
        ${phone ? `<div style="font-size:14px;color:#ffffff;margin-bottom:6px;"><strong>Phone:</strong> ${esc(phone)}</div>` : ''}
        ${message ? `<div style="font-size:14px;color:#e6e6ea;line-height:1.7;"><strong>Message:</strong> ${esc(message)}</div>` : ''}
        </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#1DB954;"><a href="https://lenstrybe.com/dashboard/clients/crm" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">Open your CRM</a></td></tr></table></td></tr>
        <tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;"><div style="font-size:13px;font-weight:700;color:#ffffff;">LensTrybe</div><div style="font-size:12px;color:#6a6a78;margin-top:2px;">Connect. Capture. Create.</div></div></td></tr>
        </table></td></tr></table></body></html>`
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'LensTrybe <noreply@mail.lenstrybe.com>', to: [prof.business_email], reply_to: email, subject: plain(`New website enquiry from ${name}`, 150), html }),
        })
      } catch { /* best effort */ }
    }
    return json({ ok: true })
  } catch (e) {
    console.error('site-enquiry error', e)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
