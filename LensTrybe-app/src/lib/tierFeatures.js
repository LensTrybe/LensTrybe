// The single source of truth for what each plan includes.
//
// Everything that gates, counts or advertises a feature reads this file: the public
// pricing page, the Subscription page, the sidebar, every gated page, and the database
// rules (mirrored in the tier_limits table, kept in step by a migration).
//
// Rules of the road:
//  * Change a number here, not in a page. If a page hardcodes a limit, that is a bug.
//  * UNLIMITED is Infinity, so `used < limit` works without special cases.
//  * Anything a creative pays for is also enforced server side. The values here are for
//    the interface; `tier_limits` in the database is generated from them.
//
// Decided by Michael, 12 September 2026 (the Tier Matrix review).

/** @typedef {'basic'|'pro'|'expert'|'elite'} SubscriptionTierKey */

export const UNLIMITED = Number.POSITIVE_INFINITY

export const TIER_ORDER = ['basic', 'pro', 'expert', 'elite']

export const TIER_META = {
  basic: { name: 'Basic', monthly: 0, annual: 0, colour: '#8a8a9a', tagline: 'Get found. Build your presence.' },
  pro: { name: 'Pro', monthly: 24.99, annual: 249.90, colour: '#1DB954', tagline: 'Look the part and take bookings.' },
  expert: { name: 'Expert', monthly: 74.99, annual: 749.90, colour: '#a855f7', tagline: 'Run your whole business in one place.' },
  elite: { name: 'Elite', monthly: 149.99, annual: 1499.90, colour: '#EAB308', tagline: 'Studio-level power for teams.' },
}

export const TIER_FEATURES = {
  basic: {
    // Profile and portfolio
    portfolioPhotos: 5,
    portfolioVideos: 0,
    publicListing: true,
    showPhone: false,
    searchRank: 4,
    searchScope: 'city',
    planBadge: false,
    responseBadge: false,
    homepageRotation: false,
    eliteSpotlight: false,
    disciplines: 1,

    // Their website
    website: 'none',
    homeMedia: 0,
    customDomain: false,

    // Clients, bookings and money
    bookingsPerMonth: 3,
    repliesPerMonth: 5,
    shareContactDetails: false,
    quotes: false,
    invoicing: false,
    contracts: false,
    crmRecords: 0,
    clientPortals: false,
    deliverGb: 0,
    brandKit: false,
    insights: 'none',
    lumi: false,

    // Community, team and work
    reviewRequests: false,
    importedReviews: 0,
    marketplaceListings: 0,
    jobBoard: 'none',
    assignCalendarTasks: false,
    teamSeats: 0,
    studioProfile: false,
  },

  pro: {
    portfolioPhotos: 20,
    portfolioVideos: 1,
    publicListing: true,
    showPhone: false,
    searchRank: 3,
    searchScope: 'state',
    planBadge: true,
    responseBadge: false,
    homepageRotation: false,
    eliteSpotlight: false,
    disciplines: 1,

    website: 'onepage',
    homeMedia: 3,
    customDomain: false,

    bookingsPerMonth: 5,
    repliesPerMonth: 20,
    shareContactDetails: false,
    quotes: false,
    invoicing: false,
    contracts: false,
    crmRecords: 25,
    clientPortals: false,
    deliverGb: 1,
    brandKit: false,
    insights: 'basic',
    lumi: false,

    reviewRequests: true,
    importedReviews: 0,
    marketplaceListings: 5,
    jobBoard: 'state',
    assignCalendarTasks: false,
    teamSeats: 0,
    studioProfile: false,
  },

  expert: {
    portfolioPhotos: 40,
    portfolioVideos: 5,
    publicListing: true,
    showPhone: true,
    searchRank: 2,
    searchScope: 'national',
    planBadge: true,
    responseBadge: true,
    homepageRotation: true,
    eliteSpotlight: false,
    disciplines: 2,

    website: 'full',
    homeMedia: 8,
    customDomain: true,

    bookingsPerMonth: UNLIMITED,
    repliesPerMonth: UNLIMITED,
    shareContactDetails: true,
    quotes: true,
    invoicing: true,
    contracts: true,
    crmRecords: 500,
    clientPortals: true,
    deliverGb: 50,
    brandKit: true,
    insights: 'full',
    lumi: true,

    reviewRequests: true,
    importedReviews: 5,
    marketplaceListings: 15,
    jobBoard: 'national',
    assignCalendarTasks: true,
    teamSeats: 0,
    studioProfile: false,
  },

  elite: {
    portfolioPhotos: UNLIMITED,
    portfolioVideos: 10,
    publicListing: true,
    showPhone: true,
    searchRank: 1,
    searchScope: 'national',
    planBadge: true,
    responseBadge: true,
    homepageRotation: true,
    eliteSpotlight: true,
    disciplines: 2,

    website: 'full',
    homeMedia: 12,
    customDomain: true,

    bookingsPerMonth: UNLIMITED,
    repliesPerMonth: UNLIMITED,
    shareContactDetails: true,
    quotes: true,
    invoicing: true,
    contracts: true,
    crmRecords: UNLIMITED,
    clientPortals: true,
    deliverGb: 200,
    brandKit: true,
    insights: 'full',
    lumi: true,

    reviewRequests: true,
    importedReviews: 10,
    marketplaceListings: UNLIMITED,
    jobBoard: 'national',
    assignCalendarTasks: true,
    teamSeats: 5,
    studioProfile: true,
  },
}

