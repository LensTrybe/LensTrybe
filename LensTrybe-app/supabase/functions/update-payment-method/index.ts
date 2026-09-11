// Supabase Edge Function: update-payment-method
// Client-facing (verify_jwt = false), authenticated INSIDE with the caller's JWT.
// Lets a creative replace the card saved on their subscription, for example after a
// failed payment or when their card expires.
//
// Actions (POST body { action }):
//   - 'card'     Returns the saved card for display ({ brand, last4, expMonth, expYear }).
//                Looks it up on Revolut (and stores it) the first time.
//   - 'start'    Creates a ZERO-AMOUNT Revolut order for the creative's Revolut customer.
//                The browser opens the card popup with it (savePaymentMethodFor 'merchant'),
//                which saves the new card. Nothing is charged. Returns { token, orderId, env }.
//   - 'confirm'  { orderId } After the popup succeeds: checks the order with Revolut, finds
//                the newly saved card and makes it the subscription's card. If the
//                subscription is past due, the overdue payment is retried on the new card
//                straight away (via revolut-charge-due for just this subscription).
//                Returns { ok, card, retried, paid, status }.
// revolut-webhook also applies a completed card update, in case the creative closes the
// page before 'confirm' runs.
//
// Secrets: REVOLUT_SECRET_KEY, REVOLUT_ENV, CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const REVOLUT_API_VERSION = '2026-04-20'
const UPDATABLE = ['trialing', 'active', 'past_due']
const ORDER_ID_RE = /^[A-Za-z0-9-]{8,80}$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function revolutEnv() { return (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase() }
function revolutBase() {
  return revolutEnv() === 'production' ? 'https://merchant.revolut.com/api' : 'https://sandbox-merchant.revolut.com/api'
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type SavedCard = { id: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; createdAt: string }

async function listCards(customerId: string, key: string): Promise<SavedCard[]> {
  const r = await revolut(`/customers/${encodeURIComponent(customerId)}/payment-methods`, key, 'GET')
  const raw = Array.isArray(r.body) ? r.body : (r.body as Record<string, unknown>)?.payment_methods
  if (!Array.isArray(raw)) return []
  return (raw as Array<Record<string, unknown>>)
    .filter((m) => m && m.id && String(m.saved_for || 'merchant') === 'merchant')
    .map((m) => ({
      id: String(m.id),
      brand: m.brand ? String(m.brand) : null,
      last4: m.last_four ? String(m.last_four) : null,
      expMonth: Number.isFinite(Number(m.expiry_month)) ? Number(m.expiry_month) : null,
      expYear: Number.isFinite(Number(m.expiry_year)) ? Number(m.expiry_year) : null,
      createdAt: String(m.created_at || ''),
    }))
}

function cardFields(c: SavedCard | null) {
  return { card_brand: c?.brand ?? null, card_last4: c?.last4 ?? null, card_exp_month: c?.expMonth ?? null, card_exp_year: c?.expYear ?? null }
}
function cardOut(row: Record<string, unknown>) {
  if (!row?.card_last4) return null
  return { brand: row.card_brand || null, last4: row.card_last4, expMonth: row.card_exp_month ?? null, expYear: row.card_exp_year ?? null }
}

// Pick the card the order just saved: the order's own payment method when it is in the
// saved list, otherwise the most recently saved card.
function pickNewCard(cards: SavedCard[], order: Record<string, unknown>): SavedCard | null {
  if (!cards.length) return null
  const payments = Array.isArray(order.payments) ? order.payments as Array<Record<string, unknown>> : []
  for (const p of payments.slice().reverse()) {
    const pmId = String((p.payment_method as Record<string, unknown> | undefined)?.id || '')
    const hit = pmId && cards.find((c) => c.id === pmId)
    if (hit) return hit
  }
  return cards.slice().sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0]
}

async function runRetry(supabaseUrl: string, cronSecret: string, subId: string) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/revolut-charge-due`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({ subscription_id: subId }),
    })
    return res.ok
  } catch (_e) { return false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  if (!REVOLUT_SECRET_KEY || !supabaseUrl || !serviceKey) {
    console.error('update-payment-method: missing env')
    return json({ error: 'Card updates are not available right now.' }, 500)
  }

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token === serviceKey) return json({ error: 'Please sign in again.' }, 401)
  const sb: SupabaseClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return json({ error: 'Please sign in again.' }, 401)

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || '')

  const { data: sub } = await sb
    .from('subscriptions')
    .select('id, user_id, tier, status, revolut_customer_id, revolut_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, card_update_order_id, processed_order_ids, inflight_charge, next_charge_date')
    .eq('user_id', user.id)
    .eq('provider', 'revolut')
    .maybeSingle()
  if (!sub) return json({ error: "You don't have a paid subscription yet." }, 404)

  try {
    // ---------- card ----------
    if (action === 'card') {
      if (!sub.revolut_payment_method_id) return json({ card: null })
      if (sub.card_last4) return json({ card: cardOut(sub) })
      if (!sub.revolut_customer_id) return json({ card: null })
      const cards = await listCards(String(sub.revolut_customer_id), REVOLUT_SECRET_KEY)
      const current = cards.find((c) => c.id === sub.revolut_payment_method_id) || null
      if (!current) return json({ card: null })
      await sb.from('subscriptions').update(cardFields(current)).eq('id', sub.id)
      return json({ card: cardOut({ ...sub, ...cardFields(current) }) })
    }

    if (!UPDATABLE.includes(String(sub.status)) || !sub.revolut_customer_id) {
      return json({ error: 'There is no active subscription to update. Choose a plan in Settings > Subscription.' }, 409)
    }

    // ---------- start ----------
    if (action === 'start') {
      const { data: allowed } = await sb.rpc('rate_limit_hit', { p_key: `card-update:${user.id}`, p_max: 8, p_window_seconds: 3600 })
      if (allowed === false) return json({ error: "You've tried a few times already. Please wait a little and try again." }, 429)

      const order = await revolut('/orders', REVOLUT_SECRET_KEY, 'POST', {
        amount: 0,
        currency: 'AUD',
        customer: { id: sub.revolut_customer_id },
        description: 'LensTrybe: update saved card',
        merchant_order_data: { reference: user.id },
      })
      if (!order.ok || !order.body?.id || !order.body?.token) {
        console.error('update-payment-method: order create failed', order.status, JSON.stringify(order.body))
        return json({ error: 'Could not open the card form. Please try again.' }, 502)
      }
      const orderId = String(order.body.id)
      const { error: upErr } = await sb.from('subscriptions').update({
        card_update_order_id: orderId,
        card_update_started_at: new Date().toISOString(),
      }).eq('id', sub.id)
      if (upErr) {
        console.error('update-payment-method: could not record order', upErr.message)
        return json({ error: 'Could not open the card form. Please try again.' }, 500)
      }
      return json({ token: String(order.body.token), orderId, env: revolutEnv() })
    }

    // ---------- confirm ----------
    if (action === 'confirm') {
      const orderId = String(body?.orderId || '')
      if (!ORDER_ID_RE.test(orderId)) return json({ error: 'Missing order.' }, 400)
      const processed: string[] = Array.isArray(sub.processed_order_ids) ? sub.processed_order_ids : []

      // Already applied (webhook got there first): just report the card.
      if (processed.includes(orderId) && sub.card_update_order_id !== orderId) {
        return json({ ok: true, card: cardOut(sub), retried: false, paid: false, status: sub.status })
      }
      if (sub.card_update_order_id !== orderId) return json({ error: 'That card update has expired. Please try again.' }, 409)

      // The popup can report success a moment before Revolut marks the order complete.
      let order: Record<string, unknown> = {}
      let state = ''
      for (let i = 0; i < 5; i++) {
        const r = await revolut(`/orders/${orderId}`, REVOLUT_SECRET_KEY, 'GET')
        order = (r.body || {}) as Record<string, unknown>
        state = String(order.state || '').toLowerCase()
        if (state === 'completed' || state === 'authorised' || state === 'failed' || state === 'cancelled') break
        await sleep(1500)
      }
      if (state !== 'completed' && state !== 'authorised') {
        return json({ error: state === 'failed' || state === 'cancelled' ? 'Your card could not be saved. Please check the details or try another card.' : "We couldn't confirm your new card yet. Refresh in a minute to check." }, 409)
      }
      if (Number(order.amount) !== 0) return json({ error: 'Unexpected order.' }, 409)

      let newCard: SavedCard | null = null
      for (let i = 0; i < 3 && !newCard; i++) {
        newCard = pickNewCard(await listCards(String(sub.revolut_customer_id), REVOLUT_SECRET_KEY), order)
        if (!newCard) await sleep(1500)
      }
      if (!newCard) return json({ error: "We couldn't confirm your new card yet. Refresh in a minute to check." }, 409)

      const oldPm = sub.revolut_payment_method_id ? String(sub.revolut_payment_method_id) : ''
      const wasPastDue = sub.status === 'past_due'
      const { data: upd, error: upErr } = await sb.from('subscriptions').update({
        revolut_payment_method_id: newCard.id,
        ...cardFields(newCard),
        card_update_order_id: null,
        card_update_started_at: null,
        processed_order_ids: [...processed, orderId],
        ...(wasPastDue ? { next_charge_date: new Date().toISOString().slice(0, 10) } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id).eq('card_update_order_id', orderId).select('id')
      if (upErr) {
        console.error('update-payment-method: update failed', upErr.message)
        return json({ error: 'Could not save your new card. Please try again.' }, 500)
      }
      if (!upd || upd.length === 0) {
        // The webhook applied it in the meantime.
        const { data: fresh } = await sb.from('subscriptions').select('status, card_brand, card_last4, card_exp_month, card_exp_year').eq('id', sub.id).maybeSingle()
        return json({ ok: true, card: cardOut(fresh || {}), retried: false, paid: false, status: fresh?.status || sub.status })
      }

      // Tidy up: remove the old card from Revolut (not while a charge on it is still settling).
      if (oldPm && oldPm !== newCard.id && !sub.inflight_charge) {
        const del = await revolut(`/customers/${encodeURIComponent(String(sub.revolut_customer_id))}/payment-methods/${encodeURIComponent(oldPm)}`, REVOLUT_SECRET_KEY, 'DELETE')
        if (!del.ok) console.warn('update-payment-method: could not remove old card', del.status)
      }

      // Past due: try the overdue payment on the new card now.
      let retried = false
      let status = String(sub.status)
      if (wasPastDue && cronSecret && !sub.inflight_charge) {
        retried = await runRetry(supabaseUrl, cronSecret, String(sub.id))
        const { data: after } = await sb.from('subscriptions').select('status').eq('id', sub.id).maybeSingle()
        status = String(after?.status || status)
      }
      return json({ ok: true, card: cardOut({ ...cardFields(newCard) }), retried, paid: retried && status === 'active', status })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('update-payment-method error:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
