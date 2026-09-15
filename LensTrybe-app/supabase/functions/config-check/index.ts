// Supabase Edge Function: config-check
//
// Answers the one question the health-check runbook promises to answer every run and
// until now could not: is the configuration valid.
//
// The runbook's absolute mode asks "is the secret present", "is the configuration
// valid". Nothing could actually check that, because the answers live in Supabase
// secrets, which a session cannot read. So the checks were aspirational, and a whole
// class of problem went unseen. On 15 September 2026, in one afternoon, four of them
// surfaced by chance rather than by any check:
//
//   REVOLUT_ENV falls back to 'sandbox' when unset, and a sandbox run returns 200 with
//   charged counts, so from launch day no money would be collected and nothing would
//   error.
//
//   GOOGLE_VISION_API_KEY missing, or set but pointing at a project without the Vision
//   API enabled, makes checkImage return not-blocked. A broken key fails exactly like
//   no key, and every image check in the app silently passes everything.
//
//   The posters bucket was public, which defeated the tier and date gate on poster
//   images entirely.
//
//   The launch date is written in three places that cannot import each other.
//
// None of those are visible in the repo, none are covered by a build or a test, and
// each fails silently in the permissive direction. That is what this function is for.
//
// It returns booleans and short labels, never a secret's value. The closest it comes is
// reporting whether a key has a live or test prefix, which is a property of the key and
// not the key itself.
//
// Auth: header `x-cron-secret` == CRON_SECRET. Fails closed if CRON_SECRET is not set.
// Secrets read: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REVOLUT_ENV,
//   REVOLUT_SECRET_KEY, RESEND_API_KEY, GOOGLE_VISION_API_KEY, PDFSHIFT_API_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Constant time, so this endpoint cannot be used to guess the secret a byte at a time.
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// The launch instant, third and last copy. src/lib/launch.js and waitlist-signup hold
// the other two. This function exists partly to shout when they stop agreeing, so the
// value is repeated here deliberately rather than imported.
const LAUNCH_ISO = '2026-10-01T00:00:00+10:00'

type Check = { id: string; ok: boolean; severity: 'red' | 'amber' | 'info'; detail: string }

