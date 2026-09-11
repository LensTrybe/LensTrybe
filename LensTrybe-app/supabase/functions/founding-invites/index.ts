// Supabase Edge Function: founding-invites
//
// The Founding Invites tool. Michael invites up to 100 founding creatives, each with a
// personal single-use code (FIRSTNAME-XXXX) sent in a personal email.
//
//  Admin actions (JWT of a profile with is_admin = true):
//    list                      invites + places used / cap + redeemed creatives' deal status
//    create  {invites, send}   add one or many invites (name, email, skill_type, region, note)
//    send    {id, manual}      send, resend or re-open an invite: the code is live for 14 days
//                              (manual: Michael shares the link himself, no email is sent)
//    update  {id, ...fields}   fix a name, email, type, region or note on a live invite
//    cancel  {id}              cancel an unused code (frees the place)
//    end_deal {id}             end a signed-up creative's founding deal (frees the place)
//    extend  {id}              add 14 days to a sent invite
//    delete  {id}              remove a draft that was never sent
//    preview {name, note, code} the invite email HTML
//
//  Cron (header x-cron-secret == CRON_SECRET, daily):
//    marks unused codes past expires_at as expired, and sends one reminder once an invite
//    has 7 days or less left.
//
//  Places: a live invite (unused, not expired) or a founding creative who still has the deal
//  takes a place. founding_places_used() in the database is the source of truth and a
//  trigger on founding_invites refuses anything that would go over the cap.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const GREEN = '#1DB954'
const PINK = '#FF2D78'
const FROM = 'Michael from LensTrybe <noreply@mail.lenstrybe.com>'
const REPLY_TO = 'connect@lenstrybe.com'
const SITE = 'https://lenstrybe.com'
const VALID_DAYS = 14
const REMIND_AT_DAYS_LEFT = 7
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const MAX_BATCH = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function clean(s: unknown, max = 200) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Personal notes keep their line breaks.
function cleanNote(s: unknown) {
  return String(s ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1000)
}

function firstNameOf(name: string) {
  return clean(name).split(' ')[0] || ''
}

function isEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254
}

function codeStem(first: string) {
  const letters = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10)
  return letters.length >= 2 ? letters : 'LENS'
}

