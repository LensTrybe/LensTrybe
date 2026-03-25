import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function useAuthUser() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [errorMessage, setErrorMessage] = useState(
    supabase ? '' : 'Supabase is not configured.',
  )

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (!isMounted) {
        return
      }

      if (error) {
        setErrorMessage(error.message)
        setUser(null)
      } else {
        setErrorMessage('')
        setUser(data.user ?? null)
      }
      setLoading(false)
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return
      }
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading, errorMessage }
}

export default useAuthUser
