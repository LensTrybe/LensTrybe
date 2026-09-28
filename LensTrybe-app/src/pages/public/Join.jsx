import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { checkFoundingCode, createMyAccount, foundingReason, googleNames, isEmail, PASSWORD_MIN, signInWithGoogle, signOut, signUpClient } from '../../lib/auth'
import { useAuth } from '../../backend/AuthContext'
import { LIVE } from '../../lib/mode'
import { outside, waitlistTo } from '../../lib/region'
import { useSite, jobsOpen, untilLabel, jobsPostedRecent } from '../../lib/site'

const WHY = {
  creative: [
    ['Keep every dollar', 'A flat subscription, never a commission. What the client pays is what you get.'],
    ['Three months free', 'Any paid plan. Add a card, pay nothing until month four, cancel before then and pay nothing at all.'],
    ['Clients post the work', 'People who need a photographer or videographer post the job, with the date, place and budget. You reply with a quote.'],
  ],
  client: [
    ['Free, always', 'Clients never pay to enquire, book or message. There is nothing to subscribe to.'],
    ['One link for the whole job', 'Quote, contract, deposit, gallery and messages behind a single link. No login to remember.'],
    ['Only people who are free', 'Every calendar is live. If the date is taken, they do not appear.'],
  ],
}

// Join: the lens, the reasons on the left, one pane of dark glass on the right.
export default function Join() {
  const nav = useNavigate(); const [p] = useSearchParams(); const { pathname, state } = useLocation()
  if (outside()) return <Navigate to={waitlistTo(p.get('as') === 'client' || pathname === '/join/client' ? 'client' : '')} replace />
  const cv = useRef(null)
  const [kind, setKind] = useState(p.get('as') === 'client' || pathname === '/join/client' ? 'client' : 'creative')
  const [code, setCode] = useState(p.get('founding') || p.get('code') ? (p.get('founding') || p.get('code')).toUpperCase() : null)
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('lt_join') || 'null') } catch { return null } })()
  const [f, setF] = useState({ first: saved?.first || '', last: saved?.last || '', email: state?.email || p.get('email') || saved?.email || '', pw: '', disc: saved?.disc || 'Photographer', co: '', news: true }); const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const u = (k, v) => { setF(o => ({ ...o, [k]: v })); setErr('') }
  // arrived from the job form: their job is saved and waiting
  const savedJob = (() => { try { const d = JSON.parse(localStorage.getItem('lt-job-draft') || 'null'); return d?.t && (sessionStorage.getItem('returnTo') || '').startsWith('/jobs') ? d.t : '' } catch { return '' } })()
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  // proof for creatives: real jobs posted, and the launch window where every plan can reply
  const site = useSite(); const win = jobsOpen(site); const [posted, setPosted] = useState(null)
  useEffect(() => { jobsPostedRecent(30).then(setPosted) }, [])
  const go = async e => { e.preventDefault(); if (busy) return
    if (!f.first.trim() || !f.last.trim()) return setErr(kind === 'creative' ? 'Your name, so clients know who they are talking to.' : 'Your name, so creatives know who is asking.')
    if (!isEmail(f.email)) return setErr('A real email, it is how you log in.')
    if (f.pw.length < PASSWORD_MIN) return setErr('A password of at least eight characters.')
    setBusy(true)
    try {
      if (kind !== 'creative') {
        const r = await signUpClient({ first: f.first.trim(), last: f.last.trim(), email: f.email.trim(), password: f.pw, co: f.co.trim(), news: f.news })
        if (r.error) return setErr(r.error)
        return nav(r.needsConfirm ? '/check-email' : '/portal', { replace: true, state: { email: f.email.trim(), as: 'client' } })
      }
      let fc = null
      if (code && code.trim()) { const r = await checkFoundingCode(code); if (!r.valid) return setErr(foundingReason(r.reason)); fc = r }
      const fields = { first: f.first.trim(), last: f.last.trim(), email: f.email.trim(), disc: f.disc }
      try { sessionStorage.setItem('lt_join', JSON.stringify(fields)) } catch { /* ignore */ }
      nav('/onboarding', { state: { ...fields, password: f.pw, news: f.news, code: fc ? fc.code : '', codeTier: fc ? fc.tier : '' } })
    } finally { setBusy(false) }
  }
  const google = async () => { if (code && code.trim()) return setErr('Founding codes use email sign-up. Fill in the form and your code is applied.'); const r = await signInWithGoogle('', kind, f.news); if (r.error) setErr(r.error); else if (!LIVE) nav(kind === 'creative' ? '/onboarding' : '/portal/harper-leo') }
  // back from Google with no LensTrybe account yet (they started from Log in): choose, then it's made
  const auth = useAuth(); const [gBusy, setGBusy] = useState(false)
  const gPending = LIVE && auth.user && !auth.loading && !auth.profile && !auth.clientAccount
  const asClient = async () => {
    if (gBusy) return; setGBusy(true); const { first: gf, last: gl } = googleNames(auth.user)
    const r = await createMyAccount('client', gf, gl, null, false); if (r.error) { setGBusy(false); return setErr(r.error) }
    let rt = ''; try { rt = sessionStorage.getItem('returnTo') || ''; sessionStorage.removeItem('returnTo') } catch { /* ignore */ }
    window.location.replace(window.location.origin + (rt.startsWith('/') && !rt.startsWith('//') && !rt.startsWith('/app') ? rt : '/portal'))
  }
  if (gPending) return (
    <section className="hiw join dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="jgrid">
        <div className="jpitch"><p className="eb">Almost there</p><h1>How will you use <em>LensTrybe?</em></h1><p className="sub">You're signed in with Google as <b style={{ color: '#fff' }}>{auth.user.email}</b>, but there's no LensTrybe account for it yet. Pick one and it's made.</p></div>
        <div className="lpane lg d"><div className="lform">
          <button type="button" className="btn w lg" onClick={() => nav('/onboarding?google=1')}>I'm a creative <Icon name="arrow" size={14} /></button>
          <button type="button" className="btn g lg" disabled={gBusy} onClick={asClient}>{gBusy ? 'One moment' : "I'm hiring"}</button>
          {err && <p className="jerr">{err}</p>}
          <p className="tiny">Creatives pick a plan next (Trybe Free costs nothing). Clients never pay. Wrong Google account? <button type="button" className="forgot" onClick={async () => { await signOut(); nav('/login') }}>Log out</button></p>
        </div></div>
      </div>
    </section>
  )
  return (
    <section className="hiw join dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="jgrid">
        <div className="jpitch">
          <p className="eb">{p.get('founding') ? 'Founding application' : 'Join'}</p>
          {kind === 'client' && savedJob ? <><h1>Your job is saved. <em>One last step.</em></h1>
          <p className="sub">Make your free account and <b style={{ color: '#fff' }}>{savedJob}</b> is ready to post. After you confirm your email, it's one tap from your portal.</p></> : <>
          <h1>{kind === 'creative' ? <>Your work deserves <em>to be seen.</em></> : <>Find the right person, <em>fast.</em></>}</h1>
          <p className="sub">{kind === 'creative' ? 'Photographers and videographers at launch, six more disciplines after. Sign up takes a minute; your profile goes live as soon as it has a photo and a line about you.' : 'A free account keeps every enquiry, quote, contract and gallery in one place, with the job board for when you would rather they come to you. Or skip it: browse everyone and ask without one.'}</p></>}
          <div className="why">{WHY[kind].map(([t, d]) => <div key={t}><i><Icon name="check" size={13} /></i><div><b>{t}</b><span>{d}</span></div></div>)}</div>
          {kind === 'creative' && (win.open || posted >= 5) && <p className="jbnow">{posted >= 5 && <><b>{posted}</b> jobs posted by clients in the last 30 days. </>}{win.open && <>Until {untilLabel(win.until)}, every plan can reply to jobs, including the free one.</>}</p>}
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
            {kind === 'creative' && <label className="lf"><span>What you do</span><div className="lsel"><select value={f.disc} onChange={e => u('disc', e.target.value)}><option>Photographer</option><option>Videographer</option><option>Both</option></select><Icon name="back" size={14} /></div></label>}
            {kind === 'creative' && (code === null
              ? <button type="button" className="alt left" onClick={() => setCode('')}>Have a founding code? <b>Add it</b></button>
              : <label className="lf"><span>Founding code <button type="button" className="forgot" onClick={() => setCode(null)}>Remove</button></span><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="The code from your invite email" autoFocus spellCheck={false} /></label>)}
            <label className="ltick"><input type="checkbox" checked={f.news} onChange={e => u('news', e.target.checked)} /><span>Subscribe me to The Trybe Edit, LensTrybe's monthly read. Unsubscribe any time.</span></label>
            {err && <p className="jerr">{err}</p>}
            <button type="submit" className="btn w lg" disabled={busy} style={busy ? { opacity: .6 } : undefined}>{busy ? 'One moment' : kind === 'creative' ? 'Continue, pick a plan' : 'Create my account'} <Icon name="arrow" size={14} /></button>
            {kind === 'client' && <button type="button" className="alt" onClick={() => nav('/creatives')}>Just browsing? Find a creative without an account</button>}
            <div className="lor"><span>or</span></div>
            <button type="button" className="btn soc" onClick={google}><Icon name="google" size={16} />Continue with Google</button>
          </form>
          <p className="lfoot">{kind === 'client' && <>Free, always: clients never pay to enquire, book or message. </>}By continuing you agree to the <Link to="/legal/terms">terms</Link> and <Link to="/legal/privacy">privacy policy</Link>. Already have an account? <Link to="/login">Log in</Link>.</p>
        </div>
      </div>
    </section>
  )
}
