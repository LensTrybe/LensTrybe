import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  cardBorder: '1px solid #1e1e1e',
  itemBg: '#1a1a24',
  itemBorder: '1px solid #202027',
  muted: '#555',
  sub: '#aaa',
  green: '#39ff14',
  yellow: '#facc15',
  red: '#f87171',
}

const font = { fontFamily: 'Inter, sans-serif' }

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
      ? PAGE.green
      : normalized === 'pending'
        ? PAGE.yellow
        : normalized === 'cancelled'
          ? PAGE.red
          : PAGE.sub

  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: `1px solid ${color}44`,
    background:
      normalized === 'confirmed'
        ? 'rgba(57, 255, 20, 0.08)'
        : normalized === 'pending'
          ? 'rgba(250, 204, 21, 0.1)'
          : normalized === 'cancelled'
            ? 'rgba(248, 113, 113, 0.1)'
            : '#15151b',
    color,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
    ...font,
  }
}

function actionBtnStyle(disabled) {
  return {
    background: 'none',
    border: PAGE.itemBorder,
    color: PAGE.sub,
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    ...font,
  }
}

function greenSendStyle(disabled) {
  return {
    background: PAGE.green,
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap',
    ...font,
  }
}

function IconEye({ color }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <circle cx={12} cy={12} r={2.75} stroke={color} strokeWidth={1.75} />
    </svg>
  )
}

function MyBookingsPage() {
  const navigate = useNavigate()
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

  const shellStyle = {
    background: PAGE.bg,
    minHeight: '100%',
    padding: 32,
    color: PAGE.text,
    boxSizing: 'border-box',
    ...font,
  }

  const innerStyle = { maxWidth: 800, margin: '0 auto' }

  const sectionCardStyle = {
    background: PAGE.card,
    border: PAGE.cardBorder,
    borderRadius: 12,
    padding: 24,
    boxSizing: 'border-box',
    ...font,
  }

  const sectionHeadingStyle = {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    borderLeft: `3px solid ${PAGE.green}`,
    paddingLeft: 10,
    lineHeight: 1.3,
    ...font,
  }

  const viewProfileHref = user?.id ? `/portfolio/${user.id}` : '/dashboard'

  if (authLoading || loading) {
    return (
      <section style={shellStyle}>
        <div style={innerStyle}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate(-1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: PAGE.green,
                  fontSize: 14,
                  fontWeight: 600,
                  ...font,
                }}
              >
                <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
                  ←
                </span>
                Back
              </button>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', ...font }}>My Bookings</h1>
            </div>
            <Link
              to={viewProfileHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: PAGE.sub,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                ...font,
              }}
            >
              <IconEye color={PAGE.sub} />
              View Profile
            </Link>
          </header>
          <div style={{ color: PAGE.muted, fontSize: 14, ...font }}>Loading bookings…</div>
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
          background: PAGE.itemBg,
          border: PAGE.itemBorder,
          borderRadius: 10,
          padding: 16,
          marginBottom: 8,
          display: 'grid',
          gap: 12,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.35, marginBottom: 4, ...font }}>
              {clientName}
            </div>
            <div style={{ fontSize: 13, color: PAGE.sub, lineHeight: 1.45, ...font }}>{serviceType}</div>
            <div style={{ fontSize: 13, color: PAGE.sub, lineHeight: 1.45, marginTop: 2, ...font }}>{bookingDate}</div>
          </div>
          <div style={statusBadgeStyle(status)}>{status}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            style={actionBtnStyle(true)}
            disabled
            title="Not wired yet (no existing mutation in this page)"
          >
            Mark Complete
          </button>
          <button
            type="button"
            style={actionBtnStyle(true)}
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
    const serviceType = booking?.service_type ?? booking?.serviceType ?? booking?.service ?? '—'
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
          background: PAGE.itemBg,
          border: PAGE.itemBorder,
          borderRadius: 10,
          padding: 16,
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.35, marginBottom: 4, ...font }}>
            {clientName}
          </div>
          <div style={{ fontSize: 13, color: PAGE.sub, lineHeight: 1.45, ...font }}>
            {serviceType} · {bookingDate}
          </div>
        </div>

        {requestSent ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: '#252530',
              border: '1px solid #2e2e38',
              color: PAGE.sub,
              whiteSpace: 'nowrap',
              ...font,
            }}
          >
            Sent
          </div>
        ) : (
          <button
            type="button"
            style={greenSendStyle(true)}
            disabled
            title="Not wired yet (no existing mutation in this page)"
          >
            Send Review Request
          </button>
        )}
      </div>
    )
  })

  const emptyWrap = {
    textAlign: 'center',
    padding: 32,
    ...font,
  }

  return (
    <section style={shellStyle}>
      <div style={innerStyle}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: PAGE.green,
                fontSize: 14,
                fontWeight: 600,
                ...font,
              }}
            >
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
                ←
              </span>
              Back
            </button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', ...font }}>
              My Bookings
            </h1>
          </div>
          <Link
            to={viewProfileHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: PAGE.sub,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              ...font,
            }}
          >
            <IconEye color={PAGE.sub} />
            View Profile
          </Link>
        </header>

        {errorMessage ? (
          <div
            style={{
              marginBottom: 16,
              background: 'rgba(248, 113, 113, 0.08)',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              color: PAGE.red,
              borderRadius: 10,
              padding: 14,
              fontSize: 13,
              ...font,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <div style={{ ...sectionCardStyle, marginBottom: 16 }}>
          <div style={sectionHeadingStyle}>My Bookings</div>

          {bookings.length === 0 ? (
            <div style={emptyWrap}>
              <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 14 }} aria-hidden="true">
                📅
              </div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 8, ...font }}>No bookings yet.</div>
              <div style={{ color: PAGE.muted, fontSize: 13, lineHeight: 1.5, maxWidth: 360, margin: '0 auto', ...font }}>
                Manage your availability to start receiving booking requests.
              </div>
            </div>
          ) : (
            <div>{bookingCards}</div>
          )}
        </div>

        <div style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>Review Requests</div>

          {bookings.length === 0 ? (
            <div style={emptyWrap}>
              <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 14 }} aria-hidden="true">
                ⭐
              </div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 8, ...font }}>
                No review requests yet.
              </div>
              <div style={{ color: PAGE.muted, fontSize: 13, lineHeight: 1.5, maxWidth: 360, margin: '0 auto', ...font }}>
                Send review requests from your completed bookings.
              </div>
            </div>
          ) : (
            <div>{reviewRequestCards}</div>
          )}
        </div>
      </div>
    </section>
  )
}

export default MyBookingsPage
