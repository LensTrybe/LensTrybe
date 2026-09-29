// Shared by hq-auth and hq-api. Each function keeps its own identical copy (Edge Functions deploy alone): change both.
import { layout, heading, para, button } from './email.ts'
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

// Emails use the shared LensTrybe design (email.ts, "Night"). paras are trusted HTML: escape
// anything a person typed before passing it in.
export function mail(title: string, paras: string[], cta?: { label: string, url: string }, foot = 'LensTrybe HQ is for LensTrybe staff only. If this reached you by mistake, you can ignore it.', eyebrow = 'LensTrybe HQ') {
  return layout({ preheader: title, blocks: [heading(eyebrow, title), ...paras.map(p => para(p, { html: true })), cta ? button(cta.label, cta.url) : ''], why: foot })
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
