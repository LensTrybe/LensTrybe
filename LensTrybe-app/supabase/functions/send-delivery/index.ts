import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { delivery, profile } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const deliveryUrl = `https://app.lenstrybe.com/deliver/${delivery.download_token}`

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#080810;color:#fff;padding:40px 32px;border-radius:12px">
        <div style="margin-bottom:24px"><span style="font-size:22px;font-weight:700;color:#1DB954">LensTrybe</span></div>
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">Your files are ready</h2>
        <p style="color:#888;font-size:14px;margin:0 0 24px">
          <strong style="color:#fff">${profile?.business_name ?? 'Your creative'}</strong> has delivered your files for <strong style="color:#fff">${delivery.title ?? 'your project'}</strong>.
        </p>
        ${delivery.notes ? `<div style="background:#13131f;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 20px;margin-bottom:24px"><p style="color:#ccc;font-size:14px;margin:0;line-height:1.6">${delivery.notes}</p></div>` : ''}
        <div style="text-align:center;margin:32px 0">
          <a href="${deliveryUrl}" style="display:inline-block;background:#1DB954;color:#000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
            View & Download Files
          </a>
        </div>
        <p style="color:#666;font-size:12px;margin-top:8px;text-align:center">Or copy this link: <a href="${deliveryUrl}" style="color:#1DB954">${deliveryUrl}</a></p>
        ${delivery.password_protected ? `<p style="color:#888;font-size:13px;text-align:center;margin-top:16px">This gallery is password protected. Your creative will send you the password separately.</p>` : ''}
        <p style="color:#555;font-size:12px;margin-top:32px">Sent via LensTrybe · <a href="https://app.lenstrybe.com" style="color:#1DB954">app.lenstrybe.com</a></p>
      </div>
    `

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
