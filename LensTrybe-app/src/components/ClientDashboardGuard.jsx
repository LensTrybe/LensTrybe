import { Navigate, Outlet } from 'react-router-dom'
import useAccountKind from '../hooks/useAccountKind'

export default function ClientDashboardGuard() {
  const { kind, loading } = useAccountKind()

  if (loading) {
    return (
      <div className="brand-screen-message">
        <p>Checking account…</p>
      </div>
    )
  }

  if (kind === 'creative') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
