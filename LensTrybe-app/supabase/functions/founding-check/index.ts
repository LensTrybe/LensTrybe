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
//   - One piece of feedback a month: a light-touch nudge only (a friendly reminder email,
//     at most once per window). It never puts the deal at risk on its own.
//
// Auth: header x-cron-secret == CRON_SECRET (fails closed if CRON_SECRET is not set).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET, FOUNDING_AUTO_REVERT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { warnEmail, nudgeEmail, WARN_SUBJECT, NUDGE_SUBJECT } from './emails.ts'

const LISTING_DAYS = 7
const JOBS_WINDOW_DAYS = 180
const FEEDBACK_WINDOW_DAYS = 35
const GRACE_DAYS = 14

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

function daysSince(iso: string | null): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

async function sendEmail(to: string, subject: string, html: string, unsubToken: string | null = null) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  const payload: Record<string, unknown> = { from: FROM, to, reply_to: 'connect@lenstrybe.com', subject, html }
  // RFC 8058 one-click unsubscribe, the same as founding-invites.
  if (unsubToken) {
    const base = Deno.env.get('SUPABASE_URL') || ''
    payload.headers = {
      'List-Unsubscribe': `<${unsubscribeUrl(unsubToken)}>, <${base}/functions/v1/email-preferences?token=${unsubToken}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (_e) { /* best effort */ }
}

// The monthly feedback nudge is a reminder, so it carries an unsubscribe link (Spam Act). It uses
// the same email_subscribers row as founding invites and the Edit, so unsubscribing once stops
// every non-essential email; the deal-at-risk warning is a service message and still goes.
// A new row is made with source 'founding-invite', which does not sign anyone up to the Edit.
const SITE = 'https://lenstrybe.com'
function unsubscribeUrl(token: string) { return `${SITE}/unsubscribe/${token}` }
// deno-lint-ignore no-explicit-any
async function findSubscriber(sb: any, e: string) {
  const pattern = e.replace(/[%_\\]/g, (m) => '\\' + m)
  const { data } = await sb.from('email_subscribers').select('token, status').ilike('email', pattern).limit(1)
  return (data ?? [])[0] as { token: string; status: string } | undefined
}
// deno-lint-ignore no-explicit-any
async function subscriber(sb: any, email: string): Promise<{ token: string | null; optedOut: boolean }> {
  const e = String(email || '').trim().toLowerCase()
  if (!e) return { token: null, optedOut: false }
  const found = await findSubscriber(sb, e)
  if (found) return { token: found.token, optedOut: found.status === 'unsubscribed' }
  const { data: made, error } = await sb.from('email_subscribers')
    .insert({ email: e, status: 'subscribed', source: 'founding-invite', consented_at: new Date().toISOString() })
    .select('token, status').maybeSingle()
  if (made) return { token: made.token as string, optedOut: made.status === 'unsubscribed' }
  if (error) {
    const again = await findSubscriber(sb, e)
    if (again) return { token: again.token, optedOut: again.status === 'unsubscribed' }
    console.error('founding-check subscriber', error.message)
  }
  return { token: null, optedOut: false }
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
    .select('id, business_name, business_email, founding_member_since, founding_deal_status, founding_warned_at, founding_feedback_nudged_at')
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
      // Feedback is light-touch: a friendly reminder, never a deal condition.
      const feedbackDue = age > FEEDBACK_WINDOW_DAYS && (!lastFb || daysSince(lastFb) > FEEDBACK_WINDOW_DAYS)
      const nudgedRecently = f.founding_feedback_nudged_at && daysSince(f.founding_feedback_nudged_at) <= FEEDBACK_WINDOW_DAYS

      const status = String(f.founding_deal_status || 'active')
      const updates: Record<string, unknown> = {}

      if (feedbackDue && !nudgedRecently && f.business_email) {
        const sub = await subscriber(sb, f.business_email)
        if (!sub.optedOut) await sendEmail(f.business_email, NUDGE_SUBJECT, nudgeEmail(f.business_name || 'there', sub.token ? unsubscribeUrl(sub.token) : null), sub.token)
        updates.founding_feedback_nudged_at = new Date().toISOString()
        counts.feedback_nudged = (counts.feedback_nudged || 0) + 1
      }

      if (outstanding.length === 0) {
        if (status !== 'active' || f.founding_warned_at) { updates.founding_deal_status = 'active'; updates.founding_warned_at = null }
      } else if (!f.founding_warned_at) {
        // First time unmet: warn and start the grace clock.
        updates.founding_deal_status = 'at_risk'
        updates.founding_warned_at = new Date().toISOString()
        const graceEnds = new Date(Date.now() + GRACE_DAYS * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
        if (f.business_email) await sendEmail(f.business_email, WARN_SUBJECT, warnEmail(f.business_name || 'there', outstanding, graceEnds))
      } else if (daysSince(f.founding_warned_at) >= GRACE_DAYS) {
        // Grace elapsed and still unmet.
        if (autoRevert) {
          // End the deal (shared with the admin End founding deal button): standard price,
          // the free period ends with the first payment 7 days later, badge kept. Then tell them.
          const { data: res } = await sb.rpc('founding_end_deal', { p_profile: f.id })
          if (res?.ok) {
            updates.founding_deal_status = 'reverted'
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-billing-email`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: f.id, kind: 'founding_ended', tier: res.tier || 'expert', amount_minor: res.amount_minor, currency: 'AUD', billing: res.billing, first_charge_date: res.first_charge_date }),
              })
            } catch (_e) { /* best effort */ }
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
