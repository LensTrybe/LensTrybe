import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// What Google (and link previews) read for each page (2 Oct 2026). The site is one page app, so
// the head is set here as you move around: a title and description of its own for each public
// page, a canonical address (so /site/ and /p/ profiles count as the /creatives/ one), and
// structured data where it helps (the business, creative profiles, Trybe Edit issues).
// RouteSeo sets the page defaults; pages with their own data (a profile, an issue, a job) call
// applySeo again once it has loaded.

export const SITE = 'https://lenstrybe.com'
const DEFAULT_IMAGE = SITE + '/og-image.png'
const DEFAULT_DESC = 'Post a job for free and local photographers and videographers reply with a real quote. Australia\'s home for visual creatives. No commissions, ever.'

const ORG = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': SITE + '/#org', name: 'LensTrybe', url: SITE + '/', logo: SITE + '/android-chrome-512x512.png', email: 'connect@lenstrybe.com', slogan: 'Connect. Capture. Create.', areaServed: 'AU', address: { '@type': 'PostalAddress', addressLocality: 'Brisbane', addressRegion: 'QLD', addressCountry: 'AU' } },
    { '@type': 'WebSite', '@id': SITE + '/#site', name: 'LensTrybe', url: SITE + '/', publisher: { '@id': SITE + '/#org' }, inLanguage: 'en-AU' },
  ],
}

// Pages with fixed wording. Paths not here get the defaults; the ones in NOINDEX stay out of search.
const PAGES = {
  '/': ['LensTrybe · Photographers and videographers in South East Queensland', DEFAULT_DESC, ORG],
  '/creatives': ['Find a photographer or videographer · LensTrybe', 'Browse photographers and videographers across South East Queensland. See their work, packages and reviews, check a date and ask for a quote. No fee to ask.'],
  '/jobs': ['Post a photography or video job · LensTrybe', 'Post your photo or video job for free. Creatives who do that work reply with a real quote and you choose. LensTrybe never takes a cut.'],
  '/how-it-works': ['How LensTrybe works · LensTrybe', 'Post a job or find a creative, get quotes, sign, pay and receive your files in one place. How LensTrybe works for clients and for creatives.'],
  '/pricing': ['Pricing for creatives · LensTrybe', 'Plans for photographers and videographers, from free. The first three months are free on any paid plan, and there is no commission on your jobs, ever.'],
  '/founding': ['The Founding 100 · LensTrybe', 'The founding creatives programme: Trybe Complete free for twelve months for the first 100, then $49 a month locked in for life. By invitation.'],
  '/edit': ['The Trybe Edit · LensTrybe', 'LensTrybe\'s monthly read for photographers, videographers and the people who hire them.'],
  '/upcoming': ['What\'s coming to LensTrybe', 'The disciplines and features joining LensTrybe after launch.'],
  '/support': ['Help and support · LensTrybe', 'Answers to common questions, and how to reach the LensTrybe team.'],
  '/join': ['Join LensTrybe', 'Create a free account to post jobs, or join as a photographer or videographer.'],
  '/join/creative': ['Join LensTrybe as a creative', 'Join LensTrybe as a photographer or videographer. Free to start, no commission on your jobs, ever.'],
  '/join/client': ['Join LensTrybe to hire a creative', 'Create a free account to post jobs and hire photographers and videographers.'],
  '/legal/terms': ['Terms and conditions · LensTrybe', 'The agreement between you and LensTrybe.'],
  '/legal/privacy': ['Privacy policy · LensTrybe', 'What LensTrybe collects, why, and what we never do with it.'],
  '/legal/cookies': ['Cookies policy · LensTrybe', 'The cookies LensTrybe uses and why.'],
  '/legal/refunds': ['Refund policy · LensTrybe', 'How refunds work for LensTrybe subscriptions.'],
  '/legal/founding': ['Founding Creative Agreement · LensTrybe', 'The terms of the LensTrybe founding creatives programme.'],
}
const NOINDEX = /^\/(waitlist|login|check-email|forgot-password|reset-password|auth|unsubscribe|onboarding|booking-unavailable|edit\/confirm|p\/|portal|sign|deliver|meeting|doc|review|team|app|brand)(\/|$)/

const meta = (attr, key, value) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (value == null) { if (el) el.remove(); return }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el) }
  el.setAttribute('content', value)
}

export function applySeo({ title, description, path, image, jsonLd, noindex } = {}) {
  if (typeof document === 'undefined') return
  const t = title || PAGES['/'][0], d = description || DEFAULT_DESC, url = SITE + (path || '/'), img = image || DEFAULT_IMAGE
  document.title = t
  meta('name', 'description', d)
  meta('property', 'og:title', t); meta('property', 'og:description', d); meta('property', 'og:url', url); meta('property', 'og:image', img)
  meta('name', 'twitter:title', t); meta('name', 'twitter:description', d); meta('name', 'twitter:image', img)
  meta('name', 'robots', noindex ? 'noindex, follow' : null)
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link) }
  link.setAttribute('href', url)
  let ld = document.getElementById('seo-ld')
  if (jsonLd) {
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'seo-ld'; document.head.appendChild(ld) }
    ld.textContent = JSON.stringify(jsonLd)
  } else if (ld) ld.remove()
}

// The page defaults, on every route change. Profiles, issues and jobs then add their own.
export function RouteSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/'
    const p = PAGES[path]
    applySeo({ title: p?.[0], description: p?.[1], jsonLd: p?.[2], path, noindex: NOINDEX.test(path) })
  }, [pathname])
  return null
}

// A creative's profile as a business Google can show: name, place, work, links and rating.
export function profileLd(c, profile = {}) {
  const url = SITE + '/creatives/' + c.id
  const ld = {
    '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': url, url, name: c.n,
    description: (c.about || c.d || '').slice(0, 300) || undefined,
    image: c.cover || c.photos?.[0]?.url || c.avatar || undefined, logo: c.avatar || undefined,
    address: { '@type': 'PostalAddress', addressLocality: c.c || undefined, addressRegion: c.state || undefined, addressCountry: 'AU' },
    areaServed: [c.c, c.state].filter(Boolean).join(', ') || undefined,
    knowsAbout: [...new Set([...(profile.skill_types || []), ...Object.values(c.specBy || {}).flat()])].slice(0, 20),
    sameAs: [c.web, ...(c.socials || []).map(s => s[1])].filter(Boolean),
    priceRange: c.p ? 'From $' + Math.round(c.p) : undefined,
    isPartOf: { '@type': 'WebSite', name: 'LensTrybe', url: SITE + '/' },
  }
  if (c.rv > 0 && c.r > 0) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: c.r, reviewCount: c.rv, bestRating: 5, worstRating: 1 }
  return JSON.parse(JSON.stringify(ld))
}
