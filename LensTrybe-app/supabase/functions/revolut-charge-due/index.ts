// Supabase Edge Function: revolut-charge-due
// Scheduled job (run daily via cron). Charges the saved card for every
// subscription whose next_charge_date is due, off-session (merchant-initiated).
//
// Auth: requires header `x-cron-secret` == CRON_SECRET (if that secret is set).
// This is NOT client-facing — only the scheduler should call it.
//
// Flow per due subscription:
//   1. Create a new order (amount, currency, customer).
//   2. POST /orders/{id}/payments with the saved payment method, initiator=merchant.
//   3. Advance next_charge_date/current_period_end by one period (optimistic).
// The webhook (ORDER_PAYMENT_FAILED) will flip to past_due if a charge fails.
//
// Required secrets:
// - REVOLUT_SECRET_KEY, REVOLUT_ENV
// - CRON_SECRET (shared secret the scheduler sends)
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const REVOLUT_API_VERSION = '2026-04-20'

function revolutBase() {
  const env = (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase()
  return env === 'production'
    ? 'https://merchant.revolut.com/api'
    : 'https://sandbox-merchant.revolut.com/api'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
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

  // Due = active Revolut subs with a saved card whose charge date has arrived.
  const { data: due, error } = await sb
    .from('subscriptions')
    .select('id, user_id, tier, billing, amount_minor, currency, revolut_customer_id, revolut_payment_method_id, current_period_end')
    .eq('provider', 'revolut')
    .eq('status', 'active')
    .not('revolut_payment_method_id', 'is', null)
    .lte('next_charge_date', today)

  if (error) return json({ error: error.message }, 500)

  const results: Array<Record<string, unknown>> = []

  for (const sub of due || []) {
    try {
      // 1. New order for this cycle.
      const order = await revolut('/orders', REVOLUT_SECRET_KEY, 'POST', {
        amount: sub.amount_minor,
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

      // 2. Charge the saved card, merchant-initiated (off-session).
      const pay = await revolut(`/orders/${orderId}/payments`, REVOLUT_SECRET_KEY, 'POST', {
        saved_payment_method: {
          type: 'card',
          id: sub.revolut_payment_method_id,
          initiator: 'merchant',
        },
      })

      // 3. Advance the period optimistically and point at the new order.
      const base = sub.current_period_end && new Date(sub.current_period_end) > new Date()
        ? new Date(sub.current_period_end)
        : new Date()
      const nextEnd = addPeriod(base, sub.billing)

      await sb.from('subscriptions').update({
        revolut_last_order_id: orderId,
        current_period_end: nextEnd.toISOString(),
        next_charge_date: nextEnd.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id)

      results.push({ sub: sub.id, order: orderId, charge_status: pay.status, ok: pay.ok })
    } catch (e) {
      results.push({ sub: sub.id, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return json({ ran_at: new Date().toISOString(), due_count: (due || []).length, results })
})
