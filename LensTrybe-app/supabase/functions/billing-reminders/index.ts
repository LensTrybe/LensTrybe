// Supabase Edge Function: billing-reminders
// Internal only (daily cron, x-cron-secret; or service role bearer). Fails closed.
// Emails a reminder about 7 days before a charge the creative might not expect:
//   - the first charge when a free trial (including the founding free year) ends
//   - each annual renewal
// One reminder per charge date (subscriptions.reminder_sent_for).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
    if (!r.ok) console.error('billing-reminders: resend failed', r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error('billing-reminders: resend error', e instanceof Error ? e.message : String(e));
    return false;
  }
}
// ---- end shared ----

const SITE = 'https://lenstrybe.com';
const REMIND_DAYS = 7;
const TIER_PRICE: Record<string, Record<string, number>> = {
  pro: { monthly: 2499, annual: 24990 },
  expert: { monthly: 7499, annual: 74990 },
  elite: { monthly: 14999, annual: 149990 },
};

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cap(s: unknown) { const t = String(s || ''); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
function money(minor: unknown, currency: unknown) {
  const n = Number(minor);
  if (!Number.isFinite(n) || n <= 0) return '';
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: String(currency || 'AUD').toUpperCase() }).format(n / 100); }
  catch { return `$${(n / 100).toFixed(2)}`; }
}
// Dates are calendar dates in Brisbane time (the charge job runs on Brisbane days).
function brisbaneToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtDate(ymd: string) {
  try { return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  catch { return ymd; }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceKey || !cronSecret || !resendKey) {
    console.error('billing-reminders: missing env');
    return json({ error: 'Not configured' }, 500);
  }
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!safeEqual(req.headers.get('x-cron-secret') || '', cronSecret) && !safeEqual(bearer, serviceKey)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const today = brisbaneToday();
  const until = addDays(today, REMIND_DAYS);
  const result = { checked: 0, trial: 0, annual: 0, skipped: 0, failed: 0 };

  const { data: subs, error } = await admin.from('subscriptions')
    .select('id, user_id, tier, billing, status, amount_minor, currency, next_charge_date, founding_member, pending_tier, pending_billing, revolut_payment_method_id, reminder_sent_for')
    .in('status', ['trialing', 'active'])
    .gt('next_charge_date', today)
    .lte('next_charge_date', until)
    .limit(500);
  if (error) {
    console.error('billing-reminders: query failed', error.message);
    return json({ error: 'Query failed' }, 500);
  }

  for (const s of subs || []) {
    result.checked++;
    try {
      const chargeDate = String(s.next_charge_date);
      if (s.reminder_sent_for && String(s.reminder_sent_for) === chargeDate) { result.skipped++; continue; }
      const isTrial = s.status === 'trialing';
      const isAnnual = String(s.billing) === 'annual';
      // Monthly renewals don't get a reminder; a trial without a saved card won't be charged.
      if (!isTrial && !isAnnual) { result.skipped++; continue; }
      if (isTrial && !s.revolut_payment_method_id) { result.skipped++; continue; }

      const [{ data: prof }, { data: u }] = await Promise.all([
        admin.from('profiles').select('business_name, pending_deletion').eq('id', s.user_id).maybeSingle(),
        admin.auth.admin.getUserById(s.user_id),
      ]);
      const email = u?.user?.email;
      if (!email || prof?.pending_deletion) { result.skipped++; continue; }

      const name = prof?.business_name || 'there';
      const when = fmtDate(chargeDate);
      const tier = String(s.pending_tier || s.tier || '').toLowerCase();
      const billing = String(s.pending_billing || s.billing || 'monthly').toLowerCase();
      // A scheduled downgrade changes the price at this charge; otherwise use the stored price.
      const minor = s.pending_tier || s.pending_billing
        ? (s.founding_member && tier === 'expert' ? (billing === 'annual' ? 58800 : 4900) : TIER_PRICE[tier]?.[billing])
        : s.amount_minor;
      const price = money(minor, s.currency);
      const per = billing === 'annual' ? 'year' : 'month';
      const plan = `${cap(tier)}${s.founding_member && tier === 'expert' ? ' (founding rate)' : ''}`;

      const subject = isTrial
        ? (s.founding_member ? `Your free LensTrybe year ends on ${when}` : `Your LensTrybe free trial ends on ${when}`)
        : `Your LensTrybe annual plan renews on ${when}`;
      const heading = isTrial
        ? (s.founding_member ? 'Your free founding year is almost up' : 'Your free trial ends soon')
        : 'Your annual plan renews soon';
      const intro = isTrial
        ? `Hi ${esc(name)}, just a heads-up: your free ${s.founding_member ? 'founding year' : 'trial'} ends on ${esc(when)}. After that, your ${esc(plan)} plan continues and we'll charge your saved card${price ? ` ${esc(price)} per ${per}` : ''}.`
        : `Hi ${esc(name)}, just a heads-up: your ${esc(plan)} plan renews on ${esc(when)} and we'll charge your saved card${price ? ` ${esc(price)} for the year` : ''}.`;
      const panelHtml = panel(
        fieldRow('Plan', esc(`${plan}, billed ${billing === 'annual' ? 'annually' : 'monthly'}`)) +
        (price ? fieldRow('Amount', esc(`${price} per ${per}`)) : '') +
        fieldRow(isTrial ? 'First charge' : 'Renewal date', esc(when)),
      );
      const footNote = `Happy to continue? You don't need to do anything. If you'd rather not continue, cancel any time before ${esc(when)} in Settings and you won't be charged. Referral discounts, if you have any, are applied automatically. Questions? Reply to this email.`;

      const sent = await sendEmail(resendKey, {
        to: email,
        subject,
        html: emailShell({ preheader: subject, kicker: isTrial ? 'Trial ending' : 'Renewal reminder', heading, intro, panelHtml, ctaText: 'Manage subscription', ctaUrl: `${SITE}/dashboard/settings/subscription`, footNote }),
      });
      if (!sent) { result.failed++; continue; }

      await admin.from('subscriptions').update({ reminder_sent_for: chargeDate }).eq('id', s.id);
      if (isTrial) result.trial++; else result.annual++;
    } catch (e) {
      console.error('billing-reminders: failed for', s.id, e instanceof Error ? e.message : String(e));
      result.failed++;
    }
  }

  return json({ ok: true, today, ...result });
});
