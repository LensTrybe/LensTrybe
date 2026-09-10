// Supabase Edge Function: revolut-webhook
// Called by Revolut (verify_jwt = false). Every request must carry a valid HMAC
// signature made with REVOLUT_WEBHOOK_SECRET (fails closed if the secret is not
// set) and a fresh timestamp. We then fetch the order's REAL state, amount and
// currency from Revolut with our secret key and drive off that, never off the
// claimed event.
//
// What a completed order does:
//   - Zero-amount setup order (card saved at signup / resubscribe): stores the saved
//     card on a 'trialing' subscription and grants the plan's access. It never starts
//     or extends a paid period.
//   - Renewal charge started by revolut-charge-due that was still processing: applied
//     through revolut_apply_charge, which checks the order matches the recorded
//     charge (amount + currency) and applies each order exactly once. Canceled or
//     expired subscriptions are never revived.
//   - Anything else (already processed, unknown, old replays): ignored.
// Failed / cancelled orders change nothing here: revolut-charge-due owns dunning and
// cancel-revolut-subscription owns cancellation.
//
// Secrets: REVOLUT_SECRET_KEY, REVOLUT_ENV, REVOLUT_WEBHOOK_SECRET,
//          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, revolut-signature, revolut-request-timestamp',
}

const REVOLUT_API_VERSION = '2026-04-20'
const MAX_SKEW_MS = 5 * 60 * 1000

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

// Fire a branded billing email to the creative (best effort, never blocks).
async function notifyBilling(supabaseUrl: string, serviceKey: string, userId: string, kind: string, tier?: unknown) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-billing-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, kind, tier }),
    })
  } catch (_e) { /* best effort */ }
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
  if (!secret || !sigHeader || !tsHeader) return false
  const ts = Number(tsHeader)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false
  const payload = `v1.${tsHeader}.${rawBody}`
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const provided = sigHeader.split(/[\s,]+/).map((s) => s.replace(/^v1=/, '').trim()).filter(Boolean)
  return provided.some((p) => {
    if (p.length !== hex.length) return false
    let r = 0
    for (let i = 0; i < p.length; i++) r |= p.charCodeAt(i) ^ hex.charCodeAt(i)
    return r === 0
  })
}

const ORDER_ID_RE = /^[A-Za-z0-9-]{8,80}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY')
  const WEBHOOK_SECRET = Deno.env.get('REVOLUT_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!REVOLUT_SECRET_KEY || !WEBHOOK_SECRET || !supabaseUrl || !serviceKey) {
    console.error('revolut-webhook: missing env (REVOLUT_SECRET_KEY / REVOLUT_WEBHOOK_SECRET / SUPABASE_*)')
    return json({ error: 'Not configured' }, 500)
  }

  const rawBody = await req.text()
  const ok = await verifySignature(
    rawBody,
    req.headers.get('revolut-signature') || '',
    req.headers.get('revolut-request-timestamp') || '',
    WEBHOOK_SECRET,
  )
  if (!ok) return json({ error: 'Invalid signature' }, 401)

  let payload: Record<string, unknown>
  try { payload = JSON.parse(rawBody) } catch { return json({ error: 'Bad JSON' }, 400) }

  const orderId = String(payload?.order_id || '')
  if (!orderId || !ORDER_ID_RE.test(orderId)) return json({ received: true })

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: sub, error: subErr } = await sb
    .from('subscriptions')
    .select('id, user_id, tier, status, revolut_customer_id, revolut_last_order_id, processed_order_ids, inflight_charge')
    .eq('revolut_last_order_id', orderId)
    .maybeSingle()
  if (subErr) {
    console.error('revolut-webhook: lookup failed', subErr.message)
    return json({ error: 'Lookup failed' }, 500)
  }
  if (!sub) return json({ received: true })

  const processed: string[] = Array.isArray(sub.processed_order_ids) ? sub.processed_order_ids : []
  if (processed.includes(orderId)) return json({ received: true })

  // The order's REAL state, amount and currency, straight from Revolut.
  const ord = await revolutGet(`/orders/${orderId}`, REVOLUT_SECRET_KEY)
  if (!ord.ok) {
    console.error('revolut-webhook: order fetch failed', ord.status)
    return json({ error: 'Order fetch failed' }, 500)
  }
  const ob = (ord.body || {}) as Record<string, unknown>
  const state = String(ob.state || '').toLowerCase()
  const amount = Number(ob.amount)
  const currency = String(ob.currency || '').toUpperCase()
  if (state !== 'completed' && state !== 'authorised') return json({ received: true })

  try {
    // ---- Zero-amount setup order: save the card, grant the trial's access. ----
    if (amount === 0) {
      if (sub.status !== 'trialing') return json({ received: true })

      let pmId: string | null = null
      if (sub.revolut_customer_id) {
        const pm = await revolutGet(`/customers/${sub.revolut_customer_id}/payment-methods`, REVOLUT_SECRET_KEY)
        const list = Array.isArray(pm.body) ? pm.body : (pm.body as Record<string, unknown>)?.payment_methods
        if (Array.isArray(list) && list.length > 0) {
          pmId = String((list[list.length - 1] as Record<string, unknown>)?.id || '') || null
        }
      }
      if (!pmId) {
        console.error('revolut-webhook: setup order completed but no saved card found', sub.id)
        return json({ error: 'No saved card yet' }, 500) // let Revolut retry
      }

      const { data: upd, error: upErr } = await sb.from('subscriptions').update({
        revolut_payment_method_id: pmId,
        processed_order_ids: [...processed, orderId],
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id).eq('status', 'trialing').eq('revolut_last_order_id', orderId).select('id')
      if (upErr) {
        console.error('revolut-webhook: update failed', upErr.message)
        return json({ error: 'Update failed' }, 500)
      }
      if (!upd || upd.length === 0) return json({ received: true })

      const { error: profErr } = await sb.from('profiles').update({
        subscription_tier: sub.tier,
        subscription_status: 'active',
      }).eq('id', sub.user_id)
      if (profErr) {
        console.error('revolut-webhook: profile update failed', profErr.message)
        return json({ error: 'Update failed' }, 500)
      }

      await notifyBilling(supabaseUrl, serviceKey, sub.user_id, 'active', sub.tier)
      return json({ received: true })
    }

    // ---- A renewal charge that was still processing when revolut-charge-due ran. ----
    const inflight = sub.inflight_charge as Record<string, unknown> | null
    if (state === 'completed' && inflight && String(inflight.order_id || '') === orderId) {
      const wasPastDue = sub.status === 'past_due'
      const { data: res, error: rpcErr } = await sb.rpc('revolut_apply_charge', {
        p_sub: sub.id, p_order: orderId, p_amount: Number.isFinite(amount) ? amount : null, p_currency: currency,
      })
      if (rpcErr) {
        console.error('revolut-webhook: apply failed', rpcErr.message)
        return json({ error: 'Update failed' }, 500)
      }
      if (res !== 'applied' && res !== 'already') {
        console.error('revolut-webhook: charge not applied', sub.id, orderId, res)
        return json({ received: true })
      }
      if (res === 'applied' && wasPastDue) await notifyBilling(supabaseUrl, serviceKey, sub.user_id, 'active', sub.tier)
      return json({ received: true })
    }

    return json({ received: true })
  } catch (e) {
    console.error('revolut-webhook: error', e instanceof Error ? e.message : String(e))
    return json({ error: 'Internal error' }, 500)
  }
})
