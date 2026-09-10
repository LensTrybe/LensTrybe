// Supabase Edge Function: change-subscription
// Client-facing (verify_jwt = false) but authenticated INSIDE via the caller's
// JWT, so a user can only change their OWN subscription.
//
// Policy (confirmed):
//   - UPGRADE (bigger tier, or monthly -> annual): takes effect immediately and
//     the creative pays only the PRORATED DIFFERENCE now (credit for the unused
//     portion of the current plan).
//   - DOWNGRADE (smaller tier, or annual -> monthly): scheduled to take effect at
//     the END of the current paid period. They keep what they paid for until then,
//     then step down and are charged the lower price at renewal (applied by
//     revolut-charge-due). No refund.
//   - Downgrading to Basic = cancellation; use cancel-revolut-subscription instead.
//
// Body: { tier, billing, preview? }
//   preview:true  -> returns the classification + amount, makes NO changes/charges.
//   preview:false -> commits: charges the proration now (upgrade) or schedules the
//                    downgrade, and updates the subscription + profile tier.
//
// Secrets: REVOLUT_SECRET_KEY, REVOLUT_ENV, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REVOLUT_API_VERSION = '2026-04-20'
const CURRENCY = 'AUD'

// Founding locked rate: $49/mo ($588/yr), flat regardless of tier.
const FOUNDING_MONTHLY = 4900
const FOUNDING_ANNUAL = 58800

const PLANS: Record<string, Record<string, number>> = {
  pro: { monthly: 2499, annual: 24990 },
  expert: { monthly: 7499, annual: 74990 },
  elite: { monthly: 14999, annual: 149990 },
}
const RANK: Record<string, number> = { basic: 0, pro: 1, expert: 2, elite: 3 }

// Below this, skip the tiny proration charge and just switch (avoids failed
// micro-charges on Revolut). $0.50.
const MIN_CHARGE_MINOR = 50

