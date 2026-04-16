import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function useAuthUser() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [errorMessage, setErrorMessage] = useState(
    supabase ? '' : 'Supabase is not configured.',
  )

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return
        const initialSession = data?.session ?? null
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        if (error?.message && !initialSession) setErrorMessage(String(error.message))
        else setErrorMessage('')
        setLoading(false)
      })
      .catch((e) => {
        if (!isMounted) return
        // If something goes wrong, don't forcibly sign the user out.
        // We can still rely on onAuthStateChange updates.
        setErrorMessage(e?.message ? String(e.message) : '')
        setLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return
      }
      setSession(session ?? null)
      setUser(session?.user ?? null)
      setErrorMessage('')
      setLoading(false)
    })
    const subscription = data?.subscription

    return () => {
      isMounted = false
      subscription?.unsubscribe?.()
    }
  }, [])

  return { user, session, loading, errorMessage }
}

export default useAuthUser
