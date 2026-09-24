import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'

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
  const nav = useNavigate(); const [p] = useSearchParams()
  const cv = useRef(null)
  const [kind, setKind] = useState('creative')
  const [code, setCode] = useState(p.get('founding') ? '' : null)
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  const go = e => { e.preventDefault(); nav(kind === 'creative' ? '/onboarding' : '/creatives') }
  return (
    <section className="hiw join dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="jgrid">
        <div className="jpitch">
          <p className="eb">{p.get('founding') ? 'Founding application' : 'Join'}</p>
          <h1>{kind === 'creative' ? <>Your work deserves <em>to be seen.</em></> : <>Find the right person, <em>fast.</em></>}</h1>
          <p className="sub">{kind === 'creative' ? 'Photographers and videographers at launch, six more disciplines after. Set up takes about ten minutes and you are live the same day.' : 'Say what you need in a sentence, or browse everyone. Booking, signing and paying happen in one thread you can open from any phone.'}</p>
          <div className="why">{WHY[kind].map(([t, d]) => <div key={t}><i><Icon name="check" size={13} /></i><div><b>{t}</b><span>{d}</span></div></div>)}</div>
        </div>
        <div className="lpane lg d">
          <div className="who" role="tablist" aria-label="I am">
            <button type="button" role="tab" aria-selected={kind === 'creative'} className={kind === 'creative' ? 'on' : ''} onClick={() => setKind('creative')}>I'm a creative</button>
            <button type="button" role="tab" aria-selected={kind === 'client'} className={kind === 'client' ? 'on' : ''} onClick={() => setKind('client')}>I'm hiring</button>
          </div>
          <form onSubmit={go} className="lform">
            <div className="two"><label className="lf"><span>First name</span><input placeholder="Mara" autoComplete="given-name" /></label><label className="lf"><span>Last name</span><input placeholder="Okafor" autoComplete="family-name" /></label></div>
            <label className="lf"><span>Email</span><input type="email" placeholder="you@studio.com.au" autoComplete="email" /></label>
            {kind === 'creative' && <label className="lf"><span>What you do</span><div className="lsel"><select defaultValue="Photographer"><option>Photographer</option><option>Videographer</option><option>Both</option></select><Icon name="back" size={14} /></div></label>}
            {kind === 'creative' && (code === null
              ? <button type="button" className="alt left" onClick={() => setCode('')}>Have a founding code? <b>Add it</b></button>
              : <label className="lf"><span>Founding code <button type="button" className="forgot" onClick={() => setCode(null)}>Remove</button></span><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="LT-XXXX-XXXX" autoFocus /></label>)}
            <button type="submit" className="btn w lg">{kind === 'creative' ? 'Create my profile' : 'Start searching'} <Icon name="arrow" size={14} /></button>
            <div className="lor"><span>or</span></div>
            <div className="two"><button type="button" className="btn soc"><Icon name="google" size={16} />Google</button><button type="button" className="btn soc"><Icon name="apple" size={16} />Apple</button></div>
          </form>
          <p className="lfoot">By continuing you agree to the <Link to="/legal/terms">terms</Link> and <Link to="/legal/privacy">privacy policy</Link>. Already have an account? <Link to="/login">Log in</Link>.</p>
        </div>
      </div>
    </section>
  )
}
