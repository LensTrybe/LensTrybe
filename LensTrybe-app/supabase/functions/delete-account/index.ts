import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the JWT from the Authorization header to identify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's JWT to verify their identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    // Step 1: Cancel Stripe subscription if exists
    if (stripeSecretKey) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .single();

        if (profile?.stripe_customer_id) {
          // List active subscriptions for this customer
          const subsRes = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${profile.stripe_customer_id}&status=active`,
            { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
          );
          const subsData = await subsRes.json();

          // Cancel all active subscriptions immediately
          for (const sub of subsData.data || []) {
            await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
            });
          }

          // Also check trialing subscriptions
          const trialRes = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${profile.stripe_customer_id}&status=trialing`,
            { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
          );
          const trialData = await trialRes.json();

          for (const sub of trialData.data || []) {
            await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
            });
          }
        }
      } catch (stripeErr) {
        // Log but don't block deletion if Stripe fails
        console.error('Stripe cancellation error:', stripeErr);
      }
    }

    // Step 2: Mark profile as pending deletion with 30-day grace period
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: 'basic',
        subscription_status: 'canceled',
        pending_deletion: true,
        deletion_scheduled_at: deletionDate.toISOString(),
      })
      .eq('id', user.id);

    // Step 3: Sign out the user
    await supabaseAdmin.auth.admin.signOut(user.id);

    // Step 4: Schedule auth user deletion (soft delete — remove after 30 days)
    // For now we mark the profile; a cron job or manual process handles final deletion
    // Immediate hard delete can be done here if preferred:
    // await supabaseAdmin.auth.admin.deleteUser(user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account scheduled for deletion in 30 days',
        deletion_date: deletionDate.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
