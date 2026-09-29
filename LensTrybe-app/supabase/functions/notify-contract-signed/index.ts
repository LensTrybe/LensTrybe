import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { contractSignedEmail } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// ---- end shared ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/.test(s) }
function plain(s: unknown, max = 200) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>"]/g, '').trim().slice(0, max) }

// The creative's time zone from their state. Anywhere unknown counts as Brisbane, where LensTrybe is.
const ZONES: Record<string, string> = { QLD: 'Australia/Brisbane', NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', VIC: 'Australia/Melbourne', TAS: 'Australia/Hobart', SA: 'Australia/Adelaide', NT: 'Australia/Darwin', WA: 'Australia/Perth' }
function zoneFor(state: unknown, country: unknown): string {
  const st = String(state || '').trim().toUpperCase()
  if (ZONES[st]) return ZONES[st]
  const c = String(country || '').trim().toLowerCase()
  if (c === 'new zealand' || c === 'nz') return 'Pacific/Auckland'
  if (c === 'united kingdom' || c === 'uk' || c === 'gb') return 'Europe/London'
  return 'Australia/Brisbane'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const contractId = String(body.contract_id || body.contractId || '')
  if (!UUID_RE.test(contractId)) return json({ error: 'contract_id required' }, 400)

  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).maybeSingle()
  if (!contract) return json({ error: 'Contract not found' }, 404)
  // Only notify for contracts that really are signed, and only once.
  if (String(contract.status || '').toLowerCase() !== 'signed') return json({ error: 'Contract is not signed' }, 409)
  if (contract.signed_notified_at) return json({ success: true, skipped: true })
  const { data: claimed, error: claimErr } = await supabase.from('contracts').update({ signed_notified_at: new Date().toISOString() }).eq('id', contractId).is('signed_notified_at', null).select('id')
  if (claimErr) { console.error('notify-contract-signed claim failed', claimErr); return json({ error: 'Could not send the notification' }, 500) }
  if (!Array.isArray(claimed) || !claimed.length) return json({ success: true, skipped: true })

  const { data: profile } = await supabase.from('profiles').select('business_name, business_email, state, country').eq('id', contract.creative_id).maybeSingle()
  const creativeEmail = isEmail(profile?.business_email) ? profile.business_email : null

  const clientName = plain(contract.client_name || 'Your client', 100) || 'Your client'
  // Shown in the creative's own time zone (from their state), e.g. "29 Sept 2026, 7:42 pm AEST".
  const tz = zoneFor(profile?.state, profile?.country)
  const signedAt = new Date(contract.signed_at || Date.now()).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' })

  // In-app notification for the creative (best effort).
  try {
    await supabase.from('notifications').insert({
      user_id: contract.creative_id,
      type: 'contract',
      title: `${clientName} signed your contract`,
      body: contract.title ? `Contract: ${contract.title}` : null,
      link: '/dashboard/finance/contracts',
      meta: { contract_id: contractId },
    })
  } catch (_e) { /* non-blocking */ }

  if (!creativeEmail) return json({ success: true, emailed: false })

  const email = contractSignedEmail({ clientName, clientEmail: contract.client_email, title: contract.title, signedAt })

  await sendEmail(resendKey, {
    to: creativeEmail,
    replyTo: isEmail(contract.client_email) ? contract.client_email : undefined,
    subject: email.subject,
    html: email.html,
  })

  return json({ success: true })
})
