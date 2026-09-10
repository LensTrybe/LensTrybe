import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Theme-aware Booking Requests page (light + dark) built on the --lt-* tokens.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'
const FONT = { fontFamily: 'Inter, sans-serif' }

// Glass + field recipes on the theme tokens.
const glassCard = {
  background: 'var(--lt-glass-bg)',
  border: 'var(--lt-glass-border)',
  boxShadow: 'var(--lt-glass-shadow)',
  backdropFilter: 'var(--lt-glass-blur)',
  WebkitBackdropFilter: 'var(--lt-glass-blur)',
}

function Btn({ variant = 'primary', size = 'md', children, style, disabled, ...props }) {
  const pad = size === 'sm' ? '7px 14px' : '10px 18px'
  const fs = size === 'sm' ? 12.5 : 13.5
  const variants = {
    primary: { background: GREEN, color: GREEN_TEXT, border: '1px solid transparent' },
    secondary: { background: 'var(--lt-surface)', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
    ghost: { background: 'transparent', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
    danger: { background: PINK, color: '#fff', border: '1px solid transparent' },
  }
  return (
    <button {...props} disabled={disabled}
      style={{ padding: pad, fontSize: fs, fontWeight: 700, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'transform .12s ease, opacity .12s ease', opacity: disabled ? 0.55 : 1, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

function Modal({ isOpen, onClose, title, size = 'md', children }) {
  if (!isOpen) return null
  const maxWidth = size === 'sm' ? 420 : size === 'lg' ? 720 : 560
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, ...FONT }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', borderRadius: 16, background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)', boxShadow: 'var(--lt-modal-shadow)', backdropFilter: 'var(--lt-modal-blur)', WebkitBackdropFilter: 'var(--lt-modal-blur)', color: 'var(--lt-text)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--lt-hairline)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--lt-text)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            &times;
          </button>
        </div>
        <div style={{ padding: '22px' }}>{children}</div>
      </div>
    </div>
  )
}

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
    try { await supabase.functions.invoke('send-booking-update', { body: { booking_id: id, status } }) } catch { /* best effort */ }
    await loadRequests()
    setSelected(null)
  }

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px', color: 'var(--lt-text)', ...FONT },
    pageHeader: { display: 'flex', alignItems: 'center', gap: '12px' },
    title: { fontSize: '28px', color: 'var(--lt-text)', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, fontFamily: 'inherit' },
    subtitle: { fontSize: '14px', color: 'var(--lt-muted)', fontFamily: 'inherit', marginTop: '4px' },
    countBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '24px',
      height: '24px',
      padding: '0 8px',
      borderRadius: '999px',
      background: GREEN,
      color: GREEN_TEXT,
      fontSize: '12px',
      fontWeight: 700,
      fontFamily: 'inherit',
    },
    tableWrap: { ...glassCard, borderRadius: 16, overflow: 'hidden' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 140px 160px', padding: '12px 24px', borderBottom: '1px solid var(--lt-hairline)', fontSize: '11px', color: 'var(--lt-faint)', fontFamily: 'inherit', letterSpacing: '0.06em', textTransform: 'uppercase' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 140px 160px', padding: '16px 24px', borderBottom: '1px solid var(--lt-hairline)', alignItems: 'center', cursor: 'pointer', transition: 'background .12s ease' },
    emptyState: {
      padding: '64px 24px',
      textAlign: 'center',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
    },
    emptyIcon: { fontSize: '40px' },
    emptyTitle: { fontSize: '16px', fontWeight: 700, color: 'var(--lt-text)' },
    emptyText: { fontSize: '13px', color: 'var(--lt-muted)' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--lt-faint)', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--lt-text)', fontFamily: 'inherit' },
    notes: { fontSize: '14px', color: 'var(--lt-muted)', fontFamily: 'inherit', lineHeight: 1.7, padding: '14px 16px', background: 'var(--lt-surface)', borderRadius: 12, border: '1px solid var(--lt-border)' },
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
            <div style={{ fontSize: '14px', color: 'var(--lt-muted)', fontFamily: 'inherit' }}>Loading requests…</div>
          </div>
        ) : requests.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}></div>
            <div style={styles.emptyTitle}>No pending requests</div>
            <div style={styles.emptyText}>When clients request a booking, they'll appear here.</div>
          </div>
        ) : requests.map((r, i) => (
          <div
            key={r.id}
            style={{ ...styles.tableRow, borderBottom: i === requests.length - 1 ? 'none' : '1px solid var(--lt-hairline)' }}
            onClick={() => setSelected(r)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--lt-surface)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--lt-text)', fontFamily: 'inherit' }}>{r.client_name ?? 'Client'}</div>
              <div style={{ fontSize: '12px', color: 'var(--lt-faint)', fontFamily: 'inherit' }}>{r.client_email}</div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--lt-muted)', fontFamily: 'inherit' }}>
              {r.date ? new Date(r.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--lt-muted)', fontFamily: 'inherit' }}>{r.type ?? '—'}</span>
            <span style={{ fontSize: '13px', color: 'var(--lt-muted)', fontFamily: 'inherit' }}>
              {r.created_at ? new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
              <Btn variant="primary" size="sm" onClick={() => respond(r.id, 'confirmed')}>Accept</Btn>
              <Btn variant="danger" size="sm" onClick={() => respond(r.id, 'cancelled')}>Decline</Btn>
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
              <Btn variant="ghost" onClick={() => setSelected(null)}>Close</Btn>
              <Btn variant="danger" size="sm" onClick={() => respond(selected.id, 'cancelled')}>Decline</Btn>
              <Btn variant="primary" size="sm" onClick={() => respond(selected.id, 'confirmed')}>Accept Booking</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
