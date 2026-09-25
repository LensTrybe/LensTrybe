// Sign up, log in, reset: one layer the pages call, in both modes. Live talks to the real
// Supabase project exactly the way the live site does (same metadata, same functions, same
// rules); demo resolves the same shapes without a backend so the design is always showable.
//
// Rules carried over from the live site, do not loosen:
// - Email confirmation is on: signUp returns no session; the account is usable after the link.
// - The handle_new_user trigger builds the profile (creative) or client_accounts row (client)
//   from the signUp metadata and applies a founding code. Everyone starts on Basic; a paid
//   tier is granted by the server once the card is saved (create-revolut-order + webhook).
// - A saved card is required for every paid plan, at signup, no charge until the free period ends.
// - Business names are moderated before signUp. Founding codes are validated by `founding-code`.
// - The reset form never says whether an address has an account.
// - Wrong password on log in: the live site sends you to Join with the email carried across.
import { supabase } from '../backend/supabaseClient'
import { LIVE } from './mode'
import { moderateText } from '../backend/moderateContent'
import { FOUNDING_TERMS_VERSION } from '../backend/foundingTerms'
import { payWithRevolut } from '../backend/revolut'
import { LT_GOOGLE_OAUTH_PENDING_KEY } from '../backend/AuthContext'

export const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
export const PASSWORD_MIN = 8
// Founding codes are personal (a name and a number), 4 to 64 characters, checked by the function
export const FOUNDING_RE = /^[A-Z0-9][A-Z0-9-]{2,62}[A-Z0-9]$/
const origin = () => (typeof window !== 'undefined' ? window.location.origin : '')

// Which kind of account a signed-in user is: 'creative' | 'client' | null
export async function accountKind(userId) {
  if (!LIVE || !userId) return null
  const { data: p } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (p) return 'creative'
  const { data: c } = await supabase.from('client_accounts').select('id').eq('id', userId).maybeSingle()
  return c ? 'client' : null
}

// Where each kind lands after log in
export const homeFor = kind => (kind === 'client' ? '/portal' : kind === 'creative' ? '/app/today' : '/')

// Log in with a password. Resolves { kind } or { error, code } where code is 'invalid' for a
// wrong email/password (the live site treats that as "no account, go and join").
export async function signIn(email, password, demoKind = 'creative') {
  if (!LIVE) return { kind: demoKind }
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(email || '').trim(), password })
  if (error) {
    const m = String(error.message || '').toLowerCase()
    return { error: error.message, code: m.includes('invalid login credentials') ? 'invalid' : m.includes('not confirmed') ? 'unconfirmed' : 'other' }
  }
  return { kind: await accountKind(data.user?.id) }
}

// Google. The live site sets a session flag so AuthContext knows to send a brand new
// Google user to onboarding. Next keeps the flag; its onboarding is the plan step.
export async function signInWithGoogle(next = '/') {
  if (!LIVE) return { ok: true }
  try { sessionStorage.setItem(LT_GOOGLE_OAUTH_PENDING_KEY, '1'); if (next && next !== '/') sessionStorage.setItem('returnTo', next) } catch { /* ignore */ }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin() + '/' } })
  return error ? { error: error.message } : { ok: true }
}

export async function signOut() {
  if (!LIVE) return
  await supabase.auth.signOut()
}

// A founding code, checked with the founding-code function before anything is created.
// Resolves { valid: true, tier } or { valid: false, reason }.
export async function checkFoundingCode(code) {
  const c = String(code || '').trim().toUpperCase()
  if (!FOUNDING_RE.test(c)) return { valid: false, reason: 'format' }
  if (!LIVE) return { valid: true, tier: 'expert', code: c }
  const { data, error } = await supabase.functions.invoke('founding-code', { body: { action: 'validate', code: c } })
  if (error || !data?.valid) return { valid: false, reason: data?.reason || 'invalid' }
  return { valid: true, tier: data?.tier || 'expert', code: c }
}
export function foundingReason(reason) {
  if (reason === 'format') return 'That does not look like a code. Copy it from your invite email.'
  if (reason === 'rate_limited') return 'Too many tries. Give it a few minutes and try again.'
  if (reason === 'expired') return 'This invite code has expired. Reply to your invite email and we can send a fresh one.'
  if (reason === 'redeemed' || reason === 'already_redeemed') return 'This code has already been used to create an account. Try logging in instead.'
  if (reason === 'cancelled') return 'This invite code is no longer active. Reply to your invite email if that seems wrong.'
  return "We couldn't find that code. Check it matches the one in your invite email."
}

