import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, daysBetween } from '../../lib/store'
import { fmt } from '../../lib/format'

// Collaborate: the second shooters, editors and pilots you book onto jobs, what they are on, what they
// are owed, and the jobs passed between creatives when someone is double booked. Every ask goes to the
// job, every confirmation lands on the calendar, every payment lands in Expenses under Crew.
const ST = { asked: ['viewed', 'Asked'], confirmed: ['ok', 'Confirmed'], declined: ['grey', 'Declined'], done: ['grey', 'Done'] }
const Q = TODAY.slice(0, 4) + (TODAY.slice(5, 7) >= '07' ? '-07-01' : '-01-01')

export default function Collaborate() {
  const F = useFlows(); const { s, toast } = F; const CREW = s.crew, CJ = s.crewJobs || [], CM = s.crewMsgs || []
  const [sel, setSel] = useState(CREW[0]?.id), [tab, setTab] = useState('crew')
  const c = CREW.find(x => x.id === sel)
  const jobsOf = id => CJ.filter(j => j.crew === id).sort((a, b) => a.d < b.d ? 1 : -1)
  const pname = id => s.projects.find(p => p.id === id)?.n || 'Job'
  const upcoming = CJ.filter(j => (j.st === 'asked' || j.st === 'confirmed') && j.d >= TODAY)
  const owed = CJ.filter(j => (j.st === 'confirmed' || j.st === 'done') && !j.paid && j.d <= TODAY)
  const paidQ = s.ledger.filter(r => r.k === 'exp' && r.cat === 'Crew' && r.date >= Q).reduce((t, r) => t - r.v, 0)
  const inbound = s.passed.filter(p => !p.out), outbound = s.passed.filter(p => p.out)
  const msgs = c ? CM.filter(m => m.crew === c.id) : []
  const waiting = CJ.filter(j => j.st === 'asked')
  return (
    <section className="view collab">
      <div className="vh">
        <div><h1>Collaborate</h1><p>Second shooters, editors and pilots you work with. Booked onto a job, on your calendar when they confirm, paid from the job.</p></div>
        <div className="acts"><Link className="btn g" to="/creatives"><Icon name="search" size={15} />Find someone</Link><button className="btn g" onClick={() => F.passJob()}><Icon name="arrow" size={15} />Pass a job on</button><button className="btn w" onClick={() => F.addCrew(id => setSel(id))}><Icon name="plus" size={15} />Add to your crew</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Your crew', String(CREW.length), 'across ' + new Set(CREW.map(x => x.r.split(' ·')[0])).size + ' roles', 'n'], ['On upcoming jobs', String(upcoming.length), upcoming.length ? [...new Set(upcoming.map(j => CREW.find(x => x.id === j.crew)?.n.split(' ')[0]).filter(Boolean))].join(', ') : 'nobody booked', waiting.length ? 'w' : ''], ['Owed to crew', fmt(owed.reduce((t, j) => t + j.fee, 0)), owed.length ? owed.length + (owed.length === 1 ? ' job to pay' : ' jobs to pay') : 'all square', owed.length ? 'w' : ''], ['Paid this half', fmt(Math.round(paidQ)), 'from jobs, under Crew in Expenses', 'n']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8">
          <div className="h"><div className="tfilt" style={{ padding: 0 }}>{[['crew', 'Crew', CREW.length], ['jobs', 'Bookings', upcoming.length], ['passed', 'Passed jobs', inbound.length + outbound.length]].map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<i>{n}</i></button>)}</div></div>
          {tab === 'crew' && <div className="need">
            {CREW.map(x => { const next = jobsOf(x.id).filter(j => j.d >= TODAY && j.st !== 'declined').sort((a, b) => a.d < b.d ? -1 : 1)[0]; return <div key={x.id} className={'r' + (c?.id === x.id ? ' on' : '')} onClick={() => setSel(x.id)} style={c?.id === x.id ? { borderColor: 'var(--sig-rim)', boxShadow: '0 0 0 3px var(--sig-bg)' } : undefined}><span className="av" style={{ background: x.g }} /><div><b>{x.n} · {x.r}</b><small>{x.c} · {x.rate} · {x.jobs} jobs together{next ? <> · <i>{pname(next.proj).split(' · ')[0]} {nice(next.d)}</i></> : ''}</small></div><div className="do">{next ? <span className={'st ' + ST[next.st][0]}>{ST[next.st][1]}</span> : null}<button onClick={e => { e.stopPropagation(); F.askCrew({ crew: x.id }) }}>Book</button></div></div> })}
            {!CREW.length && <div className="tempty">Nobody yet. <button className="lnk" onClick={() => F.addCrew(id => setSel(id))}>Add someone</button></div>}
          </div>}
          {tab === 'jobs' && <div className="need">
            {CJ.slice().sort((a, b) => a.d < b.d ? 1 : -1).map(j => { const x = CREW.find(y => y.id === j.crew); if (!x) return null; return <div key={j.id} className="r" onClick={() => setSel(x.id)}><span className="av" style={{ background: x.g }} /><div><b>{pname(j.proj)} · {nice(j.d)}</b><small>{x.n} · {j.role} · {fmt(j.fee)}{j.paid ? ' · paid ' + nice(j.paid) : j.st === 'done' ? ' · not paid' : ''}</small></div><div className="do" onClick={e => e.stopPropagation()}><span className={'st ' + ST[j.st][0]}>{ST[j.st][1]}</span>{j.st === 'asked' && <><button className="y" onClick={() => F.crewReply(j.id, 'confirmed')} title="Simulates their reply until messaging is live">Confirm</button><button onClick={() => F.crewReply(j.id, 'declined')}>Declined</button></>}{(j.st === 'confirmed' || j.st === 'done') && !j.paid && j.d <= TODAY && <button className="y" onClick={() => F.payCrew(x.id, j.id)}>Pay {fmt(j.fee)}</button>}{(j.st === 'asked' || j.st === 'confirmed') && j.d >= TODAY && <button onClick={() => F.cancelCrewJob(j.id)}>Cancel</button>}<Link className="act2" to={'/app/project/' + j.proj}>Job</Link></div></div> })}
            {!CJ.length && <div className="tempty">No bookings yet. Book someone from a job or from their card.</div>}
          </div>}
          {tab === 'passed' && <>
            <div className="h"><b>Passed to you</b><small className="lumi-by">From creatives who were booked</small></div>
            <div className="need">{inbound.map(p => <div key={p.id} className="r"><span className="av" style={{ background: p.g }} /><div><b>{p.j}</b><small>From {p.from} · {p.w}{p.at ? ' · ' + daysBetween(p.at, TODAY) + ' d ago' : ''}</small></div><div className="do"><button className="y" onClick={() => F.takePassed(p.id)}>Take it</button><button onClick={() => F.declinePassed(p.id)}>Pass</button></div></div>)}{!inbound.length && <div className="tempty">Nothing passed to you right now.</div>}</div>
            <div className="h" style={{ marginTop: 22 }}><b>Passed by you</b><button className="lnk" onClick={() => F.passJob()}>Pass a job on</button></div>
            <div className="need">{outbound.map(p => <div key={p.id} className="r"><span className="av" style={{ background: p.g }} /><div><b>{p.j}</b><small>To {p.to} · {p.w}</small></div><div className="do"><span className={'st ' + (p.st === 'taken' ? 'ok' : 'viewed')}>{p.st === 'taken' ? 'Taken by ' + p.to.split(' ')[0] : 'Waiting'}</span>{p.st !== 'taken' && <button onClick={() => { F.upd('passed', p.id, { st: 'taken' }); toast(p.to.split(' ')[0] + ' took it. The client is theirs now.') }} title="Simulates their reply">Taken</button>}<button onClick={() => { F.del('passed', p.id); toast('Withdrawn.') }}>Withdraw</button></div></div>)}{!outbound.length && <div className="tempty">You haven't passed anything on.</div>}</div>
          </>}
        </div>

        {c ? <div className="s4 side">
          <div className="card lg">
            <div className="h"><b style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="av" style={{ background: c.g, width: 30, height: 30, borderRadius: 10 }} />{c.n}</b><button className="ic2" aria-label="Edit" onClick={() => F.editCrew(c.id, () => setSel(CREW.find(x => x.id !== c.id)?.id))}><Icon name="edit" size={14} /></button></div>
            <div className="kv"><span>Role</span><b>{c.r}</b></div><div className="kv"><span>Based</span><b>{c.c}</b></div><div className="kv"><span>Rate</span><b>{c.rate}</b></div><div className="kv"><span>Jobs together</span><b>{c.jobs}{c.since ? <small style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · since {nice(c.since, { year: 'numeric' })}</small> : null}</b></div>
            {(c.em || c.ph) && <div className="kv"><span>Reach</span><b style={{ fontWeight: 500, fontSize: 12.5 }}>{[c.em, c.ph].filter(Boolean).join(' · ')}</b></div>}
            {c.note && <p className="note2">{c.note}</p>}
            <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}><button className="btn w sm" onClick={() => F.askCrew({ crew: c.id })}>Book on a job</button><button className="btn g sm" onClick={() => F.messageCrew(c.id)}>Message</button><button className="btn g sm" onClick={() => F.payCrew(c.id)}>Pay</button></div>
          </div>
          <div className="card lg"><div className="h"><b>Jobs</b><small className="lumi-by">{jobsOf(c.id).length}</small></div>
            <div className="tl">{jobsOf(c.id).slice(0, 6).map(j => <div key={j.id} className="e"><span className="t">{nice(j.d)}</span><div><b>{pname(j.proj)}</b><small>{j.role} · {fmt(j.fee)}{j.paid ? ' · paid' : ''}</small></div><span className={'st ' + ST[j.st][0]}>{ST[j.st][1]}</span></div>)}{!jobsOf(c.id).length && <p className="tempty">Not booked yet.</p>}</div>
          </div>
          <div className="card lg"><div className="h"><b>Messages</b><button className="lnk" onClick={() => F.messageCrew(c.id)}>Write</button></div>
            <div className="mthread">{msgs.slice(-6).map(m => <div key={m.id} className={'om' + (m.mine ? ' me' : '')}><small>{m.from.split(' ')[0]} · {nice(m.at)}</small><p>{m.text}</p></div>)}{!msgs.length && <p className="tempty">Nothing yet.</p>}</div>
          </div>
          <div className="tlumi"><span className="lm" /><div>{(() => { const a = jobsOf(c.id).find(j => j.st === 'asked'); const o = jobsOf(c.id).find(j => (j.st === 'confirmed' || j.st === 'done') && !j.paid && j.d <= TODAY); const n = jobsOf(c.id).filter(j => j.st === 'confirmed' && j.d >= TODAY).sort((x, y) => x.d < y.d ? -1 : 1)[0]; return a ? c.n.split(' ')[0] + ' hasn\'t answered the ask for ' + pname(a.proj).split(' · ')[0] + ' (' + daysBetween(a.asked, TODAY) + ' days). A nudge usually sorts it.' : o ? c.n.split(' ')[0] + ' is owed ' + fmt(o.fee) + ' for ' + pname(o.proj).split(' · ')[0] + '. Paying crew within a week keeps them saying yes.' : n ? c.n.split(' ')[0] + ' is confirmed for ' + pname(n.proj).split(' · ')[0] + ' on ' + nice(n.d) + '. The call sheet goes to both of you two days before.' : 'Nothing open with ' + c.n.split(' ')[0] + '. ' + c.jobs + ' jobs together.' })()}{jobsOf(c.id).some(j => j.st === 'asked') && <div className="acts"><button className="y" onClick={() => F.messageCrew(c.id, { msg: (s.brand.voice?.greet || 'Hi') + ' ' + c.n.split(' ')[0] + ', just checking you saw the ask. No stress either way.' })}>Nudge</button></div>}{jobsOf(c.id).some(j => (j.st === 'confirmed' || j.st === 'done') && !j.paid && j.d <= TODAY) && <div className="acts"><button className="y" onClick={() => F.payCrew(c.id)}>Pay now</button></div>}</div></div>
        </div> : <div className="s4 side"><div className="card lg"><p className="tempty">Pick someone, or add to your crew.</p></div></div>}
      </div>
    </section>
  )
}
