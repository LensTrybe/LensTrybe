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

function publicDelivery(d, includeFiles) {
  return {
    id: d.id,
    title: d.title,
    client_name: d.client_name,
    message: d.message,
    expires_at: d.expires_at,
    created_at: d.created_at,
    cover_url: d.cover_url ?? null,
    download_token: d.download_token,
    files: includeFiles ? (d.files ?? []) : [],
    file_count: Array.isArray(d.files) ? d.files.length : 0,
    favourites: includeFiles ? (d.favourites ?? []) : [],
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function plain(s, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }

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
          delivery: publicDelivery(delivery, false),
        })
      }
      if (!expired) await logOpen()
      return json({
        expired: Boolean(expired),
        locked: false,
        creative,
        delivery: publicDelivery(delivery, !expired),
      })
    }

    if (action === 'unlock') {
      if (!locked) {
        return json({ ok: true, expired: Boolean(expired), delivery: publicDelivery(delivery, !expired), creative })
      }
      if (await unlockBlocked()) return json({ ok: false, error: 'too_many_attempts' })
      if (typeof password !== 'string' || password.length > 200 || password !== String(delivery.password)) {
        await recordFailedUnlock()
        return json({ ok: false, error: 'wrong_password' })
      }
      if (!expired) await logOpen()
      return json({ ok: true, expired: Boolean(expired), delivery: publicDelivery(delivery, !expired), creative })
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
      // Only accept favourites that are files in this gallery.
      const fileUrls = new Set((Array.isArray(delivery.files) ? delivery.files : []).map((f) => f && typeof f.url === 'string' ? f.url : null).filter(Boolean))
      const list = Array.isArray(favourites) ? [...new Set(favourites.filter((x) => typeof x === 'string' && fileUrls.has(x)))].slice(0, 2000) : []
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
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#080810;color:#fff;padding:40px 32px;border-radius:12px">
            <div style="margin-bottom:24px"><span style="font-size:22px;font-weight:700;color:#1DB954">LensTrybe</span></div>
            <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">Your client sent their favourites</h2>
            <p style="color:#888;font-size:14px;margin:0 0 24px">
              <strong style="color:#fff">${esc(delivery.client_name ?? 'Your client')}</strong> selected
              <strong style="color:#1DB954">${list.length}</strong> favourite${list.length === 1 ? '' : 's'} from
              <strong style="color:#fff">${esc(delivery.title ?? 'your gallery')}</strong>.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${dashUrl}" style="display:inline-block;background:#1DB954;color:#04120a;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
                View their picks
              </a>
            </div>
            <p style="color:#555;font-size:12px;margin-top:32px">Sent via LensTrybe &middot; <a href="https://lenstrybe.com" style="color:#1DB954">lenstrybe.com</a></p>
          </div>
        `
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
