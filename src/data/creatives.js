// Sample creatives for the local preview. Invented people, invented work.
export const CREATIVES = [
  { id: 'mara', n: 'Mara Okafor', d: 'Wedding and elopement photography', short: 'Wedding photography', c: 'Noosa', state: 'QLD', p: 3200, r: 4.9, rv: 39, t: ['photo', 'wedding'], mood: 'golden', seed: 3, free: true, found: true, resp: 'about 2 hours',
    why: 'shoots Maleny and Noosa every month, full day sits at $3,200, and 14 November is open. Replies in about two hours.',
    about: 'Documentary weddings on the Sunshine Coast and anywhere in Queensland worth driving to. I shoot the day as it happens, no posed lists, and I stay until the good bit. Eleven years, 300 weddings, one very patient partner who carries the second body.',
    pk: [['Elopement', 1400, '3 hours · 120 photos'], ['Full day', 3200, '10 hours · 400+ photos'], ['Weekend', 4900, '2 days · second shooter']] },
  { id: 'beck', n: 'Beck Halloran', d: 'Wedding films', short: 'Wedding films', c: 'Maleny', state: 'QLD', p: 3800, r: 5.0, rv: 14, t: ['video', 'wedding'], mood: 'dusk', seed: 13, free: true, found: true, resp: 'about a day',
    why: 'films weddings only, mostly hinterland. $3,800 is above the brief but the highlight film is included.',
    about: 'Hinterland weddings on film. One camera on the day, a highlight film in three weeks, the full ceremony and speeches uncut.',
    pk: [['Highlight film', 2400, '4 min · 6 hours'], ['Full day film', 3800, '10 hours · highlights + full'], ['Two day', 5600, 'Rehearsal + wedding']] },
  { id: 'lena', n: 'Lena Hoang', d: 'Wedding photography', short: 'Wedding photography', c: 'Sunshine Beach', state: 'QLD', p: 2900, r: 4.9, rv: 52, t: ['photo', 'wedding'], mood: 'cool', seed: 29, free: true, found: false, resp: 'about 4 hours',
    why: '$2,900 for a full day, twelve minutes from Noosa, 52 verified bookings. Also free on the date.',
    about: 'Bright, editorial weddings by the water. Fifty-two weddings on LensTrybe and a gallery in ten days, every time.',
    pk: [['Half day', 1600, '5 hours · 200 photos'], ['Full day', 2900, '9 hours · 400 photos'], ['Full day + album', 3700, 'Fine art album, 30 pages']] },
  { id: 'priya', n: 'Priya Nair', d: 'Portraits and elopements', short: 'Portraits', c: 'Maroochydore', state: 'QLD', p: 1400, r: 4.7, rv: 19, t: ['photo', 'wedding', 'portrait'], mood: 'forest', seed: 9, free: true, found: false, resp: 'about 3 hours',
    why: 'elopement specialist. Only fits if the day is small.',
    about: 'Small weddings, big feelings. Elopements, families and headshots that look like the person.',
    pk: [['Portrait session', 380, '1 hour · 25 photos'], ['Elopement', 1400, '3 hours · 120 photos'], ['Family', 520, '90 min · 40 photos']] },
  { id: 'tane', n: 'Tane Whitfield', d: 'Brand films', short: 'Brand films', c: 'Fortitude Valley', state: 'QLD', p: 2600, r: 5.0, rv: 22, t: ['video', 'brand'], mood: 'night', seed: 11, free: true, found: true, resp: 'about an hour',
    why: 'brand films for hospitality, two café clients in the last quarter, $2,600 sits inside the budget.',
    about: 'Brand films for places people love: cafés, breweries, gyms. Half a day on site, a 60 second film and six cutdowns for social.',
    pk: [['Social pack', 1400, '6 cutdowns'], ['Brand film', 2600, '60s + 6 cutdowns'], ['Campaign', 5200, '3 films, 2 days']] },
  { id: 'ari', n: 'Ari Castellano', d: 'Brand and product', short: 'Product photography', c: 'West End', state: 'QLD', p: 2200, r: 4.8, rv: 29, t: ['photo', 'brand'], mood: 'rose', seed: 23, free: false, found: false, resp: 'about 6 hours',
    why: 'product and menu photography, strong on food. Booked on your date, free the week after.',
    about: 'Product, menu and campaign photography from a studio in West End. Food is the specialty.',
    pk: [['Menu shoot', 900, '2 hours · 30 dishes'], ['Brand day', 2200, '6 hours'], ['Campaign', 4200, '2 days + retouching']] },
  { id: 'ellie', n: 'Ellie Sørensen', d: 'Real estate photo and video', short: 'Real estate', c: 'Gold Coast', state: 'QLD', p: 900, r: 4.8, rv: 61, t: ['photo', 'video', 'realestate'], mood: 'cool', seed: 5, free: true, found: false, resp: 'about 30 minutes',
    why: 'shoots listings on the Gold Coast four days a week, 24 hour turnaround, $900 for photo and video.',
    about: 'Listings shot and delivered in 24 hours. Photo, video, drone after launch, floor plans. Agencies on a monthly rate.',
    pk: [['Photos', 380, '25 photos · 24h'], ['Photo + video', 900, '25 photos + walkthrough'], ['Agency month', 2800, 'Up to 8 listings']] },
  { id: 'jono', n: 'Jono Reyes', d: 'Events and conferences', short: 'Events', c: 'Brisbane', state: 'QLD', p: 1800, r: 4.9, rv: 47, t: ['photo', 'event'], mood: 'rose', seed: 17, free: true, found: true, resp: 'about 2 hours',
    why: 'conference specialist, 47 verified bookings, shot two 200+ person events at the Convention Centre this year.',
    about: 'Conferences, launches and awards nights. Same day highlights for your socials, full gallery in 48 hours.',
    pk: [['Half day', 1100, '4 hours'], ['Full day', 1800, '8 hours · same day highlights'], ['Two day', 3400, 'Conference package']] },
]
export const KW = { wedding: ['wedding', 'married', 'elope', 'bride'], brand: ['brand', 'café', 'cafe', 'business', 'product', 'restaurant', 'menu'], realestate: ['real estate', 'listing', 'property', 'agency', 'house'], event: ['event', 'conference', 'launch', 'festival', 'party'], portrait: ['portrait', 'headshot'], video: ['video', 'film', 'reel', 'videograph'], photo: ['photo', 'photograph'] }
export const TAG_LABEL = { wedding: 'Wedding', brand: 'Brand', realestate: 'Real estate', event: 'Event', portrait: 'Portrait', video: 'Video', photo: 'Photo' }
export function parseBrief(q) {
  q = q.toLowerCase(); const tags = []; for (const k in KW) if (KW[k].some(w => q.includes(w))) tags.push(k)
  const b = (q.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k)?/) || []); const budget = b[1] ? parseFloat(b[1].replace(/,/g, '')) * (b[2] ? 1000 : 1) : null
  const places = ['noosa', 'brisbane', 'gold coast', 'sunshine coast', 'maleny', 'maroochydore', 'ipswich', 'toowoomba', 'byron', 'sydney', 'melbourne']
  const place = places.find(p => q.includes(p))
  const dm = q.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/)
  let date = dm ? `${dm[1]} ${dm[2][0].toUpperCase() + dm[2].slice(1)}` : (q.includes('next month') ? 'Next month' : q.includes('this week') ? 'This week' : (q.match(/\b(march|april|june|july|august|september|october|november|december|january|february)\b/) || [])[1])
  if (date) date = date[0].toUpperCase() + date.slice(1)
  return { tags, budget, place, date }
}
export function scoreCreative(x, b) {
  let s = 40
  if (b.tags.length) { const hit = b.tags.filter(t => x.t.includes(t)).length; s += hit ? hit * 25 : -30 }
  if (b.place) { const near = { noosa: ['noosa', 'sunshine beach', 'maroochydore', 'maleny'], 'sunshine coast': ['noosa', 'sunshine beach', 'maroochydore', 'maleny'], brisbane: ['brisbane', 'fortitude valley', 'west end'], 'gold coast': ['gold coast'], maleny: ['maleny', 'noosa', 'maroochydore'] }[b.place] || [b.place]; if (near.some(p => x.c.toLowerCase().includes(p))) s += 18; else s -= 12 }
  if (b.budget) { const r = x.p / b.budget; s += r <= 1 ? 12 : r <= 1.3 ? 2 : -18 }
  if (x.free) s += 6
  return Math.max(8, Math.min(99, s))
}

// Demo availability: 14 November follows the `free` flag; every other day is derived from the seed,
// so roughly one day in five is booked and the pattern is stable for each creative.
export function freeOn(x, d) {
  if (!d) return true
  if (d.getMonth() === 10 && d.getDate() === 14) return x.free
  const n = (x.seed * 31 + d.getDate() * 7 + d.getMonth() * 13) % 97
  return n % 5 !== 0
}
