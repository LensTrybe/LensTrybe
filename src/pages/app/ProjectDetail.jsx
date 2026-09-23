import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, addDays } from '../../lib/store'
import { line as evLine, ampm } from '../../lib/cal'
import { fmt } from '../../lib/format'
import { done, total } from './Projects'

const TABS = [['over', 'Overview'], ['lists', 'Checklists'], ['tasks', 'Tasks'], ['money', 'Money'], ['people', 'People'], ['meet', 'Meetings'], ['gear', 'Gear'], ['files', 'Files and gallery'], ['log', 'Activity']]
const when = w => { const d = new Date(w); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + ampm(w.slice(11)) }

// One project, every tab. Money, meetings, gallery and the thread are read from the store, so
// nothing here is entered twice; checklists, tasks, crew and gear are the project's own.
export default function ProjectDetail() {
  const { id } = useParams(); const nav = useNavigate(); const F = useFlows(); const { s, toast, upd } = F
  const p = s.projects.find(x => x.id === id)
  const [tab, setTab] = useState('over'), [newTask, setNewTask] = useState(''), [newItem, setNewItem] = useState({})
  if (!p) return <section className="view"><div className="tempty" style={{ padding: 60 }}>That project is gone. <Link className="lnk" to="/app/projects">Back to projects</Link></div></section>
  const st = s.stages.find(x => x.id === p.stage), th = s.threads.find(t => t.id === p.t), person = s.people.find(x => x.id === p.t)
  const rows = s.ledger.filter(r => r.t === p.t), inv = rows.filter(r => r.k === 'inv'), quotes = rows.filter(r => r.k === 'q'), contracts = rows.filter(r => r.k === 'c')
  const paid = inv.filter(r => r.st === 'ok').reduce((t, r) => t + r.v, 0) || p.paid || 0, invoiced = inv.reduce((t, r) => t + r.v, 0), quoted = quotes.reduce((t, r) => t + r.v, 0), owed = Math.max(0, (p.v || 0) - paid)
  const gals = s.galleries.filter(g => g.t === p.t), meets = s.meetings.filter(m => m.th === p.t), events = s.events.filter(e => e.t === p.t && e.k !== 'x'), gear = (p.gear || []).map(g => s.gear.find(x => x.id === g)).filter(Boolean)
  const tasks = p.tasks || [], open = tasks.filter(t => !t[1]), lists = p.lists || []
  const log = txt => upd('projects', p.id, x => ({ log: [['Just now', txt], ...(x.log || [])] }))
  const P = patch => upd('projects', p.id, patch)
  // ── edits ──
  const editDetails = () => F.open({ title: 'Project details', cta: 'Save', wide: true, fields: [{ k: 'n', l: 'Project', required: true, value: p.n }, { k: 'type', l: 'Type', type: 'select', half: true, value: p.type || 'Wedding', options: ['Wedding', 'Elopement', 'Real estate', 'Event', 'Brand', 'Headshots', 'Family', 'Other'] }, { k: 'stage', l: 'Stage', type: 'select', half: true, value: p.stage, options: s.stages.map(x => [x.id, x.n]) }, { k: 'd', l: 'Shoot date', type: 'date', half: true, value: p.d }, { k: 'at', l: 'Where', half: true, value: p.at || '' }, { k: 'v', l: 'Fee', type: 'money', half: true, value: p.v || '' }, { k: 'src', l: 'Lead source', type: 'select', half: true, value: p.src || 'LensTrybe', options: ['LensTrybe', 'Google', 'Instagram', 'Referral', 'Repeat client', 'Website', 'Job board', 'Other'] }, { k: 'brief', l: 'Brief', type: 'textarea', rows: 5, value: p.brief || '' }], alt: { l: 'Delete project', on: () => { F.confirm({ title: 'Delete ' + p.n + '?', body: 'The thread, calendar and ledger stay. Only the brief, checklists, tasks and files go.', cta: 'Delete', danger: true, onYes: () => { F.del('projects', p.id); nav('/app/projects'); toast('Project deleted.') } }); return false } }, submit: v => { if (v.stage !== p.stage) F.setProjectStage(p.id, v.stage); P({ n: v.n, type: v.type, d: v.d, at: v.at, v: v.v, src: v.src, brief: v.brief }); if (v.v !== p.v && p.t) F.upd('threads', p.t, { v: v.v }); toast('Saved.') } })
  const addTask = () => { const t = newTask.trim(); if (!t) return; P(x => ({ tasks: [...(x.tasks || []), [t, 0, '']] })); setNewTask('') }
  const taskDue = i => F.open({ title: 'Task', cta: 'Save', fields: [{ k: 't', l: 'Task', required: true, value: tasks[i][0] }, { k: 'd', l: 'Due', type: 'date', value: tasks[i][2] || '' }], alt: { l: 'Remove', on: () => P(x => ({ tasks: x.tasks.filter((_, j) => j !== i) })) }, submit: v => P(x => ({ tasks: x.tasks.map((t, j) => j === i ? [v.t, t[1], v.d] : t) })) })
  const tickTask = i => P(x => ({ tasks: x.tasks.map((t, j) => j === i ? [t[0], t[1] ? 0 : 1, t[2]] : t) }))
  const addList = () => F.open({ title: 'New checklist', cta: 'Add', fields: [{ k: 'n', l: 'Name', required: true, placeholder: 'Shot list' }, { k: 'tpl', l: 'Start from', type: 'select', value: '', options: [['', 'Empty'], ...s.checklistTemplates.map(t => [t.id, t.n])] }], submit: v => { const tpl = s.checklistTemplates.find(t => t.id === v.tpl); P(x => ({ lists: [...(x.lists || []), { id: 'l' + Date.now().toString(36), n: v.n, items: tpl ? tpl.items.map(i => [i, 0]) : [] }] })); toast('Checklist added.') } })
  const renameList = l => F.open({ title: l.n, cta: 'Save', fields: [{ k: 'n', l: 'Name', required: true, value: l.n }], alt: { l: 'Delete checklist', on: () => { P(x => ({ lists: x.lists.filter(y => y.id !== l.id) })); toast('Deleted.') } }, submit: v => P(x => ({ lists: x.lists.map(y => y.id === l.id ? { ...y, n: v.n } : y) })) })
  const saveTpl = l => { F.add('checklistTemplates', { id: 'tp' + Date.now().toString(36), n: l.n, items: l.items.map(i => i[0]) }, 'any', false); toast('"' + l.n + '" saved as a template. It is on every new project.') }
  const tickItem = (lid, i) => P(x => ({ lists: x.lists.map(l => l.id === lid ? { ...l, items: l.items.map((it, j) => j === i ? [it[0], it[1] ? 0 : 1] : it) } : l) }))
  const addItem = lid => { const t = (newItem[lid] || '').trim(); if (!t) return; P(x => ({ lists: x.lists.map(l => l.id === lid ? { ...l, items: [...l.items, [t, 0]] } : l) })); setNewItem(o => ({ ...o, [lid]: '' })) }
  const rmItem = (lid, i) => P(x => ({ lists: x.lists.map(l => l.id === lid ? { ...l, items: l.items.filter((_, j) => j !== i) } : l) }))
  const addCrew = () => F.askCrew({ proj: p.id, d: p.d })
  const addPerson = () => F.open({ title: 'Add someone to this project', sub: 'A planner, an agent, a parent, a second shooter. They can be sent the call sheet and the gallery.', cta: 'Add', fields: [{ k: 'n', l: 'Name', required: true }, { k: 'r', l: 'Role', half: true, placeholder: 'Planner', value: 'Planner' }, { k: 'em', l: 'Email', half: true, type: 'email' }], submit: v => { P(x => ({ crew: [...(x.crew || []), v.n + ' · ' + v.r.toLowerCase() + (v.em ? ' · ' + v.em : '')] })); log('Added ' + v.n + ' as ' + v.r.toLowerCase()); toast(v.n + ' added.') } })
  const rmCrew = i => P(x => ({ crew: x.crew.filter((_, j) => j !== i) }))
  const pickGear = () => F.open({ title: 'Gear for this job', sub: 'Checked out to the project, back in the kit when you check it in.', cta: 'Check out', fields: [{ k: 'g', l: 'Gear', type: 'chips', value: p.gear || [], options: s.gear.map(g => [g.id, g.n]) }], submit: v => { P({ gear: v.g }); log('Gear checked out: ' + v.g.length + ' items'); toast(v.g.length + ' items checked out to ' + p.n.split(' · ')[0] + '.') } })
  const checkIn = gid => { P(x => ({ gear: x.gear.filter(g => g !== gid) })); toast('Checked in.') }
  const attach = () => F.open({ title: 'Attach a file', cta: 'Attach', fields: [{ k: 'n', l: 'Name', required: true, placeholder: 'Run sheet' }, { k: 's', l: 'What it is', placeholder: 'PDF · from Harper' }, { k: 'thread', l: 'Also share in the thread', type: 'toggle', value: false }], submit: v => { P(x => ({ files: [...(x.files || []), [v.n, v.s || 'File']] })); if (v.thread && p.t) F.say(p.t, 'doc', v.n, { d: v.s || 'File', st: 'ok', stt: 'Shared' }); log('Attached ' + v.n); toast(v.n + ' attached.') } })
  const finish = () => F.confirm({ title: 'Mark ' + p.n + ' delivered?', body: 'Moves to Delivered, the thread moves to Deliver, and Lumi asks for a review in three days.', cta: 'Delivered', onYes: () => { F.setProjectStage(p.id, s.stages.find(x => x.id === 'deliv')?.id || s.stages[s.stages.length - 1].id); if (p.t) F.upd('threads', p.t, { next: 'Delivered · ask for a review' }) } })
  const Stage = ({ small }) => <div className={'stpick' + (small ? ' sm' : '')}>{s.stages.map(x => <button key={x.id} type="button" className={'st stg ' + x.c + (x.id === p.stage ? ' on' : '')} onClick={() => F.setProjectStage(p.id, x.id)}><i />{x.n}</button>)}</div>

  return (
    <section className="view">
      <div className="vh pdh">
        <div className="pdt"><Link to="/app/projects" className="lnk back"><Icon name="back" size={13} />Projects</Link><h1>{p.n.split(' · ')[0]} <em>{p.n.split(' · ').slice(1).join(' · ')}</em></h1><p>{p.type}{p.d ? ' · ' + nice(p.d, { weekday: 'short', year: 'numeric' }) : ''}{p.at ? ' · ' + p.at : ''}{p.src ? ' · from ' + p.src : ''}</p></div>
        <div className="acts">
          {th && <Link className="btn g" to={'/app/thread/' + p.t}><Icon name="chat" size={15} />Thread</Link>}
          <button className="btn g" onClick={editDetails}><Icon name="edit" size={15} />Edit</button>
          {p.k !== 'done' ? <button className="btn w" onClick={finish}><Icon name="check" size={15} />Delivered</button> : <button className="btn w" onClick={() => F.askReview(p.t)}><Icon name="star" size={15} />Ask for a review</button>}
        </div>
      </div>
      <div className="grid">
        <div className="s12"><Stage /></div>
        <div className="s12"><div className="kp">
          {[['Value', fmt(p.v || 0), quoted && !invoiced ? fmt(quoted) + ' quoted' : invoiced ? fmt(invoiced) + ' invoiced' : 'nothing invoiced yet', ''], ['Paid', fmt(paid), inv.filter(r => r.st === 'ok').length + ' payments', ''], ['Outstanding', fmt(owed), owed ? (inv.find(r => r.st !== 'ok') ? 'due ' + nice(inv.find(r => r.st !== 'ok').date) : 'not invoiced yet') : 'all paid', owed ? 'w' : ''], ['Checklists', total(p) ? done(p) + ' of ' + total(p) : '—', open.length + ' tasks open', open.length ? 'n' : '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>
        <div className="s12"><div className="tfilt tabs2">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'tasks' && open.length > 0 && <i>{open.length}</i>}{k === 'meet' && meets.filter(m => m.st !== 'done').length > 0 && <i>{meets.filter(m => m.st !== 'done').length}</i>}</button>)}</div></div>

        {tab === 'over' && <>
          <div className="s7 side">
            <div className="card lg pd"><div className="cover"><Still seed={p.s + 40} mood={p.m} /><div className="in"><b>{p.n}</b><small>{st?.n}{p.d ? ' · ' + nice(p.d, { weekday: 'short' }) : ''}</small></div></div>
              <div className="h" style={{ marginTop: 14 }}><b>Brief</b><button className="lnk" onClick={editDetails}>Edit</button></div><p className="note2">{p.brief || 'No brief yet. Add what the day is, who matters, what must not be missed.'}</p>
            </div>
            <div className="card lg"><div className="h"><b>Next steps</b><button className="lnk" onClick={() => setTab('tasks')}>All tasks</button></div>
              {open.length ? <div className="chk">{open.slice(0, 5).map(t => { const i = tasks.indexOf(t); return <label key={i} className={t[2] && t[2] < TODAY ? 'late' : ''}><input type="checkbox" checked={false} onChange={() => tickTask(i)} /><i><Icon name="check" size={11} /></i><span>{t[0]}{t[2] && <small> · {t[2] < TODAY ? 'overdue' : 'due ' + nice(t[2])}</small>}</span></label> })}</div> : <p className="tempty" style={{ textAlign: 'left', padding: '6px 0' }}>Nothing open. <button className="lnk" onClick={() => setTab('tasks')}>Add a task</button></p>}
            </div>
            <div className="card lg"><div className="h"><b>Recent activity</b><button className="lnk" onClick={() => setTab('log')}>See all</button></div><div className="glog">{(p.log || []).slice(0, 4).map(([w, x], i) => <div key={i}><small>{w}</small><span>{x}</span></div>)}{!(p.log || []).length && <p className="tempty">Nothing yet.</p>}</div></div>
          </div>
          <div className="s5 side">
            <div className="card lg"><div className="h"><b>Money</b><button className="lnk" onClick={() => setTab('money')}>Ledger</button></div>
              <div className="fin4"><div><small>Quoted</small><b>{fmt(quoted)}</b></div><div><small>Invoiced</small><b>{fmt(invoiced)}</b></div><div><small>Paid</small><b className="ok">{fmt(paid)}</b></div><div><small>Owed</small><b className={owed ? 'w' : ''}>{fmt(owed)}</b></div></div>
              <div className="ctas" style={{ marginTop: 12 }}>{owed > 0 && !inv.some(r => r.st !== 'ok') && <button className="btn w sm" onClick={() => F.newDoc('inv', { client: p.t, d: p.n.split(' · ')[1] || p.n, v: owed })}>Invoice {fmt(owed)}</button>}{!quotes.length && <button className="btn g sm" onClick={() => F.newDoc('q', { client: p.t, d: p.n.split(' · ')[1] || p.n, v: p.v })}>Quote</button>}{!contracts.length && <button className="btn g sm" onClick={() => F.newDoc('c', { client: p.t, v: p.v })}>Contract</button>}</div>
            </div>
            <div className="card lg"><div className="h"><b>People</b><button className="lnk" onClick={() => setTab('people')}>All</button></div>
              <div className="tl">{person && <div className="e"><span className="av" style={{ background: person.g, width: 30, height: 30, borderRadius: 10, flex: 'none' }} /><div><b>{person.n}</b><small>Client · {person.em || 'no email'}</small></div></div>}{(p.crew || []).slice(0, 3).map((c, i) => <div key={i} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="users" size={14} /></span><div><b>{c.split(' · ')[0]}</b><small>{c.split(' · ').slice(1).join(' · ')}</small></div></div>)}</div>
            </div>
            <div className="card lg"><div className="h"><b>On the calendar</b><Link to="/app/bookings">Calendar <Icon name="arrow" size={12} /></Link></div>
              <div className="tl">{events.map(e => <div key={e.id} className="e" onClick={() => F.editEvent(e.id)}><span className="t" style={{ width: 'auto' }}>{nice(e.d)}</span><div><b>{e.n.split(' · ').slice(1).join(' · ') || e.n}</b><small>{evLine(e) || e.s}</small></div><span className={'st ' + (e.k === 'p' ? 'viewed' : 'ok')}>{e.k === 'p' ? 'Pencilled' : 'Booked'}</span></div>)}{!events.length && <p className="tempty" style={{ textAlign: 'left', padding: '6px 0' }}>Not on the calendar. <button className="lnk" onClick={() => F.newBooking(p.d >= TODAY ? p.d : '', { client: p.t, what: p.n.split(' · ')[1] || p.n, v: p.v })}>Book it</button></p>}</div>
            </div>
            <div className="card lg"><div className="h"><b>Details</b></div><div className="kv"><span>Stage</span><b>{st?.n || '—'}</b></div><div className="kv"><span>Type</span><b>{p.type || '—'}</b></div><div className="kv"><span>Lead source</span><b>{p.src || '—'}</b></div><div className="kv"><span>Shoot date</span><b>{p.d ? nice(p.d, { year: 'numeric' }) : '—'}</b></div><div className="kv"><span>Where</span><b>{p.at || '—'}</b></div><div className="kv"><span>Gear</span><b>{gear.length ? gear.length + ' items' : '—'}</b></div></div>
          </div>
        </>}

        {tab === 'lists' && <>
          {lists.map(l => <div key={l.id} className="card lg s6"><div className="h"><b style={{ cursor: 'pointer' }} onClick={() => renameList(l)}>{l.n} <span className="st ok">{l.items.filter(i => i[1]).length} of {l.items.length}</span></b><span style={{ display: 'flex', gap: 10 }}><button className="lnk" onClick={() => saveTpl(l)}>Save as template</button><button className="lnk" onClick={() => renameList(l)}>Edit</button></span></div>
            <div className="chk">{l.items.map(([t, on], i) => <label key={i} className={on ? 'on' : ''}><input type="checkbox" checked={!!on} onChange={() => tickItem(l.id, i)} /><i><Icon name="check" size={11} /></i><span>{t}</span><button type="button" className="rm" aria-label="Remove" onClick={e => { e.preventDefault(); rmItem(l.id, i) }}><Icon name="x" size={11} /></button></label>)}</div>
            <div className="addrow"><input value={newItem[l.id] || ''} onChange={e => setNewItem(o => ({ ...o, [l.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addItem(l.id)} placeholder="Add an item" /><button className="btn g sm" onClick={() => addItem(l.id)}>Add</button></div>
          </div>)}
          <button type="button" className="card lg s6 addcard" onClick={addList}><Icon name="plus" size={18} /><b>New checklist</b><small>Empty, or from a template: {s.checklistTemplates.map(t => t.n).join(', ')}</small></button>
        </>}

        {tab === 'tasks' && <>
          <div className="card lg s7"><div className="h"><b>Tasks</b><span className="st ok">{open.length} open</span></div>
            <div className="addrow" style={{ marginBottom: 10 }}><input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Add a task, Enter to save" /><button className="btn w sm" onClick={addTask}>Add</button></div>
            <div className="chk">{tasks.map((t, i) => <label key={i} className={(t[1] ? 'on' : '') + (t[2] && t[2] < TODAY && !t[1] ? ' late' : '')}><input type="checkbox" checked={!!t[1]} onChange={() => tickTask(i)} /><i><Icon name="check" size={11} /></i><span onClick={e => { e.preventDefault(); taskDue(i) }} style={{ cursor: 'pointer' }}>{t[0]}{t[2] && <small> · {t[2] < TODAY && !t[1] ? 'overdue' : 'due ' + nice(t[2])}</small>}</span></label>)}{!tasks.length && <p className="tempty">No tasks yet.</p>}</div>
          </div>
          <div className="s5 side"><div className="tlumi"><span className="lm" /><div>Tap a task to give it a date. Tasks with dates show on Today when they are due, and Lumi nudges the morning before.{!tasks.some(t => /call sheet/i.test(t[0])) && p.k !== 'done' && <> Want "Send the call sheet" added for two days before the shoot?</>}{!tasks.some(t => /call sheet/i.test(t[0])) && p.k !== 'done' && <div className="acts"><button className="y" onClick={() => { P(x => ({ tasks: [...x.tasks, ['Send the call sheet', 0, addDays(p.d, -2)]] })); toast('Added.') }}>Add it</button></div>}</div></div></div>
        </>}

        {tab === 'money' && <>
          <div className="card lg s8"><div className="h"><b>Ledger for this job</b><span style={{ display: 'flex', gap: 6 }}><button className="btn g sm" onClick={() => F.newDoc('q', { client: p.t, d: p.n.split(' · ')[1] || p.n, v: p.v })}>Quote</button><button className="btn g sm" onClick={() => F.newDoc('c', { client: p.t, v: p.v })}>Contract</button><button className="btn w sm" onClick={() => F.newDoc('inv', { client: p.t, d: p.n.split(' · ')[1] || p.n, v: owed || p.v })}>Invoice</button></span></div>
            <div className="ledger">{rows.sort((a, b) => a.date < b.date ? 1 : -1).map(r => <div key={r.id} className="lr"><span className="ic"><Icon name={{ inv: 'dollar', q: 'file', c: 'fileCheck', exp: 'receipt' }[r.k]} size={15} /></span><div><b>{r.id}</b><small>{r.d}</small></div><small className="dt">{nice(r.date)}</small><span className={'st ' + r.st}>{r.stt}</span><span className="amt">{fmt(r.v)}</span><span className="acts2">{r.k === 'inv' && r.st !== 'ok' && <button className="act2" onClick={() => F.markPaid(r.id)}>Paid</button>}{r.k === 'q' && r.st !== 'ok' && <button className="act2" onClick={() => F.markAccepted(r.id)}>Accepted</button>}<button className="act2" onClick={() => F.docAction(r)}>{F.docActionLabel(r)}</button></span></div>)}{!rows.length && <div className="tempty">Nothing yet. Send a quote to start.</div>}</div>
          </div>
          <div className="s4 side"><div className="card lg"><div className="h"><b>Summary</b></div><div className="kv"><span>Fee</span><b>{fmt(p.v || 0)}</b></div><div className="kv"><span>Quoted</span><b>{fmt(quoted)}</b></div><div className="kv"><span>Invoiced</span><b>{fmt(invoiced)}</b></div><div className="kv"><span>Paid</span><b>{fmt(paid)}</b></div><div className="kv tot"><span>Outstanding</span><b>{fmt(owed)}</b></div><p className="note2" style={{ marginTop: 10 }}>{owed ? (inv.some(r => r.st !== 'ok') ? 'Lumi chases from day 3 after the due date, in your words.' : 'Not invoiced yet. The balance is usually invoiced seven days before the shoot.') : 'All paid. Nice.'}</p></div></div>
        </>}

        {tab === 'people' && <>
          <div className="card lg s7"><div className="h"><b>On this project</b><span style={{ display: 'flex', gap: 6 }}><button className="btn g sm" onClick={addCrew}>Ask a creative</button><button className="btn w sm" onClick={addPerson}><Icon name="plus" size={13} />Add someone</button></span></div>
            <div className="tl">{person && <div className="e" onClick={() => { try { sessionStorage.setItem('lt-client', person.id) } catch {} nav('/app/clients') }}><span className="av" style={{ background: person.g, width: 34, height: 34, borderRadius: 11, flex: 'none' }} /><div><b>{person.n}</b><small>Client · {person.co !== person.n ? person.co + ' · ' : ''}{person.em || ''}{person.ph ? ' · ' + person.ph : ''}</small></div><span className="st ok">Client</span></div>}
              {(p.crew || []).map((c, i) => <div key={i} className="e"><span className="t" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 11, background: 'var(--hov)' }}><Icon name="users" size={15} /></span><div><b>{c.split(' · ')[0]}</b><small>{c.split(' · ').slice(1).join(' · ') || 'Crew'}</small></div><button className="act2" onClick={() => rmCrew(i)}>Remove</button></div>)}
              {(s.crewJobs || []).filter(j => j.proj === p.id && j.st === 'asked').map(j => { const c = s.crew.find(x => x.id === j.crew); return c ? <div key={j.id} className="e"><span className="av" style={{ background: c.g, width: 34, height: 34, borderRadius: 11, flex: 'none' }} /><div><b>{c.n}</b><small>{j.role} · asked {nice(j.asked)}{j.fee ? ' · ' + fmt(j.fee) : ''}</small></div><span className="st viewed">Asked</span><button className="act2" onClick={() => F.crewReply(j.id, 'confirmed')} title="Simulates their reply">Confirm</button></div> : null })}
              {!(p.crew || []).length && !(s.crewJobs || []).some(j => j.proj === p.id && j.st === 'asked') && <p className="tempty" style={{ textAlign: 'left', padding: '6px 0' }}>Just you and the client so far.</p>}
            </div>
          </div>
          <div className="s5 side"><div className="card lg"><div className="h"><b>Send them</b></div><div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn g sm" onClick={() => { if (p.t) { F.say(p.t, 'doc', 'Call sheet', { d: 'Sent to everyone on the project', st: 'ok', stt: 'Sent' }); log('Call sheet sent to ' + (1 + (p.crew || []).length) + ' people') } toast('Call sheet sent to everyone on the project.') }}>Call sheet</button><button className="btn g sm" onClick={() => gals[0] ? (log('Gallery link sent to everyone'), toast('Gallery link sent to everyone on the project.')) : F.newGallery({ client: p.t, d: p.n.split(' · ').slice(1).join(' · ') })}>Gallery link</button><button className="btn g sm" onClick={() => F.newMeeting({ client: p.t })}>Meeting invite</button></div><p className="note2" style={{ marginTop: 10 }}>Everyone here gets what you send from the thread. Crew never see the money.</p></div></div>
        </>}

        {tab === 'meet' && <>
          <div className="card lg s8"><div className="h"><b>Meetings</b><button className="btn w sm" onClick={() => F.newMeeting({ client: p.t, d: TODAY })}><Icon name="plus" size={13} />New meeting</button></div>
            <div className="up mt">{meets.sort((a, b) => a.when < b.when ? 1 : -1).map(m => { const t = s.meetingTypes.find(x => x.id === m.t); return <div key={m.id} className={'d' + (m.st === 'done' ? '' : ' now')} onClick={() => nav('/app/meetings')}><div className="dt"><small>{new Date(m.when).toLocaleDateString('en-AU', { weekday: 'short' })}</small><b>{new Date(m.when).getDate()}</b></div><span className="av" style={{ background: m.g }} /><div><b>{t?.n || 'Meeting'} · {m.who}</b><small>{when(m.when)} · {m.how}{m.notes ? ' · ' + m.notes : ''}</small></div><span className={'st ' + (m.st === 'done' ? 'grey' : 'ok')}>{m.st === 'done' ? 'Done' : 'Booked'}</span></div> })}{!meets.length && <div className="tempty">No meetings for this job. <button className="lnk" onClick={() => F.newMeeting({ client: p.t, d: TODAY })}>Book one</button></div>}</div>
          </div>
          <div className="s4 side"><div className="tlumi"><span className="lm" /><div>{p.type === 'Wedding' ? 'Weddings usually take a planning session three weeks out: run sheet, family groups, timings. ' : ''}Meetings booked here go on both calendars and the client gets the invite from you.</div></div></div>
        </>}

        {tab === 'gear' && <>
          <div className="card lg s8"><div className="h"><b>Gear checked out to this job</b><button className="btn w sm" onClick={pickGear}><Icon name="box" size={13} />Pick gear</button></div>
            <div className="ledger">{gear.map(g => <div key={g.id} className="lr"><span className="ic"><Icon name={g.c === 'Bodies' ? 'image' : g.c === 'Lenses' ? 'eye' : g.c === 'Lights' ? 'sun' : g.c === 'Drones' ? 'video' : 'box'} size={15} /></span><div><b>{g.n}</b><small>{g.c}{g.sn ? ' · ' + g.sn : ''}</small></div><span className={'st ' + (g.ins ? 'ok' : 'pink')}>{g.ins ? 'Insured' : 'Not insured'}</span><span className="amt">{fmt(g.v || 0)}</span><button className="act2" onClick={() => checkIn(g.id)}>Check in</button></div>)}{!gear.length && <div className="tempty">Nothing checked out. <button className="lnk" onClick={pickGear}>Pick from your kit</button></div>}</div>
          </div>
          <div className="s4 side"><div className="card lg"><div className="h"><b>Worth on the day</b></div><b style={{ fontSize: 24, fontWeight: 600, display: 'block' }}>{fmt(gear.reduce((t, g) => t + (g.v || 0), 0))}</b><p className="note2" style={{ marginTop: 6 }}>{gear.some(g => !g.ins) ? gear.filter(g => !g.ins).length + ' item' + (gear.filter(g => !g.ins).length === 1 ? '' : 's') + ' not on the policy. ' : 'All insured. '}<Link className="lnk" to="/app/inventory">Inventory</Link></p></div></div>
        </>}

        {tab === 'files' && <>
          <div className="card lg s6"><div className="h"><b>Files</b><button className="lnk" onClick={attach}>Attach</button></div>
            <div className="tl">{(p.files || []).map(([n, sub], i) => <div key={n + i} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="doc" size={14} /></span><div><b>{n}</b><small>{sub}</small></div><button className="act2" onClick={() => P(x => ({ files: x.files.filter((_, j) => j !== i) }))}>Remove</button></div>)}{!(p.files || []).length && <p className="tempty" style={{ textAlign: 'left', padding: '6px 0' }}>Nothing attached.</p>}</div>
          </div>
          <div className="card lg s6"><div className="h"><b>Galleries</b><button className="lnk" onClick={() => F.newGallery({ client: p.t, d: p.n.split(' · ').slice(1).join(' · ') })}>New gallery</button></div>
            <div className="tl">{gals.map(g => <div key={g.id} className="e" onClick={() => nav('/app/deliver')}><span className="t" style={{ width: 'auto' }}><Icon name="image" size={14} /></span><div><b>{g.n} · {g.d}</b><small>{g.k === 'wait' ? 'Link reserved' : g.files + ' photos' + (g.films ? ', ' + g.films + (g.films > 1 ? ' films' : ' film') : '') + ' · opened ' + g.opened + '×'}</small></div><span className={'st ' + (g.k === 'done' ? 'ok' : g.k === 'live' ? 'viewed' : 'grey')}>{g.k === 'done' ? 'Delivered' : g.k === 'live' ? g.p + '%' : 'Waiting'}</span></div>)}{!gals.length && <p className="tempty" style={{ textAlign: 'left', padding: '6px 0' }}>No gallery yet.</p>}</div>
          </div>
        </>}

        {tab === 'log' && <div className="card lg s8"><div className="h"><b>Activity</b></div><div className="glog">{(p.log || []).map(([w, x], i) => <div key={i}><small>{w}</small><span>{x}</span></div>)}{th && th.line.slice(-4).reverse().map((m, i) => <div key={'t' + i}><small>{m.w || m.at || 'Thread'}</small><span>{m.sys || m.doc || (m.me ? 'You: ' + m.me.slice(0, 80) : m.them ? th.n.split(' ')[0] + ': ' + m.them.slice(0, 80) : m.lumi ? 'Lumi: ' + m.lumi.slice(0, 80) : '')}</span></div>)}</div></div>}
      </div>
    </section>
  )
}
