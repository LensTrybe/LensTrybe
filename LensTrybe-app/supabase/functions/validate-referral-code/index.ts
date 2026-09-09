import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const { code } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ valid: false, error: 'No code provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalised = String(code).toUpperCase().trim()

    const { data, error } = await sb
      .from('profiles')
      .select('id, business_name, referral_code')
      .eq('referral_code', normalised)
      .maybeSingle()

    if (error || !data) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid referral code' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ valid: true, referrer_name: data.business_name || 'a LensTrybe member' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
