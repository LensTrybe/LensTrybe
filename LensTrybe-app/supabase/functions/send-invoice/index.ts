import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ================= shared branded document renderer (keep in sync with src/lib/documentTemplate.js) =================
const SERIF = new Set(['Playfair Display', 'Merriweather', 'Cormorant Garamond'])
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&display=swap'
function fontStack(name: string) { const n = name || 'Inter'; const q = n.includes(' ') ? `"${n}"` : n; return `${q}, ${SERIF.has(n) ? 'serif' : 'sans-serif'}` }
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function nl2br(s: unknown) { return esc(s).replace(/\n/g, '<br>') }
function isDark(hex: string) { let h = String(hex || '').trim().replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); if (h.length !== 6) return false; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.6 }
function money(v: unknown) { const n = Number(v); return 'AUD ' + (Number.isFinite(n) ? n : 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: unknown) { if (!d) return ''; const dt = new Date(String(d).length <= 10 ? d + 'T00:00:00' : String(d)); if (Number.isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) }
function resolveDocTheme(brand: any, type: string) {
  const b = brand || {}
  const ds = (b.document_brand_settings && typeof b.document_brand_settings === 'object') ? b.document_brand_settings : {}
  const base = ds.base && typeof ds.base === 'object' ? ds.base : {}
  const doc = ds[type] && typeof ds[type] === 'object' ? ds[type] : {}
  const pick = (k: string, ...fb: any[]) => { for (const v of [doc[k], base[k], ...fb]) if (v !== undefined && v !== null && v !== '') return v; return undefined }
  const accent = pick('accent', b.primary_color, '#1DB954')
  return {
    accent, accentText: isDark(accent) ? '#ffffff' : '#141414',
    headingFont: fontStack(pick('headingFont', b.heading_font, b.font, 'Playfair Display')),
    bodyFont: fontStack(pick('bodyFont', b.body_font, b.font, 'Inter')),
    logoUrl: (doc.showLogo === false || base.showLogo === false) ? null : pick('logoUrl', b.logo_url, null),
    template: pick('template', 'classic'),
    footer: pick('footer', 'Thank you for your business'),
    terms: doc.terms ?? base.terms ?? '',
    numberPrefix: pick('numberPrefix', type === 'invoice' ? 'INV' : 'QUO'),
    showAbn: doc.showAbn === true, showGst: doc.showGst === true,
    showPhone: pick('showPhone', true) !== false, showWebsite: pick('showWebsite', true) !== false,
    showBank: type === 'invoice' ? (pick('showBank', true) !== false) : (doc.showBank === true),
  }
}
function renderDocumentHtml(opts: any) {
  const { type = 'invoice', doc = {}, profile = {} } = opts
  const t = resolveDocTheme(opts.brand, type)
  const isInvoice = type === 'invoice'
  const title = isInvoice ? 'INVOICE' : 'QUOTE'
  const items = doc.line_items ?? doc.items ?? []
  const total = Number(doc.amount ?? items.reduce((s: number, i: any) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)) || 0
  const num = `${t.numberPrefix}-${String(doc.id || '').slice(0, 8).toUpperCase() || '0001'}`
  const businessLines: string[] = []
  if (profile.business_email) businessLines.push(esc(profile.business_email))
  if (t.showPhone && profile.phone) businessLines.push(esc(profile.phone))
  if (t.showWebsite && profile.website) businessLines.push(esc(profile.website))
  const locality = [profile.city, profile.state].filter(Boolean).join(', ')
  if (locality) businessLines.push(esc(locality))
  if (t.showAbn && profile.abn) businessLines.push('ABN ' + esc(profile.abn))
  const logoImg = t.logoUrl ? `<img src="${esc(t.logoUrl)}" alt="" style="max-height:56px;max-width:220px;object-fit:contain;display:block" />` : ''
  const bizName = `<div style="font-family:${t.headingFont};font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#141414;line-height:1.1">${esc(profile.business_name || 'Your business')}</div>`
  let header = ''
  if (t.template === 'band') {
    header = `<div style="background:${t.accent};color:${t.accentText};border-radius:14px;padding:26px 28px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:center;gap:20px"><div>${t.logoUrl ? `<img src="${esc(t.logoUrl)}" alt="" style="max-height:46px;max-width:200px;object-fit:contain;filter:${t.accentText === '#ffffff' ? 'brightness(0) invert(1)' : 'none'}" />` : `<div style="font-family:${t.headingFont};font-size:22px;font-weight:700">${esc(profile.business_name || 'Your business')}</div>`}</div><div style="text-align:right"><div style="font-family:${t.headingFont};font-size:30px;font-weight:800;letter-spacing:0.04em">${title}</div><div style="font-size:13px;opacity:0.9">${esc(num)}</div></div></div>`
  } else if (t.template === 'minimal') {
    header = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:18px;border-bottom:2px solid ${t.accent};margin-bottom:28px"><div>${logoImg || bizName}</div><div style="text-align:right"><div style="font-family:${t.headingFont};font-size:26px;font-weight:700;color:#141414;letter-spacing:0.03em">${title}</div><div style="font-size:13px;color:#6b7280">${esc(num)}</div></div></div>`
  } else {
    header = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:30px"><div>${logoImg ? logoImg + `<div style="height:8px"></div>` : ''}${bizName}</div><div style="text-align:right"><div style="font-family:${t.headingFont};font-size:30px;font-weight:800;color:${t.accent};letter-spacing:0.03em">${title}</div><div style="font-size:13px;color:#6b7280">${esc(num)}</div></div></div>`
  }
  const metaRight = `<div style="font-size:13px;color:#6b7280;line-height:1.7"><div>Issued: ${esc(fmtDate(doc.created_at || new Date().toISOString()))}</div>${doc.due_date ? `<div>${isInvoice ? 'Due' : 'Valid until'}: ${esc(fmtDate(doc.due_date))}</div>` : ''}</div>`
  const itemsHtml = (items.length ? items : [{ description: 'No items', quantity: '', rate: '' }]).map((i: any) => `<tr><td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;color:#141414">${esc(i.description || '')}</td><td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;color:#141414;text-align:center">${esc(i.quantity ?? '')}</td><td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;color:#141414;text-align:right">${i.rate === '' ? '' : money(i.rate)}</td><td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;font-weight:600;color:#141414;text-align:right">${i.rate === '' ? '' : money(Number(i.quantity || 0) * Number(i.rate || 0))}</td></tr>`).join('')
  const gst = t.showGst ? total / 11 : 0
  const totalsRows = t.showGst
    ? `<tr><td style="font-size:13px;color:#6b7280;padding:2px 0">Subtotal</td><td style="font-size:13px;color:#141414;text-align:right;padding:2px 0">${money(total - gst)}</td></tr><tr><td style="font-size:13px;color:#6b7280;padding:2px 0">GST (10%)</td><td style="font-size:13px;color:#141414;text-align:right;padding:2px 0">${money(gst)}</td></tr><tr><td style="font-family:${t.headingFont};font-size:16px;font-weight:800;color:#141414;padding-top:8px;border-top:2px solid #141414">Total (incl. GST)</td><td style="font-size:16px;font-weight:800;color:#141414;text-align:right;padding-top:8px;border-top:2px solid #141414">${money(total)}</td></tr>`
    : `<tr><td style="font-family:${t.headingFont};font-size:16px;font-weight:800;color:#141414;padding-top:8px;border-top:2px solid #141414">Total</td><td style="font-size:16px;font-weight:800;color:#141414;text-align:right;padding-top:8px;border-top:2px solid #141414">${money(total)}</td></tr>`
  const bankHtml = (t.showBank && (profile.bank_account || profile.bank_bsb)) ? `<div style="background:#f7f7f9;border-radius:10px;padding:16px 18px;margin-bottom:22px"><div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:9px">Payment details</div>${profile.bank_name ? `<div style="font-size:13px;color:#374151;margin-bottom:3px">Bank: ${esc(profile.bank_name)}</div>` : ''}${profile.bank_account_name ? `<div style="font-size:13px;color:#374151;margin-bottom:3px">Account name: ${esc(profile.bank_account_name)}</div>` : ''}${profile.bank_bsb ? `<div style="font-size:13px;color:#374151;margin-bottom:3px">BSB: ${esc(profile.bank_bsb)}</div>` : ''}${profile.bank_account ? `<div style="font-size:13px;color:#374151">Account: ${esc(profile.bank_account)}</div>` : ''}</div>` : ''
  const termsBlock = t.terms ? `<div style="border-top:1px solid #ececf0;padding-top:16px;margin-bottom:18px"><div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px">${isInvoice ? 'Payment terms' : 'Terms'}</div><div style="font-size:12.5px;color:#374151;line-height:1.6">${nl2br(t.terms)}</div></div>` : ''
  const notesBlock = doc.notes ? `<div style="border-top:1px solid #ececf0;padding-top:16px;margin-bottom:18px"><div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px">Notes</div><div style="font-size:12.5px;color:#374151;line-height:1.6">${nl2br(doc.notes)}</div></div>` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${FONTS_HREF}" rel="stylesheet"></head><body style="margin:0;background:#eceef2;font-family:${t.bodyFont}"><div style="max-width:720px;margin:0 auto;background:#ffffff;padding:44px 48px;color:#141414">${header}<div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:30px;flex-wrap:wrap"><div><div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px">${isInvoice ? 'Bill to' : 'Prepared for'}</div><div style="font-size:15px;font-weight:600;color:#141414">${esc(doc.client_name || 'Client name')}</div>${doc.client_email ? `<div style="font-size:13px;color:#6b7280">${esc(doc.client_email)}</div>` : ''}${doc.client_phone ? `<div style="font-size:13px;color:#6b7280">${esc(doc.client_phone)}</div>` : ''}${doc.client_address ? `<div style="font-size:13px;color:#6b7280">${esc(doc.client_address)}</div>` : ''}</div><div style="text-align:right">${businessLines.length ? `<div style="font-size:12.5px;color:#6b7280;line-height:1.7;margin-bottom:8px">${businessLines.join('<br>')}</div>` : ''}${metaRight}</div></div><table width="100%" style="border-collapse:collapse;margin-bottom:22px"><thead><tr style="background:${t.accent}"><th style="text-align:left;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em">Description</th><th style="text-align:center;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em;width:64px">Qty</th><th style="text-align:right;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em;width:110px">Rate</th><th style="text-align:right;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em;width:120px">Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table><table width="100%" style="margin-bottom:28px"><tr><td></td><td width="260"><table width="100%" style="border-collapse:collapse">${totalsRows}</table></td></tr></table>${bankHtml}${termsBlock}${notesBlock}<div style="margin-top:36px;padding-top:18px;border-top:1px solid #ececf0;font-size:12px;color:#9a9aa8;text-align:center">${esc(t.footer)} &middot; ${esc(profile.business_name || 'LensTrybe')}</div></div></body></html>`
}
// ================= end shared renderer =================

function u8ToBase64(bytes: Uint8Array) { let bin = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk))); return btoa(bin) }
function htmlToBase64(html: string) { return u8ToBase64(new TextEncoder().encode(html)) }
async function htmlToPdfBase64(html: string, key: string) {
  const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa('api:' + key), 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: html, format: 'A4', use_print: false }),
  })
  if (!res.ok) throw new Error('PDF conversion failed: ' + res.status)
  return u8ToBase64(new Uint8Array(await res.arrayBuffer()))
}


