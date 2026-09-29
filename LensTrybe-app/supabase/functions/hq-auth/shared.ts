// Shared by hq-auth and hq-api. Each function keeps its own identical copy (Edge Functions deploy alone): change both.
export const HQ_URL = 'https://hq.lenstrybe.com'
export const FROM = 'LensTrybe HQ <noreply@mail.lenstrybe.com>'
export const REPLY_TO = 'connect@lenstrybe.com'
const ORIGINS = [HQ_URL, 'http://localhost:5191', 'http://localhost:5192', 'http://localhost:5193', 'http://localhost:5173']

export function cors(req: Request) {
  const o = req.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : HQ_URL,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
export const clean = (s: unknown, max = 200) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254
export const ipOf = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
export async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('')
}
export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a)
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Plain dark LensTrybe email: logo, heading, paragraphs, one button.
export function mail(title: string, paras: string[], cta?: { label: string, url: string }, foot = 'LensTrybe HQ is for LensTrybe staff only. If this reached you by mistake, you can ignore it.') {
  const p = paras.map(t => `<p style="margin:0 0 14px;color:#c9c9d4;font-size:15px;line-height:1.65;">${t}</p>`).join('')
  const b = cta ? `<tr><td style="padding:6px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#1DB954;"><a href="${esc(cta.url)}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">${esc(cta.label)}</a></td></tr></table></td></tr>` : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0a0a0f;font-family:Inter,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
<tr><td style="padding:32px 36px 0;"><img src="https://lenstrybe.com/email-logo-white.png" width="180" height="38" alt="LensTrybe" style="display:block;border:0;width:180px;height:38px;" /></td></tr>
<tr><td style="padding:22px 36px 4px;"><h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:800;color:#fff;">${esc(title)}</h1>${p}</td></tr>
${b}
<tr><td style="padding:26px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:12px;line-height:1.6;color:#6a6a78;">${foot}<br>Connect. Capture. Create.</div></td></tr>
</table></td></tr></table></body></html>`
}

export async function sendMail(to: string, subject: string, html: string, from = FROM) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return 'Email is not configured'
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: REPLY_TO, subject, html }),
    })
    return r.ok ? null : `Email failed (${r.status})`
  } catch { return 'Email failed' }
}
