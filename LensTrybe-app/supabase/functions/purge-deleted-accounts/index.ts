// Supabase Edge Function: purge-deleted-accounts
// Internal only (daily cron, x-cron-secret; or service role bearer). Fails closed.
//  1. Sends a reminder 7 days before an account's scheduled deletion.
//  2. Permanently removes accounts whose 30-day window has passed: every uploaded file,
//     then the auth user (which cascades through every table that belongs to them).
// A minimal record (user id, account type, dates) is kept in account_deletions as proof
// the deletion happened. No personal details are kept.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', pink: '#FF2D78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` };
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>';
const REPLY_TO = 'connect@lenstrybe.com';
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; ctaText?: string; ctaUrl?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', ctaText, ctaUrl, footNote = '' } = opts;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.pageBg};">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;font-family:${BRAND.font};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${BRAND.green};letter-spacing:-0.02em;">LensTrybe</div></td></tr>
<tr><td style="padding:22px 36px 8px;">
${kicker ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(kicker)}</div>` : ''}
<h1 style="margin:0 0 ${intro ? '10px' : '4px'};font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${heading}</h1>
${intro ? `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${intro}</p>` : ''}
</td></tr>
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td></tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:13px;font-weight:700;color:${BRAND.text};">LensTrybe</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`;
}
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
      await sendEmail(resendKey, email, 'Your LensTrybe account will be deleted soon', emailShell({
        preheader: `Your account will be deleted on ${when}.`,
        kicker: 'Reminder',
        heading: 'Your account will be deleted soon',
        intro: `Your LensTrybe account and everything in it will be permanently deleted on ${esc(when)}. If you want to keep it, sign in and choose Reactivate. You can also download a copy of your data from the same screen.`,
        ctaText: 'Sign in to reactivate',
        ctaUrl: 'https://lenstrybe.com/login',
        footNote: 'If you are happy for your account to be deleted, you do not need to do anything.',
      }));
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
        await sendEmail(resendKey, email, 'Your LensTrybe account has been deleted', emailShell({
          preheader: 'Your account and data have been permanently deleted.',
          kicker: 'Account deleted',
          heading: 'Your account has been deleted',
          intro: 'As requested, your LensTrybe account and all of its data have now been permanently deleted. Thanks for being part of LensTrybe. You are always welcome back.',
          footNote: 'This is the last email you will receive about this account.',
        }));
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