export function summarise(checks: Check[]) {
  const failed = checks.filter((c) => !c.ok)
  return {
    ok: failed.length === 0,
    red: failed.filter((c) => c.severity === 'red').map((c) => c.id),
    amber: failed.filter((c) => c.severity === 'amber').map((c) => c.id),
    info: failed.filter((c) => c.severity === 'info').map((c) => c.id),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    console.error('config-check: CRON_SECRET is not set')
    return json({ error: 'Not configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-cron-secret') || '', cronSecret)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const checks: Check[] = []
  const add = (id: string, ok: boolean, severity: Check['severity'], detail: string) =>
    checks.push({ id, ok, severity, detail })

  // ---- Billing. The one that costs money to get wrong. ----
  const revolutEnv = (Deno.env.get('REVOLUT_ENV') || '').toLowerCase()
  add(
    'revolut_env_production',
    revolutEnv === 'production',
    'red',
    revolutEnv
      ? `REVOLUT_ENV is "${revolutEnv}"`
      : 'REVOLUT_ENV is not set, so the billing functions fall back to sandbox',
  )

  const revolutKey = Deno.env.get('REVOLUT_SECRET_KEY') || ''
  add('revolut_key_present', revolutKey.length > 0, 'red', revolutKey ? 'present' : 'missing')
  // Revolut prefixes sandbox keys with sk_ plus a sandbox marker. Report only the shape.
  if (revolutKey) {
    const looksSandbox = /sandbox/i.test(revolutKey)
    add(
      'revolut_key_matches_env',
      looksSandbox === (revolutEnv !== 'production'),
      'red',
      looksSandbox
        ? 'the key looks like a sandbox key'
        : 'the key does not look like a sandbox key',
    )
  }

  // ---- Everything else that fails silently when absent ----
  for (const [name, severity] of [
    ['RESEND_API_KEY', 'red'],
    ['PDFSHIFT_API_KEY', 'amber'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'red'],
  ] as [string, Check['severity']][]) {
    const v = Deno.env.get(name) || ''
    add(`${name.toLowerCase()}_present`, v.length > 0, severity, v ? 'present' : 'missing')
  }

  // ---- Vision. Present is not the same as working. ----
  const visionKey = Deno.env.get('GOOGLE_VISION_API_KEY') || ''
  add('vision_key_present', visionKey.length > 0, 'amber', visionKey ? 'present' : 'missing')
  if (visionKey) {
    // A real call with a 1x1 pixel. If the Vision API is not enabled on the project, or
    // billing is off, or the key is restricted to another API, this is where it shows.
    // Without this, a dead key and a working key look identical from the outside, and
    // every image moderation call in the app quietly passes everything through.
    const onePixelPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    try {
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ image: { content: onePixelPng }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }],
        }),
      })
      const body = await res.json().catch(() => ({}))
      const apiError = body?.error?.message || body?.responses?.[0]?.error?.message
      add(
        'vision_reachable',
        res.ok && !apiError,
        'amber',
        res.ok && !apiError
          ? 'Vision answered a test image'
          : `Vision refused: ${String(apiError || res.status).slice(0, 160)}`,
      )
    } catch (e) {
      add('vision_reachable', false, 'amber', `Vision call threw: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ---- Storage. A bucket flipping public is a silent data exposure. ----
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Buckets that must never be public. Anything holding a document, a private file, or
  // content that is gated by rules the public object endpoint does not apply.
  const MUST_BE_PRIVATE = ['posters', 'contracts', 'credentials', 'deliveries', 'receipts', 'message-attachments']
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) throw error
    const byId = new Map((buckets || []).map((b) => [b.id, b]))
    const leaked = MUST_BE_PRIVATE.filter((id) => byId.get(id)?.public === true)
    const missing = MUST_BE_PRIVATE.filter((id) => !byId.has(id))
    add(
      'private_buckets_are_private',
      leaked.length === 0,
      'red',
      leaked.length ? `public when they must not be: ${leaked.join(', ')}` : 'all private',
    )
    if (missing.length) {
      add('expected_buckets_exist', false, 'amber', `not found: ${missing.join(', ')}`)
    }
  } catch (e) {
    add('private_buckets_are_private', false, 'amber', `could not list buckets: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ---- Cron. A job that silently stops is indistinguishable from a quiet day. ----
  const EXPECTED_JOBS = [
    'revolut-charge-due-daily',
    'billing-reminders-daily',
    'founding-invites-daily',
    'founding-check-daily',
    'deliver-expiry-reminders',
    'purge-deleted-accounts-daily',
    'booking-nudges-daily',
    'enquiry-nudges-6h',
  ]
  try {
    const { data, error } = await supabase.rpc('ops_active_cron_jobs')
    if (error) throw error
    const active = new Set((data as { jobname: string }[] | null)?.map((r) => r.jobname) || [])
    const stopped = EXPECTED_JOBS.filter((j) => !active.has(j))
    add(
      'cron_jobs_active',
      stopped.length === 0,
      'red',
      stopped.length ? `not scheduled or disabled: ${stopped.join(', ')}` : `all ${EXPECTED_JOBS.length} active`,
    )
  } catch (e) {
    add('cron_jobs_active', false, 'amber', `could not read cron jobs: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ---- The launch date, which lives in three places that cannot import each other ----
  const launch = Date.parse(LAUNCH_ISO)
  const claimed = req.headers.get('x-expected-launch')
  if (claimed) {
    add(
      'launch_date_agrees',
      Date.parse(claimed) === launch,
      'red',
      Date.parse(claimed) === launch
        ? 'matches the caller'
        : `this function holds ${LAUNCH_ISO}, the caller passed ${claimed}`,
    )
  }

  return json({
    checked_at: new Date().toISOString(),
    launch_date: LAUNCH_ISO,
    launched: Date.now() >= launch,
    summary: summarise(checks),
    checks,
  })
})
