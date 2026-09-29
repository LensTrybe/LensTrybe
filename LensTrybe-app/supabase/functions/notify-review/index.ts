import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { newReviewEmail } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// ---- end shared ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/.test(s) }
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  // Accept only a review id; everything else comes from the saved review.
  const reviewId = String(body.review_id || body.reviewId || '')
  if (!UUID_RE.test(reviewId)) return json({ error: 'review_id required' }, 400)

  const { data: review } = await supabase.from('reviews').select('*').eq('id', reviewId).maybeSingle()
  if (!review || !review.creative_id) return json({ error: 'Review not found' }, 404)
  // Only notify for fresh reviews, and only once per review.
  const createdMs = review.created_at ? new Date(review.created_at).getTime() : 0
  if (review.notified_at || !createdMs || Date.now() - createdMs > 24 * 60 * 60 * 1000) return json({ success: true, skipped: true })
  const { data: claimed, error: claimErr } = await supabase.from('reviews').update({ notified_at: new Date().toISOString() }).eq('id', reviewId).is('notified_at', null).select('id')
  if (claimErr) { console.error('notify-review claim failed', claimErr); return json({ error: 'Could not send the notification' }, 500) }
  if (!Array.isArray(claimed) || !claimed.length) return json({ success: true, skipped: true })

  const creativeId = String(review.creative_id)
  const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating || 0)) || 0))
  const reviewerName = plain(review.reviewer_name || review.client_name || 'A client', 100) || 'A client'
  const comment = String(review.comment || review.body || '').slice(0, 2000)

  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', creativeId).maybeSingle()
  const creativeEmail = isEmail(profile?.business_email) ? profile.business_email : null

  // In-app notification for the creative (best effort).
  try {
    await supabase.from('notifications').insert({
      user_id: creativeId,
      type: 'review',
      title: `You have a new ${rating ? rating + '-star ' : ''}review`,
      body: comment ? String(comment).slice(0, 140) : `from ${reviewerName}`,
      link: '/dashboard/business/reviews',
      meta: { rating },
    })
  } catch (_e) { /* non-blocking */ }

  if (!creativeEmail) return json({ success: true, emailed: false })

  const email = newReviewEmail({ rating, reviewerName, comment })

  await sendEmail(resendKey, {
    to: creativeEmail,
    subject: email.subject,
    html: email.html,
  })

  return json({ success: true })
})
