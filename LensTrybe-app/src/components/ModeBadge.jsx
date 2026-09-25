import { useEffect, useState } from 'react'
import { MODE, LIVE } from '../lib/mode'
import { supabase } from '../backend/supabaseClient'

// A small pill in the bottom-left corner saying which build this is: DEMO (sample store) or
// LIVE (real project, and whether it answered). Only until launch; it is how anyone looking at
// next.lenstrybe.com can tell what they are looking at without asking. Click it to hide it.
let once = null
export default function ModeBadge() {
  const [st, setSt] = useState(LIVE ? 'checking' : 'demo'), [hide, setHide] = useState(false)
  useEffect(() => {
    if (!LIVE) return
    let on = true
    // one real, anonymous, read-only call so "connected" means the project answered
    once = once || Promise.all([supabase.auth.getSession(), supabase.rpc('founding_places_used')])
    once.then(([{ data }, r]) => { if (on) setSt(r.error ? 'error' : data?.session ? 'signed-in' : 'ok') }).catch(() => on && setSt('error'))
    return () => { on = false }
  }, [])
  if (hide) return null
  const label = MODE === 'demo' ? 'Demo' : st === 'checking' ? 'Live · connecting' : st === 'error' ? 'Live · no answer' : st === 'signed-in' ? 'Live · signed in' : 'Live · connected'
  return <button type="button" className={'modebadge ' + MODE + ' ' + st} onClick={() => setHide(true)} title="Which build this is. Click to hide.">{label}</button>
}
