import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { supportStaffHtml, supportConfirmationHtml } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const SUPPORT_TO = 'support@lenstrybe.com'
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch (_e) { /* best effort */ }
}
// ---- end shared ----

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }

  const name = typeof body.name === 'string' ? plain(body.name, 120) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : ''
  const role = typeof body.role === 'string' ? plain(body.role, 40) : ''
  const category = typeof body.category === 'string' ? plain(body.category, 60) : ''
  const subject = typeof body.subject === 'string' ? plain(body.subject, 160) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''

  if (!/^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400)
  if (!message) return json({ error: 'Please describe your issue.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // user_id comes only from a verified session token, never from the request body.
  let userId: string | null = null
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token)
      userId = data?.user?.id || null
    } catch (_e) { userId = null }
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  for (const key of [`support:ip:${ip}`, `support:email:${email}`]) {
    const { data: allowed, error: rlErr } = await supabase.rpc('rate_limit_hit', { p_key: key, p_max: 5, p_window_seconds: 3600 })
    if (rlErr) { console.error('rate_limit_hit failed', rlErr); return json({ error: 'Could not submit your request. Please try again later.' }, 503) }
    if (allowed === false) return json({ error: 'Too many requests. Please try again later.' }, 429)
  }

  const { data: inserted, error: insErr } = await supabase.from('support_tickets').insert({
    user_id: userId, name: name || null, email, role: role || null,
    category: category || null, subject: subject || null, message, status: 'open',
  }).select('id').single()
  if (insErr) { console.error('support ticket insert failed', insErr); return json({ error: 'Could not submit your request. Please try again.' }, 500) }

  const ref = String(inserted?.id || '').slice(0, 8).toUpperCase()
  const who = [name, email].filter(Boolean).join(' · ')

  // Notify the LensTrybe support inbox (reply-to goes straight to the person).
  await sendEmail(resendKey, {
    to: SUPPORT_TO,
    replyTo: email,
    subject: `New support request${category ? ` [${category}]` : ''}: ${subject || 'No subject'}`,
    html: supportStaffHtml({ name, email, who, role, category, subject, ref, message }),
  })

  // Confirmation to the person who raised it: fixed text with the reference number only.
  await sendEmail(resendKey, {
    to: email,
    replyTo: SUPPORT_TO,
    subject: `We've got your request${ref ? ` (#${ref})` : ''}`,
    html: supportConfirmationHtml({ ref }),
  })

  return json({ ok: true, id: inserted?.id, ref })
})
