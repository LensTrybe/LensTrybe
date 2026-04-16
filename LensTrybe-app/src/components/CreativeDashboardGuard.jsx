import { Navigate, Outlet } from 'react-router-dom'
import useAccountKind from '../hooks/useAccountKind'

export default function CreativeDashboardGuard() {
  const { kind, loading } = useAccountKind()

  if (loading) {
    return (
      <div className="brand-screen-message">
        <p>Checking account…</p>
      </div>
    )
  }

  if (kind === 'client') {
    return <Navigate to="/client-dashboard" replace />
  }

  return <Outlet />
}
