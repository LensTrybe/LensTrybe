import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
const RESEND = Deno.env.get('RESEND_API_KEY') || ''
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function esc(s: unknown) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { creativeId, name, email, phone, message } = await req.json()
    if (!creativeId || !name || !email) return json({ error: 'missing fields' }, 400)

    // Look up the creative (name + email for notification).
    const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${creativeId}&select=business_name,business_email&portfolio_website_active=is.true`, { headers: H })
    const prof = (await pr.json())[0]
    if (!prof) return json({ error: 'site not found' }, 404)

    // Create / update the CRM lead (dedupe by email; best effort, never block the enquiry).
    try {
      const enc = encodeURIComponent(email)
      const ex = await fetch(`${URL}/rest/v1/crm_contacts?creative_id=eq.${creativeId}&email=ilike.${enc}&select=id&limit=1`, { headers: H })
      const found = (await ex.json())[0]
      if (found?.id) {
        await fetch(`${URL}/rest/v1/crm_contacts?id=eq.${found.id}`, {
          method: 'PATCH', headers: H,
          body: JSON.stringify({ last_contacted_at: new Date().toISOString(), phone: phone || undefined }),
        })
      } else {
        await fetch(`${URL}/rest/v1/crm_contacts`, {
          method: 'POST', headers: H,
          body: JSON.stringify({
            creative_id: creativeId,
            name,
            email,
            phone: phone || null,
            notes: message || null,
            status: 'Lead',
            tags: ['Website enquiry'],
            last_contacted_at: new Date().toISOString(),
          }),
        })
      }
    } catch { /* ignore CRM failure */ }

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
        <tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#1DB954;"><a href="https://app.lenstrybe.com/dashboard/clients/crm" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">Open your CRM</a></td></tr></table></td></tr>
        <tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;"><div style="font-size:13px;font-weight:700;color:#ffffff;">LensTrybe</div><div style="font-size:12px;color:#6a6a78;margin-top:2px;">Connect. Capture. Create.</div></div></td></tr>
        </table></td></tr></table></body></html>`
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'LensTrybe <noreply@mail.lenstrybe.com>', to: [prof.business_email], reply_to: email, subject: `New website enquiry from ${name}`, html }),
        })
      } catch { /* best effort */ }
    }
    return json({ ok: true })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