function revolutBase() {
  const env = (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase()
  return env === 'production' ? 'https://merchant.revolut.com/api' : 'https://sandbox-merchant.revolut.com/api'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function revolut(path: string, key: string, method: string, body?: unknown) {
  const res = await fetch(revolutBase() + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Revolut-Api-Version': REVOLUT_API_VERSION },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { ok: res.ok, status: res.status, body: parsed as Record<string, unknown> }
}

function priceFor(tier: string, billing: string, founding: boolean): number | null {
  if (founding) return billing === 'annual' ? FOUNDING_ANNUAL : FOUNDING_MONTHLY
  return PLANS?.[tier]?.[billing] ?? null
}

function periodStart(end: Date, billing: string): Date {
  const d = new Date(end)
  if (billing === 'monthly') d.setMonth(d.getMonth() - 1)
  else d.setFullYear(d.getFullYear() - 1)
  return d
}
function addPeriod(from: Date, billing: string): Date {
  const d = new Date(from)
  if (billing === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing Supabase env' }, 500)

  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Not authenticated' }, 401)

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt)
  const userId = userData?.user?.id
  if (userErr || !userId) return json({ error: 'Not authenticated' }, 401)

  const bodyIn = await req.json().catch(() => ({}))
  const newTier = String(bodyIn?.tier || '').toLowerCase()
  const newBilling = String(bodyIn?.billing || '').toLowerCase() === 'annual' ? 'annual' : 'monthly'
  const preview = bodyIn?.preview === true

  if (!newTier || !(newTier in RANK)) return json({ error: 'Invalid tier' }, 400)
  if (newTier === 'basic') return json({ error: 'Use cancel-revolut-subscription to move to Basic' }, 400)

  const { data: sub } = await sb
    .from('subscriptions')
    .select('id, tier, billing, status, amount_minor, currency, current_period_end, next_charge_date, revolut_customer_id, revolut_payment_method_id, founding_member')
    .eq('user_id', userId)
    .eq('provider', 'revolut')
    .maybeSingle()

  if (!sub) return json({ error: 'No subscription found' }, 404)

  const founding = !!sub.founding_member
  const curTier = String(sub.tier || 'basic').toLowerCase()
  const curBilling = String(sub.billing || 'monthly').toLowerCase() === 'annual' ? 'annual' : 'monthly'
  const curAmount = Number(sub.amount_minor || 0)
  const newAmount = priceFor(newTier, newBilling, founding)
  if (newAmount == null) return json({ error: `Unknown plan: ${newTier}/${newBilling}` }, 400)

  // Classify.
  const curRank = RANK[curTier] ?? 0
  const newRank = RANK[newTier] ?? 0
  let change: 'upgrade' | 'downgrade' | 'none'
  if (newRank > curRank) change = 'upgrade'
  else if (newRank < curRank) change = 'downgrade'
  else if (curBilling === 'monthly' && newBilling === 'annual') change = 'upgrade'
  else if (curBilling === 'annual' && newBilling === 'monthly') change = 'downgrade'
  else change = 'none'

  if (change === 'none') {
    // Re-selecting the current plan while a downgrade is scheduled = undo it.
    if (!preview && sub.pending_tier) {
      await sb.from('subscriptions').update({
        pending_tier: null, pending_billing: null, pending_change_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id)
      return json({ ok: true, change: 'none', clearedPending: true })
    }
    return json({ ok: true, change: 'none', hasPending: !!sub.pending_tier, message: 'Already on this plan' })
  }

  const nowIso = new Date().toISOString()

  // ---- Trialing: nothing paid yet. Apply immediately, no charge, keep the
  // existing first-charge date; just change what will be charged then. ----
  if (sub.status === 'trialing') {
    if (preview) {
      return json({ change, chargeNow: 0, currency: CURRENCY, effective: 'immediate', trialing: true, nextChargeDate: sub.next_charge_date })
    }
    await sb.from('subscriptions').update({
      tier: newTier, billing: newBilling, amount_minor: newAmount,
      pending_tier: null, pending_billing: null, pending_change_at: null,
      updated_at: nowIso,
    }).eq('id', sub.id)
    await sb.from('profiles').update({ subscription_tier: newTier }).eq('id', userId)
    return json({ ok: true, change, applied: 'immediate', chargeNow: 0, trialing: true })
  }

  // ---- Active (or past_due): real proration / scheduling. ----
  const now = new Date()
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : addPeriod(now, curBilling)
  const start = periodStart(periodEnd, curBilling)
  const fullMs = periodEnd.getTime() - start.getTime()
  const remainMs = Math.max(0, periodEnd.getTime() - now.getTime())
  const frac = fullMs > 0 ? Math.min(1, Math.max(0, remainMs / fullMs)) : 0

  if (change === 'downgrade') {
    // Scheduled: takes effect at period end. No charge, no refund. Keep current tier now.
    if (preview) {
      return json({ change: 'downgrade', chargeNow: 0, currency: CURRENCY, effective: 'period_end', effectiveAt: sub.current_period_end })
    }
    await sb.from('subscriptions').update({
      pending_tier: newTier, pending_billing: newBilling, pending_change_at: sub.current_period_end,
      updated_at: nowIso,
    }).eq('id', sub.id)
    return json({ ok: true, change: 'downgrade', applied: 'scheduled', effectiveAt: sub.current_period_end })
  }

  // ---- Upgrade: prorate and charge the difference now. ----
  let chargeNow: number
  let newPeriodEnd: Date
  if (curBilling === newBilling) {
    // Same cycle: credit unused current value against the new price, keep the anchor date.
    chargeNow = Math.round((newAmount - curAmount) * frac)
    newPeriodEnd = periodEnd
  } else {
    // monthly -> annual: start a fresh annual period now, credit unused monthly value.
    const credit = Math.round(curAmount * frac)
    chargeNow = newAmount - credit
    newPeriodEnd = addPeriod(now, newBilling)
  }
  if (chargeNow < 0) chargeNow = 0

  if (preview) {
    return json({ change: 'upgrade', chargeNow, currency: CURRENCY, effective: 'immediate', newPeriodEnd: newPeriodEnd.toISOString() })
  }

  // Commit the upgrade.
  const applyUpdate = async (lastOrderId?: string) => {
    const patch: Record<string, unknown> = {
      tier: newTier, billing: newBilling, amount_minor: newAmount, status: 'active',
      current_period_end: newPeriodEnd.toISOString(), next_charge_date: newPeriodEnd.toISOString().slice(0, 10),
      pending_tier: null, pending_billing: null, pending_change_at: null, updated_at: nowIso,
    }
    if (lastOrderId) patch.revolut_last_order_id = lastOrderId
    await sb.from('subscriptions').update(patch).eq('id', sub.id)
    await sb.from('profiles').update({ subscription_tier: newTier, subscription_status: 'active' }).eq('id', userId)
  }

  // Tiny or zero difference (e.g. founding flat rate): switch without charging.
  if (chargeNow < MIN_CHARGE_MINOR) {
    await applyUpdate()
    return json({ ok: true, change: 'upgrade', applied: 'immediate', chargeNow: 0 })
  }

  if (!REVOLUT_SECRET_KEY) return json({ error: 'Missing REVOLUT_SECRET_KEY' }, 500)
  if (!sub.revolut_payment_method_id || !sub.revolut_customer_id) {
    return json({ error: 'No saved card on file. Please update your payment method first.' }, 409)
  }

  const order = await revolut('/orders', REVOLUT_SECRET_KEY, 'POST', {
    amount: chargeNow,
    currency: sub.currency || CURRENCY,
    capture_mode: 'automatic',
    customer: { id: sub.revolut_customer_id },
    merchant_order_data: { reference: userId },
  })
  if (!order.ok || !order.body?.id) {
    return json({ error: 'Could not start the upgrade charge', detail: order.body }, 502)
  }
  const orderId = String(order.body.id)
  const pay = await revolut(`/orders/${orderId}/payments`, REVOLUT_SECRET_KEY, 'POST', {
    saved_payment_method: { type: 'card', id: sub.revolut_payment_method_id, initiator: 'merchant' },
  })
  if (!pay.ok) {
    return json({ error: 'Your card was declined for the upgrade. Your plan was not changed.', detail: pay.body }, 402)
  }

  await applyUpdate(orderId)

  // Branded billing email (best effort).
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-billing-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, kind: 'upgrade', tier: newTier, amount_minor: chargeNow, currency: sub.currency || CURRENCY }),
    })
  } catch (_e) { /* best effort */ }

  return json({ ok: true, change: 'upgrade', applied: 'immediate', chargeNow, order: orderId })
})
