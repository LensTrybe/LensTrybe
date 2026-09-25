// Supabase Edge Function: meeting-respond
//
// The client's side of a meeting request, by response token, no login:
//   { action: 'get', token }                                   → the meeting + host name
//   { action: 'respond', token, response, proposed_date?, proposed_time?, message? }
//       response = accepted | declined | reschedule           → saves it, then tells the creative
//
// Change from the original: a response now emails the creative and drops a notification in their
// bell, so they hear about it without opening Meetings. Both are best effort; the save is what counts.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
const RESEND = Deno.env.get('RESEND_API_KEY') || ''
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/
const APP = 'https://lenstrybe.com'

function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }) }
function esc(s: unknown) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function isEmail(s: unknown): s is string { return typeof s === 'string' && s.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[^\s@<>,;"'()]+$/.test(s) }
const pad = (n: number) => String(n).padStart(2, '0')
function whenLabel(date: string | null, start: string | null, end: string | null) {
  if (!date || !DATE_RE.test(date)) return 'a time to be confirmed'
  const d = new Date(date + 'T00:00:00')
  const day = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!start || !TIME_RE.test(start)) return day
  const to12 = (t: string) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const h12 = ((h + 11) % 12) + 1; return `${h12}${m ? ':' + pad(m) : ''}${ap}` }
  return `${day} · ${to12(start)}${end && TIME_RE.test(end) ? ' to ' + to12(end) : ''}`
}

const BRAND = { green: '#1DB954', btnText: '#04120a', pageBg: '#0a0a0f', card: '#14141c', panel: '#1b1b26', border: 'rgba(255,255,255,0.08)', text: '#ffffff', muted: '#9a9aa8', faint: '#6a6a78', font: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` }
function emailShell(o: { kicker: string; heading: string; intro: string; panelHtml: string; ctaText: string; ctaUrl: string }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};padding:40px 16px;font-family:${BRAND.font};"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px 0;"><a href="${APP}" style="display:inline-block;text-decoration:none;"><img src="${APP}/email-logo-white.png" width="180" height="38" alt="LensTrybe" style="display:block;border:0;width:180px;height:38px;" /></a></td></tr>
<tr><td style="padding:22px 36px 8px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.green};margin-bottom:10px;">${esc(o.kicker)}</div>
<h1 style="margin:0 0 10px;font-size:23px;line-height:1.25;font-weight:800;color:${BRAND.text};">${esc(o.heading)}</h1>
<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${esc(o.intro)}</p></td></tr>
<tr><td style="padding:18px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;"><tr><td style="padding:18px 20px;color:${BRAND.text};font-size:14px;line-height:1.6;">${o.panelHtml}</td></tr></table></td></tr>
<tr><td style="padding:24px 36px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${o.ctaUrl}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:${BRAND.btnText};text-decoration:none;font-family:${BRAND.font};">${esc(o.ctaText)}</a></td></tr></table></td></tr>
<tr><td style="padding:28px 36px 32px;"><div style="border-top:1px solid ${BRAND.border};padding-top:18px;"><div style="font-size:12px;letter-spacing:0.24em;color:${BRAND.text};">LENSTRYBE</div><div style="font-size:12px;color:${BRAND.faint};margin-top:2px;">Connect. Capture. Create.</div><a href="${APP}" style="font-size:12px;color:${BRAND.green};text-decoration:none;">lenstrybe.com</a></div></td></tr>
</table></td></tr></table></body></html>`
}

