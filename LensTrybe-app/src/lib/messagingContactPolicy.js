import { normalizeSubscriptionTier } from './tierFeatures'

/** Shown when Basic/Pro thread owner policy blocks contact details in message body. */
export const MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE =
  'Sharing contact details is not available on your current plan. Upgrade to Expert or Elite to share contact information with clients.'

/** True when the creative who owns the thread is on Basic or Pro (contact sharing not allowed in messages). */
export function threadOwnerTierContactSharingRestricted(creativeSubscriptionTierRaw) {
  const t = normalizeSubscriptionTier(creativeSubscriptionTierRaw)
  return t === 'basic' || t === 'pro'
}

/** All whitespace removed — catches spaced-out emails, phones, handles. */
function collapseWhitespace(s) {
  return String(s ?? '').replace(/\s+/g, '')
}

/** Letters and digits only, lowercased — catches obfuscation with punctuation between chars. */
function alnumOnlyLower(s) {
  return String(s ?? '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

/** Digits only in order of appearance (strips spaces, dashes, etc. between digits). */
function digitsOnly(s) {
  return String(s ?? '').replace(/\D/g, '')
}

/** Run matcher on each string; first truthy wins. */
function anyVariant(strings, matcher) {
  for (const v of strings) {
    if (!v || v.length < 2) continue
    try {
      if (matcher(v)) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

const SOCIAL_KEYWORDS = [
  'instagram',
  'tiktok',
  'facebook',
  'messenger',
  'whatsapp',
  'telegram',
  'signal',
  'snapchat',
  'linkedin',
  'twitter',
  'youtube',
  'discord',
  'wechat',
  'viber',
]

/** Whole-word / boundary-safe keyword (original + collapsed + alnum). */
function containsSocialKeyword(original, collapsed, alnum) {
  const re = new RegExp(
    `\\b(?:${SOCIAL_KEYWORDS.join('|')})\\b`,
    'i',
  )
  if (re.test(original)) return true
  if (re.test(collapsed)) return true
  // alnum: "instagram" as substring (no word boundaries)
  const low = alnum
  for (const kw of SOCIAL_KEYWORDS) {
    if (low.includes(kw)) return true
  }
  return false
}

function testEmailStandard(s) {
  return /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}\b/.test(s)
}

/** Obfuscated email: word at word dot tld, brackets around @, (at), etc. */
function testEmailObfuscated(original, collapsed, alnum) {
  // "john at gmail dot com", "john[@]gmail.com", "john(at)gmail.com"
  if (
    /\b[a-z0-9][a-z0-9._+\-]*\s+(?:at|\(at\))\s+[a-z0-9][a-z0-9._+\-]*(?:\s+dot\s+[a-z]{2,}|\s*\.\s*[a-z]{2,})/i.test(
      original,
    )
  )
    return true
  if (/\b[a-z0-9][a-z0-9._+\-]*\s*\[\s*@\s*\]\s*[a-z0-9]/i.test(original)) return true
  if (/\b[a-z0-9][a-z0-9._+\-]*\s*\(\s*@\s*\)\s*[a-z0-9]/i.test(original)) return true
  // dot as word between domain parts
  if (/\b[a-z0-9][a-z0-9._+\-]*\s+dot\s+[a-z0-9]/i.test(original)) return true

  // Collapsed: "johnatgmaildotcom" style
  if (/[a-z0-9]{2,}(?:at|\(at\))[a-z0-9]{2,}dot[a-z]{2,}/i.test(collapsed)) return true
  if (/[a-z0-9]{2,}\[@[a-z0-9]{2,}/i.test(collapsed)) return true

  // alnum-only: johnatgmaildotcom
  if (/[a-z0-9]{2,}at[a-z0-9]{2,}dot[a-z]{2,}/.test(alnum)) return true

  return false
}

function testUrls(s) {
  if (/https?:\/\/[^\s)\]>'"]+/i.test(s)) return true
  if (/\bwww\.[^\s)\]>'"]+/i.test(s)) return true
  return false
}

function testCommonTlds(s) {
  return /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com\.au|co\.uk|com|net|org|io|co|au|me|biz|info|app|dev|shop)\b/i.test(
    s,
  )
}

function testAuPhones(s) {
  if (/\b04\d{2}\s?\d{3}\s?\d{3}\b/.test(s)) return true
  if (/\b614\d{2}\s?\d{3}\s?\d{3}\b/.test(s)) return true
  if (/\+61\s?4\d{2}\s?\d{3}\s?\d{3}\b/.test(s)) return true
  if (/\+61\s?[2378]\s?\d{4}\s?\d{4}\b/.test(s)) return true
  if (/\b0[2378]\s?\d{4}\s?\d{4}\b/.test(s)) return true
  if (/\(\s*0[2378]\s*\)\s*\d{4}\s*\d{4}/.test(s)) return true
  if (/\b1[38]00\s?\d{3}\s?\d{3}\b/i.test(s)) return true
  // Spaced mobile: 04 12 345 678, 0412 345 678, +61 412 345 678 (flexible digit groups)
  if (/\b04(?:\s*\d){8}\b/.test(s)) return true
  if (/\b614(?:\s*\d){8}\b/.test(s)) return true
  if (/\+61\s*4(?:\s*\d){8}\b/.test(s)) return true
  return false
}

function testInternationalPlus(s) {
  return /\+(?!61)[\d\s().-]{10,24}\d\b/.test(s)
}

/** 8+ digits in order when non-digits removed (spaced-out numbers, hyphens, etc.). */
function testLongDigitRun(s) {
  return digitsOnly(s).length >= 8
}

/** @handle — also on collapsed to catch "@ j o h n". */
function testAtHandle(s) {
  return /@[A-Za-z0-9_][A-Za-z0-9_.]{1,31}/.test(s)
}

/** "instagram: johnsmith", "find me on tiktok", "dm on instagram", etc. */
function testSocialPhrases(original, collapsed, alnum) {
  if (
    /\b(?:ig|insta|instagram|tiktok|tt|facebook|fb|linkedin|twitter|x\.com|youtube|yt|snapchat|discord)\s*[:@]\s*@?[a-z0-9._-]{2,}/i.test(
      original,
    )
  )
    return true
  // Platform + underscore/dash-separated handle (no @)
  if (
    /\b(?:ig|insta|instagram|tiktok|facebook|fb|linkedin|twitter|youtube|snapchat|discord)\s*[:@]?\s*[a-z0-9][a-z0-9]*(?:[_-][a-z0-9]{2,}){1,}[a-z0-9]*\b/i.test(
      original,
    )
  )
    return true
  if (/\bfind\s+(?:me\s+)?on\s+(?:ig|insta|instagram|tiktok|facebook|fb|linkedin|twitter|youtube|snapchat|discord)\b/i.test(original))
    return true
  if (/\b(?:message|msg|dm)\s+(?:me\s+)?on\s+(?:whatsapp|telegram|signal|instagram|tiktok|facebook|discord)\b/i.test(original))
    return true
  if (/\b(?:add|follow)\s+(?:me\s+)?on\s+/i.test(original) && containsSocialKeyword(original, collapsed, alnum))
    return true

  const c = collapsed.toLowerCase()
  if (/instagram:[a-z0-9._-]{2,}/i.test(c)) return true
  if (/(?:findmeon|addon|followmeon)(?:instagram|tiktok|facebook)/.test(alnum)) return true

  return false
}

/** Bare profile URLs without scheme (e.g. instagram.com/user, x.com/handle). */
function testSocialProfileDomains(s) {
  return /\b(?:instagram|facebook|tiktok|linkedin|twitter|x)\.com\/[^\s)\]>'"]+/i.test(s)
}

function testTelegramDiscordWa(original, collapsed, alnum) {
  if (/\b(?:t\.me|telegram\.me)\/[^\s)\]>'"]+/i.test(original)) return true
  if (/\b(?:t\.me|telegram\.me)\/[^\s)\]>'"]+/i.test(collapsed)) return true
  if (/\bwa\.me\/\d+/i.test(original)) return true
  if (/\bwa\.me\/\d+/i.test(collapsed)) return true
  // Discord user#0000
  if (/\b[A-Za-z0-9_.]{2,32}#\d{4}\b/.test(original)) return true
  if (/\b[A-Za-z0-9_.]{2,32}#\d{4}\b/.test(collapsed)) return true
  if (/discord(?:app)?\.com\/(invite|users)\//i.test(original)) return true
  // WhatsApp + number context
  if (/\bwhatsapp\b/i.test(original) && digitsOnly(original).length >= 8) return true
  if (/\bwhatsapp\b/i.test(collapsed) && digitsOnly(collapsed).length >= 8) return true
  if (alnum.includes('whatsapp') && digitsOnly(original).length >= 8) return true

  return false
}

/**
 * Detects emails, phones, URLs, social handles, messaging platforms, and common obfuscation in free text.
 * Tests the original message, a whitespace-collapsed copy, and an alphanumeric-only copy where useful.
 */
export function messageBodyContainsContactDetails(text) {
  const original = String(text ?? '')
  if (!original || original.trim().length < 2) return false

  const collapsed = collapseWhitespace(original)
  const alnum = alnumOnlyLower(original)

  const variantsStandard = [original, collapsed]

  if (anyVariant(variantsStandard, testEmailStandard)) return true
  if (testEmailObfuscated(original, collapsed, alnum)) return true

  if (anyVariant(variantsStandard, testUrls)) return true
  if (anyVariant(variantsStandard, testCommonTlds)) return true

  if (anyVariant(variantsStandard, testAuPhones)) return true
  if (anyVariant(variantsStandard, testInternationalPlus)) return true
  if (testLongDigitRun(original)) return true

  if (anyVariant(variantsStandard, testAtHandle)) return true
  if (anyVariant(variantsStandard, testSocialProfileDomains)) return true

  if (containsSocialKeyword(original, collapsed, alnum)) return true
  if (testSocialPhrases(original, collapsed, alnum)) return true
  if (testTelegramDiscordWa(original, collapsed, alnum)) return true

  return false
}
