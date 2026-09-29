import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { deliveryEmail } from './emails.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/.test(s) }
function jsonRes(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
async function getAuthUser(admin: any, req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try { const { data, error } = await admin.auth.getUser(token); if (error || !data?.user) return null; return data.user } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405)

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Only the signed-in creative who owns the delivery can send it.
    const user = await getAuthUser(admin, req)
    if (!user) return jsonRes({ error: 'Not authenticated' }, 401)

    let body: any = {}
    try { body = await req.json() } catch { return jsonRes({ error: 'Invalid request' }, 400) }
    // Accept only an id. (Older clients sent the whole record; only its id is used.)
    const deliveryId = String(body?.delivery_id ?? body?.deliveryId ?? body?.delivery?.id ?? '')
    if (!UUID_RE.test(deliveryId)) return jsonRes({ error: 'delivery_id required' }, 400)

    const { data: delivery, error: loadErr } = await admin.from('deliveries').select('*').eq('id', deliveryId).maybeSingle()
    if (loadErr) console.error('send-delivery load failed', loadErr)
    if (!delivery || delivery.creative_id !== user.id) return jsonRes({ error: 'Delivery not found' }, 404)
    if (!isEmail(delivery.client_email)) return jsonRes({ error: 'Add a valid client email to this delivery before sending.' }, 400)
    if (!delivery.download_token) return jsonRes({ error: 'This delivery has no gallery link yet.' }, 400)

    const allowed = await admin.rpc('rate_limit_hit', { p_key: 'send-delivery:' + user.id, p_max: 60, p_window_seconds: 3600 })
    if (allowed.error) console.error('send-delivery rate limit check failed', allowed.error)
    else if (allowed.data === false) return jsonRes({ error: 'Too many deliveries sent recently. Please try again later.' }, 429)

    const { data: prof } = await admin.from('profiles').select('business_name, business_email').eq('id', user.id).maybeSingle()
    const profile: any = prof || {}

    const deliveryUrl = `https://lenstrybe.com/deliver/${encodeURIComponent(String(delivery.download_token))}`
    const message = delivery.message ?? delivery.notes ?? ''
    const isProtected = Boolean(delivery.password_protected || delivery.password)
    const fileCount = Array.isArray(delivery.files) ? delivery.files.length : null
    const email = deliveryEmail({
      business: profile.business_name || 'Your creative',
      subjectName: plain(profile.business_name || 'your creative', 120),
      title: delivery.title || 'your project',
      clientName: delivery.client_name || 'there',
      message,
      isProtected,
      fileCount,
      deliveryUrl,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LensTrybe <noreply@mail.lenstrybe.com>',
        to: [delivery.client_email],
        reply_to: isEmail(profile.business_email) ? profile.business_email : 'connect@lenstrybe.com',
        subject: email.subject,
        html: email.html,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Resend answers 429 when the account's daily sending quota is gone. Telling
      // someone to try again in that state is wrong advice, because it cannot succeed
      // until the quota resets. Name the real reason instead.
      if (res.status === 429 || /quota/i.test(JSON.stringify(data ?? ''))) {
        console.error('send-delivery resend DAILY QUOTA exhausted', res.status, data)
        return jsonRes({ error: 'Our email service has hit its daily sending limit, so this was not sent. That is a problem on our end, not with your delivery. Sending will work again once the limit resets.' }, 503)
      }
      console.error('send-delivery resend error', res.status, data)
      return jsonRes({ error: 'Could not send the delivery email. Please try again.' }, 502)
    }
    return jsonRes({ success: true, id: (data as any)?.id ?? null })
  } catch (err) {
    console.error('send-delivery failed', err)
    return jsonRes({ error: 'Could not send the delivery. Please try again.' }, 500)
  }
})
