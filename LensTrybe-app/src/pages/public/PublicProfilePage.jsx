import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'

function StarRating({ value }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ color: s <= value ? '#EAB308' : 'var(--border-strong)', fontSize: '16px' }}>★</span>
      ))}
    </div>
  )
}

export default function PublicProfilePage({ previewMode = false, previewId = null }) {
  const params = useParams()
  const id = previewId ?? params.id
  const navigate = useNavigate()
  const { user, isCreative } = useAuth()
  const [profile, setProfile] = useState(null)
  const [portfolioItems, setPortfolioItems] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEnquire, setShowEnquire] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [enquiry, setEnquiry] = useState({ subject: '', message: '' })
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { loadProfile() }, [id])

  async function loadProfile() {
    const [profileRes, portfolioRes, reviewsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('portfolio_items').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
      supabase.from('reviews').select('*').eq('creative_id', id).order('created_at', { ascending: false }),
    ])
    setProfile(profileRes.data)
    setPortfolioItems(portfolioRes.data ?? [])
    setReviews(reviewsRes.data ?? [])
    setLoading(false)
  }

  async function sendEnquiry() {
    if (!user) { setShowEnquire(false); setShowAuthGate(true); return }
    setSending(true)
    const { data: thread } = await supabase.from('message_threads').insert({
      creative_id: id,
      client_user_id: user.id,
      client_name: user.email,
      client_email: user.email,
      subject: enquiry.subject,
    }).select().single()

    if (thread) {
      await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_type: 'client',
        sender_name: user.email,
        body: enquiry.message,
      })
      // Email notification to creative
      await supabase.functions.invoke('send-message-notification', {
        body: {
          to: profile.business_email,
          toName: profile.business_name,
          fromName: user.email,
          subject: `New enquiry from ${user.email}`,
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
      Loading profile…
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)' }}>Profile not found</div>
      <Button variant="secondary" onClick={() => navigate('/creatives')}>Back to Search</Button>
    </div>
  )

  const displayName = profile.business_name ?? 'Creative'
  const tier = profile.subscription_tier?.toLowerCase()
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1) : null

  const tierBadge = {
    elite: { label: 'Elite', color: '#EAB308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)' },
    expert: { label: 'Expert', color: 'var(--green)', bg: 'var(--green-dim)', border: 'rgba(29,185,84,0.3)' },
    pro: { label: 'Pro', color: 'var(--green)', bg: 'var(--green-dim)', border: 'rgba(29,185,84,0.3)' },
  }
  const badge = tierBadge[tier]

  const styles = {
    page: { background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: '80px' },
    hero: { background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)', padding: '48px 40px', maxWidth: '1280px', margin: '0 auto' },
    heroInner: { display: 'flex', alignItems: 'flex-start', gap: '32px', flexWrap: 'wrap' },
    avatar: { width: '120px', height: '120px', borderRadius: 'var(--radius-full)', objectFit: 'cover', border: '2px solid var(--border-default)', flexShrink: 0, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' },
    heroContent: { flex: 1, minWidth: 0 },
    nameRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' },
    name: { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--text-primary)', fontWeight: 400 },
    location: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: '12px' },
    skillRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
    bio: { fontSize: '15px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, maxWidth: '640px', marginBottom: '20px' },
    heroActions: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' },
    ratingRow: { display: 'flex', alignItems: 'center', gap: '8px' },
    ratingNum: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)' },
    ratingCount: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    body: { maxWidth: '1280px', margin: '0 auto', padding: '40px' },
    section: { marginBottom: '48px' },
    sectionTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400, marginBottom: '24px' },
    portfolioGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
    portfolioItem: { borderRadius: 'var(--radius-lg)', overflow: 'hidden', aspectRatio: '1', cursor: 'pointer', transition: 'transform var(--transition-base)' },
    portfolioImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    reviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
    reviewCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
    reviewerName: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    reviewBody: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, fontStyle: 'italic' },
    specialtySection: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    socialRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    socialLink: { fontSize: '13px', color: 'var(--green)', fontFamily: 'var(--font-ui)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' },
    lightboxOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '40px' },
    lightboxImg: { maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-lg)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={displayName} style={styles.avatar} />
            : <div style={styles.avatar}>👤</div>
          }
          <div style={styles.heroContent}>
            <div style={styles.nameRow}>
              <h1 style={styles.name}>{displayName}</h1>
              {badge && (
                <div style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, fontFamily: 'var(--font-ui)' }}>
                  {badge.label}
                </div>
              )}
              {profile.founding_member && (
                <div style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(90deg, rgba(29,185,84,0.15), rgba(234,179,8,0.15))', border: '1px solid rgba(234,179,8,0.3)', color: '#EAB308', fontFamily: 'var(--font-ui)' }}>
                  ✦ Founding Member
                </div>
              )}
            </div>

            {(profile.city || profile.state) && (
              <div style={styles.location}>📍 {[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}</div>
            )}

            <div style={styles.skillRow}>
              {(profile.skill_types ?? []).map((s, i) => <Badge key={i} variant="green" size="sm">{s}</Badge>)}
            </div>

            {profile.bio && <p style={styles.bio}>{profile.bio}</p>}

            {avgRating && (
              <div style={{ ...styles.ratingRow, marginBottom: '16px' }}>
                <div style={styles.ratingNum}>{avgRating}</div>
                <StarRating value={Math.round(avgRating)} />
                <div style={styles.ratingCount}>({reviews.length} review{reviews.length !== 1 ? 's' : ''})</div>
              </div>
            )}

            <div style={styles.heroActions}>
              {!previewMode && (
                <Button variant="primary" size="lg" onClick={() => user ? setShowEnquire(true) : setShowAuthGate(true)}>
                  Enquire Now
                </Button>
              )}
              {profile.website && (
                <Button variant="secondary" size="md" onClick={() => window.open(profile.website, '_blank')}>
                  Visit Website
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.body}>
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

        {(profile.specialties ?? []).length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Specialties</div>
            <div style={styles.specialtySection}>
              {profile.specialties.map((s, i) => <Badge key={i} variant="default">{s}</Badge>)}
            </div>
          </div>
        )}

        {(profile.instagram_url || profile.tiktok_url || profile.linkedin_url || profile.facebook_url || profile.website) && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Links</div>
            <div style={styles.socialRow}>
              {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" style={styles.socialLink}>🌐 Website</a>}
              {profile.instagram_url && <a href={`https://instagram.com/${profile.instagram_url.replace('@','')}`} target="_blank" rel="noreferrer" style={styles.socialLink}>📷 Instagram</a>}
              {profile.tiktok_url && <a href={`https://tiktok.com/${profile.tiktok_url.replace('@','')}`} target="_blank" rel="noreferrer" style={styles.socialLink}>🎵 TikTok</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noreferrer" style={styles.socialLink}>💼 LinkedIn</a>}
              {profile.facebook_url && <a href={profile.facebook_url} target="_blank" rel="noreferrer" style={styles.socialLink}>👥 Facebook</a>}
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Reviews</div>
            <div style={styles.reviewGrid}>
              {reviews.map(review => (
                <div key={review.id} style={styles.reviewCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={styles.reviewerName}>{review.reviewer_name}</div>
                    <StarRating value={review.rating} />
                  </div>
                  {review.body && <div style={styles.reviewBody}>"{review.body}"</div>}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {review.project_type && <Badge variant="default" size="sm">{review.project_type}</Badge>}
                    {review.source === 'imported' && <Badge variant="default" size="sm">Imported review</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} />
        </div>
      )}

      <Modal isOpen={showEnquire} onClose={() => setShowEnquire(false)} title={`Enquire with ${displayName}`} size="md">
        <div style={styles.formSection}>
          {sent ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--green)', fontFamily: 'var(--font-ui)', fontSize: '15px' }}>
              ✓ Enquiry sent! {displayName} will be in touch soon.
            </div>
          ) : (
            <>
              <Input label="Subject" placeholder="e.g. Wedding Photography — June 2026" value={enquiry.subject} onChange={e => setEnquiry(p => ({ ...p, subject: e.target.value }))} />
              <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' }}>Message</label>
                <textarea
                  style={{ width: '100%', minHeight: '120px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
                  placeholder="Tell them about your project, date, location and what you need…"
                  value={enquiry.message}
                  onChange={e => setEnquiry(p => ({ ...p, message: e.target.value }))}
                />
              </div>
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
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
            You need a free client account to send an enquiry to {displayName}.
          </div>
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowAuthGate(false); navigate('/login') }}>Sign In</Button>
            <Button variant="primary" onClick={() => { setShowAuthGate(false); navigate('/join/client') }}>Create Free Account</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
