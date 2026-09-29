import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { hq, api, authCall, onSessionProblem } from './api'
import { Overview, Users, Jobs, Support, Moderation, Founding, Broadcasts, Launch, Staff, Activity } from './pages'
import './hq.css'

// LensTrybe HQ (hq.lenstrybe.com), item 19: the staff intranet. For now the admin tools; later
// pay slips, leave and internal jobs. No sign up: an owner invites a person to one email address.
// Signing in needs the password and a code from an authenticator app, every time.

const IDLE_MS = 30 * 60e3
const NAV = [
  ['', 'Overview', 'today', 'support'], ['launch', 'Launch and health', 'shield', 'support'],
  ['users', 'People', 'users', 'support'], ['jobs', 'Job board', 'megaphone', 'support'], ['support', 'Support inbox', 'chat', 'support'],
  ['moderation', 'Moderation', 'eye', 'support'], ['founding', 'Founding', 'star', 'admin'], ['broadcasts', 'Broadcasts', 'bell', 'admin'],
  ['activity', 'Activity log', 'clock', 'admin'], ['staff', 'Staff', 'lock', 'owner'],
]
const RANK = { support: 1, admin: 2, owner: 3 }
export const can = (me, need) => RANK[me?.role] >= RANK[need]

function Frame({ title, sub, children }) {
  return (
    <div className="hq-auth"><div className="hq-authcard">
      <div className="hq-brand"><img src="/logo-white.svg" alt="LensTrybe" /><span>HQ</span></div>
      {title && <h1>{title}</h1>}{sub && <p className="hq-sub">{sub}</p>}
      {children}
    </div><p className="hq-foot">For LensTrybe staff only. Everything done in HQ is recorded.</p></div>
  )
}

function Field({ label, ...p }) { return <label className="hq-field"><span>{label}</span><input {...p} /></label> }

function SignIn({ onDone }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [forgot, setForgot] = useState(false), [sent, setSent] = useState('')
  const go = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await hq.auth.signInWithPassword({ email: email.trim(), password: pw })
    setBusy(false)
    if (error) return setErr(/rate|many/i.test(error.message) ? 'Too many tries. Wait a few minutes.' : 'That email and password don\'t match an HQ login.')
    onDone()
  }
  const reset = async e => { e.preventDefault(); setBusy(true); try { const r = await authCall('forgot', { email }); setSent(r.message) } catch (x) { setErr(x.message) } setBusy(false) }
  if (forgot) return (
    <Frame title="Reset your password" sub="We'll email a link to your HQ address. You'll still need your authenticator code.">
      {sent ? <p className="hq-ok">{sent}</p> : <form onSubmit={reset}><Field label="HQ email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required autoFocus />{err && <p className="hq-err">{err}</p>}<button className="hq-btn w" disabled={busy}>{busy ? 'Sending' : 'Email me a link'}</button></form>}
      <button className="hq-link" onClick={() => { setForgot(false); setSent(''); setErr('') }}>Back to sign in</button>
    </Frame>
  )
  return (
    <Frame title="Sign in" sub="Your HQ login, then the code from your authenticator app.">
      <form onSubmit={go}>
        <Field label="HQ email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        <Field label="Password" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required />
        {err && <p className="hq-err">{err}</p>}
        <button className="hq-btn w" disabled={busy}>{busy ? 'Signing in' : 'Continue'}</button>
      </form>
      <button className="hq-link" onClick={() => setForgot(true)}>Forgot your password?</button>
    </Frame>
  )
}

// Set up the authenticator the first time, or enter today's code.
function TwoFactor({ mode, onDone, onCancel, note }) {
  const [enroll, setEnroll] = useState(null), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [factor, setFactor] = useState(null)
  useEffect(() => {
    let off = false
    ;(async () => {
      const { data } = await hq.auth.mfa.listFactors()
      const verified = (data?.totp || []).filter(f => f.status === 'verified')
      if (verified.length) { if (!off) setFactor(verified[0].id); return }
      // Clear a half-finished setup before starting a new one.
      for (const f of data?.all || []) if (f.status !== 'verified') await hq.auth.mfa.unenroll({ factorId: f.id })
      const { data: en, error } = await hq.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'LensTrybe HQ ' + new Date().toISOString().slice(0, 10), issuer: 'LensTrybe HQ' })
      if (off) return
      if (error) return setErr('Could not start two-factor setup. Refresh and try again.')
      setEnroll(en); setFactor(en.id)
    })()
    return () => { off = true }
  }, [])
  const go = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await hq.auth.mfa.challengeAndVerify({ factorId: factor, code: code.replace(/\s/g, '') })
    setBusy(false)
    if (error) return setErr('That code didn\'t work. Codes change every 30 seconds, so try the current one.')
    onDone()
  }
  const setup = !!enroll
  return (
    <Frame title={setup ? 'Set up two-factor' : 'Enter your code'} sub={note || (setup ? 'Scan this with your authenticator app (Google Authenticator, 1Password, Authy or similar), then enter the 6-digit code it shows.' : 'Open your authenticator app and enter the 6-digit code for LensTrybe HQ.')}>
      {setup && <div className="hq-qr"><img src={enroll.totp.qr_code} alt="Two-factor QR code" /><div><small>Can't scan? Enter this key by hand:</small><code>{enroll.totp.secret}</code></div></div>}
      <form onSubmit={go}>
        <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} value={code} onChange={e => setCode(e.target.value)} required autoFocus />
        {err && <p className="hq-err">{err}</p>}
        <button className="hq-btn w" disabled={busy || !factor}>{busy ? 'Checking' : mode === 'reset' ? 'Continue' : 'Sign in'}</button>
      </form>
      <button className="hq-link" onClick={onCancel}>Use a different login</button>
    </Frame>
  )
}

