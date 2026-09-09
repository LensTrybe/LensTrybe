import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { action, token, response, proposed_date, proposed_time, message } = await req.json()
    if (!token) return json({ error: 'missing token' }, 400)

    if (action === 'get') {
      const r = await fetch(`${URL}/rest/v1/meetings?response_token=eq.${token}&select=id,title,description,location,meeting_date,start_time,end_time,client_name,status,client_proposed_date,client_proposed_time,client_message,creative_id`, { headers: H })
      const rows = await r.json()
      const m = rows[0]
      if (!m) return json({ error: 'not found' }, 404)
      let host = 'A LensTrybe creative'
      try {
        const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${m.creative_id}&select=business_name`, { headers: H })
        const p = (await pr.json())[0]
        host = p?.business_name || host
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
        client_message: message || null,
      }
      if (response === 'reschedule') {
        patch.client_proposed_date = proposed_date || null
        patch.client_proposed_time = proposed_time || null
      }
      const r = await fetch(`${URL}/rest/v1/meetings?response_token=eq.${token}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(patch) })
      const rows = await r.json()
      if (!Array.isArray(rows) || !rows[0]) return json({ error: 'not found' }, 404)
      return json({ ok: true, status: response })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
