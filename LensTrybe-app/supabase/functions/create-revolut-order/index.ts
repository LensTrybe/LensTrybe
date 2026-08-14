// Supabase Edge Function: create-revolut-order
// Client-facing (verify_jwt = false). Creates/returns a Revolut customer,
// creates a payment order with that customer attached, records a pending
// subscription row, and returns the checkout token for the Merchant Web SDK.
//
// Receives: { userId, email, tier, billing, fullName? }
// Returns:  { token, orderId, amount, currency, env }
//
// Required secrets:
// - REVOLUT_SECRET_KEY        (sk_... ; sandbox while testing)
// - REVOLUT_ENV               ('sandbox' | 'production' ; defaults to sandbox)
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REVOLUT_API_VERSION = '2026-04-20'
const CURRENCY = 'AUD'

// Plan prices in AUD minor units (cents). Mirrors PricingCards.jsx.
const PLANS: Record<string, Record<string, number>> = {
  pro: { monthly: 2499, annual: 24990 },
  expert: { monthly: 7499, annual: 74990 },
  elite: { monthly: 14999, annual: 149990 },
}

function revolutBase() {
  const env = (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase()
  return env === 'production'
    ? 'https://merchant.revolut.com/api'
    : 'https://sandbox-merchant.revolut.com/api'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function revolut(path: string, key: string, body: unknown) {
  const res = await fetch(revolutBase() + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Revolut-Api-Version': REVOLUT_API_VERSION,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { ok: res.ok, status: res.status, body: parsed as Record<string, unknown> }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY')
  if (!REVOLUT_SECRET_KEY) return json({ error: 'Missing REVOLUT_SECRET_KEY' }, 500)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing Supabase env' }, 500)

  const bodyIn = await req.json().catch(() => ({}))
  const userId = String(bodyIn?.userId || '')
  const email = String(bodyIn?.email || '')
  const tier = String(bodyIn?.tier || '').toLowerCase()
  const billing = String(bodyIn?.billing || '').toLowerCase() === 'monthly' ? 'monthly' : 'annual'
  const fullName = String(bodyIn?.fullName || '').trim()

  if (!userId || !email) return json({ error: 'Missing userId or email' }, 400)
  const amount = PLANS?.[tier]?.[billing]
  if (!amount) return json({ error: `Unknown plan: ${tier}/${billing}` }, 400)

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // 1. Reuse or create the Revolut customer for this user.
  const { data: prof } = await sb
    .from('profiles')
    .select('revolut_customer_id')
    .eq('id', userId)
    .maybeSingle()

  let customerId = prof?.revolut_customer_id ? String(prof.revolut_customer_id) : ''

  if (!customerId) {
    const cust = await revolut('/customers', REVOLUT_SECRET_KEY, {
      full_name: fullName || email,
      email,
    })
    if (!cust.ok || !cust.body?.id) {
      return json({ error: 'Failed to create Revolut customer', detail: cust.body }, 502)
    }
    customerId = String(cust.body.id)
    await sb.from('profiles').update({ revolut_customer_id: customerId }).eq('id', userId)
  }

  // 2. Create the order with the customer attached (nested customer.id).
  const order = await revolut('/orders', REVOLUT_SECRET_KEY, {
    amount,
    currency: CURRENCY,
    capture_mode: 'automatic',
    customer: { id: customerId },
    merchant_order_data: { reference: userId },
  })
  if (!order.ok || !order.body?.token || !order.body?.id) {
    return json({ error: 'Failed to create Revolut order', detail: order.body }, 502)
  }
  const orderId = String(order.body.id)
  const token = String(order.body.token)

  // 3. Record a pending subscription keyed to this order for webhook mapping.
  await sb.from('subscriptions').upsert(
    {
      user_id: userId,
      provider: 'revolut',
      tier,
      billing,
      status: 'pending',
      revolut_customer_id: customerId,
      revolut_last_order_id: orderId,
      amount_minor: amount,
      currency: CURRENCY,
      founding_member: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  return json({
    token,
    orderId,
    amount,
    currency: CURRENCY,
    env: (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase(),
  })
})
