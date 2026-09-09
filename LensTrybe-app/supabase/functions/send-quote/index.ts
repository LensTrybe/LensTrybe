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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { quote, profile: passedProfile, bankDetails } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    let profile: any = passedProfile || {}
    let brand: any = null
    if (quote.creative_id) {
      const [{ data: prof }, { data: bk }] = await Promise.all([
        supabase.from('profiles').select('business_name, business_email, phone, website, city, state, abn, bank_name, bank_account_name, bank_bsb, bank_account').eq('id', quote.creative_id).maybeSingle(),
        supabase.from('brand_kit').select('*').eq('creative_id', quote.creative_id).maybeSingle(),
      ])
      if (prof) profile = { ...passedProfile, ...prof }
      brand = bk
    }
    profile.bank_name = profile.bank_name || bankDetails?.bank_name
    profile.bank_account_name = profile.bank_account_name || bankDetails?.bank_account_name
    profile.bank_bsb = profile.bank_bsb || bankDetails?.bank_bsb
    profile.bank_account = profile.bank_account || bankDetails?.bank_account

    const html = renderDocumentHtml({ type: 'quote', doc: quote, profile, brand })
    const num = String(quote.id || '').slice(0, 8).toUpperCase()

    const pdfKey = Deno.env.get('PDFSHIFT_API_KEY')
    let attachment: { filename: string; content: string }
    let isPdf = false
    if (pdfKey) {
      try { attachment = { filename: `Quote-${num}.pdf`, content: await htmlToPdfBase64(html, pdfKey) }; isPdf = true }
      catch (_e) { attachment = { filename: `Quote-${num}.html`, content: htmlToBase64(html) } }
    } else {
      attachment = { filename: `Quote-${num}.html`, content: htmlToBase64(html) }
    }

    const amount = money(quote.amount)
    const openHint = isPdf ? 'Your quote is attached as a PDF.' : 'Your quote is attached. Open it in your browser and choose Print, then Save as PDF.'
    const emailBody = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:#1DB954;letter-spacing:-0.02em;">LensTrybe</div></td></tr>
<tr><td style="padding:22px 36px 8px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#1DB954;margin-bottom:10px;">New quote</div>
<h1 style="margin:0 0 10px;font-size:23px;line-height:1.25;font-weight:800;color:#ffffff;">You have a new quote</h1>
<p style="margin:0;color:#9a9aa8;font-size:15px;line-height:1.6;"><span style="color:#fff;font-weight:600;">${esc(profile.business_name || 'Your creative')}</span> has sent you a quote for <span style="color:#fff;font-weight:600;">${esc(amount)}</span>.</p></td></tr>
<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:#6a6a78;font-size:12.5px;line-height:1.6;">${openHint} You can accept or decline it from your client portal.</p></td></tr>
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;"><div style="font-size:13px;font-weight:700;color:#ffffff;">LensTrybe</div><div style="font-size:12px;color:#6a6a78;margin-top:2px;">Connect. Capture. Create.</div></div></td></tr>
</table></td></tr></table></body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LensTrybe <noreply@mail.lenstrybe.com>',
        to: [quote.client_email],
        reply_to: profile.business_email || 'connect@lenstrybe.com',
        subject: `Quote from ${profile.business_name || 'Your Creative'} - ${amount}`,
        html: emailBody,
        attachments: [attachment],
      }),
    })
    const data = await res.json()
    return new Response(JSON.stringify({ ...data, pdf: isPdf }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
