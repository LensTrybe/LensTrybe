import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const accent = '#a855f7'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { quote, profile, bankDetails } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const items = quote.line_items ?? quote.items ?? []
    const lineItemsHtml = (items as any[]).map((item: any) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111">${item.description}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111;text-align:center">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111;text-align:right">AUD ${Number(item.rate).toFixed(2)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111;text-align:right">AUD ${(Number(item.quantity) * Number(item.rate)).toFixed(2)}</td>
      </tr>
    `).join('')

    const bankHtml = (bankDetails?.bank_account || bankDetails?.bank_bsb) ? `
      <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;color:#999;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">Payment Details</div>
        ${bankDetails.bank_name ? `<div style="font-size:13px;color:#374151;margin-bottom:4px">Bank: ${bankDetails.bank_name}</div>` : ''}
        ${bankDetails.bank_account_name ? `<div style="font-size:13px;color:#374151;margin-bottom:4px">Account Name: ${bankDetails.bank_account_name}</div>` : ''}
        ${bankDetails.bank_bsb ? `<div style="font-size:13px;color:#374151;margin-bottom:4px">BSB: ${bankDetails.bank_bsb}</div>` : ''}
        ${bankDetails.bank_account ? `<div style="font-size:13px;color:#374151">Account: ${bankDetails.bank_account}</div>` : ''}
      </div>
    ` : ''

    const quoteHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote</title></head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:48px;color:#111">
  <table width="100%" style="margin-bottom:40px">
    <tr>
      <td>
        <div style="font-size:26px;font-weight:800;color:#111;margin-bottom:4px">${profile?.business_name ?? 'Creative'}</div>
        <div style="font-size:13px;color:#666">${profile?.business_email ?? ''}</div>
      </td>
      <td style="text-align:right">
        <div style="font-size:30px;font-weight:800;color:${accent}">QUOTE</div>
        <div style="font-size:13px;color:#666">#${quote.id.slice(0, 8).toUpperCase()}</div>
        <div style="font-size:13px;color:#666">${new Date(quote.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        ${quote.due_date ? `<div style="font-size:13px;color:#666">Valid until: ${new Date(quote.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
      </td>
    </tr>
  </table>

  <div style="margin-bottom:32px">
    <div style="font-size:11px;font-weight:700;color:#999;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">Bill To</div>
    <div style="font-size:15px;font-weight:600;color:#111">${quote.client_name}</div>
    <div style="font-size:13px;color:#666">${quote.client_email}</div>
    ${quote.client_phone ? `<div style="font-size:13px;color:#666">${quote.client_phone}</div>` : ''}
    ${quote.client_address ? `<div style="font-size:13px;color:#666">${quote.client_address}</div>` : ''}
  </div>

  <table width="100%" style="border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="border-bottom:2px solid #e5e7eb">
        <th style="text-align:left;padding:10px 8px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em">Description</th>
        <th style="text-align:center;padding:10px 8px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;width:70px">Qty</th>
        <th style="text-align:right;padding:10px 8px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;width:90px">Rate</th>
        <th style="text-align:right;padding:10px 8px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.06em;width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>${lineItemsHtml}</tbody>
  </table>

  <table width="100%" style="margin-bottom:32px">
    <tr>
      <td></td>
      <td width="240" style="border-top:2px solid #111;padding-top:8px">
        <table width="100%">
          <tr>
            <td style="font-size:15px;font-weight:800;color:#111">Total</td>
            <td style="font-size:15px;font-weight:800;color:#111;text-align:right">AUD ${Number(quote.amount).toFixed(2)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  ${bankHtml}

  ${quote.notes ? `
  <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;color:#999;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">Notes</div>
    <div style="font-size:13px;color:#374151;line-height:1.6">${quote.notes}</div>
  </div>` : ''}

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#999;text-align:center">
    Thank you for your business · ${profile?.business_name ?? 'LensTrybe Creative'}
  </div>
</body>
</html>`

    const htmlBytes = new TextEncoder().encode(quoteHtml)
    const base64Html = btoa(String.fromCharCode(...htmlBytes))

    const emailBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#080810;color:#fff;padding:40px 32px;border-radius:12px">
        <div style="margin-bottom:24px">
          <span style="font-size:22px;font-weight:700;color:${accent}">LensTrybe</span>
        </div>
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">You have a new quote</h2>
        <p style="color:#888;font-size:14px;margin:0 0 24px">
          <strong style="color:#fff">${profile?.business_name ?? 'Your creative'}</strong> has sent you a quote for <strong style="color:#fff">AUD ${Number(quote.amount).toFixed(2)}</strong>.
        </p>
        <p style="color:#888;font-size:13px;margin:0 0 8px">The quote is attached to this email as an HTML file. Open it in your browser and press <strong style="color:#fff">Ctrl+P</strong> (or Cmd+P on Mac) then select <strong style="color:#fff">Save as PDF</strong> to download it.</p>
        <p style="color:#555;font-size:12px;margin-top:32px">Sent via LensTrybe · <a href="https://app.lenstrybe.com" style="color:${accent}">app.lenstrybe.com</a></p>
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
        to: [quote.client_email],
        subject: `Quote from ${profile?.business_name ?? 'Your Creative'} — AUD ${Number(quote.amount).toFixed(2)}`,
        html: emailBody,
        attachments: [
          {
            filename: `Quote-${quote.id.slice(0, 8).toUpperCase()}.html`,
            content: base64Html,
          }
        ],
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
