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
// Who the order is for:
//   - Normally the caller's JWT (Authorization: Bearer <access token>). userId/email in
//     the body are ignored.
//   - Signup bootstrap: email confirmation is on, so a brand new creative has no
//     session yet when the card popup opens. Without a JWT we accept body.userId ONLY
//     for an account that is unconfirmed, created in the last 2 hours, whose email
//     matches body.email, and that has no completed subscription. The worst this path
//     allows is (re)starting that fresh account's own card setup.
//
// Refused (409) when the user already has a live subscription (active, past_due, or
// trialing with a saved card): plan changes go through change-subscription.
// An existing trial is never reset: a retry keeps the trial end already recorded, and
// a returning (expired/canceled) subscriber gets no new trial.
//
// Referrals: if a valid referralCode is supplied (and it isn't the user's own, and
// they haven't already been referred), we record the referral for the AUTHENTICATED
// user (profiles.referred_by_code + a pending referrals row) and flag the subscription
// so the first real charge gets 10% off.
//
// Receives: { tier, billing, fullName?, referralCode? } (+ userId/email for signup bootstrap)
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
const BOOTSTRAP_WINDOW_MS = 2 * 60 * 60 * 1000

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const REVOLUT_SECRET_KEY = Deno.env.get('REVOLUT_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!REVOLUT_SECRET_KEY || !supabaseUrl || !serviceKey) {
    console.error('create-revolut-order: missing env')
    return json({ error: 'Payments are not available right now.' }, 500)
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const bodyIn = await req.json().catch(() => ({}))

  // ---- Identify the user ----
  let userId = ''
  let email = ''
  let bootstrap = false
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (jwt && jwt !== serviceKey) {
    const { data: userData } = await sb.auth.getUser(jwt)
    if (userData?.user?.id) {
      userId = userData.user.id
      email = String(userData.user.email || '')
    }
  }
  if (!userId) {
    // Signup bootstrap (no session yet because email confirmation is pending).
    const claimedId = String(bodyIn?.userId || '').trim()
    const claimedEmail = String(bodyIn?.email || '').trim().toLowerCase()
    if (!UUID_RE.test(claimedId) || !claimedEmail) return json({ error: 'Not authenticated' }, 401)
    const { data: adminUser } = await sb.auth.admin.getUserById(claimedId)
    const u = adminUser?.user
    const createdMs = u?.created_at ? new Date(u.created_at).getTime() : 0
    const fresh = !!u && !u.email_confirmed_at && createdMs > 0 && Date.now() - createdMs < BOOTSTRAP_WINDOW_MS
    if (!fresh || String(u?.email || '').toLowerCase() !== claimedEmail) {
      return json({ error: 'Not authenticated' }, 401)
    }
    userId = u!.id
    email = String(u!.email || '')
    bootstrap = true
  }
  if (!email) return json({ error: 'Your account has no email address.' }, 400)

  const tier = String(bodyIn?.tier || '').toLowerCase()
  const billing = String(bodyIn?.billing || '').toLowerCase() === 'monthly' ? 'monthly' : 'annual'
  const fullName = String(bodyIn?.fullName || '').trim().slice(0, 120)
  const referralCode = String(bodyIn?.referralCode || '').toUpperCase().trim().slice(0, 40)
  if (!(tier in PLANS)) return json({ error: 'Unknown plan' }, 400)

  // ---- Existing subscription rules ----
  const { data: existing } = await sb
    .from('subscriptions')
    .select('id, status, revolut_payment_method_id, current_period_end, next_charge_date')
    .eq('user_id', userId)
    .maybeSingle()
  const exStatus = String(existing?.status || '')
  const setupIncomplete = exStatus === 'trialing' && !existing?.revolut_payment_method_id
  if (existing && (exStatus === 'active' || exStatus === 'past_due' || (exStatus === 'trialing' && !setupIncomplete))) {
    return json({ error: 'You already have a subscription. Change your plan from Settings > Subscription.' }, 409)
  }
  if (bootstrap && existing && !setupIncomplete) {
    return json({ error: 'Not authenticated' }, 401)
  }

  // Read what the signup trigger already granted: founding status + first-charge date.
  const { data: prof } = await sb
    .from('profiles')
    .select('revolut_customer_id, founding_member, next_billing_date, referred_by_code, pending_deletion')
    .eq('id', userId)
    .maybeSingle()

  if (prof?.pending_deletion) {
    return json({ error: 'Your account is scheduled for deletion. Reactivate it before choosing a plan.' }, 403)
  }

  const isFounding = !!prof?.founding_member

  // Amount: founding locks Expert at $49/mo ($588/yr); other plans and everyone else pay
  // the standard plan price.
  const amount = isFounding && tier === 'expert'
    ? (billing === 'annual' ? FOUNDING_ANNUAL : FOUNDING_MONTHLY)
    : PLANS[tier][billing]

  // ---- Referral capture (paid tiers only; this function never runs for Basic) ----
  // Only for a first-time subscriber, and only for the authenticated/bootstrapped user.
  if (referralCode && !prof?.referred_by_code && (!existing || setupIncomplete)) {
    const { data: referrer } = await sb
      .from('profiles')
      .select('id')
      .eq('referral_code', referralCode)
      .maybeSingle()
    if (referrer?.id && referrer.id !== userId) {
      await sb.from('profiles').update({ referred_by_code: referralCode }).eq('id', userId)
      const { data: existingRef } = await sb
        .from('referrals')
        .select('id')
        .eq('referred_user_id', userId)
        .maybeSingle()
      if (!existingRef) {
        await sb.from('referrals').insert({
          referrer_id: referrer.id,
          referred_user_id: userId,
          referral_code: referralCode,
          status: 'pending',
        })
      }
    }
  }

  // A pending referral means the first real charge should be discounted 10%.
  const { data: pendingRef } = await sb
    .from('referrals')
    .select('id')
    .eq('referred_user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()
  const firstChargeDiscount = !!pendingRef

  // ---- First-charge date (never reset an existing trial) ----
  const now = new Date()
  const todayUtc = now.toISOString().slice(0, 10)
  let firstChargeDate: string
  let periodEndIso: string
  if (setupIncomplete && existing?.next_charge_date) {
    // Retry of an unfinished card setup: keep the trial end already recorded.
    firstChargeDate = String(existing.next_charge_date).slice(0, 10)
    periodEndIso = existing.current_period_end
      ? new Date(existing.current_period_end).toISOString()
      : new Date(`${firstChargeDate}T00:00:00+10:00`).toISOString()
  } else if (existing) {
    // Returning subscriber (expired / canceled): no new trial. Charge when any paid
    // time they still have runs out, otherwise on the next billing run.
    const end = existing.current_period_end ? new Date(existing.current_period_end) : null
    if (end && end.getTime() > now.getTime()) {
      firstChargeDate = end.toISOString().slice(0, 10)
      periodEndIso = end.toISOString()
    } else {
      firstChargeDate = todayUtc
      periodEndIso = now.toISOString()
    }
  } else {
    // First subscription: first-charge date comes from the profile (trigger set
    // founding = +12 months, paid trial = +3 months). Fall back to a 3-month trial.
    if (prof?.next_billing_date) {
      firstChargeDate = String(prof.next_billing_date).slice(0, 10)
    } else {
      const d = new Date(now)
      d.setMonth(d.getMonth() + TRIAL_MONTHS)
      firstChargeDate = d.toISOString().slice(0, 10)
    }
    // Brisbane-time start of that day, so the period end lines up with the calendar date.
    periodEndIso = new Date(`${firstChargeDate}T00:00:00+10:00`).toISOString()
  }

  // 1. Reuse or create the Revolut customer.
  let customerId = prof?.revolut_customer_id ? String(prof.revolut_customer_id) : ''
  if (!customerId) {
    const cust = await revolut('/customers', REVOLUT_SECRET_KEY, { full_name: fullName || email, email })
    if (!cust.ok || !cust.body?.id) {
      console.error('create-revolut-order: customer create failed', cust.status, JSON.stringify(cust.body))
      return json({ error: 'Could not start checkout. Please try again.' }, 502)
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
    console.error('create-revolut-order: setup order failed', order.status, JSON.stringify(order.body))
    return json({ error: 'Could not start checkout. Please try again.' }, 502)
  }
  const orderId = String(order.body.id)
  const token = String(order.body.token)

  // 3. Record a trialing subscription with the right price + first-charge date. The
  // saved card is attached by revolut-webhook when this setup order completes, so a
  // returning subscriber is never charged on an old card they did not re-confirm.
  const { error: upsertErr } = await sb.from('subscriptions').upsert(
    {
      user_id: userId,
      provider: 'revolut',
      tier,
      billing,
      status: 'trialing',
      revolut_customer_id: customerId,
      revolut_payment_method_id: null,
      revolut_last_order_id: orderId,
      amount_minor: amount,
      currency: CURRENCY,
      current_period_end: periodEndIso,
      next_charge_date: firstChargeDate,
      founding_member: isFounding,
      first_charge_discount: firstChargeDiscount,
      pending_tier: null,
      pending_billing: null,
      pending_change_at: null,
      failed_attempts: 0,
      past_due_since: null,
      inflight_charge: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (upsertErr) {
    console.error('create-revolut-order: upsert failed', upsertErr.message)
    return json({ error: 'Could not record your subscription. Please try again.' }, 500)
  }

  return json({
    token,
    orderId,
    trialEnd: firstChargeDate,
    env: (Deno.env.get('REVOLUT_ENV') || 'sandbox').toLowerCase(),
  })
})
