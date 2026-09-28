// The disciplines and specialties LensTrybe offers, mirrored from the live app's creativeTypes.js.
// Launch scope is photographers and videographers; the other disciplines return after launch.
export const SPECIALTIES = {
  Photographer: ['Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion', 'Product', 'Sports', 'Street', 'Architecture', 'Food', 'Newborn & Family', 'Maternity', 'Boudoir', 'Pet', 'School', 'Headshots', 'Documentary', 'Travel', 'Fine Art', 'Aerial', 'Night & Astro', 'Corporate'],
  Videographer: ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport', 'Real Estate', 'Travel', 'Short Film', 'Commercial', 'Aerial', 'News & Journalism'],
}
// Photography and videography are kept apart: a specialty is always "Photographer:Wedding" or
// "Videographer:Wedding", never just "Wedding", so a wedding photographer and a wedding
// videographer are two different searches.
export const DISC = { Photographer: 'photo', Videographer: 'video' }
export const SHORT = { Photographer: 'Photo', Videographer: 'Video' }
export const specKey = (type, name) => type + ':' + name
export const specParts = key => { const i = String(key).indexOf(':'); return i < 0 ? [null, String(key)] : [key.slice(0, i), key.slice(i + 1)] }
export const specLabel = (key, withType = false) => { const [type, name] = specParts(key); return withType && type ? name + ' · ' + SHORT[type] : name }
// Which sample tag each specialty maps to: only for the demo creatives and for real profiles that
// have not picked any specialties yet.
export const TAG_FOR = { Wedding: 'wedding', 'Real Estate': 'realestate', 'Brand Film': 'brand', Commercial: 'brand', Product: 'brand', Events: 'event', Corporate: 'event', Portrait: 'portrait', Headshots: 'portrait', 'Newborn & Family': 'portrait', Maternity: 'portrait' }
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
export const matchesSpecialty = (x, key) => {
  const [type, name] = specParts(key)
  // they have to do that discipline at all
  if (type && !x.t.includes(DISC[type])) return false
  // real profiles: the specialties they picked for that discipline, or their untyped list
  const byType = type && x.specBy ? x.specBy[type] || [] : []
  if (byType.length) return byType.some(s => same(s, name))
  if (x.specAny && x.specAny.length) return x.specAny.some(s => same(s, name))
  // demo creatives and profiles with no specialties yet: the broad tag
  const tag = TAG_FOR[name]; return tag ? x.t.includes(tag) : false
}
// ?s=wedding from older links: every specialty that tag stands for, in both disciplines
export const keysForTag = tag => Object.entries(SPECIALTIES).flatMap(([type, names]) => names.filter(n => TAG_FOR[n] === tag).map(n => specKey(type, n)))
