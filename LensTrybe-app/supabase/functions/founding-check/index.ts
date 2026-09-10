// Supabase Edge Function: founding-check
// Scheduled daily via pg_cron. Scores every founding creative against the three
// responsibilities and runs warn -> grace -> revert:
//   active      : all currently-due responsibilities met
//   at_risk     : something due is unmet; a warning email is sent and the grace clock starts
//   revert_pending : grace elapsed and still unmet (surfaced in admin for action)
//   reverted    : deal removed (standard pricing) - only auto-applied when
//                 FOUNDING_AUTO_REVERT === 'true'; otherwise left as revert_pending for
//                 Michael to action manually from the admin panel.
//
// Responsibilities (windows are constants below, easy to tune once terms are final):
//   - Listing 100% complete within 7 days of joining
//   - 3 real jobs (accepted quote + paid invoice) within 180 days
//   - One piece of feedback every ~35 days
//
// Auth: header x-cron-secret == CRON_SECRET (fails closed if CRON_SECRET is not set).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET, FOUNDING_AUTO_REVERT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const LISTING_DAYS = 7
const JOBS_WINDOW_DAYS = 180
const FEEDBACK_WINDOW_DAYS = 35
const GRACE_DAYS = 14

const GREEN = '#1DB954'
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'

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

function daysSince(iso: string | null): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function warnEmail(name: string, outstanding: string[], graceEnds: string) {
  const items = outstanding.map((o) => `<li style="margin:0 0 6px;">${esc(o)}</li>`).join('')
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0f;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
  <tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${GREEN};">LensTrybe</div></td></tr>
  <tr><td style="padding:22px 36px 8px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#f59e0b;margin-bottom:10px;">Founding deal, action needed</div>
  <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#fff;">Hi ${esc(name)}, a quick heads-up</h1>
  <p style="margin:0 0 14px;color:#9a9aa8;font-size:15px;line-height:1.6;">To keep your founding deal (12 months free Expert, then $49/mo for life), there's a little left to do:</p>
  <ul style="color:#fff;font-size:14px;line-height:1.5;padding-left:20px;margin:0 0 14px;">${items}</ul>
  <p style="margin:0 0 4px;color:#9a9aa8;font-size:14px;line-height:1.6;">Please sort it by <strong style="color:#fff;">${esc(graceEnds)}</strong> to keep your deal. Everything is tracked in your Founding Hub.</p>
  </td></tr>
  <tr><td style="padding:22px 36px 4px;"><table role="presentation"><tr><td style="border-radius:10px;background:${GREEN};"><a href="https://lenstrybe.com/dashboard/founding" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">Open your Founding Hub</a></td></tr></table></td></tr>
  <tr><td style="padding:26px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:12px;color:#6a6a78;">Questions? Just reply to this email. Connect. Capture. Create.</div></td></tr>
  </table></td></tr></table></body></html>`
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
  } catch (_e) { /* best effort */ }
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)

  // Cron only. Fails closed if CRON_SECRET is not configured.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    console.error('CRON_SECRET is not set')
    return json({ error: 'Not configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-cron-secret') || '', cronSecret)) return json({ error: 'Unauthorized' }, 401)

  const autoRevert = (Deno.env.get('FOUNDING_AUTO_REVERT') || '').toLowerCase() === 'true'
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: founders, error } = await sb
    .from('profiles')
    .select('id, business_name, business_email, founding_member_since, founding_deal_status, founding_warned_at')
    .eq('founding_member', true)
    .neq('founding_deal_status', 'reverted')
  if (error) {
    console.error('founding-check: query failed', error.message)
    return json({ error: 'Query failed' }, 500)
  }

  const counts: Record<string, number> = {}

  for (const f of founders || []) {
    try {
      const age = daysSince(f.founding_member_since)
      const [lc, jc, fb] = await Promise.all([
        sb.rpc('founding_listing_complete', { p_id: f.id }),
        sb.rpc('founding_job_count', { p_id: f.id }),
        sb.from('founding_feedback').select('created_at').eq('creative_id', f.id).order('created_at', { ascending: false }).limit(1),
      ])
      const listingOk = Boolean(lc.data)
      const jobs = Number(jc.data || 0)
      const lastFb = fb.data && fb.data[0] ? fb.data[0].created_at : null

      const outstanding: string[] = []
      if (age > LISTING_DAYS && !listingOk) outstanding.push('Complete your profile to 100%')
      if (age > JOBS_WINDOW_DAYS && jobs < 3) outstanding.push(`Run your first 3 jobs through LensTrybe (${jobs} of 3 done)`)
      if (age > FEEDBACK_WINDOW_DAYS && daysSince(lastFb) > FEEDBACK_WINDOW_DAYS) outstanding.push('Share a piece of feedback')

      const status = String(f.founding_deal_status || 'active')
      const updates: Record<string, unknown> = {}

      if (outstanding.length === 0) {
        if (status !== 'active' || f.founding_warned_at) { updates.founding_deal_status = 'active'; updates.founding_warned_at = null }
      } else if (!f.founding_warned_at) {
        // First time unmet: warn and start the grace clock.
        updates.founding_deal_status = 'at_risk'
        updates.founding_warned_at = new Date().toISOString()
        const graceEnds = new Date(Date.now() + GRACE_DAYS * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
        if (f.business_email) await sendEmail(f.business_email, 'Your LensTrybe founding deal needs a quick action', warnEmail(f.business_name || 'there', outstanding, graceEnds))
      } else if (daysSince(f.founding_warned_at) >= GRACE_DAYS) {
        // Grace elapsed and still unmet.
        if (autoRevert) {
          updates.founding_deal_status = 'reverted'
          // Move billing to standard pricing (keep the badge; deal simply ends).
          const { data: sub } = await sb.from('subscriptions').select('id, billing').eq('user_id', f.id).maybeSingle()
          if (sub) {
            const amount = sub.billing === 'annual' ? 74990 : 7499
            await sb.from('subscriptions').update({ founding_member: false, amount_minor: amount, updated_at: new Date().toISOString() }).eq('id', sub.id)
          }
        } else {
          updates.founding_deal_status = 'revert_pending'
        }
      } else {
        if (status !== 'at_risk') updates.founding_deal_status = 'at_risk'
      }

      if (Object.keys(updates).length > 0) await sb.from('profiles').update(updates).eq('id', f.id)
      const finalStatus = String(updates.founding_deal_status || status)
      counts[finalStatus] = (counts[finalStatus] || 0) + 1
    } catch (e) {
      console.error('founding-check: error on founder', f.id, e instanceof Error ? e.message : String(e))
      counts.errors = (counts.errors || 0) + 1
    }
  }

  return json({ ran_at: new Date().toISOString(), checked: (founders || []).length, auto_revert: autoRevert, counts })
})
