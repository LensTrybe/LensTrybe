import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { billingEmail } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe Billing <noreply@mail.lenstrybe.com>'
const REPLY_TO = 'billing@lenstrybe.com'
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// ---- end shared ----

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
function fmtDate(d: unknown) {
  const s = String(d || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const [y, m, day] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
function money(minor: unknown, currency: unknown) {
  const n = Number(minor); if (!Number.isFinite(n)) return ''
  const cur = String(currency || 'AUD').toUpperCase()
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur }).format(n / 100) } catch { return `${(n / 100).toFixed(2)} ${cur}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !serviceKey || !resendKey) {
    console.error('send-billing-email: missing env')
    return json({ error: 'Not configured' }, 500)
  }

  // Internal only: called by the billing Edge Functions with the service role key.
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!safeEqual(bearer, serviceKey)) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const userId = (body.user_id || body.userId) as string
  const kind = String(body.kind || '').toLowerCase() // 'active' | 'trial_plan_changed' | 'failed' | 'cancelled' | 'downgraded' | 'founding_ended'
  const amountStr = money(body.amount_minor ?? body.amount, body.currency)
  if (!userId || !kind) return json({ error: 'user_id and kind required' }, 400)

  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', userId).single()
  const to = profile?.business_email
  if (!to) return json({ error: 'no creative email', skipped: true }, 200)
  const name = profile?.business_name || 'there'

  const mail = billingEmail({ kind, name, tier: body.tier, amountStr, billing: body.billing, firstCharge: kind === 'trial_plan_changed' || kind === 'founding_ended' ? fmtDate(body.first_charge_date) : '' })
  if (!mail) return json({ error: 'unknown kind' }, 400)

  await sendEmail(resendKey, { to, subject: mail.subject, html: mail.html, replyTo: REPLY_TO })
  return json({ success: true })
})