// Which dashboard insight widgets each depth of `insights` unlocks. Anything a creative's
// plan does not cover still appears on their board, blurred, with an upgrade panel.
export const INSIGHT_WIDGETS = {
  none: ['profile_strength', 'search_visibility'],
  basic: ['profile_strength', 'search_visibility', 'enquiries', 'bookings', 'reviews', 'revenue'],
  full: ['profile_strength', 'search_visibility', 'enquiries', 'bookings', 'reviews', 'revenue',
    'leads', 'cashflow', 'quotes', 'deliverables'],
}

// Revenue is the one widget with two depths: Pro sees the month's total, Expert and Elite
// get the full breakdown and history.
export const INSIGHT_DEPTH = { none: 0, basic: 1, full: 2 }

/**
 * Normalises the tier strings that come back from the database and older UI, so gating
 * always matches billing. Anything unrecognised falls back to basic.
 * @param {unknown} raw
 * @returns {SubscriptionTierKey}
 */
export function normalizeSubscriptionTier(raw) {
  const t = String(raw ?? 'basic').toLowerCase().trim()
  if (t === 'vip') return 'elite'
  return TIER_ORDER.includes(t) ? t : 'basic'
}

/**
 * Every feature value for a tier.
 * @param {unknown} tier
 * @returns {typeof TIER_FEATURES.basic}
 */
export function getFeatures(tier) {
  return TIER_FEATURES[normalizeSubscriptionTier(tier)] || TIER_FEATURES.basic
}

/**
 * True when the plan includes a feature at all. Works for booleans, for counts (any limit
 * above zero counts as included) and for the levelled features.
 * @param {unknown} tier
 * @param {keyof typeof TIER_FEATURES.basic} key
 */
export function tierHas(tier, key) {
  const v = getFeatures(tier)[key]
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v > 0
  return v !== 'none' && v != null
}

/**
 * The cheapest plan that includes a feature, for the wording on an upgrade panel.
 * @param {keyof typeof TIER_FEATURES.basic} key
 * @returns {SubscriptionTierKey|null}
 */
export function lowestTierWith(key) {
  return TIER_ORDER.find((t) => tierHas(t, key)) || null
}

/**
 * Is `tier` at least `minTier`?
 * @param {unknown} tier
 * @param {SubscriptionTierKey} minTier
 */
export function meetsTier(tier, minTier) {
  return TIER_ORDER.indexOf(normalizeSubscriptionTier(tier)) >= TIER_ORDER.indexOf(minTier)
}

