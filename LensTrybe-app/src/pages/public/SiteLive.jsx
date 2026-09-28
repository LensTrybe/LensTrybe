import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import SiteRender from '../../components/SiteRender'
import { useAuth } from '../../backend/AuthContext'
import { loadSite, sendEnquiry } from '../../lib/live'
import { LIVE } from '../../lib/mode'

// A creative's website, which is their public profile on every plan (28 Sep): /creatives/<id> from
// Find a creative (with the LensTrybe strip on top to get back), and /site/<address> to share.
// Trybe Free one page, Essential Home and Gallery, Complete and Studio Home, About, Gallery and
// Contact. Anyone can send an enquiry; it becomes a thread for the creative (site-enquiry for
// visitors, the portal path for signed-in clients).
export default function SiteLive({ slug: slugProp, strip = false }) {
  const params = useParams(); const slug = slugProp || params.slug; const { user, clientAccount } = useAuth()
  const [d, setD] = useState(undefined), [page, setPage] = useState('home')
  useEffect(() => { let on = true; if (!LIVE) { setD(null); return } loadSite(slug).then(x => on && setD(x)).catch(() => on && setD(null)); return () => { on = false } }, [slug])
  useEffect(() => { if (d?.c) document.title = (d.profile.site_seo_title || d.brand.name) + (d.brand.tag ? ' · ' + d.brand.tag : '') }, [d])
  if (d === undefined) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>Loading…</div>
  if (d === null) return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: 'Inter, sans-serif', color: '#555', padding: 24 }}><div><div style={{ fontSize: 22, fontWeight: 800 }}>Site not found</div><p>This website isn't available. Check the link and try again.</p><Link to="/creatives">Find a creative</Link></div></div>
  const s = { brand: d.brand, pages: d.pages }
  const send = f => sendEnquiry(d.c.id, { name: f.name.trim(), email: f.email.trim(), message: f.message.trim(), subject: 'Website enquiry' }, user && clientAccount ? user : null)
  const c = d.c
  return <>
    {strip && <div className="lt-strip"><Link to="/creatives" className="back"><Icon name="back" size={13} />Find a creative</Link><span className="meta">{c.rv ? <><b>★ {c.r}</b> · {c.rv} {c.rv === 1 ? 'review' : 'reviews'}</> : 'New on LensTrybe'}{c.found && <em>Founding creative</em>}</span><Link to="/" className="mark" aria-label="LensTrybe"><img src="/logo-white.svg" alt="LensTrybe" /></Link></div>}
    <SiteRender s={s} page={page} onPage={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} live={{ c, send }} />
  </>
}
