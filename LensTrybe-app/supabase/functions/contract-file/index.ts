// Supabase Edge Function: contract-file
//
// The contracts bucket is private, so a contract file can only be opened through a
// signature this function issues. The client-facing signing page is unauthenticated and
// holds nothing but a signing token, and the page loads through contract_for_signing,
// a Postgres function, which cannot mint a signed URL. Hence this.
//
// Two ways in, both checked server side:
//   { token }        a signing token, for the client on /sign/:token
//   { contract_id }  with the creative's JWT, for the creative's own dashboard
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'contracts'
// Long enough to read and sign a contract in one sitting, short enough that a forwarded
// link stops working.
const TTL_SECONDS = 60 * 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Rows written before the bucket went private hold a full public URL rather than a path.
 * Accept both so old contracts keep opening.
 */
function toStoragePath(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null
  const marker = '/object/public/' + BUCKET + '/'
  const i = value.indexOf(marker)
  if (i >= 0) return decodeURIComponent(value.slice(i + marker.length).split('?')[0])
  if (value.startsWith('http://') || value.startsWith('https://')) return null
  return value
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Not configured' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }

  const token = typeof body.token === 'string' ? body.token : ''
  const contractId = typeof body.contract_id === 'string' ? body.contract_id : ''

  let stored: unknown = null

  if (token) {
    if (!UUID_RE.test(token)) return json({ error: 'not_found' }, 404)
    const { data } = await admin.from('contracts')
      .select('contract_file_url').eq('signing_token', token).maybeSingle()
    if (!data) return json({ error: 'not_found' }, 404)
    stored = data.contract_file_url
  } else if (contractId) {
    if (!UUID_RE.test(contractId)) return json({ error: 'not_found' }, 404)
    // A creative can only sign for their own contract, proven by their JWT.
    const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!bearer) return json({ error: 'Unauthorised' }, 401)
    const { data: userData } = await admin.auth.getUser(bearer)
    const userId = userData?.user?.id
    if (!userId) return json({ error: 'Unauthorised' }, 401)

    const { data } = await admin.from('contracts')
      .select('contract_file_url, creative_id').eq('id', contractId).maybeSingle()
    if (!data) return json({ error: 'not_found' }, 404)
    if (data.creative_id !== userId) return json({ error: 'Forbidden' }, 403)
    stored = data.contract_file_url
  } else {
    return json({ error: 'token or contract_id required' }, 400)
  }

  const path = toStoragePath(stored)
  // No attached file is a normal state: plenty of contracts are written in the app.
  if (!path) return json({ ok: true, url: null })

  const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS)
  if (error || !signed?.signedUrl) {
    console.error('contract-file: could not sign', path, error?.message)
    return json({ error: 'could_not_sign' }, 500)
  }
  return json({ ok: true, url: signed.signedUrl })
})
