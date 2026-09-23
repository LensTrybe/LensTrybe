// The disciplines and specialties LensTrybe offers, mirrored from the live app's creativeTypes.js.
// Launch scope is photographers and videographers; the other disciplines return after launch.
export const SPECIALTIES = {
  Photographer: ['Wedding', 'Portrait', 'Commercial', 'Real Estate', 'Events', 'Fashion', 'Product', 'Sports', 'Street', 'Architecture', 'Food', 'Newborn & Family', 'Maternity', 'Boudoir', 'Pet', 'School', 'Headshots', 'Documentary', 'Travel', 'Fine Art', 'Aerial', 'Night & Astro', 'Corporate'],
  Videographer: ['Wedding', 'Brand Film', 'Documentary', 'Events', 'Music Video', 'Social Media', 'Corporate', 'Sport', 'Real Estate', 'Travel', 'Short Film', 'Commercial', 'Aerial', 'News & Journalism'],
}
// Which demo tag each specialty maps to, until real profiles carry their own specialties.
export const TAG_FOR = { Wedding: 'wedding', 'Real Estate': 'realestate', 'Brand Film': 'brand', Commercial: 'brand', Product: 'brand', Events: 'event', Corporate: 'event', Portrait: 'portrait', Headshots: 'portrait', 'Newborn & Family': 'portrait', Maternity: 'portrait' }
export const matchesSpecialty = (x, name) => { const tag = TAG_FOR[name]; return tag ? x.t.includes(tag) : false }
