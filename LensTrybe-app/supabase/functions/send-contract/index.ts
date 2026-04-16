import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { contract, profile } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    let attachments: any[] = []
    let downloadSection = ''

    if (contract.contract_type === 'uploaded' && contract.contract_file_url) {
      // For uploaded contracts — include download link in email body
      downloadSection = `
        <div style="text-align:center;margin:32px 0">
          <a href="${contract.contract_file_url}" style="display:inline-block;background:#1DB954;color:#000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
            Download Contract
          </a>
        </div>
      `
    } else {
      // Written contract — generate HTML attachment same as invoices
      const contractHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Contract</title></head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:48px;color:#111">
  <table width="100%" style="margin-bottom:40px">
    <tr>
      <td>
        <div style="font-size:26px;font-weight:800;color:#111;margin-bottom:4px">${profile?.business_name ?? 'Creative'}</div>
        <div style="font-size:13px;color:#666">${profile?.business_email ?? ''}</div>
      </td>
      <td style="text-align:right">
        <div style="font-size:30px;font-weight:800;color:#111">CONTRACT</div>
        <div style="font-size:13px;color:#666">#${contract.id.slice(0, 8).toUpperCase()}</div>
        <div style="font-size:13px;color:#666">${new Date(contract.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </td>
    </tr>
  </table>

  <div style="margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Between</div>
    <div style="font-size:15px;font-weight:600">${profile?.business_name}</div>
    <div style="font-size:13px;color:#666;margin-top:8px">and</div>
    <div style="font-size:15px;font-weight:600;margin-top:8px">${contract.client_name}</div>
    <div style="font-size:13px;color:#666">${contract.client_email}</div>
  </div>

  ${contract.project_name ? `
  <div style="margin-bottom:24px;padding:12px 16px;background:#f9fafb;border-radius:8px">
    <span style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em">Project: </span>
    <span style="font-size:14px;color:#111">${contract.project_name}</span>
    ${contract.project_date ? `<span style="font-size:13px;color:#666;margin-left:12px">· ${new Date(contract.project_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>` : ''}
  </div>` : ''}

  <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-bottom:32px">
    ${contract.content ?? ''}
  </div>

  ${contract.notes ? `
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Notes</div>
    <div style="font-size:13px;color:#374151">${contract.notes}</div>
  </div>` : ''}

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#999;text-align:center">
    This contract was created via LensTrybe · ${profile?.business_name}
  </div>
</body>
</html>`

      const htmlBytes = new TextEncoder().encode(contractHtml)
      const base64Html = base64Encode(htmlBytes)
      attachments = [{
        filename: `Contract-${contract.id.slice(0, 8).toUpperCase()}.html`,
        content: base64Html,
      }]
    }

    const emailBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#080810;color:#fff;padding:40px 32px;border-radius:12px">
        <div style="margin-bottom:24px"><span style="font-size:22px;font-weight:700;color:#1DB954">LensTrybe</span></div>
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">You have a new contract</h2>
        <p style="color:#888;font-size:14px;margin:0 0 24px">
          <strong style="color:#fff">${profile?.business_name ?? 'Your creative'}</strong> has sent you a contract${contract.project_name ? ` for <strong style="color:#fff">${contract.project_name}</strong>` : ''}.
        </p>
        ${contract.contract_type === 'uploaded'
          ? `<p style="color:#888;font-size:13px;margin:0 0 8px">Click the button below to download your contract.</p>${downloadSection}`
          : `<p style="color:#888;font-size:13px;margin:0 0 8px">The contract is attached to this email. Open it in your browser and press <strong style="color:#fff">Ctrl+P</strong> (or Cmd+P on Mac) then select <strong style="color:#fff">Save as PDF</strong> to download it.</p>`
        }
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
        from: 'LensTrybe <connect@lenstrybe.com>',
        to: [contract.client_email],
        subject: `Contract from ${profile?.business_name ?? 'Your Creative'}${contract.project_name ? ' — ' + contract.project_name : ''}`,
        html: emailBody,
        attachments,
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
