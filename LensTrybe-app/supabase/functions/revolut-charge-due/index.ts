// Supabase Edge Function: revolut-charge-due
// Scheduled job (run daily via cron). Charges the saved card for every
// subscription whose next_charge_date is due, off-session (merchant-initiated).
// Also downgrades canceled subs to Basic once their paid period ends, and applies
// any SCHEDULED plan downgrade at renewal (pending_tier/pending_billing) so the
// creative is charged the new lower price and stepped down at their period end.
// Picks up both trialing subs whose trial/deferral ended and active renewals.
//
// Auth: requires header `x-cron-secret` == CRON_SECRET (if that secret is set).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const REVOLUT_API_VERSION = '2026-04-20'

// Founding locked rate: $49/mo ($588/yr), flat regardless of tier.
const FOUNDING_MONTHLY = 4900
const FOUNDING_ANNUAL = 58800
const PLANS: Record<string, Record<string, number>> = {
  pro: { monthly: 2499, annual: 24990 },
  expert: { monthly: 7499, annual: 74990 },
  elite: { monthly: 14999, annual: 149990 },
}
function priceFor(tier: string, billing: string, founding: boolean): number | null {
  if (founding) return billing === 'annual' ? FOUNDING_ANNUAL : FOUNDING_MONTHLY
  return PLANS?.[tier]?.[billing] ?? null
}

function revolutBase() {
  const env = (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase()
  return env === 'production'
    ? 'https://merchant.revolut.com/api'
    : 'https://sandbox-merchant.revolut.com/api'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Fire a branded billing email to the creative (best effort, never blocks).
async function notifyBilling(supabaseUrl: string, serviceKey: string, userId: string, kind: string, tier?: unknown, amountMinor?: unknown, currency?: unknown) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-billing-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, kind, tier, amount_minor: amountMinor, currency }),
    })
  } catch (_e) { /* best effort */ }
}

async function revolut(path: string, key: string, method: string, body?: unknown) {
  const res = await fetch(revolutBase() + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Revolut-Api-Version': REVOLUT_API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { ok: res.ok, status: res.status, body: parsed as Record<string, unknown> }
}

function addPeriod(from: Date, billing: string) {
  const d = new Date(from)
  if (billing === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d
}

Deno.serve(async (req) => {
  const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!REVOLUT_SECRET_KEY || !supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const today = new Date().toISOString().slice(0, 10)
  const nowIso = new Date().toISOString()

  // Downgrade canceled subs whose paid access period has now ended → Basic.
  const { data: expiredCanceled } = await sb
    .from('subscriptions')
    .select('id, user_id')
    .eq('provider', 'revolut')
    .eq('status', 'canceled')
    .lt('current_period_end', nowIso)
  for (const s of expiredCanceled || []) {
    await sb.from('subscriptions').update({ status: 'expired', updated_at: nowIso }).eq('id', s.id)
    await sb.from('profiles').update({ subscription_tier: 'basic', subscription_status: 'canceled' }).eq('id', s.user_id)
  }

  // Charge both trialing subs whose trial has ended and active subs due for renewal.
  const { data: due, error } = await sb
    .from('subscriptions')
    .select('id, user_id, tier, billing, amount_minor, currency, revolut_customer_id, revolut_payment_method_id, current_period_end, founding_member, pending_tier, pending_billing')
    .eq('provider', 'revolut')
    .in('status', ['active', 'trialing'])
    .not('revolut_payment_method_id', 'is', null)
    .lte('next_charge_date', today)

  if (error) return json({ error: error.message }, 500)

  const results: Array<Record<string, unknown>> = []

  for (const sub of due || []) {
    try {
      // Apply a scheduled downgrade at renewal: charge the NEW lower price and
      // step the tier down. pending_* is only ever set for real downgrades (never
      // to Basic — that path is cancellation).
      let chargeTier = String(sub.tier)
      let chargeBilling = String(sub.billing)
      let chargeAmount = Number(sub.amount_minor)
      const applyingDowngrade = !!sub.pending_tier && (sub.pending_tier in PLANS)
      if (applyingDowngrade) {
        chargeTier = String(sub.pending_tier)
        chargeBilling = String(sub.pending_billing) === 'monthly' ? 'monthly' : 'annual'
        const amt = priceFor(chargeTier, chargeBilling, !!sub.founding_member)
        if (amt != null) chargeAmount = amt
      }

      const order = await revolut('/orders', REVOLUT_SECRET_KEY, 'POST', {
        amount: chargeAmount,
        currency: sub.currency,
        capture_mode: 'automatic',
        customer: { id: sub.revolut_customer_id },
        merchant_order_data: { reference: sub.user_id },
      })
      if (!order.ok || !order.body?.id) {
        results.push({ sub: sub.id, step: 'order', ok: false, detail: order.body })
        continue
      }
      const orderId = String(order.body.id)

      const pay = await revolut(`/orders/${orderId}/payments`, REVOLUT_SECRET_KEY, 'POST', {
        saved_payment_method: {
          type: 'card',
          id: sub.revolut_payment_method_id,
          initiator: 'merchant',
        },
      })

      if (pay.ok) {
        // Payment went through: extend the paid period (by the CHARGED billing cycle).
        const base = sub.current_period_end && new Date(sub.current_period_end) > new Date()
          ? new Date(sub.current_period_end)
          : new Date()
        const nextEnd = addPeriod(base, chargeBilling)

        const patch: Record<string, unknown> = {
          status: 'active',
          revolut_last_order_id: orderId,
          current_period_end: nextEnd.toISOString(),
          next_charge_date: nextEnd.toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        }
        if (applyingDowngrade) {
          patch.tier = chargeTier
          patch.billing = chargeBilling
          patch.amount_minor = chargeAmount
          patch.pending_tier = null
          patch.pending_billing = null
          patch.pending_change_at = null
        }
        await sb.from('subscriptions').update(patch).eq('id', sub.id)
        if (applyingDowngrade) {
          await sb.from('profiles').update({ subscription_tier: chargeTier, subscription_status: 'active' }).eq('id', sub.user_id)
        }
      } else {
        // Renewal charge failed: mark past_due and send a dunning email. Do not
        // extend the period or apply the downgrade; the job will retry next run.
        await sb.from('subscriptions').update({
          status: 'past_due',
          revolut_last_order_id: orderId,
          updated_at: new Date().toISOString(),
        }).eq('id', sub.id)
        await sb.from('profiles').update({ subscription_status: 'past_due' }).eq('id', sub.user_id)
        await notifyBilling(supabaseUrl, serviceKey, sub.user_id, 'failed', chargeTier, chargeAmount, sub.currency)
      }

      results.push({ sub: sub.id, order: orderId, charge_status: pay.status, ok: pay.ok, downgrade_applied: applyingDowngrade && pay.ok })
    } catch (e) {
      results.push({ sub: sub.id, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return json({ ran_at: new Date().toISOString(), due_count: (due || []).length, results })
})
