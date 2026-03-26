import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser.js'

export default function ProtectedRoute() {
  const location = useLocation()
  const { user, loading, errorMessage } = useAuthUser()

  if (loading) {
    return (
      <div className="brand-screen-message">
        <p>Checking authentication...</p>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="brand-screen-message">
        <p className="brand-screen-message__error">{errorMessage}</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
