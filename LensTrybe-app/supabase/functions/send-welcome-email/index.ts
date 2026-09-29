import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { foundingWelcomeEmail, clientWelcomeEmail, creativeWelcomeEmail } from './emails.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
// ---- end shared ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function jres(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }

// Welcome email, sent once per account and only ever to the account's own address.
// Callers: a signed-in user (Authorization bearer token), or the signup page straight after
// supabase.auth.signUp (email confirmation is on, so there is no session yet) passing { user_id }
// of the account it just created. In that case the account must be less than 30 minutes old.
// The founding variant is chosen from profiles.founding_member, never from the request.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jres({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const payload = await req.json().catch(() => ({})) as Record<string, any>

    // deno-lint-ignore no-explicit-any
    let user: any = null
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (token) {
      const { data } = await admin.auth.getUser(token)
      user = data?.user || null
    }
    if (!user) {
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
      const { data: allowed, error: rlErr } = await admin.rpc('rate_limit_hit', { p_key: `welcome:ip:${ip}`, p_max: 10, p_window_seconds: 3600 })
      if (rlErr || allowed === false) return jres({ error: 'Too many requests' }, 429)
      const uid = typeof payload.user_id === 'string' ? payload.user_id : ''
      if (!UUID_RE.test(uid)) return jres({ error: 'Unauthorised' }, 401)
      const { data } = await admin.auth.admin.getUserById(uid)
      const u = data?.user
      if (!u || Date.now() - new Date(u.created_at).getTime() > 30 * 60 * 1000) return jres({ success: true, skipped: true })
      user = u
    }

    const email: string | undefined = user.email
    if (!email) return jres({ error: 'No email found' }, 400)

    // Send once only.
    const { data: claimed, error: claimErr } = await admin.from('welcome_emails')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true }).select('user_id')
    if (claimErr) { console.error('welcome claim failed', claimErr); return jres({ error: 'Could not send welcome email' }, 500) }
    if (!claimed || claimed.length === 0) return jres({ success: true, skipped: 'already_sent' })

    const meta = (user.user_metadata || {}) as Record<string, any>
    const { data: prof } = await admin.from('profiles').select('business_name, founding_member').eq('id', user.id).maybeSingle()
    const { data: clientRow } = prof ? { data: null } : await admin.from('client_accounts').select('id').eq('id', user.id).maybeSingle()
    const metaRole = String(meta.account_kind || meta.account_type || '').toLowerCase()
    const isClient = !prof && (metaRole === 'client' || !!clientRow || payload?.role === 'client')
    const isFounding = !isClient && prof?.founding_member === true
    const bodyName = payload?.name || payload?.record?.user_metadata?.full_name
    const name = plain(
      meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || prof?.business_name || meta.business_name || bodyName || email.split('@')[0] || 'there',
      80,
    ) || 'there'

    let html: string
    let subject: string
    if (isFounding) {
      ({ subject, html } = foundingWelcomeEmail(name))
    } else if (isClient) {
      ({ subject, html } = clientWelcomeEmail(name))
    } else {
      ({ subject, html } = creativeWelcomeEmail(name))
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: email, reply_to: 'connect@lenstrybe.com', subject, html }),
    })
    if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
    return jres({ success: true })
  } catch (err) {
    console.error('send-welcome-email error', err)
    return jres({ error: 'Could not send welcome email' }, 500)
  }
})
