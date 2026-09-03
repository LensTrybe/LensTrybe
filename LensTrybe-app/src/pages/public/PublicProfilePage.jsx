import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { logProfileView } from '../../lib/visibility'
import { formatClientAccountDisplayName } from '../../lib/clientDisplayName'
import {
  MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE,
  messageBodyContainsContactDetails,
  threadOwnerTierContactSharingRestricted,
} from '../../lib/messagingContactPolicy'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'
import {
  DIVIDER_GRADIENT_STYLE,
  GLASS_MODAL_OVERLAY_BASE,
  GLASS_MODAL_PANEL,
  LIQUID_GLASS_CARD,
  LIQUID_FIELD,
  TYPO,
} from '../../lib/glassTokensLight'
import TileField from '../../components/ui/TileField'
import { resolveTheme, FONTS_HREF } from '../../lib/siteTheme'

// The creative's PROFILE is their website. Basic keeps the classic single-page
// profile (no socials/website). Pro/Expert/Elite render a brand-styled,
// multi-page click-through site in the creative's Brand Kit colours + fonts,
// driven by site_pages (home/about/contact), portfolio_items (gallery),
// portfolio_services (services) and the profile's own fields. All the existing
// contact/review actions (Enquire, Request a Call, Leave a Review) are kept.

const PRO_HOME_PHOTO_CAP = 8
const FULL_PAGES = ['home', 'about', 'gallery', 'services', 'contact']
const PRO_PAGES = ['home', 'contact']
const PAGE_LABEL = { home: 'Home', about: 'About', gallery: 'Gallery', services: 'Services', contact: 'Contact' }


function StarRating({ value }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= value ? '#EAB308' : 'var(--border-strong)', fontSize: '16px' }}>★</span>
      ))}
    </div>
  )
}

