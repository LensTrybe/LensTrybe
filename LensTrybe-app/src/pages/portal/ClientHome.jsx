import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { useAuth } from '../../backend/AuthContext'
import { supabase } from '../../backend/supabaseClient'
import { signOut } from '../../lib/auth'
import { LIVE } from '../../lib/mode'
import { loadMyJobs } from '../../lib/live'
import '../../styles/public.css'
import '../../styles/pages.css'

// The client's front door once signed in: every booking as a thread link, and the ask for a new
// one. Each row is a real portal link (my_portals), the same one the emails carry.
export default function ClientHome() {
  const { user, clientAccount } = useAuth(); const nav = useNavigate()
  const [rows, setRows] = useState(null), [jobs, setJobs] = useState([])
  const draft = (() => { try { return JSON.parse(localStorage.getItem('lt-job-draft') || 'null') } catch (_) { return null } })()
  useEffect(() => { if (LIVE && user?.id) loadMyJobs(user.id).then(setJobs).catch(() => {}) }, [user?.id])
  useEffect(() => {
    if (!LIVE) { setRows([{ id: 'harper-leo', title: 'Wedding, Noosa', with: 'Mara Okafor', when: '14 Nov 2026', st: 'Quote accepted' }]); return }
    let on = true
    // one row per creative this client has a thread with; the row opens the same portal link the emails carry
    supabase.rpc('my_portals').then(({ data }) => { if (!on) return; setRows((data || []).map(r => { const nb = r.next_booking; return { id: r.token, title: r.creative?.business_name || 'Your creative', with: nb ? [nb.service, nb.location].filter(Boolean).join(' · ') : r.creative?.city || '', when: nb?.booking_date ? new Date(nb.booking_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '', st: r.open_quotes > 0 ? 'Quote waiting' : nb ? (nb.status || 'Booked') : r.last_message_at ? 'In conversation' : 'Enquiry sent' } })) }).catch(() => on && setRows([]))
    return () => { on = false }
  }, [])
  const first = clientAccount?.first_name || (user?.user_metadata?.first_name) || ''
  return (
    <div className="pub pub-light chome">
      <Aurora />
      <header className="obh"><Link to="/"><Logo height={18} /></Link><button className="btn g" onClick={async () => { await signOut(); nav('/') }}>Log out</button></header>
      <main className="page"><div className="wrap chw">
        <p className="eb g">Your portal</p>
        <h1>{first ? 'Hi ' + first + '.' : 'Hello.'}</h1>
        <p className="sub">Every job you book on LensTrybe lives behind one link: quote, contract, deposit, messages and the gallery when it lands. They are all here.</p>
        <div className="ctas" style={{ margin: '4px 0 22px' }}><Link className="btn p lg" to="/jobs">Post a job <Icon name="arrow" size={14} /></Link></div>
        <div className="lg chlist">
          {rows === null && <p className="fine">Loading your bookings.</p>}
          {rows && rows.length === 0 && <div className="chempty"><b>Nothing booked yet.</b><p>Post what you need and creatives who do that work reply with a real quote.</p><Link className="btn p" to="/jobs">Post a job <Icon name="arrow" size={14} /></Link></div>}
          {rows && rows.map(r => <Link key={r.id} className="chrow" to={'/portal/' + r.id}><div><b>{r.title}</b><span>{[r.with, r.when].filter(Boolean).join(' · ')}</span></div><em>{r.st}</em><Icon name="arrow" size={14} /></Link>)}
        </div>
        {draft?.t && <div className="lg chlist"><Link className="chrow" to="/jobs?resume=1"><div><b>Finish posting: {draft.t}</b><span>You filled this in before logging in. One tap to post it.</span></div><em>Not posted</em><Icon name="arrow" size={14} /></Link></div>}
        {jobs.length > 0 && <><h2 style={{ fontSize: 18, margin: '28px 0 10px' }}>Your jobs</h2><div className="lg chlist">{jobs.map(j => { const n = j.apps.filter(a => !['withdrawn', 'declined'].includes(a.st)).length; return <Link key={j.id} className="chrow" to={'/jobs/' + j.id}><div><b>{j.t}</b><span>{[j.loc, n ? n + (n === 1 ? ' quote' : ' quotes') : 'no quotes yet'].filter(Boolean).join(' · ')}</span></div><em>{{ active: 'Open', filled: 'Booked', closed: 'Taken down', expired: 'Expired' }[j.st] || j.st}</em><Icon name="arrow" size={14} /></Link> })}</div></>}
        <p className="fine">Signed in as {user?.email}. <Link to="/jobs">Post a job</Link> for creatives to come to you, or <Link to="/creatives">browse everyone</Link>.</p>
      </div></main>
    </div>
  )
}
