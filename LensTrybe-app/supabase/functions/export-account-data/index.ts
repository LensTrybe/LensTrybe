// Supabase Edge Function: export-account-data
// Client-facing (verify_jwt = false), authenticated INSIDE with the caller's JWT.
// Builds a ZIP of everything the caller's account holds (JSON + CSV per table) plus a
// files.csv with download links for every file they have uploaded. Works for creatives
// and clients, including while an account is scheduled for deletion.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { zipSync, strToU8 } from 'npm:fflate@0.8.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-disposition',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Tables and the column that ties a row to the account owner.
const CREATIVE_TABLES: Array<[string, string]> = [
  ['profiles', 'id'], ['profile_private', 'id'], ['subscriptions', 'user_id'],
  ['portfolio_items', 'creative_id'], ['portfolio_services', 'creative_id'],
  ['portfolio_website_content', 'creative_id'], ['portfolio_website_items', 'creative_id'], ['site_pages', 'creative_id'],
  ['brand_kit', 'creative_id'], ['availability', 'creative_id'], ['availability_slots', 'creative_id'],
  ['bookings', 'creative_id'], ['meetings', 'creative_id'], ['calendar_events', 'user_id'],
  ['crm_contacts', 'creative_id'], ['contacts', 'creative_id'], ['pipeline_stages', 'creative_id'],
  ['projects', 'creative_id'], ['project_participants', 'creative_id'], ['project_checklists', 'creative_id'],
  ['checklist_items', 'creative_id'], ['checklist_templates', 'creative_id'], ['deliverable_tasks', 'creative_id'],
  ['creative_tasks', 'user_id'], ['notes', 'creative_id'],
  ['quotes', 'creative_id'], ['invoices', 'creative_id'], ['contracts', 'creative_id'], ['uploaded_contracts', 'creative_id'],
  ['client_portals', 'creative_id'], ['deliveries', 'creative_id'],
  ['expenses', 'creative_id'], ['finance_settings', 'creative_id'], ['financial_goals', 'creative_id'],
  ['inventory_folders', 'creative_id'], ['inventory_items', 'creative_id'], ['inventory_checkouts', 'creative_id'],
  ['content_stages', 'creative_id'], ['content_posts', 'creative_id'], ['content_ideas', 'creative_id'],
  ['reviews', 'creative_id'], ['review_contacts', 'creative_id'],
  ['gear_listings', 'creative_id'], ['marketplace_listings', 'creative_id'], ['job_listings', 'posted_by'],
  ['job_applications', 'creative_id'], ['collaborations', 'posted_by'], ['collaboration_members', 'creative_id'],
  ['team_members', 'creative_id'], ['team_invitations', 'creative_id'], ['team_invite_codes', 'creative_id'],
  ['referrals', 'referrer_id'], ['founding_feedback', 'creative_id'],
  ['saved_creatives', 'user_id'], ['saved_listings', 'user_id'], ['notifications', 'user_id'],
  ['support_tickets', 'user_id'], ['lumi_conversations', 'user_id'], ['lumi_usage', 'user_id'],
  ['email_subscribers', 'user_id'],
];
const CLIENT_TABLES: Array<[string, string]> = [
  ['client_accounts', 'id'], ['job_listings', 'posted_by'], ['saved_creatives', 'user_id'],
  ['saved_listings', 'user_id'], ['notifications', 'user_id'], ['support_tickets', 'user_id'],
  ['email_subscribers', 'user_id'],
];

// Secrets and internal ids never leave the database, even to the owner.
const STRIP = /(token|password|code_hash|revolut_|stripe_|processed_order_ids|inflight_charge)/i;
const PRIVATE_BUCKETS = new Set(['credentials', 'receipts']);
const MAX_ROWS = 20000;

function clean(rows: Record<string, unknown>[]) {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) if (!STRIP.test(k)) o[k] = v;
    return o;
  });
}
function csvCell(v: unknown) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
}

