import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

async function fetchContactsForUser(userId) {
  if (!supabase || !userId) {
    return []
  }

  const { data, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return filterRowsForUser(data, userId)
}

function CRMPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const userId = user?.id ?? null

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!supabase || !userId) {
      setContacts([])
      setErrorMessage('')
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setErrorMessage('')

    fetchContactsForUser(userId)
      .then((rows) => {
        if (!isMounted) {
          return
        }
        setContacts(rows)
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

  const loadContacts = async () => {
    if (!supabase || !userId) {
      setContacts([])
      setErrorMessage('')
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const rows = await fetchContactsForUser(userId)
      setContacts(rows)
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

    const { error } = await supabase.from('crm_contacts').insert({
      user_id: userId,
      name,
      email,
      phone,
      notes,
    })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMessage('Contact added.')
      setName('')
      setEmail('')
      setPhone('')
      setNotes('')
      await loadContacts()
    }

    setSaving(false)
  }

  if (authLoading || loading) {
    return <p>Loading CRM contacts...</p>
  }

  return (
    <section>
      <h1>CRM</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="crm-name">Name</label>
          <input
            id="crm-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="crm-email">Email</label>
          <input
            id="crm-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="crm-phone">Phone</label>
          <input
            id="crm-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="crm-notes">Notes</label>
          <textarea
            id="crm-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Add Contact'}
        </button>
      </form>

      {message && <p>{message}</p>}
      {errorMessage && <p>{errorMessage}</p>}

      {contacts.length === 0 ? (
        <p>No contacts yet.</p>
      ) : (
        <ul>
          {contacts.map((contact) => (
            <li key={contact.id ?? `${contact.created_at}-${contact.name}`}>
              {JSON.stringify(contact)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default CRMPage
