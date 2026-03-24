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
