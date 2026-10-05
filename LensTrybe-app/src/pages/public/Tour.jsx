import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'

// The tour (5 Oct): a guided walk through the workspace for a creative who has been sent the link.
// Not linked from anywhere and kept out of search (seo.js, robots.txt); it exists only at /tour. A dark opener with the
// lens, then one slide per part of the workspace on the light body: the recorded screen on the
// right, what it does for the creative on the left. Click through, or press play and let it run.
// The recordings are the demo workspace (Mara Okafor, sample data), made by the tour recorder in
// LensTrybe Main / Marketing / Tour and copied into public/tour.
const SLIDES = [
  { id: 't01-welcome', eb: 'Getting found', h: 'Clients post the job. ', em: 'You reply with a price.', p: 'On lenstrybe.com a client says what they need, where and when, in about a minute. It goes to the photographers and videographers who do that work, and the job is theirs to answer with a real quote. Free for the client, and no commission on what you earn.',
    pts: ['Jobs come to you, matched on the work you do and the dates you are free', 'You reply with a quote, not a bid', 'No commission on the job, ever'], cap: 'A client posts a wedding in Noosa from the home page. It takes about a minute.' },
  { id: 't02-today', eb: 'Your morning', h: 'Open it and ', em: 'know what needs you.', p: 'Today reads your threads, calendar, money and inbox overnight and tells you in plain English what is on, what is waiting, and what it has already drafted.',
    pts: ['The day in one paragraph, with the actions beside it', 'Earned, outstanding, booked and profile views at a glance', 'Reply to a new enquiry in two clicks'], cap: 'Lumi\'s brief, the money tiles, and a reply to Ruby and Sol sent from the brief.' },
  { id: 't03-edit-profile', eb: 'Your page', h: 'Your profile is ', em: 'your website.', p: 'Portfolio, packages, availability and a one-line pitch. LensTrybe shows you what is missing, because finished profiles get found and get enquiries.',
    pts: ['Twelve-step checklist, and it tells you when you are complete', 'Choose what clients can do: enquire, see prices, book and pay a deposit', 'Lumi rewrites your bio to match the work you actually do'], cap: 'The portfolio grid, the completeness ring, and switching on deposits.' },
  { id: 't04-view-profile', eb: 'Your page', h: 'Exactly what ', em: 'a client sees.', p: 'Your public page on lenstrybe.com: the work, the free dates, reviews from real bookings, and one tap to ask.',
    pts: ['Live free dates, so they ask about days you can take', 'Verified reviews, tied to real bookings', 'The Founding Creative badge, if you are one of the hundred'], cap: 'Mara\'s public page, as a client would scroll it.' },
  { id: 't05-brand-kit', eb: 'Your page', h: 'One look, ', em: 'everywhere.', p: 'Pick a look once. Every quote, invoice, contract, portal and gallery a client sees carries your name, your colours and your logo, not ours.',
    pts: ['Six starting looks, each one yours to change', 'Your logo and business name on every document', 'Preview on a phone and on a desktop before you save'], cap: 'Switching looks and watching the invoice preview restyle.' },
  { id: 't06-job-board', eb: 'Getting work', h: 'Jobs that ', em: 'come to you.', p: 'Clients post what they need. You see the briefs near you with a fit score, and reply with a real quote. No bidding, no race to the bottom, and nothing taken from what you earn.',
    pts: ['Fit score on every brief: the work, the place, the date, the budget', 'Reply with a quote from your packages', 'Alerts when a job fits you'], cap: 'A team headshots brief at 91% fit, opened and answered with a quote.' },
  { id: 't07-threads', eb: 'Getting work', h: 'Every client, ', em: 'one thread.', p: 'Enquiry, quote, contract, deposit, call sheet and gallery, all in the same conversation. Lumi drafts the first reply in your words; you read it and send.',
    pts: ['The stage bar shows where every job is up to', 'Documents sit in the thread, where the client can find them', 'Reply with a quote attached in one click'], cap: 'Ruby and Sol\'s enquiry answered, then Harper and Leo\'s thread from enquiry to shoot day.' },
  { id: 't08-quotes', eb: 'Getting paid', h: 'Quotes they accept ', em: 'on their phone.', p: 'Build a quote from your packages. See when it is opened. When it is read and not answered, Lumi offers a nudge in your words.',
    pts: ['Acceptance rate and time to accept, so you can price with confidence', 'Viewed twice, no reply? One tap to nudge', 'Accept turns into a contract and a deposit invoice on its own'], cap: 'The quotes list, a quote viewed twice, and Lumi\'s nudge ready to send.' },
  { id: 't09-contracts', eb: 'Getting paid', h: 'Signed ', em: 'in hours, not weeks.', p: 'Plain English contracts from your templates, signed on a phone. Your own paper lives here too.',
    pts: ['Templates for weddings, events and elopements, ready to edit', 'Average time to sign: hours, because it travels with the quote', 'Both copies filed in the thread'], cap: 'Twelve signed this year, the signed contract rows, and the templates.' },
  { id: 't10-calendar', eb: 'Your time', h: 'A calendar that ', em: 'books itself.', p: 'Accept a quote and the date locks on every calendar you use. Block days off and clients stop seeing them.',
    pts: ['Google Calendar sync, both ways', 'Tap a day for the job, the address and the invoice', 'Block days, a date range, or recurring days off'], cap: 'A booked day opened, then three days blocked off.' },
  { id: 't11-availability', eb: 'Your time', h: 'Only the days ', em: 'you want.', p: 'Twelve weeks at a glance: open, booked, held, away. Clients only ever see what is actually free, and the ask bar can offer dates without asking you.',
    pts: ['Holds for dates you have pencilled, which lapse on their own', 'Saturdays open to Christmas, counted for you', 'Buffers and travel days, so nothing is back to back'], cap: 'The twelve-week grid and the rules around it.' },
  { id: 't12-meetings', eb: 'Your time', h: 'Calls booked ', em: 'from your link.', p: 'Discovery calls, planning sessions and album selections, booked by the client from your link, straight onto your calendar.',
    pts: ['Your booking link, with the session types you choose', 'Reminders go out the day before and an hour before', 'Lumi briefs you before the call'], cap: 'This week\'s calls, the booking link copied, and a new meeting.' },
  { id: 't13-projects', eb: 'The job', h: 'Every job, ', em: 'start to finish.', p: 'A board of every job in your own stages: new enquiry, quote sent, booked, in progress, delivered, complete. Drag a card to move it along.',
    pts: ['What is on the books and what is still to collect', 'Open tasks across every job, with what is due this week', 'Board or list, your choice'], cap: 'The pipeline board, then the same jobs as a list.' },
  { id: 't14-project-page', eb: 'The job', h: 'The whole job ', em: 'on one page.', p: 'Brief, checklist, people, meetings, gear, files and money for one job. Set the stage, tick the checklist, and see what the client still owes.',
    pts: ['Shoot-day checklists from your templates', 'Value, paid and outstanding for this job', 'The people on it: the client and your crew'], cap: 'Harper and Leo\'s wedding: set to In progress, three tasks ticked, then the money tab.' },
  { id: 't15-crm', eb: 'Clients', h: 'Everyone you have ', em: 'ever shot for.', p: 'Every client, with every job behind the name: what they have spent, when you last worked together, and who they referred.',
    pts: ['Lifetime value and jobs per client', 'Filter by the kind of work', 'Came back, referred, booked more than once'], cap: 'Wedding clients filtered, then Harper Ellis opened.' },
  { id: 't16-collaborate', eb: 'Clients', h: 'Your crew, ', em: 'booked onto the job.', p: 'Second shooters, editors and drone pilots you work with. Book them onto a job and they land on your calendar when they confirm.',
    pts: ['Rates, roles and how many jobs you have done together', 'Confirmations and payments in one place', 'Pass a job on when you cannot take it'], cap: 'The crew list, and Sam booked onto a job.' },
  { id: 't17-inventory', eb: 'The job', h: 'Every body and lens, ', em: 'accounted for.', p: 'Serials, replacement value, insurance and service dates, plus a packing list for tomorrow\'s shoot.',
    pts: ['Export for your insurer in one click', 'Service due reminders', 'Tick the packing list the night before'], cap: 'A lens opened, then the packing list for Coastline Realty ticked off.' },
  { id: 't18-invoicing', eb: 'Getting paid', h: 'Invoices that ', em: 'chase themselves.', p: 'Invoices come from your quotes, branded, paid by card or transfer. Reminders go out on their own, and Lumi chases the late ones politely.',
    pts: ['Average days to paid, and it falls', 'Deposit and balance scheduled from the booking', 'Mark paid, send a receipt, done'], cap: 'The balance invoice marked paid, then a new invoice.' },
  { id: 't19-money', eb: 'Getting paid', h: 'One ledger, ', em: 'ready for tax time.', p: 'Everything in and out, invoices, quotes, contracts and expenses on one ledger, with the year drawn out so you can see it.',
    pts: ['Paid this month against last month', 'Quoted and waiting, so you know what is in the pipeline', 'GST set aside as you go'], cap: 'The money chart, then the ledger filtered to invoices, quotes and expenses.' },
  { id: 't20-expenses-tax', eb: 'Getting paid', h: 'Receipts in, ', em: 'BAS out.', p: 'Snap a receipt and the expense is tagged for tax as it happens. The tax hub turns the ledger into GST to pay, income for the year, and a BAS worksheet.',
    pts: ['Deductible spend by category', 'GST to pay this quarter and what is already set aside', 'Send it to your accountant with one button'], cap: 'An expense added, then the tax hub and Prepare BAS.' },
  { id: 't21-deliver', eb: 'Delivery', h: 'Galleries behind ', em: 'one link.', p: 'Drop files anywhere on the screen. The client gets a branded gallery at one link, downloads that work on a phone, and expiry reminders sent for you.',
    pts: ['You see when they open it and what they download', 'Sneak peek the same night, full gallery when it is ready', 'Storage that scales with your plan'], cap: 'The gallery grid, the Harper and Leo gallery, and the link sent.' },
  { id: 't22-client-portal', eb: 'Delivery', h: 'What your client ', em: 'gets.', p: 'One link, no login. The quote, the contract, the deposit, the call sheet and the gallery, with the same stage bar you see, so nobody asks where things are up to.',
    pts: ['Accept, sign and pay from a phone', 'Messages land in your thread', 'Reviews requested three days after the gallery opens'], cap: 'Harper and Leo\'s portal, scrolled from the booking to the call sheet.' },
  { id: 't23-reviews', eb: 'Growing', h: 'Reviews you ', em: 'do not have to ask for.', p: 'Requested automatically after delivery, verified to a real booking, shown on your page. Lumi drafts the reply; you post it.',
    pts: ['Four-star-and-under reviews come to you first for 48 hours', 'Feature the best on your page', 'Replies lift repeat bookings'], cap: 'A review opened, Lumi\'s reply drafted and posted.' },
  { id: 't24-content', eb: 'Growing', h: 'Posts drafted ', em: 'from your own work.', p: 'A content calendar for the week, and ideas drafted from the galleries you just delivered. Keep one and it lands on the calendar as a draft.',
    pts: ['What goes out where, and when', 'Ideas from galleries, reviews and gaps in your calendar', 'Instagram, Facebook, TikTok, LinkedIn and Google'], cap: 'A draft scheduled, then an idea kept.' },
  { id: 't25-performance-insights', eb: 'Growing', h: 'Know what ', em: 'brings the bookings.', p: 'Performance pulls the numbers from each platform. Insights follows a view to an enquiry to a booking, and shows where the enquiries came from.',
    pts: ['Best times to post, from your own numbers', 'Which posts brought enquiries, not just likes', 'Views to enquiries to booked, as a funnel'], cap: 'Reach by day and best times to post, then the enquiry funnel.' },
  { id: 't26-marketplace', eb: 'Growing', h: 'Gear, ', em: 'creative to creative.', p: 'Buy, sell and swap gear with other creatives on LensTrybe. List from your own inventory in a tap. No fee, no cut, you deal directly.',
    pts: ['Listings from your kit, with the serial and condition filled in', 'Open to swaps', 'Messages and offers in one place'], cap: 'Browsing listings, then one opened.' },
  { id: 't27-lumi', eb: 'Lumi', h: 'Ask or do ', em: 'anything.', p: 'The bar at the top does the work: type "invoice Coastline" and the invoice opens. Ask a question and Lumi answers from your real threads, calendar and money. You set how much she does on her own.',
    pts: ['Do it, ask me, or never, for every kind of action', 'Everything logged and undoable', 'Hours saved each week, counted'], cap: 'An invoice from the bar, the autonomy dials, and a question answered.' },
  { id: 't28-founding', eb: 'The Founding 100', h: 'One hundred places. ', em: 'Be one.', p: 'The first hundred creatives on LensTrybe get Trybe Complete free for twelve months, then $49 a month for life, normally $74.99. Three simple commitments in return: a finished profile within seven days, three jobs through the platform in six months, and a line of feedback each month.',
    pts: ['Zero commission, always', 'A permanent Founding Creative badge', 'A real say in what gets built'], cap: 'The founding page: the count, what you get, and what is asked in return.', founding: true },
]

