import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import SyncDemo from './SyncDemo'
import { mountLens } from '../../lib/lens'
import { useReveal } from '../../lib/useReveal'
import { SectionHead, Calculator } from './Sections'

// How it works (28 Sep): two pills, I'm hiring and I'm a creative, and only what LensTrybe does
// today. The same look as before: the dark opener with the lens, then the steps on light glass.
// ?for=creative opens on the creative side, so links from Join and Pricing land in the right place.
const SIDES = {
  hiring: {
    h1: ['Post the job.', 'Creatives ', 'come to you.'],
    sub: 'Say what you need, where and when. Photographers and videographers who do that work reply with a real price, and you pick one. Free for clients, and no commission on anyone, ever.',
    steps: [
      ['Post a job', 'A minute, free. Your contact details stay private until you pick someone.'],
      ['Get real quotes', 'Creatives who fit the job reply with their price and what is included.'],
      ['Book it', 'Accept the quote online. Everything about the booking stays in one thread.'],
      ['Get your photos', 'Your gallery arrives at one link. Leave a review when you are ready.'],
    ],
    ctas: [['/jobs', 'Post a job', 'w'], ['/creatives', 'Find a creative yourself', 'g']],
  },
  creative: {
    h1: ['Get found. Get booked.', 'Keep ', 'all of it.'],
    sub: 'Your page, the job board and the business side of every shoot, in one place. A flat monthly plan, never a cut of your work, and Trybe Free costs nothing.',
    steps: [
      ['Your page', 'Your profile is your own website. Clients find it in Find a creative.'],
      ['Get work', 'Reply to jobs clients post, and get an email when one fits you.'],
      ['Run the job', 'Quotes, invoices, contracts and your calendar, all tied to the client.'],
      ['Deliver', 'Send the gallery from LensTrybe and collect reviews on your page.'],
    ],
    ctas: [['/join', 'Join as a creative', 'w'], ['/pricing', 'See the plans', 'g']],
  },
}

export default function HowItWorks() {
  const cv = useRef(null)
  const [params, setParams] = useSearchParams()
  const side = params.get('for') === 'creative' ? 'creative' : 'hiring'
  const S = SIDES[side]
  useReveal([side]) // the other side's sections rise in too after a pill is tapped
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  const pick = k => setParams(k === 'creative' ? { for: 'creative' } : {}, { replace: true })
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <>
      <section className="hiw dark darkhero" id="hiw">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">How it works</p>
          <div className="hiwpills" role="tablist" aria-label="Who is this for">
            <button type="button" role="tab" aria-selected={side === 'hiring'} className={side === 'hiring' ? 'on' : ''} onClick={() => pick('hiring')}>I'm hiring</button>
            <button type="button" role="tab" aria-selected={side === 'creative'} className={side === 'creative' ? 'on' : ''} onClick={() => pick('creative')}>I'm a creative</button>
          </div>
          <h1 key={side}><span className="ln"><span>{S.h1[0]}</span></span> <span className="ln"><span>{S.h1[1]}<em>{S.h1[2]}</em></span></span></h1>
          <p className="sub">{S.sub}</p>
          <div className="rail lg d">
            {S.steps.map(([t, d], i) => <button key={side + t} type="button" onClick={() => go('s' + (i + 1))}><i>{String(i + 1).padStart(2, '0')}</i><b>{t}</b><span>{d}</span></button>)}
          </div>
          <div className="ctas">{S.ctas.map(([to, l, k]) => <Link key={to} className={'btn ' + k} to={to}>{l}{k === 'w' && <Icon name="arrow" size={14} />}</Link>)}</div>
        </div>
      </section>

      <div className="lt">
        <Aurora />
        {side === 'hiring' ? <Hiring /> : <Creative />}
      </div>
    </>
  )
}

// A step: small label, headline with the serif accent, a line, and three plain points.
function Step({ id, eb, h, em, lead, pts, children, first }) {
  return (
    <section className="sec step" id={id} style={first ? undefined : { paddingTop: 0 }}><div className="wrap">
      <div className="stephead rv"><div><p className="eb g">{eb}</p><h2>{h} <em>{em}</em></h2></div></div>
      {lead && <p className="lead rv">{lead}</p>}
      {pts && <div className="hiwpts rv">{pts.map(([b, s]) => <div key={b} className="card lg"><b>{b}</b><span>{s}</span></div>)}</div>}
      {children}
    </div></section>
  )
}

