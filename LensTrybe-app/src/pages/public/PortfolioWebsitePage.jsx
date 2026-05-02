import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE,
  messageBodyContainsContactDetails,
  threadOwnerTierContactSharingRestricted,
} from '../../lib/messagingContactPolicy'

const DEFAULT_SECTIONS = {
  client_reviews: true,
  services_pricing: true,
  contact_form: true,
  content_gallery: true,
}

const SERIF_FONTS = new Set(['Playfair Display', 'Merriweather', 'Cormorant Garamond'])

function mergeSections(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SECTIONS }
  return { ...DEFAULT_SECTIONS, ...raw }
}

function fontStackCss(name) {
  const n = name || 'Inter'
  const q = n.includes(' ') ? `"${n}"` : n
  const fall = SERIF_FONTS.has(n) ? 'serif' : 'sans-serif'
  return `${q}, ${fall}`
}

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Inter:wght@400;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&display=swap'

function normaliseSlug(s) {
  return (s ?? '').trim().toLowerCase()
}

function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url.trim())
}

function isPdfMime(m) {
  return (m || '').includes('pdf')
}

export default function PortfolioWebsitePage() {
  const { slug: slugParam } = useParams()
  const slug = normaliseSlug(slugParam)

  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [profile, setProfile] = useState(null)
  const [brandKit, setBrandKit] = useState(null)
  const [reviews, setReviews] = useState([])
  const [contentRows, setContentRows] = useState([])
  const [services, setServices] = useState([])
  const [lightbox, setLightbox] = useState(null)
  const [contact, setContact] = useState({ name: '', email: '', message: '' })
  const [contactSending, setContactSending] = useState(false)
  const [contactSent, setContactSent] = useState(false)
  const [contactError, setContactError] = useState('')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  const accent = brandKit?.primary_color || '#1DB954'
  const bodyFont = fontStackCss(brandKit?.font || 'Inter')
  const sections = useMemo(() => mergeSections(profile?.portfolio_sections), [profile?.portfolio_sections])

  useEffect(() => {
    const id = 'public-portfolio-site-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = GOOGLE_FONTS_HREF
    document.head.appendChild(link)
  }, [])

  const load = useCallback(async () => {
    if (!supabase || !slug) {
      setLoading(false)
      setAvailable(false)
      return
    }
    setLoading(true)
    setAvailable(false)
    setContactError('')
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('custom_domain', slug)
      .eq('is_admin', false)
      .maybeSingle()

    if (pErr || !prof || !prof.portfolio_website_active) {
      setProfile(null)
      setAvailable(false)
      setLoading(false)
      return
    }

    setProfile(prof)
    setAvailable(true)

    const creativeId = prof.id

    const [bkRes, revRes, contentRes, serviceRes] = await Promise.all([
      supabase.from('brand_kit').select('primary_color, font, secondary_color').eq('creative_id', creativeId).maybeSingle(),
      supabase.from('reviews').select('*').eq('creative_id', creativeId).order('created_at', { ascending: false }),
      supabase.from('portfolio_website_content').select('*').eq('creative_id', creativeId).order('created_at', { ascending: true }),
      supabase.from('portfolio_services').select('*').eq('creative_id', creativeId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    ])

    setBrandKit(bkRes.data ?? null)
    setReviews(revRes.data ?? [])
    setContentRows(contentRes.data ?? [])
    setServices(serviceRes.data ?? [])
    setLoading(false)
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!profile?.business_name) return
    document.title = `${profile.business_name} · LensTrybe`
    return () => {
      document.title = 'LensTrybe'
    }
  }, [profile?.business_name])

  const folders = useMemo(() => contentRows.filter((r) => r.content_type === 'folder'), [contentRows])
  const files = useMemo(() => contentRows.filter((r) => r.content_type === 'file'), [contentRows])

  function filesInFolder(folderId) {
    if (folderId === null) return files.filter((f) => !f.parent_folder_id)
    return files.filter((f) => f.parent_folder_id === folderId)
  }

  async function submitContact(e) {
    e.preventDefault()
    if (!profile?.id || !supabase) return
    const name = contact.name.trim()
    const email = contact.email.trim()
    const message = contact.message.trim()
    if (!name || !email || !message) {
      setContactError('Please fill in all fields.')
      return
    }
    if (
      threadOwnerTierContactSharingRestricted(profile?.subscription_tier) &&
      messageBodyContainsContactDetails(message)
    ) {
      setContactError(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE)
      return
    }
    setContactSending(true)
    setContactError('')
    try {
      const { data: thread, error: tErr } = await supabase
        .from('message_threads')
        .insert({
          creative_id: profile.id,
          client_user_id: null,
          client_name: name,
          client_email: email,
          subject: 'Enquiry from portfolio website',
        })
        .select()
        .single()
      if (tErr || !thread) throw new Error(tErr?.message || 'Could not create conversation')

      const { error: mErr } = await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_type: 'client',
        sender_name: name,
        body: message,
      })
      if (mErr) throw new Error(mErr.message)

      if (profile.business_email) {
        await supabase.functions.invoke('send-message-notification', {
          body: {
            to: profile.business_email,
            toName: profile.business_name,
            fromName: name,
            subject: `New enquiry from ${name}`,
            messageBody: message,
            threadSubject: 'Enquiry from portfolio website',
            profileUrl: typeof window !== 'undefined' ? `${window.location.origin}/dashboard/clients/messages` : '',
          },
        })
      }

      await supabase.functions.invoke('send-enquiry', {
        body: { creativeId: profile.id, clientId: null, subject: 'Portfolio website enquiry', message },
      }).catch(() => {})

      setContactSent(true)
      setContact({ name: '', email: '', message: '' })
      setTimeout(() => setContactSent(false), 5000)
    } catch (err) {
      setContactError(err?.message || 'Could not send your enquiry. Please try again later.')
    } finally {
      setContactSending(false)
    }
  }

  const navLinks = useMemo(() => {
    const links = []
    if (sections.client_reviews) links.push({ id: 'reviews', label: 'Reviews' })
    if (sections.services_pricing) links.push({ id: 'services', label: 'Services' })
    if (sections.contact_form) links.push({ id: 'contact', label: 'Contact' })
    if (sections.content_gallery) links.push({ id: 'content', label: 'Gallery' })
    return links
  }, [sections])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', fontFamily: 'system-ui, sans-serif', color: '#52525b' }}>
        Loading…
      </div>
    )
  }

  if (!available || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f4f4f5', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#18181b', margin: '0 0 12px' }}>This page is not available</h1>
          <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.6, margin: 0 }}>
            This portfolio may be offline or the link is incorrect.
          </p>
          <Link to="/" style={{ display: 'inline-block', marginTop: 24, color: '#1DB954', fontWeight: 600, textDecoration: 'none' }}>
            Go to LensTrybe
          </Link>
        </div>
      </div>
    )
  }

  const coverUrl = profile.portfolio_cover_url
  const headline = profile.portfolio_headline || profile.business_name || 'Portfolio'
  const tagline = profile.portfolio_tagline || ''

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', color: '#18181b', fontFamily: bodyFont, overflowX: 'hidden' }} className="public-portfolio-page">
      <style>{`
        html { scroll-behavior: smooth; }
        a.site-nav-link:hover { opacity: 0.85; }
        @media (max-width: 767px) {
          .public-portfolio-page button { min-height: 44px; }
          .public-portfolio-page input, .public-portfolio-page textarea, .public-portfolio-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>

      {/* Hero */}
      <header
        style={{
          position: 'relative',
          minHeight: isMobile ? 'auto' : 'min(72vh, 640px)',
          width: '100%',
          backgroundColor: accent,
          backgroundImage: coverUrl ? `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.72)), url(${coverUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: isMobile ? '24px 16px 32px' : 'clamp(32px, 8vw, 72px) 24px 120px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                  marginBottom: 24,
                }}
              />
            ) : null}
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(28px, 5vw, 44px)',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                maxWidth: 800,
              }}
            >
              {headline}
            </h1>
            {tagline ? (
              <p style={{ margin: '16px 0 0', fontSize: 'clamp(15px, 2.4vw, 18px)', color: 'rgba(255,255,255,0.9)', maxWidth: 640, lineHeight: 1.55 }}>
                {tagline}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* Sticky nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'center',
            gap: '8px 20px',
            overflowX: isMobile ? 'auto' : 'visible',
            whiteSpace: isMobile ? 'nowrap' : 'normal',
          }}
        >
          {navLinks.map((l) => (
            <a
              key={l.id}
              className="site-nav-link"
              href={`#${l.id}`}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: accent,
                textDecoration: 'none',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: isMobile ? '24px 16px 48px' : 'clamp(32px, 5vw, 56px) 20px 64px' }}>
        {sections.client_reviews && (
          <section id="reviews" style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, color: accent, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Reviews</h2>
            <div style={{ width: 56, height: 3, background: accent, borderRadius: 2, marginBottom: 24 }} />
            {reviews.length === 0 ? (
              <p style={{ color: '#71717a', fontSize: 15 }}>No reviews yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {reviews.map((r) => (
                  <article
                    key={r.id}
                    style={{
                      background: '#fff',
                      borderRadius: 16,
                      padding: '20px 22px',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                      border: '1px solid rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ color: '#eab308', fontSize: 16 }}>{'★'.repeat(Math.min(5, Math.round(Number(r.rating) || 0)))}</span>
                      <span style={{ fontSize: 13, color: '#71717a' }}>{r.rating != null ? Number(r.rating).toFixed(1) : ''}</span>
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.55, color: '#27272a' }}>{r.body || r.comment}</p>
                    <footer style={{ fontSize: 13, color: '#71717a' }}>
                      <strong style={{ color: '#3f3f46' }}>{r.reviewer_name || r.client_name || 'Client'}</strong>
                      {r.created_at ? (
                        <span>
                          {' · '}
                          {new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      ) : null}
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {sections.services_pricing && (
          <section id="services" style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, color: accent, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Services</h2>
            <div style={{ width: 56, height: 3, background: accent, borderRadius: 2, marginBottom: 24 }} />
            {services.length === 0 ? <p style={{ color: '#71717a', margin: 0 }}>Services will appear here soon.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {services.map((service) => (
                  <article key={service.id} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 8px', color: '#18181b', fontSize: 18, fontWeight: 700 }}>{service.name}</h3>
                    <p style={{ margin: '0 0 10px', color: '#52525b', fontSize: 14, lineHeight: 1.6 }}>{service.description || 'No description provided.'}</p>
                    {service.price ? <div style={{ color: accent, fontWeight: 700 }}>{service.price}</div> : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {sections.content_gallery && (
          <section id="content" style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, color: accent, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Gallery</h2>
            <div style={{ width: 56, height: 3, background: accent, borderRadius: 2, marginBottom: 24 }} />
            <ContentGalleryBlocks folders={folders} filesInFolder={filesInFolder} accent={accent} isMobile={isMobile} />
          </section>
        )}

        {sections.contact_form && (
          <section id="contact" style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, color: accent, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Contact</h2>
            <div style={{ width: 56, height: 3, background: accent, borderRadius: 2, marginBottom: 24 }} />
            <div
              style={{
                maxWidth: isMobile ? '100%' : 520,
                background: '#fff',
                borderRadius: 20,
                padding: isMobile ? '16px' : '28px 28px 32px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              {contactSent ? (
                <p style={{ margin: 0, color: accent, fontWeight: 600, fontSize: 16 }}>Thank you. Your enquiry has been sent.</p>
              ) : (
                <form onSubmit={submitContact} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label htmlFor="pf-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#52525b', marginBottom: 6 }}>
                      Name
                    </label>
                    <input
                      id="pf-name"
                      value={contact.name}
                      onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                      style={inputStyle}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#52525b', marginBottom: 6 }}>
                      Email
                    </label>
                    <input
                      id="pf-email"
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                      style={inputStyle}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-msg" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#52525b', marginBottom: 6 }}>
                      Message
                    </label>
                    <textarea
                      id="pf-msg"
                      value={contact.message}
                      onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                      rows={5}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                    />
                  </div>
                  {contactError ? <p style={{ margin: 0, color: '#dc2626', fontSize: 14 }}>{contactError}</p> : null}
                  <button
                    type="submit"
                    disabled={contactSending}
                    style={{
                      marginTop: 4,
                      padding: '14px 24px',
                      borderRadius: 12,
                      border: 'none',
                      background: accent,
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: contactSending ? 'wait' : 'pointer',
                      boxShadow: `0 8px 24px ${accent}44`,
                    }}
                  >
                    {contactSending ? 'Sending…' : 'Send Enquiry'}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}
      </main>

      <footer
        style={{
          borderTop: '1px solid rgba(0,0,0,0.06)',
          padding: '32px 20px 40px',
          background: '#fff',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#71717a' }}>
            <a href="https://lenstrybe.com" target="_blank" rel="noopener noreferrer" style={{ color: accent, fontWeight: 600, textDecoration: 'none' }}>
              Powered by LensTrybe
            </a>
          </p>
          <SocialRow profile={profile} accent={accent} />
        </div>
      </footer>

      {lightbox?.url ? (
        <button
          type="button"
          aria-label="Close gallery"
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.88)',
            border: 'none',
            padding: 24,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '96vw', maxHeight: '92vh' }}
          >
            {lightbox.isVideo ? (
              <video src={lightbox.url} controls autoPlay style={{ maxWidth: '96vw', maxHeight: '92vh', borderRadius: 12 }} />
            ) : (
              <img src={lightbox.url} alt="" style={{ maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 12 }} />
            )}
          </span>
        </button>
      ) : null}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #d4d4d8',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
}

function SocialRow({ profile, accent }) {
  const links = []
  if (profile.website) links.push({ href: profile.website, label: 'Website' })
  if (profile.instagram_url) links.push({ href: `https://instagram.com/${String(profile.instagram_url).replace('@', '')}`, label: 'Instagram' })
  if (profile.tiktok_url) links.push({ href: `https://tiktok.com/${String(profile.tiktok_url).replace('@', '')}`, label: 'TikTok' })
  if (profile.linkedin_url) links.push({ href: profile.linkedin_url, label: 'LinkedIn' })
  if (profile.facebook_url) links.push({ href: profile.facebook_url, label: 'Facebook' })
  if (profile.twitter_url) links.push({ href: profile.twitter_url, label: 'X' })
  if (!links.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{ color: accent, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          {l.label}
        </a>
      ))}
    </div>
  )
}

function ContentGalleryBlocks({ folders, filesInFolder, accent, isMobile }) {
  const general = filesInFolder(null)
  const hasAny = folders.length > 0 || general.length > 0
  if (!hasAny) {
    return <p style={{ color: '#71717a', fontSize: 15 }}>No downloadable content yet.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {folders.map((folder) => (
        <div key={folder.id}>
          <FolderHeader folder={folder} accent={accent} />
          <FileGrid files={filesInFolder(folder.id)} accent={accent} isMobile={isMobile} />
        </div>
      ))}
      {general.length > 0 ? (
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#18181b', margin: '0 0 16px' }}>General</h3>
          <FileGrid files={general} accent={accent} isMobile={isMobile} />
        </div>
      ) : null}
    </div>
  )
}

function FolderHeader({ folder, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
      {folder.cover_url ? (
        <img src={folder.cover_url} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
      ) : (
        <div style={{ width: 72, height: 72, borderRadius: 12, background: `${accent}22` }} />
      )}
      <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: accent }}>{folder.name}</h3>
    </div>
  )
}

function FileGrid({ files, accent, isMobile }) {
  if (!files.length) {
    return <p style={{ color: '#a1a1aa', fontSize: 14, margin: 0 }}>No files in this folder.</p>
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
      {files.map((f) => (
        <FileCard key={f.id} file={f} accent={accent} />
      ))}
    </div>
  )
}

function FileCard({ file, accent }) {
  const url = file.file_url
  const isImg = (file.mime_type || '').startsWith('image/')
  const isVid = (file.mime_type || '').startsWith('video/')
  const isPdf = isPdfMime(file.mime_type) || /\.pdf(\?|$)/i.test(url || '')

  if (isImg && url) {
    return (
      <div style={{ borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '4/3', background: '#e4e4e7' }}>
          <img src={url} alt={file.filename || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </a>
        <div style={{ padding: '10px 12px', fontSize: 13, color: '#52525b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</div>
      </div>
    )
  }

  if (isVid && url) {
    return (
      <div style={{ borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative', aspectRatio: '4/3', background: '#18181b' }}>
          <video src={url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              color: '#fff',
              textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            ▶
          </span>
        </a>
        <div style={{ padding: '10px 12px', fontSize: 13, color: '#52525b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</div>
      </div>
    )
  }

  return (
    <div
      style={{
        borderRadius: 14,
        padding: 20,
        background: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 140,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{isPdf ? 'PDF' : 'File'}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#27272a', lineHeight: 1.4, wordBreak: 'break-word' }}>{file.filename}</div>
      {url ? (
        <a
          href={url}
          download={file.filename}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            alignSelf: 'flex-start',
            marginTop: 'auto',
            padding: '10px 18px',
            borderRadius: 10,
            background: accent,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Download
        </a>
      ) : null}
    </div>
  )
}
