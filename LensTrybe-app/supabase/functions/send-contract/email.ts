// LensTrybe email design, "Night" (approved by Michael, 29 Sep 2026).
//
// Every function that sends email keeps an identical copy of this file next to its index.ts
// (Edge Functions deploy one folder at a time). The master copy is supabase/functions/_email/email.ts:
// change it there and copy it to every function that has one.
//
// One structure for every email: the lens band with the logo, an eyebrow and a heading, short
// paragraphs, at most one green button, a details box for dates, amounts and places, and a footer
// that says why the person got it. Dark page, dark card. Inter with safe fallbacks. Table layout and
// inline styles only, so Gmail, Outlook and Apple Mail all draw it the same way.
//
// Every value put into an email passes through esc() unless it is a block built here.

// The band image. Served by the new site; at the swap it is also on lenstrybe.com, and
// next.lenstrybe.com stays up so emails already sent keep their header.
export const BAND_URL = 'https://next.lenstrybe.com/email-band.jpg'
export const SITE = 'https://lenstrybe.com'
export const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
export const REPLY_TO = 'connect@lenstrybe.com'

export const C = {
  page: '#0a0a0f', card: '#14141c', line: 'rgba(255,255,255,0.08)', box: '#1b1b26',
  ink: '#ffffff', body: '#c9c9d4', soft: '#8b8a9a', foot: '#6a6a78',
  green: '#1DB954', greenInk: '#04120a', pink: '#FF2D78', amber: '#f59e0b',
}
const FONT = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
// Plain text with line breaks kept (messages, notes people wrote).
export const lines = (s: unknown) => esc(s).replace(/\r/g, '').replace(/\n/g, '<br>')

const row = (inner: string, pad = '0 36px 12px') => `<tr><td class="lt-px" style="padding:${pad};">${inner}</td></tr>`

// Blocks. Each returns one table row for layout().
export const heading = (eyebrow: string, title: string) =>
  row(`${eyebrow ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.soft};margin-bottom:10px;">${esc(eyebrow)}</div>` : ''}<h1 style="margin:0 0 4px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${esc(title)}</h1>`, '30px 36px 12px')

// A paragraph. Pass trusted HTML (already escaped) with html: true, e.g. to include <strong> or a link.
export const para = (text: string, opts: { html?: boolean, small?: boolean } = {}) =>
  row(`<p style="margin:0;font-size:${opts.small ? 13 : 15}px;line-height:1.65;color:${opts.small ? C.soft : C.body};">${opts.html ? text : esc(text)}</p>`)

export const strong = (s: unknown) => `<strong style="color:${C.ink};font-weight:600;">${esc(s)}</strong>`
export const link = (label: string, url: string) => `<a href="${esc(url)}" style="color:${C.green};font-weight:600;text-decoration:none;">${esc(label)}</a>`

export const button = (label: string, url: string) =>
  row(`<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${C.green};"><a href="${esc(url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:${C.greenInk};text-decoration:none;font-family:${FONT};">${esc(label)}</a></td></tr></table>`, '10px 36px 18px')

// For the button-is-broken case: the raw link, selectable.
export const fallbackLink = (url: string) =>
  para(`If the button does not work, paste this into your browser:<br><span style="word-break:break-all;color:${C.green};">${esc(url)}</span>`, { html: true, small: true })

