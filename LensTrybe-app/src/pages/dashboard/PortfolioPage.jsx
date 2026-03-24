import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

function PortfolioPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadPortfolioItems = async () => {
      if (!supabase || !user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setItems(filterRowsForUser(data, user.id))
      }

      setLoading(false)
    }

    if (!authLoading) {
      loadPortfolioItems()
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return <p>Loading portfolio items...</p>
  }

  return (
    <section>
      <h1>Portfolio</h1>
      {errorMessage && <p>{errorMessage}</p>}
      {items.length === 0 ? (
        <p>No portfolio items found.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id ?? `${item.created_at}-portfolio-item`}>
              {JSON.stringify(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PortfolioPage
