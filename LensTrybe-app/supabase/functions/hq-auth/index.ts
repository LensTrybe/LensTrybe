// hq-auth: the only parts of LensTrybe HQ that work before someone is signed in.
//
//   invite_check  {token}            is this invite link good? -> {email, name, role}
//   invite_accept {token, password}  make the staff login for the invited address (and only
//                                    that address), with the password they chose
//   forgot        {email}            email a password reset link, if the address is active
//                                    staff. The same answer either way, so it can't be used to
//                                    find out who works here.
//
// There is no sign up. A staff login exists only because an owner invited that address.
// Invite links are single use, expire after 48 hours and are stored hashed. Everything is
// rate limited. verify_jwt is off because nobody is signed in yet.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { HQ_URL, json, cors, clean, isEmail, ipOf, sha256, mail, sendMail, esc } from './shared.ts'

const MIN_PASSWORD = 12

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Not found' }, 404)
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* empty */ }
  const action = String(body.action || '')
  const ip = ipOf(req) || 'unknown'

  const limited = async (key: string, max: number, secs: number) => {
    const { data } = await sb.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: secs })
    return data === false
  }
  const audit = (action: string, email: string | null, detail: unknown, staffId: string | null = null) =>
    sb.from('hq_audit').insert({ staff_id: staffId, staff_email: email, action, detail, ip })

  const findInvite = async (token: string) => {
    if (!token || token.length < 20 || token.length > 100) return null
    const { data } = await sb.from('hq_invites').select('*').eq('token_hash', await sha256(token)).maybeSingle()
    if (!data || data.used_at || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) return null
    return data
  }

  try {
    if (action === 'invite_check' || action === 'invite_accept') {
      if (await limited('hq-invite:' + ip, 20, 3600)) return json(req, { error: 'Too many tries. Wait an hour and try again.' }, 429)
      const inv = await findInvite(String(body.token || ''))
      if (!inv) return json(req, { error: 'This invite link has expired or has already been used. Ask for a new one.' }, 404)
      if (action === 'invite_check') return json(req, { email: inv.email, name: inv.name, role: inv.role })

      const password = String(body.password || '')
      if (password.length < MIN_PASSWORD) return json(req, { error: `Use at least ${MIN_PASSWORD} characters.` }, 400)
      if (password.length > 200) return json(req, { error: 'That password is too long.' }, 400)
      if (password.toLowerCase().includes(inv.email.split('@')[0].toLowerCase())) return json(req, { error: "Don't use your email address in your password." }, 400)
      if (inv.role === 'owner') {
        const { data: owner } = await sb.from('hq_staff').select('user_id').eq('role', 'owner').maybeSingle()
        if (owner) return json(req, { error: 'This invite is no longer valid.' }, 409)
      }

      // Claim the invite first, so the same link can't make two logins at once.
      const { data: claimed } = await sb.from('hq_invites').update({ used_at: new Date().toISOString() }).eq('id', inv.id).is('used_at', null).select('id').maybeSingle()
      if (!claimed) return json(req, { error: 'This invite link has already been used.' }, 409)

      const { data: made, error: mkErr } = await sb.auth.admin.createUser({
        email: inv.email, password, email_confirm: true,
        app_metadata: { hq_staff: true }, user_metadata: { name: inv.name },
      })
      if (mkErr || !made?.user) {
        await sb.from('hq_invites').update({ used_at: null }).eq('id', inv.id)
        const taken = /already|registered|exists/i.test(mkErr?.message || '')
        return json(req, { error: taken ? 'That email already has a LensTrybe login. Staff need an address of their own, so ask for an invite to a different email.' : 'Could not set up the login. Try again.' }, taken ? 409 : 500)
      }
      const { error: stErr } = await sb.from('hq_staff').insert({ user_id: made.user.id, email: inv.email.toLowerCase(), name: inv.name, role: inv.role, invited_by: inv.created_by })
      if (stErr) {
        await sb.auth.admin.deleteUser(made.user.id)
        await sb.from('hq_invites').update({ used_at: null }).eq('id', inv.id)
        console.error('hq-auth staff insert', stErr.message)
        return json(req, { error: 'Could not set up the login. Try again.' }, 500)
      }
      await audit('staff.joined', inv.email, { role: inv.role }, made.user.id)
      return json(req, { ok: true, email: inv.email })
    }

    if (action === 'forgot') {
      const email = clean(body.email, 254).toLowerCase()
      const same = { ok: true, message: 'If that address is an HQ login, a reset link is on its way. It works for one hour.' }
      if (!isEmail(email)) return json(req, same)
      if (await limited('hq-forgot:' + ip, 5, 3600) || await limited('hq-forgot:' + email, 3, 3600)) return json(req, same)
      const { data: st } = await sb.from('hq_staff').select('user_id, name, active').eq('email', email).maybeSingle()
      if (!st?.active) return json(req, same)
      const { data: link, error } = await sb.auth.admin.generateLink({ type: 'recovery', email })
      const hashed = link?.properties?.hashed_token
      if (error || !hashed) { console.error('hq-auth forgot', error?.message); return json(req, same) }
      const url = `${HQ_URL}/reset#t=${encodeURIComponent(hashed)}`
      await sendMail(email, 'Reset your LensTrybe HQ password', mail('Reset your HQ password', [
        `Hi ${esc(String(st.name).split(' ')[0])}, someone asked to reset the password for your LensTrybe HQ login.`,
        "The link works once, for one hour. You'll still need the code from your authenticator app.",
        "If it wasn't you, ignore this email and tell Michael.",
      ], { label: 'Choose a new password', url }))
      await audit('staff.reset_requested', email, null, st.user_id)
      return json(req, same)
    }

    return json(req, { error: 'Not found' }, 404)
  } catch (e) {
    console.error('hq-auth', e instanceof Error ? e.message : String(e))
    return json(req, { error: 'Something went wrong. Try again.' }, 500)
  }
})
