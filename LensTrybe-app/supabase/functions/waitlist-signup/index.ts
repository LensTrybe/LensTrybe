import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// The first N creatives to join get three months free at launch.
const FOUNDING_SPOTS = 250
const LAUNCH_LABEL = '1 January 2027'
const SITE = 'https://lenstrybe.com'
const NOTIFY_TO = 'connect@lenstrybe.com'

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

function confirmationHtml(opts: { audience: string; founding: boolean; position: number; refLink: string }) {
  const { audience, founding, position, refLink } = opts
  const green = '#1DB954'
  const heading = founding ? `You're in. You're founding creative #${position}.` : "You're on the list."
  const body = founding
    ? `You made the founding ${FOUNDING_SPOTS}. That means three months free when we open on ${LAUNCH_LABEL}. Keep 100% of what you earn, no commissions, ever.`
    : audience === 'client'
      ? `LensTrybe opens on ${LAUNCH_LABEL}. We'll let you know the moment you can start booking Australian creatives.`
      : `LensTrybe opens on ${LAUNCH_LABEL}. You'll be first to know when doors open. No commissions, ever. Keep 100% of what you earn.`
  const shareBlock = audience === 'creative'
    ? `
      <div style="background:#f6f8f6;border:1px solid #e5efe8;border-radius:12px;padding:20px 22px;margin:8px 0 4px">
        <div style="font-size:13px;color:#4b5a50;margin-bottom:10px">Want to move up the list? Share your link.</div>
        <a href="${refLink}" style="font-size:14px;color:${green};font-weight:600;text-decoration:none;word-break:break-all">${refLink}</a>
      </div>`
    : ''
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#14111a">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.3px;margin-bottom:28px">Lens<span style="color:${green}">Trybe</span></div>
    <div style="background:#ffffff;border:1px solid #ececec;border-radius:16px;padding:32px 28px">
      <div style="display:inline-block;font-size:12px;font-weight:600;color:${green};background:rgba(29,185,84,0.1);border-radius:100px;padding:5px 12px;margin-bottom:18px">Launching ${LAUNCH_LABEL}</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;font-weight:800;color:#14111a">${heading}</h1>
      <p style="font-size:15px;line-height:1.65;color:#4b4a57;margin:0 0 20px">${body}</p>
      ${shareBlock}
    </div>
    <p style="font-size:13px;color:#4b4a57;text-align:center;margin:22px 0 6px">Follow <a href="https://instagram.com/lenstrybe" style="color:${green};font-weight:600;text-decoration:none">@lenstrybe</a> to keep up with our progress.</p>
    <p style="font-size:12px;color:#9a99a5;text-align:center;margin:8px 0 6px">No spam. Unsubscribe anytime.</p>
    <p style="font-size:12px;color:#b7b6c0;text-align:center;margin:0">The LensTrybe Team</p>
  </div>
</body></html>`
}

function notifyHtml(opts: { email: string; audience: string; creativeType: string | null; state: string | null; position: number; founding: boolean; referredBy: string | null }) {
  const { email, audience, creativeType, state, position, founding, referredBy } = opts
  const row = (k: string, v: string) => `<tr><td style="padding:6px 14px 6px 0;color:#8a8995;font-size:13px">${k}</td><td style="padding:6px 0;color:#14111a;font-size:13px;font-weight:600">${v}</td></tr>`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#14111a">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="background:#fff;border:1px solid #ececec;border-radius:14px;padding:24px">
      <div style="font-size:15px;font-weight:800;margin-bottom:14px">New waitlist signup</div>
      <table style="border-collapse:collapse">
        ${row('Email', email)}
        ${row('Type', audience === 'creative' ? 'Creative' : 'Hiring / client')}
        ${creativeType ? row('Discipline', creativeType) : ''}
        ${state ? row('State', state) : ''}
        ${audience === 'creative' ? row('Position', `#${position}${founding ? ' (founding 250)' : ''}`) : ''}
        ${referredBy ? row('Referred by', referredBy) : ''}
      </table>
    </div>
  </div>
</body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  try {
    const payload = await req.json().catch(() => ({}))
    if (payload.website) return json({ ok: true, position: null, foundingSpot: false })

    const email = String(payload.email || '').trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)

    const audience = payload.audience === 'client' ? 'client' : 'creative'
    const name = payload.name ? String(payload.name).trim().slice(0, 120) : null
    const creativeType = payload.creative_type ? String(payload.creative_type).trim().slice(0, 60) : null
    const state = payload.state ? String(payload.state).trim().slice(0, 40) : null
    const referredByRaw = payload.referred_by ? String(payload.referred_by).trim().toUpperCase().slice(0, 20) : null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Only keep a referral code if it matches a real waitlist code.
    let referredBy: string | null = null
    if (referredByRaw) {
      const { data: refRow } = await supabase.from('waitlist').select('id').eq('referral_code', referredByRaw).maybeSingle()
      if (refRow) referredBy = referredByRaw
    }

    const countCreatives = async () => {
      const { count } = await supabase.from('waitlist').select('id', { count: 'exact', head: true }).eq('audience', 'creative')
      return count || 0
    }
    const countAudience = async (aud: string) => {
      const { count } = await supabase.from('waitlist').select('id', { count: 'exact', head: true }).eq('audience', aud)
      return count || 0
    }

    const { data: existing } = await supabase
      .from('waitlist').select('id, audience, referral_code, created_at').eq('email', email).maybeSingle()

    if (existing) {
      let position = 0
      if (existing.audience === 'creative') {
        const { count } = await supabase.from('waitlist')
          .select('id', { count: 'exact', head: true })
          .eq('audience', 'creative').lte('created_at', existing.created_at)
        position = count || 0
      }
      const creativeCount = await countCreatives()
      return json({
        ok: true, already: true, audience: existing.audience, position,
        foundingSpot: existing.audience === 'creative' && position > 0 && position <= FOUNDING_SPOTS,
        spotsLeft: Math.max(0, FOUNDING_SPOTS - creativeCount),
        referralCode: existing.referral_code || null,
      })
    }

    const referralCode = makeRefCode()
    const { error: insErr } = await supabase.from('waitlist').insert({
      email, name, audience, creative_type: creativeType, state,
      referral_code: referralCode, referred_by: referredBy, source: 'waitlist',
    })
    if (insErr && !String(insErr.message || '').toLowerCase().includes('duplicate')) {
      return json({ error: 'Could not save. Please try again.' }, 500)
    }

    const position = audience === 'creative' ? await countCreatives() : await countAudience('client')
    const creativeCount = audience === 'creative' ? position : await countCreatives()
    const foundingSpot = audience === 'creative' && position <= FOUNDING_SPOTS
    const spotsLeft = Math.max(0, FOUNDING_SPOTS - creativeCount)
    const refLink = `${SITE}/?ref=${referralCode}`

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY) {
      // Confirmation to the signer-up.
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'LensTrybe <connect@lenstrybe.com>',
            to: email,
            subject: foundingSpot ? "You're a founding creative" : "You're on the LensTrybe list",
            html: confirmationHtml({ audience, founding: foundingSpot, position, refLink }),
          }),
        })
      } catch (_e) { /* ignore */ }
      // Notification to LensTrybe.
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'LensTrybe Waitlist <connect@lenstrybe.com>',
            to: NOTIFY_TO,
            reply_to: email,
            subject: `New waitlist signup: ${audience === 'creative' ? 'creative' : 'client'}${state ? ` (${state})` : ''}`,
            html: notifyHtml({ email, audience, creativeType, state, position, founding: foundingSpot, referredBy }),
          }),
        })
      } catch (_e) { /* ignore */ }
    }

    return json({ ok: true, audience, position, foundingSpot, spotsLeft, referralCode })
  } catch (_e) {
    return json({ error: 'Something went wrong.' }, 500)
  }
})
