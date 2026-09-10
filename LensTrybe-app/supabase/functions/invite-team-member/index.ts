import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function nl2br(s: unknown) { return esc(s).replace(/\n/g, '<br>') }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; panelHtml?: string; ctaText?: string; ctaUrl?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', panelHtml = '', ctaText, ctaUrl, footNote = '' } = opts
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
</table></td></tr></table></body></html>`
}
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// ---- end shared ----

const APP = 'https://lenstrybe.com'
const MAX_MEMBERS = 4
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }
const TEAM_TIERS = ['elite', 'vip']
function newToken() { const b = new Uint8Array(32); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('') }

// Invite someone to the signed-in Elite creative's team.
// Body: { email, role? } to create (or resend) an invitation, or { invitation_id } to resend one.
// The invitation row, its token and the accept link are created here with the service role;
// the browser can never read or set invitation tokens.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorised' }, 401)
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return json({ error: 'Unauthorised' }, 401)

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

    const { data: profile } = await admin.from('profiles').select('business_name, business_email, subscription_tier').eq('id', user.id).maybeSingle()
    if (!profile || !TEAM_TIERS.includes(String(profile.subscription_tier || '').toLowerCase())) {
      return json({ error: 'Team management is an Elite feature.' }, 403)
    }

    const { data: rlUser, error: rlErr } = await admin.rpc('rate_limit_hit', { p_key: `team-invite:user:${user.id}`, p_max: 20, p_window_seconds: 3600 })
    if (rlErr || rlUser === false) return json({ error: 'Too many invitations. Please try again later.' }, 429)

    const now = Date.now()
    // deno-lint-ignore no-explicit-any
    let invitation: any = null

    const invitationId = typeof body.invitation_id === 'string' ? body.invitation_id : ''
    if (invitationId) {
      if (!UUID_RE.test(invitationId)) return json({ error: 'Invalid invitation' }, 400)
      const { data } = await admin.from('team_invitations').select('id, creative_id, email, role, token, status, created_at')
        .eq('id', invitationId).eq('creative_id', user.id).maybeSingle()
      if (!data || data.status !== 'pending') return json({ error: 'Invitation not found' }, 404)
      invitation = data
    } else {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!email || email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400)
      if (email === String(user.email || '').toLowerCase()) return json({ error: "You can't invite yourself." }, 400)
      const role = plain(body.role || 'member', 40) || 'member'

      const { data: pending } = await admin.from('team_invitations').select('id, creative_id, email, role, token, status, created_at')
        .eq('creative_id', user.id).eq('email', email).eq('status', 'pending').limit(1).maybeSingle()
      if (pending) {
        invitation = pending
      } else {
        const { data: existingMember } = await admin.from('team_members').select('id').eq('creative_id', user.id).ilike('email', email.replace(/[\\%_]/g, (m) => `\\${m}`)).limit(1).maybeSingle()
        if (existingMember) return json({ error: 'That person is already on your team.' }, 409)

        // Seats: active members plus live pending invitations.
        const { count: memberCount } = await admin.from('team_members').select('id', { count: 'exact', head: true }).eq('creative_id', user.id)
        const { data: pendingRows } = await admin.from('team_invitations').select('created_at').eq('creative_id', user.id).eq('status', 'pending')
        const livePending = (pendingRows || []).filter((r: { created_at: string }) => now - new Date(r.created_at).getTime() < INVITE_TTL_MS).length
        if ((memberCount || 0) + livePending >= MAX_MEMBERS) return json({ error: `Your team is full (up to ${MAX_MEMBERS} members).` }, 409)

        const { data: created, error: insErr } = await admin.from('team_invitations')
          .insert({ creative_id: user.id, email, role, token: newToken(), status: 'pending' })
          .select('id, creative_id, email, role, token, status, created_at').single()
        if (insErr || !created) { console.error('invite insert failed', insErr); return json({ error: 'Could not create the invitation.' }, 500) }
        invitation = created
      }
    }

    const { data: rlEmail } = await admin.rpc('rate_limit_hit', { p_key: `team-invite:email:${String(invitation.email).toLowerCase()}`, p_max: 3, p_window_seconds: 3600 })
    if (rlEmail === false) return json({ error: 'An invitation was sent to this address recently. Please try again later.' }, 429)

    // Refresh an expired invitation's token and clock when resending.
    if (now - new Date(invitation.created_at).getTime() >= INVITE_TTL_MS || !invitation.token) {
      const { data: refreshed } = await admin.from('team_invitations')
        .update({ token: newToken(), created_at: new Date().toISOString() })
        .eq('id', invitation.id).eq('creative_id', user.id)
        .select('id, creative_id, email, role, token, status, created_at').single()
      if (refreshed) invitation = refreshed
    }

    const studioName = plain(profile.business_name || 'A creative studio', 80)
    const memberRole = plain(invitation.role || 'member', 40)
    const joinUrl = `${APP}/team/accept/${encodeURIComponent(String(invitation.token))}`

    const res = await sendEmail(resendKey, {
      to: invitation.email,
      replyTo: profile.business_email || user.email || undefined,
      subject: plain(`You've been invited to join ${studioName} on LensTrybe`, 150),
      html: emailShell({
        preheader: `${studioName} has invited you to their team on LensTrybe`,
        kicker: 'Team invitation',
        heading: "You've been invited!",
        intro: `<span style="color:${BRAND.text};">${esc(studioName)}</span> has invited you to join their team on LensTrybe as a <span style="color:${BRAND.text};">${esc(memberRole)}</span>.`,
        panelHtml: panel(
          `<div style="font-size:14px;color:${BRAND.text};line-height:1.7;"><strong>Studio:</strong> ${esc(studioName)}<br><strong>Role:</strong> ${esc(memberRole)}<br><strong>Email:</strong> ${esc(invitation.email)}</div>`
        ),
        ctaText: 'Accept invitation',
        ctaUrl: joinUrl,
        footNote: "This invitation expires in 14 days. If you weren't expecting it, you can safely ignore this email.",
      }),
    })
    if (!res.ok) {
      console.error('resend failed', res.status, await res.text().catch(() => ''))
      return json({ error: 'Could not send the invitation email.' }, 502)
    }
    return json({ success: true, invitation_id: invitation.id })
  } catch (err) {
    console.error('invite-team-member error', err)
    return json({ error: 'Could not send the invitation.' }, 500)
  }
})
