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
import { applicationEmail } from './emails.ts'

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

const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'

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
    // Anything else they want to say (the /founding form's optional box). Kept with a first
    // application only, so a later resubmission never writes over an admin's review notes.
    const note = String(body.note ?? '').replace(/\r/g, '').trim().slice(0, 1500)

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
        ...(isNew && note ? { notes: 'From the applicant: ' + note } : {}),
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
        const html = applicationEmail({ name, business, email, portfolio, creativeType, region, note })

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
