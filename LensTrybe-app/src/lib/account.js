// Account lifecycle, both modes: change email, password reset, newsletter preference, export,
// and delete with the grace period. Live calls the same functions the live site does:
// delete-account (preview / request_code / confirm / reactivate), export-account-data,
// email-preferences (me / set / unsubscribe / resubscribe). Demo resolves the same shapes.
import { supabase } from '../backend/supabaseClient'
import { LIVE } from './mode'
import { accountAction as liveAccountAction, downloadMyData as liveDownload, formatDeletionDate } from '../backend/accountData'

export { formatDeletionDate }
const wait = ms => new Promise(r => setTimeout(r, ms))
const origin = () => (typeof window !== 'undefined' ? window.location.origin : '')

// Change the login email. Supabase sends a link to both addresses; the change lands when both are clicked.
export async function changeEmail(current, next, userEmail) {
  if (String(current || '').trim().toLowerCase() !== String(userEmail || '').trim().toLowerCase()) return { error: "That doesn't match your current email address." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(next || '').trim())) return { error: 'A real email for the new address.' }
  if (!LIVE) return { ok: true }
  const { error } = await supabase.auth.updateUser({ email: String(next).trim() })
  return error ? { error: error.message } : { ok: true }
}

// A reset link to the signed-in address (the settings way of changing a password)
export async function sendPasswordReset(email) {
  if (!LIVE) return { ok: true }
  const { error } = await supabase.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo: origin() + '/reset-password' })
  if (error && /security purposes|rate limit|too many/i.test(error.message || '')) return { error: 'Too soon. Give it a minute and try again.' }
  return { ok: true }
}

// The Trybe Edit: am I on it, turn it on or off, and the one-click links from the emails
async function prefs(body) {
  const { data, error } = await supabase.functions.invoke('email-preferences', { body })
  if (error) throw new Error(await fnError(error, 'Could not update email preferences. Try again.'))
  if (data?.error) throw new Error(data.error)
  return data || {}
}
export async function newsletterStatus() { if (!LIVE) return { subscribed: true }; return prefs({ action: 'me' }) }
export async function setNewsletter(subscribed) { if (!LIVE) return { ok: true }; await prefs({ action: 'set', subscribed: !!subscribed }); return { ok: true } }
export async function unsubscribeToken(token) { if (!LIVE) { await wait(600); if (token === 'bad') throw new Error('bad'); return { ok: true } } return prefs({ action: 'unsubscribe', token }) }
export async function resubscribeToken(token) { if (!LIVE) return { ok: true }; return prefs({ action: 'resubscribe', token }) }

// Everything in the account as a ZIP (live) or the sample store as JSON (demo)
export async function downloadMyData(demoStore) {
  if (LIVE) return liveDownload()
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(demoStore, null, 2)], { type: 'application/json' })); a.download = 'lenstrybe-export-' + new Date().toISOString().slice(0, 10) + '.json'; a.click()
}

// Delete: preview (what it affects, grace days), request_code (6 digits to the account email),
// confirm ({ code, reason }) → scheduled, reactivate within the grace period.
export async function accountAction(action, extra = {}) {
  if (LIVE) return liveAccountAction(action, extra)
  await wait(400)
  if (action === 'preview') return { grace_days: 30, email_masked: 'm•••@studio.com.au', subscription: { tier: 'expert', next_charge_date: '2026-12-25' }, impact: { client_portals: 3, active_deliveries: 1, unpaid_invoices: 1, team_members: 0 } }
  if (action === 'request_code') return { sent_to: 'm•••@studio.com.au', expires_minutes: 15 }
  if (action === 'confirm') { if (extra.code !== '123456') throw new Error('That code is not right. Check the email, or ask for a new one.'); return { deletion_date: new Date(Date.now() + 30 * 864e5).toISOString() } }
  if (action === 'reactivate') return { ok: true }
  return {}
}

async function fnError(error, fallback) {
  try { const ctx = error?.context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); if (j?.error) return j.error } } catch { /* keep fallback */ }
  return fallback
}
