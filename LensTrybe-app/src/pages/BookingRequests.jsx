import { useCallback, useEffect, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'
import './BookingRequests.css'

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

  if (authLoading) {
    return (
      <section className="booking-requests-page">
        <p className="booking-requests-page__subtitle">Loading session…</p>
      </section>
    )
  }

  if (!userId) {
    return (
      <section className="booking-requests-page">
        <h1 className="booking-requests-page__title">Booking requests</h1>
        <p className="booking-requests-page__subtitle">Sign in to view your booking requests.</p>
      </section>
    )
  }

  return (
    <section className="booking-requests-page">
      <h1 className="booking-requests-page__title">Booking requests</h1>
      <p className="booking-requests-page__subtitle">
        Review incoming client requests, confirm or decline, or remove a booking from your list.
      </p>

      {loading ? (
        <p className="booking-requests-page__subtitle">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="booking-requests-page__empty">
          No booking requests yet. When clients reach out, they will appear here.
        </p>
      ) : (
        <div className="booking-requests-page__grid">
          {bookings.map((row) => {
            const { variant, label } = getStatusInfo(row)
            const statusClass =
              variant === 'confirmed'
                ? 'booking-requests-page__status--confirmed'
                : variant === 'declined'
                  ? 'booking-requests-page__status--declined'
                  : variant === 'pending'
                    ? 'booking-requests-page__status--pending'
                    : 'booking-requests-page__status--unknown'

            const email = resolveClientEmail(row)
            const notes = resolveNotes(row)
            const isBusy = pendingAction?.id === row.id
            const busyKind = isBusy ? pendingAction.kind : null

            return (
              <article key={row.id} className="booking-requests-page__card">
                <span className={`booking-requests-page__status ${statusClass}`}>{label}</span>
                <h2 className="booking-requests-page__client">{resolveClientName(row)}</h2>
                {email ? (
                  <p className="booking-requests-page__email">
                    <a href={`mailto:${email}`}>{email}</a>
                  </p>
                ) : (
                  <p className="booking-requests-page__email">No email on file</p>
                )}
                <p className="booking-requests-page__meta">
                  <span className="booking-requests-page__meta-label">Date requested: </span>
                  {formatRequestedDate(resolveRequestedDate(row))}
                </p>
                <p className="booking-requests-page__meta">
                  <span className="booking-requests-page__meta-label">Service: </span>
                  {resolveServiceType(row)}
                </p>
                {notes ? (
                  <p className="booking-requests-page__notes">
                    <strong>Notes</strong>
                    <br />
                    {notes}
                  </p>
                ) : (
                  <p className="booking-requests-page__notes">
                    <strong>Notes</strong>
                    <br />
                    None
                  </p>
                )}
                <div className="booking-requests-page__actions">
                  <button
                    type="button"
                    className="booking-requests-page__btn booking-requests-page__btn--confirm"
                    disabled={isBusy || variant === 'confirmed'}
                    onClick={() => updateStatus(row.id, 'confirmed')}
                  >
                    {busyKind === 'confirm' ? '…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    className="booking-requests-page__btn booking-requests-page__btn--decline"
                    disabled={isBusy || variant === 'declined'}
                    onClick={() => updateStatus(row.id, 'declined')}
                  >
                    {busyKind === 'decline' ? '…' : 'Decline'}
                  </button>
                  <button
                    type="button"
                    className="booking-requests-page__btn booking-requests-page__btn--delete"
                    disabled={isBusy}
                    onClick={() => handleDelete(row.id)}
                  >
                    {busyKind === 'delete' ? '…' : 'Delete'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {errorMessage && (
        <p className="booking-requests-page__message" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && !errorMessage && (
        <p className="booking-requests-page__message booking-requests-page__message--ok" role="status">
          {successMessage}
        </p>
      )}
    </section>
  )
}

export default BookingRequests
