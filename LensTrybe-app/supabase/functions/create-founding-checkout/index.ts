import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const FOUNDING_MEMBER_CAP = 500;
// Offer closes end of 31 Dec 2026 (Brisbane, UTC+10, no DST).
const OFFER_END_DATE = new Date('2026-12-31T23:59:59+10:00');
// Expert is free until this moment, then billing begins (Brisbane time).
const BILLING_START = new Date('2027-01-01T00:00:00+10:00');

// Live-mode Expert price IDs (verified): monthly $74.99, annual $749.90 (2 months free).
const EXPERT_PRICES = {
  monthly: 'price_1TKKXYHW7LVs8k6sboOI02xE',
  annual: 'price_1TKKXbHW7LVs8k6shpoFmKAi',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, email, interval } = await req.json();

    if (!userId || !email) {
      return new Response(JSON.stringify({ error: 'Missing userId or email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: countData } = await supabase.rpc('get_founding_member_count');
    const now = new Date();

    if ((countData ?? 0) >= FOUNDING_MEMBER_CAP || now > OFFER_END_DATE) {
      return new Response(
        JSON.stringify({ error: 'Founding member offer has closed.' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    const isAnnual = interval === 'annual' || interval === 'yearly';
    const priceId = isAnnual ? EXPERT_PRICES.annual : EXPERT_PRICES.monthly;

    // Free until 1 Jan 2027 via an absolute trial end. Card is collected now
    // (payment_method_collection: always) and the plan bills automatically on
    // 1 Jan 2027: monthly $74.99 or annual $749.90 (2 months free baked in).
    const billingStartSec = Math.floor(BILLING_START.getTime() / 1000);
    const nowSec = Math.floor(now.getTime() / 1000);
    // Stripe requires trial_end to be >= ~48h out; guard the final days of the
    // offer so checkout never errors that close to the billing-start date.
    const trialEnd = billingStartSec > nowSec + 60 * 60 * 49 ? billingStartSec : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(trialEnd ? { trial_end: trialEnd } : {}),
        metadata: {
          userId,
          tier: 'expert',
          founding_member: 'true',
          interval: isAnnual ? 'annual' : 'monthly',
        },
      },
      metadata: {
        userId,
        tier: 'expert',
        founding_member: 'true',
        interval: isAnnual ? 'annual' : 'monthly',
      },
      success_url: 'https://app.lenstrybe.com/dashboard?founding=1',
      cancel_url: 'https://app.lenstrybe.com/pricing',
      payment_method_collection: 'always',
      custom_text: {
        submit: {
          message: 'Your card will not be charged until 1 January 2027. You are locking in the Expert plan free until then as a founding member.',
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-founding-checkout error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
