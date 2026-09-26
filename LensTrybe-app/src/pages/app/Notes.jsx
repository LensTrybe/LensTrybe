import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import { uuid } from '../../lib/projsync'

// Notes: quick, attached to a client or a project or nothing. The list on the left, the note on the
// right. Saved to the store as you type.
export default function Notes() {
  const F = useFlows(); const { s, toast, upd, del } = F; const who = x => LIVE && x.client ? (s.people.find(p => p.id === x.client)?.n || s.threads.find(t => t.id === x.client)?.n || x.on) : LIVE && x.proj ? (s.projects.find(p => p.id === x.proj)?.n || x.on) : x.on
  const notes = s.notes.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  const [sel, setSel] = useState(notes[0]?.id), [q, setQ] = useState('')
  const list = useMemo(() => notes.filter(n => !q || (n.t + who(n) + n.body).toLowerCase().includes(q.toLowerCase())), [notes, q])
  const n = notes.find(x => x.id === sel) || list[0]
  const add = () => { const id = F.add('notes', { ...(LIVE ? { id: uuid() } : {}), t: 'New note', on: '', to: '', w: 'Just now', body: '' }, 'note'); setSel(id); setTimeout(() => document.querySelector('.ntitle')?.select(), 60) }
  const set = (k, v) => upd('notes', n.id, { [k]: v, w: 'Just now' })
  const attachLive = () => F.open({ title: 'Attach this note', sub: 'To a project or a client, so it sits with the job.', cta: 'Attach', fields: [{ k: 'on', l: 'Attach to', type: 'select', value: n.proj ? 'p:' + n.proj : n.client ? 'c:' + n.client : '', options: F.noteTargets() }], submit: v => { const t = F.noteTarget(v.on); upd('notes', n.id, t); toast(t.on ? 'Attached to ' + t.on + '.' : 'Detached.') } })
  const attach = () => LIVE ? attachLive() : F.open({ title: 'Attach this note', sub: 'Lumi reads notes attached to a client before she drafts to them.', cta: 'Attach', fields: [{ k: 'on', l: 'Client', type: 'select', value: s.people.find(p => p.n === n.on)?.id || '', options: [['', 'Nobody'], ...s.people.map(p => [p.id, p.n])] }], submit: v => { const p = s.people.find(x => x.id === v.on); upd('notes', n.id, { on: p?.n || '', to: p ? '/app/thread/' + p.id : '' }); toast(p ? 'Attached to ' + p.n + '.' : 'Detached.') } })
  const remove = () => F.confirm({ title: 'Delete this note?', body: n.t, cta: 'Delete', danger: true, onYes: () => { del('notes', n.id); setSel(notes.find(x => x.id !== n.id)?.id || null); toast('Note deleted.') } })
  return (
    <section className="view fill">
      <div className="tw notes">
        <aside className="tlist lg">
          <div className="tlh"><h1>Notes</h1><button className="btn w sm" onClick={add}><Icon name="plus" size={14} />New</button></div>
          <label className="tsearch"><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a note" aria-label="Search notes" /></label>
          <div className="trows">
            {list.map(x => <button key={x.id} type="button" className={'tli' + (n?.id === x.id ? ' on' : '')} onClick={() => setSel(x.id)}><span className="nic"><Icon name="note" size={15} /></span><div className="tx"><div className="r1"><b>{x.t}</b><small>{x.w}</small></div><span className="r2">{(x.body || '').split('\n')[0] || 'Empty'}</span>{who(x) && <span className="r3"><i>{who(x)}</i></span>}</div></button>)}
            {!list.length && <div className="tempty">No notes match. <button className="lnk" onClick={add}>New note</button></div>}
          </div>
        </aside>
        {n ? <div className="tp lg npane">
          <div className="tph">
            <div className="tx"><input className="ntitle" value={n.t} onChange={e => set('t', e.target.value)} aria-label="Title" /><p>{n.w}{who(n) && <> · attached to <Link to={n.to} className="lnk">{who(n)}</Link></>}</p></div>
            <div className="acts">{LIVE && <button className={'ic2' + (n.pinned ? ' on' : '')} title={n.pinned ? 'Unpin' : 'Pin to the top'} aria-label="Pin" onClick={() => upd('notes', n.id, { pinned: !n.pinned })}><Icon name="star" size={15} /></button>}<button className="ic2" title="Attach to a project or client" aria-label="Attach" onClick={attach}><Icon name="user" size={15} /></button><button className="ic2" title="Delete" aria-label="Delete" onClick={remove}><Icon name="x" size={15} /></button></div>
          </div>
          <textarea className="nbody" value={n.body} onChange={e => set('body', e.target.value)} placeholder="Write anything. Lumi reads notes attached to a client before she drafts to them." aria-label="Note" />
        </div> : <div className="tp lg npane"><div className="tempty" style={{ margin: 'auto' }}>Pick a note, or <button className="lnk" onClick={add}>start one</button>.</div></div>}
      </div>
    </section>
  )
}
