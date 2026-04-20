import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

function statusVariant(status) {
  if (status === 'confirmed') return 'green'
  if (status === 'pending') return 'warning'
  if (status === 'cancelled') return 'error'
  if (status === 'completed') return 'info'
  return 'default'
}

export default function MyBookingsPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('upcoming')

  useEffect(() => { loadBookings() }, [user])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadBookings() {
    if (!user) {
      setBookings([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('creative_id', user.id)
      .order('booking_date', { ascending: true, nullsFirst: false })
    setBookings(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('bookings').update({ status }).eq('id', id)
    await loadBookings()
    setSelected(prev => prev ? { ...prev, status } : null)
  }

  function bookingSortDate(b) {
    const raw = b.booking_date ?? b.date
    if (raw == null || raw === '') return null
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const now = new Date()
  const filtered = bookings.filter(b => {
    const d = bookingSortDate(b)
    if (filter === 'upcoming') return b.status === 'confirmed'
    if (filter === 'past') return b.status === 'completed' || (d != null && d < now)
    if (filter === 'cancelled') return b.status === 'cancelled'
    return true
  })

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden' },
    title: { fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tabs: { display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflowX: isMobile ? 'auto' : 'hidden', width: isMobile ? '100%' : 'fit-content' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400 }),
    tableWrap: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 120px 80px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: isMobile ? '700px' : 'auto' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 120px 80px', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)', minWidth: isMobile ? '700px' : 'auto' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    viewGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    notes: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' },
  }

  return (
    <div style={styles.page} className="my-bookings-page">
      <style>{`
        @media (max-width: 767px) {
          .my-bookings-page button { min-height: 44px; }
          .my-bookings-page input, .my-bookings-page textarea, .my-bookings-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>
      <div>
        <h1 style={styles.title}>My Bookings</h1>
        <p style={styles.subtitle}>All your confirmed and upcoming bookings.</p>
      </div>

      <div style={styles.tabs}>
        {[
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'past', label: 'Past' },
          { key: 'cancelled', label: 'Cancelled' },
          { key: 'all', label: 'All' },
        ].map(t => (
          <button key={t.key} style={styles.tab(filter === t.key)} onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <span>Client</span>
          <span>Date</span>
          <span>Type</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div style={styles.emptyState}>Loading bookings…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>No {filter} bookings.</div>
        ) : filtered.map((b, i) => (
          <div
            key={b.id}
            style={{ ...styles.tableRow, borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
            onClick={() => setSelected(b)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{b.client_name ?? 'Client'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{b.client_email}</div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
              {(() => {
                const raw = b.booking_date ?? b.date
                return raw ? new Date(raw).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
              })()}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{b.service ?? b.type ?? '—'}</span>
            <Badge variant={statusVariant(b.status)} size="sm">{b.status}</Badge>
            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelected(b) }}>View</Button>
          </div>
        ))}
      </div>

      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Booking Details" size="md">
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
                <div style={styles.viewLabel}>Date</div>
                <div style={styles.viewValue}>
                  {(() => {
                    const raw = selected.booking_date ?? selected.date
                    return raw ? new Date(raw).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'
                  })()}
                </div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Type</div>
                <div style={styles.viewValue}>{selected.service ?? selected.type ?? '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Status</div>
                <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
              </div>
            </div>

            {selected.notes && (
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Notes</div>
                <div style={styles.notes}>{selected.notes}</div>
              </div>
            )}

            <div style={styles.modalActions}>
              {selected.status === 'confirmed' && (
                <Button variant="secondary" size="sm" onClick={() => updateStatus(selected.id, 'completed')}>
                  Mark Completed
                </Button>
              )}
              {selected.status !== 'cancelled' && selected.status !== 'completed' && (
                <Button variant="danger" size="sm" onClick={() => updateStatus(selected.id, 'cancelled')}>
                  Cancel Booking
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
