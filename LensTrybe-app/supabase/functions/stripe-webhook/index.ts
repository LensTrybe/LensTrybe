/**
 * Supabase Edge Function: stripe-webhook
 *
 * Local testing (Stripe CLI):
 *   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
 *
 * Required env:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 *
 * This function updates `profiles.subscription_tier` and `profiles.subscription_status`
 * based on Stripe events.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response('Missing Stripe env', { status: 500, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response('Missing Supabase env', { status: 500, headers: corsHeaders })
  }

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
      const tier = tierFromPriceId(priceId)
      if (supabaseUserId && tier) {
        await sb
          .from('profiles')
          .update({ subscription_tier: tier, subscription_status: 'active' })
          .eq('id', supabaseUserId)
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const supabaseUserId = (sub?.metadata as any)?.supabase_user_id || null
      const priceId = sub?.items?.data?.[0]?.price?.id || null
      const tier = tierFromPriceId(priceId)
      const status = statusFromStripe(sub?.status || null)
      if (supabaseUserId) {
        await sb
          .from('profiles')
          .update({
            subscription_tier: tier || 'basic',
            subscription_status: status,
          })
          .eq('id', supabaseUserId)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const supabaseUserId = (sub?.metadata as any)?.supabase_user_id || null
      if (supabaseUserId) {
        await sb
          .from('profiles')
          .update({ subscription_tier: 'basic', subscription_status: 'active' })
          .eq('id', supabaseUserId)
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

