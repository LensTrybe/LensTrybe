import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'

// Forgot and reset, one pane. /forgot-password asks for the email and says it is sent;
// /reset-password?token=... (the link in the email) sets the new one and drops you at log in.
// A reset link without a token is treated as expired and offers a fresh one, the way the live
// site does, so a stale bookmark never shows a dead form.
export default function Reset() {
  const nav = useNavigate(); const { pathname } = useLocation(); const [p] = useSearchParams()
  const cv = useRef(null)
  const setting = pathname === '/reset-password'
  const token = p.get('token') || p.get('token_hash') || ''
  const [mode, setMode] = useState(setting ? (token ? 'set' : 'expired') : 'request')
  const [email, setEmail] = useState(p.get('email') || ''), [pw, setPw] = useState(''), [pw2, setPw2] = useState(''), [show, setShow] = useState(false), [err, setErr] = useState('')
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  useEffect(() => { setMode(setting ? (token ? 'set' : 'expired') : 'request'); setErr('') }, [setting, token])
  const request = e => { e.preventDefault(); if (!/.+@.+\..+/.test(email)) return setErr('A real email, the one you log in with.'); setMode('sent') }
  const save = e => {
    e.preventDefault()
    if (pw.length < 8) return setErr('At least eight characters.')
    if (pw !== pw2) return setErr('The two passwords do not match.')
    setMode('done'); setTimeout(() => nav('/login'), 1800)
  }
  return (
    <section className="hiw login dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="lpane lg d">
        <p className="eb">{mode === 'set' || mode === 'done' ? 'New password' : 'Reset password'}</p>
        {mode === 'request' && <>
          <h1>Forgot <em>it?</em></h1>
          <p className="hint">Type the email you log in with and a reset link is on its way. It works for an hour, once.</p>
          <form onSubmit={request} className="lform">
            <label className="lf"><span>Email</span><input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr('') }} placeholder="you@studio.com.au" autoComplete="email" autoFocus /></label>
            {err && <p className="jerr">{err}</p>}
            <button type="submit" className="btn w lg">Send the link <Icon name="arrow" size={14} /></button>
            <button type="button" className="alt" onClick={() => nav('/login')}>Back to log in</button>
          </form>
        </>}
        {mode === 'sent' && <>
          <h1>Check your <em>inbox.</em></h1>
          <p className="hint">If <b style={{ color: '#fff' }}>{email}</b> has an account, a reset link is there now. No email in a couple of minutes: check spam, or the address might be a different one.</p>
          <div className="lform">
            <button type="button" className="btn w lg" onClick={() => nav('/reset-password?token=demo&email=' + encodeURIComponent(email))}>Open the link (demo) <Icon name="arrow" size={14} /></button>
            <button type="button" className="alt" onClick={() => { setMode('request'); setErr('') }}>Use a different email</button>
            <button type="button" className="alt" onClick={() => setMode('sent')}>Send it again</button>
          </div>
        </>}
        {mode === 'expired' && <>
          <h1>That link has <em>expired.</em></h1>
          <p className="hint">Reset links work for an hour and once. Ask for a new one and use it straight from the email.</p>
          <div className="lform">
            <button type="button" className="btn w lg" onClick={() => nav('/forgot-password')}>Get a new link <Icon name="arrow" size={14} /></button>
            <button type="button" className="alt" onClick={() => nav('/login')}>Back to log in</button>
          </div>
        </>}
        {mode === 'set' && <>
          <h1>Pick a <em>new one.</em></h1>
          <p className="hint">{email ? 'For ' + email + '. ' : ''}Eight characters or more. A sentence you will remember beats a word you will not.</p>
          <form onSubmit={save} className="lform">
            <label className="lf"><span>New password <button type="button" className="forgot" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button></span><input type={show ? 'text' : 'password'} value={pw} onChange={e => { setPw(e.target.value); setErr('') }} placeholder="At least 8 characters" autoComplete="new-password" autoFocus /></label>
            <label className="lf"><span>Confirm it</span><input type={show ? 'text' : 'password'} value={pw2} onChange={e => { setPw2(e.target.value); setErr('') }} placeholder="Same again" autoComplete="new-password" /></label>
            {err && <p className="jerr">{err}</p>}
            <button type="submit" className="btn w lg">Save and log in <Icon name="arrow" size={14} /></button>
          </form>
        </>}
        {mode === 'done' && <>
          <h1>Saved. <em>Logging you in.</em></h1>
          <p className="hint">Your password is updated on every device. Anywhere you were still logged in with the old one has been signed out.</p>
        </>}
        <p className="lfoot">Remembered it? <Link to="/login">Log in</Link>. No account yet? <Link to="/join">Join as a creative</Link>.</p>
      </div>
    </section>
  )
}