// Brand-matched social icons. `type` matches the labels from socialLinks().
function SocialIcon({ type, size = 20, color = 'currentColor' }) {
  const c = { width: size, height: size, display: 'block' }
  switch (type) {
    case 'Instagram':
      return (<svg viewBox="0 0 24 24" style={c} fill="none" stroke={color} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1" fill={color} stroke="none" /></svg>)
    case 'TikTok':
      return (<svg viewBox="0 0 24 24" style={c} fill={color}><path d="M16.5 3c.3 2.1 1.5 3.6 3.5 3.9V9c-1.3 0-2.5-.4-3.5-1.1v6.5a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.4a3 3 0 1 0 2.1 2.9V3h2.4z" /></svg>)
    case 'Facebook':
      return (<svg viewBox="0 0 24 24" style={c} fill={color}><path d="M14 8.5V7c0-.7.5-1 1-1h1.5V3.2C16 3.1 15 3 14 3c-2.3 0-3.8 1.4-3.8 4v1.5H7.5V11h2.7v9h3.1v-9H16l.4-2.5H13.3z" /></svg>)
    case 'LinkedIn':
      return (<svg viewBox="0 0 24 24" style={c} fill={color}><path d="M6.5 8.8v10.7H3.3V8.8h3.2zM5 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM20.7 19.5h-3.2v-5.6c0-1.4-.5-2.3-1.7-2.3-.9 0-1.5.6-1.7 1.2-.1.2-.1.5-.1.8v5.9H10.7s.04-9.7 0-10.7h3.2v1.5c.4-.7 1.2-1.7 3-1.7 2.2 0 3.8 1.4 3.8 4.5v6.4z" /></svg>)
    case 'X':
      return (<svg viewBox="0 0 24 24" style={c} fill={color}><path d="M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.3-5.6L6.5 21h-3l7-8L3 3h6.2l3.9 5.1L17.5 3zm-1 16h1.7L8 4.6H6.2L16.5 19z" /></svg>)
    case 'Website':
    default:
      return (<svg viewBox="0 0 24 24" style={c} fill="none" stroke={color} strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>)
  }
}

export default function PublicProfilePage({ previewMode = false, previewId = null }) {
  const params = useParams()
  const id = previewId ?? params.id
  const navigate = useNavigate()
  const { user, clientAccount, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [brand, setBrand] = useState(null)
  const [pages, setPages] = useState([])
  const [services, setServices] = useState([])
  const [portfolioItems, setPortfolioItems] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [galleryTab, setGalleryTab] = useState('All')
  const [showEnquire, setShowEnquire] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [enquiry, setEnquiry] = useState({ subject: '', message: '', name: '', phone: '' })
  const [enquiryError, setEnquiryError] = useState('')
  const [showCall, setShowCall] = useState(false)
  const [callForm, setCallForm] = useState({ date: '', time: '', phone: '', message: '' })
  const [callSending, setCallSending] = useState(false)
  const [callSent, setCallSent] = useState(false)
  const [callError, setCallError] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [blockedDates, setBlockedDates] = useState([])
  const [showReview, setShowReview] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 5, body: '', reviewer_name: '' })
  const [reviewEmail, setReviewEmail] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewSent, setReviewSent] = useState(false)
  const [reviewModerationError, setReviewModerationError] = useState('')
  const [reviewRatingHover, setReviewRatingHover] = useState(null)
  const [profileFlagTarget, setProfileFlagTarget] = useState(null)
  const [profileFlagReason, setProfileFlagReason] = useState('')
  const [profileFlagSaving, setProfileFlagSaving] = useState(false)
  const [profileFlagSuccessId, setProfileFlagSuccessId] = useState(null)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  useEffect(() => { loadProfile() }, [id, user?.id])
  useEffect(() => {
    if (document.getElementById('lt-site-fonts')) return
    const l = document.createElement('link'); l.id = 'lt-site-fonts'; l.rel = 'stylesheet'; l.href = FONTS_HREF; document.head.appendChild(l)
  }, [])
  // Viewing a creative profile requires an account. Anonymous visitors are sent
  // to sign in / create an account, then returned here.
  useEffect(() => {
    if (!previewMode && !authLoading && !user) {
      navigate('/login', { replace: true, state: { next: `/creatives/${id}` } })
    }
  }, [previewMode, authLoading, user, id])
  useEffect(() => { setProfileFlagSuccessId(null) }, [id])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadProfile() {
    const [profileRes, portfolioRes, reviewsRes, availabilityRes, brandRes, pagesRes, servicesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('portfolio_items').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
      supabase.from('reviews').select('*').eq('creative_id', id).or('hidden.is.null,hidden.eq.false').order('created_at', { ascending: false }),
      supabase.from('availability').select('date, all_day, start_time, end_time').eq('creative_id', id).gte('date', new Date().toISOString().split('T')[0]),
      supabase.from('brand_kit').select('*').eq('creative_id', id).maybeSingle(),
      supabase.from('site_pages').select('*').eq('creative_id', id).eq('visible', true),
      supabase.from('portfolio_services').select('*').eq('creative_id', id).order('sort_order', { ascending: true }),
    ])
    // Admin profiles are hidden from the marketplace, but a creative can always
    // preview their own profile (and preview mode is always allowed).
    const prof = profileRes.data
    if (prof && prof.is_admin && !previewMode && prof.id !== user?.id) {
      setProfile(null)
      setLoading(false)
      return
    }
    setProfile(prof)
    if (profileRes.data && !previewId) void logProfileView(id, 'profile')
    setPortfolioItems(portfolioRes.data ?? [])
    const reviewRows = reviewsRes.data ?? []
    setReviews(reviewRows.filter((r) => !r.hidden && r.flag_status !== 'resolved_removed'))
    setBlockedDates(availabilityRes.data ?? [])
    setBrand(brandRes.data ?? null)
    setPages(pagesRes.data ?? [])
    setServices(servicesRes.data ?? [])
    setLoading(false)
  }

  async function submitReview() {
    if (!reviewForm.reviewer_name || !reviewForm.body || !reviewEmail.trim()) return
    setReviewModerationError('')
    const reviewText = [reviewForm.reviewer_name, reviewForm.body].filter(Boolean).join('\n')
    const mod = await moderateText(reviewText)
    if (mod?.blocked) { setReviewModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
    if (mod?.flagged) console.warn('[moderation] Flagged review', mod.reason)
    setSubmittingReview(true)
    const { error } = await supabase.from('reviews').insert({
      creative_id: id,
      reviewer_name: reviewForm.reviewer_name,
      reviewer_email: reviewEmail.trim(),
      client_name: reviewForm.reviewer_name,
      rating: reviewForm.rating,
      body: reviewForm.body,
      comment: reviewForm.body,
      source: 'platform',
    }).select()
    if (!error) {
      setReviewSent(true)
      await loadProfile()
      setTimeout(() => { setShowReview(false); setReviewSent(false); setReviewRatingHover(null); setReviewEmail(''); setReviewForm({ rating: 5, body: '', reviewer_name: '' }) }, 2000)
    }
    setSubmittingReview(false)
  }

  async function submitPublicProfileFlag() {
    if (!user || !profileFlagTarget || !profileFlagReason.trim()) return
    setProfileFlagSaving(true)
    const { error } = await supabase
      .from('reviews')
      .update({ flagged: true, flag_reason: profileFlagReason.trim(), flag_status: 'pending', flagged_at: new Date().toISOString() })
      .eq('id', profileFlagTarget.id)
      .eq('creative_id', user.id)
    setProfileFlagSaving(false)
    if (error) { console.error('[PublicProfilePage] flag review failed', error); return }
    setReviews((prev) => prev.map((r) => (r.id === profileFlagTarget.id ? { ...r, flagged: true, flag_reason: profileFlagReason.trim(), flag_status: 'pending', flagged_at: new Date().toISOString() } : r)))
    setProfileFlagSuccessId(profileFlagTarget.id)
    setProfileFlagTarget(null)
    setProfileFlagReason('')
  }

  async function sendEnquiry() {
    if (!user) { setShowEnquire(false); setShowAuthGate(true); return }
    setEnquiryError('')
    const combinedEnquiryText = `${enquiry.subject}\n${enquiry.message}`
    const mod = await moderateText(combinedEnquiryText)
    if (mod?.blocked) { setEnquiryError(MODERATION_BLOCKED_USER_MESSAGE); return }
    if (mod?.flagged) console.warn('[moderation] Flagged enquiry', mod.reason)
    // Clients may share their own contact details in an enquiry (all tiers).
    setSending(true)
    const clientLabel = enquiry.name.trim() || formatClientAccountDisplayName(clientAccount) || user.email
    // If the client chose to share contact details, add them to the message so
    // they land in the creative's inbox and CRM.
    const contactLine = [enquiry.name.trim() && `Name: ${enquiry.name.trim()}`, enquiry.phone.trim() && `Phone: ${enquiry.phone.trim()}`].filter(Boolean).join('\n')
    const fullMessage = contactLine ? `${enquiry.message}\n\n— My contact details —\n${contactLine}` : enquiry.message
    const { data: thread } = await supabase.from('message_threads').insert({
      creative_id: id, client_user_id: user.id, client_name: clientLabel, client_email: user.email, subject: enquiry.subject,
    }).select().single()
    if (thread) {
      await supabase.from('messages').insert({ thread_id: thread.id, sender_type: 'client', sender_name: clientLabel, body: fullMessage })
      await supabase.functions.invoke('send-message-notification', {
        body: {
          to: profile.business_email, toName: profile.business_name, fromName: clientLabel,
          subject: `New enquiry from ${clientLabel}`, messageBody: fullMessage, threadSubject: enquiry.subject,
          profileUrl: 'https://lens-trybe.vercel.app/dashboard/clients/messages',
        },
      })
    }
    await supabase.functions.invoke('send-enquiry', { body: { creativeId: id, clientId: user.id, subject: enquiry.subject, message: fullMessage } })
    setSending(false)
    setSent(true)
    setEnquiry({ subject: '', message: '', name: '', phone: '' })
    setTimeout(() => { setShowEnquire(false); setSent(false) }, 2400)
  }

  async function requestCall() {
    if (!user) { setShowCall(false); setShowAuthGate(true); return }
    setCallError('')
    setCallSending(true)
    const clientLabel = formatClientAccountDisplayName(clientAccount) || user.email
    const { data, error } = await supabase.functions.invoke('request-meeting', {
      body: {
        creativeId: id, title: `Phone call with ${clientLabel}`, proposed_date: callForm.date || null,
        proposed_time: callForm.time || null, client_name: clientLabel, client_phone: callForm.phone || null, message: callForm.message || null,
      },
    })
    setCallSending(false)
    if (error || (data && data.error)) { setCallError('Something went wrong. Please try again.'); return }
    setCallSent(true)
    setTimeout(() => { setShowCall(false); setCallSent(false) }, 2400)
  }

  const openEnquire = () => { if (user) { setEnquiryError(''); setSent(false); setShowEnquire(true) } else setShowAuthGate(true) }
  const openCall = () => { if (user) { setCallError(''); setCallSent(false); setCallForm({ date: '', time: '', phone: clientAccount?.phone || '', message: '' }); setShowCall(true) } else setShowAuthGate(true) }
  const openReview = () => { if (user) setShowReview(true); else setShowAuthGate(true) }

  const tier = (profile?.subscription_tier ?? '').toLowerCase()
  const isPaid = tier === 'pro' || tier === 'expert' || tier === 'elite'
  const isFull = tier === 'expert' || tier === 'elite'
  const showSocials = isPaid // Basic cannot show social links or external website

  const pageMap = useMemo(() => { const m = {}; (pages || []).forEach((p) => { m[p.page_type] = p }); return m }, [pages])
  const isOwnerView = previewMode || (user?.id && user.id === id)
  const navPages = useMemo(() => {
    const allowed = isFull ? FULL_PAGES : isPaid ? PRO_PAGES : []
    return allowed.filter((pt) => {
      if (pt === 'home' || pt === 'about' || pt === 'contact') return true
      // Gallery/Services show once they have content; the owner always sees them
      // so they can preview and populate.
      if (pt === 'gallery') return (portfolioItems || []).length > 0 || isOwnerView
      if (pt === 'services') return (services || []).length > 0 || isOwnerView
      return false
    })
  }, [isFull, isPaid, portfolioItems, services, isOwnerView])

  useEffect(() => { if (navPages.length && !navPages.includes(activePage)) setActivePage(navPages[0]) }, [navPages]) // eslint-disable-line

  if (!previewMode && (authLoading || !user)) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', ...TYPO.body }}>
      {authLoading ? 'Loading…' : 'Redirecting to sign in…'}
    </div>
  )
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', ...TYPO.body }}>Loading profile…</div>
  )
  if (!profile) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', color: 'var(--text-primary)', ...TYPO.heading }}>Profile not found</div>
      <Button variant="secondary" onClick={() => navigate('/creatives')}>Back to Search</Button>
    </div>
  )

  const displayName = profile.business_name ?? 'Creative'
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1) : null

  // ---- Shared bits (reviews + modals) reused by both layouts ----
  const credentialBadges = (extraStyle = {}) => {
    const chip = { padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)', ...extraStyle }
    return (
      <>
        {profile.abn && <span style={chip}>✓ ABN</span>}
        {profile.has_insurance && <span style={chip}>✓ Insured</span>}
        {profile.has_blue_card && <span style={chip}>✓ Blue Card</span>}
        {profile.has_police_check && <span style={chip}>✓ Police Checked</span>}
        {profile.has_wwvp && <span style={chip}>✓ WWVP</span>}
        {profile.has_drone_licence && <span style={chip}>✓ CASA Licence</span>}
        {profile.has_other && <span style={chip}>✓ {profile.other_credential_name ?? 'Other Credential'}</span>}
      </>
    )
  }

  const socialLinks = () => {
    if (!showSocials) return null
    const items = []
    if (profile.website) items.push(['Website', profile.website])
    if (profile.instagram_url) items.push(['Instagram', `https://instagram.com/${profile.instagram_url.replace('@', '')}`])
    if (profile.tiktok_url) items.push(['TikTok', `https://tiktok.com/${profile.tiktok_url.replace('@', '')}`])
    if (profile.linkedin_url) items.push(['LinkedIn', profile.linkedin_url])
    if (profile.facebook_url) items.push(['Facebook', profile.facebook_url])
    if (profile.twitter_url) items.push(['X', profile.twitter_url])
    return items
  }

  // =====================================================================
  //  BASIC (and any non-paid) — classic single-page profile, no socials.
  // =====================================================================
  if (!isPaid) {
    const styles = classicStyles(isMobile)
    return (
      <div style={styles.page} className="public-profile-page">
        {!isMobile && <TileField animated={false} opacity={0.22} />}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={styles.hero}>
            <div style={styles.heroInner}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt={displayName} style={styles.avatar} /> : <div style={styles.avatar}>📷</div>}
              <div style={styles.heroContent}>
                <div style={styles.nameRow}><h1 style={styles.name}>{displayName}</h1></div>
                {(profile.city || profile.state) && <div style={styles.location}>{[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}</div>}
                <div style={styles.skillRow}>
                  {(profile.skill_types ?? []).map((s, i) => <Badge key={i} variant="green" size="sm">{s}</Badge>)}
                  {credentialBadges()}
                </div>
                {profile.bio && <p style={styles.bio}>{profile.bio}</p>}
                {avgRating && (
                  <div style={{ ...styles.ratingRow, marginBottom: '16px' }}>
                    <div style={styles.ratingNum}>{avgRating}</div>
                    <StarRating value={Math.round(avgRating)} />
                    <div style={styles.ratingCount}>({reviews.length} review{reviews.length !== 1 ? 's' : ''})</div>
                  </div>
                )}
                <div style={styles.heroActions} className={isMobile ? 'public-profile-mobile-actions' : ''}>
                  {!previewMode && <Button variant="primary" size="lg" onClick={openEnquire}>Enquire Now</Button>}
                  {!previewMode && user?.id !== id && <Button variant="secondary" size="lg" type="button" style={{ minHeight: '44px', width: isMobile ? '100%' : 'auto' }} onClick={openCall}>Request a Call</Button>}
                  {user?.id !== id && <Button variant="secondary" size="lg" type="button" onClick={openReview} style={{ minHeight: '44px', width: isMobile ? '100%' : 'auto' }}>Leave a Review</Button>}
                </div>
              </div>
            </div>
          </div>
          <div style={DIVIDER_GRADIENT_STYLE} aria-hidden />
          <div style={styles.body}>
            {(profile.specialties ?? []).length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Specialties</div>
                <div style={styles.specialtySection}>{profile.specialties.map((s, i) => <Badge key={i} variant="default">{s}</Badge>)}</div>
              </div>
            )}
            <div style={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ ...styles.sectionTitle, marginBottom: 0 }}>Reviews</div>
                {reviews.length > 5 && <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllReviews(!showAllReviews)}>{showAllReviews ? 'Show less' : `Show all ${reviews.length} reviews`}</Button>}
              </div>
              {reviews.length === 0 ? <div style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '20px 0' }}>No reviews yet.</div> : (
                <div style={styles.reviewGrid}>{(showAllReviews ? reviews : reviews.slice(0, 5)).map((review) => renderReviewCard(review, styles))}</div>
              )}
            </div>
            {portfolioItems.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Portfolio</div>
                <div style={styles.portfolioGrid}>
                  {portfolioItems.map((item) => (
                    <div key={item.id} style={styles.portfolioItem} onClick={() => setLightbox(item.file_url || item.image_url)}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')} onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
                      {item.file_type === 'video' ? <video src={item.file_url} style={styles.portfolioImg} muted /> : <img src={item.file_url || item.image_url} alt={item.alt_text || ''} style={styles.portfolioImg} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {renderModals()}
        </div>
        <style>{classicMobileCss}</style>
      </div>
    )
  }

  // =====================================================================
  //  PRO / EXPERT / ELITE — brand-styled multi-page website
  // =====================================================================
  // Resolve the website's "Site Styles" theme (colours, fonts, buttons, corners)
  // set in the builder; falls back to the Brand Kit, then defaults.
  const T = resolveTheme(profile, brand)
  const { accent, bg, dark, ink, heading: headingCol, soft, line, surface, surfaceBorder, fieldBg, headingFont, bodyFont, baseSize, headingWeight, btnRadius, btnStyle, radius, logo } = T
  const wrap = { maxWidth: 1120, margin: '0 auto', padding: '0 24px' }
  const H = (size) => ({ fontFamily: headingFont, fontWeight: headingWeight, letterSpacing: '-0.02em', lineHeight: 1.12, color: headingCol, fontSize: size })
  const btnBase = { display: 'inline-block', fontWeight: 700, textDecoration: 'none', padding: '13px 26px', borderRadius: btnRadius, fontSize: 15, cursor: 'pointer', fontFamily: bodyFont }
  const btn = btnStyle === 'outline'
    ? { ...btnBase, background: 'transparent', color: accent, border: `2px solid ${accent}` }
    : { ...btnBase, background: accent, color: '#fff', border: 'none' }
  const btnGhost = { ...btnBase, background: 'transparent', color: ink, border: `1px solid ${ink}22` }
  const photoRadius = Math.min(radius, 14)
  const home = pageMap.home?.content || {}
  const about = pageMap.about?.content || {}
  const contact = pageMap.contact?.content || {}
  const homeT = pageMap.home?.template || 't1'
  const aboutT = pageMap.about?.template || 't1'
  const contactT = pageMap.contact?.template || 't1'
  const socials = socialLinks() || []
  const galleryCats = ['All', ...Array.from(new Set((portfolioItems || []).map((p) => p.category).filter(Boolean)))]
  const galleryShown = galleryTab === 'All' ? portfolioItems : portfolioItems.filter((p) => p.category === galleryTab)
  const homePhotos = (portfolioItems || []).filter((p) => p.featured).concat((portfolioItems || []).filter((p) => !p.featured))
  const homePhotosCapped = isFull ? homePhotos.slice(0, 12) : homePhotos.slice(0, PRO_HOME_PHOTO_CAP)

  function actionRow(align = 'flex-start') {
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: align }}>
        {!previewMode && <button style={btn} onClick={openEnquire}>{home.cta_text || 'Enquire Now'}</button>}
        {!previewMode && user?.id !== id && <button style={btnGhost} onClick={openCall}>Request a Call</button>}
      </div>
    )
  }

  function renderHome() {
    const headline = home.headline || displayName
    const sub = home.subheadline || profile.tagline || profile.portfolio_tagline || ''
    const heroImg = home.hero_image || profile.portfolio_cover_url || profile.cover_url
    let hero
    if (homeT === 't2') {
      hero = (
        <section style={{ ...wrap, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 44, alignItems: 'center', padding: '56px 24px 36px' }} className="lt-2col">
          <div>
            <h1 style={H('clamp(32px,4.6vw,52px)')}>{headline}</h1>
            {sub && <p style={{ fontFamily: bodyFont, color: soft, fontSize: 18, lineHeight: 1.6, margin: '16px 0 24px' }}>{sub}</p>}
            {actionRow()}
          </div>
          {heroImg ? <img src={heroImg} alt="" style={{ width: '100%', height: 440, objectFit: 'cover', borderRadius: radius }} /> : <div style={{ width: '100%', height: 440, borderRadius: radius, background: accent + '18' }} />}
        </section>
      )
    } else if (homeT === 't3') {
      hero = (
        <section style={{ ...wrap, textAlign: 'center', padding: '64px 24px 24px' }}>
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            {logo ? <img src={logo} alt="" style={{ height: 54, objectFit: 'contain', marginBottom: 22 }} /> : null}
            <h1 style={H('clamp(34px,5vw,58px)')}>{headline}</h1>
            {sub && <p style={{ fontFamily: bodyFont, color: soft, fontSize: 19, lineHeight: 1.6, margin: '18px auto 26px', maxWidth: 620, overflowWrap: 'anywhere' }}>{sub}</p>}
            <div style={{ display: 'flex', justifyContent: 'center' }}>{actionRow('center')}</div>
          </div>
          {heroImg && <img src={heroImg} alt="" style={{ width: '100%', maxHeight: 460, objectFit: 'cover', borderRadius: radius, marginTop: 40 }} />}
        </section>
      )
    } else {
      hero = (
        <section style={{ position: 'relative', minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#fff', overflow: 'hidden' }}>
          {heroImg ? <img src={heroImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${accent}, ${ink})` }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.44)' }} />
          <div style={{ position: 'relative', ...wrap }}>
            <h1 style={{ ...H('clamp(38px,6vw,66px)'), color: '#fff' }}>{headline}</h1>
            {sub && <p style={{ fontFamily: bodyFont, fontSize: 19, lineHeight: 1.6, margin: '18px auto 26px', maxWidth: 640, color: 'rgba(255,255,255,0.92)' }}>{sub}</p>}
            <div style={{ display: 'flex', justifyContent: 'center' }}>{actionRow('center')}</div>
          </div>
        </section>
      )
    }
    return (
      <>
        {hero}
        {home.intro && (
          <section style={{ ...wrap, padding: '44px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: bodyFont, color: ink, fontSize: baseSize + 2, lineHeight: 1.75, maxWidth: 680, margin: '0 auto', overflowWrap: 'anywhere' }}>{home.intro}</p>
          </section>
        )}
        {(profile.skill_types?.length || profile.abn || profile.has_insurance) ? (
          <section style={{ ...wrap, padding: '0 24px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(profile.skill_types ?? []).map((s, i) => <span key={i} style={{ fontFamily: bodyFont, fontSize: 13, color: ink, border: `1px solid ${accent}55`, borderRadius: 99, padding: '5px 13px' }}>{s}</span>)}
            {credentialBadges()}
          </section>
        ) : null}
        {homePhotosCapped.length > 0 && (
          <section style={{ ...wrap, padding: '20px 24px 48px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
              {homePhotosCapped.map((item) => (
                <div key={item.id} onClick={() => setLightbox(item.file_url || item.image_url)} style={{ aspectRatio: '1', borderRadius: photoRadius, overflow: 'hidden', cursor: 'pointer' }}>
                  {item.file_type === 'video' ? <video src={item.file_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={item.file_url || item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              ))}
            </div>
          </section>
        )}
        {reviews.length > 0 && (
          <section style={{ background: accent + '0e', padding: '52px 0' }}>
            <div style={wrap}>
              <h2 style={{ ...H('28px'), textAlign: 'center', marginBottom: 26 }}>Kind words</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
                {reviews.slice(0, 3).map((r) => (
                  <div key={r.id} style={{ background: surface, border: `1px solid ${surfaceBorder}`, borderRadius: radius, padding: '18px 20px' }}>
                    <div style={{ color: accent, fontSize: 15, marginBottom: 8 }}>{'★'.repeat(r.rating || 5)}</div>
                    <p style={{ fontFamily: bodyFont, color: ink, fontSize: 14.5, lineHeight: 1.6, fontStyle: 'italic', margin: '0 0 10px' }}>"{r.body || r.comment}"</p>
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

  function renderAbout() {
    const body = (about.body || profile.bio || '').split('\n').filter(Boolean)
    const portrait = about.portrait_image || profile.avatar_url
    const heading = about.heading || 'About'
    return (
      <>
        {aboutT === 't2' ? (
          <section style={{ ...wrap, padding: '64px 24px', textAlign: 'center', maxWidth: 760 }}>
            {portrait && <img src={portrait} alt="" style={{ width: 176, height: 176, borderRadius: '50%', objectFit: 'cover', marginBottom: 24, border: `4px solid ${accent}22` }} />}
            <h2 style={{ ...H('clamp(28px,4vw,42px)'), marginBottom: 20 }}>{heading}</h2>
            {body.length ? body.map((p, i) => <p key={i} style={{ fontFamily: bodyFont, color: ink, fontSize: baseSize, lineHeight: 1.85, margin: '0 auto 16px', maxWidth: 640 }}>{p}</p>) : <p style={{ fontFamily: bodyFont, color: soft, fontSize: 17, margin: 0 }}>Add your story in the website builder.</p>}
          </section>
        ) : (
          <section style={{ ...wrap, display: 'grid', gridTemplateColumns: portrait ? (aboutT === 't3' ? 'minmax(0,1fr) minmax(280px,380px)' : 'minmax(280px,380px) minmax(0,1fr)') : '1fr', gap: 56, alignItems: 'center', padding: '64px 24px' }} className="lt-2col">
            {portrait && aboutT !== 't3' && <img src={portrait} alt="" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: radius }} />}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ ...H('clamp(28px,4vw,44px)'), marginBottom: 18 }}>{heading}</h2>
              {body.length ? body.map((p, i) => <p key={i} style={{ fontFamily: bodyFont, color: ink, fontSize: baseSize, lineHeight: 1.85, margin: '0 0 16px' }}>{p}</p>) : <p style={{ fontFamily: bodyFont, color: soft, fontSize: 17, lineHeight: 1.85, margin: 0 }}>Add your story in the website builder.</p>}
            </div>
            {portrait && aboutT === 't3' && <img src={portrait} alt="" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: radius }} />}
          </section>
        )}
        {((profile.specialties?.length) || (profile.abn || profile.has_insurance)) ? (
          <section style={{ ...wrap, padding: '0 24px 56px' }}>
            {profile.specialties?.length ? (
              <>
                <h3 style={{ ...H('20px'), marginBottom: 14 }}>Specialties</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                  {profile.specialties.map((s, i) => <span key={i} style={{ fontFamily: bodyFont, fontSize: 13.5, color: ink, background: accent + '12', borderRadius: 8, padding: '6px 12px' }}>{s}</span>)}
                </div>
              </>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{credentialBadges()}</div>
          </section>
        ) : null}
      </>
    )
  }

  function renderGallery() {
    return (
      <section style={{ ...wrap, padding: '52px 24px' }}>
        <h2 style={{ ...H('clamp(26px,4vw,40px)'), marginBottom: 20 }}>Gallery</h2>
        {galleryCats.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {galleryCats.map((c) => (
              <button key={c} onClick={() => setGalleryTab(c)} style={{ padding: '6px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: bodyFont, fontSize: 13.5, fontWeight: 600, border: galleryTab === c ? `1px solid ${accent}` : `1px solid ${line}`, background: galleryTab === c ? accent + '14' : 'transparent', color: galleryTab === c ? accent : ink }}>{c}</button>
            ))}
          </div>
        )}
        {galleryShown.length === 0 ? <p style={{ fontFamily: bodyFont, color: soft }}>No photos yet.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 12 }}>
            {galleryShown.map((item) => (
              <div key={item.id} onClick={() => setLightbox(item.file_url || item.image_url)} style={{ aspectRatio: '4/3', borderRadius: photoRadius, overflow: 'hidden', cursor: 'pointer' }}>
                {item.file_type === 'video' ? <video src={item.file_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={item.file_url || item.image_url} alt={item.alt_text || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  function renderServices() {
    return (
      <section style={{ ...wrap, padding: '52px 24px' }}>
        <h2 style={{ ...H('clamp(26px,4vw,40px)'), marginBottom: 24 }}>Services</h2>
        {services.length === 0 ? <p style={{ fontFamily: bodyFont, color: soft }}>Services coming soon.</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {services.map((s) => (
              <div key={s.id} style={{ background: surface, border: `1px solid ${surfaceBorder}`, borderRadius: radius, padding: '22px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...H('20px') }}>{s.name}</div>
                {s.price && <div style={{ fontFamily: bodyFont, fontWeight: 700, color: accent, fontSize: 16 }}>{s.price}</div>}
                {s.description && <p style={{ fontFamily: bodyFont, color: soft, fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{s.description}</p>}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 28 }}>{actionRow()}</div>
      </section>
    )
  }

  function renderContact() {
    const field = { width: '100%', border: `1px solid ${line}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: bodyFont, boxSizing: 'border-box', outline: 'none', marginBottom: 12, color: ink, background: fieldBg }
    const heading = contact.heading || 'Get in touch'
    const formCard = (
      <div style={{ background: surface, border: `1px solid ${surfaceBorder}`, borderRadius: radius, padding: 24, boxShadow: dark ? 'none' : '0 20px 60px -30px rgba(0,0,0,0.25)' }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: bodyFont }}>
            <div style={{ color: accent, fontSize: 30, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: ink }}>Thank you</div>
            <div style={{ color: soft, fontSize: 14, marginTop: 6 }}>{displayName} will be in touch soon.</div>
          </div>
        ) : (
          <>
            <input style={field} placeholder="Subject (e.g. Wedding, June 2026)" value={enquiry.subject} onChange={(e) => { setEnquiryError(''); setEnquiry((f) => ({ ...f, subject: e.target.value })) }} />
            <textarea style={{ ...field, minHeight: 120, resize: 'vertical' }} placeholder="Tell them about your project, date, location and what you need…" value={enquiry.message} onChange={(e) => { setEnquiryError(''); setEnquiry((f) => ({ ...f, message: e.target.value })) }} />
            {enquiryError && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 10, fontFamily: bodyFont }}>{enquiryError}</div>}
            <button style={{ ...btn, width: '100%', opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={sendEnquiry}>{sending ? 'Sending…' : 'Send enquiry'}</button>
            {user?.id !== id && <button style={{ ...btnGhost, width: '100%', marginTop: 10 }} onClick={openCall}>Request a call instead</button>}
          </>
        )}
      </div>
    )
    const aside = (
      <div style={{ fontFamily: bodyFont }}>
        {contact.blurb && <p style={{ color: soft, fontSize: 17, lineHeight: 1.7, marginTop: 0 }}>{contact.blurb}</p>}
        {(profile.city || profile.state) && <div style={{ color: ink, fontSize: 15, marginBottom: 10 }}><strong>Based in:</strong> {[profile.city, profile.state].filter(Boolean).join(', ')}</div>}
        {socials.length > 0 && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14 }}>
            {socials.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" title={label} style={{ color: accent, fontSize: 14.5, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><SocialIcon type={label} size={18} color={accent} />{label}</a>)}
          </div>
        )}
      </div>
    )
    if (contactT === 't2') {
      return (
        <section style={{ ...wrap, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,420px)', gap: 44, alignItems: 'start', padding: '60px 24px' }} className="lt-2col">
          <div>
            <h2 style={{ ...H('clamp(28px,4vw,44px)'), marginBottom: 16 }}>{heading}</h2>
            {aside}
          </div>
          {formCard}
        </section>
      )
    }
    if (contactT === 't3') {
      return (
        <section style={{ ...wrap, padding: '60px 24px', maxWidth: 640 }}>
          <h2 style={{ ...H('clamp(28px,4vw,44px)'), marginBottom: 14 }}>{heading}</h2>
          {contact.blurb && <p style={{ fontFamily: bodyFont, color: soft, fontSize: baseSize, lineHeight: 1.7, marginBottom: 22 }}>{contact.blurb}</p>}
          {formCard}
          {socials.length > 0 && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 18 }}>
              {socials.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" title={label} style={{ color: accent, fontSize: 14.5, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><SocialIcon type={label} size={18} color={accent} />{label}</a>)}
            </div>
          )}
        </section>
      )
    }
    return (
      <section style={{ ...wrap, padding: '60px 24px', maxWidth: 640 }}>
        <h2 style={{ ...H('clamp(28px,4vw,44px)'), marginBottom: 14, textAlign: 'center' }}>{heading}</h2>
        {contact.blurb && <p style={{ fontFamily: bodyFont, color: soft, fontSize: baseSize, lineHeight: 1.7, marginBottom: 22, textAlign: 'center' }}>{contact.blurb}</p>}
        {formCard}
        {socials.length > 0 && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 18, justifyContent: 'center' }}>
            {socials.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" title={label} style={{ color: accent, fontSize: 14.5, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><SocialIcon type={label} size={18} color={accent} />{label}</a>)}
          </div>
        )}
      </section>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: bodyFont, overflowX: 'hidden' }} className="public-profile-site">
      <style>{`.lt-navlink:hover{opacity:1 !important}.public-profile-site p,.public-profile-site h1,.public-profile-site h2,.public-profile-site h3{overflow-wrap:anywhere}@media(max-width:760px){.lt-2col{grid-template-columns:1fr !important}.lt-desknav{display:none !important}.lt-burger{display:flex !important}}`}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: bg + 'e6', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${line}` }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div onClick={() => setActivePage('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
            {logo ? <img src={logo} alt={displayName} style={{ height: 32, objectFit: 'contain' }} /> : <span style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 21, color: ink, letterSpacing: '-0.02em' }}>{displayName}</span>}
          </div>
          <nav className="lt-desknav" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {navPages.map((pt) => (
              <span key={pt} className="lt-navlink" onClick={() => setActivePage(pt)} style={{ cursor: 'pointer', fontSize: 14.5, fontWeight: 600, color: activePage === pt ? accent : ink, opacity: activePage === pt ? 1 : 0.7 }}>{PAGE_LABEL[pt]}</span>
            ))}
            {!previewMode && <button style={{ ...btn, padding: '9px 18px', fontSize: 14 }} onClick={openEnquire}>Enquire</button>}
          </nav>
          <div className="lt-burger" style={{ display: 'none', cursor: 'pointer' }} onClick={() => setMenuOpen((o) => !o)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </div>
        </div>
        {menuOpen && (
          <div style={{ ...wrap, paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navPages.map((pt) => <span key={pt} onClick={() => { setActivePage(pt); setMenuOpen(false) }} style={{ cursor: 'pointer', padding: '8px 0', fontSize: 15, fontWeight: 600, color: activePage === pt ? accent : ink }}>{PAGE_LABEL[pt]}</span>)}
          </div>
        )}
      </header>

      <main>
        {activePage === 'home' && renderHome()}
        {activePage === 'about' && renderAbout()}
        {activePage === 'gallery' && renderGallery()}
        {activePage === 'services' && renderServices()}
        {activePage === 'contact' && renderContact()}
      </main>

      <footer style={{ borderTop: `1px solid ${line}`, marginTop: 20 }}>
        <div style={{ ...wrap, padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 16, color: ink }}>{displayName}</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {socials.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" title={label} aria-label={label} style={{ color: soft, textDecoration: 'none', display: 'inline-flex' }}><SocialIcon type={label} size={19} color={soft} /></a>)}
            {user?.id !== id && <button onClick={openReview} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: bodyFont, fontSize: 13.5, color: soft, textDecoration: 'underline' }}>Leave a review</button>}
          </div>
        </div>
      </footer>

      {renderModals()}
    </div>
  )

  // ---- shared renderers (declared after return via hoisted function decls) ----
  function renderReviewCard(review, styles) {
    return (
      <div key={review.id} style={styles.reviewCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.reviewerName}>{review.reviewer_name ?? review.client_name}</div>
            <div style={{ transform: 'scale(0.85)', transformOrigin: isMobile ? 'center' : 'left center', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <StarRating value={review.rating} />
            </div>
          </div>
          {user?.id === id && !previewMode ? (
            review.flagged && review.flag_status === 'pending' ? (
              <div style={{ flexShrink: 0, textAlign: 'right', maxWidth: '160px' }}>
                {profileFlagSuccessId === review.id ? <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '6px', fontFamily: 'var(--font-ui)' }}>Review flagged. We will be in touch within 48 hours.</div> : null}
                <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', background: 'rgba(136,136,170,0.2)', color: '#888', border: '1px solid var(--border-default)', fontFamily: 'var(--font-ui)' }}>Under Review</span>
              </div>
            ) : (
              <button type="button" onClick={() => { setProfileFlagTarget(review); setProfileFlagReason('') }} style={{ flexShrink: 0, fontSize: '12px', color: '#888', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', fontFamily: 'var(--font-ui)', padding: 0, alignSelf: 'flex-start' }}>Flag review</button>
            )
          ) : null}
        </div>
        {(review.body ?? review.comment) && <div style={styles.reviewBody}>"{review.body ?? review.comment}"</div>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {review.project_type && <Badge variant="default" size="sm">{review.project_type}</Badge>}
          {review.source === 'imported' && <Badge variant="default" size="sm">Imported review</Badge>}
        </div>
      </div>
    )
  }

  function renderModals() {
    return (
      <>
        {showReview && (
          <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' }}>
            <div style={{ ...GLASS_MODAL_PANEL, borderRadius: isMobile ? '0' : GLASS_MODAL_PANEL.borderRadius, width: '100%', maxWidth: isMobile ? '100vw' : '480px', minHeight: isMobile ? '100vh' : 'auto', padding: isMobile ? '16px' : '28px' }}>
              {reviewSent ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#1DB954', fontSize: '16px', ...TYPO.heading }}>✓ Review submitted! Thank you.</div>
              ) : (
                <>
                  <div style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '20px', ...TYPO.heading }}>Leave a Review for {displayName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Your Name *</label>
                      <input value={reviewForm.reviewer_name} onChange={(e) => { setReviewModerationError(''); setReviewForm((p) => ({ ...p, reviewer_name: e.target.value })) }} placeholder="Jane Smith" style={{ width: '100%', padding: '10px 14px', ...LIQUID_FIELD }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>EMAIL ADDRESS *</label>
                      <input type="email" value={reviewEmail} onChange={(e) => { setReviewModerationError(''); setReviewEmail(e.target.value) }} placeholder="your@email.com" style={{ width: '100%', padding: '10px 14px', ...LIQUID_FIELD }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', display: 'block', marginBottom: '8px', ...TYPO.label }}>Rating *</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onMouseLeave={() => setReviewRatingHover(null)}>
                        {[1, 2, 3, 4, 5].map((s) => {
                          const active = reviewRatingHover ?? reviewForm.rating
                          const filled = s <= active
                          return (
                            <button key={s} type="button" aria-label={`${s} out of 5 stars`} onClick={() => setReviewForm((p) => ({ ...p, rating: s }))} onMouseEnter={() => setReviewRatingHover(s)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill={filled ? '#FFD700' : 'none'} stroke={filled ? '#D4AF37' : 'var(--border-strong)'} strokeWidth={filled ? 1 : 1.25} strokeLinejoin="round" />
                              </svg>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Review *</label>
                      <textarea value={reviewForm.body} onChange={(e) => { setReviewModerationError(''); setReviewForm((p) => ({ ...p, body: e.target.value })) }} placeholder="Share your experience working with this creative..." style={{ width: '100%', padding: '10px 14px', minHeight: '100px', resize: 'vertical', ...LIQUID_FIELD }} />
                    </div>
                  </div>
                  {reviewModerationError ? <div style={{ fontSize: '13px', color: '#f87171', marginTop: '12px', ...TYPO.body }}>{reviewModerationError}</div> : null}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <Button type="button" variant="ghost" onClick={() => { setShowReview(false); setReviewModerationError(''); setReviewRatingHover(null); setReviewEmail('') }}>Cancel</Button>
                    <Button type="button" variant="primary" disabled={submittingReview || !reviewForm.reviewer_name || !reviewEmail.trim() || !reviewForm.body} onClick={() => void submitReview()}>{submittingReview ? 'Submitting…' : 'Submit Review'}</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <Modal isOpen={!!profileFlagTarget} onClose={() => { if (!profileFlagSaving) { setProfileFlagTarget(null); setProfileFlagReason('') } }} title="Flag this review" size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>Tell us why this review should be removed. We will investigate and respond within 48 hours.</div>
            <div>
              <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>REASON *</label>
              <textarea style={{ ...LIQUID_FIELD, width: '100%', minHeight: '100px', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} placeholder="e.g. This person was never a client of mine" value={profileFlagReason} onChange={(e) => setProfileFlagReason(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" disabled={profileFlagSaving} onClick={() => { setProfileFlagTarget(null); setProfileFlagReason('') }}>Cancel</Button>
              <Button type="button" variant="primary" disabled={profileFlagSaving || !profileFlagReason.trim()} onClick={() => void submitPublicProfileFlag()}>{profileFlagSaving ? 'Submitting…' : 'Submit Flag'}</Button>
            </div>
          </div>
        </Modal>

        {lightbox && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '40px' }} onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-lg)' }} />
          </div>
        )}

        <Modal isOpen={showEnquire} onClose={() => { setShowEnquire(false); setEnquiryError('') }} title={`Enquire with ${displayName}`} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sent ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--green)', fontSize: '15px', ...TYPO.body }}>✓ Enquiry sent! {displayName} will be in touch soon.</div>
            ) : (
              <>
                <Input label="Subject" placeholder="e.g. Wedding Photography, June 2026" value={enquiry.subject} onChange={(e) => { setEnquiryError(''); setEnquiry((p) => ({ ...p, subject: e.target.value })) }} />
                <div>
                  <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Message</label>
                  <textarea style={{ width: '100%', minHeight: '120px', padding: '10px 14px', resize: 'vertical', boxSizing: 'border-box', ...LIQUID_FIELD }} placeholder="Tell them about your project, date, location and what you need…" value={enquiry.message} onChange={(e) => { setEnquiryError(''); setEnquiry((p) => ({ ...p, message: e.target.value })) }} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Your contact details (optional)</label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input style={{ flex: '1 1 140px', padding: '10px 14px', boxSizing: 'border-box', ...LIQUID_FIELD }} placeholder="Your name" value={enquiry.name} onChange={(e) => setEnquiry((p) => ({ ...p, name: e.target.value }))} />
                    <input style={{ flex: '1 1 140px', padding: '10px 14px', boxSizing: 'border-box', ...LIQUID_FIELD }} placeholder="Phone number" value={enquiry.phone} onChange={(e) => setEnquiry((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', ...TYPO.body }}>Share these if you'd like {displayName} to call or text you back directly.</div>
                </div>
                {enquiryError ? <div style={{ fontSize: '13px', color: '#f87171', marginTop: '8px', ...TYPO.body }}>{enquiryError}</div> : null}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={() => setShowEnquire(false)}>Cancel</Button>
                  <Button variant="primary" disabled={sending || !enquiry.subject || !enquiry.message} onClick={sendEnquiry}>{sending ? 'Sending…' : 'Send Enquiry'}</Button>
                </div>
              </>
            )}
          </div>
        </Modal>

        <Modal isOpen={showCall} onClose={() => { setShowCall(false); setCallError('') }} title={`Request a call with ${displayName}`} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {callSent ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--green)', fontSize: '15px', ...TYPO.body }}>✓ Call requested! {displayName} will confirm, suggest another time, or get back to you.</div>
            ) : (
              <>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', ...TYPO.body }}>Ask {displayName} for a quick phone call. Let them know when suits and they'll confirm or propose another time.</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Preferred date</label>
                    <input type="date" style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box', ...LIQUID_FIELD }} value={callForm.date} onChange={(e) => { setCallError(''); setCallForm((p) => ({ ...p, date: e.target.value })) }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Preferred time</label>
                    <input type="time" style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box', ...LIQUID_FIELD }} value={callForm.time} onChange={(e) => { setCallError(''); setCallForm((p) => ({ ...p, time: e.target.value })) }} />
                  </div>
                </div>
                <Input label="Your phone number" placeholder="So they can call you" value={callForm.phone} onChange={(e) => { setCallError(''); setCallForm((p) => ({ ...p, phone: e.target.value })) }} />
                <div>
                  <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Message (optional)</label>
                  <textarea style={{ width: '100%', minHeight: '90px', padding: '10px 14px', resize: 'vertical', boxSizing: 'border-box', ...LIQUID_FIELD }} placeholder="What you'd like to chat about…" value={callForm.message} onChange={(e) => { setCallError(''); setCallForm((p) => ({ ...p, message: e.target.value })) }} />
                </div>
                {callError ? <div style={{ fontSize: '13px', color: '#f87171', ...TYPO.body }}>{callError}</div> : null}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <Button variant="ghost" onClick={() => setShowCall(false)}>Cancel</Button>
                  <Button variant="primary" disabled={callSending || !callForm.phone} onClick={requestCall}>{callSending ? 'Sending…' : 'Request call'}</Button>
                </div>
              </>
            )}
          </div>
        </Modal>

        <Modal isOpen={showAuthGate} onClose={() => setShowAuthGate(false)} title="Sign in to enquire" size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>You need a free client account to send an enquiry to {displayName}.</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => { setShowAuthGate(false); navigate('/login') }}>Sign In</Button>
              <Button variant="primary" onClick={() => { setShowAuthGate(false); navigate('/join/client') }}>Create Free Account</Button>
            </div>
          </div>
        </Modal>
      </>
    )
  }
}

// ---- classic (Basic tier) styles + mobile css, module scope ----
function classicStyles(isMobile) {
  return {
    page: { background: 'transparent', minHeight: '100vh', paddingBottom: '80px', position: 'relative', overflow: 'hidden' },
    hero: { ...LIQUID_GLASS_CARD, padding: isMobile ? '32px 16px' : '48px 40px', maxWidth: '1280px', margin: '0 auto' },
    heroInner: { display: 'flex', alignItems: isMobile ? 'center' : 'flex-start', gap: '32px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' },
    avatar: { width: '120px', height: '120px', borderRadius: 'var(--radius-full)', objectFit: 'cover', border: '2px solid var(--border-default)', flexShrink: 0, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' },
    heroContent: { flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto', textAlign: isMobile ? 'center' : 'left' },
    nameRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px', justifyContent: isMobile ? 'center' : 'flex-start' },
    name: { fontFamily: "'Inter', sans-serif", fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--text-primary)', ...TYPO.heading },
    location: { fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px', ...TYPO.body },
    skillRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px', justifyContent: isMobile ? 'center' : 'flex-start' },
    bio: { fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '640px', marginBottom: '20px', ...TYPO.body },
    heroActions: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' },
    ratingRow: { display: 'flex', alignItems: 'center', gap: '8px' },
    ratingNum: { fontFamily: "'Inter', sans-serif", fontSize: '20px', color: 'var(--text-primary)', ...TYPO.stat },
    ratingCount: { fontSize: '13px', color: 'var(--text-muted)', ...TYPO.body },
    body: { maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px' },
    section: { marginBottom: '48px' },
    sectionTitle: { fontFamily: "'Inter', sans-serif", fontSize: '24px', color: 'var(--text-primary)', marginBottom: '24px', ...TYPO.heading },
    specialtySection: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    portfolioGrid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' },
    portfolioItem: { borderRadius: 'var(--radius-lg)', overflow: 'hidden', aspectRatio: '1', cursor: 'pointer', transition: 'transform var(--transition-base)', border: LIQUID_GLASS_CARD.border, borderTop: LIQUID_GLASS_CARD.borderTop, boxShadow: LIQUID_GLASS_CARD.boxShadow },
    portfolioImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    reviewGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' },
    reviewCard: { ...LIQUID_GLASS_CARD, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' },
    reviewerName: { fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', ...TYPO.heading },
    reviewBody: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontStyle: 'italic', ...TYPO.body },
  }
}

const classicMobileCss = `
  @media (max-width: 767px) {
    .public-profile-page { overflow-x: hidden; }
    .public-profile-page section { margin-bottom: 32px !important; }
    .public-profile-mobile-actions > * { width: 100%; min-height: 44px; }
  }
`
