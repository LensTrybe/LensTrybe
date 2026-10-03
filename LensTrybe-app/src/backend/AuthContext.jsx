import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { event } from '../lib/analytics'

const AuthContext = createContext(null)

/** Set on LoginPage immediately before `signInWithOAuth({ provider: 'google' })`; cleared in `fetchUserData`. */
export const LT_GOOGLE_OAUTH_PENDING_KEY = 'lt_google_oauth'

/** One-shot message for JoinHubPage after Google OAuth when the user has no app account yet. */
export const LT_JOIN_FLASH_KEY = 'lt_join_flash'

/** Post-OAuth / magic-link: optional `sessionStorage.returnTo`, never hijack portal or deliver links. */
function consumeOAuthReturnRedirect() {
  if (typeof window === 'undefined') return
  // a Google return is sorted out in fetchUserData, once we know whether they have an account
  try { if (sessionStorage.getItem(LT_GOOGLE_OAUTH_PENDING_KEY) === '1') return } catch { /* ignore */ }
  const path = window.location.pathname
  if (path.startsWith('/portal/') || path.startsWith('/deliver/')) return
  const returnTo = sessionStorage.getItem('returnTo')
  if (returnTo && !returnTo.startsWith('/portal') && !returnTo.startsWith('/deliver')) {
    sessionStorage.removeItem('returnTo')
    window.location.href = returnTo
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [clientAccount, setClientAccount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Demo mode: no client, nobody signed in, nothing to wait for.
    if (!supabase) { setLoading(false); return undefined }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        consumeOAuthReturnRedirect()
        fetchUserData(session.user.id)
      } else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        if (event === 'SIGNED_IN') consumeOAuthReturnRedirect()
        fetchUserData(session.user.id)
      } else { setProfile(null); setClientAccount(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  // The welcome email goes out once the account is real: a confirmed address and a creative or
  // client row. Only for accounts made in the last week, once per device; send-welcome-email also
  // sends it only once per account. Covers email sign-up (after the confirm link) and Google.
  const confirmed = !!(user?.email_confirmed_at || user?.confirmed_at)
  const hasRow = !!(profile || clientAccount)
  useEffect(() => {
    if (!supabase || !user?.id || !confirmed || !hasRow) return
    if (Date.now() - new Date(user.created_at || 0).getTime() > 7 * 86400000) return
    const k = 'lt-welcome-' + user.id
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1') } catch { /* private mode: the server still sends it once */ }
    supabase.functions.invoke('send-welcome-email', { body: {} }).catch(() => {})
  }, [user?.id, confirmed, hasRow]) // eslint-disable-line react-hooks/exhaustive-deps

  // opts.silent: refresh profile in place without flipping `loading` (which unmounts
  // protected routes). Used after in-page changes like an admin plan switch.
  async function fetchUserData(userId, opts = {}) {
    if (!opts.silent) setLoading(true)
    // Own profile through my_profile() (security definer), so private columns can be hidden from
    // the profiles table itself; falls back to the table while the function is missing.
    let { data: profileRow, error: profileErr } = await supabase.rpc('my_profile').maybeSingle()
    if (profileErr) ({ data: profileRow } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())

    // Bank details and credential document links live in the owner-only
    // profile_private table (they are no longer on the publicly readable profile).
    let profileData = profileRow
    if (profileRow) {
      const { data: priv } = await supabase.from('profile_private').select('*').eq('id', userId).maybeSingle()
      if (priv) {
        const { id: _pid, updated_at: _pu, ...privFields } = priv
        profileData = { ...profileRow, ...privFields }
      }
    }

    const { data: clientData } = await supabase
      .from('client_accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    // Link any message threads that were created with this client's email but no client_user_id
    if (clientData) {
      try { await supabase.rpc('link_my_client_threads') } catch { /* best effort */ }
    }

    setProfile(profileData)
    setClientAccount(clientData)
    setLoading(false)

    if (typeof window === 'undefined') return
    let googleOAuthReturn = false
    try {
      googleOAuthReturn = sessionStorage.getItem(LT_GOOGLE_OAUTH_PENDING_KEY) === '1'
      if (googleOAuthReturn) sessionStorage.removeItem(LT_GOOGLE_OAUTH_PENDING_KEY)
    } catch {
      /* ignore */
    }

    if (googleOAuthReturn) {
      let kind = '', news = false, rt = ''
      try {
        kind = sessionStorage.getItem('lt_google_kind') || ''; news = sessionStorage.getItem('lt_google_news') === '1'
        rt = sessionStorage.getItem('returnTo') || ''
        sessionStorage.removeItem('lt_google_kind'); sessionStorage.removeItem('lt_google_news')
      } catch { /* ignore */ }
      const safe = rt.startsWith('/') && !rt.startsWith('//') ? rt : ''
      const go = to => { try { sessionStorage.removeItem('returnTo') } catch { /* ignore */ } window.location.replace(window.location.origin + to) }
      if (!profileData && !clientData) {
        // brand new to LensTrybe: make the account they chose
        if (kind === 'client') {
          const { data: { user: u } } = await supabase.auth.getUser()
          const m = u?.user_metadata || {}, full = String(m.full_name || m.name || '').trim()
          const { error: made } = await supabase.rpc('create_my_account', { p_kind: 'client', p_first: m.given_name || full.split(' ')[0] || '', p_last: m.family_name || full.split(' ').slice(1).join(' ') || '', p_skills: null, p_news: news })
          if (!made) event('client_account_created')
          return go(safe || '/portal')
        }
        if (kind === 'creative') { if (window.location.pathname !== '/onboarding') go('/onboarding?google=1'); return }
        // from the log in page with no account yet: choose creative or client first
        if (window.location.pathname !== '/join') go('/join?google=1')
        return
      }
      // an existing account: back to what they were doing, or their home
      const home = profileData ? '/app/today' : '/portal'
      const wrongSide = safe && ((profileData && safe.startsWith('/portal')) || (!profileData && safe.startsWith('/app')))
      if (safe && !wrongSide) return go(safe)
      if (['/', '/login', '/join', '/join/client', '/join/creative', '/onboarding'].includes(window.location.pathname)) return go(home)
      return
    }

    // Email and password signups get their profile built by the handle_new_user trigger,
    // so the check above never fires for them and they used to skip setup entirely. Catch
    // them on the way into the dashboard instead. Only the dashboard: bouncing someone off
    // the pricing or support page because they have not finished setup would be rude, and
    // the wizard itself has an escape hatch so nobody can be locked out.
    if (profileData && !profileData.onboarded_at && window.location.pathname.startsWith('/dashboard')) {
      window.location.replace(`${window.location.origin}/onboarding`)
    }
  }

  const isCreative = !!profile
  const isClient = !!clientAccount && !profile
  const tier = profile?.subscription_tier ?? 'basic'

  return (
    <AuthContext.Provider value={{ user, profile, clientAccount, loading, isCreative, isClient, tier, fetchUserData }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
