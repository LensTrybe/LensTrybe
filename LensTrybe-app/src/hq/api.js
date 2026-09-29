// LensTrybe HQ talks to Supabase through its own client, with its own saved session, so an HQ
// login never mixes with a creative or client login in the same browser. Every read and write
// goes through the hq-api Edge Function, which checks staff, two-factor, session limits and role
// on the server. The page itself is trusted with nothing.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const hq = url && key ? createClient(url, key, {
  auth: { storageKey: 'lt-hq-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit' },
}) : null

async function call(fn, body) {
  const { data, error } = await hq.functions.invoke(fn, { body })
  if (!error) return data
  let server = null
  try { server = await error?.context?.json?.() } catch { /* not JSON */ }
  const e = new Error(server?.error || 'Something went wrong. Try again.')
  e.code = server?.error || 'failed'; e.status = error?.context?.status; e.data = server
  throw e
}
// Session problems the server reports; the app answers them (code again, or sign in again).
export const SESSION_CODES = ['signed_out', 'not_staff', 'needs_2fa', 'session_expired', 'session_idle']
let onSession = () => {}
export const onSessionProblem = f => { onSession = f }
export async function api(action, extra = {}) {
  try { return await call('hq-api', { action, ...extra }) } catch (e) { if (SESSION_CODES.includes(e.code)) onSession(e.code); throw e }
}
export const authCall = (action, extra = {}) => call('hq-auth', { action, ...extra })

// Where HQ's "open on the site" links go. The new site has been lenstrybe.com since the swap (30 Sep 2026).
export const SITE = 'https://lenstrybe.com'

export const PLAN = { basic: 'Trybe Free', pro: 'Trybe Essential', expert: 'Trybe Complete', elite: 'Trybe Studio' }
export const money = minor => '$' + (Number(minor || 0) / 100).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const TZ = { timeZone: 'Australia/Brisbane' }
export const day = iso => iso ? new Date(iso).toLocaleDateString('en-AU', { ...TZ, day: 'numeric', month: 'short', year: 'numeric' }) : ''
export const when = iso => iso ? new Date(iso).toLocaleString('en-AU', { ...TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''
export function ago(iso) {
  if (!iso) return 'Never'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago'
  return day(iso)
}
