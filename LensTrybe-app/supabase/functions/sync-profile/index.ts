import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) return json({ error: 'user_id is required' }, 400)

  // Build update object from whatever fields are provided
  const update: Record<string, unknown> = { id: userId }
  if (body.business_name !== undefined) update.business_name = body.business_name
  if (body.bio !== undefined) update.bio = body.bio
  if (body.location !== undefined) update.location = body.location
  if (body.tagline !== undefined) update.tagline = body.tagline
  if (body.phone !== undefined) update.phone = body.phone
  if (body.website !== undefined) update.website = body.website
  if (body.years_experience !== undefined) update.years_experience = Number(body.years_experience) || null
  if (body.skills !== undefined) update.skills = Array.isArray(body.skills) ? body.skills : [body.skills]
  if (body.skill_types !== undefined) update.skill_types = Array.isArray(body.skill_types) ? body.skill_types : [body.skill_types]
  if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url
  if (body.cover_url !== undefined) update.cover_url = body.cover_url
  if (body.business_email !== undefined) update.business_email = body.business_email

  const { error } = await supabase
    .from('profiles')
    .upsert(update, { onConflict: 'id' })

  if (error) return json({ error: 'Failed to sync profile', detail: error.message }, 500)

  return json({ success: true, user_id: userId })
})
