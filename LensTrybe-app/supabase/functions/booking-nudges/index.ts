// Supabase Edge Function: booking-nudges
// Scheduled daily via pg_cron. When a client's booking request has sat unanswered for
// 72 hours, emails the client once so they are not left in silence.
//
// This exists because of the monthly confirm cap. A creative at their cap cannot accept
// any more bookings that month, so their waiting requests get no reply at all. Silence is
// a worse experience for the client than a decline, and it is the client who would stop
// trusting LensTrybe, not the creative. The email says the creative has not replied yet
// and points the client at other creatives nearby, without saying anything about the
// creative's plan.
//
// Auth: header x-cron-secret == CRON_SECRET (fails closed if CRON_SECRET is not set).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const GREEN = '#1DB954'
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const SITE = 'https://lenstrybe.com'
const WAIT_HOURS = 72

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, reply_to: 'connect@lenstrybe.com', subject, html }),
    })
    return res.ok
  } catch (_e) {
    return false
  }
}

function nudgeEmail(clientName: string, businessName: string, dateLabel: string, browseUrl: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0f;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
  <tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${GREEN};">LensTrybe</div></td></tr>
  <tr><td style="padding:22px 36px 8px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#f59e0b;margin-bottom:10px;">Still waiting to hear back</div>
  <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#fff;">Hi ${esc(clientName || 'there')}, no reply yet</h1>
  <p style="margin:0 0 14px;color:#9a9aa8;font-size:15px;line-height:1.6;"><strong style="color:#fff;">${esc(businessName || 'The creative')}</strong> has not responded to your booking request for <strong style="color:#fff;">${esc(dateLabel)}</strong> yet. They may simply be busy shooting, and your request is still open.</p>
  <p style="margin:0 0 14px;color:#9a9aa8;font-size:15px;line-height:1.6;">If your date is coming up, it is worth having a second option lined up. There are other creatives on LensTrybe who may be free.</p>
  </td></tr>
  <tr><td style="padding:14px 36px 4px;"><table role="presentation"><tr><td style="border-radius:10px;background:${GREEN};"><a href="${esc(browseUrl)}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">Find another creative</a></td></tr></table></td></tr>
  <tr><td style="padding:26px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:12px;color:#6a6a78;">Sent by LensTrybe. Connect. Capture. Create.</div></td></tr>
  </table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    console.error('CRON_SECRET is not set')
    return json({ error: 'Not configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-cron-secret') || '', cronSecret)) return json({ error: 'Unauthorized' }, 401)

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const cutoff = new Date(Date.now() - WAIT_HOURS * 3600 * 1000).toISOString()

  const { data: rows, error } = await sb
    .from('bookings')
    .select('id, creative_id, client_name, client_email, booking_date, created_at, status, origin')
    .eq('status', 'pending')
    .eq('origin', 'client')
    .is('client_nudge_sent_at', null)
    .not('client_email', 'is', null)
    .lte('created_at', cutoff)
    .limit(200)

  if (error) {
    console.error('booking-nudges: query failed', error.message)
    return json({ error: 'Query failed' }, 500)
  }

  let sent = 0
  for (const b of rows || []) {
    try {
      let businessName = 'The creative'
      if (b.creative_id) {
        const { data: p } = await sb.from('profiles').select('business_name').eq('id', b.creative_id).maybeSingle()
        if (p?.business_name) businessName = String(p.business_name)
      }
      const dateLabel = b.booking_date
        ? new Date(`${b.booking_date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'your requested date'

      const ok = await sendEmail(
        String(b.client_email),
        `No reply yet from ${businessName}`,
        nudgeEmail(String(b.client_name || ''), businessName, dateLabel, `${SITE}/explore`),
      )
      // Marked either way, so a delivery problem never turns into a daily repeat.
      await sb.from('bookings').update({ client_nudge_sent_at: new Date().toISOString() }).eq('id', b.id)
      if (ok) sent++
    } catch (e) {
      console.error('booking-nudges: booking failed', b.id, (e as Error)?.message)
    }
  }

  return json({ ok: true, considered: (rows || []).length, sent })
})
