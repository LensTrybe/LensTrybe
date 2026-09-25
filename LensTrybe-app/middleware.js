import { next } from '@vercel/edge'

// Vercel Edge Middleware: the front door checks where a visitor is before the site loads.
// South East Queensland gets the whole site. Everyone else (regional Queensland, the other
// states, overseas) can read (how it works, pricing, founding, profiles, the Edit, support) but
// every action sends them to /waitlist for their area: the home page redirects here at the edge,
// and the app hides Join / Post a job / the ask once it sees the lt-region cookie this sets.
//
// No geo headers (local dev, `vite preview`) means everyone is let in. Overrides for testing and
// for people the geo gets wrong: /?geo=NSW pretends to be in NSW, /?geo=QLD:cairns a city,
// /?seq=1 sets a cookie that says "I am in South East Queensland" and lets the visitor through
// for a year. Search engine and link-preview crawlers are never redirected, so the home page
// indexes as the home page wherever the crawler sits.
export const config = { matcher: ['/((?!api|assets|_vercel|favicon|.*\\..*).*)'] }

// Queensland cities that are not the south east. The geo gives a city name; anywhere in QLD it
// cannot name, or a city not on this list, counts as south east, since the guess is rough and a
// creative wrongly kept out is worse than one wrongly let in.
const NOT_SEQ = ['cairns', 'townsville', 'mackay', 'rockhampton', 'gladstone', 'bundaberg', 'hervey bay', 'maryborough', 'mount isa', 'emerald', 'yeppoon', 'airlie beach', 'bowen', 'charters towers', 'innisfail', 'port douglas', 'mareeba', 'atherton', 'longreach', 'roma', 'kingaroy', 'biloela', 'moranbah', 'proserpine', 'ayr', 'ingham', 'weipa', 'thursday island']
const BOT = /googlebot|bingbot|duckduckbot|slurp|yandex|baiduspider|applebot|facebookexternalhit|twitterbot|linkedinbot|pinterest|slackbot|whatsapp|telegrambot|discordbot|vercel-screenshot/i

const cookie = (name, value, days) => name + '=' + value + '; Path=/; Max-Age=' + days * 86400 + '; SameSite=Lax; Secure'

export default function middleware(req) {
  const url = new URL(req.url); const h = req.headers
  const jar = h.get('cookie') || ''
  const home = url.pathname === '/'
  if (url.searchParams.get('seq') === '1') {
    return new Response(null, { status: 307, headers: { Location: home ? '/' : url.pathname, 'Set-Cookie': cookie('lt-seq', '1', 365) } })
  }
  if (/(^|;\s*)lt-seq=1(;|$)/.test(jar)) return
  if (BOT.test(h.get('user-agent') || '')) return
  const force = url.searchParams.get('geo')
  let country, region, city
  if (force) { const [r, c] = force.toUpperCase().split(':'); country = r === 'INTL' ? 'NZ' : 'AU'; region = r; city = (c || '').toLowerCase() }
  else { country = h.get('x-vercel-ip-country') || ''; region = (h.get('x-vercel-ip-country-region') || '').toUpperCase(); city = decodeURIComponent(h.get('x-vercel-ip-city') || '').toLowerCase() }
  if (!country) return
  const regional = NOT_SEQ.some(c => city.includes(c))
  const inSEQ = country === 'AU' && region === 'QLD' && !regional
  const code = inSEQ ? 'QLD' : country !== 'AU' ? 'INTL' : region === 'QLD' ? 'QLD-R' : (region || 'AU')
  const known = new RegExp('(^|;\\s*)lt-region=' + code + '(;|$)').test(jar)
  if (inSEQ) return known && !force ? undefined : next({ headers: { 'Set-Cookie': cookie('lt-region', 'QLD', 30) } })
  if (home) {
    const to = new URL('/waitlist', url); to.search = ''; to.searchParams.set('region', code); to.searchParams.set('from', 'home')
    return new Response(null, { status: 307, headers: { Location: to.toString(), 'Set-Cookie': cookie('lt-region', code, 30) } })
  }
  // any other page: readable, but the app needs to know the area so it can point actions at the waitlist
  if (force && url.pathname !== '/waitlist') { url.searchParams.delete('geo'); return new Response(null, { status: 307, headers: { Location: url.toString(), 'Set-Cookie': cookie('lt-region', code, 30) } }) }
  return known ? undefined : next({ headers: { 'Set-Cookie': cookie('lt-region', code, 30) } })
}
