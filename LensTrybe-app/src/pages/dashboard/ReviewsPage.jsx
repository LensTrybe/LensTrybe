import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'

function StarRating({ value, onChange, readonly }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(null)}
          style={{
            fontSize: '24px',
            cursor: readonly ? 'default' : 'pointer',
            color: star <= (hovered ?? value) ? '#EAB308' : 'var(--border-strong)',
            transition: 'color var(--transition-fast)',
          }}
        >★</span>
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    reviewer_name: '',
    project_type: '',
    rating: 5,
    body: '',
    approximate_date: '',
  })

  useEffect(() => { loadReviews() }, [user])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadReviews() {
    if (!user) return
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setReviews(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ reviewer_name: '', project_type: '', rating: 5, body: '', approximate_date: '' })
  }

  async function addReview() {
    setSaving(true)
    await supabase.from('reviews').insert({
      creative_id: user.id,
      reviewer_name: form.reviewer_name,
      project_type: form.project_type,
      rating: form.rating,
      body: form.body,
      approximate_date: form.approximate_date || null,
      source: 'imported',
    })
    await loadReviews()
    setShowAdd(false)
    resetForm()
    setSaving(false)
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    : null

  const importedCount = reviews.filter(r => r.source === 'imported').length
  const canAddMore = importedCount < 5

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { ...TYPO.body, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    summaryCard: {
      ...GLASS_CARD,
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '32px',
      flexDirection: isMobile ? 'column' : 'row',
    },
    avgRating: { ...TYPO.stat, fontFamily: 'var(--font-display)', fontSize: '56px', color: 'var(--text-primary)', lineHeight: 1 },
    ratingLabel: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    divider: { width: '1px', height: '60px', background: 'var(--border-default)' },
    statsRow: { display: 'flex', gap: '32px', flexWrap: 'wrap' },
    statItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
    statValue: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)' },
    statLabel: { ...TYPO.label, fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    reviewGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' },
    reviewCard: {
      ...GLASS_CARD,
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    reviewHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
    reviewerName: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    reviewBody: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, fontStyle: 'italic' },
    reviewMeta: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    reviewDate: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    emptyState: {
      ...GLASS_CARD,
      padding: '64px 24px',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: '14px',
      fontFamily: 'var(--font-ui)',
      borderRadius: 'var(--radius-xl)',
    },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' },
    label: { ...TYPO.label, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' },
    textarea: { ...GLASS_NATIVE_FIELD, width: '100%', minHeight: '100px', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    infoNote: { ...GLASS_CARD, padding: '12px 16px', borderRadius: 'var(--radius-lg)', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 },
  }

  return (
    <div style={styles.page} className="reviews-page">
      <style>{`
        @media (max-width: 767px) {
          .reviews-page button { min-height: 44px; }
          .reviews-page input, .reviews-page textarea, .reviews-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Reviews</h1>
          <p style={styles.subtitle}>Client reviews displayed on your public profile.</p>
        </div>
        {canAddMore && (
          <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Past Review</Button>
        )}
      </div>

      {avgRating && (
        <div style={styles.summaryCard}>
          <div>
            <div style={styles.avgRating}>{avgRating}</div>
            <StarRating value={Math.round(avgRating)} readonly />
            <div style={styles.ratingLabel}>Average rating</div>
          </div>
          <div style={styles.divider} />
          <div style={styles.statsRow}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{reviews.length}</div>
              <div style={styles.statLabel}>Total reviews</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{reviews.filter(r => r.rating === 5).length}</div>
              <div style={styles.statLabel}>5-star reviews</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{importedCount}/5</div>
              <div style={styles.statLabel}>Imported reviews used</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.emptyState}>Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div style={styles.emptyState}>
          No reviews yet. Add past client reviews to build social proof from day one.
        </div>
      ) : (
        <div style={styles.reviewGrid}>
          {reviews.map(review => (
            <div key={review.id} style={styles.reviewCard}>
              <div style={styles.reviewHeader}>
                <div>
                  <div style={styles.reviewerName}>{review.reviewer_name}</div>
                  <StarRating value={review.rating} readonly />
                </div>
                {review.source === 'imported' && (
                  <Badge variant="default" size="sm">Imported</Badge>
                )}
              </div>
              {review.body && <div style={styles.reviewBody}>"{review.body}"</div>}
              <div style={styles.reviewMeta}>
                {review.project_type && <Badge variant="default" size="sm">{review.project_type}</Badge>}
                {review.approximate_date && (
                  <div style={styles.reviewDate}>
                    {new Date(review.approximate_date).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); resetForm() }} title="Add Past Client Review" size="md">
        <div style={styles.formSection}>
          <div style={styles.infoNote}>
            Imported reviews are labelled on your profile. You can add up to 5 reviews from clients you worked with before joining LensTrybe. They cannot be edited after 48 hours.
          </div>
          <div style={styles.formRow}>
            <Input
              label="Client name"
              placeholder="Sarah M."
              value={form.reviewer_name}
              onChange={e => setForm(p => ({ ...p, reviewer_name: e.target.value }))}
            />
            <Input
              label="Project type"
              placeholder="Wedding Photography"
              value={form.project_type}
              onChange={e => setForm(p => ({ ...p, project_type: e.target.value }))}
            />
          </div>
          <div>
            <label style={styles.label}>Rating</label>
            <StarRating value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
          </div>
          <div>
            <label style={styles.label}>Review</label>
            <textarea
              style={styles.textarea}
              placeholder="What did your client say about working with you?"
              value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
            />
          </div>
          <Input
            label="Approximate date (optional)"
            type="month"
            value={form.approximate_date}
            onChange={e => setForm(p => ({ ...p, approximate_date: e.target.value }))}
          />
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowAdd(false); resetForm() }}>Cancel</Button>
            <Button
              variant="primary"
              disabled={saving || !form.reviewer_name || !form.body}
              onClick={addReview}
            >
              {saving ? 'Adding…' : 'Add Review'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
