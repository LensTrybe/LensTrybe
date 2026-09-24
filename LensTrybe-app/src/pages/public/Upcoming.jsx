import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { useToast } from '../../components/Toast'
import DATA from '../../data/upcoming.json'

const STATUS = { live: 'Available now', building: 'In build', planned: 'Planned', exploring: 'Exploring' }
const ORDER = ['live', 'building', 'planned', 'exploring']
const LAUNCH = ['photographer', 'videographer']
const ICON = { photographer: 'cal', videographer: 'play', drone_pilot: 'pin', video_editor: 'grid', photo_editor: 'grid', social_media_manager: 'chat', hair_makeup_artist: 'check', ugc_creator: 'mic' }
const sortBy = list => [...list].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))

// Upcoming features: four honest statuses, what is coming to everyone, then the tools per discipline, then a request form.
export default function Upcoming() {
  const toast = useToast()
  const cv = useRef(null)
  const [skill, setSkill] = useState('photographer')
  const [filter, setFilter] = useState('all')
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  const all = useMemo(() => Object.values(DATA.per).flat().concat(DATA.PLATFORM_FEATURES), [])
  const liveCount = all.filter(f => f.status === 'live').length
  const feats = sortBy(DATA.per[skill] || []).filter(f => filter === 'all' || f.status === filter)
  const label = DATA.SKILLS.find(s => s.key === skill)?.label
  return (
    <>
      <section className="hiw upc dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">Upcoming features</p>
          <h1><span className="ln"><span>What is coming,</span></span> <span className="ln"><span>and <em>when.</em></span></span></h1>
          <p className="sub">What is being built, what is planned, and what we are still thinking about. {liveCount} of these are already in the platform today.</p>
          <div className="legend lg d">{DATA.LEGEND.map(l => <div key={l.key}><span className={'stat ' + l.key}>{STATUS[l.key]}</span><span>{l.text}</span></div>)}</div>
          <div className="ctas"><a className="btn w" href="#request">Request a feature <Icon name="arrow" size={14} /></a><a className="btn g" href="#skills">Browse by skill</a></div>
        </div>
      </section>

      <div className="lt">
        <Aurora />
        <section className="sec" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">Coming to everyone</p><h2>For every creative, <em>whatever you do.</em></h2></div></div>
          <div className="fgrid rv">{sortBy(DATA.PLATFORM_FEATURES).map(f => <div key={f.name} className={'fcard lg ' + f.status}><div className="fh"><b>{f.name}</b><span className={'stat ' + f.status}>{STATUS[f.status]}</span></div><p>{f.description}</p></div>)}</div>
        </div></section>

        <section className="sec" id="skills" style={{ paddingTop: 0, scrollMarginTop: 80 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">By skill</p><h2>{label} <em>tools.</em></h2></div></div>
          <div className="skillrow rv">{DATA.SKILLS.map(s => <button key={s.key} className={'skill lg' + (skill === s.key ? ' on' : '')} onClick={() => { setSkill(s.key); setFilter('all') }}><i><Icon name={ICON[s.key]} size={15} /></i><b>{s.label}</b>{!LAUNCH.includes(s.key) && <small>After launch</small>}</button>)}</div>
          <div className="rbar rv" style={{ marginTop: 18 }}>
            <span>{LAUNCH.includes(skill) ? 'What is in the platform today, and what comes next.' : `${label}s join LensTrybe after launch. These are the tools being built for them, and some are already in the platform.`}</span>
            <div className="seg">{['all', ...ORDER].map(k => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{k === 'all' ? 'All' : STATUS[k]}</button>)}</div>
          </div>
          <div className="fgrid rv" key={skill + filter}>{feats.length ? feats.map(f => <div key={f.name} className={'fcard lg ' + f.status}><div className="fh"><b>{f.name}</b><span className={'stat ' + f.status}>{STATUS[f.status]}</span></div><p>{f.description}</p></div>) : <div className="empty lg">Nothing at that stage for {label}s yet.</div>}</div>
        </div></section>

        <section className="sec" id="request" style={{ paddingTop: 0, scrollMarginTop: 80 }}><div className="wrap">
          <div className="msgrid rv">
            <div>
              <div className="stephead"><div><p className="eb g">Request a feature</p><h2>Tell us what <em>would help.</em></h2></div></div>
              <p className="lead" style={{ marginLeft: 0 }}>The list above came from creatives telling us what slows them down. If something you need is missing, say so. The ones that come up most move up the list, and we reply to every request.</p>
              <div className="pts">
                <div><b>Be specific</b><span>"A packages catalogue I can pull into quotes" beats "better quoting". The more concrete, the faster we can size it.</span></div>
                <div><b>Say what you do</b><span>Pick your skill so it lands with the right part of the roadmap.</span></div>
              </div>
            </div>
            <form className="card lg mform" onSubmit={e => { e.preventDefault(); toast('Thanks. Your feature request has been submitted.') }}>
              <div className="two"><div className="field"><label htmlFor="rb">Business name</label><input id="rb" placeholder="Okafor Weddings" /></div><div className="field"><label htmlFor="re">Email</label><input id="re" type="email" placeholder="you@studio.com.au" /></div></div>
              <div className="field"><label htmlFor="rs">Your skill</label><select id="rs" defaultValue=""><option value="">Choose one</option>{DATA.SKILLS.map(s => <option key={s.key}>{s.label}</option>)}</select></div>
              <div className="field"><label htmlFor="rf">Feature request</label><textarea id="rf" rows={5} placeholder="What would you build, and what would it save you?" maxLength={3000} /></div>
              <div className="mrow"><button type="submit" className="btn k">Send request <Icon name="arrow" size={14} /></button><span>Or vote with your feet: <Link to="/join">join</Link> and tell Lumi.</span></div>
            </form>
          </div>
        </div></section>
      </div>
    </>
  )
}
