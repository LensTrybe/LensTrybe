import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

export default function DashboardPage() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <p>Welcome to your dashboard</p>
      <button type="button" onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  )
}
