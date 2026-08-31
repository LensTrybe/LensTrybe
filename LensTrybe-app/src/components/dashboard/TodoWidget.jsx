import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, GREEN, Tile, CenterModal } from './widgetKit'
import { isDemoMode, demoTasks } from '../../lib/demoMode'

const inputStyle = { flex: 1, minWidth: 0, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: TEXT, fontFamily: FONT, outline: 'none' }
const addBtnStyle = { flexShrink: 0, width: 42, borderRadius: 10, border: `1px solid ${GREEN}66`, background: `${GREEN}26`, color: GREEN, fontSize: 18, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }
const headingStyle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, fontFamily: FONT }

function Checkbox({ checked, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={checked ? 'Mark not done' : 'Mark done'}
      style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: checked ? `1px solid ${GREEN}` : '1px solid var(--lt-input-border)', background: checked ? GREEN : 'var(--lt-surface-2)', transition: 'all .15s ease' }}>
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.2 2.2 4.8-4.8" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : null}
    </button>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
      <Checkbox checked={task.done} onClick={() => onToggle(task)} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: task.done ? MUTED : TEXT, fontFamily: FONT, textDecoration: task.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      {hover ? <button type="button" onClick={() => onDelete(task)} aria-label="Delete" style={{ background: 'none', border: 'none', color: '#e06a78', cursor: 'pointer', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button> : null}
    </div>
  )
}

export default function TodoWidget({ userId, kind, label }) {
  const [tasks, setTasks] = useState([])
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  async function load() {
    if (!userId) return
    if (isDemoMode()) { setTasks(demoTasks(kind)); return }
    const { data } = await supabase.from('creative_tasks').select('*').eq('user_id', userId).eq('kind', kind).order('created_at', { ascending: true })
    setTasks(data ?? [])
  }
  useEffect(() => { void load() }, [userId, kind])

  async function add(title) {
    const { data } = await supabase.from('creative_tasks').insert({ user_id: userId, kind, title, done: false }).select().single()
    if (data) setTasks((p) => [...p, data])
  }
  async function toggle(task) {
    const next = !task.done
    setTasks((p) => p.map((x) => (x.id === task.id ? { ...x, done: next } : x)))
    await supabase.from('creative_tasks').update({ done: next, updated_at: new Date().toISOString() }).eq('id', task.id)
  }
  async function del(task) {
    setTasks((p) => p.filter((x) => x.id !== task.id))
    await supabase.from('creative_tasks').delete().eq('id', task.id)
  }
  function submit() { const v = text.trim(); if (!v) return; add(v); setText('') }

  const active = tasks.filter((x) => !x.done)
  const done = tasks.filter((x) => x.done)

  return (
    <>
      <Tile label={label} onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: active.length ? TEXT : GREEN, fontFamily: FONT, lineHeight: 1 }}>{active.length}</span>
          <span style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT }}>{active.length ? 'to do' : 'done ✨'}</span>
        </div>
      </Tile>

      {open ? (
        <CenterModal title={label} subtitle={`${active.length} to do${done.length ? ` · ${done.length} done` : ''}`} width={540} onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} placeholder={`Add a ${kind} task...`} style={inputStyle} />
            <button type="button" onClick={submit} aria-label="Add task" style={addBtnStyle}>+</button>
          </div>
          {active.length === 0 ? <div style={{ fontSize: 14, color: MUTED, fontFamily: FONT, padding: '10px 0' }}>Nothing yet.</div> : active.map((tk) => <TaskRow key={tk.id} task={tk} onToggle={toggle} onDelete={del} />)}
          {done.length > 0 ? (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--lt-border)' }}>
              <div style={{ ...headingStyle, marginBottom: 6 }}>Completed ({done.length})</div>
              {done.map((tk) => <TaskRow key={tk.id} task={tk} onToggle={toggle} onDelete={del} />)}
            </div>
          ) : null}
        </CenterModal>
      ) : null}
    </>
  )
}
