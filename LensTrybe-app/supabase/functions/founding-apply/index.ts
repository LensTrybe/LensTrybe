// Supabase Edge Function: founding-apply
//
// The founding offer application, from the home page hero and from /founding. A
// creative puts their hand up, and the application lands in the Founding Invites admin
// panel for review. Nothing here creates an invite: the founding programme is hand
// picked, so a person decides what happens next.
//
// What happens on a new application:
//   - the row is saved (upserted on email, so a second submission updates the first)
//   - a database trigger raises a notification for every admin
//   - every admin gets an email with the details, reply-to set to the applicant
//
// A repeat submission from the same address updates the row but sends nothing, so an
// impatient applicant pressing the button three times does not mean three emails.
//
// Consent: filling in this form is express consent under the Spam Act, which is a
// stronger basis than the inferred consent the cold invites rely on. The address goes
// into email_subscribers the same way, so one unsubscribe still stops everything.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function clean(v: unknown, max: number) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function isEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254
}

// Accepts what a person actually types: instagram.com/name, @name, or a full URL. Returns
// something openable, or null if it cannot be made into one. Only http(s) is allowed, so a
// javascript: or data: string can never reach an admin's browser as a link.
function tidyLink(raw: string): string | null {
  const v = clean(raw, 300)
  if (!v) return null
  if (v.startsWith('@')) return 'https://instagram.com/' + v.slice(1).replace(/[^\w.]/g, '')
  const withScheme = /^https?:\/\//i.test(v) ? v : 'https://' + v
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

// ---- LensTrybe shared email template (inlined, kept in step with the send-* functions) ----
const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
const APP = 'https://lenstrybe.com'
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }
function panel(innerHtml: string) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;">${innerHtml}</td></tr></table>` }
function emailShell(opts: { preheader?: string; kicker?: string; heading: string; intro?: string; panelHtml?: string; ctaText?: string; ctaUrl?: string; footNote?: string }) {
  const { preheader = '', kicker = '', heading, intro = '', panelHtml = '', ctaText, ctaUrl, footNote = '' } = opts
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.pageBg};">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;font-family:${BRAND.font};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><a href="https://lenstrybe.com" style="display:inline-block;text-decoration:none;"><img src="https://lenstrybe.com/email-logo-white.png" width="180" height="38" alt="LensTrybe" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:38px;" /></a></td></tr>
<tr><td style="padding:22px 36px 8px;">
${kicker ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(kicker)}</div>` : ''}
<h1 style="margin:0 0 ${intro ? '10px' : '4px'};font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${heading}</h1>
${intro ? `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${intro}</p>` : ''}
</td></tr>
${panelHtml ? `<tr><td style="padding:18px 36px 0;">${panelHtml}</td></tr>` : ''}
${ctaText && ctaUrl ? `<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(ctaText)}</a></td></tr></table></td></tr>` : ''}
${footNote ? `<tr><td style="padding:18px 36px 0;"><p style="margin:0;color:${BRAND.faint};font-size:12px;line-height:1.6;">${footNote}</p></td></tr>` : ''}
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:12px;font-weight:400;letter-spacing:0.24em;color:${BRAND.text};">LENSTRYBE</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="https://lenstrybe.com" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}
// ---- end shared ----

function row(label: string, valueHtml: string) {
  return `<tr><td style="padding:6px 0;vertical-align:top;width:120px;color:${BRAND.faint};font-size:13px;">${esc(label)}</td>` +
    `<td style="padding:6px 0;vertical-align:top;color:${BRAND.text};font-size:14px;line-height:1.5;">${valueHtml}</td></tr>`
}

// deno-lint-ignore no-explicit-any
async function adminEmails(sb: any): Promise<string[]> {
  // Whoever is an admin today, not an address written into the code. Adding or
  // removing an admin changes who hears about applications with no redeploy.
  const { data: admins, error } = await sb.from('profiles').select('id').eq('is_admin', true)
  if (error || !admins?.length) return []
  const out: string[] = []
  for (const a of admins) {
    try {
      const { data } = await sb.auth.admin.getUserById(a.id)
      const e = data?.user?.email
      if (e && !out.includes(e.toLowerCase())) out.push(e.toLowerCase())
    } catch { /* one missing admin must not stop the rest */ }
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }

    const name = clean(body.name, 120)
    const business = clean(body.business_name, 120)
    const email = clean(body.email, 254).toLowerCase()
    const creativeType = clean(body.creative_type, 60)
    const region = clean(body.region, 120)
    const portfolio = tidyLink(String(body.portfolio_url ?? ''))

    if (!name) return json({ error: 'Please add your name.' }, 400)
    if (!business) return json({ error: 'Please add your business name. Your own name is fine if you trade under it.' }, 400)
    if (!isEmail(email)) return json({ error: 'That email address does not look right.' }, 400)
    if (!portfolio) return json({ error: 'Please add a link to your work, like your Instagram or your website.' }, 400)

    // Two limits. The first stops one person hammering the form, the second caps the whole
    // endpoint so a script cannot fill the queue with junk faster than anyone can read it.
    for (const [key, max, window] of [
      [`founding-apply:${email}`, 3, 3600],
      ['founding-apply:all', 120, 3600],
    ] as [string, number, number][]) {
      const { data: allowed, error } = await sb.rpc('rate_limit_hit', {
        p_key: key, p_max: max, p_window_seconds: window,
      })
      if (error) console.error('founding-apply rate limit check failed', error.message)
      else if (allowed === false) {
        return json({ error: 'That has been submitted a few times already. Please try again a bit later.' }, 429)
      }
    }

    // Is this person new? Only a first application is worth an email. Read before the
    // upsert rather than inferred from it, because an upsert does not say which it did.
    const { data: existing } = await sb.from('founding_applications')
      .select('id').eq('email', email).maybeSingle()
    const isNew = !existing

    // An impatient applicant submits twice. Update the first rather than queue a duplicate,
    // but never move one that has already been reviewed back to 'new': status is not sent.
    const { error: upsertErr } = await sb.from('founding_applications')
      .upsert({
        name,
        business_name: business,
        email,
        creative_type: creativeType || null,
        region: region || null,
        portfolio_url: portfolio,
      }, { onConflict: 'email', ignoreDuplicates: false })
    if (upsertErr) {
      console.error('founding-apply insert failed', upsertErr.message)
      return json({ error: 'Something went wrong saving that. Please try again.' }, 500)
    }

    // Express consent, recorded the same way as every other list so one unsubscribe covers
    // all of them. A failure here must not lose the application, so it is logged, not thrown.
    const { error: subErr } = await sb.from('email_subscribers')
      .insert({ email, status: 'subscribed', source: 'founding-application', consented_at: new Date().toISOString() })
    if (subErr && !/duplicate|unique/i.test(subErr.message)) {
      console.error('founding-apply subscriber insert failed', subErr.message)
    }

    // Tell the admins. The in-app notification is raised by a trigger on insert; this is
    // the email. Best effort: the application is already saved, so a failed send is
    // logged and the applicant still sees their confirmation.
    if (isNew) {
      const resendKey = Deno.env.get('RESEND_API_KEY') || ''
      const to = resendKey ? await adminEmails(sb) : []
      if (to.length) {
        const shown = portfolio.replace(/^https?:\/\//i, '').replace(/\/$/, '')
        const details =
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
          row('Name', esc(name)) +
          row('Business', esc(business)) +
          row('Email', `<a href="mailto:${esc(email)}" style="color:${BRAND.green};text-decoration:none;">${esc(email)}</a>`) +
          row('Their work', `<a href="${esc(portfolio)}" style="color:${BRAND.green};text-decoration:none;word-break:break-all;">${esc(shown)}</a>`) +
          (creativeType ? row('What they do', esc(creativeType)) : '') +
          (region ? row('Where', esc(region)) : '') +
          `</table>`

        const html = emailShell({
          preheader: `${name} from ${business} applied for the founding offer`,
          kicker: 'Founding offer',
          heading: 'New founding application',
          intro: `${esc(name)} from <span style="color:${BRAND.text};">${esc(business)}</span> wants a founding place.`,
          panelHtml: panel(details),
          ctaText: 'Review in the admin panel',
          ctaUrl: `${APP}/dashboard/admin`,
          footNote: 'Reply to this email to write to them directly. Invite them from the Applications card, which fills in the invite form with their details.',
        })

        for (const recipient of to) {
          try {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: FROM,
                to: [recipient],
                reply_to: email,
                subject: `Founding application: ${name}, ${business}`.slice(0, 150),
                html,
              }),
            })
            if (!res.ok) console.error('founding-apply admin email failed', res.status, await res.text().catch(() => ''))
          } catch (e) {
            console.error('founding-apply admin email threw', (e as Error)?.message)
          }
        }
      }
    }

    return json({ ok: true })
  } catch (e) {
    console.error('founding-apply failed', e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
