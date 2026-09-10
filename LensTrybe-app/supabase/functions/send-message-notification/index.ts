import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: unknown) { return esc(s).replace(/\n/g, '<br>') }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; panelHtml?: string; ctaText?: string; ctaUrl?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', panelHtml = '', ctaText, ctaUrl, footNote = '' } = opts
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.pageBg};">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;font-family:${BRAND.font};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${BRAND.green};letter-spacing:-0.02em;">LensTrybe</div></td></tr>
<tr><td style="padding:22px 36px 8px;">
${kicker ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(kicker)}</div>` : ''}
<h1 style="margin:0 0 ${intro ? '10px' : '4px'};font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${heading}</h1>
${intro ? `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${intro}</p>` : ''}
</td></tr>
${panelHtml ? `<tr><td style="padding:18px 36px 0;">${panelHtml}</td></tr>` : ''}
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td></tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:13px;font-weight:700;color:${BRAND.text};">LensTrybe</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}
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
  const bodyText =
    `${fromName} has applied for your job "${title}".\n\n` +
    `Offer: AUD ${Number.isFinite(price) ? price.toFixed(2) : '0.00'}\n` +
    `What's included: ${preview(app.includes || '-', 500)}\n\n` +
    `Cover message: ${preview(app.description || app.message || '', 1500)}`

  if (poster.isCreative) {
    try {
      await admin.from('notifications').insert({
        user_id: job.posted_by, type: 'message', title: `New application from ${fromName}`,
        body: preview(`For "${title}"`, 140), link: '/dashboard', meta: { job_id: job.id },
      })
    } catch (_e) { /* non-blocking */ }
  }

  const html = emailShell({
    preheader: `${fromName} applied for your job on LensTrybe`,
    kicker: 'New application',
    heading: `${esc(fromName)} applied for your job`,
    intro: `Regarding <span style="color:${BRAND.text};">${esc(title)}</span>`,
    panelHtml: panel(
      `${toName ? `<p style="margin:0 0 12px;color:${BRAND.muted};font-size:14px;">Hi ${esc(plain(toName, 60))},</p>` : ''}` +
      `<p style="margin:0;color:${BRAND.text};font-size:15px;line-height:1.7;">${nl2br(bodyText)}</p>`
    ),
    ctaText: 'View applications on LensTrybe',
    ctaUrl: poster.isCreative ? `${APP}/dashboard` : `${APP}/client-dashboard`,
    footNote: `You're receiving this because you posted a job on LensTrybe.`,
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

    if (recipientIsCreative) {
      try {
        await admin.from('notifications').insert({
          user_id: thread.creative_id, type: 'message', title: `New message from ${fromName}`,
          body: preview(msg.body || threadSubject, 140) || null, link: '/dashboard/clients/messages', meta: { thread_id: thread.id },
        })
      } catch (_e) { /* non-blocking */ }
    }

    const hi = toName ? `Hi ${esc(plain(toName, 60))},` : ''
    const html = emailShell({
      preheader: `${fromName} sent you a message on LensTrybe`,
      kicker: 'New message',
      heading: `${esc(fromName)} sent you a message`,
      intro: threadSubject ? `Regarding <span style="color:${BRAND.text};">${esc(threadSubject)}</span>` : '',
      panelHtml: panel(
        `${hi ? `<p style="margin:0 0 12px;color:${BRAND.muted};font-size:14px;">${hi}</p>` : ''}` +
        `<p style="margin:0;color:${BRAND.text};font-size:15px;line-height:1.7;">${nl2br(preview(msg.body, 2000))}</p>`
      ),
      ctaText: 'Reply on LensTrybe',
      ctaUrl,
      footNote: replyTo
        ? `You can reply straight to this email to reach ${esc(fromName)}, or open LensTrybe to reply in the conversation.`
        : `You're receiving this because you have an active conversation on LensTrybe.`,
    })

    const res = await sendEmail(RESEND_API_KEY, { to, subject: plain(`New message from ${fromName} on LensTrybe`, 150), html, replyTo })
    if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
    return json({ success: true })
  } catch (err) {
    console.error('send-message-notification error', err)
    return json({ error: 'Could not send notification' }, 500)
  }
})
