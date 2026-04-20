import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
}

function buildContractEmailHtml(params: {
  businessName: string
  contractTitle: string
  clientName: string
  signingToken: string
}): string {
  const { businessName, contractTitle, clientName, signingToken } = params
  const signUrl = `https://lenstrybe.com/sign/${encodeURIComponent(signingToken)}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:28px 28px 10px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">${escapeHtml(
                businessName,
              )} CONTRACT</p>
              <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#18181b;">${escapeHtml(
                contractTitle,
              )}</h1>
              <p style="margin:10px 0 0;font-size:14px;color:#52525b;">Please review and sign the contract below</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px;">
              <p style="margin:0;font-size:14px;color:#52525b;">Hello${clientName ? ` ${escapeHtml(clientName)}` : ''},</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" bgcolor="#4f46e5" style="border-radius:10px;">
                    <a href="${escapeHtml(signUrl)}"
                      style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Review &amp; Sign Contract
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e5e7eb;background-color:#fafafa;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">Sent via LensTrybe</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : ''
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
  const replyTo = typeof body.replyTo === 'string' ? body.replyTo.trim() : ''
  const contractTitle = typeof body.contractTitle === 'string' ? body.contractTitle.trim() : ''
  // Contract content may be useful for future email rendering, but not required for this email format.
  const contractContent = typeof body.contractContent === 'string' ? body.contractContent : ''
  const signingToken =
    typeof body.signingToken === 'string' ? body.signingToken.trim() : ''

  if (!to || !to.includes('@')) return jsonResponse({ error: 'Valid "to" email is required' }, 400)
  if (!replyTo || !replyTo.includes('@'))
    return jsonResponse({ error: 'Valid "replyTo" email is required' }, 400)
  if (!businessName) return jsonResponse({ error: 'businessName is required' }, 400)
  if (!contractTitle) return jsonResponse({ error: 'contractTitle is required' }, 400)
  if (!signingToken) return jsonResponse({ error: 'signingToken is required' }, 400)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return jsonResponse({ error: 'Email service is not configured' }, 500)
  }

  const html = buildContractEmailHtml({
    businessName,
    contractTitle,
    clientName,
    signingToken,
  })

  const subject = `${businessName} has sent you a contract to sign`

  const resendPayload: Record<string, unknown> = {
    from: 'LensTrybe <noreply@lenstrybe.com>',
    to: [to],
    reply_to: replyTo,
    subject,
    html,
  }

  let resendRes: Response
  try {
    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to reach email provider'
    return jsonResponse({ error: message }, 502)
  }

  const resendText = await resendRes.text()
  let resendJson: { message?: string } | null = null
  try {
    resendJson = resendText ? JSON.parse(resendText) : null
  } catch {
    resendJson = null
  }

  if (!resendRes.ok) {
    const message = (resendJson && resendJson.message) || resendText || 'Resend API request failed'
    return jsonResponse({ error: message }, 502)
  }

  return jsonResponse({ success: true }, 200)
})

