import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const GREEN = '#1DB954'
const PINK = '#FF2D78'
const AMBER = '#f59e0b'

function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '—' }
}
function feedbackThisMonth(iso) {
  if (!iso) return false
  const d = new Date(iso); const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
}
function statusColor(s) {
  if (s === 'reverted') return PINK
  if (s === 'at_risk') return AMBER
  return GREEN
}

// Founding cohort tracker + feedback inbox. Rendered inside AdminPage (admin-gated).
export default function FoundingAdminPanel({ embedded = false, onSummary } = {}) {
  const [open, setOpen] = useState(true)
  const [rows, setRows] = useState([])
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    async function load() {
      setLoading(true)
      try {
        const [st, fb] = await Promise.all([
          supabase.rpc('founding_status_all'),
          supabase.from('founding_feedback').select('id, creative_id, category, message, created_at').order('created_at', { ascending: false }).limit(100),
        ])
        if (!live) return
        setRows(Array.isArray(st.data) ? st.data : [])
        setFeedback(Array.isArray(fb.data) ? fb.data : [])
      } catch {
        if (live) { setRows([]); setFeedback([]) }
      } finally {
        if (live) setLoading(false)
      }
    }
    void load()
    return () => { live = false }
  }, [])

  const nameById = useMemo(() => {
    const m = {}
    rows.forEach((r) => { m[r.id] = r.business_name || 'Unnamed' })
    return m
  }, [rows])

  const stats = useMemo(() => ({
    total: rows.length,
    listings: rows.filter((r) => r.listing_complete).length,
    jobsDone: rows.filter((r) => (r.job_count || 0) >= 3).length,
    atRisk: rows.filter((r) => r.deal_status === 'at_risk').length,
    reverted: rows.filter((r) => r.deal_status === 'reverted').length,
  }), [rows])

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--lt-faint)', padding: '8px 10px', whiteSpace: 'nowrap' }
  const td = { fontSize: 13, color: 'var(--lt-text)', padding: '9px 10px', borderTop: '1px solid var(--lt-hairline)', whiteSpace: 'nowrap' }
  const stat = { flex: '1 1 120px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px' }

  // Header summary for the Admin page card.
  useEffect(() => {
    if (!onSummary || loading) return
    onSummary({
      summary: `${stats.total} founding creative${stats.total === 1 ? '' : 's'} · ${stats.listings} listings complete · ${feedback.length} feedback`,
      badge: stats.atRisk ? { text: `${stats.atRisk} at risk`, tone: 'warning' } : null,
    })
  }, [onSummary, loading, stats, feedback.length])

  return (
    <div style={{ marginBottom: embedded ? 0 : 20 }}>
      {!embedded && (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Founding creatives {rows.length ? `(${rows.length})` : ''}</span>
        <span style={{ color: 'var(--lt-muted)', fontSize: 13 }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      )}

      {(open || embedded) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--lt-text)' }}>{stats.total}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Founding creatives</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{stats.listings}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Listings complete</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{stats.jobsDone}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Done 3+ jobs</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: AMBER }}>{stats.atRisk}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>At risk</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: PINK }}>{stats.reverted}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Reverted</div></div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--lt-border)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr>
                <th style={th}>Creative</th><th style={th}>Joined</th><th style={th}>Listing</th>
                <th style={th}>Jobs</th><th style={th}>Last feedback</th><th style={th}>Deal</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>{r.business_name || 'Unnamed'}<div style={{ fontSize: 11, color: 'var(--lt-faint)' }}>{r.business_email || ''}</div></td>
                    <td style={td}>{fmtDate(r.founding_member_since)}</td>
                    <td style={{ ...td, color: r.listing_complete ? GREEN : 'var(--lt-muted)', fontWeight: 600 }}>{r.listing_complete ? 'Complete' : 'Incomplete'}</td>
                    <td style={{ ...td, color: (r.job_count || 0) >= 3 ? GREEN : 'var(--lt-muted)', fontWeight: 600 }}>{Math.min(r.job_count || 0, 3)} of 3</td>
                    <td style={{ ...td, color: feedbackThisMonth(r.last_feedback_at) ? GREEN : 'var(--lt-muted)' }}>{fmtDate(r.last_feedback_at)}</td>
                    <td style={td}><span style={{ color: statusColor(r.deal_status), fontWeight: 700, fontSize: 12 }}>{(r.deal_status || 'active').replace('_', ' ')}</span></td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td style={{ ...td, color: 'var(--lt-muted)' }} colSpan={6}>No founding creatives yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)', margin: '4px 0 10px' }}>Feedback inbox {feedback.length ? `(${feedback.length})` : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {feedback.map((f) => (
                <div key={f.id} style={{ background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lt-text)' }}>{nameById[f.creative_id] || 'Creative'}</span>
                    <span style={{ fontSize: 12, color: 'var(--lt-faint)' }}>{f.category || 'Feedback'} · {fmtDate(f.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--lt-muted)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.message}</div>
                </div>
              ))}
              {!loading && feedback.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>No feedback yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
