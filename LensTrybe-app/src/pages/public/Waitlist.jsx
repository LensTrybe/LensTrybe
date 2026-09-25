import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { STATE_OF, claimSEQ, inSEQ, isOutside, regionCookie, regionName } from '../../lib/region'

// The waitlist, two jobs. Before 1 October it is the pre-launch page for South East Queensland:
// a countdown, one pane to leave an email, a share link afterwards; once the date passes it sends
// people to Join. For everyone outside the south east (the front door, middleware.js, sends them
// here with ?region=) it is the list for their area, open until that area launches: the copy
// names the place, the state is preselected, and a link lets anyone the geo got wrong through.
import { LAUNCH_DATE } from '../../backend/launch'
export const LAUNCH = LAUNCH_DATE
const STATES = ['QLD', 'NSW', 'VIC', 'ACT', 'SA', 'WA', 'TAS', 'NT']
const DISC = ['Photographer', 'Videographer', 'Both', 'Drone operator', 'Editor', 'Content creator']
const WHY = {
  creative: [['Three months free', 'Every creative who joins from the waitlist gets three months of any paid plan free, and a code that skips the queue.'], ['Zero commission', 'A flat subscription. What the client pays is what you get.'], ['First in the directory', 'The first profiles live are the ones clients see first.']],
  client: [['Free, always', 'Clients never pay to enquire, book or message.'], ['Only people who are free', 'Every calendar is live. If the date is taken, they do not appear.'], ['One link for the job', 'Quote, contract, deposit, gallery and messages behind a single link.']],
}
const two = n => String(n).padStart(2, '0')

