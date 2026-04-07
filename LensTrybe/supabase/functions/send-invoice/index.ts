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
    .replace(/"/g, '&quot;')
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  } catch {
    return String(value)
  }
}

type InvoiceItem = {
  description?: unknown
  quantity?: unknown
  unit_price?: unknown
}

function normalizeItems(raw: unknown): Array<{ description: string; quantity: number; unit_price: number }> {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: Array<{ description: string; quantity: number; unit_price: number }> = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as InvoiceItem
    const description = String(o.description ?? '').trim()
    const quantity = Number(o.quantity)
    const unit_price = Number(o.unit_price ?? (o as { unitPrice?: unknown }).unitPrice)
    if (!description || !Number.isFinite(quantity) || !Number.isFinite(unit_price)) continue
    out.push({ description, quantity, unit_price })
  }
  return out
}

function buildInvoiceEmailHtml(params: {
  businessName: string
  invoiceNumber: string
  dueDate: string
  clientName: string
  clientEmail: string
  items: Array<{ description: string; quantity: number; unit_price: number }>
  amount: number
  status: string
}): string {
  const {
    businessName,
    invoiceNumber,
    dueDate,
    clientName,
    clientEmail,
    items,
    amount,
    status,
  } = params

  const rows = items
    .map((line) => {
      const lineTotal = line.quantity * line.unit_price
      return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(line.description)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(line.quantity))}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatMoney(line.unit_price))}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${escapeHtml(formatMoney(lineTotal))}</td>
</tr>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">INVOICE</p>
              <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#18181b;">${escapeHtml(businessName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:4px 0;color:#52525b;font-size:14px;"><strong style="color:#18181b;">Invoice #</strong> ${escapeHtml(invoiceNumber)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#52525b;font-size:14px;"><strong style="color:#18181b;">Due date</strong> ${escapeHtml(dueDate)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#52525b;font-size:14px;"><strong style="color:#18181b;">Status</strong> ${escapeHtml(status)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 20px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#71717a;">Bill to</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">${escapeHtml(clientName)}</p>
              <p style="margin:4px 0 0;font-size:14px;color:#52525b;">${escapeHtml(clientEmail)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e4e4e7;border-radius:8px;border-collapse:separate;">
                <thead>
                  <tr style="background-color:#fafafa;">
                    <th align="left" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;border-bottom:1px solid #e4e4e7;">Description</th>
                    <th align="right" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;border-bottom:1px solid #e4e4e7;">Qty</th>
                    <th align="right" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;border-bottom:1px solid #e4e4e7;">Unit price</th>
                    <th align="right" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;border-bottom:1px solid #e4e4e7;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="right" style="font-size:16px;font-weight:700;color:#18181b;">Grand total: ${escapeHtml(formatMoney(amount))}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e4e4e7;background-color:#fafafa;">
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
  const invoiceNumber = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() : ''
  const dueDate = typeof body.dueDate === 'string' ? body.dueDate.trim() : ''
  const amountRaw = body.amount
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)
  const status = typeof body.status === 'string' ? body.status.trim() : ''
  const items = normalizeItems(body.items)

  if (!to || !to.includes('@')) {
    return jsonResponse({ error: 'Valid "to" email is required' }, 400)
  }
  if (!clientName) {
    return jsonResponse({ error: 'clientName is required' }, 400)
  }
  if (!businessName) {
    return jsonResponse({ error: 'businessName is required' }, 400)
  }
  if (!replyTo || !replyTo.includes('@')) {
    return jsonResponse({ error: 'Valid replyTo email is required' }, 400)
  }
  if (!invoiceNumber) {
    return jsonResponse({ error: 'invoiceNumber is required' }, 400)
  }
  if (!dueDate) {
    return jsonResponse({ error: 'dueDate is required' }, 400)
  }
  if (!Number.isFinite(amount)) {
    return jsonResponse({ error: 'amount must be a valid number' }, 400)
  }
  if (!status) {
    return jsonResponse({ error: 'status is required' }, 400)
  }
  if (items.length === 0) {
    return jsonResponse({ error: 'items must be a non-empty array of line items' }, 400)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return jsonResponse({ error: 'Email service is not configured' }, 500)
  }

  const html = buildInvoiceEmailHtml({
    businessName,
    invoiceNumber,
    dueDate,
    clientName,
    clientEmail: to,
    items,
    amount,
    status,
  })

  const subject = `Invoice #${invoiceNumber} from ${businessName}`

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
  let resendJson: { message?: string; id?: string } | null = null
  try {
    resendJson = resendText ? JSON.parse(resendText) : null
  } catch {
    resendJson = null
  }

  if (!resendRes.ok) {
    const message =
      (resendJson && typeof resendJson.message === 'string' && resendJson.message) ||
      resendText ||
      'Resend API request failed'
    return jsonResponse({ error: message }, 502)
  }

  return jsonResponse({ success: true }, 200)
})
