// Supabase Edge Function: deliver-expiry-reminders
// Scheduled daily via pg_cron. Three jobs, in order:
//   1. Tell the client a gallery link expires in about 3 days, once per delivery.
//   2. Tell the creative, a week out, that an expired gallery's files are about to go.
//   3. Remove those files 30 days after the gallery expired.
//
// Nothing used to do 2 or 3, so every gallery ever delivered kept its files forever. That
// was a storage bill that grew with success, and worse, delivery_bytes_used counted those
// files against the creative's allowance, so they filled up with galleries they could not
// open and were asked to upgrade.
//
// The delivery row is never deleted. The client name, the title, the dates and the download
// counts are the creative's business record. Only the files were ever the expensive part.
//
// Auth: header x-cron-secret == CRON_SECRET (fails closed if CRON_SECRET is not set).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { reminderEmail, purgeWarningEmail } from './emails.ts'

const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const REMINDER_WINDOW_DAYS = 3
// Long enough that a creative who meant to extend and forgot does not lose a client's
// wedding photos over it. Matches the 30 day grace on account deletion.
const PURGE_AFTER_EXPIRY_DAYS = 30
const PURGE_WARNING_DAYS = 7
const DELIVER_BUCKET = 'deliveries'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function sendEmail(to, replyTo, subject, html) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, reply_to: replyTo || 'connect@lenstrybe.com', subject, html }),
    })
  } catch (_e) { /* best effort */ }
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)

  // Cron only. Fails closed if CRON_SECRET is not configured.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    console.error('CRON_SECRET is not set')
    return json({ error: 'Not configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-cron-secret') || '', cronSecret)) return json({ error: 'Unauthorized' }, 401)

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 86400000)

  const { data: rows, error } = await sb
    .from('deliveries')
    .select('id, title, client_name, client_email, download_token, expires_at, creative_id, expiry_reminder_sent')
    .eq('expiry_reminder_sent', false)
    .not('client_email', 'is', null)
    .gt('expires_at', now.toISOString())
    .lte('expires_at', windowEnd.toISOString())
  if (error) {
    console.error('deliver-expiry-reminders: query failed', error.message)
    return json({ error: 'Query failed' }, 500)
  }

  let sent = 0
  for (const d of rows || []) {
    try {
      let businessName = 'your creative'
      let replyTo = 'connect@lenstrybe.com'
      if (d.creative_id) {
        const { data: prof } = await sb.from('profiles').select('business_name, business_email').eq('id', d.creative_id).maybeSingle()
        if (prof?.business_name) businessName = prof.business_name
        if (prof?.business_email) replyTo = prof.business_email
      }
      const url = `https://lenstrybe.com/deliver/${encodeURIComponent(String(d.download_token || ''))}`
      const expiryLabel = new Date(d.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
      await sendEmail(d.client_email, replyTo, `Your gallery from ${businessName} expires soon`, reminderEmail(d.client_name, businessName, d.title, url, expiryLabel))
      await sb.from('deliveries').update({ expiry_reminder_sent: true }).eq('id', d.id)
      sent += 1
    } catch (e) { console.error('deliver-expiry-reminders: send failed', d.id, e instanceof Error ? e.message : String(e)) }
  }

  // ---- 2. Warn the creative a week before an expired gallery's files go ----
  const warnBy = new Date(now.getTime() - (PURGE_AFTER_EXPIRY_DAYS - PURGE_WARNING_DAYS) * 86400000)
  const { data: warnRows } = await sb
    .from('deliveries')
    .select('id, title, client_name, expires_at, creative_id')
    .eq('purge_warning_sent', false)
    .is('files_purged_at', null)
    .not('expires_at', 'is', null)
    .lte('expires_at', warnBy.toISOString())
    .limit(100)

  let warned = 0
  for (const d of warnRows || []) {
    try {
      let businessName = 'there'
      let to = null
      if (d.creative_id) {
        const { data: prof } = await sb.from('profiles').select('business_name, business_email').eq('id', d.creative_id).maybeSingle()
        if (prof?.business_name) businessName = prof.business_name
        to = prof?.business_email || null
        // Fall back to the login email, the same way the favourites email does, so a
        // creative without a business email still hears about it.
        if (!to) {
          const { data: u } = await sb.auth.admin.getUserById(d.creative_id)
          to = u?.user?.email || null
        }
      }
      const purgeOn = new Date(new Date(d.expires_at).getTime() + PURGE_AFTER_EXPIRY_DAYS * 86400000)
      const purgeLabel = purgeOn.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
      if (to) {
        await sendEmail(to, 'connect@lenstrybe.com', 'Your gallery files are about to be removed', purgeWarningEmail(businessName, d.title, d.client_name, purgeLabel))
      }
      // Stamped whether or not an address was found, so a creative with no reachable email
      // does not get retried every single day forever.
      await sb.from('deliveries').update({ purge_warning_sent: true }).eq('id', d.id)
      warned += 1
    } catch (e) { console.error('deliver-expiry-reminders: warn failed', d.id, e instanceof Error ? e.message : String(e)) }
  }

  // ---- 3. Remove the files of anything expired more than 30 days ----
  const purgeBefore = new Date(now.getTime() - PURGE_AFTER_EXPIRY_DAYS * 86400000)
  const { data: purgeRows } = await sb
    .from('deliveries')
    .select('id, files, cover_url, expires_at')
    .is('files_purged_at', null)
    .not('expires_at', 'is', null)
    .lte('expires_at', purgeBefore.toISOString())
    .limit(50)

  let purged = 0
  let filesRemoved = 0
  for (const d of purgeRows || []) {
    try {
      const paths = (Array.isArray(d.files) ? d.files : [])
        .map((f) => (f && typeof f.path === 'string' ? f.path : null))
        .filter(Boolean)
      // The cover is a path in its own right and is not always one of the files.
      if (typeof d.cover_url === 'string' && d.cover_url && !d.cover_url.startsWith('http') && !paths.includes(d.cover_url)) {
        paths.push(d.cover_url)
      }

      if (paths.length) {
        for (let i = 0; i < paths.length; i += 100) {
          const { error: rmErr } = await sb.storage.from(DELIVER_BUCKET).remove(paths.slice(i, i + 100))
          // Leave the row untouched on failure so the next run tries again. Marking it
          // purged here would strand the files with nothing left pointing at them.
          if (rmErr) throw new Error(`storage remove failed: ${rmErr.message}`)
        }
        filesRemoved += paths.length
      }

      await sb.from('deliveries').update({
        files: [],
        cover_url: null,
        files_purged_at: new Date().toISOString(),
      }).eq('id', d.id)
      purged += 1
    } catch (e) { console.error('deliver-expiry-reminders: purge failed', d.id, e instanceof Error ? e.message : String(e)) }
  }

  return json({
    ran_at: now.toISOString(),
    candidates: (rows || []).length,
    sent,
    warned,
    purged,
    files_removed: filesRemoved,
  })
})
