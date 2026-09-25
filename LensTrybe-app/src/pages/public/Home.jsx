import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { inSEQ, isOutside, regionCookie } from '../../lib/region'
import Ask from './Ask'
import ProfilePanel from './ProfilePanel'

// The home page is the ask. Everything else lives on How it works. A visitor the front door sent
// to the waitlist (lt-region cookie, no lt-seq) gets the waitlist again here too, so the logo and
// in-app links to / do not slip past the area check.
export default function Home() {
  const [open, setOpen] = useState(null)
  const region = regionCookie()
  if (!inSEQ() && isOutside(region)) return <Navigate to={'/waitlist?region=' + encodeURIComponent(region)} replace />
  return (
    <>
      <Ask onOpen={setOpen} />
      <ProfilePanel c={open} onClose={() => setOpen(null)} />
    </>
  )
}
