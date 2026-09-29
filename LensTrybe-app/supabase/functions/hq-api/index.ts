// hq-api: everything LensTrybe HQ does, checked here on the server on every call.
//
// Before any action the caller must be:
//   - a real, signed-in LensTrybe HQ staff login (hq_staff row, active)
//   - signed in with two-factor on this session (JWT aal2)
//   - inside the session limits: 12 hours since their authenticator code, and not idle for
//     more than 30 minutes (last_seen_at, kept here on the server)
//   - allowed that action by their role: support < admin < owner
// Every change, and every look at a person's account, goes in hq_audit (append only).
// verify_jwt is on for this function; it is re-checked here anyway.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { HQ_URL, json, cors, clean, isEmail, ipOf, sha256, randomToken, mail, sendMail, esc } from './shared.ts'

const IDLE_MIN = 30
const MAX_HOURS = 12
const RANK: Record<string, number> = { support: 1, admin: 2, owner: 3 }
const TIERS = ['basic', 'pro', 'expert', 'elite']
const SETTINGS = ['home_hero', 'jobs_open_until']

// Which role each action needs.
const NEEDS: Record<string, string> = {
  me: 'support', ping: 'support', overview: 'support', health: 'support',
  users: 'support', user: 'support', jobs: 'support', job_replies: 'support',
  support: 'support', support_update: 'support', support_reply: 'support',
  reviews: 'support', review_decide: 'support',
  user_plan: 'admin', user_ban: 'admin', user_unban: 'admin', user_delete: 'admin', job_close: 'admin',
  founding: 'admin', founding_status: 'admin', broadcasts: 'admin', settings: 'admin', settings_set: 'admin', audit: 'admin',
  staff: 'owner', staff_invite: 'owner', staff_invite_revoke: 'owner', staff_active: 'owner', staff_reset_2fa: 'owner',
}

