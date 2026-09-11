// Supabase Edge Function: document-pdf
// Returns a branded PDF (base64 in JSON) for an invoice, quote or contract.
//
// Who can download (verify_jwt = false; this function does its own checks):
//   - the creative who owns the document (Authorization: Bearer <user JWT>)
//   - the client, through their portal link   ({ portal_token })  - sent documents only
//   - the client, through a contract signing link ({ signing_token }) - that contract only
//
// The branded layout mirrors src/lib/documentTemplate.js (and the inlined copies in
// send-invoice / send-quote). Keep them in sync when changing document styling.
//
// Body: { type: 'invoice' | 'quote' | 'contract', id: uuid, portal_token?: uuid, signing_token?: uuid }
// Response: { filename, content_base64 }  (application/json)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TYPES = ['invoice', 'quote', 'contract']
const TABLE: Record<string, string> = { invoice: 'invoices', quote: 'quotes', contract: 'contracts' }

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
async function getAuthUser(admin: any, req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try { const { data, error } = await admin.auth.getUser(token); if (error || !data?.user) return null; return data.user } catch { return null }
}
function u8ToBase64(u8: Uint8Array) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode(...u8.subarray(i, i + chunk))
  return btoa(s)
}
async function htmlToPdfBase64(html: string, key: string) {
  const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa('api:' + key), 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: html, format: 'A4', use_print: false }),
  })
  if (!res.ok) throw new Error('PDF conversion failed: ' + res.status)
  return u8ToBase64(new Uint8Array(await res.arrayBuffer()))
}

