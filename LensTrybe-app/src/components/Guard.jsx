import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../backend/AuthContext'
import { supabase } from '../backend/supabaseClient'
import { LIVE } from '../lib/mode'
import PendingDeletion from '../pages/app/PendingDeletion'

// Route guards for live mode. Demo has nobody signed in and everything open, so the guards pass.
// A signed-out visitor is sent to log in and comes back to where they were afterwards.
function Wait() { return <div className="guardwait" aria-busy="true" /> }
const remember = path => { try { sessionStorage.setItem('returnTo', path) } catch { /* ignore */ } }

export function RequireCreative({ children }) {
  const { user, profile, clientAccount, loading, fetchUserData } = useAuth(); const { pathname } = useLocation()
  // First open of the workspace after signing up: the live site's wizard set onboarded_at and the
  // skills; here the checklist does that job, so mark the profile as onboarded and copy the skills
  // chosen on Join (kept in the auth metadata, which the trigger does not read).
  useEffect(() => {
    if (!LIVE || !profile || profile.onboarded_at) return
    const skills = user?.user_metadata?.skill_types
    const patch = { onboarded_at: new Date().toISOString(), ...(Array.isArray(skills) && skills.length && !(profile.skill_types || []).length ? { skill_types: skills } : {}) }
    supabase.from('profiles').update(patch).eq('id', profile.id).then(() => fetchUserData(profile.id, { silent: true }))
  }, [profile, user, fetchUserData])
  if (!LIVE) return children
  if (loading) return <Wait />
  if (!user) { remember(pathname); return <Navigate to="/login" replace /> }
  if (!profile && clientAccount) return <Navigate to="/portal" replace />
  if (!profile) return <Navigate to="/join" replace />
  if (profile.pending_deletion) return <PendingDeletion />
  return children
}

export function RequireClient({ children }) {
  const { user, profile, clientAccount, loading } = useAuth(); const { pathname } = useLocation()
  if (!LIVE) return children
  if (loading) return <Wait />
  if (!user) { remember(pathname); return <Navigate to="/login" replace /> }
  if (profile && !clientAccount) return <Navigate to="/app/today" replace />
  if (!clientAccount) return <Navigate to="/join/client" replace />
  if (clientAccount.pending_deletion) return <PendingDeletion />
  return children
}
