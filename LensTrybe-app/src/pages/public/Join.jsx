import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { outside, waitlistTo } from '../../lib/region'

const WHY = {
  creative: [
    ['Keep every dollar', 'A flat subscription, never a commission. What the client pays is what you get.'],
    ['Three months free', 'Any paid plan. Add a card, pay nothing until month four, cancel before then and pay nothing at all.'],
    ['Found by the ask', 'Clients say what they need in a sentence. If you fit and you are free, you appear.'],
  ],
  client: [
    ['Free, always', 'Clients never pay to enquire, book or message. There is nothing to subscribe to.'],
    ['One link for the whole job', 'Quote, contract, deposit, gallery and messages behind a single link. No login to remember.'],
    ['Only people who are free', 'Every calendar is live. If the date is taken, they do not appear.'],
  ],
}

// Join: the lens, the reasons on the left, one pane of dark glass on the right.
export default function Join() {
  const nav = useNavigate(); const [p] = useSearchParams(); const { pathname } = useLocation()
  if (outside()) return <Navigate to={waitlistTo(p.get('as') === 'client' || pathname === '/join/client' ? 'client' : '')} replace />
  const cv = useRef(null)
  const [kind, setKind] = useState(p.get('as') === 'client' || pathname === '/join/client' ? 'client' : 'creative')
  const [code, setCode] = useState(p.get('founding') || p.get('code') ? (p.get('founding') || p.get('code')).toUpperCase() : null)
  const [f, setF] = useState({ first: '', last: '', email: '', pw: '', disc: 'Photographer', co: '', news: true }); const [err, setErr] = useState('')
  const u = (k, v) => { setF(o => ({ ...o, [k]: v })); setErr('') }
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  const go = e => { e.preventDefault()
    if (!f.first.trim() || !f.last.trim()) return setErr(kind === 'creative' ? 'Your name, so clients know who they are talking to.' : 'Your name, so creatives know who is asking.')
    if (!/.+@.+\..+/.test(f.email)) return setErr('A real email, it is how you log in.')
    if (f.pw.length < 8) return setErr('A password of at least eight characters.')
    if (kind !== 'creative') return nav('/check-email?' + new URLSearchParams({ as: 'client', email: f.email.trim() }))
    if (code && code.trim() && !/^LT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim())) return setErr('That code does not look right. They read LT-XXXX-XXXX.')
    const q = new URLSearchParams({ first: f.first.trim(), last: f.last.trim(), email: f.email.trim(), disc: f.disc, ...(code && code.trim() ? { code: code.trim() } : {}) }); nav('/onboarding?' + q) }
  return (
    <section className="hiw join dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="jgrid">
        <div className="jpitch">
          <p className="eb">{p.get('founding') ? 'Founding application' : 'Join'}</p>
          <h1>{kind === 'creative' ? <>Your work deserves <em>to be seen.</em></> : <>Find the right person, <em>fast.</em></>}</h1>
          <p className="sub">{kind === 'creative' ? 'Photographers and videographers at launch, six more disciplines after. Sign up takes a minute; your profile goes live as soon as it has a photo and a line about you.' : 'A free account keeps every enquiry, quote, contract and gallery in one place, with the job board for when you would rather they come to you. Or skip it: browse everyone and ask without one.'}</p>
          <div className="why">{WHY[kind].map(([t, d]) => <div key={t}><i><Icon name="check" size={13} /></i><div><b>{t}</b><span>{d}</span></div></div>)}</div>
        </div>
        <div className="lpane lg d">
          <div className="who" role="tablist" aria-label="I am">
            <button type="button" role="tab" aria-selected={kind === 'creative'} className={kind === 'creative' ? 'on' : ''} onClick={() => setKind('creative')}>I'm a creative</button>
            <button type="button" role="tab" aria-selected={kind === 'client'} className={kind === 'client' ? 'on' : ''} onClick={() => setKind('client')}>I'm hiring</button>
          </div>
          <form onSubmit={go} className="lform">
            <div className="two"><label className="lf"><span>First name</span><input value={f.first} onChange={e => u('first', e.target.value)} placeholder="Mara" autoComplete="given-name" /></label><label className="lf"><span>Last name</span><input value={f.last} onChange={e => u('last', e.target.value)} placeholder="Okafor" autoComplete="family-name" /></label></div>
            <div className="two"><label className="lf"><span>Email</span><input type="email" value={f.email} onChange={e => u('email', e.target.value)} placeholder="you@studio.com.au" autoComplete="email" /></label><label className="lf"><span>Password</span><input type="password" value={f.pw} onChange={e => u('pw', e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /></label></div>
            {kind === 'client' && <label className="lf"><span>Company <em className="opt">optional</em></span><input value={f.co} onChange={e => u('co', e.target.value)} placeholder="Your business, if it is for one" autoComplete="organization" /></label>}
            {kind === 'client' && <label className="ltick"><input type="checkbox" checked={f.news} onChange={e => u('news', e.target.checked)} /><span>Send me The Trybe Edit and the occasional LensTrybe note. Unsubscribe any time.</span></label>}
            {kind === 'creative' && <label className="lf"><span>What you do</span><div className="lsel"><select value={f.disc} onChange={e => u('disc', e.target.value)}><option>Photographer</option><option>Videographer</option><option>Both</option></select><Icon name="back" size={14} /></div></label>}
            {kind === 'creative' && (code === null
              ? <button type="button" className="alt left" onClick={() => setCode('')}>Have a founding code? <b>Add it</b></button>
              : <label className="lf"><span>Founding code <button type="button" className="forgot" onClick={() => setCode(null)}>Remove</button></span><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="LT-XXXX-XXXX" autoFocus /></label>)}
            {err && <p className="jerr">{err}</p>}
            <button type="submit" className="btn w lg">{kind === 'creative' ? 'Continue, pick a plan' : 'Create my account'} <Icon name="arrow" size={14} /></button>
            {kind === 'client' && <button type="button" className="alt" onClick={() => nav('/creatives')}>Just browsing? Find a creative without an account</button>}
            <div className="lor"><span>or</span></div>
            <div className="two"><button type="button" className="btn soc"><Icon name="google" size={16} />Google</button><button type="button" className="btn soc"><Icon name="apple" size={16} />Apple</button></div>
          </form>
          <p className="lfoot">{kind === 'client' && <>Free, always: clients never pay to enquire, book or message. </>}By continuing you agree to the <Link to="/legal/terms">terms</Link> and <Link to="/legal/privacy">privacy policy</Link>. Already have an account? <Link to="/login">Log in</Link>.</p>
        </div>
      </div>
    </section>
  )
}