// /invite#t=… : choose a password for the invited address, then two-factor.
function Invite({ onSignedIn }) {
  const nav = useNavigate()
  const t = decodeURIComponent((location.hash.match(/t=([^&]+)/) || [])[1] || '')
  const [inv, setInv] = useState(null), [err, setErr] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (!t) { setErr('This link is missing its code. Open it straight from the email.'); return } authCall('invite_check', { token: t }).then(setInv).catch(e => setErr(e.message)) }, [t])
  const go = async e => {
    e.preventDefault(); setErr('')
    if (pw.length < 12) return setErr('Use at least 12 characters.')
    if (pw !== pw2) return setErr('The two passwords don\'t match.')
    setBusy(true)
    try {
      await authCall('invite_accept', { token: t, password: pw })
      history.replaceState(null, '', location.pathname)
      const { error } = await hq.auth.signInWithPassword({ email: inv.email, password: pw })
      if (error) { setBusy(false); nav('/'); return }
      onSignedIn()
    } catch (x) { setErr(x.message); setBusy(false) }
  }
  if (!inv) return <Frame title="Your HQ invite">{err ? <p className="hq-err">{err}</p> : <p className="hq-sub">Checking your invite</p>}</Frame>
  return (
    <Frame title={`Welcome, ${inv.name.split(' ')[0]}`} sub={`Choose a password for ${inv.email}. Next you'll set up two-factor, so have your authenticator app ready.`}>
      <form onSubmit={go}>
        <Field label="Password (12 characters or more)" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" required autoFocus />
        <Field label="Same password again" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" required />
        {err && <p className="hq-err">{err}</p>}
        <button className="hq-btn w" disabled={busy}>{busy ? 'Setting up' : 'Set my password'}</button>
      </form>
    </Frame>
  )
}

// /reset#t=… : the emailed reset link. The code from the app is still needed before the password changes.
function Reset({ onDone }) {
  const [stage, setStage] = useState('check'), [err, setErr] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    const t = decodeURIComponent((location.hash.match(/t=([^&]+)/) || [])[1] || '')
    history.replaceState(null, '', location.pathname)
    if (!t) { setErr('This link is missing its code.'); return }
    hq.auth.verifyOtp({ token_hash: t, type: 'recovery' }).then(({ error }) => { if (error) setErr('This reset link has expired or was already used. Ask for a new one.'); else setStage('code') })
  }, [])
  const save = async e => {
    e.preventDefault(); setErr('')
    if (pw.length < 12) return setErr('Use at least 12 characters.')
    if (pw !== pw2) return setErr('The two passwords don\'t match.')
    setBusy(true)
    const { error } = await hq.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr('Could not save the new password: ' + error.message)
    onDone()
  }
  if (err) return <Frame title="Reset your password"><p className="hq-err">{err}</p><a className="hq-link" href="/">Back to sign in</a></Frame>
  if (stage === 'check') return <Frame title="Reset your password"><p className="hq-sub">Checking your link</p></Frame>
  if (stage === 'code') return <TwoFactor mode="reset" note="First, the code from your authenticator app." onDone={() => setStage('pw')} onCancel={() => hq.auth.signOut().then(() => location.assign('/'))} />
  return (
    <Frame title="Choose a new password">
      <form onSubmit={save}>
        <Field label="New password (12 characters or more)" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" required autoFocus />
        <Field label="Same password again" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" required />
        {err && <p className="hq-err">{err}</p>}
        <button className="hq-btn w" disabled={busy}>{busy ? 'Saving' : 'Save and sign in'}</button>
      </form>
    </Frame>
  )
}

