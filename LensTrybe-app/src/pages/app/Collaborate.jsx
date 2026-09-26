import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import { imageUrl } from '../../backend/imageUrl'
import * as live from '../../lib/live'
import { TODAY, nice, daysBetween } from '../../lib/store'
import { fmt } from '../../lib/format'

// Collaborate: the second shooters, editors and pilots you book onto jobs, what they are on, what they
// are owed, and the jobs passed between creatives when someone is double booked. Every ask goes to the
// job, every confirmation lands on the calendar, every payment lands in Expenses under Crew.
const ST = { asked: ['viewed', 'Asked'], confirmed: ['ok', 'Confirmed'], declined: ['grey', 'Declined'], done: ['grey', 'Done'] }
const Q = TODAY.slice(0, 4) + (TODAY.slice(5, 7) >= '07' ? '-07-01' : '-01-01')

export default function Collaborate() { return LIVE ? <CollabLive /> : <CollabDemo /> }
function CollabDemo() {
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

// Live: the collab board. Browse open collabs from other creatives, say you're interested, post your
// own (Pro and up), answer requests (yes opens a thread), and keep a crew of creatives you can invite
// directly. Projects' "Ask a creative" lands here with the job filled in (/app/collaborate?ask=<id>).
const WORK = { 'on-location': 'On location', remote: 'Remote', both: 'On location or remote' }
const ARR = { 'one-off': 'One-off', ongoing: 'Ongoing' }
const RQ = { pending: ['viewed', 'Waiting'], accepted: ['ok', 'Said yes'], declined: ['grey', 'Declined'] }
const CROLES_L = ['Second shooter', 'Videographer', 'Photographer', 'Editor', 'Drone pilot', 'Assistant', 'Hair and makeup', 'Model', 'Stylist', 'Other']
const Av = ({ p, size = 34 }) => <span className="av" style={{ width: size, height: size, borderRadius: 11, flex: 'none', ...(p?.av ? { backgroundImage: 'url(' + imageUrl(p.av, 96) + ')', backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'linear-gradient(135deg,#472657,#c6a5e5)' }) }} />
const money2 = c => c.paid ? (c.amt ? 'Paid · ' + fmt(c.amt) : 'Paid') : 'Unpaid / TFP'
function CollabLive() {
  const F = useFlows(); const { s, toast } = F; const { profile: P, user } = useAuth()
  const basic = s.plan.name === 'Basic'
  const [d, setD] = useState(null), [tab, setTab] = useState('browse'), [sel, setSel] = useState(null), [busy, setBusy] = useState(''), [q, setQ] = useState(''), [found, setFound] = useState(null), [role, setRole] = useState('all')
  const [params, setParams] = useSearchParams()
  const load = () => live.loadCollab(P.id).then(setD).catch(e => { setD(x => x || { open: [], mine: [], sent: [], got: [], crew: [], crewIds: [] }); toast(e.message) })
  useEffect(() => { if (P?.id) load() }, [P?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab !== 'crew' || !P?.id) return; const t = setTimeout(() => live.findCreatives(P.id, q).then(setFound).catch(() => setFound([])), 300); return () => clearTimeout(t) }, [tab, q, P?.id])
  const me = { id: P?.id, name: s.profile.n || P?.business_name || 'A creative', email: user?.email || '' }
  const run = async (key, fn) => { if (busy) return; setBusy(key); try { await fn() } catch (e) { toast(e.message) } finally { setBusy('') } }
  const needPro = what => F.confirm({ title: what + ' is on Pro and above', body: 'On Basic you can browse collabs, say you are interested and keep a crew. Pro and up post collabs and invite creatives directly.', cta: 'See plans', onYes: () => F.nav('/app/subscription') })
  const invite = (preset = {}) => { if (basic) return needPro('Inviting creatives'); if (!d.crew.length && !preset.to) return toast('Add someone to your crew first. Find them on the Crew tab.')
    F.open({ title: preset.to ? 'Invite ' + preset.to.n : 'Invite someone from your crew', sub: 'They get a notification. If they say yes, a thread opens between you.', cta: 'Send invite', working: 'Sending', fields: [...(preset.to ? [] : [{ k: 'to', l: 'Who', type: 'select', required: true, value: d.crew[0]?.id || '', options: d.crew.map(c => [c.id, c.n + (c.c ? ' · ' + c.c : '')]) }]), { k: 'msg', l: 'Message', type: 'textarea', rows: 5, required: true, value: preset.msg || '' , placeholder: 'What the job is, when, where, and what you can pay' }],
      submit: async v => { try { const to = preset.to?.id || v.to; await live.sendCollabRequest({ to, message: v.msg }); preset.then?.(d.crew.find(c => c.id === to) || preset.to); await load(); toast('Invite sent.') } catch (e) { toast(e.message); return false } } }) }
  // from a project's "Ask a creative"
  useEffect(() => { const pid = params.get('ask'); if (!d || !pid) return; setParams({}, { replace: true }); const pr = s.projects.find(x => String(x.id) === pid); if (!pr) return
    invite({ msg: 'Hi, are you free to help on ' + pr.n + (pr.d ? ' on ' + nice(pr.d, { weekday: 'long' }) : '') + (pr.at ? ' at ' + pr.at : '') + '? Let me know your rate and I can send the details.', then: c => c && F.upd('projects', pr.id, x => ({ crew: [...(x.crew || []), c.n + ' · asked ' + nice(TODAY)] })) }) }, [d]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <section className="view collab"><div className="vh"><div><h1>Collaborate</h1><p>Loading…</p></div></div></section>
  const inCrew = id => d.crewIds.includes(id)
  const crewToggle = pr => run('c' + pr.id, async () => { const on = !inCrew(pr.id); await live.toggleCrew(P.id, pr.id, on); await load(); toast(on ? pr.n + ' is in your crew.' : pr.n + ' is off your crew.') })
  const sentFor = cid => d.sent.find(i => i.collab?.id === cid)
  const waiting = d.got.filter(i => i.st === 'pending')
  const together = [...d.sent, ...d.got].filter(i => i.st === 'accepted')
  const postFields = (c = {}) => [
    { k: 'roles', l: 'Who you need', type: 'chips', required: true, value: c.roles || [], options: CROLES_L },
    { k: 'work', l: 'Where', type: 'select', half: true, value: c.work || 'on-location', options: Object.entries(WORK) }, { k: 'arr', l: 'How long', type: 'select', half: true, value: c.arr || 'one-off', options: Object.entries(ARR) },
    { k: 'loc', l: 'Location', half: true, value: c.loc ?? [P?.city, P?.state].filter(Boolean).join(', '), placeholder: 'Brisbane, QLD', when: v => v.work !== 'remote' }, { k: 'when', l: 'When', half: true, value: c.when || '', placeholder: '14 Nov, or most weekends' },
    { k: 'paid', l: 'Paid', type: 'toggle', value: c.paid ?? true, hint: 'Off for unpaid or TFP' }, { k: 'amt', l: 'Amount (AUD)', type: 'money', half: true, value: c.amt ?? '', when: v => v.paid },
    { k: 'brief', l: 'The brief', type: 'textarea', rows: 4, required: true, value: c.brief || '', placeholder: 'What you are making, what they would do, anything they should know' },
  ]
  const post = c => { if (!c && basic) return needPro('Posting a collab'); F.open({ title: c ? 'Edit collab' : 'Post a collab', sub: c ? '' : 'Other creatives see it on their Collaborate board and can say they are interested.', cta: c ? 'Save' : 'Post it', working: c ? 'Saving' : 'Posting', center: true, fields: postFields(c || {}),
    submit: async v => { if (!(v.roles || []).length) { toast('Pick at least one role.'); return false } try { const id = await live.saveCollab(v, c?.id); await load(); setTab('mine'); setSel(id); toast(c ? 'Saved.' : 'Posted. It is on the board now.') } catch (e) { toast(e.message); return false } } }) }
  const interested = c => F.open({ title: "I'm interested", sub: c.roles.join(', ') + ' · ' + (c.who?.n || 'a creative'), cta: 'Send', working: 'Sending', fields: [{ k: 'msg', l: 'A line to go with it', type: 'textarea', rows: 4, placeholder: 'What you would bring, and a link to similar work', value: '' }],
    submit: async v => { try { await live.sendCollabRequest({ collabId: c.id, message: v.msg }); await load(); toast('Sent. ' + (c.who?.n || 'They') + ' gets a notification.') } catch (e) { toast(e.message); return false } } })
  const accept = i => run(i.id, async () => { const tid = await live.acceptCollab(i.id); await load(); toast('Said yes. A thread is open with ' + i.other.n + '.'); if (tid) F.nav('/app/thread/' + tid) })
  const decline = i => run(i.id, async () => { await live.declineCollab(i.id); await load(); toast(i.other.n + ' has been told.') })
  const reply = i => F.open({ title: 'Message ' + i.other.n, cta: 'Send', working: 'Sending', fields: [{ k: 'msg', l: 'Message', type: 'textarea', rows: 4, required: true }], submit: async v => { try { await live.replyInThread(me, i.thread, v.msg); await load(); toast('Sent.') } catch (e) { toast(e.message); return false } } })
  const close = c => run(c.id, async () => { await live.setCollabStatus(c.id, c.st === 'open' ? 'closed' : 'open'); await load(); toast(c.st === 'open' ? 'Closed. It is off the board.' : 'Open again.') })
  const del = c => F.confirm({ title: 'Delete this collab?', body: 'It comes off the board. Requests about it stay in your list.', cta: 'Delete', danger: true, onYes: () => run(c.id, async () => { await live.deleteCollab(c.id); setSel(null); await load(); toast('Deleted.') }) })
  const roles = [...new Set(d.open.flatMap(c => c.roles))]
  const browse = d.open.filter(c => role === 'all' || c.roles.includes(role))
  const reqs = [...d.got.map(i => ({ ...i, dir: 'in' })), ...d.sent.map(i => ({ ...i, dir: 'out' }))].sort((a, b) => (a.st === 'pending' && a.dir === 'in' ? 0 : 1) - (b.st === 'pending' && b.dir === 'in' ? 0 : 1) || (a.at < b.at ? 1 : -1))
  const cur = tab === 'browse' ? browse.find(c => c.id === sel) || browse[0] : tab === 'mine' ? d.mine.find(c => c.id === sel) || d.mine[0] : tab === 'requests' ? reqs.find(i => i.id === sel) || reqs[0] : null
  const rowStyle = on => on ? { borderColor: 'var(--sig-rim)', boxShadow: '0 0 0 3px var(--sig-bg)' } : undefined
  const CollabCard = ({ c, own }) => <div className="card lg"><div className="h"><b>{c.roles.join(', ')}</b><span className={'st ' + (c.st === 'open' ? 'ok' : 'grey')}>{c.st === 'open' ? 'Open' : 'Closed'}</span></div>
    {!own && c.who && <div className="seller" style={{ marginBottom: 10 }}><Av p={c.who} /><div><b>{c.who.n}</b><small>{[c.who.c, c.who.state].filter(Boolean).join(', ') || 'On LensTrybe'}</small></div><Link className="lnk" to={'/creatives/' + c.who.id} target="_blank" rel="noopener noreferrer">Profile</Link></div>}
    <p className="note2" style={{ whiteSpace: 'pre-line' }}>{c.brief}</p>
    <div className="kv"><span>Where</span><b>{WORK[c.work] || c.work}{c.loc && c.work !== 'remote' ? ' · ' + c.loc : ''}</b></div><div className="kv"><span>How long</span><b>{ARR[c.arr] || c.arr}</b></div>{c.when && <div className="kv"><span>When</span><b>{c.when}</b></div>}<div className="kv"><span>Pay</span><b>{money2(c)}</b></div><div className="kv"><span>Posted</span><b>{nice(c.posted)}</b></div>
    <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
      {own ? <><button className="btn w sm" onClick={() => post(c)}>Edit</button><button className="btn g sm" disabled={!!busy} onClick={() => close(c)}>{c.st === 'open' ? 'Close it' : 'Open again'}</button><button className="btn g sm" disabled={!!busy} onClick={() => del(c)}>Delete</button></>
        : <>{sentFor(c.id) ? <span className={'st ' + RQ[sentFor(c.id).st][0]}>{sentFor(c.id).st === 'pending' ? 'Request sent' : RQ[sentFor(c.id).st][1]}</span> : <button className="btn w sm" onClick={() => interested(c)}>I'm interested <Icon name="arrow" size={13} /></button>}{c.who && <button className="btn g sm" disabled={!!busy} onClick={() => crewToggle(c.who)}>{inCrew(c.who.id) ? 'In your crew' : 'Add to crew'}</button>}</>}
    </div></div>
  return (
    <section className="view collab">
      <div className="vh">
        <div><h1>Collaborate</h1><p>Find second shooters, editors and pilots on LensTrybe, post what you need, and keep a crew you can ask first.</p></div>
        <div className="acts"><button className="btn g" onClick={() => { setTab('crew'); setSel(null) }}><Icon name="search" size={15} />Find someone</button><button className="btn w" onClick={() => post()}><Icon name="plus" size={15} />Post a collab</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">{[['Open collabs', String(d.open.length), d.open.length ? 'from ' + new Set(d.open.map(c => c.by)).size + ' creatives' : 'none right now', ''], ['Waiting on you', String(waiting.length), waiting.length ? waiting.map(i => i.other.n.split(' ')[0]).slice(0, 3).join(', ') : 'nothing to answer', waiting.length ? 'w' : 'n'], ['Working together', String(together.length), together.length ? 'with ' + [...new Set(together.map(i => i.other.n.split(' ')[0]))].slice(0, 3).join(', ') : 'no one yet', 'n'], ['Your crew', String(d.crew.length), d.crew.length ? 'ask them first' : 'star people to keep them', '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
        <div className={'card lg ' + (tab === 'crew' ? 's12' : 's8')}>
          <div className="h"><div className="tfilt" style={{ padding: 0 }}>{[['browse', 'Browse', d.open.length], ['requests', 'Requests', waiting.length || reqs.length], ['mine', 'My collabs', d.mine.length], ['crew', 'Crew', d.crew.length]].map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setSel(null) }}>{l}<i>{n}</i></button>)}</div>
            {tab === 'browse' && roles.length > 1 && <select value={role} onChange={e => setRole(e.target.value)} aria-label="Role"><option value="all">Every role</option>{roles.map(r => <option key={r}>{r}</option>)}</select>}</div>
          {tab === 'browse' && <div className="need">{browse.map(c => <div key={c.id} className={'r' + (cur?.id === c.id ? ' on' : '')} style={rowStyle(cur?.id === c.id)} onClick={() => setSel(c.id)}><Av p={c.who} /><div><b>{c.roles.join(', ')}</b><small>{[c.who?.n, WORK[c.work], ARR[c.arr], c.work !== 'remote' ? c.loc : '', money2(c)].filter(Boolean).join(' · ')}</small></div><div className="do">{sentFor(c.id) ? <span className="st viewed">Sent</span> : <button className="y" onClick={e => { e.stopPropagation(); interested(c) }}>Interested</button>}</div></div>)}{!browse.length && <div className="tempty">No open collabs right now. Post one and it shows on everyone's board.</div>}</div>}
          {tab === 'requests' && <div className="need">{reqs.map(i => <div key={i.id} className={'r' + (cur?.id === i.id ? ' on' : '')} style={rowStyle(cur?.id === i.id)} onClick={() => setSel(i.id)}><Av p={i.other} /><div><b>{i.dir === 'in' ? i.other.n + (i.collab ? ' is interested' : ' invited you') : 'You → ' + i.other.n}</b><small>{i.collab ? i.collab.roles.join(', ') : 'Direct invite'} · {nice(i.at)}</small></div><div className="do"><span className={'st ' + RQ[i.st][0]}>{i.dir === 'in' && i.st === 'pending' ? 'Answer' : RQ[i.st][1]}</span></div></div>)}{!reqs.length && <div className="tempty">No requests yet. Say you are interested in a collab, or invite someone from your crew.</div>}</div>}
          {tab === 'mine' && <div className="need">{d.mine.map(c => { const n = d.got.filter(i => i.collab?.id === c.id).length; return <div key={c.id} className={'r' + (cur?.id === c.id ? ' on' : '')} style={rowStyle(cur?.id === c.id)} onClick={() => setSel(c.id)}><span className="av" style={{ background: 'var(--bg-3)', display: 'grid', placeItems: 'center' }}><Icon name="users" size={14} /></span><div><b>{c.roles.join(', ')}</b><small>{[WORK[c.work], c.when, money2(c), n + (n === 1 ? ' request' : ' requests')].filter(Boolean).join(' · ')}</small></div><div className="do"><span className={'st ' + (c.st === 'open' ? 'ok' : 'grey')}>{c.st === 'open' ? 'Open' : 'Closed'}</span></div></div> })}{!d.mine.length && <div className="tempty">{basic ? 'Posting collabs is on Pro and above.' : <>Nothing posted. <button className="lnk" onClick={() => post()}>Post a collab</button></>}</div>}</div>}
          {tab === 'crew' && <>
            {d.crew.length > 0 && <><div className="h" style={{ marginTop: 4 }}><b>Your crew</b><small className="lumi-by">{basic ? 'Invites are on Pro and above' : 'Invite them straight to a job'}</small></div>
              <div className="need">{d.crew.map(p => <div key={p.id} className="r"><Av p={p} /><div><b>{p.n}</b><small>{[p.skills.slice(0, 2).join(', '), [p.c, p.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'On LensTrybe'}</small></div><div className="do"><button className="y" onClick={() => invite({ to: p })}>Invite</button><Link className="lnk" to={'/creatives/' + p.id} target="_blank" rel="noopener noreferrer">Profile</Link><button disabled={!!busy} onClick={() => crewToggle(p)}>Remove</button></div></div>)}</div></>}
            <div className="h" style={{ marginTop: 18 }}><b>Find creatives</b><label className="tsearch" style={{ margin: 0, height: 34, width: 260 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or city" aria-label="Find creatives" /></label></div>
            <div className="need">{(found || []).filter(p => !inCrew(p.id)).map(p => <div key={p.id} className="r"><Av p={p} /><div><b>{p.n}</b><small>{[p.skills.slice(0, 2).join(', '), [p.c, p.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'On LensTrybe'}</small></div><div className="do"><button className="y" disabled={!!busy} onClick={() => crewToggle(p)}>Add to crew</button><Link className="lnk" to={'/creatives/' + p.id} target="_blank" rel="noopener noreferrer">Profile</Link></div></div>)}{found && !found.filter(p => !inCrew(p.id)).length && <div className="tempty">{q ? 'Nobody matches that.' : 'Everyone listed is already in your crew.'}</div>}{!found && <div className="tempty">Loading…</div>}</div>
          </>}
        </div>
        {tab !== 'crew' && cur && <div className="s4 side">
          {tab === 'browse' && <CollabCard c={cur} />}
          {tab === 'mine' && <><CollabCard c={cur} own />
            <div className="card lg"><div className="h"><b>Requests</b><small className="lumi-by">{d.got.filter(i => i.collab?.id === cur.id).length}</small></div>{d.got.filter(i => i.collab?.id === cur.id).map(i => <div key={i.id} className="kv"><span>{i.other.n}</span><b><button className="lnk" onClick={() => { setTab('requests'); setSel(i.id) }}>{RQ[i.st][1]}</button></b></div>)}{!d.got.some(i => i.collab?.id === cur.id) && <div className="tempty">No one yet.</div>}</div></>}
          {tab === 'requests' && <div className="card lg">
            <div className="seller" style={{ marginBottom: 10 }}><Av p={cur.other} /><div><b>{cur.other.n}</b><small>{[cur.other.c, cur.other.state].filter(Boolean).join(', ') || 'On LensTrybe'}</small></div><Link className="lnk" to={'/creatives/' + cur.other.id} target="_blank" rel="noopener noreferrer">Profile</Link></div>
            <div className="kv"><span>{cur.dir === 'in' ? 'Their request' : 'Your request'}</span><b>{cur.collab ? cur.collab.roles.join(', ') : 'Direct invite'}</b></div><div className="kv"><span>Sent</span><b>{nice(cur.at)}</b></div><div className="kv"><span>Status</span><b>{RQ[cur.st][1]}</b></div>
            {cur.msg && <p className="note2" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>{cur.msg}</p>}
            {cur.collab && <p className="note2" style={{ whiteSpace: 'pre-line', opacity: .8 }}><b>The collab:</b> {cur.collab.brief}</p>}
            <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {cur.dir === 'in' && cur.st === 'pending' && <><button className="btn w sm" disabled={!!busy} onClick={() => accept(cur)}>{busy === cur.id ? 'Opening' : 'Say yes'}</button><button className="btn g sm" disabled={!!busy} onClick={() => decline(cur)}>No thanks</button></>}
              {cur.dir === 'in' && cur.st === 'accepted' && cur.thread && <Link className="btn w sm" to={'/app/thread/' + cur.thread}>Open the thread <Icon name="arrow" size={13} /></Link>}
              {cur.dir === 'out' && cur.st === 'accepted' && cur.thread && <button className="btn w sm" onClick={() => reply(cur)}>Message {cur.other.n.split(' ')[0]}</button>}
              {!inCrew(cur.other.id) && <button className="btn g sm" disabled={!!busy} onClick={() => crewToggle(cur.other)}>Add to crew</button>}
            </div>
            {cur.dir === 'out' && cur.conv && <div className="mthread" style={{ marginTop: 12 }}>{cur.conv.msgs.map(m => <div key={m.id} className={'om' + (m.me ? ' me' : '')}><small>{m.me ? 'You' : cur.other.n.split(' ')[0]} · {nice(live.dayOfIso(m.at))}</small><p style={{ whiteSpace: 'pre-line' }}>{m.body}</p></div>)}</div>}
          </div>}
        </div>}
      </div>
    </section>
  )
}
