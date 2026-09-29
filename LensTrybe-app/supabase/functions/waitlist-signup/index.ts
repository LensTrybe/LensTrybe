import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { waitlistConfirmationHtml, waitlistNotifyHtml } from './emails.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SITE = 'https://lenstrybe.com'
const NOTIFY_TO = 'connect@lenstrybe.com'

// The launch instant. Also lives in src/App.jsx and src/pages/ComingSoon.jsx.
// Edge Functions deploy separately from the app so the three cannot share a
// constant. Move the date and you have to move it in all three.
//
// +10:00 is deliberate. Queensland has no daylight saving, so AEST is AEST all
// year, and the southern states do not start theirs until 4 October 2026.
const LAUNCH = Date.parse('2026-10-01T00:00:00+10:00')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function makeRefCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  try {
    const payload = await req.json().catch(() => ({}))
    if (payload.website) return json({ ok: true, position: null })

    const email = String(payload.email || '').trim().toLowerCase()
    if (email.length > 254 || !/^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)

    const audience = payload.audience === 'client' ? 'client' : 'creative'
    const name = payload.name ? String(payload.name).trim().slice(0, 120) : null
    const creativeType = payload.creative_type ? String(payload.creative_type).trim().slice(0, 60) : null
    const city = payload.city ? String(payload.city).trim().slice(0, 80) : null
    const state = payload.state ? String(payload.state).trim().slice(0, 40) : null
    const referredByRaw = payload.referred_by ? String(payload.referred_by).trim().toUpperCase().slice(0, 20) : null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    for (const [key, max] of [[`waitlist:ip:${ip}`, 10], [`waitlist:email:${email}`, 3]] as [string, number][]) {
      const { data: allowed, error: rlErr } = await supabase.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: 3600 })
      if (rlErr) { console.error('rate_limit_hit failed', rlErr); return json({ error: 'Please try again later.' }, 503) }
      if (allowed === false) return json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    // Only keep a referral code if it matches a real waitlist code.
    let referredBy: string | null = null
    if (referredByRaw) {
      const { data: refRow } = await supabase.from('waitlist').select('id').eq('referral_code', referredByRaw).maybeSingle()
      if (refRow) referredBy = referredByRaw
    }

    const positionFor = async (aud: string, createdAt?: string) => {
      let q = supabase.from('waitlist').select('id', { count: 'exact', head: true }).eq('audience', aud)
      if (createdAt) q = q.lte('created_at', createdAt)
      const { count } = await q
      return count || 0
    }

    const { data: existing } = await supabase
      .from('waitlist').select('id, audience, referral_code, created_at').eq('email', email).maybeSingle()

    if (existing) {
      // Never reveal an existing signup's referral code or position to an anonymous caller.
      return json({ ok: true, already: true, audience })
    }

    const referralCode = makeRefCode()
    const { error: insErr } = await supabase.from('waitlist').insert({
      email, name, audience, creative_type: creativeType, city, state,
      referral_code: referralCode, referred_by: referredBy, source: 'waitlist',
    })
    if (insErr) {
      if (String(insErr.message || '').toLowerCase().includes('duplicate')) return json({ ok: true, already: true, audience })
      console.error('waitlist insert failed', insErr)
      return json({ error: 'Could not save. Please try again.' }, 500)
    }

    const position = await positionFor(audience)
    const refLink = `${SITE}/?ref=${referralCode}`

    // Joining the waitlist includes consent to launch updates and The Trybe Edit (stated on the form).
    let unsubscribeUrl: string | null = null
    try {
      const nowIso = new Date().toISOString()
      const { data: existingSub } = await supabase.from('email_subscribers').select('token, status').eq('email', email).maybeSingle()
      if (existingSub) {
        if (existingSub.status === 'subscribed') unsubscribeUrl = `${SITE}/unsubscribe/${existingSub.token}`
      } else {
        const { data: sub } = await supabase.from('email_subscribers')
          .insert({ email, status: 'subscribed', source: 'waitlist', consented_at: nowIso })
          .select('token').single()
        if (sub?.token) unsubscribeUrl = `${SITE}/unsubscribe/${sub.token}`
      }
    } catch (e) { console.error('waitlist: subscriber save failed', e instanceof Error ? e.message : String(e)) }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY) {
      // These two Resend calls used to be awaited before responding, which left a
      // visitor watching a "Sending" button for about eight seconds on a form whose
      // entire job is to be quick. Measured, not guessed.
      //
      // The signup row is already written by this point, so nothing the visitor cares
      // about depends on these. They now run as a background task and the response
      // goes out immediately. waitUntil keeps the worker alive long enough to finish
      // them, so nothing is dropped.
      const send = (body: Record<string, unknown>) =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch((e) => console.error('waitlist: send failed', e instanceof Error ? e.message : String(e)))

      const emails = Promise.all([
        send({
          from: 'LensTrybe <noreply@mail.lenstrybe.com>',
          to: email,
          subject: "You're on the LensTrybe list",
          html: waitlistConfirmationHtml({ audience, refLink, unsubscribeUrl, live: Date.now() >= LAUNCH }),
          ...(unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } } : {}),
        }),
        send({
          from: 'LensTrybe Waitlist <noreply@mail.lenstrybe.com>',
          to: NOTIFY_TO,
          reply_to: email,
          subject: `New waitlist signup: ${audience === 'creative' ? 'creative' : 'client'}${city ? ` (${city})` : state ? ` (${state})` : ''}`,
          html: waitlistNotifyHtml({ email, audience, creativeType, city, state, referredBy }),
        }),
      ])

      const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
      if (rt?.waitUntil) rt.waitUntil(emails)
    }

    return json({ ok: true, audience, position, referralCode })
  } catch (_e) {
    return json({ error: 'Something went wrong.' }, 500)
  }
})
