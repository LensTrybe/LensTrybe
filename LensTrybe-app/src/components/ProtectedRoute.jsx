import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser.js'

export default function ProtectedRoute() {
  const location = useLocation()
  const { user, loading, errorMessage } = useAuthUser()

  if (loading) {
    return <p>Checking authentication...</p>
  }

  if (errorMessage) {
    return <p>{errorMessage}</p>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
