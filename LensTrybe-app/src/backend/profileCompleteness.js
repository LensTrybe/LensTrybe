// Single source of truth for what a "complete" (live) creative profile is.
//
// A profile is a live listing when every item here is done (100%). The same
// checklist powers the dashboard completeness figure, the Profile strength
// widget, and the founding-creative listing gate, so "100%" means exactly the
// same thing everywhere.
//
// Optional-by-design and NOT counted here: ABN, insurance/credentials, extra
// socials beyond the first. LensTrybe can be a hobby for some creatives, so
// these never block reaching 100%.

import { supabase } from './supabaseClient'

// Minimum portfolio pieces for a complete listing (founding + general).
export const PORTFOLIO_MIN = 8
// Minimum bio length so a bio is a real paragraph, not a word.
export const BIO_MIN = 40

const has = (v) => v != null && String(v).trim() !== ''

// The canonical checklist. `portfolioCount` is supplied by the caller (use
// fetchPortfolioCount below so every caller counts the same way).
export function completenessItems(profile, portfolioCount = 0) {
  const p = profile || {}
  const anySocial = [p.instagram_url, p.tiktok_url, p.linkedin_url, p.facebook_url, p.twitter_url].some(has)
  return [
    { key: 'photo', label: 'Add a profile photo', hint: 'Appear in search and Featured Creatives', tab: 'basics', done: has(p.avatar_url) },
    { key: 'name', label: 'Add your business name', hint: 'How clients find you', tab: 'basics', done: has(p.business_name) },
    { key: 'tagline', label: 'Write a tagline', hint: 'One line that sells you', tab: 'basics', done: has(p.tagline) },
    { key: 'bio', label: 'Write your bio', hint: `At least ${BIO_MIN} characters`, tab: 'basics', done: has(p.bio) && String(p.bio).trim().length >= BIO_MIN },
    { key: 'contact', label: 'Add contact details', hint: 'Phone or website', tab: 'basics', done: has(p.phone) || has(p.website) },
    { key: 'skills', label: 'Choose your skills', hint: 'What you offer', tab: 'skills', done: Array.isArray(p.skill_types) && p.skill_types.length > 0 },
    { key: 'specialties', label: 'Add your specialties', hint: 'Your niche within each skill', tab: 'skills', done: Array.isArray(p.specialties) && p.specialties.length > 0 },
    { key: 'location', label: 'Set your location', hint: 'City and state', tab: 'location', done: has(p.city) && has(p.state) },
    { key: 'social', label: 'Link a social account', hint: 'Instagram, TikTok and more', tab: 'social', done: anySocial },
    { key: 'portfolio', label: `Upload ${PORTFOLIO_MIN}+ portfolio pieces`, hint: `${portfolioCount} added so far`, tab: 'portfolio', done: portfolioCount >= PORTFOLIO_MIN },
  ]
}

export function completenessFromItems(items) {
  const total = items.length
  const doneCount = items.filter((i) => i.done).length
  const pct = total ? Math.round((doneCount / total) * 100) : 0
  return { total, doneCount, pct, remaining: total - doneCount, isComplete: doneCount === total }
}

// Everything a caller needs: the checklist items plus the summary numbers.
export function computeCompleteness(profile, portfolioCount = 0) {
  const items = completenessItems(profile, portfolioCount)
  return { items, ...completenessFromItems(items) }
}

// Count portfolio pieces consistently. The portfolio_items table has both
// creative_id and user_id in the wild, so match either to avoid an
// off-by-source count.
export async function fetchPortfolioCount(userId) {
  if (!userId) return 0
  try {
    const { count } = await supabase
      .from('portfolio_items')
      .select('id', { count: 'exact', head: true })
      .or(`creative_id.eq.${userId},user_id.eq.${userId}`)
    return count ?? 0
  } catch {
    return 0
  }
}