// Tell the creative. Never throws.
async function tellCreative(m: Record<string, any>, response: string) {
  try {
    if (!UUID_RE.test(String(m.creative_id || ''))) return
    const who = String(m.client_name || '').trim() || 'Your client'
    const title = response === 'accepted' ? `${who} confirmed the meeting` : response === 'declined' ? `${who} can't make the meeting` : `${who} suggested another time`
    const when = whenLabel(m.meeting_date, m.start_time, m.end_time)
    const suggested = response === 'reschedule' ? whenLabel(m.client_proposed_date, m.client_proposed_time, null) : ''
    const body = response === 'accepted' ? `${m.title || 'Meeting'} · ${when}` : response === 'declined' ? `${m.title || 'Meeting'} · ${when}${m.client_message ? ' · ' + m.client_message : ''}` : `${m.title || 'Meeting'} · suggested ${suggested}${m.client_message ? ' · ' + m.client_message : ''}`
    // bell
    await fetch(`${URL}/rest/v1/notifications`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: m.creative_id, type: 'meeting', title, body: body.slice(0, 200), link: '/dashboard/clients/meetings', meta: { meeting_id: m.id, response } }) }).catch(() => {})
    // email, to the account address
    if (!RESEND) return
    const ur = await fetch(`${URL}/auth/v1/admin/users/${encodeURIComponent(m.creative_id)}`, { headers: H })
    const u = ur.ok ? await ur.json() : null
    const to = isEmail(u?.email) ? u.email : null
    if (!to) return
    const panel = `<div><strong>${esc(m.title || 'Meeting')}</strong></div><div style="color:${BRAND.muted};margin-top:4px;">Proposed: ${esc(when)}</div>${suggested ? `<div style="margin-top:8px;"><strong>Suggested instead:</strong> ${esc(suggested)}</div>` : ''}${m.client_message ? `<div style="margin-top:8px;color:${BRAND.muted};">“${esc(m.client_message)}”</div>` : ''}`
    const html = emailShell({ kicker: 'Meeting', heading: title, intro: response === 'accepted' ? 'It is confirmed on their side. It is in your Meetings, and on your calendar if you added it there.' : response === 'declined' ? 'They said no to this one. Suggest another time from Meetings when you are ready.' : 'Have a look at the time they suggested and confirm or counter it from Meetings.', panelHtml: panel, ctaText: 'Open Meetings', ctaUrl: `${APP}/dashboard/clients/meetings` })
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'LensTrybe <noreply@mail.lenstrybe.com>', to: [to], subject: title, html }) })
  } catch (e) { console.error('meeting-respond tellCreative', e) }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    let body: any = {}
    try { body = await req.json() } catch { return json({ error: 'bad request' }, 400) }
    const { action, response, proposed_date, proposed_time, message } = body || {}
    const token = String(body?.token ?? '')
    if (!UUID_RE.test(token)) return json({ error: 'not found' }, 404)
    const t = encodeURIComponent(token)

    if (action === 'get') {
      const r = await fetch(`${URL}/rest/v1/meetings?response_token=eq.${t}&select=id,title,description,location,meeting_date,start_time,end_time,client_name,status,client_proposed_date,client_proposed_time,client_message,creative_id,meeting_type`, { headers: H })
      if (!r.ok) { console.error('meeting-respond get failed', r.status, await r.text().catch(() => '')); return json({ error: 'Something went wrong' }, 500) }
      const rows = await r.json()
      const m = Array.isArray(rows) ? rows[0] : null
      if (!m) return json({ error: 'not found' }, 404)
      let host = 'A LensTrybe creative', avatar: string | null = null
      try {
        if (UUID_RE.test(String(m.creative_id || ''))) {
          const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${encodeURIComponent(m.creative_id)}&select=business_name,avatar_url`, { headers: H })
          const p = (await pr.json())[0]
          host = p?.business_name || host
          avatar = p?.avatar_url || null
        }
      } catch { /* ignore */ }
      delete m.creative_id
      return json({ meeting: { ...m, host, host_avatar: avatar } })
    }

    if (action === 'respond') {
      const valid = ['accepted', 'declined', 'reschedule']
      if (!valid.includes(response)) return json({ error: 'bad response' }, 400)
      const patch: Record<string, unknown> = {
        status: response,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        client_message: typeof message === 'string' && message.trim() ? message.trim().slice(0, 2000) : null,
      }
      if (response === 'reschedule') {
        patch.client_proposed_date = typeof proposed_date === 'string' && DATE_RE.test(proposed_date) ? proposed_date : null
        patch.client_proposed_time = typeof proposed_time === 'string' && TIME_RE.test(proposed_time) ? proposed_time : null
      }
      const r = await fetch(`${URL}/rest/v1/meetings?response_token=eq.${t}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(patch) })
      if (!r.ok) { console.error('meeting-respond patch failed', r.status, await r.text().catch(() => '')); return json({ error: 'Something went wrong' }, 500) }
      const rows = await r.json()
      if (!Array.isArray(rows) || !rows[0]) return json({ error: 'not found' }, 404)
      await tellCreative(rows[0], response)
      return json({ ok: true, status: response })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    console.error('meeting-respond failed', e)
    return json({ error: 'Something went wrong' }, 500)
  }
})
