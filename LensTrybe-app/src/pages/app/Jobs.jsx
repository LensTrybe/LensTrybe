import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import * as live from '../../lib/live'
import { CREATIVE_TYPES } from '../../backend/creativeTypes'
import { TODAY, nice, daysBetween } from '../../lib/store'
import { fmt } from '../../lib/format'

// Job board: briefs from clients on lenstrybe.com and jobs other creatives cannot take. Sorted by fit,
// filtered by what you do and how far you go, replied to with a quote that opens a thread. Every reply
// you send is tracked here until it is won or lost.
const MY = { sent: ['viewed', 'Sent'], viewed: ['viewed', 'Seen'], shortlisted: ['ok', 'Shortlisted'], won: ['ok', 'Won'], lost: ['grey', 'Not this time'], withdrawn: ['grey', 'Withdrawn'], asked: ['viewed', 'Asked'] }
const SORTS = [['fit', 'Best fit'], ['new', 'Newest'], ['soon', 'Soonest'], ['budget', 'Budget'], ['near', 'Nearest']]
const DIST = [[0, 'Your radius'], [150, '150 km'], [400, 'Statewide'], [9999, 'Australia']]

export default function Jobs() { return LIVE ? <JobsLive /> : <JobsDemo /> }
function JobsDemo() {
  const F = useFlows(); const { s, toast } = F; const JOBS = s.jobs
  const [tab, setTab] = useState('open'), [k, setK] = useState('all'), [dist, setDist] = useState(0), [sort, setSort] = useState('fit'), [q, setQ] = useState(''), [sel, setSel] = useState(null), [min, setMin] = useState(0)
  const R = s.avail.radius, plan = s.plan.name
  const fits = useMemo(() => Object.fromEntries(JOBS.map(j => [j.id, F.fitOf(j)])), [JOBS, s.avail, s.events]) // eslint-disable-line react-hooks/exhaustive-deps
  const live = j => j.st === 'open' && j.expires >= TODAY
  const open = JOBS.filter(j => live(j) && !j.mine && !j.hidden && !j.my)
  const replied = JOBS.filter(j => j.my && !j.mine)
  const hidden = JOBS.filter(j => j.hidden && !j.mine)
  const mine = JOBS.filter(j => j.mine)
  const base = tab === 'open' ? open : tab === 'replied' ? replied : tab === 'hidden' ? hidden : mine
  const list = useMemo(() => { const lim = dist || R; let a = base.filter(j => (k === 'all' || j.k === k) && (tab !== 'open' || j.km <= lim) && j.b >= min && (!q || (j.t + ' ' + j.loc + ' ' + j.w + ' ' + j.by).toLowerCase().includes(q.toLowerCase())))
    const by = { fit: (a, b) => fits[b.id].fit - fits[a.id].fit, new: (a, b) => a.posted < b.posted ? 1 : -1, soon: (a, b) => (a.d || '9') < (b.d || '9') ? -1 : 1, budget: (a, b) => b.b - a.b, near: (a, b) => a.km - b.km }[sort]
    return a.slice().sort(tab === 'replied' ? (a, b) => a.my.at < b.my.at ? 1 : -1 : by) }, [base, k, dist, min, q, sort, fits, R, tab])
  const j = JOBS.find(x => x.id === sel) || list[0]
  const good = open.filter(x => fits[x.id].fit >= 80 && x.km <= R)
  const month = TODAY.slice(0, 7), sentM = replied.filter(x => x.my.at?.startsWith(month)), won = replied.filter(x => x.my.st === 'won')
  const gate = j ? F.canReply(j) : { ok: true }
  const fresh = x => daysBetween(x.posted, TODAY) <= 1
  const urgent = x => x.d && daysBetween(TODAY, x.d) <= 14
  const Row = ({ x }) => { const f = fits[x.id]; return <div className={'r jr' + (j?.id === x.id ? ' on' : '')} onClick={() => setSel(x.id)} style={j?.id === x.id ? { borderColor: 'var(--sig-rim)', boxShadow: '0 0 0 3px var(--sig-bg)' } : undefined}>
    <span className="av" style={{ background: x.g }}>{x.kind === 'creative' && <i className="pass" title="Passed on by a creative"><Icon name="users" size={10} /></i>}</span>
    <div><b>{x.t}{fresh(x) && !x.my && <em className="new">New</em>}{urgent(x) && live(x) && <em className="urg">Soon</em>}</b><small>{x.k} · {x.loc.split(',')[0]} · {x.km} km · <b className="money">{fmt(x.b)}</b> · {F.jobDate(x)}{x.hrs ? ' · ' + x.hrs : ''}{tab === 'open' && <> · {x.replies ? x.replies + ' replied' : 'no replies yet'}</>}{tab === 'mine' && <> · {x.replies} replied · {x.st === 'open' ? F.daysLeft(x) + ' days left' : x.st}</>}</small></div>
    <div className="do" onClick={e => e.stopPropagation()}>
      {x.my ? <span className={'st ' + MY[x.my.st][0]}>{MY[x.my.st][1]}{x.my.price ? ' · ' + fmt(x.my.price) : ''}</span> : x.mine ? (x.st === 'open' ? <button onClick={() => F.takeDownJob(x.id)}>Take down</button> : <span className="st grey">{x.st === 'filled' ? 'Filled' : 'Closed'}</span>) : <><span className={'st ' + (f.fit >= 80 ? 'ok' : f.fit >= 60 ? 'viewed' : 'grey')}>{f.fit}% fit</span>{tab === 'hidden' ? <button onClick={() => F.unhideJob(x.id)}>Show</button> : <><button className="y" onClick={() => F.replyJob(x.id)}>Reply</button><button onClick={() => F.hideJob(x.id)}>Pass</button></>}</>}
    </div></div> }
  return (
    <section className="view jobs">
      <div className="vh"><div><h1>Job board</h1><p>Briefs from clients on lenstrybe.com, and jobs other creatives could not take. Reply with a quote and a thread opens; nothing is taken from what you earn.</p></div><div className="acts"><button className="btn g" onClick={F.jobAlerts}><Icon name="bell" size={15} />Alerts{s.settings.alerts !== false && <i className="dot" />}</button><button className="btn w" onClick={() => F.passOnJob()}><Icon name="plus" size={15} />Pass a job on</button></div></div>
      <div className="grid">
        <div className="s12"><div className="kp">{[['Open near you', String(open.filter(x => x.km <= R).length), open.length - open.filter(x => x.km <= R).length ? '+' + (open.length - open.filter(x => x.km <= R).length) + ' further out' : 'inside your ' + R + ' km radius', ''], ['Good fits', String(good.length), good.length ? 'worth ' + fmt(good.reduce((t, x) => t + x.b, 0)) + ' together' : 'none over 80% right now', good.length ? '' : 'n'], ['Replied this month', String(sentM.length), won.length + ' won · ' + replied.filter(x => x.my.st === 'shortlisted').length + ' shortlisted', 'n'], ['Won from the board', fmt(won.reduce((t, x) => t + (x.my.price || 0), 0)), won.length + (won.length === 1 ? ' job' : ' jobs') + ', all time', '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
        <div className="card lg s8">
          <div className="h"><div className="tfilt" style={{ padding: 0 }}>{[['open', 'Open', open.length], ['replied', 'My replies', replied.length], ['mine', 'Passed on by me', mine.length], ['hidden', 'Passed', hidden.length]].map(([id, l, n]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setSel(null) }}>{l}{n ? <i>{n}</i> : null}</button>)}</div></div>
          <div className="jfilt">
            <div className="jsearch"><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search briefs" /></div>
            <select value={k} onChange={e => setK(e.target.value)} aria-label="Kind"><option value="all">All work</option>{F.JOB_KINDS.map(x => <option key={x}>{x}</option>)}</select>
            {tab === 'open' && <select value={dist} onChange={e => setDist(+e.target.value)} aria-label="Distance">{DIST.map(([v, l]) => <option key={v} value={v}>{v ? l : 'Within ' + R + ' km'}</option>)}</select>}
            <select value={min} onChange={e => setMin(+e.target.value)} aria-label="Budget"><option value={0}>Any budget</option>{[500, 1000, 2000, 3000].map(v => <option key={v} value={v}>{fmt(v)}+</option>)}</select>
            {tab === 'open' && <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
          </div>
          <div className="need">{list.map(x => <Row key={x.id} x={x} />)}{!list.length && <div className="tempty">{tab === 'open' ? (q || k !== 'all' || min ? 'Nothing matches those filters.' : 'Nothing open near you right now. Alerts will tell you the moment something lands.') : tab === 'replied' ? 'You have not replied to anything yet. Good fits are on the Open tab.' : tab === 'mine' ? 'Nothing passed on. When you cannot take a job, pass it on and a creative near you picks it up.' : 'Nothing passed.'}</div>}</div>
          {tab === 'open' && dist === 0 && open.some(x => x.km > R) && <button className="lnk" style={{ marginTop: 10 }} onClick={() => setDist(9999)}>{open.filter(x => x.km > R).length} more further out, show them</button>}
        </div>
        {j && <div className="s4 side">
          <div className="card lg jdet">
            <div className="h"><b>{j.t}</b>{!j.mine && <span className={'st ' + (fits[j.id].fit >= 80 ? 'ok' : fits[j.id].fit >= 60 ? 'viewed' : 'grey')}>{fits[j.id].fit}% fit</span>}</div>
            <div className="jmeta"><span><Icon name="pin" size={12} />{j.loc} · {j.km} km</span><span><Icon name="cal" size={12} />{F.jobDate(j)}{j.hrs ? ' · ' + j.hrs : ''}</span><span><Icon name="briefcase" size={12} />{j.k} · {j.ct.join(' or ')}</span></div>
            <p className="note2 jbrief">{j.w}</p>
            <div className="kv"><span>Budget</span><b>{fmt(j.b)}</b></div>
            <div className="kv"><span>From</span><b>{j.by}{j.verified ? <i className="ver" title="Verified email"><Icon name="check" size={9} /></i> : null}<small className="sub"> · {j.kind === 'creative' ? 'passed on by a creative' : j.prior ? 'posted ' + j.prior + ' before' : 'first job here'}</small></b></div>
            <div className="kv"><span>Posted</span><b>{nice(j.posted)}<small className="sub"> · {j.st === 'open' ? F.daysLeft(j) + ' days left' : j.st}</small></b></div>
            <div className="kv"><span>Replies</span><b>{j.replies || 'None yet'}{j.replies ? <small className="sub"> · yours would be {['first', 'second', 'third'][j.replies] || 'number ' + (j.replies + 1)}</small> : null}</b></div>
            {j.my && <div className="jmine"><div className="kv"><span>Your reply</span><b className={MY[j.my.st][0] === 'ok' ? 'good' : ''}>{MY[j.my.st][1]} · {nice(j.my.at)}</b></div>{j.my.price ? <div className="kv"><span>Your price</span><b>{fmt(j.my.price)}</b></div> : null}{j.my.incl && <p className="note2">{j.my.incl}</p>}{j.my.hold && <div className="kv"><span>Date held</span><b>until {nice(j.my.hold)}</b></div>}</div>}
            <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {!j.my && !j.mine && j.st === 'open' && <><button className="btn w sm" onClick={() => F.replyJob(j.id)}>{gate.ok ? 'Reply with a quote' : gate.why === 'plan' ? 'Upgrade to reply' : 'Upgrade for interstate'} <Icon name="arrow" size={13} /></button><button className="btn g sm" onClick={() => F.askJob(j.id)}>Ask first</button><button className="btn g sm" onClick={() => F.saveJob(j.id)}>{j.saved ? 'Saved' : 'Save'}</button><button className="btn g sm" onClick={() => F.passOnJob({ t: j.t, k: j.k, by: j.by })} title="Send to your crew or another creative">Pass to someone</button></>}
              {j.my?.tid && <Link className="btn w sm" to={'/app/thread/' + j.my.tid}>Open the thread <Icon name="arrow" size={13} /></Link>}
              {j.my && ['sent', 'viewed', 'shortlisted'].includes(j.my.st) && j.st === 'open' && <><button className="btn g sm" onClick={() => F.nudgeReply(j.id)}>{j.my.nudged ? 'Nudged ' + nice(j.my.nudged) : 'Nudge'}</button><button className="btn g sm" onClick={() => F.withdrawReply(j.id)}>Withdraw</button></>}
              {j.my?.st === 'won' && <Link className="btn g sm" to="/app/projects">Open the project</Link>}
              {j.mine && j.st === 'open' && <button className="btn g sm" onClick={() => F.takeDownJob(j.id)}>Take down</button>}
            </div>
          </div>
          {!j.mine && <div className="card lg"><div className="h"><b>Why the fit</b><small className="lumi-by"><span className="lm" style={{ width: 12, height: 12 }} />Lumi</small></div>
            <div className="jwhy">{fits[j.id].why.map((w, i) => <div key={i} className={/under|off|taken|outside|not a day/.test(w) ? 'no' : 'yes'}><i><Icon name={/under|off|taken|outside|not a day/.test(w) ? 'x' : 'check'} size={10} /></i>{w}</div>)}</div>
            {!gate.ok && <p className="note2" style={{ marginTop: 10 }}>{gate.text} <Link to="/app/subscription">See plans</Link>.</p>}
            {gate.ok && !j.my && j.st === 'open' && <p className="note2" style={{ marginTop: 10 }}>{fits[j.id].fit >= 80 ? 'A reply in the first hour books six in ten of these. Your quote goes with your profile and three galleries.' : j.km > R ? 'If you want it, the quote adds travel and says so.' : 'Ask first if the brief is thin. Clients answer fast when they have just posted.'}</p>}
          </div>}
          {j.mine && <div className="card lg"><div className="h"><b>Who replied</b></div>{(j.apps || []).length ? j.apps.map(a => <div key={a.id} className="kv"><span>{a.n}</span><b>{fmt(a.price)}</b></div>) : <div className="tempty">No replies yet. The client hears from whoever replies, you get a thank-you credit when it books.</div>}</div>}
        </div>}
      </div>
    </section>
  )
}

// Live: real briefs from job_listings. Open / My replies / Posted by me / Hidden. Replying follows the
// plan (Basic can't, Pro in its own state, Expert and Elite anywhere; the database checks it too).
const RST = { pending: ['viewed', 'Sent'], accepted: ['ok', 'Accepted'], declined: ['grey', 'Not this time'], closed: ['grey', 'Filled by someone else'], withdrawn: ['grey', 'Withdrawn'] }
const JST = { active: ['ok', 'Open'], filled: ['ok', 'Filled'], closed: ['grey', 'Taken down'], expired: ['grey', 'Expired'] }
const LSORTS = [['new', 'Newest'], ['soon', 'Soonest'], ['budget', 'Budget']]
const JOB_KINDS_L = ['Wedding', 'Real estate', 'Brand', 'Headshots', 'Event', 'Family', 'Other']
const money = j => j.b ? fmt(j.b) : j.bText || 'No budget given'
const whenOf = j => j.d ? nice(j.d, { weekday: 'short' }) : 'Date flexible'
function JobsLive() {
  const F = useFlows(); const { s, toast } = F; const { profile: P } = useAuth()
  const plan = s.plan.name, myState = String(P?.state || '').toUpperCase().trim()
  const [d, setD] = useState(null), [tab, setTab] = useState('open'), [ct, setCt] = useState('all'), [where, setWhere] = useState(myState ? 'mine' : 'all'), [sort, setSort] = useState('new'), [q, setQ] = useState(''), [sel, setSel] = useState(null), [busy, setBusy] = useState('')
  const load = () => live.loadJobBoard(P.id).then(setD).catch(e => { setD(x => x || { open: [], replies: [], posted: [] }); toast(e.message) })
  useEffect(() => { if (P?.id) load() }, [P?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const hiddenIds = s.settings.jobHidden || []
  const setHidden = ids => F.patch('settings', { jobHidden: ids.slice(-300) })
  const repliedTo = useMemo(() => new Set((d?.replies || []).map(r => r.job)), [d])
  const open = (d?.open || []).filter(j => !repliedTo.has(j.id) && !hiddenIds.includes(j.id))
  const hidden = (d?.open || []).filter(j => hiddenIds.includes(j.id) && !repliedTo.has(j.id))
  const replies = d?.replies || [], posted = d?.posted || []
  const gate = j => plan === 'Basic' ? { ok: false, text: 'Replying to jobs is on Pro and above. Browsing is free on every plan.' } : plan === 'Pro' && j.state && myState && j.state !== myState ? { ok: false, text: 'This job is in ' + j.state + '. On Pro you reply to jobs in ' + myState + '; Expert and Elite reply anywhere.' } : { ok: true }
  const list = useMemo(() => {
    if (tab === 'replies') return replies.filter(r => !q || ((r.j?.t || '') + ' ' + (r.j?.loc || '')).toLowerCase().includes(q.toLowerCase()))
    const base = tab === 'open' ? open : tab === 'hidden' ? hidden : posted
    const a = base.filter(j => (ct === 'all' || j.ct.includes(ct)) && (tab !== 'open' || where === 'all' || !j.state || !myState || j.state === myState) && (!q || (j.t + ' ' + j.loc + ' ' + j.w + ' ' + j.k).toLowerCase().includes(q.toLowerCase())))
    if (tab === 'posted') return a
    const by = { new: (x, y) => x.posted < y.posted ? 1 : -1, soon: (x, y) => (x.d || '9') < (y.d || '9') ? -1 : 1, budget: (x, y) => y.b - x.b }[sort]
    return a.slice().sort(by)
  }, [d, tab, ct, where, sort, q, hiddenIds.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <section className="view jobs"><div className="vh"><div><h1>Job board</h1><p>Loading the board…</p></div></div></section>
  const cur = tab === 'replies' ? (list.find(r => r.id === sel) || list[0]) : (list.find(j => j.id === sel) || list[0])
  const j = tab === 'replies' ? cur?.j : cur, mine = tab === 'replies' ? cur : null
  const month = TODAY.slice(0, 7), won = replies.filter(r => r.st === 'accepted')
  const run = async (key, fn) => { if (busy) return; setBusy(key); try { await fn() } catch (e) { toast(e.message) } finally { setBusy('') } }
  const reply = x => {
    const g = gate(x); if (!g.ok) return F.confirm({ title: plan === 'Basic' ? 'Replying is on Pro and above' : 'Reply across Australia on Expert', body: g.text, cta: 'See plans', onYes: () => F.nav('/app/subscription') })
    F.open({ title: 'Reply to ' + x.by, sub: x.t + ' · ' + x.loc + ' · ' + whenOf(x) + (x.b ? ' · budget ' + fmt(x.b) : ''), cta: 'Send my quote', working: 'Sending',
      fields: [{ k: 'price', l: 'Your price (AUD, incl. GST)', type: 'money', required: true, half: true, value: x.b || '' }, { k: 'incl', l: "What's included", type: 'textarea', rows: 3, placeholder: 'Hours on the day, how many edited photos, when they get them, travel' }, { k: 'msg', l: 'Message to the client', type: 'textarea', rows: 5, required: true, placeholder: 'Why you, a bit about how you work, and anything you need to know' }],
      submit: async v => { try { await live.applyJob(x.id, v); await load(); setTab('replies'); setSel(null); toast('Sent. ' + x.by + ' gets an email with your quote.') } catch (e) { toast(e.message); return false } } })
  }
  const hide = x => { setHidden([...hiddenIds, x.id]); setSel(null); toast('Hidden. It is on the Hidden tab if you change your mind.') }
  const unhide = x => { setHidden(hiddenIds.filter(i => i !== x.id)); toast('Back on the board.') }
  const withdraw = r => F.confirm({ title: 'Withdraw your quote?', body: 'The client no longer sees it. You cannot reply to this job again.', cta: 'Withdraw', danger: true, onYes: () => run(r.id, async () => { await live.withdrawReply(r.id); await load(); toast('Withdrawn.') }) })
  const passOn = () => F.open({ title: 'Pass a job on', sub: 'For work you cannot take. Creatives who fit reply to you with a quote; you pick one and hand the client over. LensTrybe takes nothing.', cta: 'Post it', working: 'Posting',
    fields: [{ k: 't', l: 'The job', required: true, placeholder: 'Wedding photographer, Montville' }, { k: 'k', l: 'Kind', type: 'select', half: true, value: 'Wedding', options: JOB_KINDS_L }, { k: 'ct', l: 'Needs', type: 'select', half: true, value: 'Photographer', options: [...CREATIVE_TYPES, 'Both'] }, { k: 'loc', l: 'Where', half: true, required: true, placeholder: 'Montville, QLD', value: [P?.city, P?.state].filter(Boolean).join(', ') }, { k: 'd', l: 'Date', type: 'date', half: true, min: TODAY }, { k: 'b', l: 'Budget', type: 'money', half: true }, { k: 'w', l: 'The brief', type: 'textarea', rows: 4, required: true, placeholder: 'What the client wants, when, and anything a creative should know before quoting' }],
    submit: async v => { try { await live.postJob({ ...v, ct: v.ct === 'Both' ? CREATIVE_TYPES : [v.ct], by: s.profile.n }); await load(); setTab('posted'); setSel(null); toast('Posted. Creatives who fit can reply now.') } catch (e) { toast(e.message); return false } } })
  const takeDown = x => F.confirm({ title: 'Take "' + x.t + '" down?', body: 'It comes off the board. Anyone who replied keeps their quote on their side.', cta: 'Take it down', danger: true, onYes: () => run(x.id, async () => { await live.takeDownJob(x.id); await load(); toast('Taken down.') }) })
  const accept = (x, a) => F.confirm({ title: 'Accept ' + a.n + "'s quote?", body: fmt(a.price) + ' for ' + x.t + '. The job is marked filled, everyone else is told, and a thread opens with ' + a.n + '.', cta: 'Accept quote', onYes: () => run(a.id, async () => { const r = await live.acceptReply(a.id); await load(); toast('Accepted. ' + a.n + ' has your message.'); if (r?.portal_token) window.open('/portal/' + r.portal_token, '_blank', 'noopener') }) })
  const decline = a => run(a.id, async () => { await live.declineReply(a.id); await load(); toast(a.n + ' has been told.') })
  const Row = ({ x, r }) => { const on = cur && (r ? cur.id === r.id : cur.id === x?.id); const jj = x || {}; return <div className={'r jr' + (on ? ' on' : '')} onClick={() => setSel(r ? r.id : jj.id)} style={on ? { borderColor: 'var(--sig-rim)', boxShadow: '0 0 0 3px var(--sig-bg)' } : undefined}>
    <span className="av" style={{ background: 'var(--bg-3)', display: 'grid', placeItems: 'center' }}><Icon name="briefcase" size={14} /></span>
    <div><b>{jj.t || 'A job'}{tab === 'open' && jj.posted && daysBetween(jj.posted, TODAY) <= 1 && <em className="new">New</em>}</b><small>{[jj.ct?.join(' or '), jj.k, jj.loc, jj.id ? money(jj) : '', jj.id ? whenOf(jj) : ''].filter(Boolean).join(' · ')}{tab === 'posted' && <> · {jj.apps.filter(a => a.st !== 'withdrawn').length} {jj.apps.filter(a => a.st !== 'withdrawn').length === 1 ? 'reply' : 'replies'}</>}</small></div>
    <div className="do" onClick={e => e.stopPropagation()}>
      {r ? <span className={'st ' + RST[r.st][0]}>{RST[r.st][1]} · {fmt(r.price)}</span>
        : tab === 'posted' ? (jj.st === 'active' ? <button disabled={!!busy} onClick={() => takeDown(jj)}>Take down</button> : <span className={'st ' + JST[jj.st][0]}>{JST[jj.st][1]}</span>)
        : tab === 'hidden' ? <button onClick={() => unhide(jj)}>Show</button>
        : <><button className="y" onClick={() => reply(jj)}>Reply</button><button onClick={() => hide(jj)}>Hide</button></>}
    </div></div> }
  const empty = { open: q || ct !== 'all' ? 'Nothing matches those filters.' : where === 'mine' && myState ? 'Nothing open in ' + myState + ' right now. Try all of Australia.' : 'Nothing open right now. New briefs show here as clients post them.', replies: 'You have not replied to anything yet. Open jobs are on the first tab.', posted: 'Nothing passed on. When you cannot take a job, pass it on and a creative who fits picks it up.', hidden: 'Nothing hidden.' }[tab]
  return (
    <section className="view jobs">
      <div className="vh"><div><h1>Job board</h1><p>Briefs from clients on LensTrybe, and jobs other creatives could not take. Reply with a quote; if they accept, a thread opens. Nothing is taken from what you earn.</p></div><div className="acts"><button className="btn w" onClick={passOn}><Icon name="plus" size={15} />Pass a job on</button></div></div>
      <div className="grid">
        <div className="s12"><div className="kp">{[['Open', String(open.length), myState ? open.filter(x => !x.state || x.state === myState).length + ' in ' + myState : 'across Australia', ''], ['Replied this month', String(replies.filter(r => r.at.startsWith(month)).length), replies.filter(r => r.st === 'pending').length + ' waiting to hear', 'n'], ['Accepted', String(won.length), won.length ? fmt(won.reduce((t, r) => t + r.price, 0)) + ' all time' : 'none yet', won.length ? '' : 'n'], ['Posted by you', String(posted.filter(x => x.st === 'active').length), posted.length ? posted.length + ' all time' : 'pass one on any time', '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
        <div className="card lg s8">
          <div className="h"><div className="tfilt" style={{ padding: 0 }}>{[['open', 'Open', open.length], ['replies', 'My replies', replies.length], ['posted', 'Posted by me', posted.length], ['hidden', 'Hidden', hidden.length]].map(([id, l, n]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setSel(null) }}>{l}{n ? <i>{n}</i> : null}</button>)}</div></div>
          <div className="jfilt">
            <div className="jsearch"><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search briefs" /></div>
            {tab !== 'replies' && <select value={ct} onChange={e => setCt(e.target.value)} aria-label="Who"><option value="all">Photo and video</option>{CREATIVE_TYPES.map(x => <option key={x}>{x}</option>)}</select>}
            {tab === 'open' && myState && <select value={where} onChange={e => setWhere(e.target.value)} aria-label="Where"><option value="mine">{myState} only</option><option value="all">All of Australia</option></select>}
            {(tab === 'open' || tab === 'hidden') && <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">{LSORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
          </div>
          <div className="need">{tab === 'replies' ? list.map(r => <Row key={r.id} x={r.j} r={r} />) : list.map(x => <Row key={x.id} x={x} />)}{!list.length && <div className="tempty">{empty}</div>}</div>
        </div>
        {cur && <div className="s4 side">
          <div className="card lg jdet">
            <div className="h"><b>{j?.t || 'This job is no longer listed'}</b>{j && <span className={'st ' + (JST[j.st] || JST.closed)[0]}>{(JST[j.st] || JST.closed)[1]}</span>}</div>
            {j && <><div className="jmeta"><span><Icon name="pin" size={12} />{j.loc || 'Location not given'}</span><span><Icon name="cal" size={12} />{whenOf(j)}</span><span><Icon name="briefcase" size={12} />{[j.k, j.ct.join(' or ')].filter(Boolean).join(' · ')}</span></div>
              <p className="note2 jbrief" style={{ whiteSpace: 'pre-line' }}>{j.w}</p>
              <div className="kv"><span>Budget</span><b>{money(j)}</b></div>
              <div className="kv"><span>From</span><b>{j.mine ? 'You' : j.by}</b></div>
              <div className="kv"><span>Posted</span><b>{nice(j.posted)}{j.st === 'active' && j.expires ? <small className="sub"> · {Math.max(0, daysBetween(TODAY, j.expires))} days left</small> : null}</b></div></>}
            {mine && <div className="jmine"><div className="kv"><span>Your quote</span><b className={mine.st === 'accepted' ? 'good' : ''}>{RST[mine.st][1]} · {nice(mine.at)}</b></div><div className="kv"><span>Your price</span><b>{fmt(mine.price)}</b></div>{mine.incl && <p className="note2" style={{ whiteSpace: 'pre-line' }}><b>Included:</b> {mine.incl}</p>}{mine.msg && <p className="note2" style={{ whiteSpace: 'pre-line' }}>{mine.msg}</p>}</div>}
            <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {(tab === 'open' || tab === 'hidden') && j && <><button className="btn w sm" onClick={() => reply(j)}>{gate(j).ok ? 'Reply with a quote' : 'See plans to reply'} <Icon name="arrow" size={13} /></button>{tab === 'open' ? <button className="btn g sm" onClick={() => hide(j)}>Hide</button> : <button className="btn g sm" onClick={() => unhide(j)}>Show on the board</button>}</>}
              {mine?.st === 'pending' && j?.st === 'active' && <button className="btn g sm" disabled={!!busy} onClick={() => withdraw(mine)}>Withdraw my quote</button>}
              {mine?.st === 'accepted' && <Link className="btn w sm" to="/app/threads">Open threads <Icon name="arrow" size={13} /></Link>}
              {tab === 'posted' && j?.st === 'active' && <button className="btn g sm" disabled={!!busy} onClick={() => takeDown(j)}>Take it down</button>}
            </div>
            {(tab === 'open' || tab === 'hidden') && j && !gate(j).ok && <p className="note2" style={{ marginTop: 10 }}>{gate(j).text} <Link to="/app/subscription">See plans</Link>.</p>}
          </div>
          {tab === 'posted' && j && <div className="card lg"><div className="h"><b>Replies</b><small className="lumi-by">{j.st === 'active' ? 'Accept one and everyone else is told' : JST[j.st][1]}</small></div>
            {j.apps.filter(a => a.st !== 'withdrawn').length ? j.apps.filter(a => a.st !== 'withdrawn').map(a => <div key={a.id} className="jmine" style={{ marginBottom: 12 }}>
              <div className="kv"><span>{a.who?.id ? <Link to={'/creatives/' + a.who.id} target="_blank" rel="noopener noreferrer">{a.who.business_name || a.n}</Link> : a.n}{a.who?.city ? <small className="sub"> · {a.who.city}</small> : null}</span><b>{fmt(a.price)}</b></div>
              {a.incl && <p className="note2" style={{ whiteSpace: 'pre-line' }}><b>Included:</b> {a.incl}</p>}
              {a.msg && <p className="note2" style={{ whiteSpace: 'pre-line' }}>{a.msg}</p>}
              {a.st === 'pending' && j.st === 'active' ? <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><button className="btn w sm" disabled={!!busy} onClick={() => accept(j, a)}>{busy === a.id ? 'Accepting' : 'Accept'}</button><button className="btn g sm" disabled={!!busy} onClick={() => decline(a)}>No thanks</button></div> : <span className={'st ' + RST[a.st][0]}>{a.st === 'closed' ? 'Closed' : RST[a.st][1]}</span>}
            </div>) : <div className="tempty">No replies yet. Creatives who fit see it on their board now.</div>}
          </div>}
        </div>}
      </div>
    </section>
  )
}
