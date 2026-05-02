import { useCallback, useEffect, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

function getStatusInfo(row) {
  const raw = String(row?.status ?? 'pending').toLowerCase().trim()
  if (raw === 'confirmed') {
    return { variant: 'confirmed', label: 'confirmed' }
  }
  if (raw === 'declined') {
    return { variant: 'declined', label: 'declined' }
  }
  if (raw === 'pending') {
    return { variant: 'pending', label: 'pending' }
  }
  const label = String(row?.status ?? 'unknown').trim() || 'unknown'
  return { variant: 'unknown', label }
}

function resolveClientName(row) {
  return (
    row?.client_name ??
    row?.clientName ??
    row?.name ??
    'Client'
  )
}

function resolveClientEmail(row) {
  const e = row?.client_email ?? row?.clientEmail ?? row?.email ?? ''
  return typeof e === 'string' ? e.trim() : ''
}

function resolveRequestedDate(row) {
  const raw =
    row?.requested_date ??
    row?.date_requested ??
    row?.booking_date ??
    row?.event_date ??
    row?.date ??
    null
  if (raw == null || raw === '') {
    return null
  }
  const d = typeof raw === 'string' ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`) : new Date(raw)
  return Number.isNaN(d.getTime()) ? String(raw) : d
}

function resolveServiceType(row) {
  return (
    row?.service_type ??
    row?.serviceType ??
    row?.service ??
    '—'
  )
}

function resolveNotes(row) {
  const n = row?.notes ?? row?.note ?? ''
  return typeof n === 'string' ? n.trim() : ''
}

function formatRequestedDate(value) {
  if (value == null) {
    return '—'
  }
  if (value instanceof Date) {
    return value.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  return String(value)
}

function BookingRequests() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadBookings = useCallback(async () => {
    if (!supabase || !userId) {
      setBookings([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('creative_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setBookings([])
    } else {
      setBookings(data ?? [])
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    loadBookings()
  }, [authLoading, loadBookings])

  const updateStatus = async (id, status) => {
    if (!supabase || !id) {
      return
    }

    setSuccessMessage('')
    setPendingAction({ id, kind: status === 'confirmed' ? 'confirm' : 'decline' })
    setErrorMessage('')

    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage(status === 'confirmed' ? 'Booking confirmed.' : 'Booking declined.')
      setBookings((current) =>
        current.map((row) => (row.id === id ? { ...row, status } : row)),
      )
    }

    setPendingAction(null)
  }

  const handleDelete = async (id) => {
    if (!supabase || !id) {
      return
    }

    setSuccessMessage('')
    setPendingAction({ id, kind: 'delete' })
    setErrorMessage('')

    const { error } = await supabase.from('bookings').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Booking removed.')
      setBookings((current) => current.filter((row) => row.id !== id))
    }

    setPendingAction(null)
  }

  const THEME = {
    pageBg: '#0a0a0f',
    text: 'rgb(242, 242, 242)',
    subtitle: '#666',
    muted: '#555',
    cardBg: '#13131a',
    cardBorder: '1px solid #20202740',
    itemBg: '#1a1a24',
    itemBorder: '1px solid #202027',
    softText: '#aaa',
    notesText: '#888',
    green: '#39ff14',
    red: '#f87171',
  }

  const shellStyle = {
    background: THEME.pageBg,
    minHeight: '100vh',
    padding: 32,
    color: THEME.text,
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
  }

  const wrapStyle = { maxWidth: 800, margin: '0 auto' }

  if (authLoading) {
    return (
      <section style={shellStyle}>
        <div style={wrapStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Booking Requests</div>
          <div style={{ fontSize: 13, color: THEME.subtitle, marginTop: 6 }}>
            Review and respond to incoming booking requests
          </div>
          <div style={{ marginTop: 18, color: THEME.muted, fontSize: 13 }}>Loading session…</div>
        </div>
      </section>
    )
  }

  if (!userId) {
    return (
      <section style={shellStyle}>
        <div style={wrapStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Booking Requests</div>
          <div style={{ fontSize: 13, color: THEME.subtitle, marginTop: 6 }}>
            Review and respond to incoming booking requests
          </div>
          <div style={{ marginTop: 18, color: THEME.muted, fontSize: 13 }}>
            Sign in to view your booking requests.
          </div>
        </div>
      </section>
    )
  }

  const pendingBookings = bookings.filter((row) => getStatusInfo(row).variant === 'pending')

  const sectionCardStyle = {
    background: THEME.cardBg,
    border: THEME.cardBorder,
    borderRadius: 12,
    padding: 24,
  }

  const sectionHeadingStyle = {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    borderLeft: `3px solid ${THEME.green}`,
    paddingLeft: 10,
  }

  const actionBtnStyle = ({ variant, disabled }) => {
    const isAccept = variant === 'accept'
    const bg = isAccept ? '#1e2a1e' : '#2a1a1a'
    const border = isAccept ? `1px solid ${THEME.green}` : `1px solid ${THEME.red}`
    const color = isAccept ? THEME.green : THEME.red
    return {
      background: bg,
      border,
      color,
      borderRadius: 8,
      padding: '8px 16px',
      fontWeight: 600,
      fontSize: 13,
      cursor: 'pointer',
      opacity: disabled ? 0.55 : 1,
      userSelect: 'none',
    }
  }

  return (
    <section style={shellStyle}>
      <div style={wrapStyle}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Booking Requests</div>
          <div style={{ fontSize: 13, color: THEME.subtitle, marginTop: 6 }}>
            Review and respond to incoming booking requests
          </div>
        </div>

        {(errorMessage || successMessage) && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              background: errorMessage ? '#2a1a1a' : '#1e2a1e',
              border: errorMessage ? '1px solid #3a1a1a' : `1px solid ${THEME.green}33`,
              color: errorMessage ? THEME.red : THEME.green,
            }}
            role={errorMessage ? 'alert' : 'status'}
          >
            {errorMessage || successMessage}
          </div>
        )}

        <div style={sectionCardStyle}>
          <div style={sectionHeadingStyle}>Pending Booking Requests</div>

          {loading ? (
            <div style={{ color: THEME.muted, fontSize: 13 }}>Loading bookings…</div>
          ) : pendingBookings.length === 0 ? (
            <div
              style={{
                background: THEME.itemBg,
                borderRadius: 10,
                padding: 32,
                textAlign: 'center',
                color: THEME.muted,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">
                
              </div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>No pending booking requests.</div>
            </div>
          ) : (
            <div>
              {pendingBookings.map((row) => {
                const notes = resolveNotes(row)
                const isBusy = pendingAction?.id === row.id
                const busyKind = isBusy ? pendingAction.kind : null
                const requestedDate = formatRequestedDate(resolveRequestedDate(row))

                return (
                  <div
                    key={row.id}
                    style={{
                      background: THEME.itemBg,
                      border: THEME.itemBorder,
                      borderRadius: 10,
                      padding: 16,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                      {resolveClientName(row)}
                    </div>
                    <div style={{ color: THEME.softText, fontSize: 13, marginBottom: 4 }}>
                      {resolveServiceType(row)}
                    </div>
                    <div style={{ color: THEME.softText, fontSize: 13, marginBottom: 8 }}>
                      {requestedDate}
                    </div>
                    <div style={{ color: THEME.notesText, fontSize: 12, fontStyle: 'italic', marginBottom: 12 }}>
                      {notes ? notes : '—'}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        style={actionBtnStyle({ variant: 'accept', disabled: isBusy })}
                        disabled={isBusy}
                        onClick={() => updateStatus(row.id, 'confirmed')}
                      >
                        {busyKind === 'confirm' ? '…' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        style={actionBtnStyle({ variant: 'decline', disabled: isBusy })}
                        disabled={isBusy}
                        onClick={() => updateStatus(row.id, 'declined')}
                      >
                        {busyKind === 'decline' ? '…' : 'Decline'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default BookingRequests
