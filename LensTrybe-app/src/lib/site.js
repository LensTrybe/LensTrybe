// Site-wide switches from the site_settings table, so they change without a deploy:
//   home_hero        'job' (post a job is the home page) or 'ask' (the find-a-creative ask)
//   jobs_open_until  until then every plan, Basic included, can reply to any job anywhere
// Demo mode uses the defaults below. Read once per page load and shared.
import { useEffect, useState } from 'react'
import { supabase } from '../backend/supabaseClient'
import { LIVE } from './mode'

const DEFAULTS = { home_hero: 'job', jobs_open_until: '2027-01-01T00:00:00+10:00' }
let cache = LIVE ? null : DEFAULTS
let pending = null

export function loadSite() {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = supabase.from('site_settings').select('key, value')
      .then(({ data }) => { cache = { ...DEFAULTS }; for (const r of data || []) cache[r.key] = r.value; return cache })
      .catch(() => { cache = { ...DEFAULTS }; return cache })
  }
  return pending
}

// null while loading (live), then the settings
export function useSite() {
  const [s, setS] = useState(cache)
  useEffect(() => { if (!cache) { let on = true; loadSite().then(v => { if (on) setS(v) }); return () => { on = false } } }, [])
  return s
}

// Is the launch window open (every plan replies to every job)? Returns the end date too.
export function jobsOpen(s) {
  const until = s?.jobs_open_until ? new Date(s.jobs_open_until) : null
  return { open: !!until && Date.now() < until.getTime(), until }
}
export const untilLabel = d => d ? new Date(d.getTime() - 1).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' }) : ''

// How many jobs clients posted in the last N days (a count only)
export async function jobsPostedRecent(days = 30) {
  if (!LIVE) return 12
  const { data, error } = await supabase.rpc('jobs_posted_recent', { p_days: days })
  if (error) return null
  return typeof data === 'number' ? data : null
}
