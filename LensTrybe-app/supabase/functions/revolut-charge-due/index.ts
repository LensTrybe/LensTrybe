// Supabase Edge Function: revolut-charge-due
// Scheduled job (run daily via cron). Charges the saved card for every
// subscription whose next_charge_date is due, off-session (merchant-initiated).
// Also downgrades canceled subs to Basic once their paid period ends, and applies
// any SCHEDULED plan downgrade at renewal (pending_tier/pending_billing) so the
// creative is charged the new lower price and stepped down at their period end.
// Picks up trialing subs whose trial/deferral ended, active renewals and past_due
// retries.
//
// Safety:
//   - Each subscription is CLAIMED (charging_at) before charging, so overlapping runs
//     can never double charge.
//   - A charge only counts once Revolut reports the order COMPLETED. A charge that is
//     still processing is recorded in inflight_charge and settled on the next run (or
//     by revolut-webhook) through the revolut_apply_charge DB function, which applies
//     each order exactly once.
//   - Dunning: a failed charge marks the sub past_due and it is retried daily. After
//     3 failed attempts or 7 days past due the creative moves to Basic.
//   - Trials that ended without a saved card move to Basic.
//
// Referral discounts (all paid-only, since only paid subs are charged here):
//   - Referred creative's FIRST real charge gets 10% off (subscriptions.first_charge_discount).
//     On success that referral is confirmed and the referrer is credited one reward.
//   - Referrer rewards (profiles.pending_referral_rewards) are then redeemed on the
//     referrer's own charges: monthly consumes one 10% reward per charge; annual stacks
//     all pending rewards onto the one renewal, capped at 50% off (5 rewards).
//
// Single subscription retry: body { subscription_id } runs only the charge step for
// that one subscription (used by update-payment-method right after a creative replaces
// the card on a past-due subscription). A failed manual retry never moves them to
// Basic by itself and sends no email (they see the result on screen); the 7-day
// past-due limit still applies.
//
// Auth: requires header `x-cron-secret` == CRON_SECRET. Fails closed if CRON_SECRET
// is not set.

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

// Referral discount tuning.
const REFERRED_FIRST_CHARGE_PCT = 10   // referred creative's first real charge
const REWARD_PCT_EACH = 10             // one confirmed referral = 10%
const ANNUAL_MAX_REWARDS = 5           // annual stacks up to 5 (=> 50% cap)
const TOTAL_DISCOUNT_CAP = 60          // safety cap on any single charge's combined discount
const MIN_CHARGE_MINOR = 50            // never charge below this when a discount applies

// Dunning.
const MAX_FAILED_ATTEMPTS = 3
const MAX_PAST_DUE_DAYS = 7
const CLAIM_TTL_MS = 30 * 60 * 1000
const INFLIGHT_STALE_MS = 48 * 60 * 60 * 1000

const PAY_DECLINED = ['declined', 'soft_declined', 'failed', 'cancelled']

