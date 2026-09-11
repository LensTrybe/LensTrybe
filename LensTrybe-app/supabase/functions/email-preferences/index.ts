// Supabase Edge Function: email-preferences
// Public (verify_jwt = false). Manages consent for marketing email (The Trybe Edit and
// LensTrybe news). Transactional/service emails are not affected.
//
// Token actions (from the unsubscribe link in every marketing email, no sign-in needed):
//   { action: 'status' | 'unsubscribe' | 'resubscribe', token }
// One-click unsubscribe (RFC 8058, for the List-Unsubscribe header):
//   POST ?token=<uuid> with body "List-Unsubscribe=One-Click"
// Signed-in actions (Authorization: Bearer <user JWT>):
//   { action: 'me' }                    -> { subscribed, email }
//   { action: 'set', subscribed: bool } -> updates the signed-in user's consent

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function maskEmail(email: string) {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}${email.slice(at)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('email-preferences: missing env');
    return json({ error: 'Not available right now.' }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const nowIso = new Date().toISOString();

  try {
    const url = new URL(req.url);
    const contentType = (req.headers.get('content-type') || '').toLowerCase();

    // ---- One-click unsubscribe from a mail client ----
    if (!contentType.includes('application/json') && url.searchParams.get('token')) {
      const raw = await req.text();
      const token = url.searchParams.get('token') || '';
      if (!UUID_RE.test(token) || !/List-Unsubscribe=One-Click/i.test(raw)) return json({ error: 'Bad request' }, 400);
      await admin.from('email_subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: nowIso, updated_at: nowIso })
        .eq('token', token).eq('status', 'subscribed');
      return json({ ok: true });
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty */ }
    const action = String(body.action || '');

    // ---- Signed-in preference management ----
    if (action === 'me' || action === 'set') {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
      const { data: { user } } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
      if (!user || !user.email) return json({ error: 'Please sign in again.' }, 401);
      const email = user.email.toLowerCase();

      const [{ data: byUser }, { data: byEmail }] = await Promise.all([
        admin.from('email_subscribers').select('id, status, user_id, email').eq('user_id', user.id).limit(1),
        admin.from('email_subscribers').select('id, status, user_id, email').eq('email', email).limit(1),
      ]);
      const row = (byUser && byUser[0]) || (byEmail && byEmail[0]) || null;

      if (action === 'me') return json({ subscribed: row?.status === 'subscribed', email: user.email });

      const want = body.subscribed === true;
      if (row) {
        const { error } = await admin.from('email_subscribers').update(want
          ? { status: 'subscribed', user_id: user.id, consented_at: nowIso, unsubscribed_at: null, source: 'settings', updated_at: nowIso }
          : { status: 'unsubscribed', user_id: user.id, unsubscribed_at: nowIso, updated_at: nowIso }).eq('id', row.id);
        if (error) throw new Error(error.message);
      } else if (want) {
        const { error } = await admin.from('email_subscribers').insert({ email, user_id: user.id, status: 'subscribed', source: 'settings', consented_at: nowIso });
        if (error) throw new Error(error.message);
      }
      return json({ ok: true, subscribed: want });
    }

    // ---- Token actions from the unsubscribe page ----
    if (action === 'status' || action === 'unsubscribe' || action === 'resubscribe') {
      const token = String(body.token || '');
      if (!UUID_RE.test(token)) return json({ error: 'This link is not valid.' }, 400);

      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
      const { data: allowed } = await admin.rpc('rate_limit_hit', { p_key: `email-prefs:ip:${ip}`, p_max: 60, p_window_seconds: 3600 });
      if (allowed === false) return json({ error: 'Too many requests. Please try again later.' }, 429);

      const { data: row } = await admin.from('email_subscribers').select('id, email, status').eq('token', token).maybeSingle();
      if (!row) return json({ error: 'This link is not valid or has expired.' }, 404);

      if (action === 'unsubscribe' && row.status !== 'unsubscribed') {
        await admin.from('email_subscribers').update({ status: 'unsubscribed', unsubscribed_at: nowIso, updated_at: nowIso }).eq('id', row.id);
        row.status = 'unsubscribed';
      } else if (action === 'resubscribe' && row.status !== 'subscribed') {
        await admin.from('email_subscribers').update({ status: 'subscribed', consented_at: nowIso, unsubscribed_at: null, source: 'resubscribe', updated_at: nowIso }).eq('id', row.id);
        row.status = 'subscribed';
      }
      return json({ ok: true, email: maskEmail(String(row.email)), subscribed: row.status === 'subscribed' });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('email-preferences error:', e instanceof Error ? e.message : String(e));
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
