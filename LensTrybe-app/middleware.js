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
// Crawlers and link previews, never sent to the waitlist. Google's own tools do not all say
// "Googlebot" (URL Inspection is Google-InspectionTool, and there is GoogleOther, Storebot-Google,
// AdsBot-Google and more), so anything Google is matched, along with Bing's and the AI search
// crawlers (2 Oct 2026: URL Inspection was being sent to the waitlist).
const BOT = /googlebot|google-|-google|googleother|bingbot|bingpreview|msnbot|adidxbot|duckduckbot|duckassistbot|slurp|yandex|baiduspider|applebot|facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|linkedinbot|pinterest|slackbot|whatsapp|telegrambot|discordbot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|perplexitybot|amazonbot|petalbot|ahrefsbot|semrushbot|vercel-screenshot/i

const cookie = (name, value, days) => name + '=' + value + '; Path=/; Max-Age=' + days * 86400 + '; SameSite=Lax; Secure'
// Campaign tags (utm_source, utm_medium, utm_campaign and the rest) ride along on every redirect
// here, so a visit from the flyer QR code, an email or a social post is still counted under its
// campaign when it lands on the waitlist instead of the home page.
const withUtm = (to, from) => { for (const [k, v] of from.searchParams) if (/^utm_[a-z]+$/.test(k)) to.searchParams.set(k, v); return to }

export default function middleware(req) {
  const url = new URL(req.url); const h = req.headers
  // LensTrybe HQ, the staff intranet: never area-gated, never indexed, never framed.
  if (url.hostname.startsWith('hq.')) return next({ headers: { 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' } })
  const jar = h.get('cookie') || ''
  const home = url.pathname === '/'
  if (url.searchParams.get('seq') === '1') {
    const to = withUtm(new URL(home ? '/' : url.pathname, url), url)
    return new Response(null, { status: 307, headers: { Location: to.pathname + to.search, 'Set-Cookie': cookie('lt-seq', '1', 365) } })
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
    const to = new URL('/waitlist', url); to.search = ''; to.searchParams.set('region', code); to.searchParams.set('from', 'home'); withUtm(to, url)
    return new Response(null, { status: 307, headers: { Location: to.toString(), 'Set-Cookie': cookie('lt-region', code, 30) } })
  }
  // any other page: readable, but the app needs to know the area so it can point actions at the waitlist
  if (force && url.pathname !== '/waitlist') { url.searchParams.delete('geo'); return new Response(null, { status: 307, headers: { Location: url.toString(), 'Set-Cookie': cookie('lt-region', code, 30) } }) }
  return known ? undefined : next({ headers: { 'Set-Cookie': cookie('lt-region', code, 30) } })
}
