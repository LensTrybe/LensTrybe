import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const FOUNDING_MEMBER_CAP = 500;
const OFFER_END_DATE = new Date('2026-12-31T23:59:59+11:00');

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

    if (countData >= FOUNDING_MEMBER_CAP || now > OFFER_END_DATE) {
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

    let coupon;
    try {
      coupon = await stripe.coupons.retrieve('FOUNDING_MEMBER_2026');
    } catch {
      coupon = await stripe.coupons.create({
        id: 'FOUNDING_MEMBER_2026',
        percent_off: 100,
        duration: 'repeating',
        duration_in_months: 8,
        name: 'Founding Member - Free until 1 Jan 2027',
        max_redemptions: 500,
        redeem_by: Math.floor(new Date('2026-12-31T23:59:59+11:00').getTime() / 1000),
      });
    }

    const priceId = interval === 'annual'
      ? 'price_1TKKXbHW7LVs8k6shpoFmKAi'
      : 'price_1TKKXYHW7LVs8k6sboOI02xE';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      discounts: [{ coupon: coupon.id }],
      subscription_data: {
        metadata: {
          userId,
          tier: 'expert',
          founding_member: 'true',
        },
      },
      metadata: {
        userId,
        tier: 'expert',
        founding_member: 'true',
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
