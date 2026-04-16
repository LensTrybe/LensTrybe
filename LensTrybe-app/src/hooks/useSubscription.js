import { useEffect, useState } from 'react'
import useAuthUser from './useAuthUser'
import { supabase } from '../lib/supabaseClient'
import { getFeatures, normalizeSubscriptionTier } from '../lib/tierFeatures'

export const PROFILE_UPDATED_EVENT = 'lenstrybe-profile-updated'

export function emitProfileUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
  }
}

/**
 * Reliable subscription tier from `profiles` (normalized: lowercase, vip → elite).
 * Refetch when auth user changes or when `PROFILE_UPDATED_EVENT` fires on window.
 */
export function useSubscription() {
  const { user } = useAuthUser()
  const [tier, setTier] = useState(() => normalizeSubscriptionTier('basic'))
  const [subscriptionStatus, setSubscriptionStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [bump, setBump] = useState(0)

  useEffect(() => {
    const onUpd = () => setBump((b) => b + 1)
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpd)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpd)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setTier(normalizeSubscriptionTier('basic'))
      setSubscriptionStatus('active')
      setLoading(false)
      return undefined
    }

    if (!user?.id) {
      setTier(normalizeSubscriptionTier('basic'))
      setSubscriptionStatus('active')
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('useSubscription:', error.message)
          setTier(normalizeSubscriptionTier('basic'))
          setSubscriptionStatus('active')
        } else {
          setTier(normalizeSubscriptionTier(data?.subscription_tier))
          setSubscriptionStatus(String(data?.subscription_status || 'active').toLowerCase())
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, bump])

  const normalized = normalizeSubscriptionTier(tier)
  const features = getFeatures(normalized)
  const isPro = ['pro', 'expert', 'elite'].includes(normalized)
  const isExpert = ['expert', 'elite'].includes(normalized)
  const isElite = normalized === 'elite'

  return {
    tier: normalized,
    subscriptionStatus,
    loading,
    features,
    isPro,
    isExpert,
    isElite,
  }
}

export default useSubscription
