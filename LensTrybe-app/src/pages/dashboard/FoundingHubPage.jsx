import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const AMBER = '#f59e0b'

const FEEDBACK_CATEGORIES = [
  'What is working well',
  'What could be better',
  'A feature idea',
  'A bug or problem',
  'Something else',
]

// One piece of feedback a month keeps this responsibility satisfied.
function feedbackThisMonth(lastAt) {
  if (!lastAt) return false
  const d = new Date(lastAt)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export default function FoundingHubPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [listingComplete, setListingComplete] = useState(false)
  const [jobsDone, setJobsDone] = useState(0)
  const [lastFeedbackAt, setLastFeedbackAt] = useState(null)
  const [loading, setLoading] = useState(true)

  const [category, setCategory] = useState(FEEDBACK_CATEGORIES[0])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isFounding = Boolean(profile && (profile.founding_member === true || profile.founding_member === 'true'))
  const dealStatus = String(profile?.founding_deal_status || 'active')

  async function load() {
    if (!user?.id) return
    setLoading(true)
    try {
      const [lc, jc, fb] = await Promise.all([
        supabase.rpc('founding_listing_complete', { p_id: user.id }),
        supabase.rpc('founding_job_count', { p_id: user.id }),
        supabase.from('founding_feedback').select('created_at').eq('creative_id', user.id).order('created_at', { ascending: false }).limit(1),
      ])
      setListingComplete(Boolean(lc.data))
      setJobsDone(Number(jc.data || 0))
      setLastFeedbackAt(fb.data && fb.data[0] ? fb.data[0].created_at : null)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [user?.id])

  async function submitFeedback(e) {
    if (e) e.preventDefault()
    setError('')
    if (!message.trim()) { setError('Please write a little something first.'); return }
    setSaving(true)
    try {
      const { error: insErr } = await supabase.from('founding_feedback').insert({
        creative_id: user.id,
        category,
        message: message.trim(),
      })
      if (insErr) throw insErr
      setMessage('')
      setSaved(true)
      setLastFeedbackAt(new Date().toISOString())
      setTimeout(() => setSaved(false), 4000)
    } catch {
      setError('Could not send your feedback. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const responsibilities = useMemo(() => ([
    {
      key: 'listing',
      title: 'Complete your profile to 100%',
      detail: 'A finished, client-ready listing within 7 days of joining.',
      done: listingComplete,
      status: listingComplete ? 'Complete' : 'In progress',
      action: listingComplete ? null : { label: 'Finish your profile', to: '/dashboard/profile/edit-profile' },
    },
    {
      key: 'jobs',
      title: 'Run your first 3 real jobs through LensTrybe',
      detail: 'Send a quote, have the client accept it, then invoice and mark it paid.',
      done: jobsDone >= 3,
      status: `${Math.min(jobsDone, 3)} of 3 done`,
      action: jobsDone >= 3 ? null : { label: 'Create a quote', to: '/dashboard/finance/quotes' },
    },
    {
      key: 'feedback',
      title: 'Share one piece of feedback a month',
      detail: 'It shapes what we build next. Use the form below.',
      done: feedbackThisMonth(lastFeedbackAt),
      status: feedbackThisMonth(lastFeedbackAt) ? 'Done this month' : 'Due this month',
      action: null,
    },
  ]), [listingComplete, jobsDone, lastFeedbackAt])

  if (!isFounding) {
    return (
      <div className="ltfh" style={{ padding: '40px 24px', maxWidth: 560, margin: '0 auto' }}>
        <StyleBlock />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--lt-text)', margin: '0 0 8px' }}>Founding creatives only</h1>
        <p style={{ color: 'var(--lt-muted)', fontSize: 15, lineHeight: 1.6 }}>This hub is for LensTrybe founding creatives. If you were invited and entered your code at sign-up, it will appear here.</p>
        <button type="button" className="ltfh-btn" onClick={() => navigate('/dashboard')} style={{ marginTop: 16 }}>Back to dashboard</button>
      </div>
    )
  }

  const statusChip = dealStatus === 'reverted'
    ? { bg: 'rgba(255,45,120,0.12)', color: PINK, label: 'Reverted to standard plan' }
    : dealStatus === 'at_risk'
      ? { bg: 'rgba(245,158,11,0.14)', color: AMBER, label: 'At risk, action needed' }
      : { bg: 'rgba(29,185,84,0.14)', color: GREEN, label: 'Founding deal active' }

  return (
    <div className="ltfh" style={{ padding: '32px 24px 64px', maxWidth: 860, margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <StyleBlock />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--lt-text)', margin: 0 }}>Founding creative hub</h1>
          <p style={{ color: 'var(--lt-muted)', fontSize: 15, lineHeight: 1.6, margin: '6px 0 0', maxWidth: 560 }}>
            Thanks for being one of the first. Here is what keeps your founding deal (12 months free Expert, then $49/mo for life).
          </p>
        </div>
        <span style={{ background: statusChip.bg, color: statusChip.color, fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{statusChip.label}</span>
      </div>

      {dealStatus === 'at_risk' && (
        <div className="ltfh-warn">You have a little outstanding on your founding responsibilities. Sort it before your grace period ends to keep your deal.</div>
      )}

      <div className="ltfh-grid">
        {responsibilities.map((r) => (
          <div key={r.key} className="ltfh-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className={`ltfh-tick ${r.done ? 'done' : ''}`}>{r.done ? '✓' : ''}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: r.done ? GREEN : 'var(--lt-muted)' }}>{r.status}</span>
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--lt-text)', lineHeight: 1.35 }}>{r.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--lt-muted)', lineHeight: 1.55, marginTop: 6 }}>{r.detail}</div>
            {r.action && (
              <button type="button" className="ltfh-link" onClick={() => navigate(r.action.to)}>{r.action.label} →</button>
            )}
          </div>
        ))}
      </div>

      <div className="ltfh-panel">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--lt-text)', margin: '0 0 4px' }}>Share your feedback</h2>
        <p style={{ color: 'var(--lt-muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
          Founding creatives shape LensTrybe. Tell us what is working, what is not, and what you would love to see. It goes straight to the team.
        </p>

        <form onSubmit={submitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="ltfh-label">Topic</label>
            <select className="ltfh-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {FEEDBACK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="ltfh-label">Your feedback</label>
            <textarea className="ltfh-input" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What is on your mind?" style={{ resize: 'vertical' }} />
          </div>
          {error && <div style={{ color: PINK, fontSize: 13 }}>{error}</div>}
          {saved && <div style={{ color: GREEN, fontSize: 13, fontWeight: 600 }}>Thanks. Your feedback has been sent, and your monthly feedback is ticked off.</div>}
          <button type="submit" className="ltfh-btn" disabled={saving} style={{ alignSelf: 'flex-start', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sending…' : 'Send feedback'}
          </button>
        </form>
      </div>

      {loading && <div style={{ color: 'var(--lt-faint)', fontSize: 12, marginTop: 16 }}>Refreshing your status…</div>}
    </div>
  )
}

function StyleBlock() {
  return (
    <style>{`
      .ltfh-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 22px 0; }
      .ltfh-card { background: var(--lt-surface); border: 1px solid var(--lt-border); border-radius: 16px; padding: 18px; }
      .ltfh-tick { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--lt-input-border); color: ${GREEN_DARK}; font-size: 13px; font-weight: 800; flex-shrink: 0; }
      .ltfh-tick.done { background: ${GREEN}; border-color: ${GREEN}; }
      .ltfh-link { margin-top: 12px; background: none; border: none; color: ${GREEN}; font-weight: 600; font-size: 13.5px; cursor: pointer; padding: 0; font-family: inherit; }
      .ltfh-panel { background: var(--lt-surface); border: 1px solid var(--lt-border); border-radius: 18px; padding: 24px; margin-top: 8px; }
      .ltfh-label { display: block; font-size: 12.5px; font-weight: 600; color: var(--lt-muted); margin-bottom: 6px; }
      .ltfh-input { width: 100%; box-sizing: border-box; background: var(--lt-input-bg); border: 1px solid var(--lt-input-border); border-radius: 12px; padding: 11px 13px; font-size: 14px; color: var(--lt-text); font-family: inherit; }
      .ltfh-input:focus { outline: none; border-color: ${GREEN}; }
      .ltfh-btn { background: ${GREEN}; color: ${GREEN_DARK}; border: none; border-radius: 999px; padding: 11px 22px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
      .ltfh-warn { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.35); color: ${AMBER}; border-radius: 12px; padding: 12px 16px; font-size: 13.5px; margin: 14px 0 4px; }
    `}</style>
  )
}
