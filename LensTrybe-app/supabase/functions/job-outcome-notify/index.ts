import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; panelHtml?: string; ctaText?: string; ctaUrl?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', panelHtml = '', ctaText, ctaUrl, footNote = '' } = opts
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.pageBg};">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;font-family:${BRAND.font};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><a href="https://lenstrybe.com" style="display:inline-block;text-decoration:none;"><img src="https://lenstrybe.com/email-logo-white.png" width="180" height="38" alt="LensTrybe" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:38px;" /></a></td></tr>
<tr><td style="padding:22px 36px 8px;">
${kicker ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(kicker)}</div>` : ''}
<h1 style="margin:0 0 ${intro ? '10px' : '4px'};font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${heading}</h1>
${intro ? `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${intro}</p>` : ''}
</td></tr>
${panelHtml ? `<tr><td style="padding:18px 36px 0;">${panelHtml}</td></tr>` : ''}
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td></tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:12px;font-weight:400;letter-spacing:0.24em;color:${BRAND.text};">LENSTRYBE</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}
// ---- end shared ----

const APP = 'https://lenstrybe.com'
// Old-site paths until the swap; then /app/threads and /app/jobs.
const THREADS_URL = `${APP}/dashboard/clients/messages`
const JOBS_URL = `${APP}/dashboard/my-work/jobs`
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }

// Called by the job's poster right after accept_job_application. Emails the accepted creative
// ("your quote was accepted") and everyone whose reply was closed ("that job has been filled").
// Declined replies only get the in-app notification. Each reply is emailed once per outcome.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const resendKey = Deno.env.get('RESEND_API_KEY') || ''
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorised' }, 401)
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return json({ error: 'Unauthorised' }, 401)

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
    const jobId = typeof body.job_id === 'string' ? body.job_id : ''
    if (!UUID_RE.test(jobId)) return json({ error: 'Invalid job' }, 400)

    const { data: job } = await admin.from('job_listings').select('id, title, posted_by, poster_name, status').eq('id', jobId).maybeSingle()
    if (!job || job.posted_by !== user.id) return json({ error: 'Not found' }, 404)
    if (job.status !== 'filled') return json({ success: true, skipped: 'not_filled' })

    const { data: apps } = await admin.from('job_applications').select('id, creative_id, creative_name, price, status').eq('job_id', jobId).in('status', ['accepted', 'closed'])
    const title = plain(job.title || 'a job', 120)
    const who = plain(job.poster_name || 'The client', 80)
    let sent = 0
    for (const a of apps || []) {
      const { data: ok } = await admin.rpc('rate_limit_hit', { p_key: `job-outcome:${a.id}:${a.status}`, p_max: 1, p_window_seconds: 2592000 })
      if (ok === false) continue
      const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', a.creative_id).maybeSingle()
      let to = prof?.business_email || ''
      if (!to) { const { data: u } = await admin.auth.admin.getUserById(a.creative_id); to = u?.user?.email || '' }
      if (!to || !resendKey) continue
      const name = plain(prof?.business_name || a.creative_name || '', 60)
      const price = Number(a.price ?? 0)
      const html = a.status === 'accepted'
        ? emailShell({
            preheader: `${who} accepted your quote for ${title}`, kicker: 'Job board', heading: 'Your quote was accepted',
            intro: `${name ? `Hi ${esc(name)}, ` : ''}<span style="color:${BRAND.text};">${esc(who)}</span> wants to go ahead. They've messaged you, so reply in your threads to sort out the details.`,
            panelHtml: panel(`<div style="font-size:14px;color:${BRAND.text};line-height:1.7;"><strong>Job:</strong> ${esc(title)}<br><strong>Your price:</strong> AUD ${Number.isFinite(price) ? price.toFixed(2) : '0.00'}</div>`),
            ctaText: 'Open your threads', ctaUrl: THREADS_URL,
            footNote: "They're also in your CRM as a lead.",
          })
        : emailShell({
            preheader: `${title} has been filled`, kicker: 'Job board', heading: 'That job has been filled',
            intro: `${name ? `Hi ${esc(name)}, ` : ''}thanks for replying to <span style="color:${BRAND.text};">${esc(title)}</span>. The client went with someone else this time.`,
            ctaText: 'See open jobs', ctaUrl: JOBS_URL,
            footNote: 'You get this once per job you reply to.',
          })
      const subject = a.status === 'accepted' ? plain(`Your quote for ${title} was accepted`, 150) : plain(`${title} has been filled`, 150)
      try {
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [to], subject, html }) })
        if (r.ok) sent++; else console.error('resend failed', r.status, await r.text().catch(() => ''))
      } catch (e) { console.error('resend error', e) }
    }
    return json({ success: true, sent })
  } catch (err) {
    console.error('job-outcome-notify error', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
