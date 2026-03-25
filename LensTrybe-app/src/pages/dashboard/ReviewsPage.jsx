import { useEffect, useState } from 'react'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { filterRowsForUser } from '../../lib/filterRowsForUser'

function ReviewsPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const loadReviews = async () => {
      if (!supabase || !user?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
      } else {
        setReviews(filterRowsForUser(data, user.id))
      }

      setLoading(false)
    }

    if (!authLoading) {
      loadReviews()
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return <p>Loading reviews...</p>
  }

  return (
    <section>
      <h1>Reviews</h1>
      {errorMessage && <p>{errorMessage}</p>}
      {reviews.length === 0 ? (
        <p>No reviews found.</p>
      ) : (
        <ul>
          {reviews.map((review) => (
            <li key={review.id ?? `${review.created_at}-review`}>
              {JSON.stringify(review)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ReviewsPage
