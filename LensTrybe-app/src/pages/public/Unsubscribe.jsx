import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { resubscribeToken, unsubscribeToken } from '../../lib/account'

// Email preferences. With a token (the link at the bottom of every newsletter) the address is
// unsubscribed on arrival, no login, with one click to undo. Without one it explains where the
// link is and points logged-in people at settings. A token that fails says so instead of pretending.
export default function Unsubscribe() {
  const { token } = useParams(); const nav = useNavigate()
  const [st, setSt] = useState(token ? 'working' : 'info')
  useEffect(() => { if (!token) return setSt('info'); let on = true; setSt('working'); unsubscribeToken(token).then(() => on && setSt('done')).catch(() => on && setSt('error')); return () => { on = false } }, [token])
  const back = async () => { try { await resubscribeToken(token); setSt('back') } catch { setSt('error') } }
  return (
    <main className="page"><div className="wrap unsw">
      <div className="lg unsc">
        <p className="eb p">Email preferences</p>
        {st === 'working' && <><h1>Unsubscribing<span className="dots" /></h1><p>One moment.</p></>}
        {st === 'done' && <>
          <h1>You're unsubscribed.</h1>
          <p>No more Trybe Edit or LensTrybe news to this address. Emails about your own bookings, quotes, invoices and account still arrive; those are the job, not marketing.</p>
          <div className="row"><button className="btn g" onClick={back}>Unsubscribed by mistake? Put me back</button><Link className="btn p" to="/">Back to LensTrybe <Icon name="arrow" size={14} /></Link></div>
        </>}
        {st === 'back' && <>
          <h1>Welcome back.</h1>
          <p>You're subscribed to The Trybe Edit again. The link at the bottom of any email takes you off it any time, no login needed.</p>
          <div className="row"><Link className="btn p" to="/edit">Read the latest issue <Icon name="arrow" size={14} /></Link><Link className="btn g" to="/">Home</Link></div>
        </>}
        {st === 'error' && <>
          <h1>We couldn't use that link.</h1>
          <p>It may have been used already, or the email client trimmed it. Open the newest email and use the link at the bottom of that one, or log in and turn the newsletter off in settings.</p>
          <div className="row"><Link className="btn p" to="/login">Log in <Icon name="arrow" size={14} /></Link><Link className="btn g" to="/support">Ask support</Link></div>
        </>}
        {st === 'info' && <>
          <h1>Unsubscribe from The Trybe Edit.</h1>
          <p>Every LensTrybe newsletter has an unsubscribe link at the bottom. One click and you're off it straight away, no login. If you have an account, email preferences live in settings too.</p>
          <div className="row"><button className="btn p" onClick={() => nav('/app/settings')}>Manage email preferences <Icon name="arrow" size={14} /></button><Link className="btn g" to="/login">Log in</Link></div>
          <p className="fine">Trying the link from an email and landing here? Open the email again and tap the link itself rather than typing the address; the token on the end is what does the work.</p>
        </>}
      </div>
    </div></main>
  )
}