function priceFor(tier: string, billing: string, founding: boolean): number | null {
  // The founding rate is for the Expert plan only; other plans are standard price.
  if (founding && tier === 'expert') return billing === 'annual' ? FOUNDING_ANNUAL : FOUNDING_MONTHLY
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

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type OrderInfo = { state: string; amount: number | null; currency: string }
async function getOrder(orderId: string, key: string): Promise<OrderInfo> {
  const ord = await revolut(`/orders/${orderId}`, key, 'GET')
  const b = (ord.body || {}) as Record<string, unknown>
  const amt = Number(b.amount)
  return {
    state: ord.ok ? String(b.state || '').toLowerCase() : '',
    amount: Number.isFinite(amt) ? amt : null,
    currency: String(b.currency || '').toUpperCase(),
  }
}

// Poll the order until Revolut reports a final state (or we give up for this run).
async function settleOrder(orderId: string, key: string, payState: string, tries = 4): Promise<{ outcome: 'completed' | 'failed' | 'pending'; info: OrderInfo }> {
  let info: OrderInfo = { state: '', amount: null, currency: '' }
  for (let i = 0; i < tries; i++) {
    info = await getOrder(orderId, key)
    if (info.state === 'completed') return { outcome: 'completed', info }
    if (info.state === 'failed' || info.state === 'cancelled') return { outcome: 'failed', info }
    if (info.state === 'pending' && PAY_DECLINED.includes(payState)) return { outcome: 'failed', info }
    if (i < tries - 1) await sleep(1500)
  }
  return { outcome: 'pending', info }
}

function tomorrowUtc() {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!REVOLUT_SECRET_KEY || !supabaseUrl || !serviceKey || !cronSecret) {
    console.error('revolut-charge-due: missing env (REVOLUT_SECRET_KEY / SUPABASE_* / CRON_SECRET)')
    return json({ error: 'Not configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-cron-secret') || '', cronSecret)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const reqBody = await req.json().catch(() => ({}))
  const onlySub = typeof reqBody?.subscription_id === 'string' && /^[0-9a-f-]{36}$/i.test(reqBody.subscription_id) ? String(reqBody.subscription_id) : ''
  const manual = !!onlySub
  const today = new Date().toISOString().slice(0, 10)
  const nowIso = new Date().toISOString()
  const counts = { expired_canceled: 0, expired_no_card: 0, due: 0, charged: 0, failed: 0, pending: 0, downgraded: 0, skipped: 0, errors: 0 }

  // Downgrade canceled subs whose paid access period has now ended -> Basic.
  // (Daily run only, not a single-subscription retry.)
  const { data: expiredCanceled } = manual ? { data: [] as Array<{ id: string; user_id: string }> } : await sb
    .from('subscriptions')
    .select('id, user_id')
    .eq('provider', 'revolut')
    .eq('status', 'canceled')
    .lt('current_period_end', nowIso)
  for (const s of expiredCanceled || []) {
    await sb.from('subscriptions').update({ status: 'expired', next_charge_date: null, updated_at: nowIso }).eq('id', s.id)
    await sb.from('profiles').update({ subscription_tier: 'basic', subscription_status: 'canceled' }).eq('id', s.user_id)
    counts.expired_canceled++
  }

  // Trials that ended without a saved card cannot be charged: move them to Basic.
  const { data: noCard } = manual ? { data: [] as Array<{ id: string; user_id: string }> } : await sb
    .from('subscriptions')
    .select('id, user_id')
    .eq('provider', 'revolut')
    .eq('status', 'trialing')
    .is('revolut_payment_method_id', null)
    .lte('next_charge_date', today)
  for (const s of noCard || []) {
    await sb.from('subscriptions').update({ status: 'expired', next_charge_date: null, updated_at: nowIso }).eq('id', s.id).eq('status', 'trialing').is('revolut_payment_method_id', null)
    await sb.from('profiles').update({ subscription_tier: 'basic', subscription_status: 'canceled' }).eq('id', s.user_id)
    counts.expired_no_card++
  }

  // Due: trialing subs whose trial has ended, active renewals, and past_due retries.
  let dueQuery = sb
    .from('subscriptions')
    .select('id, user_id, tier, billing, status, amount_minor, currency, revolut_customer_id, revolut_payment_method_id, current_period_end, founding_member, pending_tier, pending_billing, first_charge_discount, failed_attempts, past_due_since, inflight_charge')
    .eq('provider', 'revolut')
    .in('status', ['active', 'trialing', 'past_due'])
    .not('revolut_payment_method_id', 'is', null)
    .lte('next_charge_date', today)
  if (manual) dueQuery = dueQuery.eq('id', onlySub).eq('status', 'past_due')
  const { data: due, error } = await dueQuery

  if (error) {
    console.error('revolut-charge-due: due query failed', error.message)
    return json({ error: 'Query failed' }, 500)
  }
  counts.due = (due || []).length

  // Record a failed charge: past_due + retry tomorrow, or move to Basic once dunning is exhausted.
  async function recordFailure(sub: Record<string, any>, orderId: string | null, tier: string, amount: number) {
    // A manual retry (new card just added) counts, but never uses up the last attempt.
    const attempts = manual
      ? Math.min(Number(sub.failed_attempts || 0) + 1, MAX_FAILED_ATTEMPTS - 1)
      : Number(sub.failed_attempts || 0) + 1
    const since = sub.past_due_since ? new Date(sub.past_due_since) : new Date()
    const daysPastDue = (Date.now() - since.getTime()) / 86400000
    if ((!manual && attempts >= MAX_FAILED_ATTEMPTS) || daysPastDue >= MAX_PAST_DUE_DAYS) {
      await sb.from('subscriptions').update({
        status: 'expired',
        next_charge_date: null,
        failed_attempts: attempts,
        past_due_since: since.toISOString(),
        inflight_charge: null,
        pending_tier: null, pending_billing: null, pending_change_at: null,
        ...(orderId ? { revolut_last_order_id: orderId } : {}),
        charging_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id)
      await sb.from('profiles').update({ subscription_tier: 'basic', subscription_status: 'canceled' }).eq('id', sub.user_id)
      await notifyBilling(supabaseUrl!, serviceKey!, sub.user_id, 'downgraded', tier)
      counts.downgraded++
      return
    }
    await sb.from('subscriptions').update({
      status: 'past_due',
      failed_attempts: attempts,
      past_due_since: since.toISOString(),
      next_charge_date: tomorrowUtc(),
      inflight_charge: null,
      ...(orderId ? { revolut_last_order_id: orderId } : {}),
      charging_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', sub.id)
    await sb.from('profiles').update({ subscription_status: 'past_due' }).eq('id', sub.user_id)
    if (!manual) await notifyBilling(supabaseUrl!, serviceKey!, sub.user_id, 'failed', tier, amount, sub.currency)
    counts.failed++
  }

  async function applySuccess(sub: Record<string, any>, orderId: string, info: OrderInfo) {
    const { data: res, error: rpcErr } = await sb.rpc('revolut_apply_charge', {
      p_sub: sub.id, p_order: orderId, p_amount: info.amount, p_currency: info.currency,
    })
    if (rpcErr || (res !== 'applied' && res !== 'already')) {
      console.error('revolut-charge-due: CHARGED BUT NOT APPLIED', sub.id, orderId, rpcErr?.message || res)
      counts.errors++
      return
    }
    if (res === 'applied') {
      counts.charged++
      if (sub.status === 'past_due') await notifyBilling(supabaseUrl!, serviceKey!, sub.user_id, 'active', sub.tier)
    }
  }

  const releaseClaim = (id: string) => sb.from('subscriptions').update({ charging_at: null }).eq('id', id)

  for (const sub of due || []) {
    try {
      // Claim the row so a concurrent run cannot charge it too.
      const cutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
      const { data: claimed } = await sb
        .from('subscriptions')
        .update({ charging_at: new Date().toISOString() })
        .eq('id', sub.id)
        .or(`charging_at.is.null,charging_at.lt."${cutoff}"`)
        .select('id')
      if (!claimed || claimed.length === 0) { counts.skipped++; continue }

      // ---- A charge from an earlier run is still unsettled: settle it first. ----
      const inflight = sub.inflight_charge as Record<string, any> | null
      if (inflight?.order_id) {
        const orderId = String(inflight.order_id)
        const { outcome, info } = await settleOrder(orderId, REVOLUT_SECRET_KEY, '', 1)
        if (outcome === 'completed') {
          await applySuccess(sub, orderId, info)
          await releaseClaim(sub.id)
        } else if (outcome === 'failed') {
          await recordFailure(sub, orderId, String(inflight.tier || sub.tier), Number(inflight.amount || 0))
        } else {
          const age = Date.now() - new Date(String(inflight.created_at || nowIso)).getTime()
          if (age > INFLIGHT_STALE_MS) {
            // Stuck for 2 days: cancel it so it can never be captured, then treat as failed.
            await revolut(`/orders/${orderId}/cancel`, REVOLUT_SECRET_KEY, 'POST')
            const again = await settleOrder(orderId, REVOLUT_SECRET_KEY, 'cancelled', 1)
            if (again.outcome === 'completed') await applySuccess(sub, orderId, again.info)
            else if (again.outcome === 'failed') { await recordFailure(sub, orderId, String(inflight.tier || sub.tier), Number(inflight.amount || 0)); continue }
            else counts.pending++
          } else {
            counts.pending++
          }
          await releaseClaim(sub.id)
        }
        continue
      }

      // Apply a scheduled downgrade at renewal: charge the NEW lower price and
      // step the tier down. pending_* is only ever set for real downgrades (never
      // to Basic - that path is cancellation).
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
      if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
        console.error('revolut-charge-due: bad amount on sub', sub.id)
        counts.errors++
        await releaseClaim(sub.id)
        continue
      }

      // ---- Referral discounts ----
      // (a) Referred creative's first real charge.
      const firstChargePct = sub.first_charge_discount ? REFERRED_FIRST_CHARGE_PCT : 0

      // (b) Referrer rewards owed to THIS creative.
      let rewardPct = 0
      let rewardsToConsume = 0
      const { data: uprof } = await sb
        .from('profiles')
        .select('pending_referral_rewards')
        .eq('id', sub.user_id)
        .maybeSingle()
      const pendingRewards = Number(uprof?.pending_referral_rewards || 0)
      if (pendingRewards > 0) {
        if (chargeBilling === 'monthly') {
          rewardsToConsume = 1
          rewardPct = REWARD_PCT_EACH
        } else {
          const usable = Math.min(pendingRewards, ANNUAL_MAX_REWARDS)
          rewardsToConsume = usable
          rewardPct = usable * REWARD_PCT_EACH
        }
      }

      const discountPct = Math.min(firstChargePct + rewardPct, TOTAL_DISCOUNT_CAP)
      const chargedAmount = discountPct > 0
        ? Math.max(Math.round(chargeAmount * (100 - discountPct) / 100), MIN_CHARGE_MINOR)
        : chargeAmount
      const currency = String(sub.currency || 'AUD').toUpperCase()

      const order = await revolut('/orders', REVOLUT_SECRET_KEY, 'POST', {
        amount: chargedAmount,
        currency,
        capture_mode: 'automatic',
        customer: { id: sub.revolut_customer_id },
        merchant_order_data: { reference: sub.user_id },
      })
      if (!order.ok || !order.body?.id) {
        // Could not even create the order (Revolut/API problem, not the card): retry next run.
        console.error('revolut-charge-due: order create failed', sub.id, order.status, JSON.stringify(order.body))
        counts.errors++
        await releaseClaim(sub.id)
        continue
      }
      const orderId = String(order.body.id)

      // Record the charge BEFORE taking payment so whichever of this run, the next run
      // or the webhook sees it complete can apply it (exactly once).
      const { error: inflErr } = await sb.from('subscriptions').update({
        inflight_charge: {
          order_id: orderId,
          amount: chargedAmount,
          currency,
          tier: chargeTier,
          billing: chargeBilling,
          amount_minor: chargeAmount,
          applying_downgrade: applyingDowngrade,
          first_charge_pct: firstChargePct,
          rewards: rewardsToConsume,
          created_at: new Date().toISOString(),
        },
        revolut_last_order_id: orderId,
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id)
      if (inflErr) {
        console.error('revolut-charge-due: could not record charge, not charging', sub.id, inflErr.message)
        await revolut(`/orders/${orderId}/cancel`, REVOLUT_SECRET_KEY, 'POST')
        counts.errors++
        await releaseClaim(sub.id)
        continue
      }

      const pay = await revolut(`/orders/${orderId}/payments`, REVOLUT_SECRET_KEY, 'POST', {
        saved_payment_method: {
          type: 'card',
          id: sub.revolut_payment_method_id,
          initiator: 'merchant',
        },
      })
      const payState = pay.ok ? String(pay.body?.state || '').toLowerCase() : 'failed'
      const { outcome, info } = await settleOrder(orderId, REVOLUT_SECRET_KEY, payState)

      if (outcome === 'completed') {
        await applySuccess(sub, orderId, info)
        await releaseClaim(sub.id)
      } else if (outcome === 'failed') {
        // Make sure a declined order can never be captured later.
        await revolut(`/orders/${orderId}/cancel`, REVOLUT_SECRET_KEY, 'POST')
        await recordFailure(sub, orderId, chargeTier, chargedAmount)
      } else {
        // Still processing: leave inflight_charge in place; the webhook or next run settles it.
        counts.pending++
        await releaseClaim(sub.id)
      }
    } catch (e) {
      console.error('revolut-charge-due: error on sub', sub.id, e instanceof Error ? e.message : String(e))
      counts.errors++
      // Leave the claim to expire (30 min) rather than risk a double charge right now.
    }
  }

  return json({ ran_at: new Date().toISOString(), ...(manual ? { subscription_id: onlySub } : {}), ...counts })
})
