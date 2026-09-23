import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'

const SIG = 'M12 48c14-22 26-30 30-22s-4 34 6 30 20-38 30-32-2 32 8 30 22-26 30-20-4 26 6 24 18-24 30-18 4 20 12 18 24-22 36-16 8 20 20 16 26-20 40-14 10 16 22 12'
const STEPS = [
  { k: 'Enquiry', t: 'Client asks', from: 'client', dur: 3000, phone: [{ me: "Hi Mara, we're getting married at Maleny Manor on Sat 14 Nov. Full day, about 90 guests. Are you free?" }],
    desk: { h: 'New enquiry', s: 'Harper and Leo · Sat 14 Nov · Maleny Manor', body: <div className="dk"><div className="r"><div><b>Full day wedding, 90 guests</b><small>Enquiry received 9:12 am · via your profile</small></div><span className="st sent">New</span></div><div className="lumi"><span className="lm" /><span>14 Nov is open. Maleny Manor is 38 km from you, inside your travel radius. I've drafted a reply and a Full day quote at $3,200.</span></div><div className="cta">Send reply and quote</div></div> } },
  { k: 'Quote', t: 'Quote sent', from: 'creative', dur: 3000, phone: [{ them: "Hi Harper! Yes, the 14th is open and I'd love to. Full day is $3,200, quote attached." }, { card: <><b>Quote #Q-0412 · Full day</b><small>$3,200 incl. GST · valid 14 days · travel included</small><div className="btn2">Accept quote</div></> }],
    desk: { h: 'Quote #Q-0412', s: 'Sent 9:14 am · private between you and Harper', body: <div className="dk"><div className="r"><div><b>Full day, 10 hours</b><small>Prep to first dance · 400+ photos</small></div><b>$3,200</b></div><div className="r"><div><b>Travel</b><small>Within 150 km of Noosa</small></div><span>Included</span></div><div className="r"><span>Status</span><span className="st sent">Sent</span></div></div> } },
  { k: 'Accept', t: 'Client accepts', from: 'client', dur: 2600, phone: [{ them: "Hi Harper! Yes, the 14th is open and I'd love to. Full day is $3,200, quote attached." }, { card: <><b>Quote #Q-0412 · Full day</b><small>$3,200 incl. GST</small><div className="btn2 ok">Accepted ✓</div></> }, { sys: 'Quote accepted · 11:40 am' }],
    desk: { h: 'Quote #Q-0412', s: 'Accepted 11:40 am · contract generated', body: <div className="dk"><div className="r"><span>Quote</span><span className="st ok">Accepted</span></div><div className="r"><div><b>Contract #C-0412</b><small>Generated from your Full day template · 12 clauses</small></div><span className="st sent">Sent</span></div><div className="lumi"><span className="lm" /><span>Contract sent automatically. I'll nudge Harper if it's unsigned in 48 hours.</span></div></div> } },
  { k: 'Sign', t: 'Signed on a phone', from: 'client', dur: 3200, phone: [{ sys: 'Quote accepted · 11:40 am' }, { card: <><b>Contract #C-0412</b><small>12 clauses · plain English · 2 min read</small><div className="sig2"><svg viewBox="0 0 300 70" preserveAspectRatio="none"><path d={SIG} /></svg></div><div className="btn2 ok">Signed ✓</div></> }],
    desk: { h: 'Contract #C-0412', s: 'Signed by Harper Ellis · 8:05 pm', body: <div className="dk"><div className="r"><span>Harper Ellis</span><span className="st pink">Signed</span></div><div className="r"><span>Mara Okafor</span><span className="st ok">Signed</span></div><div className="r"><div><b>Deposit invoice INV-0219</b><small>30% · $960 · sent automatically</small></div><span className="st sent">Sent</span></div></div> } },
  { k: 'Deposit', t: 'Paid in a tap', from: 'client', dur: 3000, phone: [{ card: <><b>Contract #C-0412</b><small>Signed 8:05 pm</small></> }, { card: <><b>Deposit · $960</b><small>Invoice INV-0219 · secures Sat 14 Nov</small><div className="btn2 ok">Paid with Apple Pay ✓</div></> }],
    desk: { h: 'Paid', s: '$960 deposit · Visa ···· 6411 · 8:07 pm', body: <><div className="kp"><div><small>Received</small><b>$960</b><em>Deposit</em></div><div><small>Balance due</small><b>$2,240</b><em>7 Nov</em></div><div><small>Date</small><b>14 Nov</b><em>Locked</em></div></div><div className="dk"><div className="lumi" style={{ border: 0, margin: 0, padding: 0 }}><span className="lm" /><span>Date locked on your LensTrybe and Google calendars. Balance reminder scheduled for 31 Oct.</span></div></div></> } },
  { k: 'Shoot day', t: 'Everyone knows the plan', from: 'creative', dur: 3000, phone: [{ card: <><b>Sat 14 Nov · Call sheet</b><small>Mara arrives 9:30 · Prep at The Barn · Ceremony 2:00 · Sunset portraits 5:40</small><div className="ln"><span>Shot list</span><span>Family groups</span><span>Directions</span></div></> }],
    desk: { h: 'Today · Harper and Leo', s: 'Sat 14 Nov · Maleny Manor · 38 km · leave by 8:40', body: <div className="dk"><div className="r"><div><b>9:30 Arrive · prep</b><small>The Barn, Maleny Manor</small></div><span className="st ok">Now</span></div><div className="r"><div><b>2:00 Ceremony</b><small>Lawn, facing west · 90 guests</small></div><span /></div><div className="r"><div><b>5:40 Sunset portraits</b><small>Golden hour 5:22 to 6:10</small></div><span /></div><div className="ln"><span>Balance paid 7 Nov</span><span>Second shooter: Sam</span><span>Weather: 26°, clear</span></div></div> } },
  { k: 'Deliver', t: 'Files arrive', from: 'creative', dur: 3200, phone: [{ card: <><b>Your gallery is ready</b><small>412 photos · 2 films · harperandleo.lenstrybe.com</small><div className="thumbs"><i /><i /><i /><i /></div><div className="btn2">Download all</div></> }],
    desk: { h: 'Deliver · Harper and Leo', s: '412 photos · 2 films · 18.4 GB', body: <div className="dk"><div className="r"><div><b>Uploading to the branded gallery</b><small>Sneak peek went out on the night · gallery in 12 days</small></div><span className="st ok">Live</span></div><div className="bar2"><i /></div><div className="lumi"><span className="lm" /><span>Harper opened the gallery on her phone. Expiry reminder set for 90 days. Review request goes out in 3 days.</span></div></div> } },
  { k: 'Review', t: 'Five stars, on the profile', from: 'client', dur: 3400, phone: [{ card: <><b>How was Mara?</b><small>Verified booking · one tap</small><div className="stars"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></div></> }, { me: 'She was incredible. The sneak peek made my mum cry.' }],
    desk: { h: 'New review · 5 stars', s: 'Harper and Leo · verified booking · posted to your profile', body: <div className="dk"><div className="r"><div><b>"She was incredible. The sneak peek made my mum cry."</b><small>Harper Ellis · Maleny · November 2026</small></div><span className="st ok">Live</span></div><div className="lumi"><span className="lm" /><span>That's 39 reviews at 4.9. Three couples viewed your profile from this one already. December has three open Saturdays, want me to mention them on your profile?</span></div></div> } },
]

// One booking, two screens, in sync.
export default function SyncDemo() {
  const [cur, setCur] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [pulse, setPulse] = useState(0)
  const ref = useRef(null), vis = useRef(false)
  useEffect(() => { const io = new IntersectionObserver(([e]) => (vis.current = e.isIntersecting), { threshold: .25 }); io.observe(ref.current); return () => io.disconnect() }, [])
  useEffect(() => {
    if (!playing || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(() => { if (vis.current) setCur(c => (c + 1) % STEPS.length) }, STEPS[cur].dur)
    return () => clearTimeout(t)
  }, [cur, playing])
  useEffect(() => { setPulse(p => p + 1) }, [cur])
  const s = STEPS[cur]
  return (
    <>
      <div className="sync rv" ref={ref}>
        <div className="dev phone" aria-label="Client's phone">
          <div className="pbar"><span>9:41</span><span className="pnotch" /><span>●●●</span></div>
          <div className="phead"><span className="pav" /><div><b>Mara Okafor</b><small>Wedding photography · LensTrybe thread</small></div><span className="plive"><i />Live</span></div>
          <div className="pthread" key={cur}>{s.phone.map((m, i) => m.card ? <div key={i} className="mcard">{m.card}</div> : m.sys ? <div key={i} className="msg sys">{m.sys}</div> : <div key={i} className={'msg ' + (m.me ? 'me' : 'them')}>{m.me || m.them}</div>)}</div>
          <div className="pin"><span>Message Mara</span><i /></div>
        </div>
        <div className="link" aria-hidden="true"><span key={pulse} className={'pulse ' + (s.from === 'client' ? 'go' : 'back')} /><svg viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M0 20 C 40 20, 80 20, 120 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" /></svg><span className="lab">Same thread, same second</span></div>
        <div className="dev desk lg chroma tilt" aria-label="Creative's workspace">
          <div className="dbar"><span className="dots"><i /><i /><i /></span><span className="durl">app.lenstrybe.com/thread/harper-leo</span></div>
          <div className="dbody">
            <aside className="dside"><b>Harper and Leo</b><small>Wedding · Sat 14 Nov · Maleny Manor</small><div className="dsteps">{STEPS.map((x, j) => <span key={x.k} className={j < cur ? 'done' : j === cur ? 'on' : ''}><i />{x.k}</span>)}</div></aside>
            <div className="dmain" key={'d' + cur}><h5>{s.desk.h}</h5><p className="dsub">{s.desk.s}</p>{s.desk.body}</div>
          </div>
        </div>
      </div>
      <div className="scrub rv">
        <button className="play" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={14} style={{ fill: 'currentColor', stroke: 'none' }} /></button>
        <div className="track lg">{STEPS.map((x, j) => <button key={x.k} className={j < cur ? 'done' : j === cur ? 'on' : ''} style={{ '--dur': x.dur / 1000 + 's' }} onClick={() => setCur(j)}>{x.k}<small>{x.t}</small></button>)}</div>
      </div>
    </>
  )
}