// Create a creative account. Fields: first, last, email, password, disc (Photographer |
// Videographer | Both), tier (basic | pro | expert | elite), billing ('monthly' | 'annual'),
// code (founding, already validated), news (marketing opt in), referral.
// Resolves { ok, userId, needsConfirm } or { error }. For a paid tier the card popup runs
// here, after the account exists and before the check-email page, as on the live site.
export async function signUpCreative(f) {
  const email = String(f.email || '').trim(), password = String(f.password || '')
  if (!isEmail(email)) return { error: 'A real email, it is how you log in.' }
  if (password.length < PASSWORD_MIN) return { error: 'A password of at least eight characters.' }
  const business = (f.business || (f.first + ' ' + f.last)).trim()
  if (!LIVE) return { ok: true, userId: 'demo', needsConfirm: false }
  const mod = await moderateText(business)
  if (mod?.blocked) return { error: mod.reason || 'That name cannot be used.' }
  const tier = f.code ? (f.tier || 'expert') : (f.tier || 'basic')
  let userId = f.userId, needsConfirm = true
  if (!userId) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: origin() + '/app/today?welcome=1',
        data: {
          account_type: 'creative', marketing_opt_in: f.news ? 'true' : 'false',
          business_name: business, first_name: f.first, last_name: f.last,
          display_name_preference: 'business_only', country: 'Australia', city: f.city || '', state: f.state || '',
          skill_types: f.disc === 'Both' ? ['Photographer', 'Videographer'] : [f.disc || 'Photographer'],
          subscription_tier: tier,
          ...(f.code ? { founding_code: f.code, founding_terms_version: FOUNDING_TERMS_VERSION, founding_terms_ua: (navigator.userAgent || '').slice(0, 400) } : {}),
        },
      },
    })
    if (error) return { error: friendly(error.message) }
    userId = data?.user?.id
    if (!userId) return { error: 'The account could not be created. Try again in a moment.' }
    needsConfirm = !data.session
    try { await supabase.functions.invoke('send-welcome-email', { body: { user_id: userId } }) } catch { /* the email is a nicety, the account is made */ }
  }
  if (tier !== 'basic') {
    let result
    try { result = await payWithRevolut({ user: { id: userId, email }, tier, billing: f.billing || 'monthly', fullName: (f.first + ' ' + f.last).trim(), referralCode: (f.referral || '').trim() }) }
    catch { return { error: 'The card window could not open. Press the button to try again.', userId } }
    if (result !== 'success') return { error: 'A card is needed to finish a paid plan. Nothing is charged until your free months end.', userId }
  }
  return { ok: true, userId, needsConfirm }
}

// Create a client account. Resolves { ok, needsConfirm } or { error }.
export async function signUpClient(f) {
  const email = String(f.email || '').trim(), password = String(f.password || '')
  if (!isEmail(email)) return { error: 'A real email, it is how you log in.' }
  if (password.length < PASSWORD_MIN) return { error: 'A password of at least eight characters.' }
  if (!LIVE) return { ok: true, needsConfirm: true }
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: origin() + '/portal', data: { account_type: 'client', first_name: f.first, last_name: f.last, company_name: f.co || '', marketing_opt_in: f.news ? 'true' : 'false' } },
  })
  if (error) return { error: friendly(error.message) }
  if (data.session) {
    // confirmation off: the trigger has made the row, nothing else to insert
    return { ok: true, needsConfirm: false }
  }
  return { ok: true, needsConfirm: true }
}

// Send the confirmation email again
export async function resendConfirmation(email) {
  if (!LIVE) return { ok: true }
  const { error } = await supabase.auth.resend({ type: 'signup', email: String(email || '').trim(), options: { emailRedirectTo: origin() + '/app/today?welcome=1' } })
  return error ? { error: error.message } : { ok: true }
}

// Reset: ask for the link (never reveals whether the address exists), verify the link, set the password
export async function requestReset(email) {
  const address = String(email || '').trim().toLowerCase()
  if (!isEmail(address)) return { error: 'A real email, the one you log in with.' }
  if (!LIVE) return { ok: true }
  const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: origin() + '/reset-password' })
  // Only a rate limit is worth reporting; anything else would reveal whether the address is a member
  if (error && /security purposes|rate limit|too many/i.test(error.message || '')) return { error: friendly(error.message) }
  return { ok: true }
}
export async function verifyRecovery(tokenHash) {
  if (!LIVE) return { ok: tokenHash === 'demo' }
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    return error ? { ok: false } : { ok: true }
  }
  const { data } = await supabase.auth.getSession()
  const fromFragment = typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  return { ok: !!(data?.session && fromFragment) }
}
export async function setNewPassword(password) {
  if (password.length < PASSWORD_MIN) return { error: 'At least eight characters.' }
  if (!LIVE) return { ok: true }
  const { error } = await supabase.auth.updateUser({ password })
  return error ? { error: error.message } : { ok: true }
}

// Supabase's messages, in the site's voice
function friendly(m) {
  const s = String(m || '')
  if (/already registered|already exists/i.test(s)) return 'There is already an account with that email. Log in, or reset the password if it has slipped.'
  if (/rate limit|too many/i.test(s)) return 'Too many tries. Give it a few minutes.'
  if (/known to be weak|easy to guess|pwned|leak/i.test(s)) return 'That password turns up in known data leaks, so it is not safe to use. Pick a different one.'
  if (/password/i.test(s) && /weak|short|least/i.test(s)) return 'A stronger password: eight characters or more.'
  if (/only request this after|security purposes/i.test(s)) return 'Too soon. Give it a minute and try again.'
  return s || 'Something went wrong. Try again.'
}
