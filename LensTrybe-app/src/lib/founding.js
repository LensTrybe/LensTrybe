import { useEffect, useState } from 'react'
import { supabase } from '../backend/supabaseClient'
import { LIVE } from './mode'

// How many of the hundred founding places are taken, from founding_places_used() (a place is taken
// when a code is redeemed). The demo shows a made-up number. null while loading, so a page never
// flashes a wrong count.
let cache = null
export function useFoundingTaken() {
  const [n, setN] = useState(LIVE ? cache : 37)
  useEffect(() => {
    if (!LIVE || cache != null) return
    let on = true
    supabase.rpc('founding_places_used').then(({ data, error }) => { if (!error && typeof data === 'number') { cache = data; if (on) setN(data) } })
    return () => { on = false }
  }, [])
  return n
}
