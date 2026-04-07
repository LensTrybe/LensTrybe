import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

const THEME = {
  pageBg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  subtitle: '#666',
  muted: '#555',
  cardBg: '#13131a',
  cardBorder: '1px solid #20202740',
  controlBg: '#1a1a24',
  controlBorder: '1px solid #2a2a2a',
  btnText: '#aaa',
  green: '#39ff14',
  yellow: '#facc15',
  red: '#f87171',
}

function formatBookingDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

function getBookingStatus(booking) {
  const raw = booking?.status ?? booking?.booking_status ?? booking?.state ?? ''
  const status = String(raw || '').toLowerCase()
  if (status.includes('cancel')) return 'cancelled'
  if (status.includes('pend')) return 'pending'
  if (status.includes('confirm')) return 'confirmed'
  if (status.includes('complete')) return 'confirmed'
  return status || 'pending'
}

function statusBadgeStyle(status) {
  const normalized = String(status || '').toLowerCase()
  const color =
    normalized === 'confirmed'
      ? THEME.green
      : normalized === 'pending'
        ? THEME.yellow
        : normalized === 'cancelled'
          ? THEME.red
          : THEME.btnText

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: `1px solid ${color}33`,
    background:
      normalized === 'confirmed'
        ? '#1e2a1e'
        : normalized === 'pending'
          ? '#2a2618'
          : normalized === 'cancelled'
            ? '#2a1a1a'
            : '#15151b',
    color,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
  }
}

function smallDarkButtonStyle(disabled) {
  return {
    background: THEME.controlBg,
    border: THEME.controlBorder,
    color: THEME.btnText,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  }
}

function greenButtonStyle(disabled) {
  return {
    background: THEME.green,
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}

function MyBookingsPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadBookings = async () => {
      if (!supabase || !user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setBookings(filterRowsForUser(data, user.id))
      }

      setLoading(false)
    }

    if (!authLoading) {
      loadBookings()
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return (
      <section
        style={{
          background: THEME.pageBg,
          minHeight: '100vh',
          padding: 32,
          color: THEME.text,
          fontFamily: 'Inter, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>My Bookings</div>
          <div style={{ fontSize: 13, color: THEME.subtitle, marginTop: 6 }}>
            Manage your upcoming and past bookings
          </div>
          <div style={{ marginTop: 18, color: THEME.muted, fontSize: 13 }}>Loading bookings…</div>
        </div>
      </section>
    )
  }

  const bookingCards = bookings.map((booking) => {
    const id = booking?.id ?? `${booking?.created_at ?? ''}-${booking?.status ?? ''}`
    const clientName =
      booking?.client_name ??
      booking?.clientName ??
      booking?.client ??
      booking?.customer_name ??
      booking?.customerName ??
      'Client'
    const serviceType = booking?.service_type ?? booking?.serviceType ?? booking?.service ?? '—'
    const bookingDate = formatBookingDate(booking?.booking_date ?? booking?.date ?? booking?.start_time ?? booking?.starts_at)
    const status = getBookingStatus(booking)

    return (
      <div
        key={id}
        style={{
          background: THEME.controlBg,
          border: THEME.controlBorder,
          borderRadius: 12,
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.2, marginBottom: 6 }}>
              {clientName}
            </div>
            <div style={{ fontSize: 13, color: THEME.btnText }}>
              {serviceType} · {bookingDate}
            </div>
          </div>
          <div style={statusBadgeStyle(status)}>{status}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="button" style={smallDarkButtonStyle(false)} title="View booking (UI only)">
            View
          </button>
          <button
            type="button"
            style={smallDarkButtonStyle(true)}
            disabled
            title="Not wired yet (no existing mutation in this page)"
          >
            Mark Complete
          </button>
          <button
            type="button"
            style={smallDarkButtonStyle(true)}
            disabled
            title="Not wired yet (no existing mutation in this page)"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  })

  const reviewRequestCards = bookings.map((booking) => {
    const id = booking?.id ?? `${booking?.created_at ?? ''}-${booking?.status ?? ''}`
    const clientName =
      booking?.client_name ??
      booking?.clientName ??
      booking?.client ??
      booking?.customer_name ??
      booking?.customerName ??
      'Client'
    const bookingDate = formatBookingDate(booking?.booking_date ?? booking?.date ?? booking?.start_time ?? booking?.starts_at)

    const requestSent =
      Boolean(booking?.review_request_sent) ||
      Boolean(booking?.review_request_sent_at) ||
      Boolean(booking?.reviewRequestSentAt) ||
      Boolean(booking?.review_request_id)

    return (
      <div
        key={`review-${id}`}
        style={{
          background: THEME.controlBg,
          border: THEME.controlBorder,
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.2, marginBottom: 6 }}>
            {clientName}
          </div>
          <div style={{ fontSize: 13, color: THEME.btnText }}>{bookingDate}</div>
        </div>

        {requestSent ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: '#1e2a1e',
              border: `1px solid ${THEME.green}55`,
              color: THEME.green,
              whiteSpace: 'nowrap',
            }}
          >
            Request Sent
          </div>
        ) : (
          <button
            type="button"
            style={greenButtonStyle(true)}
            disabled
            title="Not wired yet (no existing mutation in this page)"
          >
            Send Review Request
          </button>
        )}
      </div>
    )
  })

  return (
    <section
      style={{
        background: THEME.pageBg,
        minHeight: '100vh',
        padding: 32,
        color: THEME.text,
        fontFamily: 'Inter, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>My Bookings</div>
          <div style={{ fontSize: 13, color: THEME.subtitle, marginTop: 6 }}>
            Manage your upcoming and past bookings
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              marginBottom: 14,
              background: '#2a1a1a',
              border: '1px solid #3a1a1a',
              color: THEME.red,
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Section 1 — Bookings */}
        <div
          style={{
            background: THEME.cardBg,
            border: THEME.cardBorder,
            borderRadius: 12,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 16,
              borderLeft: `3px solid ${THEME.green}`,
              paddingLeft: 10,
            }}
          >
            Bookings
          </div>

          {bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 10px' }}>
              <div style={{ fontSize: 26, marginBottom: 10 }} aria-hidden="true">
                📅
              </div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                No bookings yet.
              </div>
              <div style={{ color: THEME.muted, fontSize: 13 }}>
                Manage your availability to start receiving booking requests.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>{bookingCards}</div>
          )}
        </div>

        {/* Section 2 — Review Requests */}
        <div
          style={{
            background: THEME.cardBg,
            border: THEME.cardBorder,
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 16,
              borderLeft: `3px solid ${THEME.green}`,
              paddingLeft: 10,
            }}
          >
            Review Requests
          </div>

          {bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 10px' }}>
              <div style={{ fontSize: 26, marginBottom: 10 }} aria-hidden="true">
                ⭐
              </div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                No review requests yet.
              </div>
              <div style={{ color: THEME.muted, fontSize: 13 }}>
                Send review requests from your completed bookings.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>{reviewRequestCards}</div>
          )}
        </div>
      </div>
    </section>
  )
}

export default MyBookingsPage
