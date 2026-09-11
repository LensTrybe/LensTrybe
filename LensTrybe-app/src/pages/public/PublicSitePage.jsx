import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import PublicProfilePage from './PublicProfilePage'

// A creative's public website link: /site/<address> or /site/<profile id>.
// Renders the same website as their profile (built in the website builder), but
// open to everyone: no sign-in wall, and visitors can enquire without an account.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function PublicSitePage() {
  const { slug } = useParams()
  const [state, setState] = useState({ loading: true, id: null })

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      const s = String(slug || '').trim().toLowerCase()
      if (!s) { setState({ loading: false, id: null }); return }
      const q = supabase.from('profiles').select('id')
      const { data } = UUID_RE.test(s) ? await q.eq('id', s).maybeSingle() : await q.eq('custom_domain', s).maybeSingle()
      if (!cancelled) setState({ loading: false, id: data?.id || null })
    }
    resolve()
    return () => { cancelled = true }
  }, [slug])

  if (state.loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>Loading…</div>
  }
  if (!state.id) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#555', gap: 8, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Site not found</div>
        <div style={{ fontSize: 14 }}>This website isn’t available. Check the link and try again.</div>
      </div>
    )
  }
  return <PublicProfilePage siteMode siteId={state.id} />
}
