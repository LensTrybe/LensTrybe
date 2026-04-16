import { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'

const tierOrder = { basic: 0, pro: 1, expert: 2, elite: 3 }

const features = {
  basic:  { messages: 5, portfolioPhotos: 5, portfolioVideos: 0, marketplace: false, invoicing: false, contracts: false, crm: false, brandKit: false, deliver: false, insights: false, team: false },
  pro:    { messages: 20, portfolioPhotos: 20, portfolioVideos: 1, marketplace: true, invoicing: true, contracts: false, crm: false, brandKit: false, deliver: false, insights: false, team: false },
  expert: { messages: 999, portfolioPhotos: 40, portfolioVideos: 5, marketplace: true, invoicing: true, contracts: true, crm: true, brandKit: true, deliver: true, insights: true, team: false },
  elite:  { messages: 999, portfolioPhotos: 999, portfolioVideos: 999, marketplace: true, invoicing: true, contracts: true, crm: true, brandKit: true, deliver: true, insights: true, team: true },
}

const SubscriptionContext = createContext(null)

export function SubscriptionProvider({ children }) {
  const { tier } = useAuth()
  const currentTier = tier?.toLowerCase() ?? 'basic'
  const currentFeatures = features[currentTier] ?? features.basic

  function hasFeature(feature) {
    return !!currentFeatures[feature]
  }

  function meetsMinTier(minTier) {
    return (tierOrder[currentTier] ?? 0) >= (tierOrder[minTier] ?? 0)
  }

  return (
    <SubscriptionContext.Provider value={{ tier: currentTier, features: currentFeatures, hasFeature, meetsMinTier }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  return ctx
}
