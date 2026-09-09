import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { to, client_name, creative_name, portal_url } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#080810;color:#fff;padding:40px 32px;border-radius:12px">
        <div style="margin-bottom:24px"><span style="font-size:22px;font-weight:700;color:#1DB954">LensTrybe</span></div>
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">Your client portal is ready</h2>
        <p style="color:#888;font-size:14px;margin:0 0 24px">
          Hi ${client_name}, <strong style="color:#fff">${creative_name}</strong> has created a project portal for you. Use the link below to view your project details, messages, files and more.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${portal_url}" style="display:inline-block;background:#1DB954;color:#000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
            Open My Portal
          </a>
        </div>
        <p style="color:#666;font-size:12px;margin-top:8px;text-align:center">Or copy this link: <a href="${portal_url}" style="color:#1DB954">${portal_url}</a></p>
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
        to: [to],
        subject: `${creative_name} has shared a project portal with you`,
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
