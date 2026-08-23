import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { themeTokens } from '../../lib/dashboardTheme'

const FONT = "'Inter', sans-serif"

const BOARD_COLS = [
  { key: 'todo', label: 'To do', dot: '#3b82f6', tint: 'rgba(59,130,246,0.14)' },
  { key: 'in_progress', label: 'In progress', dot: '#f59e0b', tint: 'rgba(245,158,11,0.16)' },
  { key: 'in_review', label: 'In review', dot: '#a855f7', tint: 'rgba(168,85,247,0.15)' },
  { key: 'done', label: 'Done', dot: '#1DB954', tint: 'rgba(29,185,84,0.16)' },
]
const BOARD_ORDER = BOARD_COLS.map((c) => c.key)

function timeAgo(value) {
  if (!value) return ''
  const s = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function AddRow({ value, onChange, onAdd, placeholder, accent, t }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: t.inputBg, border: t.inputBorder, borderRadius: 9, padding: '8px 11px', fontSize: 13, color: t.text, fontFamily: FONT, outline: 'none' }}
      />
      <button type="button" onClick={onAdd} aria-label="Add" style={{ flexShrink: 0, width: 32, borderRadius: 9, border: `1px solid ${accent}66`, background: `${accent}26`, color: accent, fontSize: 17, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>+</button>
    </div>
  )
}

