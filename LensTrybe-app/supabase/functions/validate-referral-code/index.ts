import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ valid: false, error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    const { data: allowed, error: rlErr } = await sb.rpc('rate_limit_hit', { p_key: `validate-referral:ip:${ip}`, p_max: 20, p_window_seconds: 3600 })
    if (rlErr || allowed === false) return json({ valid: false, error: 'Too many attempts. Please try again later.' }, 429)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const normalised = String(body.code ?? '').toUpperCase().trim()
    if (!normalised || normalised.length > 32 || !/^[A-Z0-9_-]+$/.test(normalised)) {
      return json({ valid: false, error: 'Invalid referral code' })
    }

    const { data, error } = await sb
      .from('profiles')
      .select('business_name')
      .eq('referral_code', normalised)
      .maybeSingle()

    if (error || !data) return json({ valid: false, error: 'Invalid referral code' })

    return json({ valid: true, referrer_name: data.business_name || 'a LensTrybe member' })
  } catch (e) {
    console.error('validate-referral-code error', e)
    return json({ valid: false, error: 'Could not check that code right now.' }, 500)
  }
})
