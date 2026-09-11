// Revolut Merchant checkout (sandbox-first).
// Loads Revolut's embed.js SDK, asks our edge function for an order token,
// then opens the hosted card popup. savePaymentMethodFor: 'merchant' saves the
// card so the recurring-charge job can bill it off-session each period.

import { supabase } from './supabaseClient.js'

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
export async function payWithRevolut({ user, tier, billing, fullName, referralCode }) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!baseUrl) throw new Error('Missing VITE_SUPABASE_URL')
  if (!user?.id || !user?.email) throw new Error('Please sign in first')

  // Signed-in creatives are identified by their session token. During signup there is
  // no session yet (email confirmation is pending), so the server falls back to a
  // tightly limited check of the brand new account using userId + email.
  let accessToken = ''
  try {
    const { data } = await supabase.auth.getSession()
    accessToken = data?.session?.access_token || ''
  } catch { /* no session */ }
  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${baseUrl}/functions/v1/create-revolut-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
      tier,
      billing,
      fullName: fullName || '',
      referralCode: referralCode || '',
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    let msg = ''
    try { msg = JSON.parse(txt)?.error || '' } catch { /* not JSON */ }
    throw new Error(msg || txt || `Order failed (${res.status})`)
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

// ---- Update the saved card on an existing subscription ----

// supabase.functions.invoke hides the server's message on non-2xx responses; read it back.
async function invokeError(error, data) {
  try {
    const body = await error?.context?.json?.()
    if (body?.error) return body.error
  } catch { /* not JSON */ }
  return data?.error || error?.message || 'Something went wrong. Please try again.'
}

// The card saved on the creative's subscription: { brand, last4, expMonth, expYear } or null.
export async function getSavedCard() {
  const { data, error } = await supabase.functions.invoke('update-payment-method', { body: { action: 'card' } })
  if (error) return null
  return data?.card || null
}

// Opens Revolut's card popup to save a new card (nothing is charged), then makes it the
// subscription's card. A past-due payment is retried on the new card straight away.
// Returns { cancelled: true } or { ok, card, retried, paid, status }. Throws on error.
export async function updateSavedCard() {
  const { data, error } = await supabase.functions.invoke('update-payment-method', { body: { action: 'start' } })
  if (error || !data?.token) throw new Error(await invokeError(error, data))

  const RevolutCheckout = await loadRevolutSdk(data.env)
  const mode = data.env === 'production' ? 'prod' : 'sandbox'
  const outcome = await new Promise((resolve, reject) => {
    RevolutCheckout(data.token, mode)
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
  if (outcome === 'cancel') return { cancelled: true }

  const conf = await supabase.functions.invoke('update-payment-method', { body: { action: 'confirm', orderId: data.orderId } })
  if (conf.error || !conf.data?.ok) throw new Error(await invokeError(conf.error, conf.data))
  return conf.data
}