// Label and value rows in a box: dates, amounts, places, reference numbers.
export const facts = (rows: [string, unknown][], title?: string) => {
  const r = rows.filter(([, v]) => v !== null && v !== undefined && String(v) !== '')
    .map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;font-size:13px;color:${C.soft};vertical-align:top;">${esc(k)}</td><td style="padding:7px 0;font-size:14px;color:${C.ink};font-weight:600;text-align:right;">${esc(v)}</td></tr>`).join('')
  if (!r) return ''
  return row(`<div style="background:${C.box};border:1px solid ${C.line};border-radius:14px;padding:12px 18px;">${title ? `<div style="font-size:13px;font-weight:700;color:${C.ink};margin:4px 0 4px;">${esc(title)}</div>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${r}</table></div>`, '6px 36px 14px')
}

// Something a person wrote: an enquiry, a message, a review, a note.
export const quote = (text: unknown, who?: string) =>
  row(`<div style="border-left:3px solid ${C.green};padding:2px 0 2px 16px;"><p style="margin:0 0 ${who ? 6 : 0}px;font-size:15px;line-height:1.6;color:${C.ink};">${lines(text)}</p>${who ? `<div style="font-size:12.5px;color:${C.soft};">${esc(who)}</div>` : ''}</div>`, '4px 36px 16px')

// A code to copy or type: founding codes, 6-digit codes.
export const code = (value: string, label?: string, sub?: string) =>
  row(`<div style="background:${C.box};border:1px solid rgba(29,185,84,0.35);border-radius:14px;padding:16px 18px;">${label ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${C.green};margin-bottom:6px;">${esc(label)}</div>` : ''}<div style="font-size:26px;font-weight:800;color:${C.ink};letter-spacing:0.08em;font-family:'SF Mono',Menlo,Consolas,monospace;">${esc(value)}</div>${sub ? `<div style="font-size:12.5px;color:${C.soft};margin-top:6px;">${esc(sub)}</div>` : ''}</div>`, '6px 36px 14px')

// A short list. Items are plain text unless html: true.
export const list = (items: string[], opts: { html?: boolean, title?: string } = {}) =>
  row(`${opts.title ? `<div style="font-size:14px;font-weight:700;color:${C.ink};margin-bottom:8px;">${esc(opts.title)}</div>` : ''}<ul style="margin:0;padding-left:20px;color:${C.body};font-size:14.5px;line-height:1.55;">${items.map(i => `<li style="margin:0 0 6px;">${opts.html ? i : esc(i)}</li>`).join('')}</ul>`, '2px 36px 12px')

// A callout: good news (green), needs attention (amber), problem (pink).
export const notice = (text: string, tone: 'green' | 'amber' | 'pink' = 'amber', opts: { html?: boolean } = {}) => {
  const c = tone === 'green' ? C.green : tone === 'pink' ? C.pink : C.amber
  return row(`<div style="border:1px solid ${c}55;background:${c}14;border-radius:12px;padding:12px 16px;font-size:14px;line-height:1.55;color:${C.ink};">${opts.html ? text : esc(text)}</div>`, '4px 36px 14px')
}

// A small image (a creative's photo or logo) with a name beside it.
export const person = (name: string, sub?: string, img?: string | null) =>
  row(`<table role="presentation" cellpadding="0" cellspacing="0"><tr>${img ? `<td style="padding-right:12px;"><img src="${esc(img)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:50%;object-fit:cover;border:0;"></td>` : ''}<td><div style="font-size:15px;font-weight:700;color:${C.ink};">${esc(name)}</div>${sub ? `<div style="font-size:12.5px;color:${C.soft};">${esc(sub)}</div>` : ''}</td></tr></table>`, '4px 36px 14px')

export const signoff = (name = 'The LensTrybe Team', role?: string) =>
  row(`<p style="margin:6px 0 0;font-size:15px;line-height:1.5;color:${C.ink};">${esc(name)}${role ? `<br><span style="color:${C.soft};font-size:13.5px;">${esc(role)}</span>` : ''}</p>`, '4px 36px 14px')

export const spacer = (h = 8) => `<tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`

// The whole email. why: one sentence on why they got it. unsubscribe: a link for anything
// marketing (Spam Act), left out of transactional email.
export function layout(o: { preheader?: string, blocks: string[], why: string, unsubscribe?: string | null }) {
  const unsub = o.unsubscribe ? ` <a href="${esc(o.unsubscribe)}" style="color:${C.soft};text-decoration:underline;">Unsubscribe</a>.` : ''
  return `<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title></title><style>body{margin:0;padding:0;}a{color:${C.green};}@media (max-width:600px){.lt-px{padding-left:22px!important;padding-right:22px!important;}}</style></head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;font-family:${FONT};">
<tr><td style="padding:0;line-height:0;font-size:0;"><a href="${SITE}"><img src="${BAND_URL}" width="560" alt="LensTrybe" style="display:block;width:100%;max-width:560px;height:auto;border:0;color:${C.ink};font-size:16px;"></a></td></tr>
${o.blocks.filter(Boolean).join('\n')}
<tr><td class="lt-px" style="padding:10px 36px 30px;"><div style="border-top:1px solid ${C.line};padding-top:16px;font-size:12px;line-height:1.65;color:${C.foot};">${esc(o.why)}${unsub}<br>LensTrybe · Brisbane, Queensland · connect@lenstrybe.com<br>Connect. Capture. Create.</div></td></tr>
</table></td></tr></table></body></html>`
}

// Plan names people see. The ids underneath stay basic/pro/expert/elite.
export const PLAN: Record<string, string> = { basic: 'Trybe Free', pro: 'Trybe Essential', expert: 'Trybe Complete', elite: 'Trybe Studio' }
export const planName = (t: unknown) => PLAN[String(t || 'basic').toLowerCase()] || String(t || '')
export const money = (minor: number, currency = 'AUD') => (Number(minor || 0) / 100).toLocaleString('en-AU', { style: 'currency', currency })
export const dollars = (v: unknown) => '$' + (Number(v) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const date = (iso: unknown) => iso ? new Date(String(iso)).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' }) : ''
