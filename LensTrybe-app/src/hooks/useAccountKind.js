import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import useAuthUser from './useAuthUser'

/**
 * @returns {{ kind: 'creative' | 'client' | null, loading: boolean, refresh: () => void }}
 */
export default function useAccountKind() {
  const { user, loading: authLoading } = useAuthUser()
  const [kind, setKind] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (authLoading) return undefined
    if (!supabase || !user?.id) {
      setKind(null)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    ;(async () => {
      const { data: prof } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
      if (cancelled) return
      if (prof) {
        setKind('creative')
        setLoading(false)
        return
      }
      const { data: ca } = await supabase.from('client_accounts').select('id').eq('id', user.id).maybeSingle()
      if (cancelled) return
      if (ca) {
        setKind('client')
        setLoading(false)
        return
      }
      setKind(null)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, authLoading, tick])

  return {
    kind,
    loading: authLoading || loading,
    refresh: () => setTick((t) => t + 1),
  }
}