async function fetchAll(admin: SupabaseClient, table: string, col: string, value: string | string[]) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    let q = admin.from(table).select('*');
    q = Array.isArray(value) ? q.in(col, value) : q.eq(col, value);
    const { data, error } = await q.range(from, from + 999);
    if (error) { console.error(`export: ${table} failed`, error.message); break; }
    out.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('export-account-data: missing env');
      return json({ error: 'Data export is not available right now.' }, 500);
    }
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Please sign in again.' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: 'Please sign in again.' }, 401);

    const { data: allowed } = await admin.rpc('rate_limit_hit', {
      p_key: `account-export:${user.id}`, p_max: 5, p_window_seconds: 3600,
    });
    if (allowed === false) return json({ error: 'You have downloaded your data a few times already. Please try again in an hour.' }, 429);

    const [{ data: profile }, { data: client }] = await Promise.all([
      admin.from('profiles').select('id, business_name').eq('id', user.id).maybeSingle(),
      admin.from('client_accounts').select('id').eq('id', user.id).maybeSingle(),
    ]);
    const kind = profile ? 'creative' : client ? 'client' : null;
    if (!kind) return json({ error: 'We could not find your account.' }, 404);

    const files: Record<string, Uint8Array> = {};
    const summary: string[] = [];
    const tables = kind === 'creative' ? [...CREATIVE_TABLES, ['client_accounts', 'id'] as [string, string]] : CLIENT_TABLES;

    for (const [table, col] of tables) {
      const rows = clean(await fetchAll(admin, table, col, user.id));
      if (!rows.length) continue;
      files[`data/${table}.json`] = strToU8(JSON.stringify(rows, null, 2));
      files[`data/${table}.csv`] = strToU8(toCsv(rows));
      summary.push(`${table}: ${rows.length}`);
    }

    // Clients: the bookings they requested or were booked into, without the creative's
    // private notes (same columns as my_client_bookings()).
    if (kind === 'client') {
      const { data: bk, error: bkErr } = await admin.from('bookings')
        .select('id, creative_id, client_name, client_email, client_phone, service, booking_date, all_day, start_time, end_time, location, status, origin, message, response_note, cancelled_by, cancelled_at, confirmed_at, created_at, updated_at')
        .eq('client_user_id', user.id).limit(MAX_ROWS);
      if (bkErr) console.error('export: bookings failed', bkErr.message);
      const rows = clean((bk || []) as Record<string, unknown>[]);
      if (rows.length) {
        files['data/bookings.json'] = strToU8(JSON.stringify(rows, null, 2));
        files['data/bookings.csv'] = strToU8(toCsv(rows));
        summary.push(`bookings: ${rows.length}`);
      }
    }

    // Conversations: threads they are part of, and every message in them.
    const threadMap = new Map<string, Record<string, unknown>>();
    for (const col of kind === 'creative' ? ['creative_id', 'client_user_id', 'sender_user_id'] : ['client_user_id', 'sender_user_id']) {
      for (const t of await fetchAll(admin, 'message_threads', col, user.id)) threadMap.set(String(t.id), t);
    }
    const threads = clean([...threadMap.values()]);
    if (threads.length) {
      files['data/message_threads.json'] = strToU8(JSON.stringify(threads, null, 2));
      files['data/message_threads.csv'] = strToU8(toCsv(threads));
      summary.push(`message_threads: ${threads.length}`);
      const ids = [...threadMap.keys()];
      const msgs: Record<string, unknown>[] = [];
      for (let i = 0; i < ids.length; i += 200) msgs.push(...await fetchAll(admin, 'messages', 'thread_id', ids.slice(i, i + 200)));
      const cm = clean(msgs);
      if (cm.length) {
        files['data/messages.json'] = strToU8(JSON.stringify(cm, null, 2));
        files['data/messages.csv'] = strToU8(toCsv(cm));
        summary.push(`messages: ${cm.length}`);
      }
    }

    // Account basics from auth.
    files['data/account.json'] = strToU8(JSON.stringify({
      id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at, account_type: kind,
    }, null, 2));

    // Uploaded files: links rather than the files themselves (galleries can be many GB).
    const { data: objs, error: oErr } = await admin.rpc('account_storage_objects', { p_uid: user.id });
    if (oErr) console.error('export: storage list failed', oErr.message);
    const objects = (objs || []) as Array<{ bucket_id: string; name: string; size: number }>;
    const fileRows: Record<string, unknown>[] = [];
    for (const o of objects) {
      let url = '';
      if (PRIVATE_BUCKETS.has(o.bucket_id)) {
        const { data: s } = await admin.storage.from(o.bucket_id).createSignedUrl(o.name, 7 * 24 * 3600);
        url = s?.signedUrl || '';
      } else {
        url = `${supabaseUrl}/storage/v1/object/public/${o.bucket_id}/${o.name.split('/').map(encodeURIComponent).join('/')}`;
      }
      fileRows.push({ bucket: o.bucket_id, path: o.name, size_bytes: o.size, download_url: url });
    }
    if (fileRows.length) {
      files['files.csv'] = strToU8(toCsv(fileRows));
      summary.push(`files: ${fileRows.length}`);
    }

    const generated = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });
    files['README.txt'] = strToU8([
      'Your LensTrybe data',
      '===================',
      '',
      `Generated: ${generated} (Brisbane time)`,
      `Account: ${user.email}`,
      '',
      'data/  One JSON file and one CSV file per type of record. CSV files open in Excel, Numbers or Google Sheets.',
      'files.csv  Every file you uploaded, with a download link. Links to private files (receipts, credential documents) work for 7 days.',
      '',
      'Passwords, access tokens and payment processor ids are left out for your security.',
      'Invoices, quotes and contracts can also be downloaded as PDFs from your dashboard.',
      '',
      'What is included:',
      ...summary.map((s) => `  ${s}`),
      '',
      'Questions? Email connect@lenstrybe.com',
    ].join('\r\n'));

    const zip = zipSync(files, { level: 6 });
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(zip as unknown as BodyInit, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="lenstrybe-data-${stamp}.zip"`,
      },
    });
  } catch (err) {
    console.error('export-account-data error:', err instanceof Error ? err.message : String(err));
    return json({ error: 'Something went wrong preparing your data. Please try again.' }, 500);
  }
});
