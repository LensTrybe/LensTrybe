import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { creative_id, email, password, business_name, first_name, last_name, role, invitation_token } = await req.json();

    if (!creative_id || !email || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Try to create user - if already exists, sign them in instead
    let userId: string;
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { business_name, first_name, last_name }
    });

    if (createError) {
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        // User exists - get their ID
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          return new Response(JSON.stringify({ error: 'Failed to find existing user' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const existingUser = users.find(u => u.email === email);
        if (!existingUser) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        userId = existingUser.id;
      } else {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      userId = userData.user.id;
    }

    // 2. Create/update profile with Elite tier
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      business_name: business_name || email.split('@')[0],
      business_email: email,
      subscription_tier: 'elite',
      subscription_status: 'active',
    });

    // 3. Insert into team_members (skip if already exists)
    const { data: existingMember } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('creative_id', creative_id)
      .eq('email', email)
      .maybeSingle();

    if (!existingMember) {
      await supabaseAdmin.from('team_members').insert({
        creative_id,
        member_profile_id: userId,
        name: `${first_name || ''} ${last_name || ''}`.trim() || email.split('@')[0],
        email,
        role: role || 'member',
        status: 'active',
        invite_status: 'accepted',
      });
    }

    // 4. Mark invitation as accepted
    if (invitation_token) {
      await supabaseAdmin.from('team_invitations').update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      }).eq('token', invitation_token);
    }

    // 5. Sign in and return session
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: signInError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      session: signInData.session,
      user: signInData.user
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
