// What we count, and nothing more (3 Oct 2026).
//
// Two kinds of counting live here:
//
// 1. Vercel Web Analytics custom events, for the funnel: a job posted, an account made, a signup
//    started and finished, a reply to a job, an enquiry sent. Never a name, email, id or free text in
//    the properties; job_posted carries the job type and the state, nothing else. Custom events are a
//    Vercel Pro feature: on Hobby track() still sends, but the dashboard shows nothing until the
//    plan is upgraded. Only the live site counts, never the demo or a ?preview.
//
// 2. profile_views and search_impressions, the rows behind a creative's Insights. Best effort and
//    deduped per browser session, so one visit counts a creative once. A failed insert is not marked
//    as seen, so the next page view tries again. supabase-js returns its errors rather than throwing
//    them, so the result is checked, not caught.
import { track } from '@vercel/analytics'
import { supabase } from '../backend/supabaseClient'
import { LIVE } from './mode'

export const EVENTS = ['job_posted', 'client_account_created', 'creative_signup_started', 'creative_signup_completed', 'creative_applied_to_job', 'enquiry_sent']

export function event(name, props) {
  if (!LIVE || !EVENTS.includes(name)) return
  try { track(name, props) } catch { /* counting never breaks a page */ }
}

// Once per browser session, for the events a reload or a retry could repeat
export function eventOnce(name, props) {
  const k = 'lt_ev_' + name
  try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1') } catch { /* private mode: count it */ }
  event(name, props)
}

const seen = key => { try { return new Set(JSON.parse(sessionStorage.getItem(key) || '[]')) } catch { return new Set() } }
const keep = (key, set) => { try { sessionStorage.setItem(key, JSON.stringify([...set].slice(-500))) } catch { /* ignore */ } }
const isId = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''))
async function me() { try { const { data } = await supabase.auth.getSession(); return data?.session?.user?.id || null } catch { return null } }

// A creative's profile was opened. source: 'profile' (/creatives/:id), 'website' (/p/ and /site/),
// 'ask' (the sheet over the home page results). A creative opening their own profile is not a view.
export async function logProfileView(creativeId, source = 'profile') {
  if (!LIVE || !isId(creativeId)) return
  const s = seen('lt_pv_seen'); if (s.has(creativeId)) return
  const viewer = await me(); if (viewer === creativeId) return
  const { error } = await supabase.from('profile_views').insert({ creative_id: creativeId, viewer_id: viewer, source })
  if (error) { console.warn('[views] not logged', error.code); return }
  s.add(creativeId); keep('lt_pv_seen', s)
}

// Creatives shown in a list: Find a creative, the area pages, the ask's matches
export async function logImpressions(ids) {
  if (!LIVE) return
  const s = seen('lt_imp_seen')
  const viewer = await me()
  const fresh = [...new Set((ids || []).filter(isId))].filter(id => !s.has(id) && id !== viewer)
  if (!fresh.length) return
  const { error } = await supabase.from('search_impressions').insert(fresh.map(id => ({ creative_id: id, viewer_id: viewer })))
  if (error) { console.warn('[impressions] not logged', error.code); return }
  fresh.forEach(id => s.add(id)); keep('lt_imp_seen', s)
}

// A redirect on a landing page (an old address, the area check sending someone to the waitlist)
// happens before the first page view is counted, so it keeps the visit's utm_ tags on the new
// address. Redirects only: ordinary links don't carry them, or one campaign visit would count twice.
export function withUtm(to) {
  let tags = ''
  try { tags = new URLSearchParams([...new URLSearchParams(window.location.search)].filter(([k]) => /^utm_[a-z]+$/.test(k))).toString() } catch { /* no window */ }
  if (!tags) return to
  const [path, hash = ''] = String(to).split('#')
  return path + (path.includes('?') ? '&' : '?') + tags + (hash ? '#' + hash : '')
}
