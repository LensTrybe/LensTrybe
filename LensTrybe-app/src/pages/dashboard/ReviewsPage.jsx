import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'
const STAR = '#f5a623'

const REVIEW_BASE = 'https://lenstrybe.com/creatives'

function reviewerOf(r) { return r.reviewer_name || r.client_name || 'Anonymous' }
function textOf(r) { return r.body || r.comment || '' }

function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

function Stars({ value = 0, size = 16, gap = 2 }) {
  const v = Math.round(value)
  return (
    <span style={{ display: 'inline-flex', gap }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
          fill={s <= v ? STAR : 'none'} stroke={s <= v ? STAR : 'var(--lt-faint)'} strokeWidth="1.6" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(null)
  const shown = hover ?? value
  return (
    <div style={{ display: 'flex', gap: 6 }} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} onMouseEnter={() => setHover(s)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }} aria-label={`${s} star${s > 1 ? 's' : ''}`}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill={s <= shown ? STAR : 'none'} stroke={s <= shown ? STAR : 'var(--lt-faint)'} strokeWidth="1.6" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--lt-faint)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12,
  background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', color: 'var(--lt-text)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
}

function Modal({ open, onClose, title, children, busy }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])
  if (!open) return null
  return (
    <div className="ltr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="ltr-modal" role="dialog" aria-modal="true">
        <div className="ltr-modal-head">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--lt-text)' }}>{title}</h2>
          <button type="button" className="ltr-x" onClick={() => !busy && onClose()} aria-label="Close">✕</button>
        </div>
        <div className="ltr-modal-body">{children}</div>
      </div>
    </div>
  )
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: '5', label: '5 star' },
  { key: '4plus', label: '4 star and up' },
  { key: 'low', label: '3 star and under' },
  { key: 'imported', label: 'Imported' },
  { key: 'flagged', label: 'Flagged' },
]

