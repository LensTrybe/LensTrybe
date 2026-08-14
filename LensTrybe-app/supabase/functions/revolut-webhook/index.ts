// Supabase Edge Function: revolut-webhook
// Client-facing (verify_jwt = false) — authenticated via Revolut signature.
//
// Handles Merchant API order events:
//   ORDER_COMPLETED            -> activate subscription, store saved card, set period
//   ORDER_PAYMENT_DECLINED     -> mark past_due
//   ORDER_PAYMENT_FAILED       -> mark past_due
//   ORDER_CANCELLED            -> mark canceled
//
// Signature: HMAC-SHA256 over `v1.{timestamp}.{rawBody}` using the webhook
// signing secret, compared to the `Revolut-Signature` header (v1=<hex>).
//
// Required secrets:
// - REVOLUT_SECRET_KEY          (sk_...)
// - REVOLUT_ENV                 ('sandbox' | 'production')
// - REVOLUT_WEBHOOK_SECRET      (whsec_... from webhook registration; optional in sandbox)
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provided)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, revolut-signature, revolut-request-timestamp',
}

const REVOLUT_API_VERSION = '2026-04-20'

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

async function revolutGet(path: string, key: string) {
  const res = await fetch(revolutBase() + path, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Revolut-Api-Version': REVOLUT_API_VERSION,
    },
  })
  const text = await res.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { ok: res.ok, status: res.status, body: parsed }
}

async function verifySignature(rawBody: string, sigHeader: string, tsHeader: string, secret: string) {
  if (!secret) return true // sandbox: allow if no signing secret configured yet
  if (!sigHeader || !tsHeader) return false
  const payload = `v1.${tsHeader}.${rawBody}`
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  // Header may contain multiple space-separated signatures (e.g. "v1=abc v1=def").
  const provided = sigHeader.split(/\s+/).map((s) => s.replace(/^v1=/, '').trim())
  return provided.includes(hex)
}

function addPeriod(from: Date, billing: string) {
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
  if (!REVOLUT_SECRET_KEY || !supabaseUrl || !serviceKey) {
    return json({ error: 'Missing env' }, 500)
  }

  const rawBody = await req.text()
  const ok = await verifySignature(
    rawBody,
    req.headers.get('revolut-signature') || '',
    req.headers.get('revolut-request-timestamp') || '',
    Deno.env.get('REVOLUT_WEBHOOK_SECRET') || '',
  )
  if (!ok) return json({ error: 'Invalid signature' }, 401)

  let payload: Record<string, unknown>
  try { payload = JSON.parse(rawBody) } catch { return json({ error: 'Bad JSON' }, 400) }

  const event = String(payload?.event || '')
  const orderId = String(payload?.order_id || '')
  if (!orderId) return json({ received: true, note: 'no order_id' })

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Map the order back to our subscription row (recorded at order creation).
  const { data: sub } = await sb
    .from('subscriptions')
    .select('id, user_id, tier, billing, revolut_customer_id, founding_member, current_period_end')
    .eq('revolut_last_order_id', orderId)
    .maybeSingle()

  if (!sub) return json({ received: true, note: 'no matching subscription' })

  // Verify the order's REAL state directly with Revolut (defends against forged
  // webhook calls without needing a signing secret). We drive off this state,
  // not the claimed event name.
  const ord = await revolutGet(`/orders/${orderId}`, REVOLUT_SECRET_KEY)
  const state = String((ord.body as Record<string, unknown>)?.state || '').toLowerCase()

  try {
    if (state === 'completed' || state === 'authorised') {
      // Retrieve the customer's saved payment method for future merchant-initiated charges.
      let pmId: string | null = null
      if (sub.revolut_customer_id) {
        const pm = await revolutGet(`/customers/${sub.revolut_customer_id}/payment-methods`, REVOLUT_SECRET_KEY)
        const list = Array.isArray(pm.body) ? pm.body : (pm.body as Record<string, unknown>)?.payment_methods
        if (Array.isArray(list) && list.length > 0) {
          pmId = String((list[list.length - 1] as Record<string, unknown>)?.id || '') || null
        }
      }

      const now = new Date()
      const hasFuturePeriod = sub.current_period_end && new Date(sub.current_period_end) > now

      const updates: Record<string, unknown> = { updated_at: now.toISOString() }
      // Capture the saved card when we find one (renewals already have it).
      if (pmId) updates.revolut_payment_method_id = pmId
      // A future period means this is the zero-amount setup order completing (trial
      // or Expert deferral): keep the trialing status + first-charge date the order
      // function set. Only when there is no future period do we treat this as an
      // immediate activation (fallback path).
      if (!hasFuturePeriod) {
        updates.status = 'active'
        const periodEnd = addPeriod(now, sub.billing)
        updates.current_period_end = periodEnd.toISOString()
        updates.next_charge_date = periodEnd.toISOString().slice(0, 10)
      }

      await sb.from('subscriptions').update(updates).eq('id', sub.id)

      await sb.from('profiles').update({
        subscription_tier: sub.tier,
        subscription_status: 'active',
      }).eq('id', sub.user_id)
    } else if (state === 'failed' || state === 'declined') {
      await sb.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('id', sub.id)
      await sb.from('profiles').update({ subscription_status: 'past_due' }).eq('id', sub.user_id)
    } else if (state === 'cancelled') {
      await sb.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', sub.id)
    }

    return json({ received: true, event, state })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