function randomSuffix() {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

function addDays(days: number, from = Date.now()) {
  return new Date(from + days * 86400000).toISOString()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

function inviteLink(code: string) {
  return `${SITE}/join/creative?code=${encodeURIComponent(code)}`
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------
function shell(inner: string, footerNote: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0a0a0f;font-family:Inter,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
<tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${GREEN};letter-spacing:-0.01em;">LensTrybe</div></td></tr>
${inner}
<tr><td style="padding:26px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:12px;line-height:1.6;color:#6a6a78;">${footerNote}<br>Connect. Capture. Create.</div></td></tr>
</table></td></tr></table></body></html>`
}

function button(href: string, label: string) {
  return `<tr><td style="padding:6px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${GREEN};"><a href="${esc(href)}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">${esc(label)}</a></td></tr></table></td></tr>`
}

function codeBox(code: string, expiresIso: string) {
  return `<tr><td style="padding:18px 36px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(29,185,84,0.08);border:1px solid rgba(29,185,84,0.35);border-radius:12px;"><tr><td style="padding:16px 18px;">
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${GREEN};margin-bottom:6px;">Your personal code</div>
<div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:0.06em;font-family:'SF Mono',Menlo,Consolas,monospace;">${esc(code)}</div>
<div style="font-size:12.5px;color:#9a9aa8;margin-top:6px;">Works once, just for you. Expires ${esc(fmtDate(expiresIso))}.</div>
</td></tr></table></td></tr>`
}

const signOff = `<p style="margin:18px 0 0;color:#9a9aa8;font-size:15px;line-height:1.6;">Any questions at all, just reply to this email. It comes straight to me.</p>
<p style="margin:18px 0 0;color:#fff;font-size:15px;line-height:1.5;">Michael<br><span style="color:#9a9aa8;font-size:13.5px;">Founder, LensTrybe</span></p>`

function inviteEmail(first: string, code: string, expiresIso: string, note: string) {
  const name = first || 'there'
  const noteBlock = note
    ? `<tr><td style="padding:4px 36px 10px;"><div style="border-left:3px solid ${PINK};padding:4px 0 4px 14px;color:#e6e6ee;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(note)}</div></td></tr>`
    : ''
  const li = (t: string) => `<li style="margin:0 0 7px;">${t}</li>`
  const inner = `
<tr><td style="padding:22px 36px 6px;">
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${PINK};margin-bottom:10px;">Founding creative invite</div>
<h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;font-weight:800;color:#fff;">Hi ${esc(name)}, I'd love you on board</h1>
<p style="margin:0 0 12px;color:#9a9aa8;font-size:15px;line-height:1.6;">I'm building LensTrybe, a home for Australian photographers and videographers where you keep everything you earn. No commission on your jobs, ever.</p>
<p style="margin:0 0 6px;color:#9a9aa8;font-size:15px;line-height:1.6;">I'm hand-picking 100 creatives to be our founding members, and I'd really like you to be one of them.</p>
</td></tr>
${noteBlock}
<tr><td style="padding:12px 36px 0;">
<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:8px;">What you get</div>
<ul style="color:#e6e6ee;font-size:14px;line-height:1.5;padding-left:20px;margin:0 0 14px;">
${li('Our <strong style="color:#fff;">Expert plan free for 12 months</strong> from the day you join (normally $74.99 a month)')}
${li('Then <strong style="color:#fff;">$49 a month, or $588 a year, locked in for life</strong>')}
${li('A Founding Creative badge on your profile')}
${li('A direct line to me, and a real say in what we build next')}
</ul>
<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:8px;">What I ask in return</div>
<ul style="color:#e6e6ee;font-size:14px;line-height:1.5;padding-left:20px;margin:0 0 4px;">
${li('Get your profile 100% complete within 7 days of joining')}
${li('Run your next 3 real client jobs through LensTrybe within 6 months')}
${li('Share a little feedback each month. A sentence or two is plenty.')}
</ul>
</td></tr>
${codeBox(code, expiresIso)}
${button(inviteLink(code), 'Claim my founding place')}
<tr><td style="padding:14px 36px 0;">
<p style="margin:0 0 10px;color:#9a9aa8;font-size:13.5px;line-height:1.6;">The button takes you to sign up with your code already filled in. Just tap <strong style="color:#fff;">Apply</strong> and follow the steps. You'll add a card at the end, but you won't be charged anything for 12 months, and you can cancel any time.</p>
<p style="margin:0;color:#9a9aa8;font-size:13.5px;line-height:1.6;">The full details are in the <a href="${SITE}/founding-agreement" style="color:${GREEN};font-weight:600;text-decoration:none;">Founding Creative Agreement</a>.</p>
${signOff}
</td></tr>`
  return shell(inner, "You're getting this because Michael invited you personally to join LensTrybe as a founding creative. If it's not for you, no need to do anything. The code simply expires.")
}

function reminderEmail(first: string, code: string, expiresIso: string) {
  const name = first || 'there'
  const inner = `
<tr><td style="padding:22px 36px 6px;">
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${PINK};margin-bottom:10px;">Your founding place</div>
<h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;font-weight:800;color:#fff;">Hi ${esc(name)}, your place is still here</h1>
<p style="margin:0 0 12px;color:#9a9aa8;font-size:15px;line-height:1.6;">Just a quick nudge in case my last email got buried. Your founding invite is still open: Expert free for 12 months, then $49 a month locked in for life, and no commission on your jobs, ever.</p>
<p style="margin:0;color:#9a9aa8;font-size:15px;line-height:1.6;">Your code expires on <strong style="color:#fff;">${esc(fmtDate(expiresIso))}</strong>. After that the place goes to the next creative on my list.</p>
</td></tr>
${codeBox(code, expiresIso)}
${button(inviteLink(code), 'Claim my founding place')}
<tr><td style="padding:14px 36px 0;">
<p style="margin:0;color:#9a9aa8;font-size:13.5px;line-height:1.6;">Tap the button, then <strong style="color:#fff;">Apply</strong> next to your code. Everything's in the <a href="${SITE}/founding-agreement" style="color:${GREEN};font-weight:600;text-decoration:none;">Founding Creative Agreement</a>.</p>
${signOff}
</td></tr>`
  return shell(inner, "You're getting this because Michael invited you personally to join LensTrybe as a founding creative. If it's not for you, no need to do anything. The code simply expires.")
}

function inviteSubject(first: string) {
  return first ? `${first}, you're invited to be a LensTrybe founding creative` : "You're invited to be a LensTrybe founding creative"
}
function reminderSubject(first: string) {
  return first ? `${first}, your LensTrybe founding place is still waiting` : 'Your LensTrybe founding place is still waiting'
}

async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return 'Email is not configured (RESEND_API_KEY missing)'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
    })
    if (res.ok) return null
    const t = await res.text().catch(() => '')
    return `Email failed (${res.status}) ${t.slice(0, 200)}`.trim()
  } catch (e) {
    return `Email failed: ${e instanceof Error ? e.message : String(e)}`
  }
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
const INVITE_COLS = 'id, code, email, full_name, first_name, region, skill_type, personal_note, status, sent_at, last_sent_at, send_count, reminded_at, expires_at, cancelled_at, redeemed_by, redeemed_at, email_error, notes, created_at'

