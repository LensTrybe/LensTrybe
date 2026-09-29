import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { jobAlertHtml } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
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
      const html = jobAlertHtml({ name, title, who, where, when, budget: money(job.budget_range), brief, briefCut: (job.description || '').length > 260, perDay: PER_DAY, jobsUrl, settingsUrl })
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
