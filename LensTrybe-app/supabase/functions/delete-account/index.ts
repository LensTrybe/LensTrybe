// Supabase Edge Function: delete-account
// Client-facing (verify_jwt = false). Authenticated INSIDE with the caller's JWT, so a
// user can only ever act on their OWN account. Works for creatives and clients.
//
// Actions (POST body { action }):
//   preview       What deleting would affect (plan, portals, deliveries, team, unpaid invoices).
//   request_code  Emails a 6-digit code to the account email (re-confirms it is really them).
//   confirm       { code, reason? } Verifies the code, cancels billing, hides the account and
//                 schedules the final removal 30 days out. Signs the user out everywhere.
//   reactivate    Undoes a scheduled deletion inside the 30-day window and restores the paid
//                 plan if the period they already paid for has not ended.
// The final removal is done by purge-deleted-accounts (daily cron).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', pink: '#FF2D78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` };
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>';
const REPLY_TO = 'connect@lenstrybe.com';
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>`; }
function fieldRow(label: string, valueHtml: string) { return `<div style="margin:0 0 12px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.faint};margin-bottom:3px;">${esc(label)}</div><div style="font-size:14px;color:${BRAND.text};line-height:1.55;">${valueHtml}</div></div>`; }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; panelHtml?: string; ctaText?: string; ctaUrl?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', panelHtml = '', ctaText, ctaUrl, footNote = '' } = opts;
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
${panelHtml ? `<tr><td style="padding:18px 36px 0;">${panelHtml}</td></tr>` : ''}
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td></tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:13px;font-weight:700;color:${BRAND.text};">LensTrybe</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`;
}
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string }) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [args.to], reply_to: REPLY_TO, subject: args.subject, html: args.html }),
    });
    if (!r.ok) console.error('delete-account: resend failed', r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error('delete-account: resend error', e instanceof Error ? e.message : String(e));
    return false;
  }
}
// ---- end shared ----

