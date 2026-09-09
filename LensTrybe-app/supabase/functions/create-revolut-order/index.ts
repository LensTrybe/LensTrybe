// Supabase Edge Function: create-revolut-order
// Client-facing (verify_jwt = false). Creates a Revolut customer and a
// ZERO-AMOUNT setup order that saves the customer's card for future
// merchant-initiated charges (no charge now). Records a "trialing" subscription
// whose first-charge date and amount come from what the signup trigger already
// granted on the profile:
//   - Founding creatives (valid code): free for 12 months, then $49/mo for life.
//   - Everyone else on a paid plan: 3-month free trial, then the normal price.
// The single source of truth is profiles.next_billing_date + profiles.founding_member,
// set by handle_new_user at signup. The recurring-charge cron makes the first real
// charge on next_charge_date.
//
// Receives: { userId, email, tier, billing, fullName? }
// Returns:  { token, orderId, env, trialEnd }
//
// Secrets: REVOLUT_SECRET_KEY, REVOLUT_ENV, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REVOLUT_API_VERSION = '2026-04-20'
const CURRENCY = 'AUD'
const TRIAL_MONTHS = 3

// Founding locked rate: $49/mo for life (or $588/yr if they pick annual).
const FOUNDING_MONTHLY = 4900
const FOUNDING_ANNUAL = 58800

// Standard plan prices in AUD minor units (cents). Charged later by the cron.
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

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Read what the signup trigger already granted: founding status + first-charge date.
  const { data: prof } = await sb
    .from('profiles')
    .select('revolut_customer_id, founding_member, next_billing_date')
    .eq('id', userId)
    .maybeSingle()

  const isFounding = !!prof?.founding_member

  // Amount: founding locks $49/mo ($588/yr); everyone else pays the standard plan price.
  const amount = isFounding
    ? (billing === 'annual' ? FOUNDING_ANNUAL : FOUNDING_MONTHLY)
    : PLANS?.[tier]?.[billing]
  if (!amount) return json({ error: `Unknown plan: ${tier}/${billing}` }, 400)

  // First-charge date comes from the profile (trigger set founding = +12 months,
  // paid trial = +3 months). Fall back to a 3-month trial if it's somehow missing.
  const now = new Date()
  let firstChargeDate: string
  if (prof?.next_billing_date) {
    firstChargeDate = String(prof.next_billing_date).slice(0, 10)
  } else {
    const d = new Date(now)
    d.setMonth(d.getMonth() + TRIAL_MONTHS)
    firstChargeDate = d.toISOString().slice(0, 10)
  }
  // Brisbane-time start of that day, so the period end lines up with the calendar date.
  const firstChargeInstant = new Date(`${firstChargeDate}T00:00:00+10:00`)

  // 1. Reuse or create the Revolut customer.
  let customerId = prof?.revolut_customer_id ? String(prof.revolut_customer_id) : ''
  if (!customerId) {
    const cust = await revolut('/customers', REVOLUT_SECRET_KEY, { full_name: fullName || email, email })
    if (!cust.ok || !cust.body?.id) {
      return json({ error: 'Failed to create Revolut customer', detail: cust.body }, 502)
    }
    customerId = String(cust.body.id)
    await sb.from('profiles').update({ revolut_customer_id: customerId }).eq('id', userId)
  }

  // 2. Zero-amount setup order: authorises the card for future charges, no charge now.
  const order = await revolut('/orders', REVOLUT_SECRET_KEY, {
    amount: 0,
    currency: CURRENCY,
    customer: { id: customerId },
    merchant_order_data: { reference: userId },
  })
  if (!order.ok || !order.body?.token || !order.body?.id) {
    return json({ error: 'Failed to create Revolut setup order', detail: order.body }, 502)
  }
  const orderId = String(order.body.id)
  const token = String(order.body.token)

  // 3. Record a trialing subscription with the right price + first-charge date.
  const { error: upsertErr } = await sb.from('subscriptions').upsert(
    {
      user_id: userId,
      provider: 'revolut',
      tier,
      billing,
      status: 'trialing',
      revolut_customer_id: customerId,
      revolut_last_order_id: orderId,
      amount_minor: amount,
      currency: CURRENCY,
      current_period_end: firstChargeInstant.toISOString(),
      next_charge_date: firstChargeDate,
      founding_member: isFounding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (upsertErr) return json({ error: 'Failed to record subscription', detail: upsertErr.message }, 500)

  return json({
    token,
    orderId,
    trialEnd: firstChargeDate,
    env: (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase(),
  })
})
