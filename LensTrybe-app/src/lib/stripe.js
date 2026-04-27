export const STRIPE_PRICE_IDS = {
  pro: {
    monthly: 'price_1TKKXSHW7LVs8k6s2IW7TXsd',
    annual: 'price_1TKKXVHW7LVs8k6snGkHjQE5',
  },
  expert: {
    monthly: 'price_1TKKXYHW7LVs8k6sboOI02xE',
    annual: 'price_1TKKXbHW7LVs8k6shpoFmKAi',
  },
  elite: {
    monthly: 'price_1TKKXjHW7LVs8k6sQNNIkiCf',
    annual: 'price_1TKKXfHW7LVs8k6s99ish4aV',
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

