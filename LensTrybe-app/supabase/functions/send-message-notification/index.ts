import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { jobApplicationHtml, cappedEnquiryHtml, messageHtml } from './emails.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// ---- end shared ----

// Links are always built server-side from a fixed base.
const APP = 'https://lenstrybe.com'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AGE_MS = 15 * 60 * 1000
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }
function preview(s: unknown, max: number) { const t = String(s ?? '').trim(); return t.length > max ? `${t.slice(0, max)}...` : t }

// deno-lint-ignore no-explicit-any
type Admin = any

async function limited(admin: Admin, key: string, max: number, windowSeconds: number) {
  const { data, error } = await admin.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
  if (error) { console.error('rate_limit_hit failed', error); return true }
  return data === false
}

async function authEmail(admin: Admin, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    return data?.user?.email || null
  } catch (_e) { return null }
}

// Email address for a creative: their business email, else their login email.
async function creativeEmail(admin: Admin, creativeId: string) {
  const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', creativeId).maybeSingle()
  const email = prof?.business_email || await authEmail(admin, creativeId)
  return { email, name: prof?.business_name || null, isCreative: !!prof }
}

// ---- capped creative notification ----
// A creative at their monthly reply cap still receives enquiries, they just cannot answer
// until the month turns over. Telling them a named lead is sitting there is a far stronger
// prompt than a counter on a dashboard they have not opened.

