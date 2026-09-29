import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { quoteResponseEmail } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
function money(v: unknown) { const n = Number(v); if (!Number.isFinite(n)) return ''; try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n) } catch { return `$${n}` } }
// ---- end shared ----

// A client accepts or declines a quote. Two ways in:
//   { quote_id, portal_token, action }  from the client portal (the portal must own the quote)
//   { view_token, action }              from the quote's own emailed link (/doc/quote/<view_token>),
//                                       for creatives without client portals (Trybe Essential, 28 Sep)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const quoteIdIn = String(body.quote_id || body.quoteId || '')
  const portalToken = String(body.portal_token || body.portalToken || '')
  const viewToken = String(body.view_token || body.viewToken || '')
  const action = String(body.action || '').toLowerCase()
  // 'status' (view link only) tells the quote page whether to show the Accept and Decline buttons.
  if (action !== 'accept' && action !== 'decline' && !(action === 'status' && viewToken)) return json({ error: 'action must be accept or decline' }, 400)

  let quote: Record<string, any> | null = null
  let clientEmail = '', clientNameFrom = ''
  if (viewToken) {
    if (!UUID_RE.test(viewToken)) return json({ error: 'Quote not found' }, 404)
    const { data: allowed } = await supabase.rpc('rate_limit_hit', { p_key: 'respond-quote:view:' + viewToken, p_max: 20, p_window_seconds: 3600 })
    if (allowed === false) return json({ error: 'Too many tries. Please wait a little and try again.' }, 429)
    const { data } = await supabase.from('quotes').select('*').eq('view_token', viewToken).maybeSingle()
    if (!data) return json({ error: 'Quote not found' }, 404)
    quote = data; clientEmail = String(data.client_email || ''); clientNameFrom = String(data.client_name || '')
  } else {
    if (quoteIdIn && !UUID_RE.test(quoteIdIn)) return json({ error: 'Quote not found' }, 404)
    if (portalToken && !UUID_RE.test(portalToken)) return json({ error: 'Invalid portal' }, 403)
    if (!quoteIdIn || !portalToken) return json({ error: 'quote_id and portal_token required' }, 400)
    // Authenticate via the portal token: it maps to a client + creative.
    const { data: portal } = await supabase.from('client_portals').select('creative_id, client_email, client_name').eq('portal_token', portalToken).maybeSingle()
    if (!portal) return json({ error: 'Invalid portal' }, 403)
    const { data } = await supabase.from('quotes').select('*').eq('id', quoteIdIn).maybeSingle()
    if (!data) return json({ error: 'Quote not found' }, 404)
    // The quote must belong to this portal's client + creative.
    if (data.creative_id !== portal.creative_id || (data.client_email || '').toLowerCase() !== (portal.client_email || '').toLowerCase()) {
      return json({ error: 'This quote does not belong to your portal' }, 403)
    }
    quote = data; clientEmail = String(portal.client_email || ''); clientNameFrom = String(portal.client_name || '')
  }
  const quoteId = String(quote!.id)

  const current = String(quote!.status || '').toLowerCase()
  if (action === 'status') {
    if (current === 'draft') return json({ error: 'Quote not found' }, 404)
    const todayAu = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    const expired = !!quote!.valid_until && String(quote!.valid_until).slice(0, 10) < todayAu
    return json({ status: current, expired })
  }
  // Only respond to a quote that is still open.
  if (current === 'accepted' || current === 'declined') return json({ error: 'This quote has already been responded to', status: current }, 409)
  // Drafts (and any other non-sent state) cannot be accepted or declined.
  if (current !== 'sent' && current !== 'viewed') return json({ error: 'This quote is not open for a response' }, 409)
  // Expired quotes cannot be accepted or declined (valid_until is inclusive, Australian date).
  if (quote!.valid_until) {
    const todayAu = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    if (String(quote!.valid_until).slice(0, 10) < todayAu) return json({ error: 'This quote has expired. Please contact your creative for an updated quote.' }, 410)
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined'
  const { data: updated, error: upErr } = await supabase.from('quotes').update({ status: newStatus }).eq('id', quoteId).in('status', ['sent', 'viewed', 'Sent', 'Viewed']).select('id')
  if (upErr) { console.error('respond-quote update failed', upErr); return json({ error: 'Could not save your response. Please try again.' }, 500) }
  if (!Array.isArray(updated) || !updated.length) return json({ error: 'This quote has already been responded to' }, 409)

  // Notify the creative.
  const { data: profile } = await supabase.from('profiles').select('business_name, business_email').eq('id', quote!.creative_id).single()
  const creativeEmail = profile?.business_email
  const clientName = clientNameFrom || quote!.client_name || 'Your client'
  const accepted = newStatus === 'accepted'

  // In-app notification for the creative (best effort).
  try {
    await supabase.from('notifications').insert({
      user_id: quote!.creative_id,
      type: 'quote',
      title: `${clientName} ${accepted ? 'accepted' : 'declined'} your quote`,
      body: quote!.amount != null ? money(quote!.amount) : null,
      link: '/dashboard/finance/quotes',
      meta: { quote_id: quoteId, status: newStatus },
    })
  } catch (_e) { /* non-blocking */ }

  if (creativeEmail) {
    const email = quoteResponseEmail({ clientName, accepted, quoteId, amount: quote!.amount != null ? money(quote!.amount) : null })
    await sendEmail(resendKey, {
      to: creativeEmail,
      replyTo: clientEmail || undefined,
      subject: email.subject,
      html: email.html,
    })
  }

  return json({ success: true, status: newStatus })
})
