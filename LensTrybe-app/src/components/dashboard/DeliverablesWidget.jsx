import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, DANGER, AnalyticsTile, CenterModal } from './widgetKit'
import { monthBuckets, monthKeyOf, trendPct, Sparkline } from './analyticsKit'
import { isDemoMode, demoDeliverables } from '../../lib/demoMode'

const ACCENT = '#2dd4bf'
const AMBER = '#f59e0b'

const STATUSES = [
  { key: 'editing', label: 'Editing' },
  { key: 'ready', label: 'Ready to send' },
  { key: 'delivered', label: 'Delivered' },
]

function todayMidnight() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}
function dueMeta(due) {
  if (!due) return { text: 'No due date', tone: MUTED }
  const d = new Date(due + 'T00:00:00')
  const diff = Math.round((d - todayMidnight()) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`, tone: DANGER, overdue: true }
  if (diff === 0) return { text: 'Due today', tone: AMBER, soon: true }
  if (diff === 1) return { text: 'Due tomorrow', tone: AMBER, soon: true }
  if (diff <= 3) return { text: `Due in ${diff} days`, tone: AMBER, soon: true }
  return { text: `Due in ${diff} days`, tone: MUTED }
}

const inputStyle = { flex: 1, minWidth: 0, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)', borderRadius: 10, padding: '9px 11px', fontSize: 13.5, color: TEXT, fontFamily: FONT, outline: 'none' }
const secLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, margin: '16px 0 8px' }

export default function DeliverablesWidget({ userId }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', client_name: '', due_date: '' })
  const navigate = useNavigate()

  async function load() {
    if (!userId) return
    if (isDemoMode()) { setItems(demoDeliverables()); return }
    const { data } = await supabase.from('deliverable_tasks').select('*').eq('creative_id', userId).order('due_date', { ascending: true, nullsFirst: false })
    setItems(data ?? [])
  }
  useEffect(() => { void load() }, [userId])

  const d = useMemo(() => {
    const outstanding = items.filter((i) => i.status !== 'delivered')
    const overdue = outstanding.filter((i) => { const m = dueMeta(i.due_date); return m.overdue })
    const months = monthBuckets(6); const cnt = {}
    for (const it of items) { const k = monthKeyOf(it.created_at); if (k) cnt[k] = (cnt[k] || 0) + 1 }
    const series = months.map((m) => cnt[m.key] || 0)
    return { outstanding, overdue, series, trend: trendPct(series) }
  }, [items])

  async function addItem() {
    const title = form.title.trim()
    if (!title) return
    const row = { creative_id: userId, title, client_name: form.client_name.trim() || null, due_date: form.due_date || null, status: 'editing' }
    const { data } = await supabase.from('deliverable_tasks').insert(row).select().single()
    if (data) setItems((p) => [...p, data])
    setForm({ title: '', client_name: '', due_date: '' })
    setAdding(false)
  }
  async function setStatus(item, status) {
    const patch = { status, delivered_at: status === 'delivered' ? new Date().toISOString() : null }
    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, ...patch } : x)))
    await supabase.from('deliverable_tasks').update(patch).eq('id', item.id)
  }
  async function del(item) {
    setItems((p) => p.filter((x) => x.id !== item.id))
    await supabase.from('deliverable_tasks').delete().eq('id', item.id)
  }

  const grouped = STATUSES.map((s) => ({ ...s, rows: items.filter((i) => i.status === s.key) }))

  return (
    <>
      <AnalyticsTile title="Deliverables" value={d.outstanding.length || '0'} sub={d.overdue.length ? `${d.overdue.length} overdue` : (d.outstanding.length ? 'to deliver' : 'all delivered')} trend={d.trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={d.series} color={ACCENT} />
      </AnalyticsTile>

      {open ? (
        <CenterModal title="Deliverables" subtitle="Galleries and edits you owe clients" onClose={() => setOpen(false)} width={620} headerRight={
          <button type="button" onClick={() => setAdding((v) => !v)} style={{ border: `1px solid ${ACCENT}66`, background: `${ACCENT}22`, color: ACCENT, borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>{adding ? 'Cancel' : '+ Add'}</button>
        }>
          {adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 14, padding: 13, marginBottom: 8 }}>
              <input style={inputStyle} placeholder="What's owed? e.g. Smith wedding gallery" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputStyle} placeholder="Client name" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
                <input style={{ ...inputStyle, flex: '0 0 150px', colorScheme: 'dark' }} type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <button type="button" onClick={addItem} style={{ alignSelf: 'flex-start', border: `1px solid ${ACCENT}66`, background: `${ACCENT}22`, color: ACCENT, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Add deliverable</button>
            </div>
          ) : null}

          {items.length === 0 && !adding ? (
            <div style={{ fontSize: 13.5, color: MUTED, fontFamily: FONT, padding: '10px 0' }}>Nothing tracked yet. Add a gallery or edit you owe a client and set a due date so nothing slips past its turnaround.</div>
          ) : null}

          {grouped.map((g) => (g.rows.length ? (
            <div key={g.key}>
              <div style={secLabel}>{g.label} · {g.rows.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.rows.map((it) => {
                  const m = dueMeta(it.due_date)
                  const done = it.status === 'delivered'
                  return (
                    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: m.overdue && !done ? 'rgba(224,106,120,0.06)' : 'var(--lt-surface)', border: `1px solid ${m.overdue && !done ? 'rgba(224,106,120,0.22)' : 'var(--lt-border)'}`, borderRadius: 12, padding: '11px 13px', fontFamily: FONT }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: done ? MUTED : TEXT, textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          <span style={{ color: MUTED }}>{it.client_name || 'No client'}</span>
                          {!done ? <span style={{ color: m.tone }}> · {m.text}</span> : null}
                        </div>
                      </div>
                      <select value={it.status} onChange={(e) => setStatus(it, e.target.value)} style={{ flexShrink: 0, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)', borderRadius: 9, padding: '6px 8px', fontSize: 12, color: TEXT, fontFamily: FONT, outline: 'none', colorScheme: 'dark', cursor: 'pointer' }}>
                        {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      <button type="button" onClick={() => del(it)} aria-label="Delete" style={{ flexShrink: 0, background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null))}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--lt-border)' }}>
            <button type="button" onClick={() => { setOpen(false); navigate('/dashboard/portfolio-design/deliver') }} style={{ border: '1px solid var(--lt-input-border)', background: 'var(--lt-surface-2)', color: TEXT, borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontFamily: FONT, cursor: 'pointer' }}>Send final files in Deliver →</button>
          </div>
        </CenterModal>
      ) : null}
    </>
  )
}
