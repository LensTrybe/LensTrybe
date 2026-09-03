import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

// Public multi-page creative website. Renders in the CREATIVE'S brand (colours +
// fonts from their Brand Kit), not the LensTrybe app theme. Home / About /
// Contact for Phase 1; Gallery + Services land in Phase 2.

const SERIF = new Set(['Playfair Display', 'Merriweather', 'Cormorant Garamond'])
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Inter:wght@400;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&display=swap'
const PAGE_ORDER = ['home', 'about', 'contact']
const PAGE_LABEL = { home: 'Home', about: 'About', contact: 'Contact' }

function fontStack(name) {
  const n = name || 'Inter'
  const q = n.includes(' ') ? `"${n}"` : n
  return `${q}, ${SERIF.has(n) ? 'serif' : 'sans-serif'}`
}
function socialLinks(p) {
  const out = []
  if (p.instagram_url) out.push(['Instagram', `https://instagram.com/${p.instagram_url.replace('@', '')}`])
  if (p.tiktok_url) out.push(['TikTok', `https://tiktok.com/${p.tiktok_url.replace('@', '')}`])
  if (p.facebook_url) out.push(['Facebook', p.facebook_url])
  if (p.linkedin_url) out.push(['LinkedIn', p.linkedin_url])
  return out
}

