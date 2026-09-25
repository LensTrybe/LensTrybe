import { supabase } from './supabaseClient'

// Pull the friendly { error } message out of a failed Edge Function call.
async function functionErrorMessage(error, fallback) {
  try {
    const ctx = error?.context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json()
      if (j?.error) return j.error
    }
  } catch { /* keep fallback */ }
  return fallback
}

/**
 * Account deletion actions (delete-account Edge Function):
 * 'preview' | 'request_code' | 'confirm' ({ code, reason }) | 'reactivate'.
 * Throws an Error with a user-friendly message on failure.
 */
export async function accountAction(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { action, ...extra } })
  if (error) throw new Error(await functionErrorMessage(error, 'Something went wrong. Please try again.'))
  if (data?.error) throw new Error(data.error)
  return data
}

/** Download a ZIP of everything in the signed-in account (export-account-data). */
export async function downloadMyData() {
  const { data, error } = await supabase.functions.invoke('export-account-data', { body: {} })
  if (error) throw new Error(await functionErrorMessage(error, 'Could not prepare your data. Please try again.'))
  const blob = data instanceof Blob ? data : new Blob([data])
  if (!blob.size) throw new Error('Could not prepare your data. Please try again.')
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `lenstrybe-data-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function formatDeletionDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}
