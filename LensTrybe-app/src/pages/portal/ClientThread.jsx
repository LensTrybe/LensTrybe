import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Logo from '../../components/Logo'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useSpecular } from '../../lib/useSpecular'
import { MOOD_NAMES } from '../../lib/stills'
import '../../styles/public.css'
import '../../styles/pages.css'
import './portal.css'
import PortalLive from './PortalLive'
import { isUuid } from '../../lib/live'
import { LIVE } from '../../lib/mode'

// The client's side of the same thread. One link, no login, everything in order.
// A real portal token (a UUID, from the email) opens the live thread; anything else is the demo.
export default function ClientThread() {
  const { slug } = useParams()
  if (LIVE && isUuid(slug)) return <PortalLive token={slug} />
  return <ClientThreadDemo />
}
function ClientThreadDemo() {
  const toast = useToast(); useSpecular([])
  const [msgs, setMsgs] = useState([]); const [v, setV] = useState(''); const [stars, setStars] = useState(0)
  const send = () => { if (!v.trim()) return; setMsgs(m => [...m, v.trim()]); setV('') }
  return (
    <div className="pub pub-light portal">
      <Aurora />
      <header className="phdr lg"><Link to="/" className="plogo"><Logo height={18} /></Link><span className="who"><span className="pav"><Still seed={3} mood="golden" style={{ borderRadius: '50%' }} /></span><div><b>Mara Okafor</b><small>Wedding photography · replies in about 2 hours</small></div></span><span className="plive"><i />Live</span></header>
      <main className="pwrap">
        <div className="pjob lg"><div className="pjhead"><div><p className="eb g">Your booking</p><h1>Harper and Leo</h1><p className="sub">Sat 14 Nov 2026 · Maleny Manor · full day</p></div><div className="pnext"><small>Next up</small><b>Shoot day, Sat 14 Nov</b><span>Balance $2,240 due 7 Nov</span></div></div>
          <div className="pstage">{['Enquiry', 'Quote', 'Accepted', 'Signed', 'Deposit', 'Shoot day', 'Deliver', 'Review'].map((s, i) => <span key={s} className={i < 5 ? 'd' : i === 5 ? 'c' : ''}><i>{i < 5 ? <Icon name="check" size={9} /> : null}</i>{s}</span>)}</div></div>
        <div className="pthread2">
          <div className="tm me">Hi Mara, we're getting married at Maleny Manor on Sat 14 Nov. Full day, about 90 guests. Are you free?<span className="w">6 Oct, 9:12 am</span></div>
          <div className="tm them">Hi Harper! Yes, the 14th is open and I'd love to. Full day is $3,200, quote attached.<span className="w">6 Oct, 9:14 am</span></div>
          <div className="pcard lg"><i className="pk"><Icon name="check" size={13} /></i><div><b>Quote #Q-0412 · Full day</b><small>$3,200 incl. GST · travel included</small></div><span className="st ok">Accepted 7 Oct</span></div>
          <div className="pcard lg"><i className="pk"><Icon name="check" size={13} /></i><div><b>Contract #C-0412</b><small>12 clauses, plain English · signed by you 7 Oct, 8:05 pm</small></div><span className="st pink">Signed</span><button className="pbtn" onClick={() => toast('Contract opens as a PDF')}>Read</button></div>
          <div className="pcard lg"><i className="pk"><Icon name="check" size={13} /></i><div><b>Deposit · $960</b><small>Paid with Visa ···· 6411 · receipt sent</small></div><span className="st ok">Paid</span><button className="pbtn" onClick={() => toast('Receipt opens as a PDF')}>Receipt</button></div>
          <div className="tsys">Your date is locked. Balance of $2,240 is due 7 Nov, and we'll remind you a week before.</div>
          <div className="pcard lg now"><i className="pk cal"><Icon name="cal" size={13} /></i><div><b>Call sheet · Sat 14 Nov</b><small>Mara arrives 9:30 · Prep at The Barn · Ceremony 2:00 · Sunset portraits 5:40</small></div><span className="st live">Next</span><div className="ln"><span>Shot list</span><span>Family groups</span><span>Directions</span></div></div>
          <div className="tm them">Sneak peek is in! Twenty from the day, the rest in two weeks.<span className="w">Today, 8:01 am</span></div>
          <div className="pcard lg peek"><i className="pk"><Icon name="grid" size={13} /></i><div><b>Sneak peek · 20 photos</b><small>The rest arrive in two weeks, at this same link.</small></div><div className="thumbs">{[0, 1, 2, 3].map(i => <div key={i}><Still seed={80 + i * 3} mood={MOOD_NAMES[i]} /></div>)}</div><button className="btn k sm" onClick={() => toast('Downloading 20 photos')}><Icon name="deliver" size={14} />Download all</button></div>
          <div className="pcard lg"><i className="pk"><Icon name="chat" size={13} /></i><div><b>How was Mara?</b><small>One tap. Verified booking, posted to her profile.</small></div><div className="stars">{[1, 2, 3, 4, 5].map(n => <button key={n} className={n <= stars ? 'on' : ''} onClick={() => { setStars(n); toast(n + ' stars. Thank you, that goes straight to her profile.') }}>★</button>)}</div></div>
          {msgs.map((m, i) => <div key={i} className="tm me">{m}<span className="w">Just now</span></div>)}
        </div>
        <div className="pcompose lg"><span className="lens" aria-hidden="true" /><input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message Mara" /><button onClick={send} aria-label="Send"><Icon name="arrow" /></button></div>
        <p className="fine" style={{ textAlign: 'center', marginTop: 18 }}>This link is yours. No account, no password. Lose it and Mara can resend it in a tap. <Link to="/" style={{ color: 'var(--green-t)' }}>lenstrybe.com</Link></p>
      </main>
    </div>
  )
}
