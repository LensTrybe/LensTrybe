// Vercel Edge Middleware: the front door checks where a visitor is before the site loads.
// South East Queensland gets the home page. Everyone else (regional Queensland, the other
// states, overseas) is sent to /waitlist for their area until it opens. Only "/" is checked,
// so pricing, the directory, a creative's profile and every shared link still work anywhere.
//
// No dependencies: Vercel puts the location in request headers on every edge request. With no
// headers (local dev, `vite preview`) everyone is let in. Overrides for testing and for people
// the geo gets wrong: /?geo=NSW pretends to be in NSW, /?geo=QLD:cairns a city, /?seq=1 sets a
// cookie that says "I am in South East Queensland" and lets the visitor through for a year.
// The redirect also drops an lt-region cookie so the app itself knows the area (Home.jsx reads it).
export const config = { matcher: '/' }

// Queensland cities that are not the south east. The geo gives a city name; anywhere in QLD it
// cannot name, or a city not on this list, counts as south east, since the guess is rough and a
// creative wrongly kept out is worse than one wrongly let in.
const NOT_SEQ = ['cairns', 'townsville', 'mackay', 'rockhampton', 'gladstone', 'bundaberg', 'hervey bay', 'maryborough', 'mount isa', 'emerald', 'yeppoon', 'airlie beach', 'bowen', 'charters towers', 'innisfail', 'port douglas', 'mareeba', 'atherton', 'longreach', 'roma', 'kingaroy', 'biloela', 'moranbah', 'proserpine', 'ayr', 'ingham', 'weipa', 'thursday island']

const cookie = (name, value, days) => name + '=' + value + '; Path=/; Max-Age=' + days * 86400 + '; SameSite=Lax; Secure'

export default function middleware(req) {
  const url = new URL(req.url); const h = req.headers
  const jar = h.get('cookie') || ''
  if (url.searchParams.get('seq') === '1') {
    return new Response(null, { status: 307, headers: { Location: '/', 'Set-Cookie': cookie('lt-seq', '1', 365) } })
  }
  if (/(^|;\s*)lt-seq=1(;|$)/.test(jar)) return
  const force = url.searchParams.get('geo')
  let country, region, city
  if (force) { const [r, c] = force.toUpperCase().split(':'); country = r === 'INTL' ? 'NZ' : 'AU'; region = r; city = (c || '').toLowerCase() }
  else { country = h.get('x-vercel-ip-country') || ''; region = (h.get('x-vercel-ip-country-region') || '').toUpperCase(); city = decodeURIComponent(h.get('x-vercel-ip-city') || '').toLowerCase() }
  if (!country) return
  const regional = NOT_SEQ.some(c => city.includes(c))
  if (country === 'AU' && region === 'QLD' && !regional) return
  const code = country !== 'AU' ? 'INTL' : region === 'QLD' ? 'QLD-R' : (region || 'AU')
  const to = new URL('/waitlist', url); to.search = ''; to.searchParams.set('region', code); to.searchParams.set('from', 'home')
  return new Response(null, { status: 307, headers: { Location: to.toString(), 'Set-Cookie': cookie('lt-region', code, 30) } })
}
