// Supabase Edge Function: deliver-expiry-reminders
// Scheduled daily via pg_cron. Emails the client a reminder ~3 days before a
// delivery gallery link expires, once per delivery.
// Auth: header x-cron-secret == CRON_SECRET (if set).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const GREEN = '#1DB954'
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const REMINDER_WINDOW_DAYS = 3

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

function reminderEmail(clientName, businessName, title, url, expiryLabel) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0f;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" style="background:#0a0a0f;padding:40px 16px;"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:560px;background:#14141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
  <tr><td style="padding:32px 36px 0;"><div style="font-size:20px;font-weight:800;color:${GREEN};">LensTrybe</div></td></tr>
  <tr><td style="padding:22px 36px 8px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#f59e0b;margin-bottom:10px;">Your gallery is expiring soon</div>
  <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#fff;">Hi ${clientName || 'there'}, download your files before they go</h1>
  <p style="margin:0 0 14px;color:#9a9aa8;font-size:15px;line-height:1.6;">Your gallery <strong style="color:#fff;">${title || 'from ' + (businessName || 'your creative')}</strong> will expire on <strong style="color:#fff;">${expiryLabel}</strong>. Please download anything you would like to keep before then.</p>
  </td></tr>
  <tr><td style="padding:14px 36px 4px;"><table role="presentation"><tr><td style="border-radius:10px;background:${GREEN};"><a href="${url}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#04120a;text-decoration:none;">View &amp; download your files</a></td></tr></table></td></tr>
  <tr><td style="padding:26px 36px 32px;"><div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-size:12px;color:#6a6a78;">Delivered via LensTrybe. Connect. Capture. Create.</div></td></tr>
  </table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing env' }, 500)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'Unauthorized' }, 401)

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
  if (error) return json({ error: error.message }, 500)

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
      const url = `https://lenstrybe.com/deliver/${d.download_token}`
      const expiryLabel = new Date(d.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
      await sendEmail(d.client_email, replyTo, `Your gallery from ${businessName} expires soon`, reminderEmail(d.client_name, businessName, d.title, url, expiryLabel))
      await sb.from('deliveries').update({ expiry_reminder_sent: true }).eq('id', d.id)
      sent += 1
    } catch (_e) { /* continue */ }
  }

  return json({ ran_at: now.toISOString(), candidates: (rows || []).length, sent })
})