export default function ReviewsPage() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const [showRequest, setShowRequest] = useState(false)
  const [reqForm, setReqForm] = useState({ client_name: '', client_email: '', message: '' })
  const [reqSaving, setReqSaving] = useState(false)
  const [reqSent, setReqSent] = useState(false)
  const [copied, setCopied] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ reviewer_name: '', project_type: '', rating: 5, body: '' })
  const [addSaving, setAddSaving] = useState(false)

  const [flagTarget, setFlagTarget] = useState(null)
  const [flagReason, setFlagReason] = useState('')
  const [flagSaving, setFlagSaving] = useState(false)

  const shareLink = user ? `${REVIEW_BASE}/${user.id}` : REVIEW_BASE

  useEffect(() => { if (user) loadReviews() }, [user])

  async function loadReviews() {
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('creative_id', user.id)
      .or('hidden.is.null,hidden.eq.false')
      .order('created_at', { ascending: false })
    setReviews(data ?? [])
    setLoading(false)
  }

  const stats = useMemo(() => {
    const total = reviews.length
    const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0)
    const avg = total ? sum / total : 0
    const dist = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => (r.rating || 0) === star).length }))
    return { total, avg, dist }
  }, [reviews])

  const importedCount = useMemo(() => reviews.filter((r) => r.source === 'imported').length, [reviews])
  const canImport = importedCount < 5

  const visible = useMemo(() => {
    switch (filter) {
      case '5': return reviews.filter((r) => (r.rating || 0) === 5)
      case '4plus': return reviews.filter((r) => (r.rating || 0) >= 4)
      case 'low': return reviews.filter((r) => (r.rating || 0) <= 3)
      case 'imported': return reviews.filter((r) => r.source === 'imported')
      case 'flagged': return reviews.filter((r) => r.flagged)
      default: return reviews
    }
  }, [reviews, filter])

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  async function sendRequest() {
    if (!reqForm.client_email.trim()) return
    setReqSaving(true)
    try {
      await supabase.functions.invoke('send-review-request', {
        body: {
          creative_id: user.id,
          client_name: reqForm.client_name.trim(),
          client_email: reqForm.client_email.trim(),
          message: reqForm.message.trim(),
        },
      })
      setReqSent(true)
    } catch (_e) { /* best effort */ }
    setReqSaving(false)
  }

  function closeRequest() {
    setShowRequest(false)
    setReqForm({ client_name: '', client_email: '', message: '' })
    setReqSent(false)
  }

  async function addReview() {
    if (!addForm.reviewer_name.trim() || !addForm.body.trim()) return
    setAddSaving(true)
    await supabase.from('reviews').insert({
      creative_id: user.id,
      reviewer_name: addForm.reviewer_name.trim(),
      project_type: addForm.project_type.trim() || null,
      rating: addForm.rating,
      body: addForm.body.trim(),
      source: 'imported',
    })
    await loadReviews()
    setAddSaving(false)
    setShowAdd(false)
    setAddForm({ reviewer_name: '', project_type: '', rating: 5, body: '' })
  }

  async function submitFlag() {
    if (!flagTarget || !flagReason.trim()) return
    setFlagSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('reviews')
      .update({ flagged: true, flag_reason: flagReason.trim(), flag_status: 'pending', flagged_at: now })
      .eq('id', flagTarget.id)
      .eq('creative_id', user.id)
    setFlagSaving(false)
    if (error) return
    setReviews((prev) => prev.map((r) => (r.id === flagTarget.id ? { ...r, flagged: true, flag_reason: flagReason.trim(), flag_status: 'pending', flagged_at: now } : r)))
    setFlagTarget(null)
    setFlagReason('')
  }

  return (
    <div className="ltr-page">
      <style>{`
        .ltr-page { display: flex; flex-direction: column; gap: 24px; }
        .ltr-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 18px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; transition: transform .12s ease, opacity .12s ease; white-space: nowrap; }
        .ltr-btn:hover { transform: translateY(-1px); }
        .ltr-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .ltr-btn-primary { background: ${GREEN}; color: ${GREEN_TEXT}; }
        .ltr-btn-ghost { background: var(--lt-surface); color: var(--lt-text); border-color: var(--lt-border); }
        .ltr-btn-sm { padding: 7px 12px; font-size: 12.5px; border-radius: 10px; }
        .ltr-card { background: var(--lt-glass-bg); border: var(--lt-glass-border); box-shadow: var(--lt-glass-shadow); backdrop-filter: var(--lt-glass-blur); -webkit-backdrop-filter: var(--lt-glass-blur); border-radius: 18px; }
        .ltr-chip { padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; border: 1px solid var(--lt-border); background: var(--lt-surface); color: var(--lt-muted); transition: all .12s ease; }
        .ltr-chip:hover { color: var(--lt-text); }
        .ltr-chip.active { background: ${GREEN}; color: ${GREEN_TEXT}; border-color: ${GREEN}; }
        .ltr-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .02em; }
        .ltr-dist-track { flex: 1; height: 8px; border-radius: 999px; background: var(--lt-track); overflow: hidden; }
        .ltr-dist-fill { height: 100%; border-radius: 999px; background: ${STAR}; }
        .ltr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .ltr-summary { display: grid; grid-template-columns: auto 1px 1fr; gap: 28px; align-items: center; padding: 24px; }
        .ltr-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(6,6,12,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ltr-modal { width: 100%; max-width: 460px; max-height: 88vh; overflow-y: auto; border-radius: 20px; background: var(--lt-modal-bg); border: var(--lt-modal-border); box-shadow: var(--lt-modal-shadow); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); }
        .ltr-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px 0; }
        .ltr-modal-body { padding: 16px 22px 22px; display: flex; flex-direction: column; gap: 16px; }
        .ltr-x { background: var(--lt-surface); border: 1px solid var(--lt-border); color: var(--lt-muted); width: 30px; height: 30px; border-radius: 9px; cursor: pointer; font-size: 13px; }
        .ltr-x:hover { color: var(--lt-text); }
        @media (max-width: 767px) {
          .ltr-grid { grid-template-columns: 1fr; }
          .ltr-summary { grid-template-columns: 1fr; gap: 20px; text-align: center; }
          .ltr-summary .ltr-vrule { display: none; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>Reviews</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--lt-muted)' }}>Client reviews shown on your public profile. Request new ones or import past work.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canImport && <button type="button" className="ltr-btn ltr-btn-ghost" onClick={() => setShowAdd(true)}>Add past review</button>}
          <button type="button" className="ltr-btn ltr-btn-primary" onClick={() => setShowRequest(true)}>Request a review</button>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="ltr-card ltr-summary">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: 'var(--lt-text)' }}>{stats.avg.toFixed(1)}</div>
            <div style={{ marginTop: 8 }}><Stars value={stats.avg} size={18} /></div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--lt-muted)' }}>{stats.total} review{stats.total === 1 ? '' : 's'}</div>
          </div>
          <div className="ltr-vrule" style={{ width: 1, height: 96, background: 'var(--lt-hairline)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.dist.map(({ star, count }) => (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--lt-muted)', width: 42, textAlign: 'right' }}>{star} star</span>
                <div className="ltr-dist-track"><div className="ltr-dist-fill" style={{ width: `${stats.total ? (count / stats.total) * 100 : 0}%` }} /></div>
                <span style={{ fontSize: 12.5, color: 'var(--lt-faint)', width: 24 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.total > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`ltr-chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="ltr-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>Loading reviews…</div>
      ) : stats.total === 0 ? (
        <div className="ltr-card" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>No reviews yet</div>
          <div style={{ margin: '8px auto 20px', maxWidth: 380, fontSize: 13.5, color: 'var(--lt-muted)', lineHeight: 1.6 }}>Ask a happy client to leave one, or import reviews from work you did before LensTrybe.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="ltr-btn ltr-btn-primary" onClick={() => setShowRequest(true)}>Request a review</button>
            {canImport && <button type="button" className="ltr-btn ltr-btn-ghost" onClick={() => setShowAdd(true)}>Add past review</button>}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="ltr-card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No reviews match this filter.</div>
      ) : (
        <div className="ltr-grid">
          {visible.map((r) => {
            const pending = r.flagged && r.flag_status === 'pending'
            return (
              <div key={r.id} className="ltr-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{reviewerOf(r)}</div>
                    <div style={{ marginTop: 5 }}><Stars value={r.rating} /></div>
                  </div>
                  {r.source === 'imported' && <span className="ltr-badge" style={{ background: 'var(--lt-surface-2)', color: 'var(--lt-muted)' }}>Imported</span>}
                </div>
                {textOf(r) && <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.65, fontStyle: 'italic', opacity: 0.9 }}>&ldquo;{textOf(r)}&rdquo;</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
                  {r.project_type && <span className="ltr-badge" style={{ background: 'rgba(29,185,84,0.14)', color: GREEN }}>{r.project_type}</span>}
                  <span style={{ fontSize: 12, color: 'var(--lt-faint)' }}>{fmtDate(r.created_at)}</span>
                </div>
                {pending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                    <span className="ltr-badge" style={{ background: 'rgba(255,45,120,0.14)', color: PINK }}>Under review</span>
                    <span style={{ fontSize: 12, color: 'var(--lt-muted)' }}>We will be in touch within 48 hours.</span>
                  </div>
                ) : (
                  <div style={{ paddingTop: 2 }}>
                    <button type="button" className="ltr-btn ltr-btn-ghost ltr-btn-sm" onClick={() => { setFlagTarget(r); setFlagReason('') }}>Flag review</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showRequest} onClose={closeRequest} title="Request a review" busy={reqSaving}>
        {reqSent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.6 }}>
              Sent. {reqForm.client_name || 'Your client'} will get an email inviting them to leave a review on your profile.
            </div>
            <button type="button" className="ltr-btn ltr-btn-primary" onClick={closeRequest}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6 }}>We will email your client a link to leave a review on your public profile.</div>
            <Field label="Client name">
              <input style={inputStyle} placeholder="Sarah M." value={reqForm.client_name} onChange={(e) => setReqForm((p) => ({ ...p, client_name: e.target.value }))} />
            </Field>
            <Field label="Client email">
              <input style={inputStyle} type="email" placeholder="sarah@example.com" value={reqForm.client_email} onChange={(e) => setReqForm((p) => ({ ...p, client_email: e.target.value }))} />
            </Field>
            <Field label="Personal note (optional)">
              <textarea style={{ ...inputStyle, minHeight: 84, resize: 'vertical', lineHeight: 1.6 }} placeholder="Thanks again for having me shoot your wedding..." value={reqForm.message} onChange={(e) => setReqForm((p) => ({ ...p, message: e.target.value }))} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4, flexWrap: 'wrap' }}>
              <button type="button" className="ltr-btn ltr-btn-ghost ltr-btn-sm" onClick={copyLink}>{copied ? 'Link copied' : 'Copy review link'}</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="ltr-btn ltr-btn-ghost" onClick={closeRequest} disabled={reqSaving}>Cancel</button>
                <button type="button" className="ltr-btn ltr-btn-primary" onClick={sendRequest} disabled={reqSaving || !reqForm.client_email.trim()}>{reqSaving ? 'Sending…' : 'Send request'}</button>
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add a past review" busy={addSaving}>
        <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6 }}>Add up to 5 reviews from clients you worked with before LensTrybe. These are labelled &ldquo;Imported&rdquo; on your profile. {importedCount}/5 used.</div>
        <Field label="Client name">
          <input style={inputStyle} placeholder="Sarah M." value={addForm.reviewer_name} onChange={(e) => setAddForm((p) => ({ ...p, reviewer_name: e.target.value }))} />
        </Field>
        <Field label="Project type (optional)">
          <input style={inputStyle} placeholder="Wedding photography" value={addForm.project_type} onChange={(e) => setAddForm((p) => ({ ...p, project_type: e.target.value }))} />
        </Field>
        <Field label="Rating">
          <StarPicker value={addForm.rating} onChange={(v) => setAddForm((p) => ({ ...p, rating: v }))} />
        </Field>
        <Field label="Review">
          <textarea style={{ ...inputStyle, minHeight: 96, resize: 'vertical', lineHeight: 1.6 }} placeholder="What did your client say about working with you?" value={addForm.body} onChange={(e) => setAddForm((p) => ({ ...p, body: e.target.value }))} />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="ltr-btn ltr-btn-ghost" onClick={() => setShowAdd(false)} disabled={addSaving}>Cancel</button>
          <button type="button" className="ltr-btn ltr-btn-primary" onClick={addReview} disabled={addSaving || !addForm.reviewer_name.trim() || !addForm.body.trim()}>{addSaving ? 'Adding…' : 'Add review'}</button>
        </div>
      </Modal>

      <Modal open={!!flagTarget} onClose={() => { setFlagTarget(null); setFlagReason('') }} title="Flag this review" busy={flagSaving}>
        <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6 }}>Tell us why this review should be removed. We will investigate and respond within 48 hours.</div>
        <Field label="Reason">
          <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.6 }} placeholder="e.g. This person was never a client of mine" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="ltr-btn ltr-btn-ghost" onClick={() => { setFlagTarget(null); setFlagReason('') }} disabled={flagSaving}>Cancel</button>
          <button type="button" className="ltr-btn ltr-btn-primary" onClick={submitFlag} disabled={flagSaving || !flagReason.trim()}>{flagSaving ? 'Submitting…' : 'Submit flag'}</button>
        </div>
      </Modal>
    </div>
  )
}