export default function PublicSitePage() {
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [brand, setBrand] = useState(null)
  const [pages, setPages] = useState([])
  const [reviews, setReviews] = useState([])
  const [page, setPage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (document.getElementById('lt-site-fonts')) return
    const l = document.createElement('link'); l.id = 'lt-site-fonts'; l.rel = 'stylesheet'; l.href = FONTS_HREF; document.head.appendChild(l)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const norm = (slug || '').trim().toLowerCase()
    const { data: prof } = await supabase.from('profiles').select('*').eq('custom_domain', norm).eq('is_admin', false).maybeSingle()
    if (!prof || !prof.portfolio_website_active) { setProfile(null); setLoading(false); return }
    setProfile(prof)
    const [bk, pg, rv] = await Promise.all([
      supabase.from('brand_kit').select('*').eq('creative_id', prof.id).maybeSingle(),
      supabase.from('site_pages').select('*').eq('creative_id', prof.id).eq('visible', true),
      supabase.from('reviews').select('*').eq('creative_id', prof.id).order('created_at', { ascending: false }),
    ])
    setBrand(bk.data || {})
    setPages(pg.data || [])
    setReviews((rv.data || []).filter(r => !r.hidden && r.flag_status !== 'pending' && r.flag_status !== 'removed'))
    setLoading(false)
  }, [slug])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (profile?.business_name) { document.title = profile.business_name; return () => { document.title = 'LensTrybe' } }
  }, [profile?.business_name])

  const pageMap = useMemo(() => { const m = {}; pages.forEach(p => { m[p.page_type] = p }); return m }, [pages])
  const nav = PAGE_ORDER.filter(t => pageMap[t])

  const accent = (brand && brand.primary_color) || '#1DB954'
  const headingFont = fontStack((brand && (brand.heading_font || brand.font)) || 'Playfair Display')
  const bodyFont = fontStack((brand && (brand.body_font || brand.font)) || 'Inter')
  const bg = (brand && brand.background_color) || '#ffffff'
  const ink = '#17151c'
  const soft = '#6a6870'

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!form.name.trim() || !form.email.trim()) { setErr('Please add your name and email.'); return }
    setSending(true)
    const { data, error } = await supabase.functions.invoke('site-enquiry', { body: { creativeId: profile.id, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, message: form.message.trim() || null } })
    setSending(false)
    if (error || (data && data.error)) { setErr('Something went wrong. Please try again.'); return }
    setSent(true); setForm({ name: '', email: '', phone: '', message: '' })
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>Loading…</div>
  if (!profile) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#555', gap: 8 }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>Site not found</div>
      <div style={{ fontSize: 14 }}>This website isn’t published yet.</div>
    </div>
  )

  const name = profile.business_name || 'Studio'
  const logo = brand && brand.logo_url
  const home = pageMap.home?.content || {}
  const about = pageMap.about?.content || {}
  const contact = pageMap.contact?.content || {}
  const homeT = pageMap.home?.template || 't1'
  const aboutT = pageMap.about?.template || 't1'
  const contactT = pageMap.contact?.template || 't1'
  const areas = profile.site_service_areas || []
  const socials = socialLinks(profile)

  const btn = { display: 'inline-block', background: accent, color: '#fff', fontWeight: 700, textDecoration: 'none', padding: '13px 28px', borderRadius: 10, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: bodyFont }
  const H = (size) => ({ fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: ink, fontSize: size })
  const wrap = { maxWidth: 1080, margin: '0 auto', padding: '0 24px' }

  function Hero() {
    if (homeT === 't2') {
      return (
        <section style={{ ...wrap, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 44, alignItems: 'center', padding: '64px 24px 40px' }} className="lt-hero">
          <div>
            <h1 style={H('clamp(34px,5vw,56px)')}>{home.headline || name}</h1>
            {home.subheadline && <p style={{ fontFamily: bodyFont, color: soft, fontSize: 18, lineHeight: 1.6, margin: '18px 0 26px' }}>{home.subheadline}</p>}
            {nav.includes('contact') && <a style={btn} onClick={() => setPage('contact')}>{home.cta_text || 'Get in touch'}</a>}
          </div>
          {home.hero_image
            ? <img src={home.hero_image} alt="" style={{ width: '100%', height: 460, objectFit: 'cover', borderRadius: 16 }} />
            : <div style={{ width: '100%', height: 460, borderRadius: 16, background: accent + '18' }} />}
        </section>
      )
    }
    return (
      <section style={{ position: 'relative', minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#fff', overflow: 'hidden' }}>
        {home.hero_image
          ? <img src={home.hero_image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${accent}, ${ink})` }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)' }} />
        <div style={{ position: 'relative', ...wrap }}>
          <h1 style={{ ...H('clamp(38px,6vw,68px)'), color: '#fff' }}>{home.headline || name}</h1>
          {home.subheadline && <p style={{ fontFamily: bodyFont, fontSize: 19, lineHeight: 1.6, margin: '20px auto 28px', maxWidth: 620, color: 'rgba(255,255,255,0.9)' }}>{home.subheadline}</p>}
          {nav.includes('contact') && <a style={btn} onClick={() => setPage('contact')}>{home.cta_text || 'Get in touch'}</a>}
        </div>
      </section>
    )
  }

  function HomeExtra() {
    return (
      <>
        {home.intro && (
          <section style={{ ...wrap, padding: '52px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: bodyFont, color: ink, fontSize: 20, lineHeight: 1.7, maxWidth: 720, margin: '0 auto' }}>{home.intro}</p>
          </section>
        )}
        {areas.length > 0 && (
          <section style={{ ...wrap, padding: '10px 24px 40px', textAlign: 'center' }}>
            <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: soft, marginBottom: 12 }}>Areas covered</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {areas.map((a, i) => <span key={i} style={{ fontFamily: bodyFont, fontSize: 13.5, color: ink, border: `1px solid ${accent}55`, borderRadius: 99, padding: '6px 14px' }}>{a}</span>)}
            </div>
          </section>
        )}
        {reviews.length > 0 && (
          <section style={{ background: accent + '0e', padding: '56px 0' }}>
            <div style={{ ...wrap }}>
              <h2 style={{ ...H('30px'), textAlign: 'center', marginBottom: 30 }}>Kind words</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
                {reviews.slice(0, 3).map(r => (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ color: accent, fontSize: 15, marginBottom: 8 }}>{'★'.repeat(r.rating || 5)}</div>
                    <p style={{ fontFamily: bodyFont, color: ink, fontSize: 14.5, lineHeight: 1.6, fontStyle: 'italic', margin: '0 0 10px' }}>{r.body || r.comment}</p>
                    <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: ink }}>{r.reviewer_name || r.client_name || 'Client'}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </>
    )
  }

  function About() {
    const body = (about.body || '').split('\n').filter(Boolean)
    if (aboutT === 't2') {
      return (
        <section style={{ ...wrap, padding: '64px 24px', textAlign: 'center', maxWidth: 760 }}>
          <h2 style={{ ...H('clamp(28px,4vw,42px)'), marginBottom: 22 }}>{about.heading || 'About'}</h2>
          {about.portrait_image && <img src={about.portrait_image} alt="" style={{ width: 160, height: 160, borderRadius: '50%', objectFit: 'cover', marginBottom: 22 }} />}
          {body.map((p, i) => <p key={i} style={{ fontFamily: bodyFont, color: ink, fontSize: 17, lineHeight: 1.8, margin: '0 auto 16px', maxWidth: 640 }}>{p}</p>)}
        </section>
      )
    }
    return (
      <section style={{ ...wrap, display: 'grid', gridTemplateColumns: about.portrait_image ? '340px minmax(0,1fr)' : '1fr', gap: 48, alignItems: 'center', padding: '64px 24px' }} className="lt-about">
        {about.portrait_image && <img src={about.portrait_image} alt="" style={{ width: '100%', height: 420, objectFit: 'cover', borderRadius: 16 }} />}
        <div>
          <h2 style={{ ...H('clamp(28px,4vw,44px)'), marginBottom: 20 }}>{about.heading || 'About'}</h2>
          {body.map((p, i) => <p key={i} style={{ fontFamily: bodyFont, color: ink, fontSize: 17, lineHeight: 1.8, margin: '0 0 16px' }}>{p}</p>)}
        </div>
      </section>
    )
  }

  function Contact() {
    const field = { width: '100%', border: '1px solid rgba(0,0,0,0.16)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: bodyFont, boxSizing: 'border-box', outline: 'none', marginBottom: 12, color: ink, background: '#fff' }
    const formCard = (
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: 26, boxShadow: '0 20px 60px -30px rgba(0,0,0,0.25)' }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: bodyFont }}>
            <div style={{ color: accent, fontSize: 30, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: ink }}>Thank you</div>
            <div style={{ color: soft, fontSize: 14, marginTop: 6 }}>{name} will be in touch soon.</div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <input style={field} placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input style={field} placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input style={field} placeholder="Phone (optional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <textarea style={{ ...field, minHeight: 110, resize: 'vertical' }} placeholder="Tell them about your project…" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
            {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 10, fontFamily: bodyFont }}>{err}</div>}
            <button type="submit" disabled={sending} style={{ ...btn, width: '100%', opacity: sending ? 0.6 : 1 }}>{sending ? 'Sending…' : 'Send enquiry'}</button>
          </form>
        )}
      </div>
    )
    if (contactT === 't2') {
      return (
        <section style={{ ...wrap, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,420px)', gap: 44, alignItems: 'start', padding: '64px 24px' }} className="lt-contact">
          <div>
            <h2 style={{ ...H('clamp(28px,4vw,44px)'), marginBottom: 16 }}>{contact.heading || 'Get in touch'}</h2>
            {contact.blurb && <p style={{ fontFamily: bodyFont, color: soft, fontSize: 17, lineHeight: 1.7 }}>{contact.blurb}</p>}
            {areas.length > 0 && <div style={{ marginTop: 18, fontFamily: bodyFont, color: ink, fontSize: 14 }}><strong>Covering:</strong> {areas.join(', ')}</div>}
          </div>
          {formCard}
        </section>
      )
    }
    return (
      <section style={{ ...wrap, padding: '64px 24px', maxWidth: 620, textAlign: 'center' }}>
        <h2 style={{ ...H('clamp(28px,4vw,44px)'), marginBottom: 14 }}>{contact.heading || 'Get in touch'}</h2>
        {contact.blurb && <p style={{ fontFamily: bodyFont, color: soft, fontSize: 17, lineHeight: 1.7, marginBottom: 26 }}>{contact.blurb}</p>}
        <div style={{ textAlign: 'left' }}>{formCard}</div>
      </section>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: bodyFont }}>
      <style>{`.lt-navlink:hover{opacity:1 !important}@media(max-width:760px){.lt-hero,.lt-about,.lt-contact{grid-template-columns:1fr !important}.lt-desknav{display:none !important}.lt-burger{display:flex !important}}`}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: bg + 'e6', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <div onClick={() => setPage('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
            {logo ? <img src={logo} alt={name} style={{ height: 34, objectFit: 'contain' }} /> : <span style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 22, color: ink, letterSpacing: '-0.02em' }}>{name}</span>}
          </div>
          <nav className="lt-desknav" style={{ display: 'flex', gap: 26, alignItems: 'center' }}>
            {nav.map(t => (
              <span key={t} className="lt-navlink" onClick={() => setPage(t)} style={{ cursor: 'pointer', fontSize: 14.5, fontWeight: 600, color: page === t ? accent : ink, opacity: page === t ? 1 : 0.7, transition: '.15s' }}>{PAGE_LABEL[t]}</span>
            ))}
          </nav>
          <div className="lt-burger" style={{ display: 'none', cursor: 'pointer' }} onClick={() => setMenuOpen(o => !o)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </div>
        </div>
        {menuOpen && (
          <div style={{ ...wrap, paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nav.map(t => <span key={t} onClick={() => { setPage(t); setMenuOpen(false) }} style={{ cursor: 'pointer', padding: '8px 0', fontSize: 15, fontWeight: 600, color: page === t ? accent : ink }}>{PAGE_LABEL[t]}</span>)}
          </div>
        )}
      </header>

      <main>
        {page === 'home' && <><Hero /><HomeExtra /></>}
        {page === 'about' && <About />}
        {page === 'contact' && <Contact />}
      </main>

      <footer style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 20 }}>
        <div style={{ ...wrap, padding: '30px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 16, color: ink }}>{name}</div>
          {socials.length > 0 && (
            <div style={{ display: 'flex', gap: 18 }}>
              {socials.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" style={{ fontFamily: bodyFont, fontSize: 13.5, color: soft, textDecoration: 'none' }}>{label}</a>)}
            </div>
          )}
        </div>
        {profile.site_show_made_with && (
          <div style={{ textAlign: 'center', padding: '0 0 22px', fontFamily: bodyFont, fontSize: 12, color: '#a0a0a8' }}>
            Made with <a href="https://lenstrybe.com" target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}>LensTrybe</a>
          </div>
        )}
      </footer>
    </div>
  )
}
