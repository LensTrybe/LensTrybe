import { createClient } from '@supabase/supabase-js'
import { lockDown } from './previewGuard'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Next runs in two modes (src/lib/mode.js). With no keys, or VITE_LT_MODE=demo, there is no
// client at all and every screen runs on the sample store; the live app throws here instead,
// which is right for it and wrong for a build that must always be showable without a login.
// The public "Workspace preview" and "Client portal preview" (Michael, 29 Sep: a preview must not
// ask anyone to log in). Opened with ?preview on /app or /portal/<slug>, the page loads as the demo:
// sample store, no Supabase client, nothing read from or written to the real project. It lasts for
// the tab (sessionStorage) while the visitor stays in the workspace or portal; the first load
// anywhere else ends it, and PreviewExit reloads on the way out so the public site is always live.
export const PREVIEW_AREA = p => p === '/app' || p.startsWith('/app/') || (p.startsWith('/portal/') && p.split('/').length === 3)
function previewing() {
  if (typeof window === 'undefined') return false
  const inArea = PREVIEW_AREA(location.pathname)
  try {
    if (!inArea) { sessionStorage.removeItem('lt-preview'); return false }
    if (new URLSearchParams(location.search).has('preview')) { sessionStorage.setItem('lt-preview', '1'); return true }
    return sessionStorage.getItem('lt-preview') === '1'
  } catch { return new URLSearchParams(location.search).has('preview') && inArea }
}
export const PREVIEW = previewing()
if (PREVIEW) lockDown(PREVIEW_AREA)

export const supabase = supabaseUrl && supabaseAnonKey && import.meta.env.VITE_LT_MODE !== 'demo' && !PREVIEW ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
}) : null