function claims(token: string) {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(p + '='.repeat((4 - p.length % 4) % 4)))
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Not found' }, 404)
  const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(url, service, { auth: { persistSession: false } })
  const ip = ipOf(req)

  // ---- who is asking --------------------------------------------------------------------
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(req, { error: 'signed_out' }, 401)
  const { data: ud, error: ue } = await sb.auth.getUser(token)
  if (ue || !ud?.user) return json(req, { error: 'signed_out' }, 401)
  const { data: me } = await sb.from('hq_staff').select('*').eq('user_id', ud.user.id).maybeSingle()
  if (!me || !me.active) return json(req, { error: 'not_staff' }, 403)
  const c = claims(token)
  if (!c || c.aal !== 'aal2') return json(req, { error: 'needs_2fa' }, 401)
  const totpAt = Math.max(0, ...((c.amr || []) as { method: string, timestamp: number }[]).filter(a => a.method === 'totp').map(a => a.timestamp))
  const now = Date.now()
  if (!totpAt || now - totpAt * 1000 > MAX_HOURS * 3600e3) return json(req, { error: 'session_expired' }, 401)
  const seen = me.last_seen_at ? new Date(me.last_seen_at).getTime() : 0
  if (seen && now - seen > IDLE_MIN * 60e3 && seen > totpAt * 1000) return json(req, { error: 'session_idle' }, 401)

  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* empty */ }
  const action = String(body.action || '')
  const need = NEEDS[action]
  if (!need) return json(req, { error: 'Unknown action' }, 400)
  if (RANK[me.role] < RANK[need]) return json(req, { error: 'Your HQ role doesn\'t allow that.' }, 403)
  // Only real use keeps a session alive; the page's own polling does not.
  if (action !== 'ping' || body.active) await sb.from('hq_staff').update({ last_seen_at: new Date().toISOString() }).eq('user_id', me.user_id)

  const audit = (a: string, target: string | null, detail: unknown = null) =>
    sb.from('hq_audit').insert({ staff_id: me.user_id, staff_email: me.email, action: a, target, detail, ip })
  const ok = (b: unknown) => json(req, b)
  const bad = (msg: string, status = 400) => json(req, { error: msg }, status)
  // The founding and broadcast tools already exist as their own functions; HQ calls them as the
  // server, with the service key, which they accept as an internal caller.
  const callFn = async (fn: string, payload: unknown) => {
    const r = await fetch(`${url}/functions/v1/${fn}`, { method: 'POST', headers: { Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', 'x-hq-staff': me.email }, body: JSON.stringify(payload) })
    const d = await r.json().catch(() => ({}))
    return { status: r.status, d }
  }

  try {
    switch (action) {
      case 'ping': return ok({ ok: true })
      case 'me': return ok({ me: { id: me.user_id, name: me.name, email: me.email, role: me.role } })

      case 'overview': {
        const { data: o, error } = await sb.rpc('hq_overview')
        if (error) throw error
        const { data: cron } = await sb.rpc('hq_cron_status')
        const { data: jobs } = await sb.from('job_listings').select('id, title, location, created_at, status').eq('status', 'active').order('created_at', { ascending: true }).limit(50)
        const ids = (jobs || []).map(j => j.id)
        const { data: apps } = ids.length ? await sb.from('job_applications').select('job_id').in('job_id', ids) : { data: [] }
        const replied = new Set((apps || []).map(a => a.job_id))
        return ok({ overview: o, cron: cron || [], unanswered: (jobs || []).filter(j => !replied.has(j.id)).slice(0, 8) })
      }

      case 'health': {
        const { data: cron } = await sb.rpc('hq_cron_status')
        let config: unknown = null
        const secret = Deno.env.get('CRON_SECRET')
        if (secret) {
          try {
            const r = await fetch(`${url}/functions/v1/config-check`, { method: 'POST', headers: { 'x-cron-secret': secret, 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
            config = await r.json().catch(() => null)
          } catch { config = null }
        }
        return ok({ cron: cron || [], config })
      }

      // ---- people --------------------------------------------------------------------------
      case 'users': {
        const { data, error } = await sb.rpc('hq_users')
        if (error) throw error
        return ok({ users: data || [] })
      }

      case 'user': {
        const id = String(body.id || '')
        const { data: au } = await sb.auth.admin.getUserById(id)
        if (!au?.user) return bad('Not found', 404)
        const { data: staff } = await sb.from('hq_staff').select('user_id').eq('user_id', id).maybeSingle()
        if (staff) return bad('Staff logins are managed under Staff.', 403)
        const [{ data: p }, { data: cl }, { data: subs }, { data: tickets }, { data: del }] = await Promise.all([
          sb.from('profiles').select('id, business_name, business_email, phone, city, state, skill_types, subscription_tier, comp_tier, subscription_status, founding_member, founding_deal_status, founding_member_since, is_listed, onboarded_at, avatar_url, pending_deletion, deletion_scheduled_at, is_admin, role, created_at').eq('id', id).maybeSingle(),
          sb.from('client_accounts').select('id, first_name, last_name, email, company_name, phone, created_at, pending_deletion').eq('id', id).maybeSingle(),
          sb.from('subscriptions').select('tier, billing, status, amount_minor, next_charge_date, current_period_end, founding_member, failed_attempts, past_due_since, card_brand, card_last4, pending_tier, created_at, updated_at').eq('user_id', id).order('updated_at', { ascending: false }).limit(5),
          sb.from('support_tickets').select('id, subject, status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
          sb.from('account_deletions').select('status, requested_at, scheduled_for, reason').eq('user_id', id).order('requested_at', { ascending: false }).limit(1),
        ])
        const count = async (t: string, col: string) => (await sb.from(t).select('id', { count: 'exact', head: true }).eq(col, id)).count ?? 0
        const counts = p ? {
          bookings: await count('bookings', 'creative_id'), invoices: await count('invoices', 'creative_id'), quotes: await count('quotes', 'creative_id'),
          threads: await count('message_threads', 'creative_id'), job_replies: await count('job_applications', 'creative_id'), portfolio: await count('portfolio_items', 'creative_id'),
        } : cl ? { jobs_posted: await count('job_listings', 'posted_by') } : {}
        await audit('user.viewed', id, { email: au.user.email })
        const u = au.user
        return ok({ user: {
          id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, confirmed: !!u.email_confirmed_at,
          banned_until: (u as any).banned_until || null, providers: (u.app_metadata?.providers || []),
          profile: p, client: cl, subscriptions: subs || [], tickets: tickets || [], deletion: (del || [])[0] || null, counts,
        } })
      }

      case 'user_plan': {
        const id = String(body.id || ''), tier = String(body.tier || '').toLowerCase()
        if (!TIERS.includes(tier)) return bad('Pick a plan.')
        const { data: p } = await sb.from('profiles').select('subscription_tier').eq('id', id).maybeSingle()
        if (!p) return bad('Only creatives have a plan.')
        // subscription_tier is what they can use; subscriptions.tier is what they pay for. Anything
        // above what they pay for is recorded as complimentary (comp_tier), so billing can't undo it.
        const { data: sub } = await sb.from('subscriptions').select('tier').eq('user_id', id).in('status', ['active', 'trialing', 'past_due']).order('updated_at', { ascending: false }).limit(1).maybeSingle()
        const rank = (t: string) => Math.max(0, TIERS.indexOf(String(t || 'basic').toLowerCase()))
        const billed = sub?.tier || 'basic'
        const comp = rank(tier) > rank(billed) ? tier : null
        const { error } = await sb.from('profiles').update({ subscription_tier: tier, comp_tier: comp }).eq('id', id)
        if (error) throw error
        await audit('user.plan_changed', id, { from: p.subscription_tier, to: tier, complimentary: !!comp, billed })
        return ok({ ok: true, comp_tier: comp, billed })
      }

      case 'user_ban':
      case 'user_unban': {
        const id = String(body.id || '')
        const { data: staff } = await sb.from('hq_staff').select('user_id').eq('user_id', id).maybeSingle()
        if (staff) return bad('Staff logins are managed under Staff.', 403)
        const reason = clean(body.reason, 300)
        if (action === 'user_ban' && !reason) return bad('Say why, for the activity log.')
        const { error } = await sb.auth.admin.updateUserById(id, { ban_duration: action === 'user_ban' ? '876000h' : 'none' } as any)
        if (error) throw error
        await audit(action === 'user_ban' ? 'user.suspended' : 'user.unsuspended', id, { reason: reason || null })
        return ok({ ok: true })
      }

      case 'user_delete': {
        const id = String(body.id || '')
        const { data: au } = await sb.auth.admin.getUserById(id)
        if (!au?.user) return bad('Not found', 404)
        const { data: staff } = await sb.from('hq_staff').select('user_id').eq('user_id', id).maybeSingle()
        if (staff) return bad('Staff logins are managed under Staff.', 403)
        if (String(body.confirm || '').trim().toLowerCase() !== String(au.user.email || '').toLowerCase()) return bad('Type their email address exactly to confirm.')
        const { data: sub } = await sb.from('subscriptions').select('status, tier').eq('user_id', id).in('status', ['active', 'trialing', 'past_due']).limit(1).maybeSingle()
        if (sub) return bad('They have a live subscription. Cancel it first so they are never charged after the account is gone.', 409)
        const { data: p } = await sb.from('profiles').select('business_name, founding_member').eq('id', id).maybeSingle()
        await audit('user.deleted', id, { email: au.user.email, name: p?.business_name || null, founding: !!p?.founding_member, reason: clean(body.reason, 300) || null })
        const { error } = await sb.auth.admin.deleteUser(id)
        if (error) { await audit('user.delete_failed', id, { error: error.message }); return bad('Could not delete the account: ' + error.message, 500) }
        return ok({ ok: true })
      }

      // ---- jobs ------------------------------------------------------------------------------
      case 'jobs': {
        const { data: jobs, error } = await sb.from('job_listings').select('id, title, creative_types, specialty, location, job_date, budget_range, description, status, created_at, expires_at, poster_name, poster_email').order('created_at', { ascending: false }).limit(150)
        if (error) throw error
        const ids = (jobs || []).map(j => j.id)
        const { data: apps } = ids.length ? await sb.from('job_applications').select('job_id, created_at').in('job_id', ids) : { data: [] }
        const n: Record<string, { c: number, first: string | null }> = {}
        for (const a of apps || []) { const x = n[a.job_id] ||= { c: 0, first: null }; x.c++; if (!x.first || a.created_at < x.first) x.first = a.created_at }
        return ok({ jobs: (jobs || []).map(j => ({ ...j, replies: n[j.id]?.c || 0, first_reply_at: n[j.id]?.first || null })) })
      }
      case 'job_replies': {
        const { data } = await sb.from('job_applications').select('id, creative_id, creative_name, price, includes, message, status, created_at').eq('job_id', String(body.id || '')).order('created_at')
        return ok({ replies: data || [] })
      }
      case 'job_close': {
        const id = String(body.id || '')
        const reason = clean(body.reason, 300)
        if (!reason) return bad('Say why, for the activity log.')
        const { data, error } = await sb.from('job_listings').update({ status: 'closed' }).eq('id', id).select('id, title').maybeSingle()
        if (error || !data) return bad('Could not close that job.')
        await audit('job.closed', id, { title: data.title, reason })
        return ok({ ok: true })
      }

      // ---- support ---------------------------------------------------------------------------
      case 'support': {
        const { data, error } = await sb.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(300)
        if (error) throw error
        return ok({ tickets: data || [] })
      }
      case 'support_update': {
        const id = String(body.id || '')
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (body.status !== undefined) { const s = String(body.status); if (!['open', 'waiting', 'closed'].includes(s)) return bad('Unknown status'); patch.status = s }
        if (body.admin_notes !== undefined) patch.admin_notes = String(body.admin_notes).slice(0, 5000)
        const { data, error } = await sb.from('support_tickets').update(patch).eq('id', id).select('*').maybeSingle()
        if (error || !data) return bad('Could not save that.')
        await audit('support.updated', id, { status: patch.status ?? null, notes: body.admin_notes !== undefined })
        return ok({ ticket: data })
      }
      case 'support_reply': {
        const id = String(body.id || '')
        const text = String(body.text || '').replace(/\r/g, '').trim().slice(0, 5000)
        if (!text) return bad('Write a reply first.')
        const { data: t } = await sb.from('support_tickets').select('*').eq('id', id).maybeSingle()
        if (!t || !isEmail(String(t.email || ''))) return bad('This ticket has no email address to reply to.')
        const first = String(t.name || '').split(' ')[0]
        const paras = text.split(/\n{2,}/).map(p => esc(p).replace(/\n/g, '<br>'))
        const err = await sendMail(t.email, 'Re: ' + (t.subject || 'Your LensTrybe support request'), mail(first ? `Hi ${first}` : 'Hi there', [...paras, '<span style="color:#9a9aa8;">The LensTrybe Team</span>'], undefined,
          `You're getting this because you contacted LensTrybe support. Reply to this email to keep the conversation going.`, 'LensTrybe Support'), 'LensTrybe Support <noreply@mail.lenstrybe.com>')
        if (err) return bad(err, 502)
        const stamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
        const notes = `[${stamp}, ${me.name} replied by email]\n${text}` + (t.admin_notes ? '\n\n' + t.admin_notes : '')
        const { data } = await sb.from('support_tickets').update({ admin_notes: notes.slice(0, 20000), status: 'waiting', updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle()
        await audit('support.replied', id, { to: t.email })
        return ok({ ticket: data })
      }

      // ---- moderation ------------------------------------------------------------------------
      case 'reviews': {
        const { data } = await sb.from('reviews').select('id, creative_id, reviewer_name, client_name, rating, body, comment, flag_reason, flagged_at, created_at').eq('flagged', true).eq('flag_status', 'pending').order('flagged_at', { ascending: false })
        const ids = [...new Set((data || []).map(r => r.creative_id).filter(Boolean))]
        const { data: ps } = ids.length ? await sb.from('profiles').select('id, business_name').in('id', ids) : { data: [] }
        const names = Object.fromEntries((ps || []).map(p => [p.id, p.business_name]))
        return ok({ reviews: (data || []).map(r => ({ ...r, business_name: names[r.creative_id] || null })) })
      }
      case 'review_decide': {
        const id = String(body.id || ''), keep = body.keep === true
        const patch = keep ? { flag_status: 'resolved_kept', flagged: false } : { flag_status: 'resolved_removed', hidden: true, flagged: false }
        const { error } = await sb.from('reviews').update(patch).eq('id', id)
        if (error) return bad('Could not update that review.')
        await audit(keep ? 'review.kept' : 'review.removed', id)
        return ok({ ok: true })
      }

      // ---- founding --------------------------------------------------------------------------
      case 'founding': {
        const payload = body.payload || {}
        const act = String(payload.action || '')
        if (!['list', 'preview', 'create', 'application', 'send', 'cancel', 'end_deal', 'extend', 'update', 'delete'].includes(act)) return bad('Unknown founding action')
        const r = await callFn('founding-invites', payload)
        if (act !== 'list' && act !== 'preview' && r.status < 300) await audit('founding.' + act, String(payload.id || payload.application_id || '') || null, act === 'create' ? { count: (payload.invites || []).length, send: !!payload.send } : null)
        return json(req, r.d, r.status)
      }
      case 'founding_status': {
        const { data: rows } = await sb.rpc('hq_founding_status')
        const { data: fb } = await sb.from('founding_feedback').select('id, creative_id, category, message, created_at').order('created_at', { ascending: false }).limit(100)
        return ok({ founders: rows || [], feedback: fb || [] })
      }

      // ---- broadcasts -------------------------------------------------------------------------
      case 'broadcasts': {
        const payload = body.payload || {}
        const act = String(payload.action || '')
        if (!['count', 'preview', 'list', 'end', 'send'].includes(act)) return bad('Unknown broadcast action')
        const r = await callFn('broadcasts', payload)
        if ((act === 'send' || act === 'end') && r.status < 300) await audit('broadcast.' + act, r.d?.broadcast?.id || String(payload.id || '') || null, act === 'send' ? { title: payload.title, audience: payload.audience, email: !!payload.send_email } : null)
        return json(req, r.d, r.status)
      }

      // ---- site settings -----------------------------------------------------------------------
      case 'settings': {
        const { data } = await sb.from('site_settings').select('key, value, updated_at').in('key', SETTINGS)
        return ok({ settings: data || [] })
      }
      case 'settings_set': {
        const key = String(body.key || '')
        let value: unknown = body.value
        if (key === 'home_hero') { if (!['ask', 'job'].includes(String(value))) return bad('Pick ask or job.') }
        else if (key === 'jobs_open_until') { const d = new Date(String(value)); if (isNaN(d.getTime())) return bad('Pick a date.'); value = String(value) }
        else return bad('Unknown setting')
        const { data: before } = await sb.from('site_settings').select('value').eq('key', key).maybeSingle()
        const { error } = await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() })
        if (error) throw error
        await audit('settings.changed', key, { from: before?.value ?? null, to: value })
        return ok({ ok: true })
      }

      case 'audit': {
        const { data } = await sb.from('hq_audit').select('*').order('at', { ascending: false }).limit(400)
        return ok({ entries: data || [] })
      }

      // ---- staff (owner only) ----------------------------------------------------------------
      case 'staff': {
        const { data: staff } = await sb.from('hq_staff').select('user_id, email, name, role, active, created_at, last_seen_at').order('created_at')
        const { data: invites } = await sb.from('hq_invites').select('id, email, name, role, expires_at, created_at').is('used_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
        const withMfa = []
        for (const s of staff || []) {
          const { data: f } = await sb.auth.admin.mfa.listFactors({ userId: s.user_id })
          withMfa.push({ ...s, two_factor: (f?.factors || []).some((x: any) => x.status === 'verified') })
        }
        return ok({ staff: withMfa, invites: invites || [] })
      }
      case 'staff_invite': {
        const email = clean(body.email, 254).toLowerCase(), name = clean(body.name, 80), role = String(body.role || '')
        if (!name) return bad('Add their name.')
        if (!isEmail(email)) return bad("That email address isn't valid.")
        if (!['admin', 'support'].includes(role)) return bad('Pick a role.')
        const { data: already } = await sb.from('hq_staff').select('user_id').eq('email', email).maybeSingle()
        if (already) return bad('They already have an HQ login.')
        const { data: taken } = await sb.rpc('hq_email_taken', { p_email: email })
        if (taken === true) return bad('That address already has a LensTrybe login (a creative or client account). Staff need an address of their own.', 409)
        const tok = randomToken()
        const { data: inv, error } = await sb.from('hq_invites').insert({ email, name, role, token_hash: await sha256(tok), expires_at: new Date(Date.now() + 48 * 3600e3).toISOString(), created_by: me.user_id }).select('id, email, name, role, expires_at, created_at').single()
        if (error) throw error
        const err = await sendMail(email, 'Your LensTrybe HQ invite', mail(`${name.split(' ')[0]}, you're invited to LensTrybe HQ`, [
          `${esc(me.name)} has set up a LensTrybe HQ login for you, as ${role === 'admin' ? 'an admin' : 'support'}. HQ is where the LensTrybe team runs the platform.`,
          "Choose your password from the link below, then set up two-factor with an authenticator app (Google Authenticator, 1Password, Authy or similar). Have it ready on your phone.",
          'The link works once, only for this email address, and expires in 48 hours.',
        ], { label: 'Set up my HQ login', url: `${HQ_URL}/invite#t=${encodeURIComponent(tok)}` }))
        await audit('staff.invited', inv.id, { email, role, emailed: !err })
        if (err) return bad('The invite was made but the email did not send: ' + err, 502)
        return ok({ invite: inv })
      }
      case 'staff_invite_revoke': {
        const { data, error } = await sb.from('hq_invites').update({ revoked_at: new Date().toISOString() }).eq('id', String(body.id || '')).is('used_at', null).select('email').maybeSingle()
        if (error || !data) return bad('Could not cancel that invite.')
        await audit('staff.invite_cancelled', String(body.id), { email: data.email })
        return ok({ ok: true })
      }
      case 'staff_active': {
        const id = String(body.id || '')
        if (id === me.user_id) return bad("You can't switch off your own login.")
        const { data, error } = await sb.from('hq_staff').update({ active: body.active === true }).eq('user_id', id).select('email, role').maybeSingle()
        if (error || !data) return bad(error?.message?.includes('owner') ? 'The owner login cannot be switched off.' : 'Could not change that login.')
        await audit(body.active === true ? 'staff.reactivated' : 'staff.deactivated', id, { email: data.email })
        return ok({ ok: true })
      }
      case 'staff_reset_2fa': {
        const id = String(body.id || '')
        if (id === me.user_id) return bad("You can't reset your own two-factor from here.")
        const { data: st } = await sb.from('hq_staff').select('email, role').eq('user_id', id).maybeSingle()
        if (!st || st.role === 'owner') return bad('Not allowed.')
        const { data: f } = await sb.auth.admin.mfa.listFactors({ userId: id })
        for (const x of f?.factors || []) await sb.auth.admin.mfa.deleteFactor({ id: x.id, userId: id })
        await audit('staff.two_factor_reset', id, { email: st.email })
        return ok({ ok: true })
      }
    }
    return bad('Unknown action')
  } catch (e) {
    console.error('hq-api', action, e instanceof Error ? e.message : String(e))
    return bad('Something went wrong. Try again.', 500)
  }
})