// ================= security helpers =================
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/.test(s) }
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }
function jsonRes(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
async function getAuthUser(admin: any, req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try { const { data, error } = await admin.auth.getUser(token); if (error || !data?.user) return null; return data.user } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)
  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Only the signed-in creative who owns the invoice can send it.
    const user = await getAuthUser(supabase, req)
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401)

    let body: any = {}
    try { body = await req.json() } catch { return jsonRes({ error: 'Invalid request' }, 400) }
    // Accept only an id. (Older clients sent the whole record; only its id is used.)
    const invoiceId = String(body?.invoice_id ?? body?.invoiceId ?? body?.invoice?.id ?? '')
    if (!UUID_RE.test(invoiceId)) return jsonRes({ error: 'invoice_id required' }, 400)

    const { data: record, error: loadErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
    if (loadErr) console.error('send-invoice load failed', loadErr)
    if (!record || record.creative_id !== user.id) return jsonRes({ error: 'Invoice not found' }, 404)
    if (!isEmail(record.client_email)) return jsonRes({ error: 'Add a valid client email to this invoice before sending.' }, 400)

    const allowed = await supabase.rpc('rate_limit_hit', { p_key: 'send-invoice:' + user.id, p_max: 60, p_window_seconds: 3600 })
    if (allowed.error) console.error('send-invoice rate limit check failed', allowed.error)
    else if (allowed.data === false) return jsonRes({ error: 'Too many invoices sent recently. Please try again later.' }, 429)

    // Business details, bank details and brand kit come only from the caller's own records.
    // Bank details live in the owner-only profile_private table.
    const [{ data: prof }, { data: priv }, { data: bk }] = await Promise.all([
      supabase.from('profiles').select('business_name, business_email, phone, website, city, state, abn').eq('id', user.id).maybeSingle(),
      supabase.from('profile_private').select('bank_name, bank_account_name, bank_bsb, bank_account').eq('id', user.id).maybeSingle(),
      supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle(),
    ])
    const profile: any = { ...(prof || {}), ...(priv || {}) }
    const brand: any = bk || null
    const invoice: any = { ...record, line_items: Array.isArray(record.line_items) ? record.line_items : (Array.isArray(record.items) ? record.items : []) }

    const html = renderDocumentHtml({ type: 'invoice', doc: invoice, profile, brand })
    const num = String(invoice.id || '').slice(0, 8).toUpperCase()

    const pdfKey = Deno.env.get('PDFSHIFT_API_KEY')
    let attachment: { filename: string; content: string }
    let isPdf = false
    if (pdfKey) {
      try { attachment = { filename: `Invoice-${num}.pdf`, content: await htmlToPdfBase64(html, pdfKey) }; isPdf = true }
      catch (e) { console.error('send-invoice pdf conversion failed', e); attachment = { filename: `Invoice-${num}.html`, content: htmlToBase64(html) } }
    } else {
      attachment = { filename: `Invoice-${num}.html`, content: htmlToBase64(html) }
    }

    const amount = money(invoice.amount)
    const openHint = isPdf ? 'Your invoice is attached as a PDF.' : 'Your invoice is attached. Open it in your browser and choose Print, then Save as PDF.'
    const emailBody = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:#1DB954;letter-spacing:-0.02em;">LensTrybe</div></td></tr>
<tr><td style="padding:22px 36px 8px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#1DB954;margin-bottom:10px;">New invoice</div>
<h1 style="margin:0 0 10px;font-size:23px;line-height:1.25;font-weight:800;color:#ffffff;">You have a new invoice</h1>
<p style="margin:0;color:#9a9aa8;font-size:15px;line-height:1.6;"><span style="color:#fff;font-weight:600;">${esc(profile.business_name || 'Your creative')}</span> has sent you an invoice for <span style="color:#fff;font-weight:600;">${esc(amount)}</span>.</p></td></tr>
<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:#6a6a78;font-size:12.5px;line-height:1.6;">${openHint}</p></td></tr>
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;"><div style="font-size:13px;font-weight:700;color:#ffffff;">LensTrybe</div><div style="font-size:12px;color:#6a6a78;margin-top:2px;">Connect. Capture. Create.</div></div></td></tr>
</table></td></tr></table></body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LensTrybe <noreply@mail.lenstrybe.com>',
        to: [record.client_email],
        reply_to: isEmail(profile.business_email) ? profile.business_email : 'connect@lenstrybe.com',
        subject: `Invoice from ${plain(profile.business_name || 'Your Creative', 120)} - ${amount}`,
        html: emailBody,
        attachments: [attachment],
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('send-invoice resend error', res.status, data)
      return jsonRes({ error: 'Could not send the invoice email. Please try again.' }, 502)
    }
    return jsonRes({ success: true, id: (data as any)?.id ?? null, pdf: isPdf })
  } catch (err) {
    console.error('send-invoice failed', err)
    return jsonRes({ error: 'Could not send the invoice. Please try again.' }, 500)
  }
})
