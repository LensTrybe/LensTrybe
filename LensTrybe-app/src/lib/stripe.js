export const STRIPE_PRICE_IDS = {
  pro: {
    monthly: 'price_1TGVFZHW7LVs8k6sElcIwbzg',
    annual: 'price_1T7V1rHW7LVs8k6sZjddvm2E',
  },
  expert: {
    monthly: 'price_1TGVM3HW7LVs8k6szXy5QvSW',
    annual: 'price_1TJV35HW7LVs8k6s7CU1RBeu',
  },
  elite: {
    monthly: 'price_1TGVMDHW7LVs8k6sKePKDibF',
    annual: 'price_1TJUfqHW7LVs8k6s0SdahBua',
  },
}

export function getPriceId(tier, billing) {
  const t = String(tier || '').toLowerCase()
  const b = String(billing || '').toLowerCase() === 'monthly' ? 'monthly' : 'annual'
  return STRIPE_PRICE_IDS?.[t]?.[b] || null
}

export async function redirectToCheckout(priceId, user) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!baseUrl) throw new Error('Missing VITE_SUPABASE_URL')
  if (!priceId) throw new Error('Missing Stripe priceId')
  if (!user?.id || !user?.email) throw new Error('Missing user')

  const response = await fetch(`${baseUrl}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId,
      userId: user.id,
      email: user.email,
    }),
  })

  if (!response.ok) {
    const txt = await response.text().catch(() => '')
    throw new Error(txt || `Checkout failed (${response.status})`)
  }

  const { url } = await response.json()
  if (!url) throw new Error('No checkout URL returned')
  window.location.href = url
}

