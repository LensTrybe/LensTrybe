import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, addDays, daysBetween } from '../../lib/store'
import { parseBrief } from '../../data/creatives'
import { fmt } from '../../lib/format'

// The client side of the job board. Post what you need in a minute, creatives who fit and are free
// reply with a quote, you pick one and the booking carries on in a thread. Free for clients, always.
const KINDS = ['Wedding', 'Real estate', 'Brand', 'Headshots', 'Event', 'Family', 'Other']
const TAG_KIND = { wedding: 'Wedding', realestate: 'Real estate', brand: 'Brand', event: 'Event', portrait: 'Headshots' }
const STATES = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT']
const WHY = [['Free, always', 'Posting is free and stays free. Creatives pay a flat subscription, never a commission, so the price you are quoted is the price.'], ['Only people who are free', 'Every creative\'s calendar is live. If your date is taken, they do not see the job.'], ['Quotes, not applications', 'Each reply is a real price with what is included. Pick one and the booking, contract and deposit carry on behind one link.']]
const ago = d => { const n = daysBetween(d, TODAY); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago' }

export default function JobsBoard() {
  const { id } = useParams()
  return id ? <ClientJob id={id} /> : <PostJob />
}

function PostJob() {
  const F = useFlows(); const { s, toast } = F; const nav = useNavigate(); const [params] = useSearchParams()
  const cv = useRef(null)
  const brief = useMemo(() => parseBrief(params.get('q') || ''), [params])
  const isoFrom = d => { const m = (d || '').match(/^(\d{1,2}) (\w{3})/); if (!m) return ''; const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].toLowerCase()); if (mo < 0) return ''; let y = Number(TODAY.slice(0, 4)); let s = y + '-' + String(mo + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0'); if (s < TODAY) s = (y + 1) + s.slice(4); return s }
  const [v, setV] = useState(() => ({ t: '', k: TAG_KIND[brief.tags.find(t => TAG_KIND[t])] || 'Wedding', ct: brief.tags.includes('video') && !brief.tags.includes('photo') ? ['Videographer'] : brief.tags.includes('video') ? ['Photographer', 'Videographer'] : ['Photographer'], loc: brief.place ? brief.place.replace(/\b\w/g, c => c.toUpperCase()) + ', QLD' : '', d: isoFrom(brief.date), flex: brief.date && !/\d/.test(brief.date) ? brief.date : '', flexOn: !!(brief.date && !/\d/.test(brief.date)), b: brief.budget || '', hrs: '', w: params.get('q') || '', by: '', em: '', ph: '' }))
  const [step, setStep] = useState(1), [err, setErr] = useState('')
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  useEffect(() => { document.title = 'Post a job · LensTrybe' }, [])
  const openJobs = s.jobs.filter(j => j.st === 'open' && j.expires >= TODAY && j.kind === 'client').sort((a, b) => a.posted < b.posted ? 1 : -1)
  const replies = openJobs.reduce((t, j) => t + (j.replies || 0), 0)
  const next = e => { e.preventDefault(); if (step === 1) { if (!v.t.trim() || !v.loc.trim() || !v.w.trim()) return setErr('Give it a title, a place and a few lines about the job.'); setErr(''); setStep(2); return }
    if (!v.by.trim() || !/.+@.+\..+/.test(v.em)) return setErr('Your name and a real email, so replies can reach you.'); setErr('')
    const jid = F.postClientJob(v); toast('Posted. Creatives who fit will see it in the next few minutes.'); nav('/jobs/' + jid) }
  const guess = { Wedding: [2500, 4500], 'Real estate': [300, 1200], Brand: [900, 2500], Headshots: [400, 1500], Event: [1200, 4000], Family: [350, 700], Other: [500, 2000] }[v.k]
  return (
    <>
      <section className="hiw join jobsx dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="jgrid">
          <div className="jpitch">
            <p className="eb">Post a job · free for clients</p>
            <h1>Say what you need. <em>They come to you.</em></h1>
            <p className="sub">Photographers and videographers who do your kind of work, near you and free on the day, reply with a real quote. You pick one. No account needed, nothing to pay LensTrybe, ever.</p>
            <div className="why">{WHY.map(([t, d]) => <div key={t}><i><Icon name="check" size={13} /></i><div><b>{t}</b><span>{d}</span></div></div>)}</div>
            <p className="jbnow"><b>{openJobs.length}</b> jobs open right now · <b>{replies}</b> quotes sent this week · most jobs get their first reply within <b>2 hours</b></p>
          </div>
          <div className="lpane lg d">
            <div className="jbsteps"><span className={step >= 1 ? 'on' : ''}><i>1</i>The job</span><span className={step >= 2 ? 'on' : ''}><i>2</i>You</span><span><i>3</i>Quotes arrive</span></div>
            <form onSubmit={next} className="lform" noValidate>
              {step === 1 ? <>
                <label className="lf"><span>What do you need</span><input value={v.t} onChange={e => set('t', e.target.value)} placeholder={{ Wedding: 'Wedding photographer, Montville', 'Real estate': 'Photos for three listings, Noosa', Brand: 'Brand shoot for a new café', Headshots: 'Team headshots, 40 people', Event: 'Conference, two days, Brisbane', Family: 'Family session on the beach', Other: 'Tell us in a line' }[v.k]} autoFocus /></label>
                <div className="two">
                  <label className="lf"><span>Kind of job</span><div className="lsel"><select value={v.k} onChange={e => set('k', e.target.value)}>{KINDS.map(x => <option key={x}>{x}</option>)}</select><Icon name="back" size={14} /></div></label>
                  <label className="lf"><span>Who</span><div className="lsel"><select value={v.ct.length === 2 ? 'Both' : v.ct[0]} onChange={e => set('ct', e.target.value === 'Both' ? ['Photographer', 'Videographer'] : [e.target.value])}><option>Photographer</option><option>Videographer</option><option>Both</option></select><Icon name="back" size={14} /></div></label>
                </div>
                <div className="two">
                  <label className="lf"><span>Where</span><input value={v.loc} onChange={e => set('loc', e.target.value)} placeholder="Montville, QLD" list="jb-states" /><datalist id="jb-states">{STATES.map(x => <option key={x} value={(v.loc.split(',')[0] || 'Brisbane') + ', ' + x} />)}</datalist></label>
                  <label className="lf"><span>When <button type="button" className="forgot" onClick={() => setV(o => ({ ...o, flexOn: !o.flexOn, d: o.flexOn ? o.d : '' }))}>{v.flexOn ? 'Pick a date instead' : 'Flexible?'}</button></span>{v.flexOn ? <input value={v.flex} onChange={e => set('flex', e.target.value)} placeholder="Mid October, weekdays" /> : <input type="date" value={v.d} min={TODAY} onChange={e => set('d', e.target.value)} />}</label>
                </div>
                <div className="two">
                  <label className="lf"><span>Budget (AUD)</span><input type="number" inputMode="numeric" value={v.b} onChange={e => set('b', e.target.value)} placeholder={guess ? 'Most pay ' + fmt(guess[0]) + ' to ' + fmt(guess[1]) : '1500'} /></label>
                  <label className="lf"><span>How long</span><input value={v.hrs} onChange={e => set('hrs', e.target.value)} placeholder="Half day, 2 hours, full day" /></label>
                </div>
                <label className="lf"><span>The brief</span><textarea rows={4} value={v.w} onChange={e => set('w', e.target.value)} placeholder="What is happening, who is there, what you want back and when. A few honest lines beat a long list." /></label>
                {err && <p className="jberr">{err}</p>}
                <button type="submit" className="btn w lg">Next, your details <Icon name="arrow" size={14} /></button>
                <p className="tiny">Takes about a minute. Your contact details stay private until you accept a quote.</p>
              </> : <>
                <div className="jbsum"><b>{v.t}</b><span>{v.k} · {v.loc}{v.d ? ' · ' + nice(v.d, { weekday: 'short' }) : v.flex ? ' · ' + v.flex : ''}{v.b ? ' · ' + fmt(v.b) : ''}</span><button type="button" className="forgot" onClick={() => setStep(1)}>Edit</button></div>
                <label className="lf"><span>Your name</span><input value={v.by} onChange={e => set('by', e.target.value)} placeholder="Harper Ellis, or your business" autoFocus autoComplete="name" /></label>
                <div className="two">
                  <label className="lf"><span>Email</span><input type="email" value={v.em} onChange={e => set('em', e.target.value)} placeholder="you@email.com" autoComplete="email" /></label>
                  <label className="lf"><span>Phone <em className="opt">optional</em></span><input type="tel" value={v.ph} onChange={e => set('ph', e.target.value)} placeholder="04xx xxx xxx" autoComplete="tel" /></label>
                </div>
                {err && <p className="jberr">{err}</p>}
                <button type="submit" className="btn w lg">Post the job <Icon name="arrow" size={14} /></button>
                <p className="tiny">Quotes land on one page and in your inbox. The job comes down after 30 days or when you pick someone.</p>
              </>}
            </form>
            <p className="lfoot">By posting you agree to the <Link to="/legal/terms">terms</Link> and <Link to="/legal/privacy">privacy policy</Link>. Prefer to browse? <Link to="/creatives">Find a creative</Link> or <Link to="/">ask in one sentence</Link>.</p>
          </div>
        </div>
      </section>
      <div className="lt"><Aurora />
        <section className="sec jbopen"><div className="wrap">
          <div className="stephead"><div><p className="eb g">On the board now</p><h2>What people are <em>asking for.</em></h2></div><p className="lead" style={{ margin: 0, maxWidth: 46 + 'ch' }}>Names and contact details are never shown here. Creatives see the brief, the place, the date and the budget, and reply if they fit.</p></div>
          <div className="jbgrid">{openJobs.slice(0, 9).map(j => <div key={j.id} className="jbcard lg"><div className="jbtop"><span className="jbk">{j.k}</span><span className="jbwhen">{ago(j.posted)}</span></div><b>{j.t}</b><p>{j.w.length > 150 ? j.w.slice(0, 150).replace(/\s\S*$/, '') + '…' : j.w}</p><div className="jbmeta"><span><Icon name="pin" size={12} />{j.loc}</span><span><Icon name="cal" size={12} />{F.jobDate(j)}</span><span className="m">{fmt(j.b)}</span></div><div className="jbfoot"><span className={'jbrep' + (j.replies ? ' on' : '')}>{j.replies ? j.replies + (j.replies === 1 ? ' quote' : ' quotes') + ' so far' : 'Waiting for the first quote'}</span><span>{j.ct.join(' or ')}</span></div></div>)}</div>
          <div className="jbhow">{[['Post it', 'A title, where, when, a budget and a few lines. About a minute.'], ['Quotes arrive', 'Creatives who do that work, are near you and free that day reply with a price and what is included. Most within two hours.'], ['Pick one', 'Compare on one page. Accept a quote and the booking carries on in one thread: contract, deposit, gallery. Everyone else is told kindly.']].map(([t, d], i) => <div key={t}><i>{i + 1}</i><b>{t}</b><span>{d}</span></div>)}</div>
          <div className="ctas" style={{ justifyContent: 'center' }}><button className="btn k" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Post a job <Icon name="arrow" size={14} /></button><Link className="btn g" to="/join">I'm a creative</Link></div>
        </div></section>
      </div>
    </>
  )
}

// The client's own page for a job they posted: the brief, the quotes as they arrive, accept or decline.
function ClientJob({ id }) {
  const F = useFlows(); const { s, toast } = F; const nav = useNavigate()
  const j = s.jobs.find(x => x.id === id)
  const [open, setOpen] = useState(null)
  useEffect(() => { if (j) document.title = j.t + ' · LensTrybe' }, [j])
  // Sample replies arrive for a freshly posted job so the page is not empty; the real ones come from creatives
  useEffect(() => { if (!j || j.kind !== 'client' || (j.apps || []).length || !j.client) return; const t = setTimeout(() => { F.upd('jobs', id, x => ({ replies: (x.replies || 0) + 2, apps: [{ id: 'a1', n: 'Mara Okafor', c: 'Noosaville', r: 4.9, rv: 41, seed: 3, mood: 'golden', price: Math.round((x.b || 1500) * 1.05 / 10) * 10, incl: (x.hrs || 'Half day') + ' on site, edited gallery within 7 days, one round of changes, travel included', msg: 'Hi ' + x.by.split(' ')[0] + ', I would love to do this. ' + x.k + ' is my kind of work' + (x.d ? ' and ' + nice(x.d) + ' is open' : '') + '. Quote attached, and I have held the day for you until ' + nice(addDays(TODAY, 5), { weekday: 'long' }) + '.', at: TODAY, st: 'pending', hold: x.d ? addDays(TODAY, 5) : '', slug: 'mara' }, { id: 'a2', n: 'Tane Walker', c: 'Maroochydore', r: 4.8, rv: 27, seed: 7, mood: 'cool', price: Math.round((x.b || 1500) * 0.9 / 10) * 10, incl: (x.hrs || 'Half day') + ', 60 edited photos within 10 days', msg: 'Hi there, happy to help with this one. I have shot a few like it this year, gallery link on my profile.', at: TODAY, st: 'pending', slug: 'tane' }] })) }, 2500); return () => clearTimeout(t) }, [j?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!j) return <section className="hiw dark darkhero"><div className="jgrid"><div className="jpitch"><p className="eb">Job board</p><h1>That job is <em>not here.</em></h1><p className="sub">It may have been taken down, or the link is old.</p><div className="ctas"><Link className="btn w" to="/jobs">Post a job</Link></div></div></div></section>
  const apps = (j.apps || []).filter(a => a.st !== 'declined'), accepted = j.apps?.find(a => a.st === 'accepted')
  const accept = a => { F.clientAccept(j.id, a.id); toast('Booked with ' + a.n.split(' ')[0] + '. Everyone else has been told.'); setTimeout(() => nav('/portal/' + (a.slug || 'mara')), 900) }
  const decline = a => { F.clientDecline(j.id, a.id); toast(a.n.split(' ')[0] + ' has been told, kindly.') }
  const close = () => { F.upd('jobs', j.id, { st: 'closed' }); toast('Taken down.') }
  const left = daysBetween(TODAY, j.expires)
  return (
    <div className="lt jbclient"><Aurora />
      <section className="sec"><div className="wrap">
        <div className="jbhead">
          <div><p className="eb g">Your job · {j.st === 'open' ? left + ' days left on the board' : j.st === 'filled' ? 'Booked' : 'Taken down'}</p><h1>{j.t}</h1><p className="lead">{j.k} · {j.loc} · {F.jobDate(j)}{j.hrs ? ' · ' + j.hrs : ''}{j.b ? ' · ' + fmt(j.b) + ' budget' : ''}</p></div>
          {j.st === 'open' && <div className="ctas"><button className="btn g" onClick={() => { navigator.clipboard?.writeText(location.href); toast('Link copied. This page is yours; keep the link.') }}>Copy my link</button><button className="btn g" onClick={close}>Take it down</button></div>}
        </div>
        <div className="jbcols">
          <div className="jbmain">
            <div className="jbstage">{['Posted', 'Quotes arriving', 'Pick one', 'Booked'].map((t, i) => { const at = accepted ? 3 : apps.length ? 1 : 0; return <span key={t} className={i < at ? 'd' : i === at ? 'c' : ''}><i>{i < at ? <Icon name="check" size={9} /> : i + 1}</i>{t}</span> })}</div>
            {accepted && <div className="jbcard lg won"><div className="jbtop"><span className="jbk">Booked</span></div><b>You are booked with {accepted.n}</b><p>The booking carries on in one thread: messages, the contract, the deposit and the gallery, all behind one link. {accepted.n.split(' ')[0]} has your details now.</p><div className="ctas"><Link className="btn w" to={'/portal/' + (accepted.slug || 'mara')}>Open the booking <Icon name="arrow" size={14} /></Link></div></div>}
            <h3 className="jbh3">{apps.length ? apps.length + (apps.length === 1 ? ' quote' : ' quotes') : 'Quotes'}<small>{apps.length ? 'Compare, ask a question, pick one' : 'Creatives who fit are being told now. The first usually lands within two hours; we email you each time one does.'}</small></h3>
            {!apps.length && <div className="jbcard lg wait"><span className="lm" /><div><b>Waiting for the first quote</b><p>Nothing to do yet. Keep this link; it is the only way back to this page.</p></div></div>}
            {apps.map(a => <div key={a.id} className={'jbq lg' + (a.st === 'accepted' ? ' acc' : a.st === 'closed' ? ' off' : '')}>
              <div className="jbqhead"><span className="jbav"><Still seed={a.seed} mood={a.mood} style={{ borderRadius: '50%' }} /></span><div><b>{a.n}</b><small>{a.c} · ★ {a.r} from {a.rv} reviews · replied {ago(a.at)}</small></div><div className="jbprice"><b>{fmt(a.price)}</b><small>incl. GST</small></div></div>
              <p className="jbincl"><b>Included:</b> {a.incl}</p>
              <p className="jbmsg">{open === a.id || a.msg.length < 160 ? a.msg : a.msg.slice(0, 160) + '…'}{a.msg.length >= 160 && <button className="forgot" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? ' less' : ' more'}</button>}</p>
              {a.hold && a.st === 'pending' && <p className="jbhold"><Icon name="cal" size={12} />Holding {nice(j.d)} for you until {nice(a.hold)}</p>}
              <div className="ctas">{a.st === 'pending' && j.st === 'open' && <><button className="btn k" onClick={() => accept(a)}>Accept this quote <Icon name="arrow" size={14} /></button><Link className="btn g" to={'/creatives/' + (a.slug || 'mara')}>See their work</Link><button className="btn g" onClick={() => toast('Sent. ' + a.n.split(' ')[0] + ' replies here and by email.')}>Ask a question</button><button className="lnk" onClick={() => decline(a)}>No thanks</button></>}{a.st === 'accepted' && <span className="st ok">Accepted</span>}{a.st === 'closed' && <span className="st grey">Closed, you booked someone else</span>}</div>
            </div>)}
          </div>
          <aside className="jbside">
            <div className="jbcard lg"><b>The brief</b><p style={{ whiteSpace: 'pre-line' }}>{j.w}</p><div className="jbmeta"><span><Icon name="pin" size={12} />{j.loc}</span><span><Icon name="cal" size={12} />{F.jobDate(j)}</span>{j.b ? <span className="m">{fmt(j.b)}</span> : null}</div><small className="jbfine">Posted {nice(j.posted)} by {j.by}. Your email and phone are only shared with the creative you accept.</small></div>
            <div className="jbcard lg tips"><b>Picking well</b><ul><li>Look at the work first. Every creative here has a profile and galleries.</li><li>Price is not the only number. What is included, and how soon you get it, matter as much.</li><li>A held date means they have pencilled you in. It lapses on its own, nothing to do.</li><li>Accepting a quote does not charge you. A deposit comes later, through the booking, when the contract is signed.</li></ul></div>
          </aside>
        </div>
      </div></section>
    </div>
  )
}
