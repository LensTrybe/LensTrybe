// Which LensTrybe Next is this: the demo (sample store, no login, always showable) or live
// (the real Supabase project, real accounts, real money in sandbox until launch)?
//
// Live needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (never committed) or in
// the Vercel project's environment. VITE_LT_MODE=demo forces the demo even when keys exist.
// Every feature keeps both paths: the demo is what the design is shown with, live is the product.
import { supabase } from '../backend/supabaseClient'

export const LIVE = !!supabase
export const DEMO = !LIVE
export const MODE = LIVE ? 'live' : 'demo'
