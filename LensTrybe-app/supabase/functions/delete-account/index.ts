// Supabase Edge Function: delete-account
// Client-facing (verify_jwt = false), authenticated INSIDE via the caller's JWT, so a
// user can only delete their OWN account. Soft delete: the profile is marked
// pending_deletion with a 30-day grace period (a separate process removes it after
// that). The Revolut subscription is canceled straight away so revolut-charge-due can
// never charge a deleted account, and any complimentary access is removed.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('delete-account: missing env');
      return json({ error: 'Account deletion is not available right now.' }, 500);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Missing authorization header' }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const nowIso = new Date().toISOString();

    // Step 1: Cancel the Revolut subscription so it is never charged again.
    const { error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        next_charge_date: null,
        pending_tier: null,
        pending_billing: null,
        pending_change_at: null,
        inflight_charge: null,
        updated_at: nowIso,
      })
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due', 'pending']);
    if (subErr) {
      console.error('delete-account: subscription cancel failed', subErr.message);
      return json({ error: 'Could not cancel your subscription. Please try again or contact support.' }, 500);
    }

    // Step 2: Mark profile as pending deletion with 30-day grace period.
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .update({
        comp_tier: null,
        subscription_tier: 'basic',
        subscription_status: 'canceled',
        pending_deletion: true,
        deletion_scheduled_at: deletionDate.toISOString(),
      })
      .eq('id', user.id);
    if (profErr) {
      console.error('delete-account: profile update failed', profErr.message);
      return json({ error: 'Could not schedule account deletion. Please try again.' }, 500);
    }

    // Step 3: Sign out the user everywhere.
    try {
      await supabaseAdmin.auth.admin.signOut(token, 'global');
    } catch (e) {
      console.error('delete-account: sign out failed', e instanceof Error ? e.message : String(e));
    }

    // Final removal of the auth user happens after the 30-day grace period.
    return json({
      success: true,
      message: 'Account scheduled for deletion in 30 days',
      deletion_date: deletionDate.toISOString(),
    });
  } catch (err) {
    console.error('delete-account error:', err instanceof Error ? err.message : String(err));
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