export default function Tour() {
  const cv = useRef(null), deck = useRef(null), vid = useRef(null), music = useRef(null) // music: { ctx, gain }
  const [i, setI] = useState(0), [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [started, setStarted] = useState(false), [big, setBig] = useState(false)
  const fig = useRef(null)
  const fullscreen = () => { const el = fig.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el) }
  const s = SLIDES[i], n = SLIDES.length
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  // The music bed plays through Web Audio, not an <audio> element: a playing media element makes
  // some browsers pause the muted video beside it. Started on the first click (autoplay rules),
  // looped, and muted by the gain so the toggle is instant.
  const playMusic = useCallback(async () => {
    if (music.current) { if (music.current.ctx.state === 'suspended') music.current.ctx.resume(); return }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
      const ctx = new AC(), gain = ctx.createGain(); gain.gain.value = 0.28; gain.connect(ctx.destination)
      music.current = { ctx, gain }
      const buf = await ctx.decodeAudioData(await (await fetch('/tour/lenstrybe-tour-bed-v3.mp3')).arrayBuffer())
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start()
    } catch { /* no music is fine */ }
  }, [])
  useEffect(() => () => { music.current?.ctx.close() }, [])
  // moving to a slide always plays it; the play button is the only way to hold still
  const go = useCallback(k => { setStarted(true); setPlaying(true); playMusic(); setI(x => Math.max(0, Math.min(n - 1, x + k))) }, [n, playMusic])
  const jump = k => { setStarted(true); setPlaying(true); playMusic(); setI(k) }
  const start = () => { setStarted(true); setPlaying(true); playMusic(); deck.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  useEffect(() => { const k = e => { if (!started) return; if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [started, go])
  useEffect(() => { const m = music.current; if (!m) return; m.gain.gain.value = muted ? 0 : 0.28; if (playing && !muted) m.ctx.resume(); else m.ctx.suspend() }, [muted, playing])
  // the clip follows the play state: play runs it (and the next one when it ends), pause freezes it
  useEffect(() => { const v = vid.current; if (!v) return; v.muted = true; if (playing) v.play().catch(() => {}); else v.pause() }, [i, playing])
  const ended = () => { if (i < n - 1) go(1); else setPlaying(false) }
  return (
    <>
      <section className="hiw tourtop dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">A tour of LensTrybe · about nine minutes</p>
          <h1><span className="ln"><span>What LensTrybe does</span></span> <span className="ln"><span>for <em>your business.</em></span></span></h1>
          <p className="sub">Twenty-eight short recordings of the real workspace, one for each part, with what it does for a photographer or videographer. Click through at your own pace, or press play and let it run.</p>
          <div className="ctas"><button type="button" className="btn w lg" onClick={start}>Start the tour <Icon name="arrow" size={14} /></button><Link className="btn g lg" to="/founding">Skip to the Founding 100</Link></div>
          <p className="tourfine">Quiet music plays once you start. You can mute it at any time. The workspace shown is a sample business, not a real account.</p>
        </div>
      </section>

      <div className="lt tourlt" ref={deck}>
        <Aurora />
        <section className="sec tour"><div className="wrap">
          <div className="tourbar lg">
            <button type="button" className="tb" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous"><Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} /></button>
            <div className="tdots" role="tablist" aria-label="Slides">{SLIDES.map((x, k) => <button key={x.id} type="button" role="tab" aria-selected={k === i} className={k === i ? 'on' : k < i ? 'd' : ''} onClick={() => jump(k)} aria-label={'Slide ' + (k + 1)} />)}</div>
            <span className="tcount">{i + 1} of {n}</span>
            <button type="button" className={'tb' + (playing ? ' on' : '')} onClick={() => { setStarted(true); if (!playing) playMusic(); setPlaying(p => !p) }} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={13} style={{ fill: 'currentColor', stroke: 'none' }} /></button>
            <button type="button" className={'tb' + (muted ? '' : ' on')} onClick={() => setMuted(m => !m)} aria-label={muted ? 'Unmute music' : 'Mute music'}>{muted ? 'Music off' : 'Music on'}</button>
            <button type="button" className="tb tlay" onClick={() => setBig(b => !b)} aria-pressed={big} title={big ? 'Put the text beside the screen' : 'Make the screen bigger'}>{big ? 'Side by side' : 'Big screen'}</button>
            <button type="button" className="tb" onClick={() => go(1)} disabled={i === n - 1} aria-label="Next"><Icon name="arrow" size={14} /></button>
          </div>

          <div className={'tslide' + (big ? ' big' : '')} key={s.id}>
            <div className="ttext">
              <div className="tsay">
                <p className="eb g">{s.eb}</p>
                <h2>{s.h}<em>{s.em}</em></h2>
                <p className="lead">{s.p}</p>
              </div>
              <div className="tdo">
                <ul className="tpts">{s.pts.map(t => <li key={t}><i><Icon name="check" size={12} /></i>{t}</li>)}</ul>
                {s.founding && <div className="ctas"><Link className="btn k" to="/founding">Ask for a founding code <Icon name="arrow" size={14} /></Link><Link className="btn g" to="/pricing">See the plans</Link></div>}
              </div>
            </div>
            <figure className="tscreen lg" ref={fig}>
              <video ref={vid} src={'/tour/' + s.id + '.mp4'} poster={'/tour/' + s.id + '.jpg'} muted playsInline preload="auto" onEnded={ended} onDoubleClick={fullscreen} />
              <button type="button" className="tfull" onClick={fullscreen} aria-label="Full screen" title="Full screen (double-click the video also works)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg></button>
              <figcaption><span className="lm" />{s.cap}</figcaption>
            </figure>
          </div>

          <div className="tfoot">
            {i < n - 1 ? <button type="button" className="btn k" onClick={() => go(1)}>Next: {SLIDES[i + 1].eb === s.eb ? SLIDES[i + 1].h.trim().replace(/,$/, '') : SLIDES[i + 1].eb} <Icon name="arrow" size={14} /></button> : <Link className="btn k" to="/founding">Ask for a founding code <Icon name="arrow" size={14} /></Link>}
            <span className="tourfine">Use the arrow keys to move, space to play or pause. Ask for a founding code at lenstrybe.com/founding.</span>
          </div>
        </div></section>
      </div>
    </>
  )
}
