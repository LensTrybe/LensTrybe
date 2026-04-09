import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '#1e1e1e',
  inner: '#1a1a24',
  innerBorder: '#202027',
  muted: '#888',
  dim: '#555',
  green: '#39ff14',
  red: '#f87171',
  yellow: '#facc15',
}

const font = { fontFamily: 'Inter, sans-serif' }

const SPECIALTIES_BY_TYPE = {
  Photographer: [
    'Architecture',
    'Automotive',
    'Boudoir',
    'Commercial',
    'Corporate/Headshots',
    'Events',
    'Fashion',
    'Food',
    'Maternity',
    'Pets',
    'Portrait',
    'Product',
    'Real Estate',
    'Schools & Education',
    'Sports',
    'Street',
    'Wedding',
  ],
  Videographer: ['Weddings', 'Events', 'Commercial', 'Music Video', 'Documentary', 'Social Shorts', 'Interviews', 'Brand Film'],
  'Drone Pilot': ['Real Estate', 'Weddings', 'Events', 'Commercial', 'Cinematics', 'Construction', 'Tourism'],
  'Video Editor': ['Short-form', 'Long-form', 'Color grading', 'Sound design', 'Motion graphics', 'Reels/TikTok'],
  'Photo Editor': ['Retouching', 'Color correction', 'Skin retouch', 'Product cleanup', 'Batch editing'],
  'Social Media Manager': ['Content planning', 'Posting & scheduling', 'Community', 'Analytics', 'Paid ads'],
  'Hair and Makeup Artist': ['Bridal', 'Editorial', 'Event glam', 'Natural glam', 'SFX'],
  'UGC Creator': ['Lifestyle', 'Beauty', 'Fitness', 'Food', 'Tech', 'Travel'],
}

const PROJECT_TYPE_OPTIONS = ['Other', ...Array.from(new Set(Object.values(SPECIALTIES_BY_TYPE).flat())).sort((a, b) => a.localeCompare(b))]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const YEARS = Array.from({ length: 10 }, (_, i) => String(2017 + i))

const META_SUFFIX_RE = /\n\n\(([^·]+?)\s·\s([^)]+)\)\s*$/

function buildComment(reviewText, projectType, month, year) {
  const t = String(reviewText || '').trim()
  const p = String(projectType || 'Other').trim() || 'Other'
  const meta = `(${p} · ${month} ${year})`
  return t ? `${t}\n\n${meta}` : meta
}

function parseBodyAndMeta(comment) {
  const raw = String(comment || '')
  const m = raw.match(META_SUFFIX_RE)
  if (!m) return { body: raw.trim(), project: '', approx: '' }
  return { body: raw.slice(0, m.index).trim(), project: m[1].trim(), approx: m[2].trim() }
}

function parseClientNameForForm(clientName) {
  const t = String(clientName || '').trim()
  if (!t) return { first_name: '', last_initial: '' }
  const parts = t.split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0], last_initial: '' }
  const last = parts[parts.length - 1]
  if (last.length <= 2 && last.endsWith('.')) {
    return { first_name: parts.slice(0, -1).join(' '), last_initial: last.replace(/\./g, '') }
  }
  return { first_name: t, last_initial: '' }
}

function parseApproxFromComment(comment, createdAt) {
  const { approx } = parseBodyAndMeta(comment)
  if (approx) {
    const y = approx.match(/(\d{4})\s*$/)
    const year = y ? y[1] : String(new Date(createdAt).getFullYear())
    const monthPart = approx.replace(/\s*\d{4}\s*$/, '').trim()
    const month = MONTHS.includes(monthPart) ? monthPart : MONTHS[new Date(createdAt).getMonth()] || 'January'
    return { month, year }
  }
  return {
    month: MONTHS[new Date(createdAt).getMonth()] || 'January',
    year: String(new Date(createdAt).getFullYear()),
  }
}

function StarDisplay({ rating, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ fontSize: size, lineHeight: 1 }}>
          {s <= rating ? <span style={{ color: PAGE.yellow }}>⭐</span> : <span style={{ color: '#555' }}>☆</span>}
        </span>
      ))}
    </span>
  )
}

const initialForm = () => ({
  first_name: '',
  last_initial: '',
  project_type: 'Other',
  rating: 5,
  review_text: '',
  review_month: MONTHS[new Date().getMonth()] || 'January',
  review_year: String(new Date().getFullYear()),
})

