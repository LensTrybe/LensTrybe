import { SPECIALTIES, matchesSpecialty, specKey } from './specialties'

// Local pages for search (2 Oct 2026): /photographers/brisbane, /wedding-photographers/gold-coast
// and so on, one per kind of creative and place, listing the real creatives there. People search
// "wedding photographer Brisbane", not "LensTrybe", so these are the pages that can meet them.
// The sitemap edge function (supabase/functions/sitemap) mirrors PLACES, the slugs and the
// thresholds below; change both together.

// Places in South East Queensland. A creative counts for a place when their town or one of the
// areas they serve matches a name in its list.
export const PLACES = [
  { slug: 'brisbane', name: 'Brisbane', names: ['brisbane', 'west end', 'fortitude valley', 'new farm', 'paddington', 'south brisbane', 'chermside', 'carindale', 'indooroopilly', 'toowong', 'bulimba', 'wynnum', 'sandgate', 'kangaroo point', 'woolloongabba', 'teneriffe', 'ascot', 'hamilton'] },
  { slug: 'gold-coast', name: 'the Gold Coast', short: 'Gold Coast', pre: 'on the', names: ['gold coast', 'surfers paradise', 'broadbeach', 'burleigh', 'southport', 'coolangatta', 'robina', 'palm beach', 'currumbin', 'nerang', 'hope island', 'coomera', 'main beach', 'tamborine'] },
  { slug: 'sunshine-coast', name: 'the Sunshine Coast', short: 'Sunshine Coast', pre: 'on the', names: ['sunshine coast', 'noosa', 'maroochydore', 'mooloolaba', 'caloundra', 'coolum', 'buderim', 'maleny', 'montville', 'peregian', 'sunshine beach', 'nambour', 'eumundi', 'kawana'] },
  { slug: 'noosa', name: 'Noosa', names: ['noosa', 'sunshine beach', 'peregian', 'tewantin', 'cooroy', 'eumundi'] },
  { slug: 'moreton-bay', name: 'Moreton Bay', names: ['moreton bay', 'caboolture', 'narangba', 'redcliffe', 'north lakes', 'morayfield', 'strathpine', 'bribie island', 'burpengary', 'deception bay', 'kallangur', 'petrie', 'dayboro', 'samford', 'scarborough'] },
  { slug: 'ipswich', name: 'Ipswich', names: ['ipswich', 'springfield', 'goodna', 'redbank', 'rosewood'] },
  { slug: 'logan', name: 'Logan', names: ['logan', 'beenleigh', 'springwood', 'shailer park', 'jimboomba', 'browns plains', 'loganholme'] },
  { slug: 'redlands', name: 'the Redlands', short: 'Redlands', pre: 'in the', names: ['redlands', 'redland', 'cleveland', 'capalaba', 'victoria point', 'thornlands', 'stradbroke', 'wellington point'] },
  { slug: 'toowoomba', name: 'Toowoomba', names: ['toowoomba'] },
]
export const placeBySlug = s => PLACES.find(p => p.slug === s)
export const placeShort = p => p.short || p.name
// "in Brisbane", "on the Gold Coast", "in the Redlands"
export const placePre = p => p.pre || 'in'
export const at = p => placePre(p) + ' ' + placeShort(p)

const DISC_TAG = { Photographer: 'photo', Videographer: 'video' }
const PLURAL = { Photographer: 'photographers', Videographer: 'videographers' }
export const slugify = s => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Every kind: "photographers", then "wedding-photographers" and the rest, for both disciplines.
export const KINDS = Object.entries(SPECIALTIES).flatMap(([type, names]) => [
  { slug: PLURAL[type], type, spec: null, label: PLURAL[type][0].toUpperCase() + PLURAL[type].slice(1), one: type.toLowerCase() },
  ...names.map(n => ({ slug: slugify(n) + '-' + PLURAL[type], type, spec: n, label: n + ' ' + PLURAL[type], one: n.toLowerCase() + ' ' + type.toLowerCase() })),
])
export const kindBySlug = s => KINDS.find(k => k.slug === s)

// A page goes into search (and the sitemap) once it has enough creatives to be worth landing on:
// one for a discipline in a place, two for a specialty (with one, it would only repeat the
// discipline page). Below that it still opens, but tells search engines not to list it.
export const MIN_FOR = kind => kind.spec ? 2 : 1

export function inPlace(x, place) {
  const where = [x.c, ...(x.areas || [])].map(s => String(s || '').toLowerCase()).filter(Boolean)
  return where.some(w => place.names.some(n => w.includes(n)))
}
export function isKind(x, kind) {
  if (!x.t.includes(DISC_TAG[kind.type])) return false
  return kind.spec ? matchesSpecialty(x, specKey(kind.type, kind.spec)) : true
}
export const matching = (all, kind, place) => (all || []).filter(x => x.live !== false && inPlace(x, place) && isKind(x, kind))

// Every page with enough creatives to be listed, for the links on the directory and these pages
export function livePages(all) {
  const out = []
  for (const place of PLACES) for (const kind of KINDS) {
    const n = matching(all, kind, place).length
    if (n >= MIN_FOR(kind)) out.push({ kind, place, n, path: '/' + kind.slug + '/' + place.slug })
  }
  return out
}