export default function Waitlist() {
  const nav = useNavigate(); const [p] = useSearchParams()
  const cv = useRef(null)
  const [now, setNow] = useState(() => Date.now())
  const [who, setWho] = useState(p.get('as') === 'client' ? 'client' : 'creative')
  const region = (p.get('region') || (!inSEQ() ? regionCookie() : '') || '').toUpperCase(), outside = isOutside(region), place = regionName(region)
  const [f, setF] = useState({ email: '', disc: '', st: STATE_OF[region] || '', ref: (p.get('ref') || '').toUpperCase() }), [err, setErr] = useState(''), [done, setDone] = useState(null), [copied, setCopied] = useState(false)
  const u = (k, v) => { setF(o => ({ ...o, [k]: v })); setErr('') }
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = LAUNCH - now, open = ms <= 0 && !outside
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60
  const go = e => {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setErr('A real email, that is where the invite goes.')
    if (f.ref && !/^[A-Z0-9-]{4,14}$/.test(f.ref)) return setErr('That code does not look right. Leave it out if unsure.')
    const code = 'LT-' + f.email.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4).padEnd(4, 'X') + '-' + String(1000 + (f.email.length * 37) % 9000)
    setDone({ email: f.email.trim(), code, pos: 1180 + (f.email.length * 13) % 400 })
  }
  const share = () => { const url = location.origin + '/waitlist?ref=' + done.code; navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }) }
  return (
    <section className="hiw join wl dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="jgrid">
        <div className="jpitch">
          <p className="eb">{open ? 'We are open' : outside ? 'Opening area by area' : 'Launching 1 October 2026'}</p>
          <h1>{open ? <>The doors <em>are open.</em></> : outside ? (region === 'INTL' ? <>Australia first, <em>then the world.</em></> : <>{place[0].toUpperCase() + place.slice(1)}, <em>we are coming.</em></>) : who === 'creative' ? <>Your work deserves <em>to be seen.</em></> : <>The right person, <em>found in a sentence.</em></>}</h1>
          <p className="sub">{open ? 'LensTrybe is live on the east coast, starting in South East Queensland. Creatives join in a minute; clients search free.' : outside ? (region === 'INTL' ? 'LensTrybe is coming. A home for photographers and videographers where you keep everything you earn, and the ask brings clients to you. Australia first, your country after. Leave an email and you are first through the door when we open where you are, with three months free on any paid plan.' : 'LensTrybe is coming to ' + place + '. A home for photographers and videographers where you keep everything you earn, and the ask brings clients to you. Leave an email: you are first through the door when we open near you, with three months free on any paid plan.') : 'A home for Australian photographers and videographers where you keep everything you earn. Leave an email and you are first through the door, with three months free on any paid plan.'}</p>
          {!open && !outside && <div className="wlcount" aria-label="Time until launch">{[[d, 'days'], [h, 'hours'], [m, 'min'], [s, 'sec']].map(([v, l]) => <div key={l}><b>{two(v)}</b><span>{l}</span></div>)}</div>}
          <div className="why">{WHY[who].map(([t, d]) => <div key={t}><i><Icon name="check" size={13} /></i><div><b>{t}</b><span>{d}</span></div></div>)}</div>
        </div>
        <div className="lpane lg d">
          {open ? <>
            <p className="eb">Waitlist closed</p><h1>Come <em>on in.</em></h1>
            <p className="hint">The waitlist did its job. Everyone on it has their code by email; three months free applies to every creative for the first month anyway.</p>
            <div className="lform"><Link className="btn w lg" to="/join">Join as a creative <Icon name="arrow" size={14} /></Link><Link className="btn soc" to="/creatives">Find a creative</Link></div>
          </> : done ? <>
            <p className="eb">You are on the list</p><h1>Number <em>{done.pos.toLocaleString()}.</em></h1>
            <p className="hint">{outside ? <>You are on the {place} list. An email lands at <b style={{ color: '#fff' }}>{done.email}</b> the day it opens, with your code. Every creative who joins from your link brings that day closer.</> : <>An invite lands at <b style={{ color: '#fff' }}>{done.email}</b> on launch morning with your code. Every friend who joins from your link moves you up fifty places.</>}</p>
            <div className="lform">
              <label className="lf"><span>Your code</span><input readOnly value={done.code} onFocus={e => e.target.select()} /></label>
              <button type="button" className="btn w lg" onClick={share}>{copied ? 'Copied' : 'Copy my invite link'} <Icon name="arrow" size={14} /></button>
              <button type="button" className="alt" onClick={() => { setDone(null); setF({ email: '', disc: '', st: '', ref: '' }) }}>Add another email</button>
            </div>
          </> : <>
            <div className="who" role="tablist" aria-label="I am">
              <button type="button" role="tab" aria-selected={who === 'creative'} className={who === 'creative' ? 'on' : ''} onClick={() => setWho('creative')}>I'm a creative</button>
              <button type="button" role="tab" aria-selected={who === 'client'} className={who === 'client' ? 'on' : ''} onClick={() => setWho('client')}>I'm hiring</button>
            </div>
            <form onSubmit={go} className="lform">
              <label className="lf"><span>Email</span><input type="email" value={f.email} onChange={e => u('email', e.target.value)} placeholder="you@studio.com.au" autoComplete="email" /></label>
              <div className="two">
                {who === 'creative' && <label className="lf"><span>What you do <em className="opt">optional</em></span><div className="lsel"><select value={f.disc} onChange={e => u('disc', e.target.value)}><option value="">Choose</option>{DISC.map(x => <option key={x}>{x}</option>)}</select><Icon name="back" size={14} /></div></label>}
                <label className="lf"><span>{who === 'creative' ? 'Your state' : 'Hiring in'} <em className="opt">optional</em></span><div className="lsel"><select value={f.st} onChange={e => u('st', e.target.value)}><option value="">Choose</option>{STATES.map(x => <option key={x}>{x}</option>)}</select><Icon name="back" size={14} /></div></label>
              </div>
              <label className="lf"><span>Referral or invite code <em className="opt">optional</em></span><input value={f.ref} onChange={e => u('ref', e.target.value.toUpperCase())} placeholder="LT-XXXX-XXXX" spellCheck={false} /></label>
              {err && <p className="jerr">{err}</p>}
              <button type="submit" className="btn w lg">{outside && region !== 'INTL' ? 'Put me on the ' + (STATE_OF[region] || 'AU') + ' list' : 'Put me on the list'} <Icon name="arrow" size={14} /></button>
              <p className="tiny">By joining you agree to launch updates and The Trybe Edit. One click to leave. <Link to="/legal/privacy" style={{ color: 'var(--neon-t)', fontWeight: 600 }}>Privacy</Link>.</p>
            </form>
          </>}
          <p className="lfoot">{outside && <>In South East Queensland after all? <a href="/?seq=1" onClick={e => { e.preventDefault(); claimSEQ(); nav('/') }}>Go to the site</a>. </>}Have a founding code already? <Link to="/founding">Redeem it now</Link>. Already in? <Link to="/login">Log in</Link>.</p>
        </div>
      </div>
    </section>
  )
}
