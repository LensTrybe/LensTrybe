import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Next runs in two modes (src/lib/mode.js). With no keys, or VITE_LT_MODE=demo, there is no
// client at all and every screen runs on the sample store; the live app throws here instead,
// which is right for it and wrong for a build that must always be showable without a login.
export const supabase = supabaseUrl && supabaseAnonKey && import.meta.env.VITE_LT_MODE !== 'demo' ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
}) : null
