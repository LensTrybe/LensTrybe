import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { TokenShell, TokenState, Loading } from './TokenShell'
import { useAuth } from '../../backend/AuthContext'
import { getTeamInvitation, joinTeam } from '../../lib/live'
import { signOut } from '../../lib/auth'

// /team/accept/<token>: someone invited to a studio's team. Signed in as the invited email, one tap
// joins. Otherwise they make their account here (or give the password of the one they already have).
export default function TeamAccept() {
  const { token } = useParams(); const { user } = useAuth()
  const [inv, setInv] = useState(undefined), [f, setF] = useState({ first: '', last: '', business: '', password: '', confirm: '' }), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false)
  useEffect(() => { let on = true; getTeamInvitation(token).then(r => on && setInv(r)).catch(() => on && setInv(null)); return () => { on = false } }, [token])
  if (inv === undefined) return <Loading />
  const studio = { business_name: inv?.business_name || 'A studio' }
  if (!inv || inv.status !== 'pending') return <TokenShell creative={studio} sub="Team invitation"><TokenState kicker="Invitation" title="This invitation can't be used."><p className="sub">It has been used already or was cancelled. Ask the studio to send a new one.</p></TokenState></TokenShell>
  if (inv.expired) return <TokenShell creative={studio} sub="Team invitation"><TokenState kicker="Invitation" title="This invitation has expired."><p className="sub">Invitations last 14 days. Ask the studio to send you a new one.</p></TokenState></TokenShell>
  const signedAs = user?.email ? String(user.email).toLowerCase() : '', matches = signedAs && signedAs === String(inv.email).toLowerCase()
  const u = (k, v) => { setF(x => ({ ...x, [k]: v })); setErr('') }
  const go = async e => {
    e?.preventDefault(); if (busy) return
    if (!matches) { if (!f.first.trim()) return setErr('Add your first name.'); if (f.password.length < 8) return setErr('Your password needs at least 8 characters.'); if (f.password !== f.confirm) return setErr('The two passwords do not match.') }
    setBusy(true); setErr('')
    try { await joinTeam(token, matches ? {} : { ...f, business: f.business.trim() || [f.first, f.last].join(' ').trim() }); setDone(true); setTimeout(() => window.location.assign('/app'), 2000) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  if (done) return <TokenShell creative={studio} sub="Team invitation"><div className="pjob lg tdoc"><div className="tdone"><span className="tick"><Icon name="check" size={16} /></span><div><b>You're on the team.</b><small>Taking you to your workspace.</small></div></div></div></TokenShell>
  return (
    <TokenShell creative={studio} sub="Team invitation">
      <form className="pjob lg tdoc" onSubmit={go}>
        <div className="pjhead"><div><p className="eb g">Team invitation</p><h1>Join {studio.business_name}</h1><p className="sub">You've been invited as {inv.role ? <b>{inv.role}</b> : 'a team member'}. You get your own LensTrybe workspace on Elite, and you show on their team.</p></div></div>
        {signedAs && !matches ? <><p className="fine" style={{ color: 'var(--pink-t)' }}>You're logged in as {signedAs}, but this invitation is for {inv.email}. Log out first, then come back to this link.</p><div className="trow"><button className="btn w" type="button" onClick={async () => { await signOut(); setErr('') }}>Log out</button></div></> : matches ? <p className="fine">Logged in as {signedAs}.</p> : <>
          <div className="field"><label>Email</label><input value={inv.email} disabled /></div>
          <div className="two"><div className="field"><label htmlFor="ta-f">First name</label><input id="ta-f" value={f.first} onChange={e => u('first', e.target.value)} maxLength={80} autoComplete="given-name" /></div><div className="field"><label htmlFor="ta-l">Last name</label><input id="ta-l" value={f.last} onChange={e => u('last', e.target.value)} maxLength={80} autoComplete="family-name" /></div></div>
          <div className="field"><label htmlFor="ta-b">Business name</label><input id="ta-b" value={f.business} onChange={e => u('business', e.target.value)} maxLength={120} placeholder="Optional" /></div>
          <div className="two"><div className="field"><label htmlFor="ta-p">Password</label><input id="ta-p" type="password" value={f.password} onChange={e => u('password', e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></div><div className="field"><label htmlFor="ta-c">Password again</label><input id="ta-c" type="password" value={f.confirm} onChange={e => u('confirm', e.target.value)} autoComplete="new-password" /></div></div>
          <p className="fine">Already have a LensTrybe account with this email? Use its password here and it joins the team.</p>
        </>}
        {err && <p className="fine" style={{ color: 'var(--pink-t)' }}>{err}</p>}
        {!(signedAs && !matches) && <div className="trow"><button className="btn p" type="submit" disabled={busy}>{busy ? 'Joining' : 'Join the team'} <Icon name="arrow" size={14} /></button></div>}
      </form>
    </TokenShell>
  )
}
