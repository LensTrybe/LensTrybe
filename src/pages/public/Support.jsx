import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { useToast } from '../../components/Toast'

const CATEGORIES = ['I am a creative on LensTrybe', 'I am a client booking a creative', 'Billing and subscription', 'Technical issue or bug', 'Media, partnership or press', 'Feedback or feature idea', 'Something else']
const TOPICS = [
  { k: 'all', l: 'All' }, { k: 'start', l: 'Getting started' }, { k: 'book', l: 'Booking' }, { k: 'money', l: 'Money' }, { k: 'account', l: 'Account' },
]
const FAQS = [
  ['start', 'What is LensTrybe?', 'A no-commission marketplace for Australian visual creatives, starting with photographers and videographers. Creatives keep everything they charge and pay a flat monthly subscription. Clients never pay to enquire or book.'],
  ['start', 'How do I join as a creative?', 'Choose Join as a creative, pick a plan and set up your profile. Set up takes about ten minutes and you are live the same day. You can start on the free Basic plan and upgrade whenever you are ready.'],
  ['book', 'I am a client. How do I book a creative?', 'Say what you need in the ask bar on the home page, or browse Find a creative. Open a profile, pick a date and a package, and press Book. The quote, contract, deposit and files all live in one thread you can open from any phone.'],
  ['book', 'What happens after I book?', 'The creative gets your enquiry, a quote is built from their real rates, you sign the contract on your phone, pay the deposit, and the date locks on both calendars. Files arrive at one link after the shoot.'],
  ['book', 'Can I cancel or change a booking?', 'Yes. Open the thread and message the creative. Cancellation terms are in the contract you signed, in plain English, and the deposit terms are shown before you pay.'],
  ['money', 'Do you take a commission?', 'No. Never. Creatives pay the subscription and keep every dollar of every job. Clients pay the creative directly through the thread.'],
  ['money', 'How does the three months free work?', 'Any paid plan is free for your first three months. Add a card, pay nothing until month four, and cancel before then and pay nothing at all.'],
  ['money', 'How do refunds work?', 'Annual plans get a full refund within 14 days of first payment. Monthly plans can be cancelled any time and keep access to the end of the period. The full policy is on the refunds page.'],
  ['account', 'I did not receive an email from LensTrybe.', 'Our emails come from noreply@mail.lenstrybe.com. Check spam or promotions and mark us as safe. If it is still missing, send a message below and we will resend it.'],
  ['account', 'How do I reset my password?', 'On the log in page choose "Forgot it?" or "Email me a magic link". Either one sends a link that signs you in, and you can set a new password from your account settings.'],
  ['account', 'How do I delete my account?', 'From Settings in your workspace choose Delete account. Your data is removed within 30 days. Open bookings need to be completed or cancelled first.'],
]

