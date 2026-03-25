import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

function MessagesPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadMessages = async () => {
      if (!supabase || !user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setMessages(filterRowsForUser(data, user.id))
      }

      setLoading(false)
    }

    if (!authLoading) {
      loadMessages()
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return <p>Loading messages...</p>
  }

  return (
    <section>
      <h1>Messages</h1>
      {errorMessage && <p>{errorMessage}</p>}
      {messages.length === 0 ? (
        <p>No messages found.</p>
      ) : (
        <ul>
          {messages.map((message) => (
            <li key={message.id ?? `${message.created_at}-message`}>
              {JSON.stringify(message)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MessagesPage
