import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

function AvailabilityPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [availabilityRows, setAvailabilityRows] = useState([])
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('available')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadAvailability = async () => {
    if (!supabase || !user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .order('date', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setAvailabilityRows(filterRowsForUser(data, user.id))
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!authLoading) {
      loadAvailability()
    }
  }, [authLoading, user])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!supabase || !user?.id || !date) {
      setErrorMessage('Date, user, or Supabase configuration is missing.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const existingRow = availabilityRows.find((row) => row.date === date)

    let response

    if (existingRow?.id) {
      response = await supabase
        .from('availability')
        .update({ status })
        .eq('id', existingRow.id)
    } else {
      response = await supabase
        .from('availability')
        .insert({ user_id: user.id, date, status })
    }

    const { error } = response

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMessage('Availability updated.')
      await loadAvailability()
    }

    setSaving(false)
  }

  if (authLoading || loading) {
    return <p>Loading availability...</p>
  }

  return (
    <section>
      <h1>Availability</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="availability-date">Date</label>
          <input
            id="availability-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="availability-status">Status</label>
          <select
            id="availability-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Availability'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}

      {availabilityRows.length === 0 ? (
        <p>No availability records yet.</p>
      ) : (
        <ul>
          {availabilityRows.map((row) => (
            <li key={row.id ?? `${row.date}-${row.status}`}>
              {row.date}: {row.status}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default AvailabilityPage
