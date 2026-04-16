import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

export default function BookingRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadRequests() }, [user])

  async function loadRequests() {
    if (!user) return
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('creative_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests(data ?? [])
    setLoading(false)
  }

  async function respond(id, status) {
    await supabase.from('bookings').update({ status }).eq('id', id)
    await loadRequests()
    setSelected(null)
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'center', gap: '12px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    countBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '24px',
      height: '24px',
      padding: '0 8px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--green)',
      color: '#000',
      fontSize: '12px',
      fontWeight: 700,
      fontFamily: 'var(--font-ui)',
    },
    tableWrap: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 140px 160px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 140px 160px', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)' },
    emptyState: {
      padding: '64px 24px',
      textAlign: 'center',
      fontFamily: 'var(--font-ui)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
    },
    emptyIcon: { fontSize: '40px' },
    emptyTitle: { fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' },
    emptyText: { fontSize: '13px', color: 'var(--text-muted)' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    notes: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  }

  return (
    <div style={styles.page}>
      <div>
        <div style={styles.pageHeader}>
          <h1 style={styles.title}>Booking Requests</h1>
          {requests.length > 0 && (
            <span style={styles.countBadge}>{requests.length}</span>
          )}
        </div>
        <p style={styles.subtitle}>Review and respond to incoming booking requests from clients.</p>
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <span>Client</span>
          <span>Requested Date</span>
          <span>Type</span>
          <span>Received</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading requests…</div>
          </div>
        ) : requests.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📭</div>
            <div style={styles.emptyTitle}>No pending requests</div>
            <div style={styles.emptyText}>When clients request a booking, they'll appear here.</div>
          </div>
        ) : requests.map((r, i) => (
          <div
            key={r.id}
            style={{ ...styles.tableRow, borderBottom: i === requests.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
            onClick={() => setSelected(r)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{r.client_name ?? 'Client'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{r.client_email}</div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
              {r.date ? new Date(r.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{r.type ?? '—'}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
              {r.created_at ? new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
              <Button variant="primary" size="sm" onClick={() => respond(r.id, 'confirmed')}>Accept</Button>
              <Button variant="danger" size="sm" onClick={() => respond(r.id, 'cancelled')}>Decline</Button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Booking Request" size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={styles.viewGrid}>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Client</div>
                <div style={styles.viewValue}>{selected.client_name ?? '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Email</div>
                <div style={styles.viewValue}>{selected.client_email ?? '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Requested Date</div>
                <div style={styles.viewValue}>
                  {selected.date ? new Date(selected.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Type</div>
                <div style={styles.viewValue}>{selected.type ?? '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Received</div>
                <div style={styles.viewValue}>
                  {selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </div>
              </div>
            </div>

            {selected.notes && (
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Message from Client</div>
                <div style={styles.notes}>{selected.notes}</div>
              </div>
            )}

            <div style={styles.modalActions}>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
              <Button variant="danger" size="sm" onClick={() => respond(selected.id, 'cancelled')}>Decline</Button>
              <Button variant="primary" size="sm" onClick={() => respond(selected.id, 'confirmed')}>Accept Booking</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
