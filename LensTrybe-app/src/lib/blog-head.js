// What the blog tells Google and link previews (4 Oct 2026): titles, descriptions, canonicals,
// structured data and the call to action for each audience. Pure, like markdown.js, so the
// browser (applySeo) and the pre-render function (api/render.js) build exactly the same head.
import { esc, renderInline } from './markdown.js'

export const SITE = 'https://lenstrybe.com'
export const DEFAULT_IMAGE = SITE + '/og-image.png'
const LOGO = SITE + '/android-chrome-512x512.png'
const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'LensTrybe', url: SITE + '/', logo: { '@type': 'ImageObject', url: LOGO } }

export const AUDIENCES = {
  clients: { key: 'clients', label: 'For clients', path: '/blog/clients' },
  creatives: { key: 'creatives', label: 'For creatives', path: '/blog/creatives' },
}

// The call to action under every post, unless the post sets its own cta_label and cta_href
export const CTA = {
  clients: { label: 'Post your job free', href: '/jobs', as: 'client', h: ['Post the job.', 'They come to you.'], line: 'Clients post free, always. Local photographers and videographers reply privately with a real quote, and you choose from your dashboard.' },
  creatives: { label: 'Join as a creative', href: '/join', as: 'creative', h: ['Keep 100% of', 'every job.'], line: 'No commission, ever. Your page, quotes, invoices, contracts, bookings and delivery in one place.' },
}
export const ctaFor = p => {
  const base = CTA[p?.audience] || CTA.creatives
  return p?.cta_label && p?.cta_href ? { ...base, label: p.cta_label, href: p.cta_href } : base
}

// The title's accent phrase is marked *like this*; plain text drops the asterisks.
export const plain = t => String(t || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim()
export const readTime = md => Math.max(1, Math.round(String(md || '').split(/\s+/).filter(Boolean).length / 220)) + ' min'
export const isDraft = r => !r?.approved || new Date(r.publish_at).getTime() > Date.now()
export const dateAU = t => (t ? new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' }) : '')
// "Updated" shows when the words changed more than a day after the post went up
export const wasUpdated = p => !!(p?.updated_at && p?.publish_at && new Date(p.updated_at) - new Date(p.publish_at) > 864e5)
const titleTag = t => (/lenstrybe/i.test(t) ? t : t + ' · LensTrybe')
const stripMd = s => String(s || '').replace(/[*_`#>]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()

// Everything the head needs for one post
export function postHead(p) {
  const path = '/blog/' + p.slug
  const aud = AUDIENCES[p.audience] || AUDIENCES.creatives
  const image = p.hero_url || DEFAULT_IMAGE
  const headline = plain(p.title)
  const graph = [
    {
      '@type': 'BlogPosting', '@id': SITE + path + '#post', headline: headline.slice(0, 110),
      description: p.meta_description || p.dek || undefined, image: [image],
      datePublished: p.publish_at || undefined, dateModified: p.updated_at || p.publish_at || undefined,
      author: { '@id': SITE + '/#org', '@type': 'Organization', name: 'LensTrybe', url: SITE + '/' },
      publisher: ORG, inLanguage: 'en-AU', mainEntityOfPage: SITE + path,
      articleSection: p.category || aud.label, isPartOf: { '@type': 'Blog', '@id': SITE + '/blog#blog', name: 'The LensTrybe blog', url: SITE + '/blog' },
    },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: SITE + '/blog' },
      { '@type': 'ListItem', position: 2, name: aud.label, item: SITE + aud.path },
      { '@type': 'ListItem', position: 3, name: headline, item: SITE + path },
    ] },
  ]
  const faq = (Array.isArray(p.faq) ? p.faq : []).filter(f => f && f.q && f.a)
  if (faq.length) graph.push({ '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: stripMd(f.q), acceptedAnswer: { '@type': 'Answer', text: renderInline(f.a) } })) })
  return {
    title: titleTag(plain(p.meta_title || p.title)), description: p.meta_description || p.dek || '',
    path, image, noindex: isDraft(p), type: 'article',
    jsonLd: JSON.parse(JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })),
  }
}

export { esc }