const num = (v) => (v === UNLIMITED ? 'Unlimited' : String(v))
const gb = (v) => (v === UNLIMITED ? 'Unlimited' : `${v}GB`)
/** "1 photo" but "5 photos", and "Unlimited photos". */
const many = (v, one, plural) => `${num(v)} ${v === 1 ? one : plural}`

// Every gated feature, in the order it reads best on a pricing card, with the wording each
// plan's value turns into. Returning null means the feature is left off that plan's list.
export const FEATURE_CATALOG = [
  { id: 'portfolioPhotos', label: 'Portfolio photos', say: (v) => many(v, 'portfolio photo', 'portfolio photos') },
  { id: 'portfolioVideos', label: 'Portfolio videos', say: (v) => (v ? many(v, 'portfolio video', 'portfolio videos') : null) },
  { id: 'publicListing', label: 'Public profile', say: (v) => (v ? 'Public profile and listing' : null) },
  { id: 'searchScope', label: 'Search reach', say: (v) => ({ city: 'Found across your city', state: 'Found across your state', national: 'Found Australia wide' }[v]) },
  { id: 'searchRank', label: 'Search placement', say: (v) => ({ 4: 'Standard search placement', 3: 'Raised search placement', 2: 'Priority search placement', 1: 'Top search placement' }[v]) },
  { id: 'planBadge', label: 'Plan badge', say: (v, tier) => (v ? `${TIER_META[tier].name} badge on your profile` : null) },
  { id: 'responseBadge', label: 'Response time badge', say: (v) => (v ? 'Response time badge' : null) },
  { id: 'showPhone', label: 'Phone on profile', say: (v) => (v ? 'Show your phone number on your profile' : null) },
  { id: 'website', label: 'Website', say: (v) => ({ none: null, onepage: 'Your own website: Home and Contact', full: 'Your own five page website' }[v]) },
  { id: 'customDomain', label: 'Custom domain', say: (v) => (v ? 'Use your own domain name' : null) },
  { id: 'bookingsPerMonth', label: 'Bookings', say: (v) => (v === UNLIMITED ? 'Unlimited bookings' : `${many(v, 'booking', 'bookings')} a month`) },
  { id: 'repliesPerMonth', label: 'Message replies', say: (v) => (v === UNLIMITED ? 'Unlimited message replies' : `${many(v, 'message reply', 'message replies')} a month`) },
  { id: 'shareContactDetails', label: 'Contact sharing', say: (v) => (v ? 'Share your contact details in messages' : null) },
  { id: 'quotes', label: 'Quotes', say: (v) => (v ? 'Send quotes clients can accept' : null) },
  { id: 'invoicing', label: 'Invoicing', say: (v) => (v ? 'Branded invoices and payment tracking' : null) },
  { id: 'contracts', label: 'Contracts', say: (v) => (v ? 'Contracts and e-signatures' : null) },
  { id: 'crmRecords', label: 'CRM', say: (v) => (v ? `CRM: ${many(v, 'client record', 'client records')}` : null) },
  { id: 'clientPortals', label: 'Client portals', say: (v) => (v ? 'Branded client portals' : null) },
  { id: 'deliverGb', label: 'Deliver storage', say: (v) => (v ? `LensTrybe Deliver: ${gb(v)}` : null) },
  { id: 'brandKit', label: 'Brand kit', say: (v) => (v ? 'Brand kit across your documents and site' : null) },
  { id: 'insights', label: 'Business insights', say: (v) => ({ none: null, basic: 'Profile and enquiry insights', full: 'Full business insights and cash flow' }[v]) },
  { id: 'lumi', label: 'Lumi AI', say: (v) => (v ? 'Lumi, your AI assistant' : null) },
  { id: 'reviewRequests', label: 'Review requests', say: (v) => (v ? 'Request reviews from past clients' : null) },
  { id: 'importedReviews', label: 'Imported reviews', say: (v) => (v ? `Import ${many(v, 'review', 'reviews')} from elsewhere` : null) },
  { id: 'marketplaceListings', label: 'Marketplace', say: (v) => (v ? `Gear marketplace: ${many(v, 'listing', 'listings')}` : 'Browse the gear marketplace') },
  { id: 'jobBoard', label: 'Job board', say: (v) => ({ none: null, state: 'Apply for work in your state', national: 'Apply for work Australia wide' }[v]) },
  { id: 'assignCalendarTasks', label: 'Calendar assignment', say: (v) => (v ? 'Assign calendar tasks to your team' : null) },
  { id: 'teamSeats', label: 'Team', say: (v) => (v ? `Team: up to ${num(v)} members` : null) },
  { id: 'studioProfile', label: 'Studio profile', say: (v) => (v ? 'Studio profile page' : null) },
  { id: 'homepageRotation', label: 'Homepage rotation', say: (v) => (v ? 'Featured in the homepage rotation' : null) },
  { id: 'eliteSpotlight', label: 'Homepage spotlight', say: (v) => (v ? 'Elite spotlight on the homepage' : null) },
]

