import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [clientAccount, setClientAccount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserData(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserData(session.user.id)
      else { setProfile(null); setClientAccount(null); setLoading(false) }
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

    setProfile(profileData)
    setClientAccount(clientData)
    setLoading(false)
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