export default function HqApp() {
  const { pathname } = useLocation(); const nav = useNavigate()
  // stage: loading | out | twofactor | in
  const [stage, setStage] = useState('loading'), [me, setMe] = useState(null), [note, setNote] = useState(''), [menu, setMenu] = useState(false)
  const lastUse = useRef(Date.now())
  useEffect(() => {
    document.title = 'LensTrybe HQ'
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m)
  }, [])

  const decide = useCallback(async () => {
    if (!hq) { setStage('out'); return }
    const { data: { session } } = await hq.auth.getSession()
    if (!session) { setStage('out'); return }
    // Only a login made by an HQ invite can go further. A creative or client login is turned
    // away here, before it is asked to set up two-factor on the wrong account.
    if (session.user?.app_metadata?.hq_staff !== true) { await hq.auth.signOut(); setNote('That login isn\'t a LensTrybe HQ login.'); setStage('out'); return }
    const { data: aal } = await hq.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel !== 'aal2') { setStage('twofactor'); return }
    try { const r = await api('me'); setMe(r.me); setStage('in') } catch { /* onSessionProblem decides */ }
  }, [])

  const signOut = useCallback(async why => { await hq?.auth.signOut(); setMe(null); setNote(why || ''); setStage('out'); nav('/') }, [nav])
  useEffect(() => {
    onSessionProblem(code => {
      if (code === 'signed_out' || code === 'not_staff') signOut(code === 'not_staff' ? 'That login isn\'t active LensTrybe HQ staff.' : 'Please sign in again.')
      else { setNote(code === 'session_idle' ? 'You were away for a while. Enter your code to carry on.' : code === 'session_expired' ? 'It\'s been 12 hours. Enter your code to carry on.' : ''); setStage('twofactor') }
    })
  }, [signOut])
  useEffect(() => { if (pathname !== '/invite' && pathname !== '/reset') decide() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Idle: 30 minutes with no use signs the page out of HQ (the server enforces it too).
  useEffect(() => {
    if (stage !== 'in') return
    const touch = () => { lastUse.current = Date.now() }
    const evs = ['pointerdown', 'keydown', 'scroll']
    evs.forEach(e => addEventListener(e, touch, { passive: true }))
    const t = setInterval(() => {
      const idle = Date.now() - lastUse.current
      if (idle > IDLE_MS) signOut('Signed out after 30 minutes without use.')
      else if (idle < 5 * 60e3) api('ping', { active: true }).catch(() => {})
    }, 4 * 60e3)
    return () => { evs.forEach(e => removeEventListener(e, touch)); clearInterval(t) }
  }, [stage, signOut])
  useEffect(() => { setMenu(false) }, [pathname])

  if (pathname === '/invite' && stage !== 'in' && stage !== 'twofactor') return <Invite onSignedIn={() => { nav('/', { replace: true }); decide() }} />
  if (pathname === '/reset' && stage !== 'in') return <Reset onDone={() => { nav('/', { replace: true }); decide() }} />
  if (stage === 'loading') return <div className="hq-auth"><div className="hq-spin" /></div>
  if (stage === 'out') return <>{note && <div className="hq-banner">{note}</div>}<SignIn onDone={decide} /></>
  if (stage === 'twofactor') return <TwoFactor note={note} onDone={() => { setNote(''); decide() }} onCancel={() => signOut()} />

  const items = NAV.filter(n => can(me, n[3]))
  return (
    <div className={'hq' + (menu ? ' menu' : '')}>
      <aside className="hq-side">
        <div className="hq-brand"><img src="/logo-white.svg" alt="LensTrybe" /><span>HQ</span></div>
        <nav>{items.map(([p, l, ic]) => <NavLink key={p} to={'/' + p} end={p === ''}><Icon name={ic} size={16} />{l}</NavLink>)}</nav>
        <div className="hq-me"><b>{me.name}</b><small>{me.role === 'owner' ? 'Owner' : me.role === 'admin' ? 'Admin' : 'Support'} · {me.email}</small><button className="hq-btn g sm" onClick={() => signOut('Signed out.')}><Icon name="out" size={14} />Sign out</button></div>
      </aside>
      <div className="hq-top"><button className="hq-burger" aria-label="Menu" onClick={() => setMenu(m => !m)}><Icon name="menu" size={18} /></button><div className="hq-brand"><img src="/logo-white.svg" alt="LensTrybe" /><span>HQ</span></div></div>
      <main className="hq-main">
        <Routes>
          <Route path="/" element={<Overview me={me} />} />
          <Route path="/launch" element={<Launch me={me} />} />
          <Route path="/users" element={<Users me={me} />} />
          <Route path="/jobs" element={<Jobs me={me} />} />
          <Route path="/support" element={<Support me={me} />} />
          <Route path="/moderation" element={<Moderation me={me} />} />
          {can(me, 'admin') && <Route path="/founding" element={<Founding me={me} />} />}
          {can(me, 'admin') && <Route path="/broadcasts" element={<Broadcasts me={me} />} />}
          {can(me, 'admin') && <Route path="/activity" element={<Activity me={me} />} />}
          {can(me, 'owner') && <Route path="/staff" element={<Staff me={me} />} />}
          <Route path="*" element={<div className="hq-empty">Nothing here. <NavLink to="/">Back to Overview</NavLink></div>} />
        </Routes>
      </main>
    </div>
  )
}
