import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { delivery, profile } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const deliveryUrl = `https://lenstrybe.com/deliver/${delivery.download_token}`
    const business = esc(profile?.business_name ?? 'Your creative')
    const title = esc(delivery.title ?? 'your project')
    const clientName = esc(delivery.client_name ?? 'there')
    const message = delivery.message ?? delivery.notes ?? ''
    const isProtected = Boolean(delivery.password_protected || delivery.password)
    const fileCount = Array.isArray(delivery.files) ? delivery.files.length : null
    const fileLine = fileCount != null && fileCount > 0 ? `${fileCount} file${fileCount === 1 ? '' : 's'} ready to view and download.` : 'Your files are ready to view and download.'

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0a0a0f;font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">
  <tr><td style="padding:32px 36px 0;"><div style="font-size:21px;font-weight:800;letter-spacing:-0.02em;color:${GREEN};">LensTrybe</div></td></tr>
  <tr><td style="padding:22px 36px 8px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${GREEN};margin-bottom:12px;">Your gallery is ready</div>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;line-height:1.25;">Hi ${clientName}, your files are ready</h1>
    <p style="margin:0 0 6px;color:#9a9aa8;font-size:15px;line-height:1.65;"><strong style="color:#ffffff;">${business}</strong> has delivered <strong style="color:#ffffff;">${title}</strong>.</p>
    <p style="margin:0;color:#9a9aa8;font-size:15px;line-height:1.65;">${fileLine}</p>
  </td></tr>
  ${message ? `<tr><td style="padding:18px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f16;border:1px solid rgba(255,255,255,0.07);border-radius:12px;"><tr><td style="padding:16px 18px;color:#c9c9d4;font-size:14px;line-height:1.6;">${esc(message)}</td></tr></table></td></tr>` : ''}
  <tr><td style="padding:26px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${GREEN};"><a href="${deliveryUrl}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:${GREEN_DARK};text-decoration:none;">View &amp; download your files</a></td></tr></table></td></tr>
  <tr><td style="padding:16px 36px 0;"><p style="margin:0;color:#6a6a78;font-size:12.5px;line-height:1.6;">Or copy this link:<br><a href="${deliveryUrl}" style="color:${GREEN};word-break:break-all;">${deliveryUrl}</a></p></td></tr>
  ${isProtected ? `<tr><td style="padding:16px 36px 0;"><p style="margin:0;color:#9a9aa8;font-size:13px;line-height:1.6;">🔒 This gallery is password protected. ${business} will send you the password separately.</p></td></tr>` : ''}
  <tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:12px;color:#6a6a78;">Delivered via LensTrybe &middot; <a href="https://lenstrybe.com" style="color:${GREEN};text-decoration:none;">lenstrybe.com</a><br>Connect. Capture. Create.</div></td></tr>
</table>
</td></tr></table>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LensTrybe <noreply@mail.lenstrybe.com>',
        to: [delivery.client_email],
        reply_to: profile?.business_email || 'connect@lenstrybe.com',
        subject: `Your files are ready from ${profile?.business_name ?? 'your creative'}`,
        html,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
