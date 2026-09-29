import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { quoteAcceptedHtml, jobFilledHtml } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
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
        ? quoteAcceptedHtml({ name, who, title, price, threadsUrl: THREADS_URL })
        : jobFilledHtml({ name, title, jobsUrl: JOBS_URL })
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
