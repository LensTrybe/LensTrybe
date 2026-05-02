import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
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
  GLASS_CARD,
  GLASS_MODAL_OVERLAY_BASE,
  GLASS_MODAL_PANEL,
  GLASS_NATIVE_FIELD,
  TYPO,
} from '../../lib/glassTokens'

function StarRating({ value }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ color: s <= value ? '#EAB308' : 'var(--border-strong)', fontSize: '16px' }}></span>
      ))}
    </div>
  )
}

export default function PublicProfilePage({ previewMode = false, previewId = null }) {
  const params = useParams()
  const id = previewId ?? params.id
  const navigate = useNavigate()
  const { user, clientAccount } = useAuth()
  const [profile, setProfile] = useState(null)
  const [portfolioItems, setPortfolioItems] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEnquire, setShowEnquire] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [enquiry, setEnquiry] = useState({ subject: '', message: '' })
  const [enquiryError, setEnquiryError] = useState('')
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

  useEffect(() => { loadProfile() }, [id])
  useEffect(() => {
    setProfileFlagSuccessId(null)
  }, [id])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadProfile() {
    const [profileRes, portfolioRes, reviewsRes, availabilityRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).eq('is_admin', false).maybeSingle(),
      supabase.from('portfolio_items').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
      supabase.from('reviews').select('*').eq('creative_id', id).or('hidden.is.null,hidden.eq.false').order('created_at', { ascending: false }),
      supabase.from('availability').select('date, all_day, start_time, end_time').eq('creative_id', id).gte('date', new Date().toISOString().split('T')[0]),
    ])
    setProfile(profileRes.data)
    setPortfolioItems(portfolioRes.data ?? [])
    const reviewRows = reviewsRes.data ?? []
    setReviews(reviewRows.filter((r) => !r.hidden && r.flag_status !== 'resolved_removed'))
    setBlockedDates(availabilityRes.data ?? [])
    setLoading(false)
  }

  async function submitReview() {
    if (!reviewForm.reviewer_name || !reviewForm.body || !reviewEmail.trim()) return
    setReviewModerationError('')
    const reviewText = [reviewForm.reviewer_name, reviewForm.body].filter(Boolean).join('\n')
    const mod = await moderateText(reviewText)
    if (mod?.blocked) {
      setReviewModerationError(MODERATION_BLOCKED_USER_MESSAGE)
      return
    }
    if (mod?.flagged) console.warn('[moderation] Flagged review', mod.reason)
    setSubmittingReview(true)
    console.log('Submitting review:', reviewForm, 'for creative:', id)
    const { data, error } = await supabase.from('reviews').insert({
      creative_id: id,
      reviewer_name: reviewForm.reviewer_name,
      reviewer_email: reviewEmail.trim(),
      client_name: reviewForm.reviewer_name,
      rating: reviewForm.rating,
      body: reviewForm.body,
      comment: reviewForm.body,
      source: 'platform',
    }).select()
    console.log('Review result:', data, error)
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
      .update({
        flagged: true,
        flag_reason: profileFlagReason.trim(),
        flag_status: 'pending',
        flagged_at: new Date().toISOString(),
      })
      .eq('id', profileFlagTarget.id)
      .eq('creative_id', user.id)
    setProfileFlagSaving(false)
    if (error) {
      console.error('[PublicProfilePage] flag review failed', error)
      return
    }
    setReviews((prev) =>
      prev.map((r) =>
        r.id === profileFlagTarget.id
          ? {
              ...r,
              flagged: true,
              flag_reason: profileFlagReason.trim(),
              flag_status: 'pending',
              flagged_at: new Date().toISOString(),
            }
          : r,
      ),
    )
    setProfileFlagSuccessId(profileFlagTarget.id)
    setProfileFlagTarget(null)
    setProfileFlagReason('')
  }

  async function sendEnquiry() {
    if (!user) { setShowEnquire(false); setShowAuthGate(true); return }
    setEnquiryError('')
    const combinedEnquiryText = `${enquiry.subject}\n${enquiry.message}`
    const mod = await moderateText(combinedEnquiryText)
    if (mod?.blocked) {
      setEnquiryError(MODERATION_BLOCKED_USER_MESSAGE)
      return
    }
    if (mod?.flagged) console.warn('[moderation] Flagged enquiry', mod.reason)
    if (
      threadOwnerTierContactSharingRestricted(profile?.subscription_tier) &&
      messageBodyContainsContactDetails(combinedEnquiryText)
    ) {
      setEnquiryError(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE)
      return
    }
    setSending(true)
    const clientLabel = formatClientAccountDisplayName(clientAccount) || user.email
    const { data: thread } = await supabase.from('message_threads').insert({
      creative_id: id,
      client_user_id: user.id,
      client_name: clientLabel,
      client_email: user.email,
      subject: enquiry.subject,
    }).select().single()

    if (thread) {
      await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_type: 'client',
        sender_name: clientLabel,
        body: enquiry.message,
      })
      // Email notification to creative
      await supabase.functions.invoke('send-message-notification', {
        body: {
          to: profile.business_email,
          toName: profile.business_name,
          fromName: clientLabel,
          subject: `New enquiry from ${clientLabel}`,
          messageBody: enquiry.message,
          threadSubject: enquiry.subject,
          profileUrl: 'https://lens-trybe.vercel.app/dashboard/clients/messages',
        }
      })
    }
    await supabase.functions.invoke('send-enquiry', {
      body: { creativeId: id, clientId: user.id, subject: enquiry.subject, message: enquiry.message }
    })
    setSending(false)
    setSent(true)
    setTimeout(() => { setShowEnquire(false); setSent(false) }, 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', ...TYPO.body }}>
      Loading profile…
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', ...TYPO.heading }}>Profile not found</div>
      <Button variant="secondary" onClick={() => navigate('/creatives')}>Back to Search</Button>
    </div>
  )

  const displayName = profile.business_name ?? 'Creative'
  const tier = profile.subscription_tier?.toLowerCase()

  function profileVisitWebsiteHref() {
    const vanity = (profile.portfolio_website_vanity_url ?? '').trim()
    if (vanity) {
      if (/^https?:\/\//i.test(vanity)) return vanity
      return `https://${vanity}`
    }
    const slug = (profile.custom_domain ?? '').trim().toLowerCase()
    if (profile.portfolio_website_active && slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 63) {
      return `https://${slug}.lenstrybe.com`
    }
    return null
  }
  const visitWebsiteHref = profileVisitWebsiteHref()
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1) : null

  const tierBadge = {
    pro: { label: 'Pro', color: '#60A5FA', bg: 'rgba(59,130,246,0.14)', border: 'rgba(96,165,250,0.4)' },
    expert: { label: 'Expert', color: '#A855F7', bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.4)' },
    elite: { label: 'Elite', color: '#1DB954', bg: 'rgba(29,185,84,0.14)', border: 'rgba(29,185,84,0.45)' },
  }
  const badge = tierBadge[tier]

  const styles = {
    page: { background: 'transparent', minHeight: '100vh', paddingBottom: '80px' },
    hero: { ...GLASS_CARD, padding: isMobile ? '32px 16px' : '48px 40px', maxWidth: '1280px', margin: '0 auto' },
    heroInner: { display: 'flex', alignItems: isMobile ? 'center' : 'flex-start', gap: '32px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' },
    avatar: { width: '120px', height: '120px', borderRadius: 'var(--radius-full)', objectFit: 'cover', border: '2px solid var(--border-default)', flexShrink: 0, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' },
    heroContent: { flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto', textAlign: isMobile ? 'center' : 'left' },
    nameRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px', justifyContent: isMobile ? 'center' : 'flex-start' },
    name: { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--text-primary)', ...TYPO.heading },
    location: { fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px', ...TYPO.body },
    skillRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px', overflowX: 'visible', justifyContent: isMobile ? 'center' : 'flex-start', paddingBottom: '0' },
    bio: { fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '640px', marginBottom: '20px', ...TYPO.body },
    heroActions: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' },
    ratingRow: { display: 'flex', alignItems: 'center', gap: '8px' },
    ratingNum: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', ...TYPO.stat },
    ratingCount: { fontSize: '13px', color: 'var(--text-muted)', ...TYPO.body },
    body: { maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px' },
    section: { marginBottom: '48px' },
    sectionTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '24px', ...TYPO.heading },
    portfolioGrid: { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' },
    portfolioItem: {
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      aspectRatio: '1',
      cursor: 'pointer',
      transition: 'transform var(--transition-base)',
      border: GLASS_CARD.border,
      borderTop: GLASS_CARD.borderTop,
      boxShadow: GLASS_CARD.boxShadow,
    },
    portfolioImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    reviewGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' },
    reviewCard: {
      ...GLASS_CARD,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    reviewerName: {
      fontSize: '13px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-ui)',
      ...TYPO.heading,
    },
    reviewBody: {
      fontSize: '13px',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-ui)',
      fontStyle: 'italic',
      ...TYPO.body,
    },
    specialtySection: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    socialLink: { fontSize: '14px', color: 'var(--green)', fontFamily: 'var(--font-ui)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' },
    lightboxOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '40px' },
    lightboxImg: { maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-lg)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    profileFlagModalHint: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, marginBottom: '12px', ...TYPO.body },
    profileFlagTextarea: { ...GLASS_NATIVE_FIELD, width: '100%', minHeight: '100px', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
  }

  return (
    <div style={styles.page} className="public-profile-page">
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={displayName} style={styles.avatar} />
            : <div style={styles.avatar}></div>
          }
          <div style={styles.heroContent}>
            <div style={styles.nameRow}>
              <h1 style={styles.name}>{displayName}</h1>
              {badge && (
                <div style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontFamily: 'var(--font-ui)' }}>
                  {badge.label}
                </div>
              )}
              {profile.founding_member === true && profile.show_founding_badge !== false && (
                <div style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(90deg, rgba(29,185,84,0.15), rgba(234,179,8,0.15))', border: '1px solid rgba(234,179,8,0.3)', color: '#EAB308', fontFamily: 'var(--font-ui)' }}>
                  ✦ Founding Member
                </div>
              )}
            </div>

            {(profile.city || profile.state) && (
              <div style={styles.location}>{[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}</div>
            )}

            <div style={styles.skillRow}>
              {(profile.skill_types ?? []).map((s, i) => <Badge key={i} variant="green" size="sm">{s}</Badge>)}
              {profile.abn && <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>✓ ABN</span>}
              {profile.has_insurance && <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>✓ Insured</span>}
              {profile.has_blue_card && <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>✓ Blue Card</span>}
              {profile.has_police_check && <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>✓ Police Checked</span>}
              {profile.has_wwvp && <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>✓ WWVP</span>}
              {profile.has_drone_licence && <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>✓ CASA Licence</span>}
              {profile.has_other && (
                <span style={{ padding: '3px 10px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>
                  ✓ {profile.other_credential_name ?? 'Other Credential'}
                </span>
              )}
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
              {visitWebsiteHref && (
                <Button
                  variant="secondary"
                  size="lg"
                  type="button"
                  onClick={() => window.open(visitWebsiteHref, '_blank', 'noopener,noreferrer')}
                >
                  Visit Website
                </Button>
              )}
              {!previewMode && (
                <Button variant="primary" size="lg" onClick={() => { if (user) { setEnquiryError(''); setShowEnquire(true) } else setShowAuthGate(true) }}>
                  Enquire Now
                </Button>
              )}
              {user?.id !== id && (
                <Button
                  variant="secondary"
                  size="lg"
                  type="button"
                  onClick={() => (user ? setShowReview(true) : setShowAuthGate(true))}
                  style={{ minHeight: '44px', width: isMobile ? '100%' : 'auto' }}
                >
                  Leave a Review
                </Button>
              )}
            </div>
            {(profile.instagram_url || profile.tiktok_url || profile.linkedin_url || profile.facebook_url || profile.website || profile.twitter_url) && (
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
                {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" style={styles.socialLink}>Website</a>}
                {profile.instagram_url && <a href={`https://instagram.com/${profile.instagram_url.replace('@', '')}`} target="_blank" rel="noreferrer" style={styles.socialLink}>Instagram</a>}
                {profile.tiktok_url && <a href={`https://tiktok.com/${profile.tiktok_url.replace('@', '')}`} target="_blank" rel="noreferrer" style={styles.socialLink}>TikTok</a>}
                {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noreferrer" style={styles.socialLink}>LinkedIn</a>}
                {profile.facebook_url && <a href={profile.facebook_url} target="_blank" rel="noreferrer" style={styles.socialLink}>Facebook</a>}
                {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noreferrer" style={styles.socialLink}>𝕏 Twitter</a>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={DIVIDER_GRADIENT_STYLE} aria-hidden />

      <div style={styles.body}>
        {(profile.specialties ?? []).length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Specialties</div>
            <div style={styles.specialtySection}>
              {profile.specialties.map((s, i) => <Badge key={i} variant="default">{s}</Badge>)}
            </div>
          </div>
        )}

        {blockedDates.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Availability</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {blockedDates.slice(0, 12).map((block, i) => (
                <div key={i} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '999px', fontSize: '13px', color: '#ef4444', fontFamily: 'var(--font-ui)' }}>
                  ✕ {new Date(block.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {!block.all_day && block.start_time && ` ${block.start_time}–${block.end_time}`}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-ui)' }}>
              Dates shown in red are unavailable. Contact the creative for other dates.
            </div>
          </div>
        )}

        <div style={styles.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ ...styles.sectionTitle, marginBottom: 0 }}>Reviews</div>
            {reviews.length > 5 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllReviews(!showAllReviews)}>
                {showAllReviews ? 'Show less' : `Show all ${reviews.length} reviews`}
              </Button>
            )}
          </div>
          {reviews.length === 0 ? (
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '20px 0' }}>No reviews yet.</div>
          ) : (
            <div style={styles.reviewGrid}>
              {(showAllReviews ? reviews : reviews.slice(0, 5)).map((review) => (
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
                          {profileFlagSuccessId === review.id ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '6px', fontFamily: 'var(--font-ui)' }}>
                              Review flagged. We will be in touch within 48 hours.
                            </div>
                          ) : null}
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '999px',
                              background: 'rgba(136,136,170,0.2)',
                              color: '#888',
                              border: '1px solid var(--border-default)',
                              fontFamily: 'var(--font-ui)',
                            }}
                          >
                            Under Review
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileFlagTarget(review)
                            setProfileFlagReason('')
                          }}
                          style={{
                            flexShrink: 0,
                            fontSize: '12px',
                            color: '#888',
                            cursor: 'pointer',
                            background: 'none',
                            border: 'none',
                            textDecoration: 'underline',
                            fontFamily: 'var(--font-ui)',
                            padding: 0,
                            alignSelf: 'flex-start',
                          }}
                        >
                          Flag review
                        </button>
                      )
                    ) : null}
                  </div>
                  {(review.body ?? review.comment) && <div style={styles.reviewBody}>"{review.body ?? review.comment}"</div>}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {review.project_type && <Badge variant="default" size="sm">{review.project_type}</Badge>}
                    {review.source === 'imported' && <Badge variant="default" size="sm">Imported review</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {portfolioItems.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Portfolio</div>
            <div style={styles.portfolioGrid}>
              {portfolioItems.map((item, i) => (
                <div key={item.id} style={styles.portfolioItem} onClick={() => setLightbox(item.file_url)}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {item.file_type === 'video'
                    ? <video src={item.file_url} style={styles.portfolioImg} muted />
                    : <img src={item.file_url} alt={item.alt_text || ''} style={styles.portfolioImg} />
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showReview && (
        <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' }}>
          <div style={{
            ...GLASS_MODAL_PANEL,
            borderRadius: isMobile ? '0' : GLASS_MODAL_PANEL.borderRadius,
            width: '100%',
            maxWidth: isMobile ? '100vw' : '480px',
            minHeight: isMobile ? '100vh' : 'auto',
            padding: isMobile ? '16px' : '28px',
          }}>
            {reviewSent ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#1DB954', fontSize: '16px', ...TYPO.heading }}>✓ Review submitted! Thank you.</div>
            ) : (
              <>
                <div style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '20px', ...TYPO.heading }}>Leave a Review for {displayName}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Your Name *</label>
                    <input
                      value={reviewForm.reviewer_name}
                      onChange={e => { setReviewModerationError(''); setReviewForm(p => ({ ...p, reviewer_name: e.target.value })) }}
                      placeholder="Jane Smith"
                      style={{ width: '100%', padding: '10px 14px', ...GLASS_NATIVE_FIELD }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>EMAIL ADDRESS *</label>
                    <input
                      type="email"
                      value={reviewEmail}
                      onChange={(e) => { setReviewModerationError(''); setReviewEmail(e.target.value) }}
                      placeholder="your@email.com"
                      style={{ width: '100%', padding: '10px 14px', ...GLASS_NATIVE_FIELD }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', display: 'block', marginBottom: '8px', ...TYPO.label }}>Rating *</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onMouseLeave={() => setReviewRatingHover(null)}>
                      {[1, 2, 3, 4, 5].map((s) => {
                        const active = reviewRatingHover ?? reviewForm.rating
                        const filled = s <= active
                        return (
                          <button
                            key={s}
                            type="button"
                            aria-label={`${s} out of 5 stars`}
                            onClick={() => setReviewForm((p) => ({ ...p, rating: s }))}
                            onMouseEnter={() => setReviewRatingHover(s)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              lineHeight: 0,
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                              <path
                                d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                                fill={filled ? '#FFD700' : 'none'}
                                stroke={filled ? '#D4AF37' : 'var(--border-strong)'}
                                strokeWidth={filled ? 1 : 1.25}
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Review *</label>
                    <textarea
                      value={reviewForm.body}
                      onChange={e => { setReviewModerationError(''); setReviewForm(p => ({ ...p, body: e.target.value })) }}
                      placeholder="Share your experience working with this creative..."
                      style={{ width: '100%', padding: '10px 14px', minHeight: '100px', resize: 'vertical', ...GLASS_NATIVE_FIELD }}
                    />
                  </div>
                </div>
                {reviewModerationError ? (
                  <div style={{ fontSize: '13px', color: '#f87171', marginTop: '12px', ...TYPO.body }}>{reviewModerationError}</div>
                ) : null}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <Button type="button" variant="ghost" onClick={() => { setShowReview(false); setReviewModerationError(''); setReviewRatingHover(null); setReviewEmail('') }}>Cancel</Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={submittingReview || !reviewForm.reviewer_name || !reviewEmail.trim() || !reviewForm.body}
                    onClick={() => void submitReview()}
                  >
                    {submittingReview ? 'Submitting…' : 'Submit Review'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!profileFlagTarget}
        onClose={() => {
          if (!profileFlagSaving) {
            setProfileFlagTarget(null)
            setProfileFlagReason('')
          }
        }}
        title="Flag this review"
        size="md"
      >
        <div style={styles.formSection}>
          <div style={styles.profileFlagModalHint}>
            Tell us why this review should be removed. We will investigate and respond within 48 hours.
          </div>
          <div>
            <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px', ...TYPO.label }}>REASON *</label>
            <textarea
              style={styles.profileFlagTextarea}
              placeholder="e.g. This person was never a client of mine"
              value={profileFlagReason}
              onChange={(e) => setProfileFlagReason(e.target.value)}
            />
          </div>
          <div style={styles.modalActions}>
            <Button type="button" variant="ghost" disabled={profileFlagSaving} onClick={() => { setProfileFlagTarget(null); setProfileFlagReason('') }}>
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={profileFlagSaving || !profileFlagReason.trim()} onClick={() => void submitPublicProfileFlag()}>
              {profileFlagSaving ? 'Submitting…' : 'Submit Flag'}
            </Button>
          </div>
        </div>
      </Modal>

      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} />
        </div>
      )}

      <Modal isOpen={showEnquire} onClose={() => { setShowEnquire(false); setEnquiryError('') }} title={`Enquire with ${displayName}`} size="md">
        <div style={styles.formSection}>
          {sent ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--green)', fontSize: '15px', ...TYPO.body }}>
              ✓ Enquiry sent! {displayName} will be in touch soon.
            </div>
          ) : (
            <>
              <Input label="Subject" placeholder="e.g. Wedding Photography — June 2026" value={enquiry.subject} onChange={e => { setEnquiryError(''); setEnquiry(p => ({ ...p, subject: e.target.value })) }} />
              <div>
                <label style={{ fontSize: '13px', display: 'block', marginBottom: '6px', ...TYPO.label }}>Message</label>
                <textarea
                  style={{ width: '100%', minHeight: '120px', padding: '10px 14px', resize: 'vertical', boxSizing: 'border-box', ...GLASS_NATIVE_FIELD }}
                  placeholder="Tell them about your project, date, location and what you need…"
                  value={enquiry.message}
                  onChange={e => { setEnquiryError(''); setEnquiry(p => ({ ...p, message: e.target.value })) }}
                />
              </div>
              {enquiryError ? (
                <div style={{ fontSize: '13px', color: '#f87171', marginTop: '8px', ...TYPO.body }}>{enquiryError}</div>
              ) : null}
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowEnquire(false)}>Cancel</Button>
                <Button variant="primary" disabled={sending || !enquiry.subject || !enquiry.message} onClick={sendEnquiry}>
                  {sending ? 'Sending…' : 'Send Enquiry'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={showAuthGate} onClose={() => setShowAuthGate(false)} title="Sign in to enquire" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', ...TYPO.body }}>
            You need a free client account to send an enquiry to {displayName}.
          </div>
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowAuthGate(false); navigate('/login') }}>Sign In</Button>
            <Button variant="primary" onClick={() => { setShowAuthGate(false); navigate('/join/client') }}>Create Free Account</Button>
          </div>
        </div>
      </Modal>
      <style>{`
        @media (max-width: 767px) {
          .public-profile-page {
            overflow-x: hidden;
          }
          .public-profile-page section {
            margin-bottom: 32px !important;
          }
          .public-profile-mobile-actions > * {
            width: 100%;
            min-height: 44px;
          }
          .public-profile-page [style*="display: flex"][style*="justify-content: space-between"][style*="margin-bottom: 24px"] {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .public-profile-page p,
          .public-profile-page span,
          .public-profile-page a,
          .public-profile-page button,
          .public-profile-page input,
          .public-profile-page textarea,
          .public-profile-page label,
          .public-profile-page div {
            font-size: max(14px, 0.875rem);
          }
        }
      `}</style>
    </div>
  )
}
