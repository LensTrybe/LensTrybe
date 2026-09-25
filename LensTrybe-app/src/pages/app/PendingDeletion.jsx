import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { useAuth } from '../../backend/AuthContext'
import { accountAction, downloadMyData, formatDeletionDate } from '../../lib/account'
import { signOut } from '../../lib/auth'
import '../../styles/public.css'
import '../../styles/pages.css'

// Shown instead of the workspace or portal while an account is inside its deletion grace period:
// the date, Reactivate (everything comes back as it was), download the data, or log out.
export default function PendingDeletion() {
  const { profile, clientAccount, fetchUserData, user } = useAuth(); const nav = useNavigate()
  const creative = !!profile, when = profile?.deletion_scheduled_at || clientAccount?.deletion_scheduled_at
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ok, setOk] = useState('')
  const reactivate = async () => { setBusy(true); setErr(''); try { await accountAction('reactivate'); await fetchUserData(user.id); nav(creative ? '/app/today' : '/portal', { replace: true }) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const download = async () => { setBusy(true); setErr(''); setOk(''); try { await downloadMyData(); setOk('Your download has started.') } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <div className="pub pub-light chome">
      <Aurora />
      <header className="obh"><Link to="/"><Logo height={18} /></Link><button className="btn g" onClick={async () => { await signOut(); nav('/') }}>Log out</button></header>
      <main className="page"><div className="wrap chw">
        <p className="eb p">Account scheduled for deletion</p>
        <h1>Still here, <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-3)' }}>for now.</em></h1>
        <p className="sub">This account is set to be permanently deleted on <b>{formatDeletionDate(when) || 'the end of the grace period'}</b>. {creative ? 'Your profile is hidden and your paid plan has been cancelled.' : ''} Reactivate now and everything is exactly as you left it.</p>
        <div className="lg chlist"><div className="chempty">
          <b>Change your mind?</b>
          <p>{creative ? 'Reactivate before your paid period ends and your plan carries on as normal. After that you are on Basic and can pick a plan again from Settings.' : 'Your bookings, messages and saved creatives all come back.'}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="btn p" onClick={reactivate} disabled={busy}>{busy ? 'One moment' : 'Reactivate my account'} <Icon name="arrow" size={14} /></button><button className="btn g" onClick={download} disabled={busy}>Download my data</button></div>
          {err && <p className="fine" style={{ color: 'var(--pink-t)' }}>{err}</p>}{ok && <p className="fine" style={{ color: 'var(--green-t)' }}>{ok}</p>}
        </div></div>
        <p className="fine">Signed in as {user?.email}. Questions? <Link to="/support">Support</Link> can help before the date.</p>
      </div></main>
    </div>
  )
}
