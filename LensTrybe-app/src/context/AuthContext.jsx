import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

/** Set on LoginPage immediately before `signInWithOAuth({ provider: 'google' })`; cleared in `fetchUserData`. */
export const LT_GOOGLE_OAUTH_PENDING_KEY = 'lt_google_oauth'

/** Post-OAuth / magic-link: optional `sessionStorage.returnTo` — never hijack portal or deliver links. */
function consumeOAuthReturnRedirect() {
  if (typeof window === 'undefined') return
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

  async function fetchUserData(userId) {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    const { data: clientData } = await supabase
      .from('client_accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    // Link any message threads that were created with this client's email but no client_user_id
    if (clientData) {
      await supabase
        .from('message_threads')
        .update({ client_user_id: userId })
        .eq('client_email', clientData.email)
        .is('client_user_id', null)
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
    if (googleOAuthReturn && profileData && window.location.pathname === '/') {
      window.location.replace(`${window.location.origin}/dashboard`)
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
