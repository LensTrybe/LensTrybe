import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './styles/tokens.css'
import './styles/base.css'
import './styles/glass.css'

// hq.lenstrybe.com is LensTrybe HQ, the staff intranet: its own app, loaded only there, never
// on the public site. In local development it also answers at /hq.
const HqApp = lazy(() => import('./hq/HqApp'))
const host = location.hostname
const isHQ = host.startsWith('hq.') || (import.meta.env.DEV && (location.pathname === '/hq' || location.pathname.startsWith('/hq/')))

// Vercel Web Analytics (3 Oct 2026): cookie-free page counts, as the Cookies Policy describes.
// Private links are never counted as they are: the code in a portal, signing, delivery, meeting,
// document, review, team or unsubscribe link is replaced, ids in workspace (/app) addresses become :id,
// and the hash and query string (founding codes, sign-in tokens) are dropped, except the utm_ tags,
// which stay so traffic from the flyer QR code, emails and social posts shows under its campaign.
// Speed Insights reports through the same scrub.
const PRIVATE = /^\/(portal|sign|deliver|meeting|review|unsubscribe|brand|p|site)\/[^/]+/
const scrub = e => {
  try {
    const u = new URL(e.url)
    let path = u.pathname
      .replace(PRIVATE, (m, k) => '/' + k + '/:code')
      .replace(/^\/doc\/([^/]+)\/[^/]+/, '/doc/$1/:code')
      .replace(/^\/team\/accept\/[^/]+/, '/team/accept/:code')
    if (path.startsWith('/app/')) path = path.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id')
    const utm = new URLSearchParams([...u.searchParams].filter(([k]) => /^utm_[a-z]+$/.test(k))).toString()
    return { ...e, url: u.origin + path + (utm ? '?' + utm : '') }
  } catch { return null }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isHQ
      ? <BrowserRouter basename={host.startsWith('hq.') ? '/' : '/hq'}><Suspense fallback={null}><HqApp /></Suspense></BrowserRouter>
      : <><BrowserRouter><App /></BrowserRouter><Analytics beforeSend={scrub} /><SpeedInsights beforeSend={scrub} /></>}
  </StrictMode>,
)
