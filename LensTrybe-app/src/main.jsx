import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/glass.css'

// hq.lenstrybe.com is LensTrybe HQ, the staff intranet: its own app, loaded only there, never
// on the public site. In local development it also answers at /hq.
const HqApp = lazy(() => import('./hq/HqApp'))
const host = location.hostname
const isHQ = host.startsWith('hq.') || (import.meta.env.DEV && (location.pathname === '/hq' || location.pathname.startsWith('/hq/')))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isHQ
      ? <BrowserRouter basename={host.startsWith('hq.') ? '/' : '/hq'}><Suspense fallback={null}><HqApp /></Suspense></BrowserRouter>
      : <BrowserRouter><App /></BrowserRouter>}
  </StrictMode>,
)
