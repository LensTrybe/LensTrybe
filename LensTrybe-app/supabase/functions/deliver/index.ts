import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const DELIVER_BUCKET = 'deliveries'
// Long enough for a client to browse and download a large gallery in one sitting,
// short enough that a forwarded link stops working. The bucket itself is private, so
// this signature is the only way in.
const SIGNED_TTL_SECONDS = 6 * 60 * 60

/**
 * Mint signed URLs for the gallery. Files are stored with a `path` and no URL: the
 * bucket is private, so the only way a client can see a file is a signature we issue
 * here, on this request. That is what makes expiry, the password and deleting a
 * gallery actually revoke access rather than just hide the page.
 */
async function publicDelivery(admin, d, includeFiles) {
  const files = Array.isArray(d.files) ? d.files : []
  let signedFiles = []
  let coverUrl = null

  const wanted = []
  if (includeFiles) for (const f of files) if (f?.path) wanted.push(f.path)
  if (d.cover_url) wanted.push(d.cover_url)

  const signed = {}
  if (wanted.length) {
    const { data } = await admin.storage
      .from(DELIVER_BUCKET)
      .createSignedUrls([...new Set(wanted)], SIGNED_TTL_SECONDS)
    if (Array.isArray(data)) {
      for (const row of data) if (row?.path && row?.signedUrl) signed[row.path] = row.signedUrl
    }
  }

  if (includeFiles) {
    // `path` stays in the payload: the client sends it back as its favourites selection.
    signedFiles = files.map((f) => ({
      name: f?.name ?? '',
      path: f?.path ?? null,
      type: f?.type ?? null,
      size: f?.size ?? null,
      url: f?.path ? (signed[f.path] ?? null) : null,
    }))
  }
  if (d.cover_url) coverUrl = signed[d.cover_url] ?? null

  return {
    id: d.id,
    title: d.title,
    client_name: d.client_name,
    message: d.message,
    expires_at: d.expires_at,
    created_at: d.created_at,
    cover_url: coverUrl,
    download_token: d.download_token,
    files: signedFiles,
    file_count: files.length,
    favourites: includeFiles ? (d.favourites ?? []) : [],
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function plain(s, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }

// ---- LensTrybe shared email template (inlined) ----
// The same shell as every other send-* function. Inlined rather than imported because
// Edge Functions are deployed one directory at a time and cannot share a local module.
// If you change the shell here, change it in the others. The favourites email used to
// have its own hand rolled layout, which is why it looked like a different product.
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
function panel(innerHtml) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function fieldRow(label, valueHtml) { return `<div style="margin:0 0 12px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.faint};margin-bottom:3px;">${esc(label)}</div><div style="font-size:14px;color:${BRAND.text};line-height:1.55;">${valueHtml}</div></div>` }
function emailShell(opts) {
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
// ---- end shared ----

const UNLOCK_MAX = 10
const UNLOCK_WINDOW_SECONDS = 15 * 60

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    )

    let body = {}
    try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
    const { action, token, password, file_name, favourites } = body ?? {}
    if (!token || typeof token !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return json({ error: 'not_found' }, 404)

    const { data: delivery, error } = await admin
      .from('deliveries')
      .select('*')
      .eq('download_token', token)
      .maybeSingle()

    if (error || !delivery) return json({ error: 'not_found' }, 404)

    // Resolve the owning creative for branding + notifications. The delivery's
    // creative_id is the owner regardless of admin status, so no is_admin filter.
    let creative = null
    if (delivery.creative_id) {
      const { data: prof } = await admin
        .from('profiles')
        .select('business_name, avatar_url, business_email')
        .eq('id', delivery.creative_id)
        .maybeSingle()
      creative = prof ?? null
    }

    const expired = delivery.expires_at && new Date(delivery.expires_at).getTime() < Date.now()
    const locked = Boolean(delivery.password)
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 300) || null
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
    const unlockKey = 'deliver-unlock:' + delivery.id + ':' + ip

    // Is this delivery+IP currently locked out after too many wrong passwords? (read only, no hit)
    async function unlockBlocked() {
      try {
        const { data } = await admin.from('rate_limits').select('hits, window_start').eq('key', unlockKey).maybeSingle()
        if (!data) return false
        const fresh = new Date(data.window_start).getTime() > Date.now() - UNLOCK_WINDOW_SECONDS * 1000
        return fresh && Number(data.hits) >= UNLOCK_MAX
      } catch (_e) { return false }
    }
    async function recordFailedUnlock() {
      try { await admin.rpc('rate_limit_hit', { p_key: unlockKey, p_max: UNLOCK_MAX, p_window_seconds: UNLOCK_WINDOW_SECONDS }) } catch (_e) { /* ignore */ }
    }
    // Password check shared by every action on a locked gallery. Returns an error response or null.
    async function checkPassword() {
      if (!locked) return null
      if (await unlockBlocked()) return json({ ok: false, error: 'too_many_attempts' }, 429)
      if (typeof password !== 'string' || password.length > 200 || password !== String(delivery.password)) {
        await recordFailedUnlock()
        return json({ ok: false, error: 'wrong_password' }, 403)
      }
      return null
    }

    async function logOpen() {
      const now = new Date().toISOString()
      await admin.from('delivery_events').insert({
        delivery_id: delivery.id,
        event_type: 'open',
        user_agent: ua,
      })
      const patch = { last_opened_at: now }
      if (!delivery.opened_at) patch.opened_at = now
      await admin.from('deliveries').update(patch).eq('id', delivery.id)
    }

    if (action === 'load') {
      if (locked) {
        return json({
          expired: Boolean(expired),
          locked: true,
          creative,
          delivery: await publicDelivery(admin, delivery, false),
        })
      }
      if (!expired) await logOpen()
      return json({
        expired: Boolean(expired),
        locked: false,
        creative,
        delivery: await publicDelivery(admin, delivery, !expired),
      })
    }

    if (action === 'unlock') {
      if (!locked) {
        return json({ ok: true, expired: Boolean(expired), delivery: await publicDelivery(admin, delivery, !expired), creative })
      }
      if (await unlockBlocked()) return json({ ok: false, error: 'too_many_attempts' })
      if (typeof password !== 'string' || password.length > 200 || password !== String(delivery.password)) {
        await recordFailedUnlock()
        return json({ ok: false, error: 'wrong_password' })
      }
      if (!expired) await logOpen()
      return json({ ok: true, expired: Boolean(expired), delivery: await publicDelivery(admin, delivery, !expired), creative })
    }

    if (action === 'track') {
      const denied = await checkPassword()
      if (denied) return denied
      if (expired) return json({ ok: false, error: 'expired' }, 410)
      const now = new Date().toISOString()
      await admin.from('delivery_events').insert({
        delivery_id: delivery.id,
        event_type: 'download',
        file_name: typeof file_name === 'string' ? file_name.slice(0, 300) : null,
        user_agent: ua,
      })
      await admin
        .from('deliveries')
        .update({ download_count: (delivery.download_count ?? 0) + 1, downloaded_at: now })
        .eq('id', delivery.id)
      return json({ ok: true })
    }

    if (action === 'favourites') {
      const denied = await checkPassword()
      if (denied) return denied
      if (expired) return json({ ok: false, error: 'expired' }, 410)
      // Only accept favourites that are files in this gallery. Matched on storage path:
      // the bucket is private now, so a signed URL is temporary and can never be an id.
      const filePaths = new Set((Array.isArray(delivery.files) ? delivery.files : []).map((f) => f && typeof f.path === 'string' ? f.path : null).filter(Boolean))
      const list = Array.isArray(favourites) ? [...new Set(favourites.filter((x) => typeof x === 'string' && filePaths.has(x)))].slice(0, 2000) : []
      const now = new Date().toISOString()
      await admin
        .from('deliveries')
        .update({ favourites: list, favourites_submitted_at: now })
        .eq('id', delivery.id)
      await admin.from('delivery_events').insert({
        delivery_id: delivery.id,
        event_type: 'favourites',
        user_agent: ua,
      })

      // Throttle creative notifications: at most one per delivery every 10 minutes.
      let notify = true
      try {
        const { data: okToNotify, error: rlErr } = await admin.rpc('rate_limit_hit', { p_key: 'deliver-fav-notify:' + delivery.id, p_max: 1, p_window_seconds: 600 })
        if (!rlErr && okToNotify === false) notify = false
      } catch (_e) { /* ignore */ }
      if (!notify) return json({ ok: true, count: list.length })

      // In-app notification for the creative (best effort).
      try {
        await admin.from('notifications').insert({
          user_id: delivery.creative_id,
          type: 'delivery_favourites',
          title: `${delivery.client_name ?? 'Your client'} sent their favourites`,
          body: `${list.length} favourite${list.length === 1 ? '' : 's'} selected from "${delivery.title ?? 'your gallery'}"`,
          link: '/dashboard/portfolio-design/deliver',
          meta: { delivery_id: delivery.id, count: list.length },
        })
      } catch (_e) { /* notifications table may not exist yet; non-blocking */ }

      // Email the creative. Fall back to the auth-user email when no business_email is set.
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      let to = creative?.business_email ?? null
      if (!to && delivery.creative_id) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(delivery.creative_id)
          to = u?.user?.email ?? null
        } catch (_e) { /* ignore */ }
      }
      if (RESEND_API_KEY && to) {
        const dashUrl = 'https://lenstrybe.com/dashboard/portfolio-design/deliver'
        const count = `${list.length} favourite${list.length === 1 ? '' : 's'}`
        const html = emailShell({
          preheader: `${plain(delivery.client_name || 'Your client', 100)} picked ${count}.`,
          kicker: 'Client favourites',
          heading: 'Your client sent their favourites',
          intro: `<strong style="color:${BRAND.text};">${esc(delivery.client_name ?? 'Your client')}</strong> picked <strong style="color:${BRAND.green};">${esc(count)}</strong> from <strong style="color:${BRAND.text};">${esc(delivery.title ?? 'your gallery')}</strong>.`,
          panelHtml: panel(
            fieldRow('Gallery', esc(delivery.title ?? 'Your gallery'))
            + fieldRow('Client', esc(delivery.client_name ?? 'Your client'))
            + fieldRow('Picked', esc(count)),
          ),
          ctaText: 'View their picks',
          ctaUrl: dashUrl,
          footNote: 'Their picks are marked in the gallery, so you know exactly what to edit or print.',
        })
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'LensTrybe <noreply@mail.lenstrybe.com>',
              to: [to],
              reply_to: 'connect@lenstrybe.com',
              subject: `${plain(delivery.client_name || 'Your client', 100)} sent their favourites`,
              html,
            }),
          })
        } catch (_e) { /* non-blocking */ }
      }

      return json({ ok: true, count: list.length })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (err) {
    console.error('deliver failed', err)
    return json({ error: 'server_error' }, 500)
  }
})
