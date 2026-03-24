import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

function QuotesPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientName, setClientName] = useState('')
  const [amount, setAmount] = useState('')
  const [details, setDetails] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadQuotes = async () => {
    if (!supabase || !user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setQuotes(filterRowsForUser(data, user.id))
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!authLoading) {
      loadQuotes()
    }
  }, [authLoading, user])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!supabase || !user?.id) {
      setErrorMessage('Supabase is not configured or user is missing.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const { error } = await supabase.from('quotes').insert({
      user_id: user.id,
      client_name: clientName,
      amount: amount ? Number(amount) : null,
      details,
      status: 'draft',
    })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMessage('Quote created.')
      setClientName('')
      setAmount('')
      setDetails('')
      await loadQuotes()
    }

    setSaving(false)
  }

  if (authLoading || loading) {
    return <p>Loading quotes...</p>
  }

  return (
    <section>
      <h1>Quotes</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="quote-client-name">Client Name</label>
          <input
            id="quote-client-name"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="quote-amount">Amount</label>
          <input
            id="quote-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="quote-details">Details</label>
          <textarea
            id="quote-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Create Quote'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}

      {quotes.length === 0 ? (
        <p>No quotes yet.</p>
      ) : (
        <ul>
          {quotes.map((quote) => (
            <li key={quote.id ?? `${quote.created_at}-${quote.client_name}`}>
              {JSON.stringify(quote)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default QuotesPage
