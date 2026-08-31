// Lightweight client-side logging of profile views + search impressions.
// Best-effort: failures are swallowed so they never affect the visitor's page.
// Deduped per browser session so a creative isn't counted repeatedly on one visit.
import { supabase } from './supabaseClient'

function sessionSeen(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
function sessionSave(key, set) {
  try { sessionStorage.setItem(key, JSON.stringify([...set].slice(-500))) } catch { /* ignore */ }
}

async function currentUserId() {
  try { const { data } = await supabase.auth.getSession(); return data?.session?.user?.id ?? null } catch { return null }
}

/** Log a single profile view (skips the creative viewing their own profile, and repeat views this session). */
export async function logProfileView(creativeId, source = 'profile') {
  if (!creativeId) return
  const key = 'lt_pv_seen'
  const seen = sessionSeen(key)
  if (seen.has(creativeId)) return
  try {
    const viewerId = await currentUserId()
    if (viewerId && viewerId === creativeId) return
    await supabase.from('profile_views').insert({ creative_id: creativeId, viewer_id: viewerId, source })
    seen.add(creativeId); sessionSave(key, seen)
  } catch { /* best-effort */ }
}

/** Log search/explore impressions for the creatives shown (deduped per session). */
export async function logSearchImpressions(creativeIds) {
  const ids = Array.from(new Set((creativeIds || []).filter(Boolean)))
  if (!ids.length) return
  const key = 'lt_imp_seen'
  const seen = sessionSeen(key)
  const fresh = ids.filter((id) => !seen.has(id))
  if (!fresh.length) return
  try {
    const viewerId = await currentUserId()
    const rows = fresh.filter((id) => id !== viewerId).map((id) => ({ creative_id: id, viewer_id: viewerId }))
    if (rows.length) await supabase.from('search_impressions').insert(rows)
    fresh.forEach((id) => seen.add(id)); sessionSave(key, seen)
  } catch { /* best-effort */ }
}
