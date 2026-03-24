import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

function BookingRequestsPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadRequests = async () => {
      if (!supabase || !user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setRequests(filterRowsForUser(data, user.id))
      }

      setLoading(false)
    }

    if (!authLoading) {
      loadRequests()
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return <p>Loading booking requests...</p>
  }

  return (
    <section>
      <h1>Booking Requests</h1>
      {errorMessage && <p>{errorMessage}</p>}
      {requests.length === 0 ? (
        <p>No pending booking requests.</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <li key={request.id ?? `${request.created_at}-${request.status}`}>
              {JSON.stringify(request)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default BookingRequestsPage