function Hiring() {
  return <>
    <Step id="s1" first eb="Post a job" h="Say what you need," em="in a minute."
      lead="What the job is, where, when and roughly what you want to spend. You fill it in first, then make a free account to post it, so nothing you type is lost."
      pts={[['Free for clients', 'Posting costs nothing and never will. Creatives pay LensTrybe a flat plan, not a cut of your job.'], ['Private until you choose', 'Creatives see the job, not your phone number or email. You share those when you pick someone.'], ['Only people who do that work', 'Photographers and videographers who do that kind of job, in your area, hear about it.']]}>
      <div className="hiwcta rv"><Link className="btn" to="/jobs">Post a job <Icon name="arrow" size={14} /></Link></div>
    </Step>
    <Step id="s2" eb="Get real quotes" h="Prices, not" em="back and forth."
      pts={[['A real price', 'Each reply says what it costs and what is included, so you compare like with like.'], ['Their work, one tap away', 'Every creative has their own page: their photos, packages, reviews and when they are free.'], ['You pick', 'Choose one, ask a question first, or wait for more. There is no pressure and no fee.']]} />
    <Step id="s3" eb="Book it" h="The same booking," em="on both sides."
      lead="Once you choose, the job lives in one place. You see it on your phone, your creative sees it in their workspace, and what one of you does shows up for the other. Press play, or tap any step." >
      <SyncDemo />
    </Step>
    <Step id="s4" eb="Get your photos" h="One link," em="everything in it."
      pts={[['Your gallery', 'Photos and films arrive at one private link you can download from on any device.'], ['Everything kept together', 'Your quote, invoices and messages stay with the booking, not buried in email.'], ['Say how it went', 'Leave a review once it is done. Only real bookings can be reviewed.']]} />
    <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="closer lg rv">
        <div><p className="eb g">That's it</p><h2>Post the job. <em>They come to you.</em></h2></div>
        <div className="ctas"><Link className="btn" to="/jobs">Post a job <Icon name="arrow" size={14} /></Link><Link className="btn w" to="/creatives">Find a creative</Link></div>
      </div>
    </div></section>
  </>
}

function Creative() {
  return <>
    <Step id="s1" first eb="Your page" h="Your profile is" em="your website."
      lead="Clients who open you in Find a creative see your own site, built from your profile: your photos, packages, reviews, story and an enquiry box."
      pts={[['Trybe Free', 'A one-page website that builds itself from your profile.'], ['Trybe Essential', 'Edit it, and add a Gallery page for all your work.'], ['Trybe Complete and Studio', 'Home, About, Gallery and Contact, with Studio on your own domain.']]}>
      <div className="hiwcta rv"><Link className="btn w" to="/pricing">Compare the plans</Link></div>
    </Step>
    <Step id="s2" eb="Get work" h="Clients post jobs," em="you reply."
      pts={[['The job board', 'Real jobs from clients, with the date, the place and the budget up front. Reply with your price and what is included.'], ['Alerts that fit', 'An email when a job suits the work you do in your state, at most a few a day. Turn them off any time.'], ['Enquiries to your page', 'Clients who find you in the directory message you from your page, and it lands in your threads.']]} />
    <Step id="s3" eb="Run the job" h="Everything after" em="the yes."
      pts={[['Quotes and invoices', 'Branded, sent in a tap, and your client accepts a quote online.'], ['Contracts', 'Plain English, signed on their phone. On Trybe Complete and Studio.'], ['Your calendar', 'Bookings, pencils and blocked days in one place, and nothing moves without you saying so.']]} />
    <Step id="s4" eb="Deliver" h="Finish it" em="properly."
      pts={[['Deliver', 'Send galleries with your branding, from 1 GB on Trybe Essential to 200 GB on Studio.'], ['Client portal', 'Your client sees their booking, documents and messages in one place. On Trybe Complete and Studio.'], ['Reviews', 'Ask for a review when the job is done. It posts to your page.']]} />
    <section className="sec" id="keep" style={{ paddingTop: 0 }}><div className="wrap">
      <SectionHead eb="The maths" title="Keep" em="all of it.">Commission marketplaces take a cut of every job, forever. LensTrybe charges a flat monthly plan. Move the sliders, then <Link to="/pricing" style={{ color: 'var(--green-t)', fontWeight: 600 }}>see the four plans</Link>.</SectionHead>
      <Calculator />
    </div></section>
    <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="closer lg rv">
        <div><p className="eb g">That's it</p><h2>Get found. <em>Get booked.</em></h2></div>
        <div className="ctas"><Link className="btn" to="/join">Join as a creative <Icon name="arrow" size={14} /></Link><Link className="btn w" to="/jobs">See the job board</Link></div>
      </div>
    </div></section>
  </>
}
