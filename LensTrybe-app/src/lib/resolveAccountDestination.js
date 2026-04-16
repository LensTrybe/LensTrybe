import { supabase } from './supabaseClient'

/**
 * Post-login navigation target.
 * @returns {Promise<string>} path
 */
export async function resolveAccountDestination(userId) {
  if (!supabase || !userId) return '/login'

  const { data: prof } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (prof) return '/dashboard'

  const { data: ca } = await supabase.from('client_accounts').select('id').eq('id', userId).maybeSingle()
  if (ca) return '/client-dashboard'

  return '/dashboard'
}
