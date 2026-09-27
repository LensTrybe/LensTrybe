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

// Where the links in the email and the bell go: the site the job was posted from (Next before the
// swap, lenstrybe.com after), never anything else.
const SITES = ['https://lenstrybe.com', 'https://www.lenstrybe.com', 'https://next.lenstrybe.com']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PER_DAY = 3
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }
function money(v: unknown) { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? 'AUD ' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : 'Not given' }

// Called by the poster right after posting a job. Tells creatives who fit (their kind of work, their
// state or no state set, not opted out) with an email and a bell notification. Once per job; at most
// PER_DAY emails a day per creative (the bell still lands).
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

    const { data: job } = await admin.from('job_listings').select('id, title, description, location, job_date, budget_range, creative_types, posted_by, status').eq('id', jobId).maybeSingle()
    if (!job || job.posted_by !== user.id) return json({ error: 'Not found' }, 404)
    if (job.status !== 'active') return json({ success: true, skipped: 'not_active' })

    const { data: once } = await admin.rpc('rate_limit_hit', { p_key: `job-alert:${jobId}`, p_max: 1, p_window_seconds: 2592000 })
    if (once === false) return json({ success: true, skipped: 'already_sent' })

    const origin = req.headers.get('origin') || ''
    const site = SITES.includes(origin) ? origin : 'https://lenstrybe.com'
    const jobsUrl = `${site}/app/jobs`
    const settingsUrl = `${site}/app/settings`

    const { data: people, error: rErr } = await admin.rpc('job_alert_recipients', { p_job: jobId })
    if (rErr) { console.error('recipients failed', rErr); return json({ error: 'Something went wrong.' }, 500) }

    const title = plain(job.title || 'A new job', 120)
    const where = plain(job.location || '', 80)
    const when = job.job_date ? new Date(job.job_date + 'T00:00:00+10:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Australia/Brisbane' }) : 'Flexible'
    const who = (job.creative_types || []).join(' or ') || 'Creative'
    const brief = plain(job.description || '', 260)
    let emailed = 0, belled = 0
    for (const p of people || []) {
      try {
        const { error: nErr } = await admin.from('notifications').insert({ user_id: p.id, type: 'job', title: 'New job: ' + title, body: [where, when, money(job.budget_range)].filter(Boolean).join(' · '), link: '/app/jobs', meta: { job_id: jobId } })
        if (!nErr) belled++
      } catch (_) { /* bell is best effort */ }
      if (!p.email || !resendKey) continue
      const { data: ok } = await admin.rpc('rate_limit_hit', { p_key: `job-alert-user:${p.id}`, p_max: PER_DAY, p_window_seconds: 86400 })
      if (ok === false) continue
      const name = plain(p.name || '', 60)
      const html = emailShell({
        preheader: `${title} · ${where}`, kicker: 'Job board', heading: 'A new job that fits your work',
        intro: `${name ? `Hi ${esc(name)}, ` : ''}a client just posted a job on LensTrybe. Reply with your price and what's included, and they pick who they want.`,
        panelHtml: panel(`<div style="font-size:15px;font-weight:700;color:${BRAND.text};margin-bottom:8px;">${esc(title)}</div><div style="font-size:14px;color:${BRAND.muted};line-height:1.7;"><strong style="color:${BRAND.text};">Who:</strong> ${esc(who)}<br><strong style="color:${BRAND.text};">Where:</strong> ${esc(where || 'Not given')}<br><strong style="color:${BRAND.text};">When:</strong> ${esc(when)}<br><strong style="color:${BRAND.text};">Budget:</strong> ${esc(money(job.budget_range))}</div>${brief ? `<div style="font-size:14px;color:${BRAND.muted};line-height:1.6;margin-top:10px;">${esc(brief)}${(job.description || '').length > 260 ? '…' : ''}</div>` : ''}`),
        ctaText: 'Reply with a quote', ctaUrl: jobsUrl,
        footNote: `You get these because you're a creative on LensTrybe. At most ${PER_DAY} a day. <a href="${settingsUrl}" style="color:${BRAND.green};text-decoration:none;">Turn job alerts off in Settings</a>.`,
      })
      try {
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [p.email], subject: plain(`New job: ${title}${where ? ', ' + where : ''}`, 150), html }) })
        if (r.ok) emailed++; else console.error('resend failed', r.status, await r.text().catch(() => ''))
      } catch (e) { console.error('resend error', e) }
    }
    return json({ success: true, emailed, belled })
  } catch (err) {
    console.error('job-alert error', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