/**
 * The full feature list for a plan, already worded, in catalog order. Pricing cards show
 * the first few and the comparison table shows the lot, so neither can drift from the
 * values above.
 * @param {unknown} tier
 * @returns {string[]}
 */
export function planFeatureLines(tier) {
  const key = normalizeSubscriptionTier(tier)
  const f = getFeatures(key)
  return FEATURE_CATALOG
    .map((item) => item.say(f[item.id], key))
    .filter(Boolean)
}

/**
 * What a plan adds on top of the one below it: every feature whose value actually changed,
 * which is what a pricing card should lead with once "Everything in <lower plan>" has been
 * said. Compares values, not wording, so "40 portfolio photos" counts as a change from 20
 * while "Public profile and listing" does not.
 * @param {unknown} tier
 * @returns {string[]}
 */
export function planUpgradeLines(tier) {
  const key = normalizeSubscriptionTier(tier)
  const i = TIER_ORDER.indexOf(key)
  if (i <= 0) return planFeatureLines(key)
  const mine = getFeatures(key)
  const below = getFeatures(TIER_ORDER[i - 1])
  return FEATURE_CATALOG
    .filter((item) => mine[item.id] !== below[item.id])
    .map((item) => item.say(mine[item.id], key))
    .filter(Boolean)
}

// What each pricing card leads with. Curated for the sales story, but the wording and the
// numbers still come from TIER_FEATURES, so a card can never contradict the product. The
// full list lives in the comparison table below the cards.
export const PLAN_CARD_FEATURES = {
  basic: ['portfolioPhotos', 'publicListing', 'searchScope', 'bookingsPerMonth', 'repliesPerMonth', 'marketplaceListings'],
  pro: ['portfolioPhotos', 'portfolioVideos', 'website', 'bookingsPerMonth', 'repliesPerMonth', 'crmRecords', 'insights', 'reviewRequests', 'searchScope'],
  expert: ['portfolioPhotos', 'website', 'bookingsPerMonth', 'quotes', 'invoicing', 'contracts', 'crmRecords', 'clientPortals', 'deliverGb', 'brandKit', 'lumi', 'shareContactDetails'],
  elite: ['portfolioPhotos', 'crmRecords', 'deliverGb', 'teamSeats', 'studioProfile', 'customDomain', 'marketplaceListings', 'eliteSpotlight'],
}

/**
 * The worded lines for a plan's pricing card.
 * @param {unknown} tier
 * @returns {string[]}
 */
export function planCardLines(tier) {
  const key = normalizeSubscriptionTier(tier)
  const f = getFeatures(key)
  const byId = Object.fromEntries(FEATURE_CATALOG.map((item) => [item.id, item]))
  return (PLAN_CARD_FEATURES[key] || [])
    .map((id) => byId[id]?.say(f[id], key))
    .filter(Boolean)
}