// Replies are counted per UTC month, so the cap lifts at the start of the next UTC month.
function replyResetLabel() {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return next.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

function tierLabel(t: unknown) {
  const s = String(t ?? 'basic').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Returns null when usage cannot be read or the creative is not capped, so every failure
// path falls back to the ordinary notification rather than losing the email.
async function cappedInfo(admin: Admin, creativeId: string) {
  try {
    const { data, error } = await admin.rpc('creative_reply_usage', { p_creative: creativeId })
    if (error) { console.error('creative_reply_usage failed', error.message); return null }
    const row = Array.isArray(data) ? data[0] : data
    if (!row || row.unlimited) return null
    const used = Number(row.used ?? 0)
    const cap = Number(row.max_allowed ?? 0)
    if (!cap || used < cap) return null
    const { data: prof } = await admin.from('profiles').select('subscription_tier').eq('id', creativeId).maybeSingle()
    return { used, cap, tier: tierLabel(prof?.subscription_tier) }
  } catch (e) {
    console.error('creative_reply_usage threw', (e as Error)?.message)
    return null
  }
}

async function handleJobApplication(admin: Admin, resendKey: string, user: { id: string; email?: string }, applicationId: string) {
  const { data: app } = await admin.from('job_applications')
    .select('id, job_id, creative_id, creative_name, price, includes, description, message, created_at')
    .eq('id', applicationId).maybeSingle()
  if (!app) return json({ error: 'Application not found' }, 404)
  if (app.creative_id !== user.id) return json({ error: 'Forbidden' }, 403)
  if (Date.now() - new Date(app.created_at).getTime() > MAX_AGE_MS) return json({ success: true, skipped: 'stale' })
  if (await limited(admin, `msg-notify:jobapp:${app.id}`, 1, 86400)) return json({ success: true, skipped: 'already_notified' })
  if (await limited(admin, `msg-notify:user:${user.id}`, 60, 3600)) return json({ error: 'Too many requests' }, 429)

  const { data: job } = await admin.from('job_listings').select('id, title, posted_by, poster_name').eq('id', app.job_id).maybeSingle()
  if (!job?.posted_by || job.posted_by === user.id) return json({ success: true, skipped: 'no_recipient' })

  // Recipient is always the job poster's own account address, never a body-supplied one.
  const poster = await creativeEmail(admin, job.posted_by)
  let to = poster.isCreative ? poster.email : null
  let toName = poster.name || job.poster_name || null
  if (!to) {
    const { data: ca } = await admin.from('client_accounts').select('email, first_name, last_name').eq('id', job.posted_by).maybeSingle()
    to = ca?.email || await authEmail(admin, job.posted_by)
    toName = [ca?.first_name, ca?.last_name].filter(Boolean).join(' ') || toName
  }
  if (!to) return json({ success: true, skipped: 'no_recipient' })

  const { data: me } = await admin.from('profiles').select('business_name').eq('id', user.id).maybeSingle()
  const fromName = plain(me?.business_name || app.creative_name || 'A creative', 80)
  const title = plain(job.title || 'your job', 120)
  const price = Number(app.price ?? 0)

  // The poster gets this whether they are a creative or a client. It used to be
  // wrapped in a creative check, so a client's bell could never show an
  // application even though the dashboard polls for one every thirty seconds.
  try {
    await admin.from('notifications').insert({
      user_id: job.posted_by, type: 'message', title: `New application from ${fromName}`,
      body: preview(`For "${title}"`, 140),
      link: poster.isCreative ? '/dashboard/my-work/jobs' : '/client-dashboard?view=jobs',
      meta: { job_id: job.id },
    })
  } catch (_e) { /* non-blocking */ }

  const html = jobApplicationHtml({
    fromName, title, toName: toName ? plain(toName, 60) : '', price,
    includes: preview(app.includes || '-', 500),
    cover: preview(app.description || app.message || '', 1500),
    ctaUrl: poster.isCreative ? `${APP}/dashboard/my-work/jobs` : `${APP}/client-dashboard?view=jobs`,
  })
  const res = await sendEmail(resendKey, { to, subject: plain(`New application for your job: ${title}`, 150), html })
  if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
  return json({ success: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorised' }, 401)
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return json({ error: 'Unauthorised' }, 401)

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

    const jobApplicationId = typeof body.job_application_id === 'string' ? body.job_application_id : ''
    if (jobApplicationId) {
      if (!UUID_RE.test(jobApplicationId)) return json({ error: 'Invalid job_application_id' }, 400)
      return await handleJobApplication(admin, RESEND_API_KEY, user, jobApplicationId)
    }

    const messageId = typeof body.message_id === 'string' ? body.message_id : ''
    if (!UUID_RE.test(messageId)) return json({ error: 'message_id required' }, 400)

    const { data: msg } = await admin.from('messages').select('id, thread_id, body, sender_type, sender_name, created_at').eq('id', messageId).maybeSingle()
    if (!msg?.thread_id) return json({ error: 'Message not found' }, 404)
    const { data: thread } = await admin.from('message_threads')
      .select('id, creative_id, client_user_id, client_name, client_email, subject')
      .eq('id', msg.thread_id).maybeSingle()
    if (!thread) return json({ error: 'Message not found' }, 404)

    const callerIsCreative = thread.creative_id === user.id
    const callerIsClient = !!thread.client_user_id && thread.client_user_id === user.id
    if (!callerIsCreative && !callerIsClient) return json({ error: 'Forbidden' }, 403)
    if (callerIsCreative && callerIsClient) return json({ success: true, skipped: 'self' })
    const senderSide = callerIsCreative ? 'creative' : 'client'
    if (msg.sender_type && msg.sender_type !== senderSide) return json({ error: 'Forbidden' }, 403)
    if (Date.now() - new Date(msg.created_at).getTime() > MAX_AGE_MS) return json({ success: true, skipped: 'stale' })

    if (await limited(admin, `msg-notify:msg:${msg.id}`, 1, 86400)) return json({ success: true, skipped: 'already_notified' })
    if (await limited(admin, `msg-notify:user:${user.id}`, 60, 3600)) return json({ error: 'Too many requests' }, 429)

    const threadSubject = plain(thread.subject || '', 150)
    let to: string | null = null
    let toName: string | null = null
    let fromName = ''
    let replyTo: string | undefined
    let ctaUrl = `${APP}/client-dashboard`
    let recipientIsCreative = false

    if (callerIsClient) {
      // Client -> creative
      const c = await creativeEmail(admin, thread.creative_id)
      to = c.email
      toName = c.name
      fromName = plain(msg.sender_name || thread.client_name || 'A client', 80)
      replyTo = user.email || undefined
      ctaUrl = `${APP}/dashboard/clients/messages`
      recipientIsCreative = true
    } else {
      // Creative -> client
      const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', thread.creative_id).maybeSingle()
      fromName = plain(prof?.business_name || msg.sender_name || 'Your creative', 80)
      replyTo = prof?.business_email || user.email || undefined
      toName = thread.client_name || null
      if (thread.client_user_id) {
        const { data: ca } = await admin.from('client_accounts').select('email').eq('id', thread.client_user_id).maybeSingle()
        to = ca?.email || await authEmail(admin, thread.client_user_id) || thread.client_email || null
        if (!ca) {
          // The client side may itself be a creative (for example a marketplace buyer).
          const { data: buyerProf } = await admin.from('profiles').select('id').eq('id', thread.client_user_id).maybeSingle()
          if (buyerProf) ctaUrl = `${APP}/dashboard/clients/messages`
        }
      } else {
        to = thread.client_email || null
        if (to) {
          const { data: portal } = await admin.from('client_portals').select('portal_token')
            .eq('creative_id', thread.creative_id).ilike('client_email', to.replace(/[\\%_]/g, (m) => `\\${m}`)).limit(1).maybeSingle()
          if (portal?.portal_token) ctaUrl = `${APP}/portal/${encodeURIComponent(String(portal.portal_token))}`
        }
      }
    }
    if (!to) return json({ success: true, skipped: 'no_recipient' })

    // Both sides get a row. A client whose creative replies used to get the
    // email and nothing in the product. A client with no account (a portal only
    // client) has no client_user_id and no bell to put this in, so they still
    // get the email alone.
    const notifyUserId = recipientIsCreative ? thread.creative_id : thread.client_user_id
    if (notifyUserId) {
      try {
        await admin.from('notifications').insert({
          user_id: notifyUserId, type: 'message', title: `New message from ${fromName}`,
          body: preview(msg.body || threadSubject, 140) || null,
          link: recipientIsCreative ? '/dashboard/clients/messages' : '/client-dashboard',
          meta: { thread_id: thread.id },
        })
      } catch (_e) { /* non-blocking */ }
    }

    const hi = toName ? `Hi ${plain(toName, 60)},` : ''

    // A capped creative gets the upgrade variant instead, but only once a week. Ten
    // enquiries in a capped month should not mean ten emails telling them they cannot
    // answer: that reads as nagging and it is the same news every time.
    let capped = recipientIsCreative ? await cappedInfo(admin, thread.creative_id) : null
    if (capped && await limited(admin, `msg-notify:capped:${thread.creative_id}`, 1, 7 * 86400)) capped = null

    let subject: string
    let html: string
    if (capped) {
      const subjectLine = threadSubject || 'a new project'
      subject = plain(`New enquiry from ${fromName}, reply limit reached`, 150)
      html = cappedEnquiryHtml({ fromName, threadSubject, subjectLine, hi, cap: capped.cap, tier: capped.tier, resetLabel: replyResetLabel(), messagesUrl: ctaUrl, upgradeUrl: `${APP}/dashboard/settings/subscription` })
    } else {
      subject = plain(`New message from ${fromName} on LensTrybe`, 150)
      html = messageHtml({ fromName, threadSubject, hi, message: preview(msg.body, 2000), ctaUrl, canReply: !!replyTo })
    }

    const res = await sendEmail(RESEND_API_KEY, { to, subject, html, replyTo })
    if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
    return json({ success: true })
  } catch (err) {
    console.error('send-message-notification error', err)
    return json({ error: 'Could not send notification' }, 500)
  }
})
