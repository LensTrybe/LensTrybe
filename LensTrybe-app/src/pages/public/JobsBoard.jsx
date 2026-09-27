import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { outside, waitlistTo } from '../../lib/region'
import Aurora from '../../components/Aurora'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, addDays, daysBetween } from '../../lib/store'
import { parseBrief } from '../../data/creatives'
import { fmt } from '../../lib/format'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import { imageUrl } from '../../backend/imageUrl'
import * as live from '../../lib/live'

// The client side of the job board. Post what you need in a minute, creatives who fit and are free
// reply with a quote, you pick one and the booking carries on in a thread. Free for clients, always.
const KINDS = ['Wedding', 'Real estate', 'Brand', 'Headshots', 'Event', 'Family', 'Other']
const TAG_KIND = { wedding: 'Wedding', realestate: 'Real estate', brand: 'Brand', event: 'Event', portrait: 'Headshots' }
const STATES = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT']
const WHY_LIVE = [['Free, always', 'Posting is free and stays free. Creatives pay a flat subscription, never a commission, so the price you are quoted is the price.'], ['People who do this work', 'Photographers and videographers on LensTrybe see your brief and reply if it is their kind of work and they are free.'], ['Quotes, not applications', 'Each reply is a real price with what is included. Accept one and you carry on with them in a thread.']]
const DRAFT = 'lt-job-draft'
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null') } catch (_) { return null } }
const saveDraft = v => { try { localStorage.setItem(DRAFT, JSON.stringify(v)) } catch (_) { /* private mode */ } }
const clearDraft = () => { try { localStorage.removeItem(DRAFT) } catch (_) { /* private mode */ } }
const WHY = [['Free, always', 'Posting is free and stays free. Creatives pay a flat subscription, never a commission, so the price you are quoted is the price.'], ['Only people who are free', 'Every creative\'s calendar is live. If your date is taken, they do not see the job.'], ['Quotes, not applications', 'Each reply is a real price with what is included. Pick one and the booking, contract and deposit carry on behind one link.']]
const ago = d => { const n = daysBetween(d, TODAY); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago' }

export default function JobsBoard() {
  const { id } = useParams()
  if (!id && outside()) return <Navigate to={waitlistTo('client')} replace />
  return id ? (LIVE ? <ClientJobLive id={id} /> : <ClientJob id={id} />) : <PostJob />
}

export function PostJob() {
  const F = useFlows(); const { s, toast } = F; const nav = useNavigate(); const [params] = useSearchParams()
  const { user, profile, clientAccount } = useAuth()
  const cv = useRef(null)
  const [liveOpen, setLiveOpen] = useState([]), [busy, setBusy] = useState(false)
  const brief = useMemo(() => parseBrief(params.get('q') || ''), [params])
  const isoFrom = d => { const m = (d || '').match(/^(\d{1,2}) (\w{3})/); if (!m) return ''; const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].toLowerCase()); if (mo < 0) return ''; let y = Number(TODAY.slice(0, 4)); let s = y + '-' + String(mo + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0'); if (s < TODAY) s = (y + 1) + s.slice(4); return s }
  const [v, setV] = useState(() => ({ t: params.get('q') ? [TAG_KIND[brief.tags.find(t => TAG_KIND[t])] || '', brief.tags.includes('video') && !brief.tags.includes('photo') ? 'videographer' : 'photographer'].filter(Boolean).join(' ').replace(/^./, c => c.toUpperCase()) + (brief.place ? ', ' + brief.place.replace(/\b\w/g, c => c.toUpperCase()) : '') : '', k: TAG_KIND[brief.tags.find(t => TAG_KIND[t])] || 'Wedding', ct: brief.tags.includes('video') && !brief.tags.includes('photo') ? ['Videographer'] : brief.tags.includes('video') ? ['Photographer', 'Videographer'] : ['Photographer'], loc: brief.place ? brief.place.replace(/\b\w/g, c => c.toUpperCase()) + ', QLD' : '', d: isoFrom(brief.date), flex: brief.date && !/\d/.test(brief.date) ? brief.date : '', flexOn: !!(brief.date && !/\d/.test(brief.date)), b: brief.budget || '', hrs: '', w: params.get('q') || '', by: '', em: '', ph: '' }))
  const [step, setStep] = useState(1), [err, setErr] = useState('')
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  useEffect(() => { document.title = 'Post a job · LensTrybe' }, [])
  useEffect(() => { if (LIVE) live.loadOpenJobs(9).then(setLiveOpen).catch(() => {}) }, [])
  // back from logging in or signing up: the job they filled in is waiting on step 2. Any other visit
  // with a saved, unposted job (say they pressed back on the login page) brings it back on step 1.
  const restored = useRef(false)
  useEffect(() => { if (!LIVE || params.get('q') || restored.current) return; const dr = readDraft() || user?.user_metadata?.job_draft; if (!dr?.t) return; restored.current = true; setV(o => ({ ...o, ...dr, by: o.by || dr.by || '' })); if (params.get('resume')) setStep(2) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const myName = (clientAccount ? [clientAccount.first_name, clientAccount.last_name].filter(Boolean).join(' ') : '') || profile?.business_name || ''
  useEffect(() => { if (LIVE && myName) setV(o => o.by ? o : { ...o, by: myName }) }, [myName])
  const openJobs = LIVE ? liveOpen : s.jobs.filter(j => j.st === 'open' && j.expires >= TODAY && j.kind === 'client').sort((a, b) => a.posted < b.posted ? 1 : -1)
  const replies = openJobs.reduce((t, j) => t + (j.replies || 0), 0)
  const next = e => { e.preventDefault(); if (step === 1) { if (!v.t.trim() || !v.loc.trim() || !v.w.trim()) return setErr('Give it a title, a place and a few lines about the job.'); setErr(''); setStep(2); return }
    if (LIVE) {
      if (!user) return
      if (!v.by.trim()) return setErr('Add your name, so creatives know who they are quoting.')
      if (busy) return; setBusy(true); setErr('')
      live.postJob({ ...v, d: v.flexOn ? '' : v.d, w: v.w + (v.flexOn && v.flex ? '\n\nWhen: ' + v.flex : '') + (v.hrs ? '\n\nHow long: ' + v.hrs : '') }).then(jid => { clearDraft(); live.clearJobDraftMeta(user); toast('Posted. Creatives who fit can reply now.'); nav('/jobs/' + jid) }).catch(x => setErr(x.message)).finally(() => setBusy(false))
      return
    }
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
            <p className="sub">{LIVE ? 'Photographers and videographers who do your kind of work reply with a real quote. You pick one. A free account keeps your quotes in one place; nothing to pay LensTrybe, ever.' : 'Photographers and videographers who do your kind of work, near you and free on the day, reply with a real quote. You pick one. No account needed, nothing to pay LensTrybe, ever.'}</p>
            <div className="why">{(LIVE ? WHY_LIVE : WHY).map(([t, d]) => <div key={t}><i><Icon name="check" size={13} /></i><div><b>{t}</b><span>{d}</span></div></div>)}</div>
            {LIVE ? (openJobs.length > 0 && <p className="jbnow"><b>{openJobs.length}{openJobs.length >= 9 ? '+' : ''}</b> {openJobs.length === 1 ? 'job' : 'jobs'} open right now</p>) : <p className="jbnow"><b>{openJobs.length}</b> jobs open right now · <b>{replies}</b> quotes sent this week · most jobs get their first reply within <b>2 hours</b></p>}
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
                {LIVE && !user ? <>
                  <p className="eb g" style={{ margin: '4px 0 0' }}>Last step</p>
                  <h2 style={{ fontSize: 24, lineHeight: 1.2, margin: '6px 0 8px', color: '#fff' }}>Make a free account to post it</h2>
                  <p className="tiny" style={{ fontSize: 14, marginTop: 0 }}>It takes a minute and it's free, always. Everything you've written is kept, so once you're in it's one tap to post.</p>
                  <div className="ctas" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="btn w lg" onClick={() => { saveDraft(v); try { sessionStorage.setItem('returnTo', '/jobs?resume=1') } catch (_) { /* */ } nav('/join/client') }}>Make a free account <Icon name="arrow" size={14} /></button><button type="button" className="btn g lg" onClick={() => { saveDraft(v); try { sessionStorage.setItem('returnTo', '/jobs?resume=1') } catch (_) { /* */ } nav('/login') }}>Log in</button></div>
                </> : LIVE ? <>
                  <label className="lf"><span>Your name</span><input value={v.by} onChange={e => set('by', e.target.value)} placeholder="Harper Ellis, or your business" autoComplete="name" /></label>
                  <p className="tiny" style={{ marginTop: 0 }}>Posting as {user.email}. Quotes are emailed here and wait on your job's page.</p>
                  {err && <p className="jberr">{err}</p>}
                  <button type="submit" className="btn w lg" disabled={busy}>{busy ? 'Posting' : 'Post the job'} <Icon name="arrow" size={14} /></button>
                  <p className="tiny">The job comes down after 30 days or when you accept a quote.</p>
                </> : <>
                <label className="lf"><span>Your name</span><input value={v.by} onChange={e => set('by', e.target.value)} placeholder="Harper Ellis, or your business" autoFocus autoComplete="name" /></label>
                <div className="two">
                  <label className="lf"><span>Email</span><input type="email" value={v.em} onChange={e => set('em', e.target.value)} placeholder="you@email.com" autoComplete="email" /></label>
                  <label className="lf"><span>Phone <em className="opt">optional</em></span><input type="tel" value={v.ph} onChange={e => set('ph', e.target.value)} placeholder="04xx xxx xxx" autoComplete="tel" /></label>
                </div>
                {err && <p className="jberr">{err}</p>}
                <button type="submit" className="btn w lg">Post the job <Icon name="arrow" size={14} /></button>
                <p className="tiny">Quotes land on one page and in your inbox. The job comes down after 30 days or when you pick someone.</p>
                </>}
              </>}
            </form>
            <p className="lfoot">By posting you agree to the <Link to="/legal/terms">terms</Link> and <Link to="/legal/privacy">privacy policy</Link>. Prefer to browse? <Link to="/creatives">Find a creative</Link>{!LIVE && <> or <Link to="/">ask in one sentence</Link></>}.</p>
          </div>
        </div>
      </section>
      <div className="lt"><Aurora />
        <section className="sec jbopen"><div className="wrap">
          <div className="stephead"><div><p className="eb g">On the board now</p><h2>What people are <em>asking for.</em></h2></div><p className="lead" style={{ margin: 0, maxWidth: 46 + 'ch' }}>Names and contact details are never shown here. Creatives see the brief, the place, the date and the budget, and reply if they fit.</p></div>
          <div className="jbgrid">{openJobs.slice(0, 9).map(j => <div key={j.id} className="jbcard lg"><div className="jbtop"><span className="jbk">{LIVE ? j.ct.join(' or ') : j.k}</span><span className="jbwhen">{ago(j.posted)}</span></div><b>{j.t}</b><p>{j.w.length > 150 ? j.w.slice(0, 150).replace(/\s\S*$/, '') + '…' : j.w}</p><div className="jbmeta"><span><Icon name="pin" size={12} />{j.loc}</span><span><Icon name="cal" size={12} />{LIVE ? (j.d ? nice(j.d) : 'Flexible') : F.jobDate(j)}</span>{(!LIVE || j.b) ? <span className="m">{fmt(j.b)}</span> : null}</div><div className="jbfoot">{LIVE ? <span className="jbrep">{j.k || 'Open'}</span> : <span className={'jbrep' + (j.replies ? ' on' : '')}>{j.replies ? j.replies + (j.replies === 1 ? ' quote' : ' quotes') + ' so far' : 'Waiting for the first quote'}</span>}<span>{j.ct.join(' or ')}</span></div></div>)}</div>
          {LIVE && !openJobs.length && <p className="lead" style={{ textAlign: 'center', margin: '0 auto 28px' }}>Nothing on the board right now. Yours could be the first.</p>}
          <div className="jbhow">{[['Post it', 'A title, where, when, a budget and a few lines. About a minute.'], ['Quotes arrive', LIVE ? 'Creatives who do that work reply with a price and what is included. Each one is emailed to you.' : 'Creatives who do that work, are near you and free that day reply with a price and what is included. Most within two hours.'], ['Pick one', 'Compare on one page. Accept a quote and the booking carries on in one thread: contract, deposit, gallery. Everyone else is told kindly.']].map(([t, d], i) => <div key={t}><i>{i + 1}</i><b>{t}</b><span>{d}</span></div>)}</div>
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

// Live: the poster's page for their job. Quotes arrive as creatives reply; accept one (the job fills,
// everyone else is told, a thread opens with that creative) or say no thanks.
function ClientJobLive({ id }) {
  const { toast } = useFlows(); const nav = useNavigate(); const { user, loading } = useAuth()
  const [j, setJ] = useState(undefined), [open, setOpen] = useState(null), [busy, setBusy] = useState('')
  const load = () => live.loadJob(id, user?.id).then(setJ).catch(() => setJ(null))
  useEffect(() => { if (!loading) load() }, [id, user?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (j) document.title = j.t + ' · LensTrybe' }, [j])
  const Shell = ({ children }) => <section className="hiw dark darkhero"><div className="jgrid"><div className="jpitch">{children}</div></div></section>
  if (j === undefined) return <Shell><p className="eb">Job board</p><h1>Loading…</h1></Shell>
  if (!j && !user) return <Shell><p className="eb">Job board</p><h1>Log in to see <em>your job.</em></h1><p className="sub">Quotes for a job are only shown to the person who posted it.</p><div className="ctas"><button className="btn w" onClick={() => { try { sessionStorage.setItem('returnTo', '/jobs/' + id) } catch (_) { /* */ } nav('/login') }}>Log in <Icon name="arrow" size={14} /></button></div></Shell>
  if (!j) return <Shell><p className="eb">Job board</p><h1>That job is <em>not here.</em></h1><p className="sub">It may have been taken down, or the link is old.</p><div className="ctas"><Link className="btn w" to="/jobs">Post a job</Link></div></Shell>
  if (!j.mine) return <Shell><p className="eb">On the board</p><h1>{j.t}</h1><p className="sub">{[j.ct.join(' or '), j.loc, j.d ? nice(j.d) : 'Date flexible', j.b ? fmt(j.b) + ' budget' : ''].filter(Boolean).join(' · ')}</p><p className="sub" style={{ whiteSpace: 'pre-line' }}>{j.w}</p><div className="ctas"><Link className="btn w" to="/app/jobs">Reply from your workspace <Icon name="arrow" size={14} /></Link><Link className="btn g" to="/jobs">Post a job</Link></div></Shell>
  const apps = j.apps.filter(a => !['withdrawn', 'declined'].includes(a.st)), accepted = j.apps.find(a => a.st === 'accepted')
  const run = async (key, fn) => { if (busy) return; setBusy(key); try { await fn() } catch (e) { toast(e.message) } finally { setBusy('') } }
  const accept = a => run(a.id, async () => { const r = await live.acceptReply(a.id); toast('Booked with ' + a.n.split(' ')[0] + '. Everyone else has been told.'); setTimeout(() => nav(r?.portal_token ? '/portal/' + r.portal_token : '/portal'), 900) })
  const decline = a => run(a.id, async () => { await live.declineReply(a.id); await load(); toast(a.n.split(' ')[0] + ' has been told, kindly.') })
  const close = () => run('close', async () => { await live.takeDownJob(j.id); await load(); toast('Taken down.') })
  const left = Math.max(0, daysBetween(TODAY, j.expires))
  const stageAt = accepted ? 3 : apps.length ? 1 : 0
  return (
    <div className="lt jbclient"><Aurora />
      <section className="sec"><div className="wrap">
        <div className="jbhead">
          <div><p className="eb g">Your job · {j.st === 'active' ? left + ' days left on the board' : j.st === 'filled' ? 'Booked' : j.st === 'expired' ? 'Expired' : 'Taken down'}</p><h1>{j.t}</h1><p className="lead">{[j.ct.join(' or '), j.loc, j.d ? nice(j.d, { weekday: 'short' }) : 'Date flexible', j.b ? fmt(j.b) + ' budget' : ''].filter(Boolean).join(' · ')}</p></div>
          {j.st === 'active' && <div className="ctas"><button className="btn g" onClick={() => { try { navigator.clipboard?.writeText(location.href)?.catch(() => {}) } catch (_) { /* */ } toast('Link copied.') }}>Copy my link</button><button className="btn g" disabled={!!busy} onClick={close}>Take it down</button></div>}
        </div>
        <div className="jbcols">
          <div className="jbmain">
            <div className="jbstage">{['Posted', 'Quotes arriving', 'Pick one', 'Booked'].map((t, i) => <span key={t} className={i < stageAt ? 'd' : i === stageAt ? 'c' : ''}><i>{i < stageAt ? <Icon name="check" size={9} /> : i + 1}</i>{t}</span>)}</div>
            {accepted && <div className="jbcard lg won"><div className="jbtop"><span className="jbk">Booked</span></div><b>You are booked with {accepted.who?.business_name || accepted.n}</b><p>You carry on in one thread: messages, the contract, the deposit and the gallery. {(accepted.who?.business_name || accepted.n).split(' ')[0]} has your message and your email address now.</p><div className="ctas"><Link className="btn w" to="/portal">Open your portal <Icon name="arrow" size={14} /></Link></div></div>}
            <h3 className="jbh3">{apps.length ? apps.length + (apps.length === 1 ? ' quote' : ' quotes') : 'Quotes'}<small>{apps.length ? (accepted ? 'You picked one' : 'Look at their work, then pick one') : 'Creatives who do this work can see it now. We email you each time a quote lands.'}</small></h3>
            {!apps.length && j.st === 'active' && <div className="jbcard lg wait"><span className="lm" /><div><b>Waiting for the first quote</b><p>Nothing to do yet. This page is also in your portal.</p></div></div>}
            {apps.map(a => { const nm = a.who?.business_name || a.n; return <div key={a.id} className={'jbq lg' + (a.st === 'accepted' ? ' acc' : a.st === 'closed' ? ' off' : '')}>
              <div className="jbqhead"><span className="jbav">{a.who?.avatar_url ? <img src={imageUrl(a.who.avatar_url, 96)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <Still seed={(a.n.charCodeAt(0) || 3) % 9} mood="golden" style={{ borderRadius: '50%' }} />}</span><div><b>{nm}</b><small>{[a.who?.city, 'replied ' + ago(a.at)].filter(Boolean).join(' · ')}</small></div><div className="jbprice"><b>{fmt(a.price)}</b><small>incl. GST</small></div></div>
              {a.incl && <p className="jbincl"><b>Included:</b> {a.incl}</p>}
              <p className="jbmsg" style={{ whiteSpace: 'pre-line' }}>{open === a.id || a.msg.length < 220 ? a.msg : a.msg.slice(0, 220) + '…'}{a.msg.length >= 220 && <button className="forgot" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? ' less' : ' more'}</button>}</p>
              <div className="ctas">{a.st === 'pending' && j.st === 'active' && <><button className="btn k" disabled={!!busy} onClick={() => accept(a)}>{busy === a.id ? 'Accepting' : 'Accept this quote'} <Icon name="arrow" size={14} /></button>{a.cid && <Link className="btn g" to={'/creatives/' + a.cid} target="_blank" rel="noopener noreferrer">See their work</Link>}<button className="lnk" disabled={!!busy} onClick={() => decline(a)}>No thanks</button></>}{a.st === 'accepted' && <span className="st ok">Accepted</span>}{a.st === 'closed' && <span className="st grey">Closed, you booked someone else</span>}{a.st === 'pending' && j.st !== 'active' && <span className="st grey">This job is no longer open</span>}</div>
            </div> })}
          </div>
          <aside className="jbside">
            <div className="jbcard lg"><b>The brief</b><p style={{ whiteSpace: 'pre-line' }}>{j.w}</p><div className="jbmeta"><span><Icon name="pin" size={12} />{j.loc}</span><span><Icon name="cal" size={12} />{j.d ? nice(j.d) : 'Flexible'}</span>{j.b ? <span className="m">{fmt(j.b)}</span> : null}</div><small className="jbfine">Posted {nice(j.posted)} as {j.by}. Your email is only shared with the creative you accept.</small></div>
            <div className="jbcard lg tips"><b>Picking well</b><ul><li>Look at the work first. Every creative here has a profile with their photos or films.</li><li>Price is not the only number. What is included, and how soon you get it, matter as much.</li><li>Accepting a quote does not charge you. Any deposit comes later, through the booking.</li></ul></div>
          </aside>
        </div>
      </div></section>
    </div>
  )
}