async function places(sb: SupabaseClient) {
  const { data: used } = await sb.rpc('founding_places_used')
  const { data: cap } = await sb.rpc('founding_cap')
  const u = Number(used ?? 0)
  const c = Number(cap ?? 100)
  return { used: u, cap: c, available: Math.max(0, c - u) }
}

function isFull(err: { message?: string } | null) {
  return Boolean(err && String(err.message || '').includes('FOUNDING_PLACES_FULL'))
}

function isLive(inv: { status: string; expires_at: string | null }) {
  return inv.status === 'unused' && (!inv.expires_at || new Date(inv.expires_at).getTime() > Date.now())
}

async function getInvite(sb: SupabaseClient, id: string) {
  const { data } = await sb.from('founding_invites').select(INVITE_COLS).eq('id', id).maybeSingle()
  return data as Record<string, any> | null
}

async function emailTaken(sb: SupabaseClient, email: string, exceptId?: string) {
  let q = sb.from('founding_invites').select('id').ilike('email', email.replace(/[%_\\]/g, (m) => '\\' + m)).in('status', ['unused', 'redeemed'])
  if (exceptId) q = q.neq('id', exceptId)
  const { data } = await q.limit(1)
  return (data ?? []).length > 0
}

// Send (or resend / re-open) one invite. The code goes live for 14 days from now.
async function sendInvite(sb: SupabaseClient, inv: Record<string, any>, manual = false) {
  if (inv.status === 'redeemed') return { ok: false, error: 'This invite has already been used to sign up.' }
  if (inv.status === 'cancelled') return { ok: false, error: 'This invite was cancelled. Add them again to send a new code.' }
  if (!inv.email && !manual) return { ok: false, error: 'This invite has no email address.' }

  const prev = { status: inv.status, expires_at: inv.expires_at, reminded_at: inv.reminded_at }
  const expires = addDays(VALID_DAYS)

  // Take (or keep) the place first. The cap trigger refuses this if it's full.
  // Conditional on the status we read, so a cancel or signup in the meantime wins.
  const { data: liveRow, error: liveErr } = await sb.from('founding_invites')
    .update({ status: 'unused', expires_at: expires, reminded_at: null })
    .eq('id', inv.id).eq('status', inv.status)
    .select('id').maybeSingle()
  if (!liveErr && !liveRow) return { ok: false, error: 'This invite just changed. Refresh and try again.' }
  if (liveErr) {
    if (isFull(liveErr)) return { ok: false, error: 'All founding places are taken. Cancel an unused invite to free one up.' }
    if ((liveErr as any).code === '23505') return { ok: false, error: 'This email already has a live invite or a founding account.' }
    return { ok: false, error: 'Could not update the invite.' }
  }

  // manual: Michael is sharing the link himself (text, DM). Start the clock, no email.
  const first = inv.first_name || firstNameOf(inv.full_name || '')
  const err = manual ? null : await sendEmail(inv.email, inviteSubject(first), inviteEmail(first, inv.code, expires, inv.personal_note || ''))
  const now = new Date().toISOString()

  if (err) {
    // Put it back how it was so a failed first send stays a draft.
    await sb.from('founding_invites').update({ ...prev, email_error: err }).eq('id', inv.id).eq('status', 'unused')
    return { ok: false, error: err }
  }

  const { data: updated } = await sb.from('founding_invites').update({
    sent_at: inv.sent_at || now,
    last_sent_at: now,
    send_count: Number(inv.send_count || 0) + (manual ? 0 : 1),
    email_error: manual ? inv.email_error : null,
  }).eq('id', inv.id).select(INVITE_COLS).maybeSingle()
  return { ok: true, invite: updated }
}

