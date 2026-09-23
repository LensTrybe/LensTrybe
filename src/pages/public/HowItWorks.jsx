import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import SyncDemo from './SyncDemo'
import { mountLens } from '../../lib/lens'
import { SectionHead, Bento, Agent, Calculator, FoundingBand } from './Sections'

const STEPS = [
  ['Ask', 'One sentence. Who, where, when, roughly how much.'],
  ['Book', 'Quote, contract and deposit in one thread, on a phone.'],
  ['Shoot', 'Everyone has the plan. The date is locked everywhere.'],
  ['Delivered', 'Files arrive at one link. The review posts itself.'],
]

// How it works: a dark opener with the lens, then the journey in four steps on light glass.
export default function HowItWorks() {
  const cv = useRef(null)
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <>
      <section className="hiw dark darkhero" id="hiw">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">How it works</p>
          <h1><span className="ln"><span>One sentence in.</span></span> <span className="ln"><span>A shoot <em>booked.</em></span></span></h1>
          <p className="sub">No directory to scroll, no forms to fill, no back and forth over email. A client says what they need, a creative says yes, and everything in between happens in one thread that both of them can see.</p>
          <div className="rail lg d">
            {STEPS.map(([t, d], i) => <button key={t} type="button" onClick={() => go('s' + (i + 1))}><i>{String(i + 1).padStart(2, '0')}</i><b>{t}</b><span>{d}</span></button>)}
          </div>
          <div className="ctas"><Link className="btn w" to="/">Try it with one sentence <Icon name="arrow" size={14} /></Link><Link className="btn g" to="/join">Join as a creative</Link></div>
        </div>
      </section>

      <div className="lt">
        <Aurora />

        <section className="sec step" id="s1"><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">Ask</p><h2>Say it like you'd say it <em>to a friend.</em></h2></div></div>
          <div className="askrow rv">
            <div className="card lg">
              <div className="askmock"><span className="lens" /><span>A wedding photographer in Noosa on 14 November, around $3,000</span><b>Find them</b></div>
              <div className="chips"><span><i />Wedding + Photo</span><span><i />Noosa</span><span><i />14 Nov</span><span><i />Around $3,000</span></div>
              <p className="note"><span className="lm" /><span><b>6 match.</b> 6 are free on 14 Nov, 4 inside your budget. Mara is the closest fit.</span></p>
            </div>
            <div className="pts">
              <div><b>Lumi reads the sentence</b><span>The work, the place, the date and the budget come out of plain words. No filters, no dropdowns.</span></div>
              <div><b>Only people who are actually free</b><span>Every creative's calendar is live. If the date is taken, they don't appear.</span></div>
              <div><b>Ranked by fit, not by who paid</b><span>The best match for this brief sits closest to the lens. Nobody buys their way to the top.</span></div>
            </div>
          </div>
        </div></section>

        <section className="sec step" id="s2" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">Book</p><h2>The same booking, <em>on both sides.</em></h2></div></div>
          <p className="lead rv">Every job is one thread. The client sees it on their phone, the creative sees it in their workspace, and every action on one side lands on the other in the same second. Press play, or tap any step.</p>
          <SyncDemo />
        </div></section>

        <section className="sec step" id="s3" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">Shoot and deliver</p><h2>Everything is <em>one tap away.</em></h2></div></div>
          <p className="lead rv">The best software is the kind nobody notices. Each of these takes a second and none of them takes a tutorial.</p>
          <Bento />
        </div></section>

        <section className="sec step" id="s4" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb p">For creatives</p><h2>Your business, <em>run while you shoot.</em></h2></div></div>
          <p className="lead rv">Lumi reads your bookings, rates, calendar and inbox, and it acts. You approve, it does. Every action is logged and every one can be undone. <Link to="/app" style={{ color: 'var(--green-t)', fontWeight: 600 }}>Open the workspace preview</Link>.</p>
          <Agent />
        </div></section>

        <section className="sec" id="keep" style={{ paddingTop: 0 }}><div className="wrap">
          <SectionHead eb="The maths" title="Keep" em="all of it.">Commission marketplaces take a cut of every job, forever. LensTrybe charges a flat subscription. Move the sliders, then <Link to="/pricing" style={{ color: 'var(--green-t)', fontWeight: 600 }}>see the four plans</Link>.</SectionHead>
          <Calculator />
        </div></section>

        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="closer lg rv">
            <div><p className="eb g">That's it</p><h2>Ask once. <em>We'll find them.</em></h2></div>
            <div className="ctas"><Link className="btn" to="/">Try it with one sentence <Icon name="arrow" size={14} /></Link><Link className="btn w" to="/join">Join as a creative</Link></div>
          </div>
          <div style={{ marginTop: 24 }}><FoundingBand /></div>
        </div></section>
      </div>
    </>
  )
}
