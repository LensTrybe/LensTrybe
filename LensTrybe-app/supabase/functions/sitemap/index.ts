// sitemap: the dynamic sitemaps for lenstrybe.com (2 Oct 2026). Vercel proxies
// /sitemap-creatives.xml and /sitemap-edit.xml here (vercel.json), so Google reads them on
// lenstrybe.com. Public data only: listed creatives' ids and published Trybe Edit issues.
// type=local (2 Oct 2026): the local pages, /photographers/brisbane and the like, mirrored from
// src/lib/places.js. Only pages with enough creatives are listed; change both files together.
// No JWT, because a crawler has none; nothing here is private.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const SITE = 'https://lenstrybe.com'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const day = (t: string | null) => (t ? new Date(t).toISOString().slice(0, 10) : null)
const xml = (urls: { loc: string; lastmod?: string | null; freq?: string; pri?: string }[]) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.freq ? `<changefreq>${u.freq}</changefreq>` : ''}${u.pri ? `<priority>${u.pri}</priority>` : ''}</url>`).join('\n') +
  '\n</urlset>\n'

// Mirrors src/lib/places.js (PLACES, the kind slugs and MIN_FOR)
const PLACES: [string, string[]][] = [
  ['brisbane', ['brisbane', 'west end', 'fortitude valley', 'new farm', 'paddington', 'south brisbane', 'chermside', 'carindale', 'indooroopilly', 'toowong', 'bulimba', 'wynnum', 'sandgate', 'kangaroo point', 'woolloongabba', 'teneriffe', 'ascot', 'hamilton']],
  ['gold-coast', ['gold coast', 'surfers paradise', 'broadbeach', 'burleigh', 'southport', 'coolangatta', 'robina', 'palm beach', 'currumbin', 'nerang', 'hope island', 'coomera', 'main beach', 'tamborine']],
  ['sunshine-coast', ['sunshine coast', 'noosa', 'maroochydore', 'mooloolaba', 'caloundra', 'coolum', 'buderim', 'maleny', 'montville', 'peregian', 'sunshine beach', 'nambour', 'eumundi', 'kawana']],
  ['noosa', ['noosa', 'sunshine beach', 'peregian', 'tewantin', 'cooroy', 'eumundi']],
  ['moreton-bay', ['moreton bay', 'caboolture', 'narangba', 'redcliffe', 'north lakes', 'morayfield', 'strathpine', 'bribie island', 'burpengary', 'deception bay', 'kallangur', 'petrie', 'dayboro', 'samford', 'scarborough']],
  ['ipswich', ['ipswich', 'springfield', 'goodna', 'redbank', 'rosewood']],
  ['logan', ['logan', 'beenleigh', 'springwood', 'shailer park', 'jimboomba', 'browns plains', 'loganholme']],
  ['redlands', ['redlands', 'redland', 'cleveland', 'capalaba', 'victoria point', 'thornlands', 'stradbroke', 'wellington point']],
  ['toowoomba', ['toowoomba']],
]
const SPECIALTIES: Record<string, string[]> = {
  Photographer: ['Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion', 'Product', 'Sports', 'Street', 'Architecture', 'Food', 'Newborn & Family', 'Maternity', 'Boudoir', 'Pet', 'School', 'Headshots', 'Documentary', 'Travel', 'Fine Art', 'Aerial', 'Night & Astro', 'Corporate'],
  Videographer: ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport', 'Real Estate', 'Travel', 'Short Film', 'Commercial', 'Aerial', 'News & Journalism'],
}
const PLURAL: Record<string, string> = { Photographer: 'photographers', Videographer: 'videographers' }
const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const low = (s: unknown) => String(s || '').trim().toLowerCase()

// deno-lint-ignore no-explicit-any
function localPages(rows: any[]) {
  const urls: { loc: string; freq: string; pri: string }[] = []
  for (const [place, names] of PLACES) {
    const here = rows.filter((r) => [r.city || r.location, ...(r.site_service_areas || [])].map(low).filter(Boolean).some((w) => names.some((n) => w.includes(n))))
    for (const [type, specs] of Object.entries(SPECIALTIES)) {
      const doers = here.filter((r) => (r.skill_types || []).includes(type))
      if (doers.length >= 1) urls.push({ loc: `${SITE}/${PLURAL[type]}/${place}`, freq: 'weekly', pri: '0.8' })
      for (const spec of specs) {
        const n = doers.filter((r) => {
          const by = (r.specialties_by_type && r.specialties_by_type[type]) || []
          const list = by.length ? by : (r.specialties || [])
          return list.some((s: string) => low(s) === low(spec))
        }).length
        if (n >= 2) urls.push({ loc: `${SITE}/${slugify(spec)}-${PLURAL[type]}/${place}`, freq: 'weekly', pri: '0.7' })
      }
    }
  }
  return urls
}

Deno.serve(async (req) => {
  const type = new URL(req.url).searchParams.get('type') || 'creatives'
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  let urls: { loc: string; lastmod?: string | null; freq?: string; pri?: string }[] = []
  if (type === 'local') {
    const { data } = await sb.from('profiles').select('city, location, site_service_areas, skill_types, specialties, specialties_by_type')
      .eq('is_listed', true).eq('account_type', 'creative').or('is_admin.is.null,is_admin.eq.false').or('pending_deletion.is.null,pending_deletion.eq.false').limit(45000)
    urls = localPages(data || [])
  } else if (type === 'edit') {
    const { data } = await sb.from('edit_issues').select('slug, publish_at').order('n', { ascending: false }).limit(5000)
    const now = Date.now()
    urls = (data || []).filter((r) => r.slug && (!r.publish_at || new Date(r.publish_at).getTime() <= now))
      .map((r) => ({ loc: `${SITE}/edit/${encodeURIComponent(r.slug)}`, lastmod: day(r.publish_at), freq: 'monthly', pri: '0.6' }))
  } else {
    const { data } = await sb.from('profiles').select('id, created_at')
      .eq('is_listed', true).eq('account_type', 'creative').or('is_admin.is.null,is_admin.eq.false').or('pending_deletion.is.null,pending_deletion.eq.false').limit(45000)
    urls = (data || []).map((r) => ({ loc: `${SITE}/creatives/${r.id}`, lastmod: day(r.created_at), freq: 'weekly', pri: '0.7' }))
  }
  return new Response(xml(urls), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
})
