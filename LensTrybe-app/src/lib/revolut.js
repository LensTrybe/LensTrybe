// Revolut Merchant checkout (sandbox-first).
// Loads Revolut's embed.js SDK, asks our edge function for an order token,
// then opens the hosted card popup. savePaymentMethodFor: 'merchant' saves the
// card so the recurring-charge job can bill it off-session each period.

const SDK_SRC = {
  sandbox: 'https://sandbox-merchant.revolut.com/embed.js',
  production: 'https://merchant.revolut.com/embed.js',
}

let sdkPromise = null

function loadRevolutSdk(env) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.RevolutCheckout) return Promise.resolve(window.RevolutCheckout)
  if (sdkPromise) return sdkPromise
  const src = SDK_SRC[env] || SDK_SRC.sandbox
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve(window.RevolutCheckout)
    s.onerror = () => {
      sdkPromise = null
      reject(new Error('Failed to load Revolut SDK'))
    }
    document.head.appendChild(s)
  })
  return sdkPromise
}

// Returns 'success' | 'cancel'. Throws on error.
export async function payWithRevolut({ user, tier, billing, fullName }) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!baseUrl) throw new Error('Missing VITE_SUPABASE_URL')
  if (!user?.id || !user?.email) throw new Error('Please sign in first')

  const res = await fetch(`${baseUrl}/functions/v1/create-revolut-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
      tier,
      billing,
      fullName: fullName || '',
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(txt || `Order failed (${res.status})`)
  }
  const { token, env } = await res.json()
  if (!token) throw new Error('No checkout token returned')

  const RevolutCheckout = await loadRevolutSdk(env)
  const mode = env === 'production' ? 'prod' : 'sandbox'

  return new Promise((resolve, reject) => {
    RevolutCheckout(token, mode)
      .then((instance) => {
        instance.payWithPopup({
          savePaymentMethodFor: 'merchant',
          onSuccess() { resolve('success') },
          onCancel() { resolve('cancel') },
          onError(e) { reject(e instanceof Error ? e : new Error(String(e?.message || e))) },
        })
      })
      .catch(reject)
  })
}
