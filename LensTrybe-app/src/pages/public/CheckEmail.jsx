import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { resendConfirmation } from '../../lib/auth'
import { LIVE } from '../../lib/mode'

// After a signup that needs a confirmed address: one pane, the email it went to, resend, and
// where the confirmation link lands. ?email= says where, ?as=client|creative says who, ?next=
// says where the link takes them (client portal by default for clients, the workspace otherwise).
// The address travels in router state, never the URL, as on the live site.
export default function CheckEmail() {
  const nav = useNavigate(); const [p] = useSearchParams(); const { state } = useLocation()
  const cv = useRef(null)
  const email = state?.email || '', client = (state?.as || p.get('as')) === 'client'
  const next = p.get('next') || (client ? '/portal/harper-leo' : '/app/today?welcome=1')
  const [sent, setSent] = useState(0), [cool, setCool] = useState(0), [err, setErr] = useState('')
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  useEffect(() => { if (!cool) return; const t = setTimeout(() => setCool(c => c - 1), 1000); return () => clearTimeout(t) }, [cool])
  const resend = async () => { if (cool) return; if (!email) return setErr('Go back and enter your email again so we know where to send it.'); const r = await resendConfirmation(email); if (r.error) return setErr(r.error); setErr(''); setSent(s => s + 1); setCool(30) }
  return (
    <section className="hiw login dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="lpane lg d">
        <p className="eb">{client ? 'Client account' : 'Almost there'}</p>
        <h1>Check your <em>inbox.</em></h1>
        <p className="hint">{email ? <>A confirmation link is on its way to <b style={{ color: '#fff' }}>{email}</b>. </> : 'A confirmation link is on its way. '}One tap and {client ? 'you can enquire, book and keep every job in one place.' : 'your workspace opens with the checklist.'} It works for twenty-four hours.</p>
        <div className="lform">
          {!LIVE && <button type="button" className="btn w lg" onClick={() => nav(next)}>Open the link (demo) <Icon name="arrow" size={14} /></button>}
          {err && <p className="jerr">{err}</p>}
          {sent > 0 && <p className="tiny" style={{ color: 'var(--neon-t)' }}>Sent again. Give it a minute to arrive.</p>}
          <button type="button" className="alt" disabled={!!cool} onClick={resend} style={cool ? { opacity: .5 } : undefined}>{cool ? 'Send it again in ' + cool + 's' : "Didn't get it? Send it again"}</button>
          <p className="tiny">Nothing after a few minutes: check spam, or the address might have a typo. <Link to={client ? '/join/client' : '/join'} style={{ color: 'var(--neon-t)', fontWeight: 600 }}>Go back and fix it</Link>.</p>
        </div>
        <p className="lfoot">Already confirmed? <Link to="/login">Log in</Link>. Wrong kind of account? {client ? <Link to="/join">Join as a creative</Link> : <Link to="/join/client">Make a client account</Link>}.</p>
      </div>
    </section>
  )
}
