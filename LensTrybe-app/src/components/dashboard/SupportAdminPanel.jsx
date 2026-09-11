import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const GREEN = '#1DB954'
const PINK = '#FF2D78'
const AMBER = '#f59e0b'
const BLUE = '#4A9EFF'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }

function fmtDateTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}
function statusColor(s) {
  if (s === 'resolved') return GREEN
  if (s === 'in_progress') return AMBER
  if (s === 'closed') return 'var(--lt-muted)'
  return BLUE
}

// Support ticket inbox. Rendered inside AdminPage (admin-gated).
export default function SupportAdminPanel({ embedded = false, onSummary } = {}) {
  const [open, setOpen] = useState(true)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [expanded, setExpanded] = useState(null)
  const [savingId, setSavingId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('id, created_at, updated_at, user_id, name, email, role, category, subject, message, status, admin_notes')
        .order('created_at', { ascending: false })
        .limit(200)
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function updateStatus(id, status) {
    setSavingId(id)
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    } catch {
      void load()
    } finally {
      setSavingId(null)
    }
  }

  const stats = useMemo(() => ({
    total: rows.length,
    open: rows.filter((r) => r.status === 'open').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    resolved: rows.filter((r) => r.status === 'resolved' || r.status === 'closed').length,
  }), [rows])

  const visible = useMemo(() => {
    if (filter === 'active') return rows.filter((r) => r.status === 'open' || r.status === 'in_progress')
    if (filter === 'all') return rows
    return rows.filter((r) => r.status === filter)
  }, [rows, filter])

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--lt-faint)', padding: '8px 10px', whiteSpace: 'nowrap' }
  const td = { fontSize: 13, color: 'var(--lt-text)', padding: '9px 10px', borderTop: '1px solid var(--lt-hairline)', verticalAlign: 'top' }
  const stat = { flex: '1 1 120px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px' }
  const chip = (active) => ({
    padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${active ? GREEN : 'var(--lt-border)'}`,
    background: active ? 'rgba(29,185,84,0.14)' : 'transparent',
    color: active ? GREEN : 'var(--lt-muted)',
  })

  const filters = [
    { key: 'active', label: 'Active' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' },
    { key: 'all', label: 'All' },
  ]

  // Header summary for the Admin page card.
  useEffect(() => {
    if (!onSummary || loading) return
    onSummary({
      summary: `${stats.open} open · ${stats.inProgress} in progress · ${stats.resolved} resolved`,
      badge: stats.open ? { text: `${stats.open} open`, tone: 'attention' } : null,
    })
  }, [onSummary, loading, stats])

  return (
    <div style={{ marginBottom: embedded ? 0 : 20 }}>
      {!embedded && (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Support inbox {stats.open ? `(${stats.open} open)` : ''}</span>
        <span style={{ color: 'var(--lt-muted)', fontSize: 13 }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      )}

      {(open || embedded) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--lt-text)' }}>{stats.total}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Total tickets</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: BLUE }}>{stats.open}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Open</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: AMBER }}>{stats.inProgress}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>In progress</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{stats.resolved}</div><div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Resolved</div></div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filters.map((f) => (
              <button key={f.key} type="button" style={chip(filter === f.key)} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
            <button type="button" style={{ ...chip(false), marginLeft: 'auto' }} onClick={() => load()}>Refresh</button>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--lt-border)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr>
                <th style={th}>From</th><th style={th}>Subject</th><th style={th}>Category</th>
                <th style={th}>Received</th><th style={th}>Status</th>
              </tr></thead>
              <tbody>
                {visible.map((r) => (
                  <Fragment key={r.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded((id) => (id === r.id ? null : r.id))}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.name || 'Someone'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--lt-faint)' }}>{r.email}</div>
                        {r.role && <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'capitalize' }}>{r.role}</div>}
                      </td>
                      <td style={{ ...td, minWidth: 200 }}>
                        <div style={{ fontWeight: 600 }}>{r.subject || 'No subject'}</div>
                        <div style={{ fontSize: 12, color: 'var(--lt-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>{r.message}</div>
                        <div style={{ fontSize: 11.5, color: GREEN, marginTop: 3 }}>{expanded === r.id ? 'Hide message' : 'Read message'}</div>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.category || '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <span style={{ color: statusColor(r.status), fontWeight: 700, fontSize: 12 }}>{STATUS_LABEL[r.status] || r.status}</span>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td style={{ ...td, background: 'var(--lt-surface-2)' }} colSpan={5}>
                          <div style={{ fontSize: 13.5, color: 'var(--lt-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{r.message}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <a
                              href={`mailto:${r.email}?subject=${encodeURIComponent('Re: ' + (r.subject || 'Your LensTrybe support request'))}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 13, fontWeight: 700, color: GREEN, textDecoration: 'none' }}
                            >
                              Reply by email
                            </a>
                            <span style={{ fontSize: 12, color: 'var(--lt-faint)' }}>Ref #{String(r.id).slice(0, 8).toUpperCase()}</span>
                            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                              {STATUSES.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  disabled={savingId === r.id}
                                  onClick={() => updateStatus(r.id, s)}
                                  style={{
                                    padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                    border: `1px solid ${r.status === s ? statusColor(s) : 'var(--lt-border)'}`,
                                    background: r.status === s ? 'rgba(29,185,84,0.12)' : 'transparent',
                                    color: r.status === s ? statusColor(s) : 'var(--lt-muted)',
                                  }}
                                >
                                  {STATUS_LABEL[s]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!loading && visible.length === 0 && (
                  <tr><td style={{ ...td, color: 'var(--lt-muted)' }} colSpan={5}>No tickets here.</td></tr>
                )}
                {loading && (
                  <tr><td style={{ ...td, color: 'var(--lt-muted)' }} colSpan={5}>Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
