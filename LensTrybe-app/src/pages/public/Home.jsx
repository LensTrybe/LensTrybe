import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { outside, waitlistTo } from '../../lib/region'
import { useSite } from '../../lib/site'
import Ask from './Ask'
import Intro from '../../components/Intro'
import ProfilePanel from './ProfilePanel'
import Profile from './Profile'
import { withUtm } from '../../lib/analytics'

// The home page: the ask hero. For the client-first launch (site_settings.home_hero = 'job') the
// sentence becomes a job and leads to the post-a-job form; switching the setting to 'ask' brings
// back the find-a-creative matching without a deploy. A visitor the front door sent to the waitlist (lt-region cookie, no lt-seq)
// gets the waitlist again here too, so the logo and in-app links to / do not slip past the area check.
export default function Home() {
  const [open, setOpen] = useState(null)
  const site = useSite()
  if (outside()) return <Navigate to={withUtm(waitlistTo())} replace />
  if (!site) return <section className="ask dark darkhero" aria-busy="true" style={{ minHeight: '100vh' }} />
  return (
    <>
      <Intro />
      <Ask onOpen={setOpen} jobFirst={site.home_hero !== 'ask'} />
      {/* a real creative opens their profile over the results, so closing it keeps the search */}
      {open?.live ? <Profile slug={open.id} sheet onClose={() => setOpen(null)} /> : <ProfilePanel c={open} onClose={() => setOpen(null)} />}
    </>
  )
}
