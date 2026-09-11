import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SITE = 'https://lenstrybe.com'
const NOTIFY_TO = 'connect@lenstrybe.com'
const IG = 'https://instagram.com/lenstrybe'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }

function makeRefCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function confirmationHtml(opts: { audience: string; refLink: string; unsubscribeUrl: string | null }) {
  const { audience, refLink, unsubscribeUrl } = opts
  const green = '#1DB954'
  const heading = "You're on the list."
  const body = audience === 'client'
    ? `LensTrybe is live in Brisbane and South East Queensland, and rolling out across Australia city by city. We'll let you know the moment you can book creatives in your area.`
    : `LensTrybe is live in Brisbane and South East Queensland, and rolling out across Australia city by city. We'll let you know the moment we open in your area. No commissions, ever. Keep 100% of what you earn.`
  const shareBlock = audience === 'creative'
    ? `\n      <div style=\"background:#f6f8f6;border:1px solid #e5efe8;border-radius:12px;padding:20px 22px;margin:8px 0 4px\">\n        <div style=\"font-size:13px;color:#4b5a50;margin-bottom:10px\">Want to help bring LensTrybe to your city sooner? Share your link.</div>\n        <a href=\"${refLink}\" style=\"font-size:14px;color:${green};font-weight:600;text-decoration:none;word-break:break-all\">${refLink}</a>\n      </div>`
    : ''
  return `<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"></head>\n<body style=\"margin:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#14111a\">\n  <div style=\"max-width:520px;margin:0 auto;padding:40px 24px\">\n    <div style=\"font-size:20px;font-weight:800;letter-spacing:-0.3px;margin-bottom:28px\">Lens<span style=\"color:${green}\">Trybe</span></div>\n    <div style=\"background:#ffffff;border:1px solid #ececec;border-radius:16px;padding:32px 28px\">\n      <div style=\"display:inline-block;font-size:12px;font-weight:600;color:${green};background:rgba(29,185,84,0.1);border-radius:100px;padding:5px 12px;margin-bottom:18px\">Now live in Brisbane · South East Queensland</div>\n      <h1 style=\"font-size:24px;line-height:1.25;margin:0 0 14px;font-weight:800;color:#14111a\">${heading}</h1>\n      <p style=\"font-size:15px;line-height:1.65;color:#4b4a57;margin:0 0 20px\">${body}</p>\n      ${shareBlock}\n    </div>\n    <p style=\"font-size:13px;color:#4b4a57;text-align:center;margin:22px 0 6px\">Follow <a href=\"${IG}\" style=\"color:${green};font-weight:600;text-decoration:none\">@lenstrybe</a> to keep up with our progress.</p>\n    <p style=\"font-size:12px;color:#9a99a5;text-align:center;margin:8px 0 6px\">No spam. ${unsubscribeUrl ? `<a href=\"${unsubscribeUrl}\" style=\"color:#9a99a5;text-decoration:underline\">Unsubscribe</a> any time.` : 'Unsubscribe any time.'}</p>\n    <p style=\"font-size:12px;color:#b7b6c0;text-align:center;margin:0\">The LensTrybe Team</p>\n  </div>\n</body></html>`
}

function notifyHtml(opts: { email: string; audience: string; creativeType: string | null; city: string | null; state: string | null; referredBy: string | null }) {
  const { email, audience, creativeType, city, state, referredBy } = opts
  const row = (k: string, v: string) => `<tr><td style=\"padding:6px 14px 6px 0;color:#8a8995;font-size:13px\">${k}</td><td style=\"padding:6px 0;color:#14111a;font-size:13px;font-weight:600\">${esc(v)}</td></tr>`
  const loc = [city, state].filter(Boolean).join(', ')
  return `<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"></head>\n<body style=\"margin:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#14111a\">\n  <div style=\"max-width:480px;margin:0 auto;padding:32px 24px\">\n    <div style=\"background:#fff;border:1px solid #ececec;border-radius:14px;padding:24px\">\n      <div style=\"font-size:15px;font-weight:800;margin-bottom:14px\">New waitlist signup</div>\n      <table style=\"border-collapse:collapse\">\n        ${row('Email', email)}\n        ${row('Type', audience === 'creative' ? 'Creative' : 'Hiring / client')}\n        ${creativeType ? row('Discipline', creativeType) : ''}\n        ${loc ? row('Location', loc) : ''}\n        ${referredBy ? row('Referred by', referredBy) : ''}\n      </table>\n    </div>\n  </div>\n</body></html>`
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
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'LensTrybe <noreply@mail.lenstrybe.com>',
            to: email,
            subject: "You're on the LensTrybe list",
            html: confirmationHtml({ audience, refLink, unsubscribeUrl }),
            ...(unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } } : {}),
          }),
        })
      } catch (_e) { /* ignore */ }
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'LensTrybe Waitlist <noreply@mail.lenstrybe.com>',
            to: NOTIFY_TO,
            reply_to: email,
            subject: `New waitlist signup: ${audience === 'creative' ? 'creative' : 'client'}${city ? ` (${city})` : state ? ` (${state})` : ''}`,
            html: notifyHtml({ email, audience, creativeType, city, state, referredBy }),
          }),
        })
      } catch (_e) { /* ignore */ }
    }

    return json({ ok: true, audience, position, referralCode })
  } catch (_e) {
    return json({ error: 'Something went wrong.' }, 500)
  }
})