// Support: the lens, a question bar, quick answers by topic, then a real person.
export default function Support() {
  const toast = useToast()
  const cv = useRef(null)
  const [q, setQ] = useState(''), [topic, setTopic] = useState('all'), [open, setOpen] = useState(-1)
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  const list = FAQS.filter(([t, qq, a]) => (topic === 'all' || t === topic) && (!q.trim() || (qq + ' ' + a).toLowerCase().includes(q.trim().toLowerCase())))
  const send = e => { e.preventDefault(); toast('Sent. A real person will reply within a business day.') }
  return (
    <>
      <section className="hiw sup dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">Support</p>
          <h1><span className="ln"><span>Ask a person,</span></span> <span className="ln"><span>or ask <em>Lumi.</em></span></span></h1>
          <p className="sub">Quick answers below for the how-do-I questions. For anything else, a real person replies from connect@lenstrybe.com within a business day.</p>
          <form className="sbar" onSubmit={e => { e.preventDefault(); document.getElementById('answers')?.scrollIntoView({ behavior: 'smooth' }) }} role="search">
            <span className="lens" aria-hidden="true" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="How do refunds work?" aria-label="Search the answers" />
            <button type="submit" className="go"><span>Find the answer</span><Icon name="arrow" size={14} /></button>
          </form>
          <div className="quick">
            <a href="#answers"><i><Icon name="chat" size={15} /></i><b>Quick answers</b><span>Most questions, one tap</span></a>
            <a href="#message"><i><Icon name="mic" size={15} /></i><b>Message a person</b><span>Reply within a business day</span></a>
            <a href="mailto:connect@lenstrybe.com"><i><Icon name="arrow" size={15} /></i><b>Email us</b><span>connect@lenstrybe.com</span></a>
          </div>
        </div>
      </section>

      <div className="lt">
        <Aurora />
        <section className="sec" id="answers" style={{ paddingTop: 'clamp(40px,6vw,72px)', scrollMarginTop: 70 }}><div className="wrap faqwrap">
          <div className="stephead centre rv"><div><p className="eb g">Quick answers</p><h2>Short answers, <em>no asterisks.</em></h2></div></div>
          <div className="topics rv">{TOPICS.map(t => <button key={t.k} className={'chip' + (topic === t.k ? ' on' : '')} onClick={() => { setTopic(t.k); setOpen(-1) }}>{t.l}</button>)}</div>
          <div className="faq rv">{list.length ? list.map(([t, qq, a], i) => (
            <div key={qq} className={'fq lg' + (open === i ? ' on' : '')}>
              <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><span>{qq}</span><i>+</i></button>
              <p>{a}</p>
            </div>
          )) : <div className="empty lg">Nothing matches that yet. Ask a person below and we will add the answer here.</div>}</div>
        </div></section>

        <section className="sec" id="message" style={{ paddingTop: 0, scrollMarginTop: 70 }}><div className="wrap">
          <div className="msgrid rv">
            <div>
              <div className="stephead"><div><p className="eb g">Message a person</p><h2>Tell us what <em>happened.</em></h2></div></div>
              <p className="lead" style={{ marginLeft: 0 }}>Say what you expected and what happened instead. Screenshots help. Replies come from connect@lenstrybe.com, usually within a business day, and always from a person.</p>
              <div className="pts">
                <div><b>Creatives</b><span>Billing, your profile, bookings, documents and Lumi. Include the booking or invoice number if you have one.</span></div>
                <div><b>Clients</b><span>Anything about a booking or a payment. Your thread link is the quickest way for us to find it.</span></div>
                <div><b>Press and partners</b><span>Pick "Media, partnership or press" and we will route it to Michael.</span></div>
              </div>
            </div>
            <form className="card lg mform" onSubmit={send}>
              <div className="two"><div className="field"><label htmlFor="sn">Your name</label><input id="sn" placeholder="Mara Okafor" autoComplete="name" /></div><div className="field"><label htmlFor="se">Reply-to email</label><input id="se" type="email" placeholder="you@studio.com.au" autoComplete="email" /></div></div>
              <div className="two"><div className="field"><label htmlFor="sc">Topic</label><select id="sc" defaultValue=""><option value="">Choose a topic (optional)</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div><div className="field"><label htmlFor="ss">Subject</label><input id="ss" placeholder="A short summary" /></div></div>
              <div className="field"><label htmlFor="sm">What is going on</label><textarea id="sm" rows={6} placeholder="Tell us what you expected and what happened instead." /></div>
              <div className="mrow"><button type="submit" className="btn k">Send message <Icon name="arrow" size={14} /></button><span>Or email <a href="mailto:connect@lenstrybe.com">connect@lenstrybe.com</a></span></div>
            </form>
          </div>
        </div></section>

        <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="closer lg rv">
            <div><p className="eb g">Still stuck?</p><h2>Lumi knows the product <em>inside out.</em></h2></div>
            <div className="ctas"><Link className="btn" to="/app/lumi">Ask Lumi in the workspace <Icon name="arrow" size={14} /></Link><Link className="btn w" to="/legal/terms">Terms and policies</Link></div>
          </div>
        </div></section>
      </div>
    </>
  )
}