// ================= branded renderer (mirrors src/lib/documentTemplate.js) =================
const SERIF = new Set(['Playfair Display', 'Merriweather', 'Cormorant Garamond'])
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&display=swap'
function fontStack(name: any) { const n = name || 'Inter'; const q = n.includes(' ') ? `"${n}"` : n; return `${q}, ${SERIF.has(n) ? 'serif' : 'sans-serif'}` }
function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: any) { return esc(s).replace(/\r?\n/g, '<br>') }
function isDark(hex: any) {
  let h = String(hex || '').trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.6
}
function money(v: any) { const n = Number(v); return 'AUD ' + (Number.isFinite(n) ? n : 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: any) {
  if (!d) return ''
  const dt = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}
function safeImageUrl(u: any) {
  if (typeof u !== 'string') return null
  try { const p = new URL(u); return p.protocol === 'https:' ? p.toString() : null } catch { return null }
}

function resolveDocTheme(brand: any, type: string) {
  const b = brand || {}
  const ds = (b.document_brand_settings && typeof b.document_brand_settings === 'object') ? b.document_brand_settings : {}
  const base = ds.base && typeof ds.base === 'object' ? ds.base : {}
  const doc = ds[type] && typeof ds[type] === 'object' ? ds[type] : {}
  const pick = (k: string, ...fallbacks: any[]) => {
    for (const v of [doc[k], base[k], ...fallbacks]) if (v !== undefined && v !== null && v !== '') return v
    return undefined
  }
  const accent = pick('accent', b.primary_color, '#1DB954')
  return {
    accent: /^#[0-9a-f]{3,8}$/i.test(String(accent)) ? accent : '#1DB954',
    accentText: isDark(accent) ? '#ffffff' : '#141414',
    headingFont: fontStack(pick('headingFont', b.heading_font, b.font, 'Playfair Display')),
    bodyFont: fontStack(pick('bodyFont', b.body_font, b.font, 'Inter')),
    logoUrl: (doc.showLogo === false || base.showLogo === false) ? null : safeImageUrl(pick('logoUrl', b.logo_url, null)),
    template: pick('template', 'classic'),
    footer: pick('footer', 'Thank you for your business'),
    terms: doc.terms ?? base.terms ?? '',
    numberPrefix: pick('numberPrefix', type === 'invoice' ? 'INV' : type === 'quote' ? 'QUO' : 'CON'),
    showAbn: doc.showAbn === true,
    showGst: doc.showGst === true,
    showPhone: pick('showPhone', true) !== false,
    showWebsite: pick('showWebsite', true) !== false,
    showBank: type === 'invoice' ? (pick('showBank', true) !== false) : (doc.showBank === true),
  }
}

function renderHeader(t: any, title: string, num: string, profile: any) {
  const logoImg = t.logoUrl ? `<img src="${esc(t.logoUrl)}" alt="" style="max-height:56px;max-width:220px;object-fit:contain;display:block" />` : ''
  const bizName = `<div style="font-family:${t.headingFont};font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#141414;line-height:1.1">${esc(profile.business_name || 'Your business')}</div>`
  if (t.template === 'band') {
    return `<div style="background:${t.accent};color:${t.accentText};border-radius:14px;padding:26px 28px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:center;gap:20px">
      <div>${t.logoUrl ? `<img src="${esc(t.logoUrl)}" alt="" style="max-height:46px;max-width:200px;object-fit:contain;filter:${t.accentText === '#ffffff' ? 'brightness(0) invert(1)' : 'none'}" />` : `<div style="font-family:${t.headingFont};font-size:22px;font-weight:700">${esc(profile.business_name || 'Your business')}</div>`}</div>
      <div style="text-align:right"><div style="font-family:${t.headingFont};font-size:30px;font-weight:800;letter-spacing:0.04em">${title}</div><div style="font-size:13px;opacity:0.9">${esc(num)}</div></div>
    </div>`
  }
  if (t.template === 'minimal') {
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:18px;border-bottom:2px solid ${t.accent};margin-bottom:28px">
      <div>${logoImg || bizName}</div>
      <div style="text-align:right"><div style="font-family:${t.headingFont};font-size:26px;font-weight:700;color:#141414;letter-spacing:0.03em">${title}</div><div style="font-size:13px;color:#6b7280">${esc(num)}</div></div>
    </div>`
  }
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:30px">
      <div>${logoImg ? logoImg + `<div style="height:8px"></div>` : ''}${bizName}</div>
      <div style="text-align:right"><div style="font-family:${t.headingFont};font-size:30px;font-weight:800;color:${t.accent};letter-spacing:0.03em">${title}</div><div style="font-size:13px;color:#6b7280">${esc(num)}</div></div>
    </div>`
}

function businessLinesFor(t: any, profile: any) {
  const lines: string[] = []
  if (profile.business_email) lines.push(esc(profile.business_email))
  if (t.showPhone && profile.phone) lines.push(esc(profile.phone))
  if (t.showWebsite && profile.website) lines.push(esc(profile.website))
  const locality = [profile.city, profile.state].filter(Boolean).join(', ')
  if (locality) lines.push(esc(locality))
  if (t.showAbn && profile.abn) lines.push('ABN ' + esc(profile.abn))
  return lines
}

function wrapPage(t: any, title: string, inner: string, profile: any) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${FONTS_HREF}" rel="stylesheet"></head>
<body style="margin:0;background:#ffffff;font-family:${t.bodyFont}">
<div style="max-width:720px;margin:0 auto;background:#ffffff;padding:44px 48px;color:#141414">
  ${inner}
  <div style="margin-top:36px;padding-top:18px;border-top:1px solid #ececf0;font-size:12px;color:#9a9aa8;text-align:center">${esc(t.footer)} &middot; ${esc(profile.business_name || 'LensTrybe')}</div>
</div>
</body></html>`
}

function renderFinancialDoc(type: 'invoice' | 'quote', doc: any, profile: any, brand: any) {
  const t = resolveDocTheme(brand, type)
  const isInvoice = type === 'invoice'
  const title = isInvoice ? 'INVOICE' : 'QUOTE'
  const items = Array.isArray(doc.line_items) ? doc.line_items : (Array.isArray(doc.items) ? doc.items : [])
  const total = Number(doc.amount ?? items.reduce((s: number, i: any) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0)) || 0
  const num = `${t.numberPrefix}-${String(doc.id || '').slice(0, 8).toUpperCase() || '0001'}`
  const lines = businessLinesFor(t, profile)
  const dueOrValid = isInvoice ? doc.due_date : (doc.valid_until || doc.due_date)

  const metaRight = `
    <div style="font-size:13px;color:#6b7280;line-height:1.7">
      <div>Issued: ${esc(fmtDate(doc.created_at || new Date().toISOString()))}</div>
      ${dueOrValid ? `<div>${isInvoice ? 'Due' : 'Valid until'}: ${esc(fmtDate(dueOrValid))}</div>` : ''}
      ${isInvoice && String(doc.status || '').toLowerCase() === 'paid' ? `<div style="color:#15803d;font-weight:700">Paid</div>` : ''}
    </div>`

  const itemsHtml = (items.length ? items : [{ description: 'No items', quantity: '', rate: '' }]).map((i: any) => `
    <tr>
      <td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;color:#141414">${esc(i.description || '')}</td>
      <td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;color:#141414;text-align:center">${esc(i.quantity ?? '')}</td>
      <td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;color:#141414;text-align:right">${i.rate === '' ? '' : money(i.rate)}</td>
      <td style="padding:11px 8px;border-bottom:1px solid #ececf0;font-size:13px;font-weight:600;color:#141414;text-align:right">${i.rate === '' ? '' : money(Number(i.quantity || 0) * Number(i.rate || 0))}</td>
    </tr>`).join('')

  const gst = t.showGst ? total / 11 : 0
  const totalsRows = t.showGst
    ? `<tr><td style="font-size:13px;color:#6b7280;padding:2px 0">Subtotal</td><td style="font-size:13px;color:#141414;text-align:right;padding:2px 0">${money(total - gst)}</td></tr>
       <tr><td style="font-size:13px;color:#6b7280;padding:2px 0">GST (10%)</td><td style="font-size:13px;color:#141414;text-align:right;padding:2px 0">${money(gst)}</td></tr>
       <tr><td style="font-family:${t.headingFont};font-size:16px;font-weight:800;color:#141414;padding-top:8px;border-top:2px solid #141414">Total (incl. GST)</td><td style="font-size:16px;font-weight:800;color:#141414;text-align:right;padding-top:8px;border-top:2px solid #141414">${money(total)}</td></tr>`
    : `<tr><td style="font-family:${t.headingFont};font-size:16px;font-weight:800;color:#141414;padding-top:8px;border-top:2px solid #141414">Total</td><td style="font-size:16px;font-weight:800;color:#141414;text-align:right;padding-top:8px;border-top:2px solid #141414">${money(total)}</td></tr>`

  const bankHtml = (t.showBank && (profile.bank_account || profile.bank_bsb)) ? `
    <div style="background:#f7f7f9;border-radius:10px;padding:16px 18px;margin-bottom:22px">
      <div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:9px">Payment details</div>
      ${profile.bank_name ? `<div style="font-size:13px;color:#374151;margin-bottom:3px">Bank: ${esc(profile.bank_name)}</div>` : ''}
      ${profile.bank_account_name ? `<div style="font-size:13px;color:#374151;margin-bottom:3px">Account name: ${esc(profile.bank_account_name)}</div>` : ''}
      ${profile.bank_bsb ? `<div style="font-size:13px;color:#374151;margin-bottom:3px">BSB: ${esc(profile.bank_bsb)}</div>` : ''}
      ${profile.bank_account ? `<div style="font-size:13px;color:#374151">Account: ${esc(profile.bank_account)}</div>` : ''}
    </div>` : ''

  const termsBlock = t.terms ? `
    <div style="border-top:1px solid #ececf0;padding-top:16px;margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px">${isInvoice ? 'Payment terms' : 'Terms'}</div>
      <div style="font-size:12.5px;color:#374151;line-height:1.6">${nl2br(t.terms)}</div>
    </div>` : ''
  const notesBlock = doc.notes ? `
    <div style="border-top:1px solid #ececf0;padding-top:16px;margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px">Notes</div>
      <div style="font-size:12.5px;color:#374151;line-height:1.6">${nl2br(doc.notes)}</div>
    </div>` : ''

  const inner = `${renderHeader(t, title, num, profile)}
  <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:30px;flex-wrap:wrap">
    <div>
      <div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px">${isInvoice ? 'Bill to' : 'Prepared for'}</div>
      <div style="font-size:15px;font-weight:600;color:#141414">${esc(doc.client_name || 'Client')}</div>
      ${doc.client_email ? `<div style="font-size:13px;color:#6b7280">${esc(doc.client_email)}</div>` : ''}
      ${doc.client_phone ? `<div style="font-size:13px;color:#6b7280">${esc(doc.client_phone)}</div>` : ''}
      ${doc.client_address ? `<div style="font-size:13px;color:#6b7280">${esc(doc.client_address)}</div>` : ''}
    </div>
    <div style="text-align:right">
      ${lines.length ? `<div style="font-size:12.5px;color:#6b7280;line-height:1.7;margin-bottom:8px">${lines.join('<br>')}</div>` : ''}
      ${metaRight}
    </div>
  </div>
  <table width="100%" style="border-collapse:collapse;margin-bottom:22px">
    <thead><tr style="background:${t.accent}">
      <th style="text-align:left;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em">Description</th>
      <th style="text-align:center;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em;width:64px">Qty</th>
      <th style="text-align:right;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em;width:110px">Rate</th>
      <th style="text-align:right;padding:11px 8px;font-size:11px;font-weight:700;color:${t.accentText};text-transform:uppercase;letter-spacing:0.06em;width:120px">Amount</th>
    </tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <table width="100%" style="margin-bottom:28px"><tr><td></td><td width="260"><table width="100%" style="border-collapse:collapse">${totalsRows}</table></td></tr></table>
  ${bankHtml}
  ${termsBlock}
  ${notesBlock}`
  return { html: wrapPage(t, title, inner, profile), num }
}

function renderContract(doc: any, profile: any, brand: any) {
  const t = resolveDocTheme(brand, 'contract')
  const num = `${t.numberPrefix}-${String(doc.id || '').slice(0, 8).toUpperCase() || '0001'}`
  const lines = businessLinesFor(t, profile)
  const signed = String(doc.status || '').toLowerCase() === 'signed'
  const label = (s: string) => `<div style="font-size:11px;font-weight:700;color:#9a9aa8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:7px">${s}</div>`

  const inner = `${renderHeader(t, 'CONTRACT', num, profile)}
  ${doc.title ? `<div style="font-family:${t.headingFont};font-size:20px;font-weight:700;color:#141414;margin-bottom:22px">${esc(doc.title)}</div>` : ''}
  <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:26px;flex-wrap:wrap">
    <div>
      ${label('Between')}
      <div style="font-size:15px;font-weight:600;color:#141414">${esc(profile.business_name || 'The creative')}</div>
      ${lines.length ? `<div style="font-size:12.5px;color:#6b7280;line-height:1.7">${lines.join('<br>')}</div>` : ''}
    </div>
    <div style="text-align:right">
      ${label('And')}
      <div style="font-size:15px;font-weight:600;color:#141414">${esc(doc.client_name || 'Client')}</div>
      ${doc.client_email ? `<div style="font-size:13px;color:#6b7280">${esc(doc.client_email)}</div>` : ''}
      <div style="font-size:13px;color:#6b7280;margin-top:6px">Issued: ${esc(fmtDate(doc.created_at || new Date().toISOString()))}</div>
    </div>
  </div>
  ${doc.project_name ? `
  <div style="margin-bottom:24px;padding:12px 16px;background:#f7f7f9;border-radius:10px;border-left:3px solid ${t.accent}">
    <span style="font-size:11px;font-weight:700;color:#9a9aa8;text-transform:uppercase;letter-spacing:0.08em">Project </span>
    <span style="font-size:14px;color:#141414;font-weight:600">${esc(doc.project_name)}</span>
    ${doc.project_date ? `<span style="font-size:13px;color:#6b7280"> &middot; ${esc(fmtDate(doc.project_date))}</span>` : ''}
  </div>` : ''}
  <div style="border-top:1px solid #ececf0;padding-top:22px;margin-bottom:28px;font-size:13.5px;line-height:1.8;color:#1f2937;white-space:pre-wrap">${esc(doc.content ?? '')}</div>
  ${doc.notes ? `
  <div style="background:#f7f7f9;border-radius:10px;padding:16px 18px;margin-bottom:24px">
    ${label('Notes')}
    <div style="font-size:12.5px;color:#374151;line-height:1.6">${nl2br(doc.notes)}</div>
  </div>` : ''}
  <div style="margin-top:30px;padding:18px 20px;border:1px solid #ececf0;border-radius:12px;page-break-inside:avoid">
    ${label('Signature')}
    ${signed
      ? `<div style="font-size:14px;color:#141414"><strong>${esc(doc.client_name || 'The client')}</strong> accepted and signed this contract electronically on <strong>${esc(fmtDate(doc.signed_at))}</strong>.</div>
         <div style="font-size:12px;color:#6b7280;margin-top:6px">Signed via LensTrybe. Contract reference ${esc(num)}.</div>`
      : `<div style="font-size:14px;color:#6b7280">Awaiting signature from ${esc(doc.client_name || 'the client')}.</div>`}
  </div>`
  return { html: wrapPage(t, 'CONTRACT', inner, profile), num }
}

// ================= handler =================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  try {
    const pdfKey = Deno.env.get('PDFSHIFT_API_KEY')
    if (!pdfKey) { console.error('document-pdf: PDFSHIFT_API_KEY missing'); return jsonRes({ error: 'PDF downloads are not available right now.' }, 500) }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    let body: any = {}
    try { body = await req.json() } catch { return jsonRes({ error: 'Invalid request' }, 400) }
    const type = String(body?.type || '')
    const id = String(body?.id || '')
    const portalToken = body?.portal_token ? String(body.portal_token) : ''
    const signingToken = body?.signing_token ? String(body.signing_token) : ''
    if (!TYPES.includes(type) || !UUID_RE.test(id)) return jsonRes({ error: 'Invalid request' }, 400)
    if (portalToken && !UUID_RE.test(portalToken)) return jsonRes({ error: 'Not found' }, 404)
    if (signingToken && !UUID_RE.test(signingToken)) return jsonRes({ error: 'Not found' }, 404)

    const { data: doc, error: docErr } = await admin.from(TABLE[type]).select('*').eq('id', id).maybeSingle()
    if (docErr) console.error('document-pdf load failed', docErr.message)
    if (!doc) return jsonRes({ error: 'Not found' }, 404)

    // ---- access check ----
    let rateKey = ''
    if (signingToken) {
      if (type !== 'contract' || String(doc.signing_token || '') !== signingToken) return jsonRes({ error: 'Not found' }, 404)
      rateKey = 'document-pdf:sign:' + signingToken
    } else if (portalToken) {
      const { data: portal } = await admin.from('client_portals').select('creative_id, client_email').eq('portal_token', portalToken).maybeSingle()
      const sameClient = portal && portal.creative_id === doc.creative_id
        && String(portal.client_email || '').toLowerCase() === String(doc.client_email || '').toLowerCase()
      if (!sameClient || String(doc.status || '').toLowerCase() === 'draft') return jsonRes({ error: 'Not found' }, 404)
      rateKey = 'document-pdf:portal:' + portalToken
    } else {
      const user = await getAuthUser(admin, req)
      if (!user) return jsonRes({ error: 'Not authenticated' }, 401)
      if (doc.creative_id !== user.id) return jsonRes({ error: 'Not found' }, 404)
      rateKey = 'document-pdf:user:' + user.id
    }
    const allowed = await admin.rpc('rate_limit_hit', { p_key: rateKey, p_max: 60, p_window_seconds: 3600 })
    if (allowed.error) console.error('document-pdf rate limit check failed', allowed.error.message)
    else if (allowed.data === false) return jsonRes({ error: 'Too many downloads right now. Please try again shortly.' }, 429)

    if (type === 'contract' && doc.contract_type === 'uploaded') {
      return jsonRes({ error: 'This contract is an uploaded file. Use the file download instead.', file_url: doc.contract_file_url || null }, 409)
    }

    // ---- the creative's own branding + details (bank details only on their invoices) ----
    const [{ data: prof }, { data: priv }, { data: bk }] = await Promise.all([
      admin.from('profiles').select('business_name, business_email, phone, website, city, state, abn').eq('id', doc.creative_id).maybeSingle(),
      type === 'contract'
        ? Promise.resolve({ data: null })
        : admin.from('profile_private').select('bank_name, bank_account_name, bank_bsb, bank_account').eq('id', doc.creative_id).maybeSingle(),
      admin.from('brand_kit').select('*').eq('creative_id', doc.creative_id).maybeSingle(),
    ])
    const profile: any = { ...(prof || {}), ...(priv || {}) }

    const rendered = type === 'contract'
      ? renderContract(doc, profile, bk)
      : renderFinancialDoc(type as 'invoice' | 'quote', doc, profile, bk)
    const label = type === 'invoice' ? 'Invoice' : type === 'quote' ? 'Quote' : 'Contract'
    const content = await htmlToPdfBase64(rendered.html, pdfKey)
    return jsonRes({ filename: `${label}-${rendered.num}.pdf`, content_base64: content })
  } catch (err) {
    console.error('document-pdf failed', err instanceof Error ? err.message : err)
    return jsonRes({ error: 'Could not create the PDF. Please try again.' }, 500)
  }
})
