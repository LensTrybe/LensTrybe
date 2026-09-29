import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { websiteEnquiryHtml } from './emails.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const RESEND = Deno.env.get('RESEND_API_KEY') || ''
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^@\s"'<>]+@[^@\s"'<>]+\.[^@\s"'<>]+$/

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function str(v: unknown, max: number) { return typeof v === 'string' ? v.trim().slice(0, max) : '' }
function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) }

// Public enquiry form on a creative's LensTrybe website (/site/:slug) and their profile. Anonymous.
// Adds the person to the creative's CRM (never edits an existing contact), opens a thread with the
// message in it so the creative can reply from Threads, notifies them in the app and by email.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
    if (typeof body.website === 'string' && body.website) return json({ ok: true }) // honeypot

    const creativeId = str(body.creativeId, 64)
    const name = plain(str(body.name, 120), 120)
    const email = str(body.email, 254).toLowerCase()
    const phone = plain(str(body.phone, 40), 40)
    const message = str(body.message, 5000)
    if (!UUID_RE.test(creativeId) || !name || !EMAIL_RE.test(email)) return json({ error: 'missing fields' }, 400)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    for (const [key, max] of [[`site-enquiry:ip:${ip}`, 10], [`site-enquiry:email:${email}`, 5], [`site-enquiry:creative:${creativeId}`, 50]] as [string, number][]) {
      const { data: allowed, error: rlErr } = await sb.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: 3600 })
      if (rlErr) { console.error('rate_limit_hit failed', rlErr); return json({ error: 'Please try again later.' }, 503) }
      if (allowed === false) return json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    // Look up the creative (name + email for notification). Only published websites accept enquiries.
    const [{ data: prof }, { data: live }] = await Promise.all([
      sb.from('profiles').select('business_name, business_email').eq('id', creativeId).maybeSingle(),
      sb.rpc('website_is_live', { p_creative: creativeId }),
    ])
    if (!prof || live !== true) return json({ error: 'site not found' }, 404)

    // CRM lead: only ever INSERT a new contact. Anonymous input never edits an existing contact.
    try {
      const pattern = email.replace(/[\\%_]/g, (m) => `\\${m}`) // exact, case-insensitive match (no wildcards)
      const { data: found } = await sb.from('crm_contacts').select('id').eq('creative_id', creativeId).ilike('email', pattern).limit(1).maybeSingle()
      if (!found) {
        await sb.from('crm_contacts').insert({
          creative_id: creativeId,
          name,
          email,
          phone: phone || null,
          notes: message || null,
          status: 'Lead',
          tags: ['Website enquiry'],
          last_contacted_at: new Date().toISOString(),
        })
      }
    } catch (e) { console.error('crm capture failed', e) }

    // A thread with the message in it, so the creative can reply from Threads (the reply is emailed
    // to the enquirer with a link to their portal). A new thread per enquiry, like signed-in clients.
    if (message) {
      try {
        const now = new Date().toISOString()
        // The profile form sends "Subject: …" as the first line; use it as the thread's subject.
        const sm = message.match(/^Subject: ([^\n]{1,150})\n\n/)
        const subject = sm ? sm[1] : 'Website enquiry', text = sm ? message.slice(sm[0].length) : message
        const { data: th, error: thErr } = await sb.from('message_threads').insert({ creative_id: creativeId, client_name: name, client_email: email, subject, sender_type: 'client', unread_count: 0, last_message_at: now }  /* message_threads_bump adds the 1 */).select('id').single()
        if (thErr) throw thErr
        const { error: mErr } = await sb.from('messages').insert({ thread_id: th.id, sender_type: 'client', sender_name: name, body: phone ? `${text}\n\nPhone: ${phone}` : text })
        if (mErr) throw mErr
      } catch (e) { console.error('thread capture failed', e) }
    }

    // In-app notification for the creative (best effort).
    try {
      await sb.from('notifications').insert({
        user_id: creativeId,
        type: 'enquiry',
        title: `New website enquiry from ${name}`,
        body: message ? message.slice(0, 140) : null,
        link: '/dashboard/clients/crm',
        meta: { source: 'website' },
      })
    } catch { /* ignore */ }

    // Email the creative (reply-to goes straight to the enquirer).
    if (RESEND && prof.business_email) {
      const html = websiteEnquiryHtml({ name, email, phone, message })
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'LensTrybe <noreply@mail.lenstrybe.com>', to: [prof.business_email], reply_to: email, subject: plain(`New website enquiry from ${name}`, 150), html }),
        })
      } catch { /* best effort */ }
    }
    return json({ ok: true })
  } catch (e) {
    console.error('site-enquiry error', e)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
