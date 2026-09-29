// Supabase Edge Function: billing-reminders
// Internal only (daily cron, x-cron-secret; or service role bearer). Fails closed.
// Emails a reminder about 7 days before a charge the creative might not expect:
//   - the first charge when a free trial (including the founding free year) ends
//   - each annual renewal
// One reminder per charge date (subscriptions.reminder_sent_for).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { reminderEmail } from './emails.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>';
const REPLY_TO = 'connect@lenstrybe.com';
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
      const { subject, html } = reminderEmail({ name, isTrial, founding: !!s.founding_member, tier, billing, price, when });

      const sent = await sendEmail(resendKey, {
        to: email,
        subject,
        html,
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
