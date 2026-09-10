import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
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
      const r = await fetch(`${URL}/rest/v1/meetings?response_token=eq.${t}&select=id,title,description,location,meeting_date,start_time,end_time,client_name,status,client_proposed_date,client_proposed_time,client_message,creative_id`, { headers: H })
      if (!r.ok) { console.error('meeting-respond get failed', r.status, await r.text().catch(() => '')); return json({ error: 'Something went wrong' }, 500) }
      const rows = await r.json()
      const m = Array.isArray(rows) ? rows[0] : null
      if (!m) return json({ error: 'not found' }, 404)
      let host = 'A LensTrybe creative'
      try {
        if (UUID_RE.test(String(m.creative_id || ''))) {
          const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${encodeURIComponent(m.creative_id)}&select=business_name`, { headers: H })
          const p = (await pr.json())[0]
          host = p?.business_name || host
        }
      } catch { /* ignore */ }
      delete m.creative_id
      return json({ meeting: { ...m, host } })
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
      return json({ ok: true, status: response })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    console.error('meeting-respond failed', e)
    return json({ error: 'Something went wrong' }, 500)
  }
})
