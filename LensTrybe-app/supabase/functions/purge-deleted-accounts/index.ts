// Supabase Edge Function: purge-deleted-accounts
// Internal only (daily cron, x-cron-secret; or service role bearer). Fails closed.
//  1. Sends a reminder 7 days before an account's scheduled deletion.
//  2. Permanently removes accounts whose 30-day window has passed: every uploaded file,
//     then the auth user (which cascades through every table that belongs to them).
// A minimal record (user id, account type, dates) is kept in account_deletions as proof
// the deletion happened. No personal details are kept.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { deletionReminderEmail, accountDeletedEmail } from './emails.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>';
const REPLY_TO = 'connect@lenstrybe.com';
async function sendEmail(resendKey: string, to: string, subject: string, html: string) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
    });
    if (!r.ok) console.error('purge: resend failed', r.status);
  } catch (e) {
    console.error('purge: resend error', e instanceof Error ? e.message : String(e));
  }
}
// ---- end shared ----

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' }); }
  catch { return iso.slice(0, 10); }
}

async function stillPending(admin: SupabaseClient, userId: string, kind: string) {
  const { data } = kind === 'creative'
    ? await admin.from('profiles').select('pending_deletion').eq('id', userId).maybeSingle()
    : await admin.from('client_accounts').select('pending_deletion').eq('id', userId).maybeSingle();
  return data ? !!data.pending_deletion : null; // null = the account rows are already gone
}

async function removeFiles(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.rpc('account_storage_objects', { p_uid: userId });
  if (error) throw new Error(`storage list failed: ${error.message}`);
  const byBucket = new Map<string, string[]>();
  for (const o of (data || []) as Array<{ bucket_id: string; name: string }>) {
    if (!byBucket.has(o.bucket_id)) byBucket.set(o.bucket_id, []);
    byBucket.get(o.bucket_id)!.push(o.name);
  }
  let removed = 0;
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const chunk = names.slice(i, i + 100);
      const { error: rErr } = await admin.storage.from(bucket).remove(chunk);
      if (rErr) throw new Error(`storage remove failed (${bucket}): ${rErr.message}`);
      removed += chunk.length;
    }
  }
  return removed;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  if (!supabaseUrl || !serviceKey || !cronSecret) {
    console.error('purge: missing env');
    return json({ error: 'Not configured' }, 500);
  }
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const cron = req.headers.get('x-cron-secret') || '';
  if (!safeEqual(cron, cronSecret) && !safeEqual(bearer, serviceKey)) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = new Date();
  const result = { reminded: 0, purged: 0, skipped: 0, failed: 0 };

  // ---- 1. Seven-day reminders ----
  const soon = new Date(now.getTime() + 7 * 86400000).toISOString();
  const { data: remind } = await admin.from('account_deletions')
    .select('id, user_id, kind, scheduled_for')
    .eq('status', 'scheduled').is('reminder_sent_at', null)
    .gt('scheduled_for', now.toISOString()).lte('scheduled_for', soon)
    .limit(100);
  for (const d of remind || []) {
    if (await stillPending(admin, d.user_id, d.kind) !== true) continue;
    const { data: u } = await admin.auth.admin.getUserById(d.user_id);
    const email = u?.user?.email;
    if (email && resendKey) {
      const when = fmtDate(d.scheduled_for);
      const { subject, html } = deletionReminderEmail(when);
      await sendEmail(resendKey, email, subject, html);
    }
    await admin.from('account_deletions').update({ reminder_sent_at: now.toISOString() }).eq('id', d.id);
    result.reminded++;
  }

  // ---- 2. Final removal ----
  const { data: due } = await admin.from('account_deletions')
    .select('id, user_id, kind, scheduled_for')
    .eq('status', 'scheduled').lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(20);

  for (const d of due || []) {
    try {
      const pendingState = await stillPending(admin, d.user_id, d.kind);
      if (pendingState === false) {
        // They reactivated without the record being closed; leave the account alone.
        await admin.from('account_deletions').update({ status: 'reactivated', reactivated_at: now.toISOString(), restore: null }).eq('id', d.id);
        result.skipped++;
        continue;
      }

      const { data: u } = await admin.auth.admin.getUserById(d.user_id);
      const email = u?.user?.email || null;

      // Never charge again, whatever happens next.
      await admin.from('subscriptions').update({ status: 'canceled', next_charge_date: null, updated_at: now.toISOString() })
        .eq('user_id', d.user_id).neq('status', 'canceled');

      await removeFiles(admin, d.user_id);

      if (u?.user) {
        const { error: delErr } = await admin.auth.admin.deleteUser(d.user_id);
        if (delErr) throw new Error(`auth delete failed: ${delErr.message}`);
      }

      await admin.from('account_deletions').update({
        status: 'purged', purged_at: new Date().toISOString(), restore: null, reason: null, purge_error: null,
      }).eq('id', d.id);
      result.purged++;

      if (email && resendKey) {
        const { subject, html } = accountDeletedEmail();
        await sendEmail(resendKey, email, subject, html);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('purge: failed for', d.id, msg);
      await admin.from('account_deletions').update({ purge_error: msg.slice(0, 500) }).eq('id', d.id);
      result.failed++;
    }
  }

  return json({ ok: true, ...result });
});
