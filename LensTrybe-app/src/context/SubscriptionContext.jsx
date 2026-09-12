import { createContext, useContext, useMemo } from 'react'
import { useAuth } from './AuthContext'
import {
  getFeatures,
  normalizeSubscriptionTier,
  meetsTier,
  tierHas,
  lowestTierWith,
  TIER_ORDER,
  TIER_META,
} from '../lib/tierFeatures'

// Plan access for the whole dashboard. Every value comes from src/lib/tierFeatures.js,
// which is the one place plan contents are defined. This file used to carry a second,
// slightly different copy of that table, which is how the pricing pages and the sidebar
// drifted apart. Do not put feature values back in here.

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { tier } = useAuth()
  const currentTier = normalizeSubscriptionTier(tier)

  const value = useMemo(() => {
    const features = getFeatures(currentTier)
    return {
      tier: currentTier,
      meta: TIER_META[currentTier],
      features,

      /** Does this plan include the feature at all? */
      hasFeature: (key) => tierHas(currentTier, key),

      /** The numeric or levelled value, for limits and depths. */
      limit: (key) => features[key],

      /** Is the creative on at least this plan? */
      meetsMinTier: (minTier) => meetsTier(currentTier, minTier),

      /** Cheapest plan that includes the feature, for upgrade wording. */
      tierNeededFor: (key) => lowestTierWith(key),

      tierOrder: TIER_ORDER,
    }
  }, [currentTier])

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  return ctx
}
