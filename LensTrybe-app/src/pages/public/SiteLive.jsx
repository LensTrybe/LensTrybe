import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import SiteRender from '../../components/SiteRender'
import { useAuth } from '../../backend/AuthContext'
import { loadSite, sendEnquiry } from '../../lib/live'
import { LIVE } from '../../lib/mode'

// A creative's own website: /site/<address> or /site/<profile id>. Pages from site_pages, photos,
// packages and reviews from the profile. Anyone can send an enquiry; it becomes a thread for the
// creative (site-enquiry for visitors, the portal path for signed-in clients).
export default function SiteLive() {
  const { slug } = useParams(); const { user, clientAccount } = useAuth()
  const [d, setD] = useState(undefined), [page, setPage] = useState('home')
  useEffect(() => { let on = true; if (!LIVE) { setD(null); return } loadSite(slug).then(x => on && setD(x)).catch(() => on && setD(null)); return () => { on = false } }, [slug])
  useEffect(() => { if (d?.c) document.title = (d.profile.site_seo_title || d.brand.name) + (d.brand.tag ? ' · ' + d.brand.tag : '') }, [d])
  if (d === undefined) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>Loading…</div>
  if (d === null) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: '#555', padding: 24 }}><div><div style={{ fontSize: 22, fontWeight: 800 }}>Site not found</div><p>This website isn't available. Check the link and try again.</p><Link to="/creatives">Find a creative</Link></div></div>
  if (d.none) return <Navigate to={'/creatives/' + d.profile.id} replace />
  const s = { brand: d.brand, pages: d.pages }
  const send = f => sendEnquiry(d.c.id, { name: f.name.trim(), email: f.email.trim(), message: f.message.trim(), subject: 'Website enquiry' }, user && clientAccount ? user : null)
  return <SiteRender s={s} page={page} onPage={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} live={{ c: d.c, send, profileUrl: '/creatives/' + d.c.id }} />
}
