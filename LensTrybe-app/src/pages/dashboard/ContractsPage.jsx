import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

function ContractsPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadContracts = async () => {
      if (!supabase || !user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setContracts(filterRowsForUser(data, user.id))
      }

      setLoading(false)
    }

    if (!authLoading) {
      loadContracts()
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return <p>Loading contracts...</p>
  }

  return (
    <section>
      <h1>Contracts</h1>
      {errorMessage && <p>{errorMessage}</p>}
      {contracts.length === 0 ? (
        <p>No contracts found.</p>
      ) : (
        <ul>
          {contracts.map((contract) => (
            <li key={contract.id ?? `${contract.created_at}-contract`}>
              {JSON.stringify(contract)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ContractsPage
