// Supabase Edge Function: broadcasts
//
// Admin broadcast messages (JWT of a profile with is_admin = true).
//   count   {audience}                      how many people it reaches, and how many get email
//   send    {title, body, audience, style, cta_label, cta_url, send_email, ends_at}
//                                           save it, put it in everyone's bell, email if asked
//   list                                    recent broadcasts with reach and dismissals
//   end     {id}                            stop showing it now (stays in bells)
//   preview {title, body, cta_label, cta_url}  the email HTML
//
// In-app display is done by the app (BroadcastHost) through my_broadcasts(), get_broadcast()
// and dismiss_broadcast(). Email only goes to people subscribed to LensTrybe emails, with the
// unsubscribe link and one-click headers (Spam Act rules in the email-marketing-consent doc).
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const GREEN = '#1DB954'
const PINK = '#FF2D78'
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const REPLY_TO = 'connect@lenstrybe.com'
const SITE = 'https://lenstrybe.com'
const FN_BASE = 'https://lqafxisymvrazipaozfk.supabase.co/functions/v1'
const AUDIENCES = ['all', 'creatives', 'clients', 'basic', 'pro', 'expert', 'elite', 'founding']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function oneLine(s: unknown, max: number) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function multiLine(s: unknown, max: number) {
  return String(s ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
}

function cleanUrl(s: unknown) {
  const u = String(s ?? '').trim()
  if (!u) return null
  if (u.startsWith('/') && !u.startsWith('//')) return u.slice(0, 500)
  if (/^https:\/\/[^\s]+$/i.test(u)) return u.slice(0, 500)
  return undefined // invalid
}

function absoluteUrl(u: string) {
  return u.startsWith('/') ? SITE + u : u
}

function emailHtml(title: string, body: string, ctaLabel: string | null, ctaUrl: string | null, unsubUrl: string) {
  const paras = body.split(/\n\n+/).map((p) =>
    `<p style="margin:0 0 14px;color:#c9c9d4;font-size:15px;line-height:1.65;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  const cta = ctaLabel && ctaUrl
    ? `<tr><td style="padding:6px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${GREEN};"><a href="${esc(absoluteUrl(ctaUrl))}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">${esc(ctaLabel)}</a></td></tr></table></td></tr>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0a0a0f;font-family:Inter,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
<tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${GREEN};">LensTrybe</div></td></tr>
<tr><td style="padding:22px 36px 4px;">
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${PINK};margin-bottom:10px;">From the LensTrybe team</div>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:800;color:#fff;">${esc(title)}</h1>
${paras}
</td></tr>
${cta}
<tr><td style="padding:26px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:12px;line-height:1.6;color:#6a6a78;">You're getting this because you signed up for LensTrybe emails. <a href="${esc(unsubUrl)}" style="color:#9a9aa8;">Unsubscribe</a>. Questions? Just reply to this email.<br>Connect. Capture. Create.</div></td></tr>
</table></td></tr></table></body></html>`
}

async function sendBatch(emails: Record<string, unknown>[]) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return 'Email is not configured'
  try {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emails),
    })
    if (res.ok) return null
    return `Email failed (${res.status}) ${(await res.text().catch(() => '')).slice(0, 200)}`.trim()
  } catch (e) {
    return `Email failed: ${e instanceof Error ? e.message : String(e)}`
  }
}

async function reach(sb: SupabaseClient, audience: string) {
  const { data, error } = await sb.rpc('broadcast_recipients', { p_audience: audience })
  if (error) throw new Error(error.message)
  return (data ?? []) as { user_id: string; email: string; name: string; kind: string; unsubscribe_token: string | null }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

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
    if (action === 'count') {
      const audience = String(body.audience || '')
      if (!AUDIENCES.includes(audience)) return json({ error: 'Pick an audience.' }, 400)
      const people = await reach(sb, audience)
      return json({
        recipients: people.length,
        creatives: people.filter((p) => p.kind === 'creative').length,
        clients: people.filter((p) => p.kind === 'client').length,
        subscribed: people.filter((p) => p.unsubscribe_token && p.email).length,
      })
    }

    if (action === 'preview') {
      const title = oneLine(body.title, 120) || 'Your title'
      const text = multiLine(body.body, 2000) || 'Your message.'
      const url = cleanUrl(body.cta_url) || null
      const label = oneLine(body.cta_label, 40) || null
      return json({ subject: title, html: emailHtml(title, text, label, url, `${SITE}/unsubscribe`) })
    }

    if (action === 'list') {
      const { data: rows } = await sb.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(30)
      const ids = (rows ?? []).map((r) => r.id)
      const dismissed: Record<string, number> = {}
      if (ids.length) {
        const { data: ds } = await sb.from('broadcast_dismissals').select('broadcast_id').in('broadcast_id', ids)
        for (const d of ds ?? []) dismissed[d.broadcast_id] = (dismissed[d.broadcast_id] || 0) + 1
      }
      return json({ broadcasts: (rows ?? []).map((r) => ({ ...r, dismissed: dismissed[r.id] || 0 })) })
    }

    if (action === 'end') {
      const id = String(body.id || '')
      const { data, error } = await sb.from('broadcasts').update({ ends_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle()
      if (error || !data) return json({ error: 'Could not end that broadcast.' }, 400)
      return json({ broadcast: data })
    }

    if (action === 'send') {
      const title = oneLine(body.title, 120)
      const text = multiLine(body.body, 2000)
      const audience = String(body.audience || '')
      const style = body.style === 'card' ? 'card' : 'banner'
      const ctaLabel = oneLine(body.cta_label, 40) || null
      const ctaUrl = cleanUrl(body.cta_url)
      if (!title) return json({ error: 'Add a title.' }, 400)
      if (!text) return json({ error: 'Add a message.' }, 400)
      if (!AUDIENCES.includes(audience)) return json({ error: 'Pick an audience.' }, 400)
      if (ctaUrl === undefined) return json({ error: 'The button link must start with / (a LensTrybe page) or https://.' }, 400)
      if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) return json({ error: 'Add both a button label and a link, or leave both empty.' }, 400)
      let endsAt: string | null = null
      if (body.ends_at) {
        const d = new Date(String(body.ends_at))
        if (isNaN(d.getTime()) || d.getTime() <= Date.now()) return json({ error: 'The end date must be in the future.' }, 400)
        endsAt = d.toISOString()
      }

      const people = await reach(sb, audience)
      if (people.length === 0) return json({ error: 'Nobody is in that audience yet.' }, 400)

      const { data: b, error: insErr } = await sb.from('broadcasts').insert({
        title, body: text, audience, style, cta_label: ctaLabel, cta_url: ctaUrl,
        send_email: body.send_email === true, ends_at: endsAt, created_by: me.id,
      }).select('*').single()
      if (insErr || !b) { console.error('broadcasts insert', insErr?.message); return json({ error: 'Could not save the broadcast.' }, 500) }

      const { data: fanned, error: fanErr } = await sb.rpc('broadcast_fanout', { p_id: b.id })
      if (fanErr) console.error('broadcasts fanout', fanErr.message)

      let emailed = 0
      let emailError: string | null = null
      if (body.send_email === true) {
        const list = people.filter((p) => p.unsubscribe_token && p.email)
        for (let i = 0; i < list.length; i += 100) {
          const chunk = list.slice(i, i + 100).map((p) => {
            const unsub = `${SITE}/unsubscribe/${p.unsubscribe_token}`
            return {
              from: FROM, to: [p.email], reply_to: REPLY_TO, subject: title,
              html: emailHtml(title, text, ctaLabel, ctaUrl, unsub),
              headers: {
                'List-Unsubscribe': `<${unsub}>, <${FN_BASE}/email-preferences?token=${p.unsubscribe_token}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          })
          const err = await sendBatch(chunk)
          if (err) { emailError = err; break }
          emailed += chunk.length
        }
      }

      const { data: saved } = await sb.from('broadcasts')
        .update({ emailed, email_error: emailError })
        .eq('id', b.id).select('*').single()
      return json({ broadcast: { ...(saved || b), recipients: Number(fanned ?? people.length), dismissed: 0 }, emailError })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('broadcasts error', e instanceof Error ? e.message : String(e))
    return json({ error: 'Something went wrong' }, 500)
  }
})
