/**
 * Supabase Edge Function: stripe-webhook
 */
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

const PRICE_TO_TIER: Record<string, 'pro' | 'expert' | 'elite'> = {
  price_1TKKXSHW7LVs8k6s2IW7TXsd: 'pro',
  price_1TKKXVHW7LVs8k6snGkHjQE5: 'pro',
  price_1TKKXYHW7LVs8k6sboOI02xE: 'expert',
  price_1TKKXbHW7LVs8k6shpoFmKAi: 'expert',
  price_1TKKXjHW7LVs8k6sQNNIkiCf: 'elite',
  price_1TKKXfHW7LVs8k6s99ish4aV: 'elite',
}

function tierFromPriceId(priceId?: string | null) {
  if (!priceId) return null
  return PRICE_TO_TIER[String(priceId)] || null
}

function statusFromStripe(stripeStatus?: string | null) {
  const s = String(stripeStatus || '').toLowerCase()
  if (!s) return 'active'
  if (s === 'trialing') return 'trialing'
  if (s === 'active') return 'active'
  if (s === 'past_due') return 'past_due'
  if (s === 'unpaid') return 'unpaid'
  if (s === 'canceled') return 'canceled'
  return s
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

function sanitiseName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'USER'
}

async function generateUniqueCode(sb: any, baseName: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const digits = Math.floor(100 + Math.random() * 900).toString()
    const code = `LENS-${baseName}${digits}`
    const { data } = await sb.from('profiles').select('id').eq('referral_code', code).maybeSingle()
    if (!data) return code
  }
  return `LENS-${baseName}${Date.now().toString().slice(-4)}`
}

async function ensureReferralCode(sb: any, userId: string): Promise<void> {
  const { data: profile } = await sb.from('profiles').select('referral_code, business_name').eq('id', userId).maybeSingle()
  if (!profile || profile.referral_code) return
  const firstName = (profile.business_name || 'USER').split(' ')[0]
  const baseName = sanitiseName(firstName)
  const code = await generateUniqueCode(sb, baseName)
  await sb.from('profiles').update({ referral_code: code }).eq('id', userId)
}

async function applyReferrerDiscount(stripe: Stripe, sb: any, referrerId: string): Promise<void> {
  try {
    const { data: referrerProfile } = await sb.from('profiles').select('stripe_customer_id').eq('id', referrerId).maybeSingle()
    if (!referrerProfile?.stripe_customer_id) return
    const subscriptions = await stripe.subscriptions.list({ customer: referrerProfile.stripe_customer_id, status: 'active', limit: 1 })
    if (!subscriptions.data.length) {
      const trialing = await stripe.subscriptions.list({ customer: referrerProfile.stripe_customer_id, status: 'trialing', limit: 1 })
      if (!trialing.data.length) return
      await stripe.subscriptions.update(trialing.data[0].id, { discounts: [{ coupon: 'REFERRAL10' }] })
      return
    }
    await stripe.subscriptions.update(subscriptions.data[0].id, { discounts: [{ coupon: 'REFERRAL10' }] })
  } catch (e) {
    console.error('Failed to apply referrer discount:', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) return new Response('Missing Stripe env', { status: 500, headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return new Response('Missing Supabase env', { status: 500, headers: corsHeaders })

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing stripe-signature', { status: 400, headers: corsHeaders })

  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  } catch (_e) {
    return new Response('Invalid signature', { status: 400, headers: corsHeaders })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const supabaseUserId = (session?.metadata as any)?.supabase_user_id || null
      const priceId = (session?.metadata as any)?.price_id || null
      const referralCode = (session?.metadata as any)?.referral_code || null
      const referrerId = (session?.metadata as any)?.referrer_id || null
      const tier = tierFromPriceId(priceId)
      if (supabaseUserId && tier) {
        await sb.from('profiles').update({ subscription_tier: tier, subscription_status: 'active' }).eq('id', supabaseUserId)
        await ensureReferralCode(sb, supabaseUserId)
        if (referralCode && referrerId) {
          const existing = await sb.from('referrals').select('id').eq('referred_user_id', supabaseUserId).maybeSingle()
          if (!existing.data) {
            await sb.from('referrals').insert({ referrer_id: referrerId, referred_user_id: supabaseUserId, referral_code: referralCode, status: 'pending' })
          }
        }
        await notifyBilling(supabaseUrl, serviceKey, supabaseUserId, 'active', tier)
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      const billingReason = invoice.billing_reason
      if (billingReason !== 'subscription_cycle' && billingReason !== 'subscription_create') {
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: paidProfile } = await sb.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
      if (!paidProfile) return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: pendingReferral } = await sb.from('referrals').select('id, referrer_id').eq('referred_user_id', paidProfile.id).eq('status', 'pending').maybeSingle()
      if (pendingReferral) {
        await sb.from('referrals').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', pendingReferral.id)
        const { data: referrerProfile } = await sb.from('profiles').select('referral_count').eq('id', pendingReferral.referrer_id).maybeSingle()
        await sb.from('profiles').update({ referral_count: (referrerProfile?.referral_count || 0) + 1 }).eq('id', pendingReferral.referrer_id)
        await applyReferrerDiscount(stripe, sb, pendingReferral.referrer_id)
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      const { data: prof } = await sb.from('profiles').select('id, subscription_tier').eq('stripe_customer_id', customerId).maybeSingle()
      if (prof?.id) {
        await sb.from('profiles').update({ subscription_status: 'past_due' }).eq('id', prof.id)
        await notifyBilling(supabaseUrl, serviceKey, prof.id, 'failed', prof.subscription_tier)
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const supabaseUserId = (sub?.metadata as any)?.supabase_user_id || null
      const priceId = sub?.items?.data?.[0]?.price?.id || null
      const tier = tierFromPriceId(priceId)
      const status = statusFromStripe(sub?.status || null)
      if (supabaseUserId) {
        await sb.from('profiles').update({ subscription_tier: tier || 'basic', subscription_status: status }).eq('id', supabaseUserId)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const supabaseUserId = (sub?.metadata as any)?.supabase_user_id || null
      const priceId = sub?.items?.data?.[0]?.price?.id || null
      const tier = tierFromPriceId(priceId)
      if (supabaseUserId) {
        await sb.from('profiles').update({ subscription_tier: 'basic', subscription_status: 'active' }).eq('id', supabaseUserId)
        await notifyBilling(supabaseUrl, serviceKey, supabaseUserId, 'cancelled', tier)
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
