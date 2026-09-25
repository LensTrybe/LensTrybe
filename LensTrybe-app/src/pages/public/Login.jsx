import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { homeFor, isEmail, signIn, signInWithGoogle, signOut } from '../../lib/auth'
import { useAuth } from '../../backend/AuthContext'
import { LIVE } from '../../lib/mode'

// Log in: the lens behind a single pane of dark glass. Creatives land in the workspace, clients in
// their portal. Live: password or Google, the same two ways as the live site (no magic link there,
// so none here). A wrong email or password sends you to Join with the email carried across, as live.
export default function Login() {
  const nav = useNavigate()
  const cv = useRef(null)
  const [who, setWho] = useState('creative')
  const auth = useAuth(); const already = LIVE && auth.user ? { email: auth.user.email, kind: auth.profile ? 'creative' : auth.clientAccount ? 'client' : null } : null
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [show, setShow] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const next = (() => { try { const n = sessionStorage.getItem('returnTo') || ''; return n.startsWith('/') && !n.startsWith('//') ? n : '' } catch { return '' } })()
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  const go = async e => {
    e.preventDefault(); if (busy) return
    if (LIVE && !isEmail(email)) return setErr('A real email, the one you signed up with.')
    if (LIVE && !pw) return setErr('Your password.')
    setBusy(true); const r = await signIn(email, pw, who); setBusy(false)
    if (r.code === 'invalid') { setErr('No account with that email and password. Taking you to sign up.'); return setTimeout(() => nav('/join', { replace: true, state: { email: email.trim() } }), 1400) }
    if (r.code === 'unconfirmed') { setErr('That email has not been confirmed yet.'); return setTimeout(() => nav('/check-email', { state: { email: email.trim() } }), 1400) }
    if (r.error) return setErr(r.error)
    if (!r.kind) return setErr('That account has no profile yet. Finish signing up first.')
    try { sessionStorage.removeItem('returnTo') } catch { /* ignore */ }
    nav(next || (LIVE ? homeFor(r.kind) : r.kind === 'client' ? '/portal/harper-leo' : '/app'), { replace: true })
  }
  const google = async () => { const r = await signInWithGoogle(next); if (r.error) setErr(r.error); else if (!LIVE) nav(who === 'client' ? '/portal/harper-leo' : '/app') }
  return (
    <section className="hiw login dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="lpane lg d">
        <p className="eb">Log in</p>
        <h1>Welcome <em>back.</em></h1>
        <div className="who" role="tablist" aria-label="I am a">
          <button type="button" role="tab" aria-selected={who === 'creative'} className={who === 'creative' ? 'on' : ''} onClick={() => setWho('creative')}>I'm a creative</button>
          <button type="button" role="tab" aria-selected={who === 'client'} className={who === 'client' ? 'on' : ''} onClick={() => setWho('client')}>I'm a client</button>
        </div>
        <p className="hint">{who === 'creative' ? 'Straight to your workspace: today, threads, money and Lumi.' : 'Straight to your portal: your booking, documents and files, one link.'}</p>
        {already && <div className="lalready"><b>You're already logged in as {already.email}.</b><div><button type="button" className="btn w" onClick={() => nav(homeFor(already.kind))}>{already.kind === 'client' ? 'Open my portal' : 'Open my workspace'} <Icon name="arrow" size={14} /></button><button type="button" className="alt" onClick={async () => { await signOut(); setErr('') }}>Log out and use another account</button></div></div>}
        <form onSubmit={go} className="lform" style={already ? { opacity: .45, pointerEvents: 'none' } : undefined}>
          <label className="lf"><span>Email</span><input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr('') }} placeholder="you@studio.com.au" autoComplete="email" inputMode="email" autoCapitalize="none" /></label>
          <label className="lf"><span>Password <span><button type="button" className="forgot" onClick={() => setShow(v => !v)} style={{ marginRight: 10 }}>{show ? 'Hide' : 'Show'}</button><Link to="/forgot-password" className="forgot">Forgot it?</Link></span></span><input type={show ? 'text' : 'password'} value={pw} onChange={e => { setPw(e.target.value); setErr('') }} placeholder="Your password" autoComplete="current-password" /></label>
          {err && <p className="jerr">{err}</p>}
          <button type="submit" className="btn w lg" disabled={busy} style={busy ? { opacity: .6 } : undefined}>{busy ? 'Logging in' : 'Log in'} <Icon name="arrow" size={14} /></button>
          <div className="lor"><span>or</span></div>
          <button type="button" className="btn soc" onClick={google}><Icon name="google" size={16} />Continue with Google</button>
        </form>
        <p className="lfoot">New here? <Link to="/join">Join as a creative</Link> or <Link to="/join/client">make a client account</Link>.{!LIVE && ' Demo: any details open the preview.'}</p>
      </div>
    </section>
  )
}
