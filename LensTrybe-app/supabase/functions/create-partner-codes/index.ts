import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function stripePost(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { partner_name, partner_handle } = await req.json();

    if (!partner_name || !partner_handle) {
      return new Response(JSON.stringify({ error: 'partner_name and partner_handle are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean handle for use in codes (uppercase, alphanumeric only)
    const cleanHandle = partner_handle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 1. Create 100% off coupon for partner's free Elite account (12 months)
    const freeCoupon = await stripePost('coupons', {
      'name': `${partner_name} - Founding Partner (12mo Elite Free)`,
      'percent_off': '100',
      'duration': 'repeating',
      'duration_in_months': '12',
      'max_redemptions': '1',
      'metadata[type]': 'founding_partner_free',
      'metadata[partner]': partner_handle,
    });

    // 2. Create promotion code for partner's free account (their personal use only)
    const freePromoCode = await stripePost('promotion_codes', {
      'coupon': freeCoupon.id,
      'code': `${cleanHandle}FREE`,
      'max_redemptions': '1',
      'metadata[type]': 'founding_partner_free',
      'metadata[partner]': partner_handle,
    });

    // 3. Create 20% off coupon for partner's audience (first payment, annual only)
    const audienceCoupon = await stripePost('coupons', {
      'name': `${partner_name} - Audience Discount (20% off first payment)`,
      'percent_off': '20',
      'duration': 'once',
      'metadata[type]': 'partner_audience_discount',
      'metadata[partner]': partner_handle,
    });

    // 4. Create promotion code for partner's audience
    const audiencePromoCode = await stripePost('promotion_codes', {
      'coupon': audienceCoupon.id,
      'code': `${cleanHandle}20`,
      'metadata[type]': 'partner_audience_discount',
      'metadata[partner]': partner_handle,
    });

    const result = {
      partner_name,
      partner_handle,
      free_account_code: freePromoCode.code,
      free_coupon_id: freeCoupon.id,
      audience_discount_code: audiencePromoCode.code,
      audience_coupon_id: audienceCoupon.id,
      summary: `Partner: ${partner_name} (@${partner_handle}) | Free code: ${freePromoCode.code} | Audience code: ${audiencePromoCode.code}`,
    };

    console.log('Created partner codes:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