const SITE = 'https://lenstrybe.com';
const GRACE_DAYS = 30;
const CODE_TTL_MIN = 15;
const MAX_CODE_ATTEMPTS = 5;
const LIVE = ['active', 'trialing', 'past_due', 'pending'];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' });
  } catch { return iso.slice(0, 10); }
}
function maskEmail(email: string) {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}${email.slice(at)}`;
}
function cap(s: unknown) { const t = String(s || ''); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function newCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}
function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceKey || !resendKey) {
      console.error('delete-account: missing env');
      return json({ error: 'Account deletion is not available right now.' }, 500);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Please sign in again.' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: 'Please sign in again.' }, 401);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const action = String(body.action || 'preview');

    const [{ data: profile }, { data: client }] = await Promise.all([
      admin.from('profiles')
        .select('id, business_name, is_admin, role, pending_deletion, deletion_scheduled_at, subscription_tier, subscription_status, comp_tier')
        .eq('id', user.id).maybeSingle(),
      admin.from('client_accounts')
        .select('id, first_name, pending_deletion, deletion_scheduled_at')
        .eq('id', user.id).maybeSingle(),
    ]);
    const kind: 'creative' | 'client' | null = profile ? 'creative' : client ? 'client' : null;
    if (!kind) return json({ error: 'We could not find your account.' }, 404);

    const pending = kind === 'creative' ? !!profile?.pending_deletion : !!client?.pending_deletion;
    const scheduledAt = (kind === 'creative' ? profile?.deletion_scheduled_at : client?.deletion_scheduled_at) as string | null;
    const isStaff = kind === 'creative' && (profile?.is_admin === true || ['admin', 'staff'].includes(String(profile?.role || '')));
    const email = String(user.email || '');
    const name = String((kind === 'creative' ? profile?.business_name : client?.first_name) || 'there');

    async function liveSub() {
      if (kind !== 'creative') return null;
      const { data } = await admin.from('subscriptions')
        .select('id, status, tier, billing, next_charge_date, current_period_end, pending_tier, pending_billing, pending_change_at, inflight_charge')
        .eq('user_id', user!.id).in('status', LIVE)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    }

    // ---------------------------------------------------------------- preview
    if (action === 'preview') {
      if (pending) return json({ kind, pending: true, deletion_date: scheduledAt });
      const sub = await liveSub();
      const impact: Record<string, number> = {};
      if (kind === 'creative') {
        const nowIso = new Date().toISOString();
        const [portals, deliveries, invoices, team] = await Promise.all([
          admin.from('client_portals').select('id', { count: 'exact', head: true }).eq('creative_id', user.id),
          admin.from('deliveries').select('id', { count: 'exact', head: true }).eq('creative_id', user.id).or(`expires_at.is.null,expires_at.gt.${nowIso}`),
          admin.from('invoices').select('id', { count: 'exact', head: true }).eq('creative_id', user.id).not('status', 'in', '(paid,draft,void,cancelled,canceled)'),
          admin.from('team_members').select('id', { count: 'exact', head: true }).eq('creative_id', user.id).eq('status', 'active'),
        ]);
        impact.client_portals = portals.count || 0;
        impact.active_deliveries = deliveries.count || 0;
        impact.unpaid_invoices = invoices.count || 0;
        impact.team_members = team.count || 0;
      }
      return json({
        kind,
        pending: false,
        blocked: isStaff ? 'Admin accounts cannot be deleted from here.' : null,
        email_masked: maskEmail(email),
        impact,
        subscription: sub ? { tier: sub.tier, billing: sub.billing, status: sub.status, next_charge_date: sub.next_charge_date, current_period_end: sub.current_period_end } : null,
        grace_days: GRACE_DAYS,
      });
    }

    // ------------------------------------------------------------- reactivate
    if (action === 'reactivate') {
      if (!pending) return json({ ok: true, already_active: true });

      const { data: del } = await admin.from('account_deletions')
        .select('id, restore').eq('user_id', user.id).eq('status', 'scheduled').maybeSingle();
      const restore = (del?.restore || {}) as Record<string, any>;
      let planRestored = false;
      let restoredTier = 'basic';

      if (kind === 'creative') {
        const prof: Record<string, unknown> = { pending_deletion: false, deletion_scheduled_at: null, subscription_status: 'active' };
        const rs = restore.sub as Record<string, any> | undefined;
        const today = new Date().toISOString().slice(0, 10);
        const stillPaid = rs && rs.id && String(rs.next_charge_date || '') >= today;
        if (stillPaid) {
          const { data: upd, error: subErr } = await admin.from('subscriptions').update({
            status: rs.status,
            next_charge_date: rs.next_charge_date,
            pending_tier: rs.pending_tier ?? null,
            pending_billing: rs.pending_billing ?? null,
            pending_change_at: rs.pending_change_at ?? null,
            updated_at: new Date().toISOString(),
          }).eq('id', rs.id).eq('user_id', user.id).eq('status', 'canceled').select('id');
          if (subErr) console.error('delete-account: restore subscription failed', subErr.message);
          if (!subErr && upd && upd.length > 0) {
            planRestored = true;
            restoredTier = String(restore.profile?.subscription_tier || rs.tier || 'basic');
            prof.subscription_tier = restoredTier;
            prof.subscription_status = String(restore.profile?.subscription_status || 'active');
          }
        }
        // Complimentary access comes back unless it was a team seat that has since ended.
        const comp = restore.profile?.comp_tier ? String(restore.profile.comp_tier) : null;
        if (comp) {
          let keep = comp !== 'elite';
          if (!keep) {
            const { count } = await admin.from('team_members').select('id', { count: 'exact', head: true })
              .eq('member_profile_id', user.id).eq('status', 'active');
            keep = (count || 0) > 0;
          }
          if (keep) prof.comp_tier = comp;
        }
        const { error: pErr } = await admin.from('profiles').update(prof).eq('id', user.id);
        if (pErr) {
          console.error('delete-account: reactivate profile failed', pErr.message);
          return json({ error: 'Could not reactivate your account. Please try again.' }, 500);
        }
      } else {
        const { error: cErr } = await admin.from('client_accounts')
          .update({ pending_deletion: false, deletion_scheduled_at: null }).eq('id', user.id);
        if (cErr) {
          console.error('delete-account: reactivate client failed', cErr.message);
          return json({ error: 'Could not reactivate your account. Please try again.' }, 500);
        }
      }

      if (del?.id) {
        await admin.from('account_deletions').update({ status: 'reactivated', reactivated_at: new Date().toISOString(), restore: null }).eq('id', del.id);
      }

      const hadPaid = !!restore.sub;
      const planLine = kind !== 'creative' ? ''
        : planRestored ? ` Your ${esc(cap(restoredTier))} plan is back in place.`
        : hadPaid ? ' Your paid plan ended while your account was scheduled for deletion, so you are on the free Basic plan. You can choose a plan again any time from Settings.'
        : '';
      if (email) {
        await sendEmail(resendKey, {
          to: email,
          subject: 'Welcome back to LensTrybe',
          html: emailShell({
            preheader: 'Your account has been reactivated.',
            kicker: 'Account reactivated',
            heading: 'Welcome back',
            intro: `Hi ${esc(name)}, your LensTrybe account has been reactivated and will not be deleted.${kind === 'creative' ? ' Your profile is visible again.' : ''}${planLine}`,
            ctaText: 'Go to your dashboard',
            ctaUrl: `${SITE}${kind === 'creative' ? '/dashboard' : '/client-dashboard'}`,
            footNote: "If you didn't reactivate your account, reply to this email straight away and change your password.",
          }),
        });
      }
      return json({ ok: true, plan_restored: planRestored });
    }

    // Everything below starts or completes a deletion.
    if (pending) return json({ error: 'Your account is already scheduled for deletion.', deletion_date: scheduledAt }, 409);
    if (isStaff) return json({ error: 'Admin accounts cannot be deleted from here.' }, 403);
    if (!email) return json({ error: 'Your account has no email address, so we cannot confirm this. Please contact support.' }, 400);

    const subNow = await liveSub();
    if (subNow?.inflight_charge) {
      return json({ error: 'A payment on your account is still processing. Please try again in a few minutes.' }, 409);
    }

    // ----------------------------------------------------------- request_code
    if (action === 'request_code') {
      const { data: allowed, error: rlErr } = await admin.rpc('rate_limit_hit', {
        p_key: `account-delete-code:${user.id}`, p_max: 5, p_window_seconds: 3600,
      });
      if (rlErr) console.error('delete-account: rate limit error', rlErr.message);
      if (allowed === false) return json({ error: 'Too many codes requested. Please wait an hour and try again.' }, 429);

      const code = newCode();
      const { error: cErr } = await admin.from('account_action_codes').upsert({
        user_id: user.id,
        purpose: 'delete_account',
        code_hash: await sha256(`${user.id}:${code}`),
        expires_at: new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
      });
      if (cErr) {
        console.error('delete-account: code save failed', cErr.message);
        return json({ error: 'Could not send a code right now. Please try again.' }, 500);
      }

      const sent = await sendEmail(resendKey, {
        to: email,
        subject: 'Your LensTrybe account deletion code',
        html: emailShell({
          preheader: `Your code is ${code}`,
          kicker: 'Confirm deletion',
          heading: 'Confirm account deletion',
          intro: `Hi ${esc(name)}, use this code to confirm you want to delete your LensTrybe account. It expires in ${CODE_TTL_MIN} minutes.`,
          panelHtml: panel(`<div style="font-size:32px;font-weight:800;letter-spacing:0.3em;color:${BRAND.text};text-align:center;font-family:${BRAND.font};">${code}</div>`),
          footNote: "If you didn't ask to delete your account, ignore this email and nothing will change. We also recommend changing your password.",
        }),
      });
      if (!sent) return json({ error: 'We could not send the email. Please try again.' }, 502);
      return json({ ok: true, sent_to: maskEmail(email), expires_minutes: CODE_TTL_MIN });
    }

    // ---------------------------------------------------------------- confirm
    if (action === 'confirm') {
      const code = String(body.code || '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit code from your email.' }, 400);

      const { data: row } = await admin.from('account_action_codes')
        .select('code_hash, expires_at, attempts, purpose').eq('user_id', user.id).maybeSingle();
      if (!row || row.purpose !== 'delete_account' || new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: 'That code has expired. Please request a new one.' }, 400);
      }
      if ((row.attempts || 0) >= MAX_CODE_ATTEMPTS) {
        await admin.from('account_action_codes').delete().eq('user_id', user.id);
        return json({ error: 'Too many attempts. Please request a new code.' }, 429);
      }
      if (!safeEqual(await sha256(`${user.id}:${code}`), row.code_hash)) {
        await admin.from('account_action_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('user_id', user.id);
        return json({ error: 'That code is not right. Check the email and try again.' }, 400);
      }
      await admin.from('account_action_codes').delete().eq('user_id', user.id);

      const nowIso = new Date().toISOString();
      const deletionDate = new Date(Date.now() + GRACE_DAYS * 86400000).toISOString();
      const reason = String(body.reason || '').trim().slice(0, 300) || null;

      const restore: Record<string, unknown> = {};
      if (kind === 'creative') {
        restore.profile = {
          subscription_tier: profile?.subscription_tier ?? 'basic',
          subscription_status: profile?.subscription_status ?? 'active',
          comp_tier: profile?.comp_tier ?? null,
        };
        if (subNow) {
          restore.sub = {
            id: subNow.id, status: subNow.status, tier: subNow.tier, billing: subNow.billing,
            next_charge_date: subNow.next_charge_date, current_period_end: subNow.current_period_end,
            pending_tier: subNow.pending_tier, pending_billing: subNow.pending_billing, pending_change_at: subNow.pending_change_at,
          };
        }
      }

      // Close any stale open record, then log this request.
      await admin.from('account_deletions').update({ status: 'reactivated', reactivated_at: nowIso, restore: null })
        .eq('user_id', user.id).eq('status', 'scheduled');
      const { data: delRow, error: dErr } = await admin.from('account_deletions').insert({
        user_id: user.id, kind, scheduled_for: deletionDate, reason,
        tier_at_request: kind === 'creative' ? (profile?.subscription_tier ?? 'basic') : null,
        restore,
      }).select('id').single();
      if (dErr || !delRow) {
        console.error('delete-account: log insert failed', dErr?.message);
        return json({ error: 'Could not schedule account deletion. Please try again.' }, 500);
      }

      if (kind === 'creative') {
        // Billing stops straight away so revolut-charge-due can never charge this account.
        const { error: subErr } = await admin.from('subscriptions').update({
          status: 'canceled', next_charge_date: null, pending_tier: null, pending_billing: null,
          pending_change_at: null, updated_at: nowIso,
        }).eq('user_id', user.id).in('status', LIVE);
        if (subErr) {
          console.error('delete-account: subscription cancel failed', subErr.message);
          await admin.from('account_deletions').delete().eq('id', delRow.id);
          return json({ error: 'Could not cancel your subscription. Please try again or contact support.' }, 500);
        }
        const { error: profErr } = await admin.from('profiles').update({
          comp_tier: null, subscription_tier: 'basic', subscription_status: 'canceled',
          pending_deletion: true, deletion_scheduled_at: deletionDate,
        }).eq('id', user.id);
        if (profErr) {
          console.error('delete-account: profile update failed', profErr.message);
          return json({ error: 'Could not schedule account deletion. Please contact support.' }, 500);
        }
      } else {
        const { error: cErr } = await admin.from('client_accounts')
          .update({ pending_deletion: true, deletion_scheduled_at: deletionDate }).eq('id', user.id);
        if (cErr) {
          console.error('delete-account: client update failed', cErr.message);
          await admin.from('account_deletions').delete().eq('id', delRow.id);
          return json({ error: 'Could not schedule account deletion. Please try again.' }, 500);
        }
      }

      const when = fmtDate(deletionDate);
      await sendEmail(resendKey, {
        to: email,
        subject: 'Your LensTrybe account is scheduled for deletion',
        html: emailShell({
          preheader: `Your account will be deleted on ${when}.`,
          kicker: 'Deletion scheduled',
          heading: 'Your account is scheduled for deletion',
          intro: `Hi ${esc(name)}, your LensTrybe account and everything in it will be permanently deleted on ${esc(when)}.${kind === 'creative' ? ' Your profile is now hidden and any paid plan has been cancelled.' : ''}`,
          panelHtml: panel(
            fieldRow('Deletion date', esc(when)) +
            fieldRow('Changed your mind?', 'Sign in before this date and choose Reactivate. Everything will be exactly as you left it.') +
            fieldRow('Want a copy of your data?', 'Sign in and choose Download my data before the deletion date.'),
          ),
          ctaText: 'Sign in to reactivate',
          ctaUrl: `${SITE}/login`,
          footNote: "If you didn't request this, sign in now, reactivate your account and change your password.",
        }),
      });

      try { await admin.auth.admin.signOut(token, 'global'); }
      catch (e) { console.error('delete-account: sign out failed', e instanceof Error ? e.message : String(e)); }

      return json({ success: true, deletion_date: deletionDate });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('delete-account error:', err instanceof Error ? err.message : String(err));
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
