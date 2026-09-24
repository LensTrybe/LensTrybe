import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, daysBetween } from '../../lib/store'
import { fmt } from '../../lib/format'

// Job board: briefs from clients on lenstrybe.com and jobs other creatives cannot take. Sorted by fit,
// filtered by what you do and how far you go, replied to with a quote that opens a thread. Every reply
// you send is tracked here until it is won or lost.
const MY = { sent: ['viewed', 'Sent'], viewed: ['viewed', 'Seen'], shortlisted: ['ok', 'Shortlisted'], won: ['ok', 'Won'], lost: ['grey', 'Not this time'], withdrawn: ['grey', 'Withdrawn'], asked: ['viewed', 'Asked'] }
const SORTS = [['fit', 'Best fit'], ['new', 'Newest'], ['soon', 'Soonest'], ['budget', 'Budget'], ['near', 'Nearest']]
const DIST = [[0, 'Your radius'], [150, '150 km'], [400, 'Statewide'], [9999, 'Australia']]

export default function Jobs() {
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
