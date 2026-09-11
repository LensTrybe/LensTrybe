import { inject } from '@vercel/analytics'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SubscriptionProvider } from './context/SubscriptionContext.jsx'

// Private links carry access codes in the URL. Strip them (and any query string
// other than marketing tags) before page views are sent to Vercel Analytics.
const PRIVATE_PATH = /^\/(portal|deliver|sign|meeting|team\/accept|reset-password|password-reset)\/[^/]+/
inject({
  beforeSend: (event) => {
    try {
      const u = new URL(event.url)
      u.pathname = u.pathname.replace(PRIVATE_PATH, (_m, p) => `/${p}/[private]`)
      const keep = new URLSearchParams()
      for (const [k, v] of u.searchParams) if (k === 'ref' || k.startsWith('utm_')) keep.set(k, v)
      u.search = keep.toString()
      u.hash = ''
      return { ...event, url: u.toString() }
    } catch {
      return event
    }
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
