import { normalizeSubscriptionTier } from './tierFeatures'

/** Shown when Basic/Pro thread owner policy blocks contact details in message body. */
export const MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE =
  'Sharing contact details is not available on your current plan. Upgrade to Expert or Elite to share contact information with clients.'

/** True when the creative who owns the thread is on Basic or Pro (contact sharing not allowed in messages). */
export function threadOwnerTierContactSharingRestricted(creativeSubscriptionTierRaw) {
  const t = normalizeSubscriptionTier(creativeSubscriptionTierRaw)
  return t === 'basic' || t === 'pro'
}

/**
 * Detects emails, common AU/international phone patterns, and URLs / website-like strings in free text.
 * Does not validate RFC completeness — intended to catch typical user attempts to share contact off-platform.
 */
export function messageBodyContainsContactDetails(text) {
  const s = String(text ?? '')
  if (!s || s.trim().length < 2) return false

  // Email: local@domain.tld
  if (/\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}\b/.test(s)) return true

  // http(s) URLs
  if (/https?:\/\/[^\s)\]>'"]+/i.test(s)) return true

  // www. links
  if (/\bwww\.[^\s)\]>'"]+/i.test(s)) return true

  // Common TLDs (e.g. site.com, site.com.au)
  if (
    /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com\.au|co\.uk|com|net|org|io|co|au|me|biz|info|app|dev|shop)\b/i.test(
      s,
    )
  )
    return true

  // Australian mobiles: 04xx xxx xxx, 614… , +61 4…
  if (/\b04\d{2}\s?\d{3}\s?\d{3}\b/.test(s)) return true
  if (/\b614\d{2}\s?\d{3}\s?\d{3}\b/.test(s)) return true
  if (/\+61\s?4\d{2}\s?\d{3}\s?\d{3}\b/.test(s)) return true

  // AU landlines / regional +61
  if (/\+61\s?[2378]\s?\d{4}\s?\d{4}\b/.test(s)) return true
  if (/\b0[2378]\s?\d{4}\s?\d{4}\b/.test(s)) return true
  if (/\(\s*0[2378]\s*\)\s*\d{4}\s*\d{4}/.test(s)) return true

  // 1300 / 1800
  if (/\b1[38]00\s?\d{3}\s?\d{3}\b/i.test(s)) return true

  // Other international (+ not starting with 61 — AU handled above)
  if (/\+(?!61)[\d\s().-]{10,24}\d\b/.test(s)) return true

  return false
}
