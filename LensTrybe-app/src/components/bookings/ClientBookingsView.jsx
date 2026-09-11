import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { bookingAction, bookingStatus, fmtDayLong, timeText, todayIso } from '../../lib/bookings'

// Client dashboard: the bookings they've requested or that creatives have made with them.
// Styled on the client dashboard's light tokens.
const card = { background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border-default, rgba(20,17,26,0.1))', borderRadius: 14, padding: '16px 18px' }
const btn = { padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui, Inter, sans-serif)', border: '1px solid var(--border-default, rgba(20,17,26,0.14))', background: 'transparent', color: 'var(--text-primary, #14111a)' }

function StatusPill({ status }) {
  const m = bookingStatus(status)
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: m.color, background: m.bg, whiteSpace: 'nowrap' }}>{m.label}</span>
}

function BookingCard({ b, creative, highlight, onCancelled }) {
  const navigate = useNavigate()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canCancel = b.status === 'pending' || b.status === 'confirmed'
  const name = creative?.business_name || 'Your creative'

  async function cancel() {
    setBusy(true); setError('')
    const res = await bookingAction('cancel', { bookingId: b.id, reason })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    onCancelled(res.booking)
    setCancelling(false)
  }

  return (
    <div id={`booking-${b.id}`} style={{ ...card, border: highlight ? '2px solid #1DB954' : card.border, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          {creative?.avatar_url
            ? <img src={creative.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(29,185,84,0.14)', color: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{name.charAt(0)}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #14111a)' }}>{name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #55535e)', marginTop: 2 }}>{b.booking_date ? fmtDayLong(b.booking_date) : 'Date to be confirmed'} · {timeText(b)}</div>
          </div>
        </div>
        <StatusPill status={b.status} />
      </div>
      {(b.service || b.location) && <div style={{ fontSize: 13, color: 'var(--text-secondary, #55535e)' }}>{[b.service, b.location].filter(Boolean).join(' · ')}</div>}
      {b.status === 'pending' && <div style={{ fontSize: 12.5, color: 'var(--text-muted, #8a8995)' }}>Waiting for {name} to accept. Nothing is booked until they do.</div>}
      {b.response_note && (b.status === 'confirmed' || b.status === 'declined' || (b.status === 'cancelled' && b.cancelled_by === 'creative')) && (
        <div style={{ fontSize: 13, color: 'var(--text-primary, #14111a)', background: 'var(--bg-subtle, rgba(20,17,26,0.04))', borderRadius: 10, padding: '10px 12px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          <strong>{b.status === 'cancelled' ? 'Reason: ' : `Note from ${name}: `}</strong>{b.response_note}
        </div>
      )}
      {b.status === 'cancelled' && <div style={{ fontSize: 12.5, color: 'var(--text-muted, #8a8995)' }}>Cancelled by {b.cancelled_by === 'client' ? 'you' : name}.</div>}

      {cancelling ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} placeholder={`Let ${name} know why (optional)`}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-default, rgba(20,17,26,0.14))', fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical' }} />
          {error && <div style={{ fontSize: 12.5, color: '#e11d48' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={() => setCancelling(false)} disabled={busy}>Keep it</button>
            <button type="button" style={{ ...btn, color: '#e11d48', borderColor: 'rgba(225,29,72,0.4)' }} onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : b.status === 'pending' ? 'Withdraw request' : 'Cancel booking'}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" style={btn} onClick={() => navigate(`/creatives/${b.creative_id}`)}>View profile</button>
          {canCancel && <button type="button" style={{ ...btn, color: '#e11d48', borderColor: 'rgba(225,29,72,0.35)' }} onClick={() => setCancelling(true)}>{b.status === 'pending' ? 'Withdraw request' : 'Cancel booking'}</button>}
        </div>
      )}
    </div>
  )
}

export default function ClientBookingsView({ userId, highlightId }) {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [creatives, setCreatives] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.rpc('my_client_bookings')
    const rows = data ?? []
    setBookings(rows)
    const ids = [...new Set(rows.map((b) => b.creative_id))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, business_name, avatar_url').in('id', ids)
      const map = {}
      for (const p of profs ?? []) map[p.id] = p
      setCreatives(map)
    }
    setLoading(false)
  }, [userId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!highlightId || loading) return
    const el = document.getElementById(`booking-${highlightId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, loading])

  const today = todayIso()
  const groups = useMemo(() => {
    const active = bookings.filter((b) => (b.status === 'pending' || b.status === 'confirmed') && (!b.booking_date || b.booking_date >= today))
    const past = bookings.filter((b) => !active.includes(b)).sort((a, b) => String(b.booking_date || '').localeCompare(String(a.booking_date || '')))
    return { active, past }
  }, [bookings, today])

  function replace(u) { setBookings((prev) => prev.map((b) => (b.id === u.id ? u : b))) }

  return (
    <div style={{ padding: '24px', maxWidth: 760 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>My Bookings</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted, #8a8995)', margin: '0 0 18px', lineHeight: 1.55 }}>Requests you've sent and bookings creatives have confirmed with you.</p>
      {loading ? (
        <div style={{ color: 'var(--text-muted, #8a8995)', fontSize: 14 }}>Loading…</div>
      ) : bookings.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '32px 18px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No bookings yet</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted, #8a8995)', marginBottom: 14 }}>Find a creative and tap Request a Booking on their profile.</div>
          <button type="button" style={{ ...btn, background: '#1DB954', color: '#04120a', border: 'none' }} onClick={() => navigate('/creatives')}>Find a creative</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.active.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #8a8995)' }}>Upcoming and requested</div>}
          {groups.active.map((b) => <BookingCard key={b.id} b={b} creative={creatives[b.creative_id]} highlight={b.id === highlightId} onCancelled={replace} />)}
          {groups.past.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #8a8995)', marginTop: 10 }}>Past, declined and cancelled</div>}
          {groups.past.map((b) => <BookingCard key={b.id} b={b} creative={creatives[b.creative_id]} highlight={b.id === highlightId} onCancelled={replace} />)}
        </div>
      )}
    </div>
  )
}
