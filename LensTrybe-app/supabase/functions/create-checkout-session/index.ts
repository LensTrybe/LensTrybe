// Supabase Edge Function: create-checkout-session
// Receives: { priceId: string, userId: string, email: string }
// Returns: { url: string }

import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const priceId = String(body?.priceId || '')
    const userId = String(body?.userId || '')
    const email = String(body?.email || '')
    if (!priceId || !userId || !email) {
      return new Response(JSON.stringify({ error: 'Missing priceId, userId, or email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    // Load existing stripe_customer_id (if any)
    const { data: prof } = await sb
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    let customerId = prof?.stripe_customer_id ? String(prof.stripe_customer_id) : ''

    if (!customerId) {
      // Try to find an existing customer by email; if none, create
      const existing = await stripe.customers.list({ email, limit: 1 })
      if (existing.data?.[0]?.id) {
        customerId = existing.data[0].id
      } else {
        const created = await stripe.customers.create({
          email,
          metadata: { supabase_user_id: userId },
        })
        customerId = created.id
      }

      // Persist on profile for future
      await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 14, metadata: { supabase_user_id: userId } },
      success_url: 'http://localhost:5173/dashboard?checkout=success',
      cancel_url: 'http://localhost:5173/pricing',
      metadata: { supabase_user_id: userId, price_id: priceId },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

