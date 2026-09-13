// Supabase Edge Function: enquiry-nudges
// Scheduled every 6 hours via pg_cron. When a client enquiry has sat with no reply from the
// creative for 24 hours, emails the creative once.
//
// Most unanswered enquiries are not a capped creative, they are someone who was on a shoot
// and lost the notification in their inbox. A named lead and a nudge fixes the majority of
// them, which is the cheapest fix there is for the thing that actually loses clients.
//
// The 24 hour clock runs from the last client message, not from when the thread was created,
// so a thread the client is still chasing does not get nudged on the original timestamp.
//
// Auth: header x-cron-secret == CRON_SECRET (fails closed if CRON_SECRET is not set).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const GREEN = '#1DB954'
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const SITE = 'https://lenstrybe.com'
const WAIT_HOURS = 24
const BATCH = 200

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function plain(s: unknown, max: number) {
  return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max)
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, reply_to: 'connect@lenstrybe.com', subject, html }),
    })
    if (!res.ok) console.error('resend failed', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (_e) {
    return false
  }
}

function nudgeEmail(businessName: string, clientName: string, subject: string, waitedLabel: string, messagesUrl: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#0a0a0f;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0a0a0f;">${esc(clientName || 'A client')} is still waiting to hear back from you</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
  <tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${GREEN};letter-spacing:-0.02em;">LensTrybe</div></td></tr>
  <tr><td style="padding:22px 36px 8px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${GREEN};margin-bottom:10px;">Waiting on you</div>
  <h1 style="margin:0 0 10px;font-size:23px;line-height:1.25;font-weight:800;color:#ffffff;">${esc(clientName || 'A client')} is still waiting</h1>
  <p style="margin:0;color:#9a9aa8;font-size:15px;line-height:1.6;">No reply yet after ${esc(waitedLabel)}</p>
  </td></tr>
  <tr><td style="padding:18px 36px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b1b26;border:1px solid rgba(255,255,255,0.08);border-radius:12px;"><tr><td style="padding:18px 20px;">
  <p style="margin:0 0 12px;color:#9a9aa8;font-size:14px;">Hi ${esc(businessName || 'there')},</p>
  <p style="margin:0 0 14px;color:#ffffff;font-size:15px;line-height:1.7;">${esc(clientName || 'A client')} got in touch${subject ? ` about <span style="color:#ffffff;">${esc(subject)}</span>` : ''} and has not heard back yet.</p>
  <p style="margin:0;color:#9a9aa8;font-size:14px;line-height:1.7;">Even a quick note saying you are on a job and will come back to them keeps the enquiry alive. Clients who get nothing back usually go elsewhere.</p>
  </td></tr></table>
  </td></tr>
  <tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${GREEN};"><a href="${esc(messagesUrl)}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">Reply now</a></td></tr></table></td></tr>
  <tr><td style="padding:18px 36px 0;"><p style="margin:0;color:#6a6a78;font-size:12px;line-height:1.6;">You are getting this once for this enquiry, not every day.</p></td></tr>
  <tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;"><div style="font-size:13px;font-weight:700;color:#ffffff;">LensTrybe</div><div style="font-size:12px;color:#6a6a78;margin-top:2px;">Connect. Capture. Create.</div><a href="${SITE}" style="font-size:12px;color:${GREEN};text-decoration:none;">lenstrybe.com</a></div></td></tr>
  </table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    console.error('CRON_SECRET is not set')
    return json({ error: 'Not configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-cron-secret') || '', cronSecret)) return json({ error: 'Unauthorized' }, 401)

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const cutoff = new Date(Date.now() - WAIT_HOURS * 3600 * 1000).toISOString()

  // Candidates are threads never nudged whose last activity is old enough. last_message_at
  // moves when the client chases, so this is the right clock, but it also moves when the
  // creative replies, so every candidate is still checked against messages below.
  const { data: rows, error } = await sb
    .from('message_threads')
    .select('id, creative_id, client_name, subject, created_at, last_message_at')
    .is('reply_nudged_at', null)
    .not('creative_id', 'is', null)
    .lte('last_message_at', cutoff)
    .order('last_message_at', { ascending: true })
    .limit(BATCH)

  if (error) {
    console.error('enquiry-nudges: query failed', error.message)
    return json({ error: 'Query failed' }, 500)
  }

  let sent = 0
  let skippedReplied = 0
  let skippedNoRecipient = 0

  for (const t of rows || []) {
    try {
      // Skip anything the creative has already answered, at any point in the thread.
      const { count: replyCount, error: cErr } = await sb
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', t.id)
        .eq('sender_type', 'creative')
      if (cErr) { console.error('enquiry-nudges: reply check failed', t.id, cErr.message); continue }
      if ((replyCount ?? 0) > 0) {
        // Mark it so an answered thread is not re-checked on every run forever.
        await sb.from('message_threads').update({ reply_nudged_at: new Date().toISOString() }).eq('id', t.id)
        skippedReplied++
        continue
      }

      const { data: prof } = await sb.from('profiles')
        .select('business_name, business_email')
        .eq('id', t.creative_id).maybeSingle()

      let to: string | null = prof?.business_email || null
      if (!to) {
        try {
          const { data: u } = await sb.auth.admin.getUserById(String(t.creative_id))
          to = u?.user?.email || null
        } catch (_e) { to = null }
      }
      if (!to) {
        await sb.from('message_threads').update({ reply_nudged_at: new Date().toISOString() }).eq('id', t.id)
        skippedNoRecipient++
        continue
      }

      const clientName = plain(t.client_name || '', 60)
      const subject = plain(t.subject || '', 120)
      const hours = Math.floor((Date.now() - new Date(t.last_message_at || t.created_at).getTime()) / 3600000)
      const waitedLabel = hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} hours`

      const ok = await sendEmail(
        to,
        plain(`${clientName || 'A client'} is still waiting on your reply`, 150),
        nudgeEmail(
          plain(prof?.business_name || '', 80),
          clientName,
          subject,
          waitedLabel,
          `${SITE}/dashboard/clients/messages`,
        ),
      )

      try {
        await sb.from('notifications').insert({
          user_id: t.creative_id,
          type: 'message',
          title: `${clientName || 'A client'} is still waiting on your reply`,
          body: subject ? plain(`Regarding ${subject}`, 140) : null,
          link: '/dashboard/clients/messages',
          meta: { thread_id: t.id },
        })
      } catch (_e) { /* non-blocking */ }

      // Marked either way, so a delivery problem never turns into a repeat every 6 hours.
      await sb.from('message_threads').update({ reply_nudged_at: new Date().toISOString() }).eq('id', t.id)
      if (ok) sent++
    } catch (e) {
      console.error('enquiry-nudges: thread failed', t.id, (e as Error)?.message)
    }
  }

  return json({
    ok: true,
    considered: (rows || []).length,
    sent,
    skipped_replied: skippedReplied,
    skipped_no_recipient: skippedNoRecipient,
  })
})