// ---------------------------------------------------------------------------
// Cron: expire + remind
// ---------------------------------------------------------------------------
async function runCron(sb: SupabaseClient) {
  const nowIso = new Date().toISOString()
  const { data: expired } = await sb.from('founding_invites')
    .update({ status: 'expired' })
    .eq('status', 'unused').not('expires_at', 'is', null).lte('expires_at', nowIso)
    .select('id')

  const { data: due } = await sb.from('founding_invites')
    .select(INVITE_COLS)
    .eq('status', 'unused').not('sent_at', 'is', null).is('reminded_at', null)
    .gt('expires_at', nowIso).lte('expires_at', addDays(REMIND_AT_DAYS_LEFT))
    .limit(200)

  let reminded = 0
  let failed = 0
  for (const inv of due ?? []) {
    if (!inv.email) continue
    const first = inv.first_name || firstNameOf(inv.full_name || '')
    const err = await sendEmail(inv.email, reminderSubject(first), reminderEmail(first, inv.code, inv.expires_at))
    if (err) {
      failed++
      await sb.from('founding_invites').update({ email_error: err }).eq('id', inv.id)
    } else {
      reminded++
      await sb.from('founding_invites').update({ reminded_at: new Date().toISOString(), email_error: null }).eq('id', inv.id)
    }
  }
  return { ran_at: nowIso, expired: (expired ?? []).length, reminded, failed }
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Cron mode.
  const cronHeader = req.headers.get('x-cron-secret')
  if (cronHeader) {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret || !safeEqual(cronHeader, cronSecret)) return json({ error: 'Unauthorised' }, 401)
    return json(await runCron(sb))
  }

  // Admin mode.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Unauthorised' }, 401)
  const { data: userData, error: userErr } = await sb.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'Unauthorised' }, 401)
  const { data: me } = await sb.from('profiles').select('id, is_admin').eq('id', userData.user.id).maybeSingle()
  if (!me?.is_admin) return json({ error: 'Forbidden' }, 403)

  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* empty */ }
  const action = String(body.action || '')

  try {
    if (action === 'list') {
      const { data: invites, error } = await sb.from('founding_invites').select(INVITE_COLS).order('created_at', { ascending: false }).limit(1000)
      if (error) return json({ error: 'Could not load invites' }, 500)
      const { data: founders } = await sb.from('profiles')
        .select('id, business_name, subscription_tier, founding_deal_status, founding_member_since, pending_deletion, is_admin')
        .eq('founding_member', true)
      return json({ invites: invites ?? [], founders: founders ?? [], places: await places(sb), valid_days: VALID_DAYS })
    }

    if (action === 'preview') {
      const first = firstNameOf(clean(body.name, 120)) || 'Sarah'
      const code = clean(body.code, 40) || `${codeStem(first)}-${randomSuffix()}`
      const expires = addDays(VALID_DAYS)
      const kind = body.kind === 'reminder' ? 'reminder' : 'invite'
      return json({
        subject: kind === 'reminder' ? reminderSubject(first) : inviteSubject(first),
        html: kind === 'reminder' ? reminderEmail(first, code, expires) : inviteEmail(first, code, expires, cleanNote(body.note)),
      })
    }

    if (action === 'create') {
      const rows = Array.isArray(body.invites) ? body.invites.slice(0, MAX_BATCH + 1) : []
      if (rows.length === 0) return json({ error: 'Add at least one creative.' }, 400)
      if (rows.length > MAX_BATCH) return json({ error: `Add up to ${MAX_BATCH} at a time.` }, 400)

      const problems: { row: number; error: string }[] = []
      const seen = new Set<string>()
      const prepared: Record<string, any>[] = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || {}
        const full = clean(r.name, 120)
        const email = clean(r.email, 254).toLowerCase()
        if (!full) { problems.push({ row: i + 1, error: 'Name is missing' }); continue }
        if (!isEmail(email)) { problems.push({ row: i + 1, error: `"${email || 'blank'}" is not a valid email` }); continue }
        if (seen.has(email)) { problems.push({ row: i + 1, error: `${email} is listed twice` }); continue }
        seen.add(email)
        if (await emailTaken(sb, email)) { problems.push({ row: i + 1, error: `${email} already has a live invite or a founding account` }); continue }
        prepared.push({
          full_name: full,
          first_name: firstNameOf(full),
          email,
          skill_type: clean(r.skill_type, 60) || null,
          region: clean(r.region, 80) || null,
          personal_note: cleanNote(r.note) || null,
        })
      }
      if (problems.length) return json({ error: 'Some rows need fixing before anything is added.', problems }, 400)

      const p = await places(sb)
      if (prepared.length > p.available) {
        return json({ error: p.available === 0 ? 'All founding places are taken.' : `Only ${p.available} founding place${p.available === 1 ? '' : 's'} left. You're adding ${prepared.length}.`, places: p }, 409)
      }

      const created: Record<string, any>[] = []
      const failed: { email: string; error: string }[] = []
      for (const row of prepared) {
        let inserted: Record<string, any> | null = null
        let lastErr = ''
        for (let attempt = 0; attempt < 6 && !inserted; attempt++) {
          const code = `${codeStem(row.first_name)}-${randomSuffix()}`
          const { data, error } = await sb.from('founding_invites')
            .insert({ ...row, code, status: 'unused', invited_by: me.id })
            .select(INVITE_COLS).maybeSingle()
          if (!error) { inserted = data; break }
          if (isFull(error)) { lastErr = 'All founding places are taken.'; break }
          const msg = String(error.message || '')
          if ((error as any).code === '23505' && msg.includes('email')) { lastErr = 'Already has a live invite or a founding account.'; break }
          if ((error as any).code !== '23505') { lastErr = 'Could not add this invite.'; console.error('founding-invites insert', msg); break }
          // Code clash: try another suffix.
        }
        if (!inserted) { failed.push({ email: row.email, error: lastErr || 'Could not create a unique code.' }); continue }
        created.push(inserted)
      }

      const sendResults: { id: string; ok: boolean; error?: string }[] = []
      if (body.send) {
        for (let i = 0; i < created.length; i++) {
          const r = await sendInvite(sb, created[i])
          sendResults.push({ id: created[i].id, ok: r.ok, error: r.ok ? undefined : r.error })
          if (r.ok && r.invite) created[i] = r.invite
        }
      }
      return json({ created, failed, sent: sendResults, places: await places(sb) })
    }

    const id = String(body.id || '')
    if (!id) return json({ error: 'Missing invite' }, 400)
    const inv = await getInvite(sb, id)
    if (!inv) return json({ error: 'Invite not found' }, 404)

    if (action === 'send') {
      const r = await sendInvite(sb, inv, body.manual === true)
      if (!r.ok) return json({ error: r.error, places: await places(sb) }, 409)
      return json({ invite: r.invite, places: await places(sb) })
    }

    if (action === 'cancel') {
      if (inv.status === 'redeemed') return json({ error: "This creative has already signed up. Manage their deal in Founding Members below." }, 409)
      if (inv.status === 'cancelled') return json({ invite: inv, places: await places(sb) })
      const { data, error } = await sb.from('founding_invites')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id).in('status', ['unused', 'expired']).select(INVITE_COLS).maybeSingle()
      if (error || !data) return json({ error: 'Could not cancel. It may have just been used.' }, 409)
      return json({ invite: data, places: await places(sb) })
    }

    // A founding creative who pulls out after signing up: end the deal. founding_end_deal()
    // is shared with the automatic revert in founding-check: standard price, the free period
    // ends (first payment 7 days later), badge/profile/work kept, place freed. The creative
    // gets the 'founding_ended' billing email with the amount and date.
    if (action === 'end_deal') {
      if (inv.status !== 'redeemed' || !inv.redeemed_by) return json({ error: 'Only signed-up invites have a founding deal to end.' }, 409)
      const { data: res, error: rErr } = await sb.rpc('founding_end_deal', { p_profile: inv.redeemed_by })
      if (rErr) { console.error('founding-invites end_deal', rErr.message); return json({ error: 'Could not end the deal.' }, 500) }
      if (!res?.ok) return json({ error: 'Their founding deal has already ended.', places: await places(sb) }, 409)
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-billing-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: inv.redeemed_by, kind: 'founding_ended', tier: res.tier || 'expert', amount_minor: res.amount_minor, currency: 'AUD', billing: res.billing, first_charge_date: res.first_charge_date }),
        })
      } catch (e) { console.error('founding-invites end_deal email', e instanceof Error ? e.message : String(e)) }
      return json({ founder: { id: inv.redeemed_by, founding_deal_status: 'reverted' }, first_charge_date: res.first_charge_date, places: await places(sb) })
    }

    if (action === 'extend') {
      if (!inv.sent_at) return json({ error: "This invite hasn't been sent yet." }, 409)
      if (inv.status !== 'unused' && inv.status !== 'expired') return json({ error: 'Only unused codes can be extended.' }, 409)
      const base = isLive(inv) && inv.expires_at ? new Date(inv.expires_at).getTime() : Date.now()
      const { data, error } = await sb.from('founding_invites')
        .update({ status: 'unused', expires_at: addDays(VALID_DAYS, base), reminded_at: null })
        .eq('id', id).in('status', ['unused', 'expired']).select(INVITE_COLS).maybeSingle()
      if (error) {
        if (isFull(error)) return json({ error: 'All founding places are taken. Cancel an unused invite to free one up.' }, 409)
        return json({ error: 'Could not extend this invite.' }, 500)
      }
      return json({ invite: data, places: await places(sb) })
    }

    if (action === 'update') {
      if (inv.status !== 'unused' && inv.status !== 'expired') return json({ error: 'Only unused invites can be edited.' }, 409)
      const patch: Record<string, unknown> = {}
      if (body.name !== undefined) {
        const full = clean(body.name, 120)
        if (!full) return json({ error: 'Name is required.' }, 400)
        patch.full_name = full
        patch.first_name = firstNameOf(full)
      }
      if (body.email !== undefined) {
        const email = clean(body.email, 254).toLowerCase()
        if (!isEmail(email)) return json({ error: 'That email address is not valid.' }, 400)
        if (email !== String(inv.email || '').toLowerCase() && await emailTaken(sb, email, id)) return json({ error: 'That email already has a live invite or a founding account.' }, 409)
        patch.email = email
      }
      if (body.skill_type !== undefined) patch.skill_type = clean(body.skill_type, 60) || null
      if (body.region !== undefined) patch.region = clean(body.region, 80) || null
      if (body.note !== undefined) patch.personal_note = cleanNote(body.note) || null
      if (Object.keys(patch).length === 0) return json({ invite: inv })
      const { data, error } = await sb.from('founding_invites').update(patch).eq('id', id).in('status', ['unused', 'expired']).select(INVITE_COLS).maybeSingle()
      if (!error && !data) return json({ error: 'This invite just changed. Refresh and try again.' }, 409)
      if (error) return json({ error: (error as any).code === '23505' ? 'That email already has a live invite or a founding account.' : 'Could not save changes.' }, 409)
      return json({ invite: data })
    }

    if (action === 'delete') {
      if (inv.sent_at) return json({ error: 'Sent invites can be cancelled but not deleted.' }, 409)
      if (inv.status === 'redeemed') return json({ error: 'This invite has been used.' }, 409)
      const { error } = await sb.from('founding_invites').delete().eq('id', id).is('sent_at', null).neq('status', 'redeemed')
      if (error) return json({ error: 'Could not delete this draft.' }, 500)
      return json({ deleted: id, places: await places(sb) })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('founding-invites error', e instanceof Error ? e.message : String(e))
    return json({ error: 'Something went wrong' }, 500)
  }
})
