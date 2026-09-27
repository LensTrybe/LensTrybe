import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { outside, waitlistTo } from '../../lib/region'
import { useSite } from '../../lib/site'
import Ask from './Ask'
import ProfilePanel from './ProfilePanel'

// The home page: the ask hero. For the client-first launch (site_settings.home_hero = 'job') the
// sentence becomes a job and leads to the post-a-job form; switching the setting to 'ask' brings
// back the find-a-creative matching without a deploy. A visitor the front door sent to the waitlist (lt-region cookie, no lt-seq)
// gets the waitlist again here too, so the logo and in-app links to / do not slip past the area check.
export default function Home() {
  const [open, setOpen] = useState(null)
  const site = useSite()
  if (outside()) return <Navigate to={waitlistTo()} replace />
  if (!site) return <section className="ask dark darkhero" aria-busy="true" style={{ minHeight: '100vh' }} />
  return (
    <>
      <Ask onOpen={setOpen} jobFirst={site.home_hero !== 'ask'} />
      <ProfilePanel c={open} onClose={() => setOpen(null)} />
    </>
  )
}
