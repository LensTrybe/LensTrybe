import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'

// Log in: the lens behind a single pane of dark glass. Creatives land in the workspace, clients in their portal.
export default function Login() {
  const nav = useNavigate()
  const cv = useRef(null)
  const [who, setWho] = useState('creative')
  const [magic, setMagic] = useState(false)
  const [email, setEmail] = useState('')
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  const go = e => { e.preventDefault(); nav(who === 'creative' ? '/app' : '/portal/harper-leo') }
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
        {!magic ? (
          <form onSubmit={go} className="lform">
            <label className="lf"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com.au" autoComplete="email" /></label>
            <label className="lf"><span>Password <Link to="/login" className="forgot" onClick={e => { e.preventDefault(); setMagic(true) }}>Forgot it?</Link></span><input type="password" placeholder="••••••••" autoComplete="current-password" /></label>
            <button type="submit" className="btn w lg">Log in <Icon name="arrow" size={14} /></button>
            <button type="button" className="alt" onClick={() => setMagic(true)}>Email me a magic link instead</button>
          </form>
        ) : (
          <form onSubmit={e => { e.preventDefault(); nav(who === 'creative' ? '/app' : '/portal/harper-leo') }} className="lform">
            <label className="lf"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com.au" autoComplete="email" autoFocus /></label>
            <button type="submit" className="btn w lg">Send me a link <Icon name="arrow" size={14} /></button>
            <p className="tiny">One tap in the email and you're in. The link works for ten minutes.</p>
            <button type="button" className="alt" onClick={() => setMagic(false)}>Use a password instead</button>
          </form>
        )}
        <p className="lfoot">New here? <Link to="/join">Join as a creative</Link> or <Link to="/join">book as a client</Link>. Demo mode: any details open the preview.</p>
      </div>
    </section>
  )
}
