import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const BLUE = '#4A9EFF'
const AMBER = '#f59e0b'

const STATUS_META = {
  confirmed: { label: 'Confirmed', color: GREEN, bg: 'rgba(29,185,84,0.14)' },
  pending: { label: 'Pending', color: AMBER, bg: 'rgba(245,158,11,0.16)' },
  cancelled: { label: 'Cancelled', color: PINK, bg: 'rgba(255,45,120,0.14)' },
  completed: { label: 'Completed', color: BLUE, bg: 'rgba(74,158,255,0.16)' },
}
function statusMeta(s) { return STATUS_META[s] || { label: s || '—', color: 'var(--lt-muted)', bg: 'var(--lt-surface-2)' } }

function StyleBlock() {
  return (
    <style>{`
      .ltb-page { display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
      .ltb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltb-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltb-btn-primary:hover { filter: brightness(1.06); }
      .ltb-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltb-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltb-chip { padding: 7px 15px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); }
      .ltb-chip.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltb-row { display: grid; grid-template-columns: 1fr 150px 150px 120px; gap: 12px; align-items: center; padding: 13px 18px; border-top: 1px solid var(--lt-hairline); cursor: pointer; transition: background .12s ease; }
      .ltb-row:hover { background: var(--lt-surface-2); }
      .ltb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltb-modal { width: 100%; max-width: 560px; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); overflow: hidden; }
      .ltb-mhead { padding: 16px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; }
      @media (max-width: 767px) {
        .ltb-row { grid-template-columns: 1fr auto; }
        .ltb-row .ltb-col-date, .ltb-row .ltb-col-type { display: none; }
        .ltb-overlay { padding: 16px; }
        .ltb-page button { min-height: 40px; }
      }
    `}</style>
  )
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
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadBookings() {
    if (!user) { setBookings([]); setLoading(false); return }
    const { data } = await supabase.from('bookings').select('*').eq('creative_id', user.id).order('booking_date', { ascending: true, nullsFirst: false })
    setBookings(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('bookings').update({ status }).eq('id', id)
    try { await supabase.functions.invoke('send-booking-update', { body: { booking_id: id, status } }) } catch { /* best effort */ }
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

  const stats = useMemo(() => ({
    upcoming: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }), [bookings])

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18 }
  const stat = { ...GLASS, flex: '1 1 150px', borderRadius: 16, padding: '16px 18px' }
  const fmt = (raw, opts) => raw ? new Date(raw).toLocaleDateString('en-AU', opts) : '—'

  const filters = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' },
  ]

  return (
    <>
      <StyleBlock />
      <div className="ltb-page">
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>My bookings</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Every confirmed, upcoming and past booking in one place.</p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{stats.upcoming}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Upcoming</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>{stats.completed}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Completed</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: stats.cancelled ? PINK : 'var(--lt-text)' }}>{stats.cancelled}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Cancelled</div></div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filters.map(f => <button key={f.key} type="button" className={`ltb-chip${filter === f.key ? ' on' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1fr 150px 150px 120px', gap: 12, padding: '11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--lt-faint)' }}>
            <span>Client</span>
            {!isMobile && <span>Date</span>}
            {!isMobile && <span>Type</span>}
            <span style={{ textAlign: isMobile ? 'right' : 'left' }}>Status</span>
          </div>
          {loading ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14, borderTop: '1px solid var(--lt-hairline)' }}>Loading bookings…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14, borderTop: '1px solid var(--lt-hairline)' }}>No {filter} bookings.</div>
          ) : filtered.map((b) => {
            const m = statusMeta(b.status)
            return (
              <div key={b.id} className="ltb-row" onClick={() => setSelected(b)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.client_name ?? 'Client'}</div>
                  <div style={{ fontSize: 12, color: 'var(--lt-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.client_email || '—'}</div>
                  {isMobile && <span style={{ display: 'inline-block', marginTop: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: m.color, background: m.bg }}>{m.label}</span>}
                </div>
                <span className="ltb-col-date" style={{ fontSize: 13, color: 'var(--lt-muted)' }}>{fmt(b.booking_date ?? b.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="ltb-col-type" style={{ fontSize: 13, color: 'var(--lt-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.service ?? b.type ?? '—'}</span>
                <span style={{ textAlign: 'left' }} className={isMobile ? '' : ''}>
                  {!isMobile && <span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: m.color, background: m.bg }}>{m.label}</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="ltb-overlay" onClick={() => setSelected(null)}>
          <div className="ltb-modal" onClick={e => e.stopPropagation()}>
            <div className="ltb-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>Booking details</span>
              <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <Field label="Client" value={selected.client_name ?? '—'} />
                <Field label="Email" value={selected.client_email ?? '—'} />
                <Field label="Date" value={fmt(selected.booking_date ?? selected.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
                <Field label="Type" value={selected.service ?? selected.type ?? '—'} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Status</div>
                  <span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: statusMeta(selected.status).color, background: statusMeta(selected.status).bg }}>{statusMeta(selected.status).label}</span>
                </div>
              </div>

              {selected.notes && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notes</div>
                  <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.7, padding: '14px 16px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)', borderRadius: 12 }}>{selected.notes}</div>
                </div>
              )}

              {(selected.status === 'confirmed' || (selected.status !== 'cancelled' && selected.status !== 'completed')) && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {selected.status === 'confirmed' && <button type="button" className="ltb-btn ltb-btn-ghost" style={{ color: BLUE, borderColor: 'rgba(74,158,255,0.4)' }} onClick={() => updateStatus(selected.id, 'completed')}>Mark completed</button>}
                  {selected.status !== 'cancelled' && selected.status !== 'completed' && <button type="button" className="ltb-btn ltb-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => updateStatus(selected.id, 'cancelled')}>Cancel booking</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--lt-text)' }}>{value}</div>
    </div>
  )
}
