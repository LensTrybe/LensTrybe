<<<<<<< HEAD
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return null
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
=======
import { Navigate, Outlet } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser'

function ProtectedRoute() {
  const { user, loading, errorMessage } = useAuthUser()

  if (loading) {
    return <p>Checking authentication...</p>
  }

  if (errorMessage) {
    return <p>{errorMessage}</p>
  }

  if (!user) {
    return <Navigate replace to="/login" />
  }

  return <Outlet />
}

export default ProtectedRoute
>>>>>>> origin/cursor/lenstrybe-app-initial-setup-6f7d
