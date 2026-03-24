import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

async function fetchInvoicesForUser(userId) {
  if (!supabase || !userId) {
    return []
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return filterRowsForUser(data, userId)
}

function InvoicingPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientName, setClientName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('draft')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const userId = user?.id ?? null

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!supabase || !userId) {
      setInvoices([])
      setErrorMessage('')
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setErrorMessage('')

    fetchInvoicesForUser(userId)
      .then((rows) => {
        if (!isMounted) {
          return
        }
        setInvoices(rows)
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }
        setErrorMessage(error.message)
      })
      .finally(() => {
        if (!isMounted) {
          return
        }
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [authLoading, userId])

  const loadInvoices = async () => {
    if (!supabase || !userId) {
      setInvoices([])
      setErrorMessage('')
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const rows = await fetchInvoicesForUser(userId)
      setInvoices(rows)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!supabase || !userId) {
      setErrorMessage('Supabase is not configured or user is missing.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const { error } = await supabase.from('invoices').insert({
      user_id: userId,
      client_name: clientName,
      amount: amount ? Number(amount) : null,
      due_date: dueDate || null,
      status,
    })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMessage('Invoice created.')
      setClientName('')
      setAmount('')
      setDueDate('')
      setStatus('draft')
      await loadInvoices()
    }

    setSaving(false)
  }

  if (authLoading || loading) {
    return <p>Loading invoices...</p>
  }

  return (
    <section>
      <h1>Invoicing</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="invoice-client-name">Client Name</label>
          <input
            id="invoice-client-name"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="invoice-amount">Amount</label>
          <input
            id="invoice-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="invoice-due-date">Due Date</label>
          <input
            id="invoice-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="invoice-status">Status</label>
          <input
            id="invoice-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Create Invoice'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}

      {invoices.length === 0 ? (
        <p>No invoices yet.</p>
      ) : (
        <ul>
          {invoices.map((invoice) => (
            <li key={invoice.id ?? `${invoice.created_at}-${invoice.client_name}`}>
              {JSON.stringify(invoice)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default InvoicingPage
