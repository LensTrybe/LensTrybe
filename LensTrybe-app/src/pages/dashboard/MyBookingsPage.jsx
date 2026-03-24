import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

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
    return <p>Loading bookings...</p>
  }

  return (
    <section>
      <h1>My Bookings</h1>
      {errorMessage && <p>{errorMessage}</p>}
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <ul>
          {bookings.map((booking) => (
            <li key={booking.id ?? `${booking.created_at}-${booking.status}`}>
              {JSON.stringify(booking)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MyBookingsPage
