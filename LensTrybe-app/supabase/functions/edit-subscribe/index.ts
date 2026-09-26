import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// The Trybe Edit sign-up from the public pages (Michael, 27 Sep: subscribing is done on the
// site only, and no emails are sent). The address joins the list straight away; the answer is
// the same whether or not it was already on the list.
//   { action: 'subscribe', email }  -> joins the list (source 'edit', edit_opt_in_at set)
//   { action: 'confirm', token }    -> still honours confirm links sent before the change
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DONE = { ok: true, message: "You're subscribed." }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
    const action = String(body.action || '')
    const now = new Date().toISOString()

    if (action === 'confirm') {
      const token = String(body.token || '')
      if (!UUID_RE.test(token)) return json({ error: 'That link has expired. Subscribe again and we will send a new one.' }, 400)
      const { data: row } = await admin.from('email_subscribers').select('id, edit_confirm_sent_at').eq('edit_confirm_token', token).maybeSingle()
      const fresh = row?.edit_confirm_sent_at && Date.now() - new Date(row.edit_confirm_sent_at).getTime() < 7 * 86400000
      if (!row || !fresh) return json({ error: 'That link has expired. Subscribe again and we will send a new one.' }, 400)
      const { error } = await admin.from('email_subscribers').update({ status: 'subscribed', source: 'edit', consented_at: now, unsubscribed_at: null, edit_opt_in_at: now, edit_confirm_token: null, updated_at: now }).eq('id', row.id)
      if (error) { console.error('confirm failed', error); return json({ error: 'Something went wrong. Try the link again.' }, 500) }
      return json({ ok: true })
    }

    if (action !== 'subscribe') return json({ error: 'Unknown action' }, 400)
    const email = String(body.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'That email address doesn\'t look right.' }, 400)

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    for (const [key, max, win] of [[`edit-sub-ip:${ip}`, 8, 3600], [`edit-sub-email:${email}`, 3, 86400]] as const) {
      const { data: allowed, error } = await admin.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: win })
      if (error) { console.error('rate_limit_hit failed', error); return json({ error: 'Please try again later.' }, 503) }
      if (allowed === false) return json(DONE)
    }

    const pattern = email.replace(/[\\%_]/g, (c) => '\\' + c)
    const { data: found } = await admin.from('email_subscribers').select('id, status, edit_opt_in_at').ilike('email', pattern).limit(1)
    const row = found?.[0]
    if (row && row.status === 'subscribed' && row.edit_opt_in_at) return json(DONE)
    // Someone who unsubscribed stays unsubscribed: a form anyone can fill in must not undo that.
    // They can come back from Settings or the resubscribe button on their unsubscribe page.
    if (row && row.status === 'unsubscribed') return json(DONE)

    // Subscribing happens on the site: no confirmation email, the address joins straight away.
    // The Edit itself is read on the site; nothing is emailed from here.
    if (row) {
      const { error } = await admin.from('email_subscribers').update({ status: 'subscribed', source: 'edit', consented_at: now, unsubscribed_at: null, edit_opt_in_at: now, edit_confirm_token: null, updated_at: now }).eq('id', row.id)
      if (error) { console.error('subscribe update failed', error); return json({ error: 'Something went wrong. Please try again.' }, 500) }
    } else {
      const { error } = await admin.from('email_subscribers').insert({ email, status: 'subscribed', source: 'edit', consented_at: now, edit_opt_in_at: now })
      if (error) { console.error('subscribe insert failed', error); return json({ error: 'Something went wrong. Please try again.' }, 500) }
    }
    return json(DONE)
  } catch (err) {
    console.error('edit-subscribe error', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
