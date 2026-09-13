// Supabase Edge Function: cancel-revolut-subscription
// Client-facing (verify_jwt = false) but authenticated INSIDE via the caller's
// JWT, so a user can only cancel their OWN subscription. Sets status 'canceled'
// which stops the recurring-charge job. Access continues until current_period_end;
// the daily job downgrades the profile to Basic once the period ends.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Same shape as the helper in revolut-webhook and revolut-charge-due. Best effort:
// a creative's cancellation must never fail because an email did.
async function notifyBilling(supabaseUrl: string, serviceKey: string, userId: string, kind: string, tier?: unknown) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-billing-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, kind, tier }),
    })
  } catch (_e) { /* best effort */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing Supabase env' }, 500)

  // Identify the caller from their JWT (never trust a userId from the body).
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Not authenticated' }, 401)

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  const userId = userData?.user?.id
  if (userErr || !userId) return json({ error: 'Not authenticated' }, 401)

  const { data: sub } = await sb
    .from('subscriptions')
    .select('id, status, current_period_end, tier')
    .eq('user_id', userId)
    .eq('provider', 'revolut')
    .maybeSingle()

  if (!sub) return json({ error: 'No active subscription found' }, 404)
  if (sub.status === 'canceled' || sub.status === 'expired') {
    // Already cancelled, so no second confirmation email. A double click on the
    // cancel button must not send two.
    return json({ ok: true, alreadyCanceled: true, accessUntil: sub.current_period_end })
  }

  await sb.from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', sub.id)

  // Cancelling a paid plan with no confirmation leaves the creative with nothing in
  // writing about when their access actually ends. The email says so explicitly.
  await notifyBilling(supabaseUrl, serviceKey, userId, 'cancelled', sub.tier)

  return json({ ok: true, accessUntil: sub.current_period_end })
})
