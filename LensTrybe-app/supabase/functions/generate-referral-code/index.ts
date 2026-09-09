import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sanitiseName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
    || 'USER'
}

async function generateUniqueCode(sb: any, baseName: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const digits = Math.floor(100 + Math.random() * 900).toString()
    const code = `LENS-${baseName}${digits}`
    const { data } = await sb
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()
    if (!data) return code
  }
  return `LENS-${baseName}${Date.now().toString().slice(-4)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '')
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const { data: profile } = await sb
      .from('profiles')
      .select('id, business_name, referral_code')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (profile.referral_code) {
      return new Response(JSON.stringify({ referral_code: profile.referral_code }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const firstName = (profile.business_name || 'USER').split(' ')[0]
    const baseName = sanitiseName(firstName)
    const code = await generateUniqueCode(sb, baseName)

    await sb.from('profiles').update({ referral_code: code }).eq('id', userId)

    return new Response(JSON.stringify({ referral_code: code }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