export default function ReviewsPage() {
  const [user, setUser] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchReviews = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setReviews(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return
    /* eslint-disable react-hooks/set-state-in-effect -- mount load reviews */
    fetchReviews()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user, fetchReviews])

  const openNew = () => {
    setEditing(null)
    setForm(initialForm())
    setShowForm(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    const { first_name, last_initial } = parseClientNameForForm(r.client_name)
    const { body, project } = parseBodyAndMeta(r.comment || '')
    const { month, year } = parseApproxFromComment(r.comment || '', r.created_at)
    setForm({
      first_name,
      last_initial,
      project_type: project && PROJECT_TYPE_OPTIONS.includes(project) ? project : 'Other',
      rating: r.rating || 5,
      review_text: body,
      review_month: month,
      review_year: year,
    })
    setShowForm(true)
  }

  const saveReview = async () => {
    if (!form.first_name.trim()) return
    if (!editing && reviews.length >= 5) return
    const initial = form.last_initial.trim().toUpperCase().slice(0, 1)
    const client_name = initial ? `${form.first_name.trim()} ${initial}.` : form.first_name.trim()
    const comment = buildComment(form.review_text, form.project_type, form.review_month, form.review_year)
    const payload = { client_name, rating: form.rating, comment, creative_id: user.id }
    if (editing) {
      const { data } = await supabase.from('reviews').update(payload).eq('id', editing.id).select().single()
      setReviews((prev) => prev.map((x) => (x.id === editing.id ? data : x)))
    } else {
      const { data } = await supabase.from('reviews').insert(payload).select().single()
      setReviews((prev) => [data, ...prev])
    }
    setShowForm(false)
    setEditing(null)
  }

  const deleteReview = async (id) => {
    await supabase.from('reviews').delete().eq('id', id)
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  const labelStyle = {
    display: 'block',
    color: PAGE.muted,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
    ...font,
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: PAGE.inner,
    border: `1px solid ${PAGE.innerBorder}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    ...font,
  }

  const portfolioUrl = user?.id ? `${window.location.origin}/portfolio/${user.id}` : '#'
  const atMax = reviews.length >= 5

  return (
    <section
      style={{
        background: PAGE.bg,
        minHeight: '100vh',
        padding: 32,
        color: PAGE.text,
        ...font,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-block',
            marginBottom: 12,
            fontSize: 13,
            color: PAGE.green,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ← Back
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>Reviews</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: PAGE.green, textDecoration: 'none' }}
            >
              👁 View Profile
            </a>
            <button
              type="button"
              onClick={openNew}
              disabled={atMax && !editing}
              style={{
                background: PAGE.green,
                color: '#000',
                fontWeight: 700,
                borderRadius: 8,
                padding: '8px 18px',
                border: 'none',
                fontSize: 13,
                cursor: atMax && !editing ? 'not-allowed' : 'pointer',
                opacity: atMax && !editing ? 0.5 : 1,
              }}
            >
              + Add Past Client Review
            </button>
          </div>
        </div>

        {showForm && (
          <div
            style={{
              background: PAGE.card,
              border: `1px solid ${PAGE.border}`,
              borderRadius: 12,
              padding: 24,
              marginBottom: 20,
              boxSizing: 'border-box',
            }}
          >
            <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {editing ? 'Edit Past Client Review' : 'Add Past Client Review'}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: 16,
              }}
            >
              <div>
                <label style={labelStyle}>Client First Name</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  placeholder="Jane"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name Initial</label>
                <input
                  value={form.last_initial}
                  onChange={(e) => setForm((p) => ({ ...p, last_initial: e.target.value.slice(0, 1) }))}
                  placeholder="S"
                  maxLength={1}
                  style={{ ...inputStyle, width: '100%', maxWidth: 80, textTransform: 'uppercase' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Project Type</label>
                <select
                  value={form.project_type}
                  onChange={(e) => setForm((p) => ({ ...p, project_type: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {PROJECT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Star Rating</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, rating: s }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        fontSize: 22,
                        lineHeight: 1,
                      }}
                      aria-label={`${s} stars`}
                    >
                      {s <= form.rating ? (
                        <span style={{ color: PAGE.yellow }}>⭐</span>
                      ) : (
                        <span style={{ color: '#555' }}>☆</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Review Text</label>
                <textarea
                  value={form.review_text}
                  onChange={(e) => setForm((p) => ({ ...p, review_text: e.target.value }))}
                  placeholder="What did the client say?"
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Approximate Month</label>
                <select
                  value={form.review_month}
                  onChange={(e) => setForm((p) => ({ ...p, review_month: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Approximate Year</label>
                <select
                  value={form.review_year}
                  onChange={(e) => setForm((p) => ({ ...p, review_year: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
                style={{
                  background: 'none',
                  border: `1px solid ${PAGE.innerBorder}`,
                  color: PAGE.muted,
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReview}
                style={{
                  background: PAGE.green,
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '9px 20px',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Save Review
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 12,
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                borderLeft: `3px solid ${PAGE.green}`,
                paddingLeft: 10,
              }}
            >
              Past Client Reviews
            </h2>
            {!showForm && (
              <button
                type="button"
                onClick={openNew}
                disabled={atMax}
                style={{
                  background: 'none',
                  border: 'none',
                  color: PAGE.green,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: atMax ? 'not-allowed' : 'pointer',
                  opacity: atMax ? 0.45 : 1,
                  padding: 0,
                }}
              >
                + Add Past Client Review
              </button>
            )}
          </div>

          {loading ? (
            <p style={{ color: PAGE.dim, margin: 0 }}>Loading…</p>
          ) : reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden>
                💬
              </div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No imported reviews yet.</div>
              <div style={{ color: PAGE.dim, fontSize: 13, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                Add up to 5 past client reviews to build your social proof.
              </div>
            </div>
          ) : (
            <div>
              {reviews.map((r) => {
                const { body, project, approx } = parseBodyAndMeta(r.comment || '')
                const displayProject = project || '—'
                const displayApprox = approx || new Date(r.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                return (
                  <div
                    key={r.id}
                    style={{
                      background: PAGE.inner,
                      border: `1px solid ${PAGE.innerBorder}`,
                      borderRadius: 10,
                      padding: 16,
                      marginBottom: 10,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, marginBottom: 4 }}>{r.client_name}</div>
                        <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>{displayProject}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          style={{
                            background: PAGE.inner,
                            border: `1px solid ${PAGE.innerBorder}`,
                            color: '#aaa',
                            borderRadius: 6,
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteReview(r.id)}
                          title="Delete"
                          aria-label="Delete review"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: PAGE.red,
                            fontSize: 18,
                            cursor: 'pointer',
                            padding: 4,
                            lineHeight: 1,
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <StarDisplay rating={r.rating || 0} size={16} />
                    </div>
                    {body ? (
                      <div style={{ color: '#ccc', fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>{body}</div>
                    ) : null}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: PAGE.dim, fontSize: 12 }}>{displayApprox}</span>
                      <span
                        style={{
                          background: '#555',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 4,
                          padding: '2px 6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Imported Review
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
