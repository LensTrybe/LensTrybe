// Supabase Edge Function: brain-stats
// Read-only headline numbers for Michael's Trybe Brain (Documents/Trybe Brain on his Mac).
// Returns aggregate counts only: no names, emails or ids ever leave this function.
//
// Auth: header x-brain-key == BRAIN_STATS_KEY (fails closed if the secret is not set).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BRAIN_STATS_KEY
// Deploy: supabase functions deploy brain-stats --project-ref lqafxisymvrazipaozfk --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-brain-key, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

function sameKey(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

const PLAN: Record<string, string> = { basic: 'Trybe Free', pro: 'Trybe Essential', expert: 'Trybe Complete', elite: 'Trybe Studio' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const secret = Deno.env.get('BRAIN_STATS_KEY') || ''
  if (!secret || !sameKey(req.headers.get('x-brain-key') || '', secret)) return json({ error: 'Not allowed' }, 401)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const [{ data: o, error: oErr }, { data: subs, error: sErr }] = await Promise.all([
    sb.rpc('hq_overview'),
    sb.from('subscriptions').select('tier, status').in('status', ['active', 'past_due', 'trialing']),
  ])
  if (oErr || sErr) {
    console.error('brain-stats', oErr?.message, sErr?.message)
    return json({ error: 'Could not read stats' }, 500)
  }

  const paying: Record<string, number> = {}
  const trialing: Record<string, number> = {}
  for (const s of subs || []) {
    const name = PLAN[String(s.tier || '').toLowerCase()] || String(s.tier || 'Unknown')
    const bucket = s.status === 'trialing' ? trialing : paying
    bucket[name] = (bucket[name] || 0) + 1
  }

  return json({
    at: new Date().toISOString(),
    creatives: o?.creatives ?? 0,
    clients: o?.clients ?? 0,
    signups_7: o?.signups_7 ?? 0,
    signups_30: o?.signups_30 ?? 0,
    founding: { redeemed: o?.founding?.redeemed ?? 0, used: o?.founding?.used ?? 0, cap: o?.founding?.cap ?? 0 },
    applications_pending: o?.founding?.applications_new ?? 0,
    paying_by_plan: paying,
    trialing_by_plan: trialing,
    paying_total: o?.subs?.paying ?? 0,
    trialing_total: o?.subs?.trialing ?? 0,
    mrr_aud: Math.round(Number(o?.subs?.mrr_minor ?? 0)) / 100,
    signups_by_day: o?.signups_by_day ?? [],
  })
})
