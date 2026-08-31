import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const FONT = "'Inter', sans-serif"

// Liquid glass — matches the sidebar.
const GLASS = {
  background: 'linear-gradient(160deg, rgba(48,48,58,0.20) 0%, rgba(22,22,30,0.10) 100%)',
  backdropFilter: 'blur(14px) saturate(165%) brightness(1.06)',
  WebkitBackdropFilter: 'blur(14px) saturate(165%) brightness(1.06)',
  border: '1px solid rgba(255,255,255,0.20)',
  boxShadow: '0 24px 60px -22px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 2px var(--lt-border)',
  borderRadius: 24,
}
// Slightly more solid glass for the focused modal, so the full list is easy to read.
const MODAL_GLASS = {
  background: 'linear-gradient(160deg, rgba(42,42,52,0.62) 0%, rgba(20,20,28,0.5) 100%)',
  backdropFilter: 'blur(34px) saturate(160%)',
  WebkitBackdropFilter: 'blur(34px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.22)',
  boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.3)',
  borderRadius: 24,
}
const TEXT = 'rgba(255,255,255,0.92)'
const MUTED = 'rgba(255,255,255,0.5)'
const GREEN = '#1DB954'

const inputStyle = { flex: 1, minWidth: 0, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: TEXT, fontFamily: FONT, outline: 'none' }
const addBtnStyle = { flexShrink: 0, width: 38, borderRadius: 10, border: `1px solid ${GREEN}66`, background: `${GREEN}26`, color: GREEN, fontSize: 18, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }
const headingStyle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, fontFamily: FONT }

function Checkbox({ checked, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={checked ? 'Mark not done' : 'Mark done'}
      style={{
        width: 20, height: 20, flexShrink: 0, borderRadius: 6, cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: checked ? `1px solid ${GREEN}` : '1px solid rgba(255,255,255,0.35)',
        background: checked ? GREEN : 'var(--lt-surface-2)', transition: 'all .15s ease',
      }}>
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2l2.2 2.2 4.8-4.8" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <Checkbox checked={task.done} onClick={() => onToggle(task)} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: task.done ? MUTED : TEXT, fontFamily: FONT, textDecoration: task.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      {hover ? <button type="button" onClick={() => onDelete(task)} aria-label="Delete" style={{ background: 'none', border: 'none', color: '#e06a78', cursor: 'pointer', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button> : null}
    </div>
  )
}

// Compact fixed card shown on the dashboard.
function TodoCard({ kind, label, tasks, onAdd, onOpen }) {
  const [text, setText] = useState('')
  const activeCount = tasks.filter((x) => !x.done).length
  const doneCount = tasks.filter((x) => x.done).length
  function submit() { const v = text.trim(); if (!v) return; onAdd(kind, v); setText('') }
  return (
    <div style={{ ...GLASS, flex: '0 0 300px', maxWidth: '100%', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={headingStyle}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} placeholder={`Add a ${kind} task...`} style={inputStyle} />
        <button type="button" onClick={submit} aria-label="Add task" style={addBtnStyle}>+</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT }}>{activeCount} to do{doneCount ? ` · ${doneCount} done` : ''}</span>
        <button type="button" onClick={() => onOpen(kind)} style={{ background: 'none', border: 'none', color: GREEN, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', padding: 0 }}>View to-do list →</button>
      </div>
    </div>
  )
}

// Full list overlay.
function TodoModal({ kind, label, tasks, onAdd, onToggle, onDelete, onClose }) {
  const [text, setText] = useState('')
  const active = tasks.filter((x) => !x.done)
  const done = tasks.filter((x) => x.done)
  function submit() { const v = text.trim(); if (!v) return; onAdd(kind, v); setText('') }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(6,6,10,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...MODAL_GLASS, width: 'min(560px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px', flexShrink: 0 }}>
          <div style={headingStyle}>{label}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'var(--lt-border)', border: '1px solid var(--lt-input-border)', color: TEXT, width: 30, height: 30, borderRadius: 9, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 22px 12px', flexShrink: 0 }}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} placeholder={`Add a ${kind} task...`} style={inputStyle} />
          <button type="button" onClick={submit} aria-label="Add task" style={addBtnStyle}>+</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 22px 22px' }}>
          {active.length === 0
            ? <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT, padding: '8px 0' }}>Nothing yet.</div>
            : active.map((tk) => <TaskRow key={tk.id} task={tk} onToggle={onToggle} onDelete={onDelete} />)}
          {done.length > 0 ? (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--lt-border)' }}>
              <div style={{ ...headingStyle, marginBottom: 6 }}>Completed ({done.length})</div>
              {done.map((tk) => <TaskRow key={tk.id} task={tk} onToggle={onToggle} onDelete={onDelete} />)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function DashboardTodos({ userId }) {
  const [tasks, setTasks] = useState([])
  const [openKind, setOpenKind] = useState(null)

  async function load() {
    if (!userId) return
    const { data } = await supabase
      .from('creative_tasks')
      .select('*')
      .eq('user_id', userId)
      .in('kind', ['daily', 'weekly'])
      .order('created_at', { ascending: true })
    setTasks(data ?? [])
  }
  useEffect(() => { void load() }, [userId])

  async function add(kind, title) {
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

  const daily = tasks.filter((x) => x.kind === 'daily')
  const weekly = tasks.filter((x) => x.kind === 'weekly')
  const modalLabel = openKind === 'daily' ? 'Daily to-do' : 'Weekly to-do'
  const modalTasks = openKind === 'daily' ? daily : weekly

  return (
    <>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <TodoCard kind="daily" label="Daily to-do" tasks={daily} onAdd={add} onOpen={setOpenKind} />
        <TodoCard kind="weekly" label="Weekly to-do" tasks={weekly} onAdd={add} onOpen={setOpenKind} />
      </div>
      {openKind ? (
        <TodoModal kind={openKind} label={modalLabel} tasks={modalTasks} onAdd={add} onToggle={toggle} onDelete={del} onClose={() => setOpenKind(null)} />
      ) : null}
    </>
  )
}
