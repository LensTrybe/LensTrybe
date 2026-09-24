import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { nice as niceD, TODAY } from '../../lib/store'
import { fmt } from '../../lib/format'

// Projects: every job start to finish, in the creative's own pipeline. Board to move things along,
// list to scan, and each card opens the project page with everything the job knows about itself.
const nice = s => niceD(s, { weekday: 'short' })
export const done = p => (p.lists || []).reduce((t, l) => t + l.items.filter(i => i[1]).length, 0)
export const total = p => (p.lists || []).reduce((t, l) => t + l.items.length, 0)

export default function Projects() {
  const F = useFlows(); const { s, toast } = F; const nav = useNavigate(); const P = s.projects, ST = s.stages
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('lt-proj') || 'board' } catch { return 'board' } })
  const [q, setQ] = useState(''), [f, setF] = useState('live'), [drag, setDrag] = useState(null), [over, setOver] = useState(null), [menu, setMenu] = useState(null)
  useEffect(() => { try { localStorage.setItem('lt-proj', mode) } catch {} }, [mode])
  useEffect(() => { if (!menu) return; const c = e => { if (!e.target.closest('.stmenu')) setMenu(null) }; document.addEventListener('click', c); return () => document.removeEventListener('click', c) }, [menu])
  const list = useMemo(() => P.filter(p => (mode === 'board' || f === 'all' || p.k === f) && (!q || (p.n + ' ' + p.c + ' ' + (p.type || '') + ' ' + (p.at || '')).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.d < b.d ? -1 : 1), [P, q, f, mode])
  const paidOf = p => s.ledger.filter(r => r.t === p.t && r.k === 'inv' && r.st === 'ok').reduce((t, r) => t + r.v, 0) || p.paid || 0
  const live = P.filter(p => p.k !== 'done'), value = live.reduce((t, p) => t + (p.v || 0), 0), owed = live.reduce((t, p) => t + Math.max(0, (p.v || 0) - paidOf(p)), 0)
  const openTasks = P.reduce((t, p) => t + (p.tasks || []).filter(x => !x[1]).length, 0), dueSoon = P.reduce((t, p) => t + (p.tasks || []).filter(x => !x[1] && x[2] && x[2] <= '2026-09-29').length, 0)
  const dragProps = p => ({ draggable: true, onDragStart: ev => { ev.dataTransfer.setData('text/plain', p.id); ev.dataTransfer.effectAllowed = 'move'; setDrag(p.id) }, onDragEnd: () => { setDrag(null); setOver(null) } })
  const dropProps = st => ({ onDragOver: ev => { if (drag) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; if (over !== st) setOver(st) } }, onDragLeave: () => over === st && setOver(null), onDrop: ev => { ev.preventDefault(); const id = ev.dataTransfer.getData('text/plain') || drag; setOver(null); setDrag(null); if (id) F.setProjectStage(id, st) } })
  const card = p => { const n = total(p), d = done(p), pd = paidOf(p), next = (p.tasks || []).find(t => !t[1]); return (
    <button key={p.id} type="button" className={'pj ' + (p.stage) + (drag === p.id ? ' lift' : '')} {...dragProps(p)} onClick={() => nav('/app/project/' + p.id)}>
      <span className="th"><Still seed={p.s} mood={p.m} /></span>
      <div className="tx"><b>{p.n}</b><small>{p.d ? nice(p.d) : 'No date'}{p.at ? ' · ' + p.at : ''}</small>{next && <em><Icon name="check" size={11} />{next[0]}</em>}</div>
      <div className="ft"><span className="pv">{p.v ? fmt(p.v) : '—'}{p.v > 0 && <small>{pd >= p.v ? 'paid' : pd ? fmt(pd) + ' paid' : 'nothing paid'}</small>}</span>{n > 0 && <span className="prog" title={d + ' of ' + n}><i style={{ width: (d / n * 100) + '%' }} /></span>}</div>
    </button>) }
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Projects</h1><p>Every job start to finish, in your own pipeline. Drag a card to move it along.</p></div>
        <div className="acts">
          <label className="tsearch" style={{ margin: 0, height: 40, width: 220 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a project, client, type" aria-label="Search projects" /></label>
          <div className="tfilt seg3">{[['board', 'Board'], ['list', 'List']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
          <button className="btn w" onClick={() => F.newProject({ then: id => nav('/app/project/' + id) })}><Icon name="plus" size={15} />New project</button>
        </div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Active', String(live.length), P.length - live.length + ' delivered this year', ''], ['On the books', fmt(value), 'across active projects', ''], ['Still to collect', fmt(owed), owed ? 'from ' + live.filter(p => paidOf(p) < (p.v || 0)).length + ' projects' : 'all paid', owed ? 'w' : ''], ['Open tasks', String(openTasks), dueSoon ? dueSoon + ' due this week' : 'nothing due this week', dueSoon ? 'w' : 'n']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        {mode === 'board' ? (
          <div className="s12 board-wrap">
            <div className="board" style={{ gridTemplateColumns: 'repeat(' + (ST.length + 1) + ', minmax(214px, 1fr))' }}>
              {ST.map((st, i) => { const cards = list.filter(p => p.stage === st.id); return (
                <div key={st.id} className={'bcol ' + st.c + (over === st.id ? ' over' : '')} {...dropProps(st.id)}>
                  <div className="bh"><i className="dot" /><b>{st.n}</b><span>{cards.length}{cards.length > 0 && ' · ' + fmt(cards.reduce((t, p) => t + (p.v || 0), 0))}</span>
                    <div className="stmenu"><button type="button" className="mb" aria-label="Stage options" onClick={() => setMenu(menu === st.id ? null : st.id)}>···</button>
                      {menu === st.id && <div className="menu lg"><button type="button" onClick={() => { setMenu(null); F.editStage(st.id) }}><Icon name="edit" size={14} /><span><b>Rename or recolour</b></span></button>{i > 0 && <button type="button" onClick={() => { setMenu(null); F.moveStage(st.id, -1) }}><Icon name="back" size={14} /><span><b>Move left</b></span></button>}{i < ST.length - 1 && <button type="button" onClick={() => { setMenu(null); F.moveStage(st.id, 1) }}><Icon name="chev" size={14} /><span><b>Move right</b></span></button>}<button type="button" onClick={() => { setMenu(null); F.newProject({ stage: st.id, then: id => nav('/app/project/' + id) }) }}><Icon name="plus" size={14} /><span><b>New project here</b></span></button></div>}
                    </div>
                  </div>
                  {cards.map(card)}
                  {!cards.length && <div className="bempty">{over === st.id ? 'Drop it here' : 'Nothing here'}</div>}
                </div>) })}
              <button type="button" className="bcol add" onClick={() => F.editStage(null)}><Icon name="plus" size={15} />Add a stage<small>Your pipeline, your columns</small></button>
            </div>
          </div>
        ) : (
          <div className="card lg s12">
            <div className="h"><div className="tfilt" style={{ padding: 0 }}>{[['live', 'Active'], ['done', 'Delivered'], ['all', 'All']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}<i>{P.filter(x => k === 'all' || x.k === k).length}</i></button>)}</div></div>
            <div className="prj">
              {list.map(x => { const n = total(x), d = done(x), st = ST.find(y => y.id === x.stage), pd = paidOf(x); return (
                <button key={x.id} type="button" className="pr" onClick={() => nav('/app/project/' + x.id)}>
                  <span className="th"><Still seed={x.s} mood={x.m} /></span>
                  <div className="tx"><b>{x.n}</b><small>{nice(x.d)}{x.at ? ' · ' + x.at : ''}{x.type ? ' · ' + x.type : ''}</small><span className="prog"><i style={{ width: (n ? d / n * 100 : 0) + '%' }} /></span><small className="pl">{n ? d + ' of ' + n + ' on the lists' : 'No checklist yet'}{(x.tasks || []).filter(t => !t[1]).length ? ' · ' + (x.tasks || []).filter(t => !t[1]).length + ' tasks open' : ''}</small></div>
                  <span className={'st stg ' + (st?.c || 'grey')}><i />{st?.n || '—'}</span>
                  <span className="pv">{x.v ? fmt(x.v) : '—'}<small>{pd >= x.v && x.v ? 'paid' : pd ? fmt(pd) + ' paid' : 'nothing paid'}</small></span>
                </button>) })}
              {!list.length && <div className="tempty">Nothing here. <button className="lnk" onClick={() => F.newProject({ then: id => nav('/app/project/' + id) })}>Start a project</button></div>}
            </div>
          </div>
        )}
        {dueSoon > 0 && <div className="s12"><div className="tlumi"><span className="lm" /><div>{dueSoon} task{dueSoon === 1 ? '' : 's'} due this week across your projects{(() => { const p = P.find(x => (x.tasks || []).some(t => !t[1] && t[2] && t[2] <= TODAY)); return p ? ', and ' + p.n.split(' · ')[0] + ' has one overdue' : '' })()}. Want them on Today each morning until they are done?<div className="acts"><button className="y" onClick={() => { F.patch('settings', { tasksOnToday: true }); toast('On. Project tasks show on Today.') }}>Yes</button><button onClick={() => toast('Left as is.')}>No</button></div></div></div></div>}
      </div>
    </section>
  )
}
