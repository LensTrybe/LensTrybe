import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max); }
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Accept a team invitation. Body: { invitation_token, password?, business_name?, first_name?, last_name? }
// The studio (creative_id), email and role always come from the invitation row, never the body.
//  - New email: the account is created with email_confirm true. That is acceptable only because the
//    caller holds the invitation token, which is delivered solely to the invited inbox.
//  - Existing account: the caller must prove they own it, either by being signed in as that user
//    (Authorization bearer token) or by supplying that account's password. Existing profiles are
//    never overwritten; the member gets Elite access through profiles.comp_tier.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    // Separate client for password sign-ins, so a user session never replaces the service role
    // on the admin client used for the writes below.
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const { data: allowed, error: rlErr } = await admin.rpc('rate_limit_hit', { p_key: `join-team:ip:${ip}`, p_max: 10, p_window_seconds: 3600 });
    if (rlErr || allowed === false) return json({ error: 'Too many attempts. Please try again later.' }, 429);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const invitationToken = typeof body.invitation_token === 'string' ? body.invitation_token.trim() : '';
    if (invitationToken.length < 16 || invitationToken.length > 200) return json({ error: 'This invitation link is invalid.' }, 400);
    const password = typeof body.password === 'string' ? body.password : '';
    const businessName = plain(body.business_name, 120);
    const firstName = plain(body.first_name, 80);
    const lastName = plain(body.last_name, 80);

    const { data: invitation } = await admin.from('team_invitations')
      .select('id, creative_id, email, role, status, created_at')
      .eq('token', invitationToken).maybeSingle();
    if (!invitation || invitation.status !== 'pending') return json({ error: 'This invitation link is invalid or has already been used.' }, 400);
    if (Date.now() - new Date(invitation.created_at as string).getTime() > INVITE_TTL_MS) {
      return json({ error: 'This invitation has expired. Ask the studio to send a new one.' }, 400);
    }
    const email = String(invitation.email || '').trim().toLowerCase();
    const creativeId = invitation.creative_id as string;
    const role = plain(invitation.role || 'member', 40) || 'member';
    if (!email || !creativeId) return json({ error: 'This invitation link is invalid.' }, 400);

    // Who is calling? A signed-in session must belong to the invited email.
    let userId: string | null = null;
    // deno-lint-ignore no-explicit-any
    let session: any = null;
    // deno-lint-ignore no-explicit-any
    let sessionUser: any = null;
    let createdNew = false;
    const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (bearer) {
      const { data } = await admin.auth.getUser(bearer);
      const caller = data?.user;
      if (caller) {
        if (String(caller.email || '').toLowerCase() !== email) {
          return json({ error: `This invitation was sent to ${email}. Sign out and continue with that email address.` }, 403);
        }
        userId = caller.id;
      }
    }

    if (!userId) {
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      const { data: userData, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { account_type: 'creative', business_name: businessName || email.split('@')[0], first_name: firstName, last_name: lastName },
      });
      if (!createError && userData?.user) {
        userId = userData.user.id;
        createdNew = true;
      } else {
        const msg = String(createError?.message || '').toLowerCase();
        if (!(msg.includes('already') || msg.includes('exists') || (createError as { status?: number })?.status === 422)) {
          console.error('join-team createUser failed', createError);
          return json({ error: 'Could not create your account. Please try again.' }, 400);
        }
        // Existing account: the caller must know its password.
        const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
        if (signInError || !signIn?.user) {
          return json({ error: 'An account with this email already exists. Sign in with that account\'s password to join the team.', code: 'account_exists' }, 401);
        }
        userId = signIn.user.id;
        session = signIn.session;
        sessionUser = signIn.user;
      }
    }
    if (!userId) return json({ error: 'Could not join the team.' }, 400);
    if (userId === creativeId) return json({ error: 'You cannot join your own team.' }, 400);

    // Claim the invitation (single use).
    const { data: claimed } = await admin.from('team_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id).eq('status', 'pending').select('id');
    if (!claimed || claimed.length === 0) return json({ error: 'This invitation has already been used.' }, 409);

    // Profile: create one only if missing; otherwise only grant the complimentary Elite floor.
    const { data: existingProfile } = await admin.from('profiles').select('id, business_email').eq('id', userId).maybeSingle();
    if (!existingProfile) {
      const { error: pErr } = await admin.from('profiles').insert({
        id: userId,
        business_name: businessName || email.split('@')[0],
        business_email: email,
        account_type: 'creative',
        comp_tier: 'elite',
      });
      if (pErr) console.error('join-team profile insert failed', pErr);
    } else {
      const patch: Record<string, unknown> = { comp_tier: 'elite' };
      if (createdNew && !existingProfile.business_email) patch.business_email = email;
      const { error: pErr } = await admin.from('profiles').update(patch).eq('id', userId);
      if (pErr) console.error('join-team profile update failed', pErr);
    }

    // Team membership (skip if already linked).
    let { data: existingMember } = await admin.from('team_members').select('id')
      .eq('creative_id', creativeId).eq('member_profile_id', userId).limit(1).maybeSingle();
    if (!existingMember) {
      ({ data: existingMember } = await admin.from('team_members').select('id')
        .eq('creative_id', creativeId).eq('email', email).limit(1).maybeSingle());
    }
    if (existingMember) {
      await admin.from('team_members').update({ member_profile_id: userId, status: 'active', invite_status: 'accepted' }).eq('id', existingMember.id);
    } else {
      const { error: mErr } = await admin.from('team_members').insert({
        creative_id: creativeId,
        member_profile_id: userId,
        name: `${firstName} ${lastName}`.trim() || businessName || email.split('@')[0],
        email,
        role,
        status: 'active',
        invite_status: 'accepted',
      });
      if (mErr) console.error('join-team member insert failed', mErr);
    }

    // New accounts get a session straight away so they land in the dashboard signed in.
    if (createdNew) {
      const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
      if (signInError) {
        console.error('join-team sign-in failed', signInError);
        return json({ success: true, session: null });
      }
      session = signInData.session;
      sessionUser = signInData.user;
    }

    return json({ success: true, session, user: sessionUser });
  } catch (err) {
    console.error('join-team error', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
