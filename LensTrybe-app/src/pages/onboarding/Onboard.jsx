import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Logo from '../../components/Logo'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useSpecular } from '../../lib/useSpecular'
import { MOOD_NAMES } from '../../lib/stills'
import '../../styles/public.css'
import '../../styles/pages.css'
import './onboard.css'

const STEPS = ['Code', 'You', 'Work', 'Rates', 'Calendar', 'Live']
// Founding code to live profile in five minutes. Lumi fills what it can.
export default function Onboard() {
  const [p] = useSearchParams(); const nav = useNavigate(); useSpecular([])
  const [s, setS] = useState(p.get('code') ? 1 : 0); const [code, setCode] = useState(p.get('code') || '')
  const [disc, setDisc] = useState('Photographer'); const [specs, setSpecs] = useState(new Set(['Weddings'])); const [rate, setRate] = useState(3200)
  const next = () => setS(x => Math.min(5, x + 1))
  return (
    <div className="pub pub-light ob">
      <Aurora />
      <header className="obh"><Link to="/"><Logo height={18} /></Link><div className="obs">{STEPS.map((t, i) => <span key={t} className={i < s ? 'd' : i === s ? 'c' : ''}><i />{t}</span>)}</div></header>
      <main className="obw">
        <div className="obc lg">
          {s === 0 && <><p className="eb p">Founding creative programme</p><h1>Redeem your code.</h1><p className="sub">Expert free for twelve months, then $49 a month for life, plus the badge. A place is claimed when the code is redeemed.</p>
            <div className="field"><label htmlFor="c">Founding code</label><input id="c" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="LT-XXXX-XXXX" /></div>
            <div className="row"><button className="btn p lg" onClick={next}>Redeem <Icon name="arrow" size={14} /></button><button className="btn g lg" onClick={next}>I don't have a code</button></div></>}
          {s === 1 && <><p className="eb g">Step 1 of 5</p><h1>Who are you?</h1><p className="sub">The name clients will search for, and where you shoot from.</p>
            <div className="two"><div className="field"><label htmlFor="n1">Name</label><input id="n1" placeholder="Mara Okafor" /></div><div className="field"><label htmlFor="n2">Studio name, optional</label><input id="n2" placeholder="Okafor Weddings" /></div></div>
            <div className="two"><div className="field"><label htmlFor="n3">Based in</label><input id="n3" placeholder="Noosa, QLD" /></div><div className="field"><label htmlFor="n4">Travel radius</label><select id="n4"><option>50 km</option><option>150 km</option><option>Statewide</option><option>Anywhere</option></select></div></div>
            <div className="pick3">{['Photographer', 'Videographer', 'Both'].map(d => <button key={d} className={disc === d ? 'on' : ''} onClick={() => setDisc(d)}><b>{d}</b></button>)}</div>
            <div className="row"><button className="btn p lg" onClick={next}>Continue <Icon name="arrow" size={14} /></button></div></>}
          {s === 2 && <><p className="eb g">Step 2 of 5</p><h1>Show the work.</h1><p className="sub">Drop up to 40 photos or a film. Lumi picks the cover and writes a first draft of your bio from what it sees. You can change every word.</p>
            <div className="drop lg"><Icon name="deliver" size={28} /><b>Drop photos here</b><small>or tap to choose · JPG, HEIC, MP4 · we resize, you keep the originals</small></div>
            <div className="chips">{['Weddings', 'Elopements', 'Real estate', 'Brand', 'Events', 'Portraits', 'Food'].map(k => <button key={k} className={'chip' + (specs.has(k) ? ' on' : '')} onClick={() => setSpecs(x => { const n = new Set(x); n.has(k) ? n.delete(k) : n.add(k); return n })}>{k}</button>)}</div>
            <div className="lumi-note2"><span className="lm" /><span><b>Lumi drafted:</b> "Documentary weddings on the Sunshine Coast and anywhere in Queensland worth driving to. I shoot the day as it happens and I stay until the good bit." Edit or keep.</span></div>
            <div className="row"><button className="btn p lg" onClick={next}>Continue <Icon name="arrow" size={14} /></button></div></>}
          {s === 3 && <><p className="eb g">Step 3 of 5</p><h1>Your packages.</h1><p className="sub">Three is plenty. Lumi quotes from these, and clients see "from" the lowest. Prices stay private until you send a quote.</p>
            <div className="pk3">{[['Elopement', Math.round(rate * .44 / 10) * 10, '3 hours'], ['Full day', rate, '10 hours'], ['Weekend', Math.round(rate * 1.53 / 10) * 10, '2 days']].map(([n, v, h]) => <div key={n} className="pc2"><b>{n}</b><span>${v.toLocaleString('en-AU')}</span><small>{h}</small></div>)}</div>
            <div className="sl"><label>Full day rate <b>${rate.toLocaleString('en-AU')}</b></label><input type="range" min="800" max="8000" step="100" value={rate} onChange={e => setRate(+e.target.value)} /></div>
            <p className="fine">GST is added on top if you are registered. A 30% deposit secures a date unless you change it.</p>
            <div className="row"><button className="btn p lg" onClick={next}>Continue <Icon name="arrow" size={14} /></button></div></>}
          {s === 4 && <><p className="eb g">Step 4 of 5</p><h1>Connect your calendar.</h1><p className="sub">Clients see open dates before they ask, and a deposit locks the date everywhere. Read and write, nothing else.</p>
            <div className="pick3"><button className="on"><b>Google Calendar</b><small>Connected as mara@…</small></button><button><b>Apple Calendar</b><small>Connect</small></button><button><b>Outlook</b><small>Connect</small></button></div>
            <div className="lumi-note2"><span className="lm" /><span>Found 3 events in November that look like shoots. Mark them as booked days? You can change any of them later.</span></div>
            <div className="row"><button className="btn p lg" onClick={next}>Yes, and continue <Icon name="arrow" size={14} /></button><button className="btn g lg" onClick={next}>Skip for now</button></div></>}
          {s === 5 && <><p className="eb g">You're live</p><h1>Your profile is on LensTrybe.</h1><p className="sub">Founding badge on, Expert plan free until 21 September 2027, then $49 a month for life. Your next three jobs through the platform keep it that way.</p>
            <div className="prevcard"><Still seed={3} mood="golden" /><div className="in"><b>Mara Okafor</b><small>{disc} · Noosa · Founding creative</small><span className="st ok">Live</span></div></div>
            <div className="row"><button className="btn p lg" onClick={() => nav('/app')}>Open your workspace <Icon name="arrow" size={14} /></button><Link className="btn g lg" to="/creatives/mara">See it as a client</Link></div></>}
        </div>
      </main>
    </div>
  )
}
