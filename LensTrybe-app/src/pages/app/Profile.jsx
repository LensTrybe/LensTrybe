import { useState } from 'react'
import Still from '../../components/Still'
import { useToast } from '../../components/Toast'
const TOGS = [['Instant enquiry', 'Clients message you without an account', true], ['Show from-price', '"Full day from $3,200" on your card', true], ['Live availability', 'Clients see open dates before they ask', true], ['Book and pay a deposit directly', 'Skip the quote for fixed packages', false], ['Founding creative badge', 'Permanent, on your card and profile', true]]
export default function Profile() {
  const toast = useToast(); const [t, setT] = useState(TOGS.map(x => x[2]))
  return (
    <section className="view on">
      <div className="vh"><div><h1>Profile and site</h1><p>What clients see on lenstrybe.com and on maraokafor.com. Edit once, both update.</p></div><div className="acts"><a className="btn g" href="/creatives/mara" target="_blank" rel="noreferrer">View as a client</a><button className="btn p" onClick={() => toast('Published. Both sites updated.')}>Publish changes</button></div></div>
      <div className="prof">
        <div className="card lg"><div className="prev"><Still seed={3} mood="golden" /><div className="in"><h3>Mara Okafor</h3><small>Wedding and elopement photography · Noosa · Founding creative · 4.9 from 39 reviews</small></div></div>
          <div className="comp" style={{ marginTop: 14 }}><div className="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="rgba(20,17,26,.1)" strokeWidth="6" /><circle cx="32" cy="32" r="27" fill="none" stroke="#1DB954" strokeWidth="6" strokeLinecap="round" strokeDasharray="170" strokeDashoffset="17" transform="rotate(-90 32 32)" /></svg><b>90%</b></div><div><b style={{ display: 'block', fontSize: 13.5 }}>Profile strength</b><small style={{ color: 'var(--ink-3)' }}>Add a portfolio video to reach 100%. Profiles with video get 2.3× more enquiries.</small></div></div></div>
        <div className="card lg"><div className="h"><b>What clients can see and do</b></div>
          {TOGS.map(([a, b], i) => <div key={a} className="tog"><div>{a}<small>{b}</small></div><button className={'sw' + (t[i] ? ' on' : '')} aria-label={'toggle ' + a} onClick={() => { setT(s => s.map((v, j) => j === i ? !v : v)); toast('Saved. Both sites update in a moment.') }} /></div>)}
          <div className="tog"><div>Your own domain<small>maraokafor.com · SSL live</small></div><span className="st ok">Live</span></div>
        </div>
      </div>
    </section>
  )
}