function BoardCard({ task, col, avatarLabel, onMove, onDelete, t }) {
  const [hover, setHover] = useState(false)
  const idx = BOARD_ORDER.indexOf(task.board_status)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: t.cardBg, border: t.cardBorder, borderLeft: `3px solid ${col.dot}`, borderRadius: 11, padding: '11px 12px', marginBottom: 9, boxShadow: t.cardShadow }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, color: t.text, fontFamily: FONT, lineHeight: 1.35, fontWeight: 500 }}>{task.title}</span>
        {hover ? <button type="button" onClick={() => onDelete(task)} aria-label="Delete" style={{ background: 'none', border: 'none', color: '#e06a78', cursor: 'pointer', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${col.dot}22`, color: col.dot, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>{avatarLabel}</span>
          <span style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT }}>{timeAgo(task.created_at)}</span>
        </div>
        <div style={{ display: 'flex', gap: 5, opacity: hover ? 1 : 0.5, transition: 'opacity 0.15s' }}>
          <button type="button" onClick={() => onMove(task, -1)} disabled={idx <= 0} aria-label="Back" style={{ border: t.ctrlBorder, background: t.ctrlBg, borderRadius: 6, width: 22, height: 20, cursor: idx <= 0 ? 'default' : 'pointer', color: idx <= 0 ? t.textMuted : t.ctrlText, fontSize: 11, lineHeight: 1 }}>‹</button>
          <button type="button" onClick={() => onMove(task, 1)} disabled={idx >= BOARD_ORDER.length - 1} aria-label="Forward" style={{ border: t.ctrlBorder, background: t.ctrlBg, borderRadius: 6, width: 22, height: 20, cursor: idx >= BOARD_ORDER.length - 1 ? 'default' : 'pointer', color: idx >= BOARD_ORDER.length - 1 ? t.textMuted : t.ctrlText, fontSize: 11, lineHeight: 1 }}>›</button>
        </div>
      </div>
    </div>
  )
}

function ChecklistItem({ task, onToggle, onDelete, t }) {
  const [hover, setHover] = useState(false)
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
      <button type="button" onClick={() => onToggle(task)} aria-label="Toggle" style={{ flexShrink: 0, width: 17, height: 17, borderRadius: '50%', border: task.done ? 'none' : `1.5px solid ${t.dark ? 'rgba(150,190,240,0.4)' : 'rgba(20,17,26,0.22)'}`, background: task.done ? t.accent : 'transparent', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{task.done ? '✓' : ''}</button>
      <span style={{ flex: 1, fontSize: 13, fontFamily: FONT, color: task.done ? t.textMuted : t.text, textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</span>
      {hover ? <button type="button" onClick={() => onDelete(task)} aria-label="Delete" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#e06a78', cursor: 'pointer', fontSize: 13 }}>✕</button> : null}
    </div>
  )
}

function FocusCard({ heading, tag, items, value, onInput, onAdd, onToggle, onDelete, t }) {
  const done = items.filter((i) => i.done).length
  return (
    <div style={{ background: t.glassBg, border: t.glassBorder, boxShadow: t.glassShadow, backdropFilter: t.glassBlur, WebkitBackdropFilter: t.glassBlur, borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: FONT }}>{heading}</div>
        <div style={{ fontSize: 12, color: t.textMuted, fontFamily: FONT }}>{items.length ? `${done}/${items.length}` : tag}</div>
      </div>
      <div style={{ marginTop: 4 }}>
        {items.length === 0 ? <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 0', fontFamily: FONT }}>Nothing yet.</div>
          : items.map((task) => <ChecklistItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} t={t} />)}
      </div>
      <AddRow value={value} onChange={onInput} onAdd={onAdd} placeholder="Add a task…" accent={t.accent} t={t} />
    </div>
  )
}

export default function DashboardTasks({ userId, avatarLabel = 'U', hideHeading = false, t: tProp }) {
  const t = tProp || themeTokens(false)
  const [tasks, setTasks] = useState([])
  const [inputs, setInputs] = useState({ daily: '', weekly: '', todo: '', in_progress: '', in_review: '', done: '' })
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      const { data } = await supabase.from('creative_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: true })
      if (active) setTasks(data ?? [])
    })()
    return () => { active = false }
  }, [userId])

  const setInput = (k, v) => setInputs((p) => ({ ...p, [k]: v }))

  async function addTask(kind, boardStatus) {
    const key = boardStatus || kind
    const title = (inputs[key] || '').trim()
    if (!title) return
    setInput(key, '')
    const row = { user_id: userId, kind, title, done: false, board_status: boardStatus || null, position: Date.now() % 1000000 }
    const { data } = await supabase.from('creative_tasks').insert(row).select().single()
    if (data) setTasks((p) => [...p, data])
  }
  async function toggleDone(task) {
    const done = !task.done
    setTasks((p) => p.map((x) => (x.id === task.id ? { ...x, done } : x)))
    await supabase.from('creative_tasks').update({ done, updated_at: new Date().toISOString() }).eq('id', task.id)
  }
  async function del(task) {
    setTasks((p) => p.filter((x) => x.id !== task.id))
    await supabase.from('creative_tasks').delete().eq('id', task.id)
  }
  async function moveCard(task, dir) {
    const idx = BOARD_ORDER.indexOf(task.board_status)
    const next = BOARD_ORDER[Math.min(BOARD_ORDER.length - 1, Math.max(0, idx + dir))]
    if (next === task.board_status) return
    const done = next === 'done'
    setTasks((p) => p.map((x) => (x.id === task.id ? { ...x, board_status: next, done } : x)))
    await supabase.from('creative_tasks').update({ board_status: next, done, updated_at: new Date().toISOString() }).eq('id', task.id)
  }

  const daily = tasks.filter((x) => x.kind === 'daily')
  const weekly = tasks.filter((x) => x.kind === 'weekly')
  const board = tasks.filter((x) => x.kind === 'board')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        {!hideHeading ? (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 19 : 22, color: t.text, margin: 0 }}>Work board</h2>
            <span style={{ fontSize: 12, color: t.textMuted, fontFamily: FONT }}>{board.length} task{board.length === 1 ? '' : 's'}</span>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
          {BOARD_COLS.map((col) => {
            const cards = board.filter((x) => x.board_status === col.key)
            return (
              <div key={col.key} style={{
                background: t.dark ? `linear-gradient(160deg, ${col.tint}, rgba(14,24,46,0.5))` : `linear-gradient(160deg, ${col.tint}, rgba(255,255,255,0.34))`,
                backdropFilter: 'blur(6px) saturate(150%)', WebkitBackdropFilter: 'blur(6px) saturate(150%)',
                border: t.dark ? '1px solid rgba(120,190,255,0.14)' : '1px solid rgba(255,255,255,0.55)',
                boxShadow: t.dark ? '0 10px 30px -18px rgba(0,0,0,0.6), inset 0 0 30px -18px rgba(56,189,248,0.4)' : '0 10px 30px -18px rgba(31,38,90,0.28), inset 0 1px 1px rgba(255,255,255,0.7)',
                borderRadius: 18, padding: 13, minHeight: 170,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 2px' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot, boxShadow: t.dark ? `0 0 8px ${col.dot}` : 'none' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: FONT }}>{col.label}</span>
                  <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 'auto', background: t.dark ? 'rgba(120,190,255,0.12)' : 'rgba(255,255,255,0.7)', borderRadius: 999, padding: '1px 8px', fontWeight: 600, fontFamily: FONT }}>{cards.length}</span>
                </div>
                {cards.map((task) => <BoardCard key={task.id} task={task} col={col} avatarLabel={avatarLabel} onMove={moveCard} onDelete={del} t={t} />)}
                <AddRow value={inputs[col.key]} onChange={(v) => setInput(col.key, v)} onAdd={() => addTask('board', col.key)} placeholder="Add task…" accent={col.dot} t={t} />
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
        <FocusCard heading="Today's focus" tag="Daily" items={daily} value={inputs.daily} onInput={(v) => setInput('daily', v)} onAdd={() => addTask('daily')} onToggle={toggleDone} onDelete={del} t={t} />
        <FocusCard heading="This week" tag="Weekly" items={weekly} value={inputs.weekly} onInput={(v) => setInput('weekly', v)} onAdd={() => addTask('weekly')} onToggle={toggleDone} onDelete={del} t={t} />
      </div>
    </div>
  )
}
