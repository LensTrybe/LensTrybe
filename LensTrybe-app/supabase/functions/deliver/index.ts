import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Delivery row without the password field, safe to send to the anonymous client.
function publicDelivery(d: Record<string, unknown>, includeFiles: boolean) {
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
    favourites: d.favourites ?? [],
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { action, token, password, file_name, favourites } = await req.json()
    if (!token) return json({ error: 'missing_token' }, 400)

    const { data: delivery, error } = await admin
      .from('deliveries')
      .select('*')
      .eq('download_token', token)
      .maybeSingle()

    if (error || !delivery) return json({ error: 'not_found' }, 404)

    // Creative profile for gallery branding
    let creative: Record<string, unknown> | null = null
    if (delivery.creative_id) {
      const { data: prof } = await admin
        .from('profiles')
        .select('business_name, avatar_url, business_email, full_name')
        .eq('id', delivery.creative_id)
        .eq('is_admin', false)
        .maybeSingle()
      creative = prof ?? null
    }

    const expired = delivery.expires_at && new Date(delivery.expires_at).getTime() < Date.now()
    const locked = Boolean(delivery.password)
    const ua = req.headers.get('user-agent') ?? null

    async function logOpen() {
      const now = new Date().toISOString()
      await admin.from('delivery_events').insert({
        delivery_id: delivery.id,
        event_type: 'open',
        user_agent: ua,
      })
      const patch: Record<string, unknown> = { last_opened_at: now }
      if (!delivery.opened_at) patch.opened_at = now
      await admin.from('deliveries').update(patch).eq('id', delivery.id)
    }

    if (action === 'load') {
      // Locked galleries return only branding + metadata (no files) until unlocked.
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
        return json({ ok: true, delivery: publicDelivery(delivery, true), creative })
      }
      if (String(password ?? '') !== String(delivery.password)) {
        return json({ ok: false, error: 'wrong_password' })
      }
      if (!expired) await logOpen()
      return json({ ok: true, expired: Boolean(expired), delivery: publicDelivery(delivery, !expired), creative })
    }

    if (action === 'track') {
      // Only 'download' is tracked from the client here; opens are logged on load/unlock.
      const now = new Date().toISOString()
      await admin.from('delivery_events').insert({
        delivery_id: delivery.id,
        event_type: 'download',
        file_name: file_name ?? null,
        user_agent: ua,
      })
      await admin
        .from('deliveries')
        .update({ download_count: (delivery.download_count ?? 0) + 1, downloaded_at: now })
        .eq('id', delivery.id)
      return json({ ok: true })
    }

    if (action === 'favourites') {
      const list = Array.isArray(favourites) ? favourites.filter((x) => typeof x === 'string').slice(0, 2000) : []
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

      // Notify the creative that the client sent their picks.
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      const to = creative?.business_email
      if (RESEND_API_KEY && to) {
        const name = (creative?.business_name || creative?.full_name || 'there') as string
        const dashUrl = 'https://lenstrybe.com/dashboard/portfolio-design/deliver'
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#080810;color:#fff;padding:40px 32px;border-radius:12px">
            <div style="margin-bottom:24px"><span style="font-size:22px;font-weight:700;color:#1DB954">LensTrybe</span></div>
            <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 8px">Your client sent their favourites</h2>
            <p style="color:#888;font-size:14px;margin:0 0 24px">
              <strong style="color:#fff">${delivery.client_name ?? 'Your client'}</strong> selected
              <strong style="color:#1DB954">${list.length}</strong> favourite${list.length === 1 ? '' : 's'} from
              <strong style="color:#fff">${delivery.title ?? 'your gallery'}</strong>.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${dashUrl}" style="display:inline-block;background:#1DB954;color:#04120a;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">
                View their picks
              </a>
            </div>
            <p style="color:#555;font-size:12px;margin-top:32px">Sent via LensTrybe · <a href="https://lenstrybe.com" style="color:#1DB954">lenstrybe.com</a></p>
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
              subject: `${delivery.client_name ?? 'Your client'} sent their favourites`,
              html,
            }),
          })
        } catch (_e) { /* non-blocking */ }
      }

      return json({ ok: true, count: list.length })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
