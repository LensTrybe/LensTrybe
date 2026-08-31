import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Palette of stage colours a creative can pick from.
const COLORS = ['#8b8f9a', '#4aa3ff', '#1DB954', '#f5a524', '#FF2D78', '#9b6bff', '#38d16f', '#f0516d']

// Seeded once per creative. They rename, recolour, reorder, add and delete freely after that.
const DEFAULT_STAGES = [
  { name: 'New enquiry', color: '#8b8f9a' },
  { name: 'Quote sent', color: '#4aa3ff' },
  { name: 'Booked', color: '#1DB954' },
  { name: 'In progress', color: '#f5a524' },
  { name: 'Delivered', color: '#9b6bff' },
  { name: 'Complete', color: '#38d16f' },
]

// Maps the old free-text stage values onto the new default stage names, so existing
// projects land in a sensible column the first time the new board loads.
const LEGACY_STAGE_ALIAS = {
  inquiry: 'New enquiry',
  'new inquiry': 'New enquiry',
  'new enquiry': 'New enquiry',
  proposal: 'Quote sent',
  'proposal sent': 'Quote sent',
  'quote sent': 'Quote sent',
  booked: 'Booked',
  'in progress': 'In progress',
  completed: 'Complete',
  complete: 'Complete',
  delivered: 'Delivered',
  archived: 'Complete',
}

function money(v) {
  if (v == null || v === '') return '$0'
  const n = Number(v)
  if (Number.isNaN(n)) return '$0'
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function prettyDate(d) {
  if (!d) return null
  const dt = new Date(d + 'T00:00:00')
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function darken(hex, amt = 46) {
  try {
    const n = parseInt(hex.slice(1), 16)
    let r = (n >> 16) - amt, g = ((n >> 8) & 255) - amt, b = (n & 255) - amt
    r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b)
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  } catch { return hex }
}

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const CSS = `
.ltp{position:relative;min-height:60vh;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.ltp *{box-sizing:border-box}
.ltp .inner{max-width:1240px;margin:0 auto;position:relative;z-index:1}
.ltp .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
.ltp h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0}
.ltp .sub{color:var(--lt-muted);font-size:13.5px;margin-top:4px}
.ltp .hactions{display:flex;gap:10px;align-items:center;flex-shrink:0;flex-wrap:wrap}
.ltp .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}
.ltp .btn:hover{background:var(--lt-surface-2);border-color:var(--lt-border)}
.ltp .btn svg{width:15px;height:15px}
.ltp .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700;box-shadow:0 6px 18px -8px rgba(29,185,84,0.7)}
.ltp .btn.primary:hover{background:#22c95f}
.ltp .btn.ghost{background:transparent;border-color:transparent;color:var(--lt-muted)}
.ltp .btn.ghost:hover{color:var(--lt-text);background:var(--lt-surface)}
.ltp .toolbar{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.ltp .search{flex:1;min-width:200px;display:flex;align-items:center;gap:9px;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:9px 13px;color:var(--lt-muted)}
.ltp .search input{flex:1;background:none;border:none;outline:none;color:var(--lt-text);font-family:inherit;font-size:13.5px}
.ltp .search input::placeholder{color:var(--lt-faint)}
.ltp .segment{display:flex;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:3px}
.ltp .segment button{font-family:inherit;font-size:12.5px;font-weight:600;border:none;background:none;color:var(--lt-muted);padding:6px 13px;border-radius:8px;cursor:pointer;transition:.15s}
.ltp .segment button.on{background:var(--lt-border);color:var(--lt-text)}
.ltp .board{display:flex;gap:15px;align-items:flex-start;overflow-x:auto;padding-bottom:24px;scrollbar-width:thin}
.ltp .board::-webkit-scrollbar{height:9px}
.ltp .board::-webkit-scrollbar-thumb{background:var(--lt-border);border-radius:99px}
.ltp .col{flex:0 0 276px;width:276px;border-radius:15px;padding:5px;transition:background .15s}
.ltp .col.dragover{background:var(--lt-surface)}
.ltp .colhead{display:flex;align-items:center;gap:9px;padding:8px 8px 12px;position:relative}
.ltp .grip{color:var(--lt-faint);cursor:grab;display:flex;opacity:0;transition:.15s;margin-left:-4px}
.ltp .col:hover .grip{opacity:1}
.ltp .grip svg{width:14px;height:16px}
.ltp .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.ltp .colname{font-size:13px;font-weight:700;letter-spacing:-0.01em;outline:none;border-radius:5px;padding:1px 4px;margin:-1px -4px;max-width:150px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ltp .colname:focus{background:var(--lt-surface-2);box-shadow:0 0 0 2px rgba(29,185,84,0.5);overflow:visible;text-overflow:clip}
.ltp .count{font-size:11.5px;color:var(--lt-faint);font-weight:600;background:var(--lt-surface);border-radius:99px;padding:1px 8px}
.ltp .colmenu{margin-left:auto;color:var(--lt-faint);cursor:pointer;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;opacity:0;transition:.15s}
.ltp .col:hover .colmenu{opacity:1}
.ltp .colmenu:hover{background:var(--lt-surface-2);color:var(--lt-text)}
.ltp .cards{display:flex;flex-direction:column;gap:9px;min-height:40px;padding:2px}
.ltp .card{background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:13px;padding:13px 13px 11px;cursor:pointer;transition:.15s;position:relative;overflow:hidden}
.ltp .card:hover{border-color:var(--lt-border);background:var(--lt-surface-2);transform:translateY(-1px)}
.ltp .card.dragging{opacity:0.4}
.ltp .card .accent{position:absolute;left:0;top:0;bottom:0;width:3px}
.ltp .card .ctitle{font-size:13.5px;font-weight:700;letter-spacing:-0.01em;margin-bottom:7px;padding-left:4px}
.ltp .cmeta{display:flex;align-items:center;gap:7px;margin-bottom:9px;padding-left:4px}
.ltp .avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex:0 0 auto}
.ltp .cclient{font-size:12px;color:var(--lt-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ltp .chip{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:99px;background:var(--lt-surface-2);color:var(--lt-muted)}
.ltp .crow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:4px;margin-top:2px}
.ltp .cval{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.ltp .ctags{display:flex;gap:5px;flex-wrap:wrap;padding-left:4px;margin-top:9px;align-items:center}
.ltp .tag{font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px;background:var(--lt-surface-2);color:var(--lt-muted)}
.ltp .cdate{font-size:11px;color:var(--lt-faint);margin-left:auto}
.ltp .addcard{margin:6px 2px 0;padding:8px;border-radius:10px;border:1px dashed var(--lt-border);color:var(--lt-faint);font-size:12px;font-weight:600;text-align:center;cursor:pointer;transition:.15s}
.ltp .addcard:hover{border-color:#1DB954;color:#1DB954}
.ltp .addstage{flex:0 0 200px;padding:5px}
.ltp .addstage .box{border:1px dashed var(--lt-border);border-radius:14px;padding:16px 12px;text-align:center;color:var(--lt-faint);font-size:12.5px;font-weight:600;cursor:pointer;transition:.15s}
.ltp .addstage .box:hover{border-color:#1DB954;color:#1DB954;background:rgba(29,185,84,0.12)}
.ltp .pop{position:fixed;z-index:1200;background:var(--lt-modal-bg);border:1px solid var(--lt-input-border);border-radius:12px;padding:6px;min-width:190px;box-shadow:var(--lt-modal-shadow)}
.ltp .pop button{display:flex;align-items:center;gap:10px;width:100%;font-family:inherit;font-size:13px;color:var(--lt-text);background:none;border:none;padding:9px 10px;border-radius:8px;cursor:pointer;text-align:left}
.ltp .pop button:hover{background:var(--lt-surface-2)}
.ltp .pop button.danger{color:#f0516d}
.ltp .pop button svg{width:15px;height:15px;color:var(--lt-muted)}
.ltp .pop button.danger svg{color:#f0516d}
.ltp .pop .sep{height:1px;background:var(--lt-hairline);margin:5px 4px}
.ltp .pop .swatches{display:flex;gap:7px;padding:8px;flex-wrap:wrap}
.ltp .sw{width:22px;height:22px;border-radius:7px;cursor:pointer;border:2px solid transparent;transition:.12s}
.ltp .sw:hover{transform:scale(1.12)}
.ltp .sw.sel{border-color:#fff}
.ltp .pop .lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint);padding:6px 10px 2px}
.ltp .list{border:1px solid var(--lt-border);border-radius:15px;overflow:hidden;background:var(--lt-surface)}
.ltp .lrow{display:grid;grid-template-columns:2.2fr 1.6fr 1fr 1.2fr 1fr;gap:12px;padding:14px 18px;border-bottom:1px solid var(--lt-surface-2);align-items:center;cursor:pointer;transition:.12s}
.ltp .lrow:last-child{border-bottom:none}
.ltp .lrow:hover{background:var(--lt-surface)}
.ltp .lrow.head{background:var(--lt-surface);cursor:default;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint)}
.ltp .lrow.head:hover{background:var(--lt-surface)}
.ltp .stagepill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:99px}
.ltp .empty{padding:70px 20px;text-align:center;color:var(--lt-muted);font-size:14px}
.ltp .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px}
.ltp .modalbox{background:var(--lt-modal-bg);border:1px solid var(--lt-input-border);border-radius:18px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:26px;box-shadow:var(--lt-modal-shadow)}
.ltp .mtitle{font-size:17px;font-weight:800;letter-spacing:-0.02em;margin-bottom:20px}
.ltp .field{margin-bottom:14px}
.ltp .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.ltp .inp{width:100%;background:var(--lt-surface);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none}
.ltp .inp:focus{border-color:#1DB954}
.ltp select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.ltp .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ltp .mactions{display:flex;gap:10px;justify-content:flex-end;margin-top:22px}
.ltp .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300;display:flex;align-items:center;gap:9px}
.ltp .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ltp .toast.err{border-color:rgba(240,81,109,0.5)}
@media (max-width:767px){
  .ltp .col{flex:0 0 84vw;width:84vw}
  .ltp .grid2{grid-template-columns:1fr}
  .ltp .lrow{grid-template-columns:1.6fr 1fr;gap:8px}
  .ltp .lrow .hide-m{display:none}
}
.ltp .card,.ltp .list{background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltp .modalbox,.ltp .pop{background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.ltp .search,.ltp .segment{backdrop-filter:blur(12px) saturate(140%);-webkit-backdrop-filter:blur(12px) saturate(140%)}
`

export default function ProjectsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [stages, setStages] = useState([])
  const [projects, setProjects] = useState([])
  const [contacts, setContacts] = useState([])
  const [view, setView] = useState('board')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', project_type: '', contact_id: '', stage_id: '', event_date: '', value: '', notes: '' })
  const [menu, setMenu] = useState(null) // { stageId, x, y }
  const [toast, setToast] = useState(null)

  const dragCard = useRef(null)
  const dragCol = useRef(null)
  const didDrag = useRef(false)

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { if (user) init() }, [user])

  useEffect(() => {
    function close() { setMenu(null) }
    if (menu) {
      window.addEventListener('click', close)
      return () => window.removeEventListener('click', close)
    }
  }, [menu])

  function flash(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2400)
  }

  async function init() {
    setLoading(true)
    let { data: st } = await supabase.from('pipeline_stages').select('*').eq('creative_id', user.id).order('position', { ascending: true })
    if (!st || st.length === 0) {
      const rows = DEFAULT_STAGES.map((s, i) => ({ creative_id: user.id, name: s.name, color: s.color, position: i }))
      const { data: seeded } = await supabase.from('pipeline_stages').insert(rows).select()
      st = (seeded || []).sort((a, b) => a.position - b.position)
    }
    setStages(st)

    const { data: cts } = await supabase.from('crm_contacts').select('id, name').eq('creative_id', user.id).order('name', { ascending: true })
    setContacts(cts || [])

    const { data: pj } = await supabase.from('projects').select('*, contact:crm_contacts(id, name)').eq('creative_id', user.id).order('created_at', { ascending: false })
    let list = pj || []

    // First run after the new board: map any project without a stage_id onto a stage.
    const needMap = list.filter(p => !p.stage_id)
    if (needMap.length && st.length) {
      const byName = {}
      st.forEach(s => { byName[s.name.toLowerCase()] = s.id })
      const updates = []
      list = list.map(p => {
        if (p.stage_id) return p
        const aliasName = LEGACY_STAGE_ALIAS[(p.stage || '').toLowerCase()]
        const target = (aliasName && byName[aliasName.toLowerCase()]) || st[0].id
        updates.push({ id: p.id, stage_id: target })
        return { ...p, stage_id: target }
      })
      for (const u of updates) await supabase.from('projects').update({ stage_id: u.stage_id }).eq('id', u.id)
    }
    setProjects(list)
    setLoading(false)
  }

  async function createProject() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      creative_id: user.id,
      title: form.title.trim(),
      project_type: form.project_type || null,
      contact_id: form.contact_id || null,
      stage_id: form.stage_id || (stages[0] && stages[0].id) || null,
      event_date: form.event_date || null,
      value: form.value === '' ? null : Number(form.value),
      notes: form.notes || null,
    }
    const { error } = await supabase.from('projects').insert(payload)
    setSaving(false)
    if (error) { flash(error.message, 'err'); return }
    setShowCreate(false)
    setForm({ title: '', project_type: '', contact_id: '', stage_id: '', event_date: '', value: '', notes: '' })
    flash('Project created')
    init()
  }

  async function moveCard(projectId, stageId) {
    const p = projects.find(x => x.id === projectId)
    if (!p || p.stage_id === stageId) return
    setProjects(prev => prev.map(x => x.id === projectId ? { ...x, stage_id: stageId } : x))
    const st = stages.find(s => s.id === stageId)
    await supabase.from('projects').update({ stage_id: stageId, updated_at: new Date().toISOString() }).eq('id', projectId)
    if (st) flash('Moved to ' + st.name)
  }

  async function renameStage(id, name) {
    const clean = (name || '').trim()
    const st = stages.find(s => s.id === id)
    if (!st || !clean || clean === st.name) { setStages(s => [...s]); return }
    setStages(prev => prev.map(s => s.id === id ? { ...s, name: clean } : s))
    await supabase.from('pipeline_stages').update({ name: clean }).eq('id', id)
  }

  async function recolourStage(id, color) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, color } : s))
    await supabase.from('pipeline_stages').update({ color }).eq('id', id)
  }

  async function addStage() {
    const pos = stages.length
    const color = COLORS[pos % COLORS.length]
    const { data, error } = await supabase.from('pipeline_stages').insert({ creative_id: user.id, name: 'New stage', color, position: pos }).select().single()
    if (error) { flash(error.message, 'err'); return }
    setStages(prev => [...prev, data])
    setTimeout(() => {
      const el = document.querySelector(`[data-stagename="${data.id}"]`)
      if (el) { el.scrollIntoView({ behavior: 'smooth', inline: 'end' }); el.focus(); document.getSelection().selectAllChildren(el) }
    }, 60)
  }

  async function deleteStage(id) {
    if (projects.some(p => p.stage_id === id)) { flash('Move its projects out first', 'err'); return }
    setStages(prev => prev.filter(s => s.id !== id))
    await supabase.from('pipeline_stages').delete().eq('id', id)
    await persistOrder(stages.filter(s => s.id !== id))
  }

  async function persistOrder(list) {
    await Promise.all(list.map((s, i) => supabase.from('pipeline_stages').update({ position: i }).eq('id', s.id)))
  }

  async function reorderStage(fromId, toId) {
    if (fromId === toId) return
    const arr = [...stages]
    const from = arr.findIndex(s => s.id === fromId)
    const to = arr.findIndex(s => s.id === toId)
    if (from < 0 || to < 0) return
    const [m] = arr.splice(from, 1)
    arr.splice(to, 0, m)
    setStages(arr)
    await persistOrder(arr)
  }

  function moveStageBy(id, dir) {
    const i = stages.findIndex(s => s.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= stages.length) return
    const arr = [...stages]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setStages(arr)
    persistOrder(arr)
  }

  const q = search.trim().toLowerCase()
  const filtered = projects.filter(p => !q ||
    p.title?.toLowerCase().includes(q) ||
    p.project_type?.toLowerCase().includes(q) ||
    p.contact?.name?.toLowerCase().includes(q))

  const contactOptions = [{ id: '', name: 'No client yet' }, ...contacts]

  function StageMenu() {
    if (!menu) return null
    const st = stages.find(s => s.id === menu.stageId)
    if (!st) return null
    return (
      <div className="pop" style={{ top: menu.y, left: menu.x }} onClick={e => e.stopPropagation()}>
        <div className="lbl">Colour</div>
        <div className="swatches">
          {COLORS.map(c => (
            <span key={c} className={'sw' + (c === st.color ? ' sel' : '')} style={{ background: c }} onClick={() => { recolourStage(st.id, c); setMenu(null) }} />
          ))}
        </div>
        <div className="sep" />
        <button onClick={() => { const el = document.querySelector(`[data-stagename="${st.id}"]`); setMenu(null); if (el) { el.focus(); document.getSelection().selectAllChildren(el) } }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4-1 10-10-3-3L5 16z" /></svg>Rename stage
        </button>
        <button onClick={() => { moveStageBy(st.id, -1); setMenu(null) }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>Move left
        </button>
        <button onClick={() => { moveStageBy(st.id, 1); setMenu(null) }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>Move right
        </button>
        <div className="sep" />
        <button className="danger" onClick={() => { deleteStage(st.id); setMenu(null) }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>Delete stage
        </button>
      </div>
    )
  }

  return (
    <div className="ltp">
      <style>{CSS}</style>
      <div className="inner">
        <div className="phead">
          <div>
            <h1>Projects</h1>
            <div className="sub">Every booking start to finish. Build your pipeline your way.</div>
          </div>
          <div className="hactions">
            <button className="btn primary" onClick={() => { setForm({ title: '', project_type: '', contact_id: '', stage_id: stages[0] ? stages[0].id : '', event_date: '', value: '', notes: '' }); setShowCreate(true) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>New project
            </button>
          </div>
        </div>

        <div className="toolbar">
          <div className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            <input placeholder="Search projects, clients, types…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="segment">
            <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          </div>
        </div>

        {loading && <div className="empty">Loading your projects…</div>}

        {!loading && view === 'board' && (
          <div className="board">
            {stages.map(st => {
              const inStage = filtered.filter(p => p.stage_id === st.id)
              return (
                <div
                  key={st.id}
                  className="col"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
                  onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                  onDrop={e => {
                    e.preventDefault(); e.currentTarget.classList.remove('dragover')
                    if (dragCard.current) moveCard(dragCard.current, st.id)
                    else if (dragCol.current) reorderStage(dragCol.current, st.id)
                  }}
                >
                  <div className="colhead">
                    <span
                      className="grip"
                      draggable
                      title="Drag to reorder"
                      onDragStart={() => { dragCol.current = st.id }}
                      onDragEnd={() => { dragCol.current = null }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
                    </span>
                    <span className="dot" style={{ background: st.color }} />
                    <span
                      className="colname"
                      data-stagename={st.id}
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck={false}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                      onBlur={e => renameStage(st.id, e.currentTarget.textContent)}
                    >{st.name}</span>
                    <span className="count">{inStage.length}</span>
                    <span className="colmenu" onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ stageId: st.id, x: Math.max(8, r.right - 190), y: Math.min(window.innerHeight - 280, r.bottom + 6) }) }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
                    </span>
                  </div>
                  <div className="cards">
                    {inStage.map(p => (
                      <div
                        key={p.id}
                        className="card"
                        draggable
                        onMouseDown={() => { didDrag.current = false }}
                        onDragStart={() => { dragCard.current = p.id; didDrag.current = true }}
                        onDragEnd={() => { dragCard.current = null; setTimeout(() => { didDrag.current = false }, 60) }}
                        onClick={() => { if (!didDrag.current) navigate(`/dashboard/projects/${p.id}`) }}
                      >
                        <span className="accent" style={{ background: st.color }} />
                        <div className="ctitle">{p.title}</div>
                        <div className="cmeta">
                          <span className="avatar" style={{ background: `linear-gradient(140deg, ${st.color}, ${darken(st.color)})` }}>{initials(p.contact?.name || p.title)}</span>
                          <span className="cclient">{p.contact?.name || 'No client yet'}</span>
                        </div>
                        <div className="crow">
                          {p.project_type ? <span className="chip">{p.project_type}</span> : <span />}
                          <span className="cval">{money(p.value)}</span>
                        </div>
                        {(Array.isArray(p.tags) && p.tags.length) || p.event_date ? (
                          <div className="ctags">
                            {(p.tags || []).slice(0, 2).map((t, i) => <span key={i} className="tag">{t}</span>)}
                            {p.event_date && <span className="cdate">{prettyDate(p.event_date)}</span>}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {inStage.length === 0 && <div className="addcard" onClick={() => { setForm({ title: '', project_type: '', contact_id: '', stage_id: st.id, event_date: '', value: '', notes: '' }); setShowCreate(true) }}>+ Add project</div>}
                  </div>
                </div>
              )
            })}
            <div className="addstage">
              <div className="box" onClick={addStage}>+ Add stage</div>
            </div>
          </div>
        )}

        {!loading && view === 'list' && (
          filtered.length === 0 ? (
            <div className="empty">No projects yet. Click New project to create your first one.</div>
          ) : (
            <div className="list">
              <div className="lrow head">
                <span>Project</span><span>Client</span><span className="hide-m">Type</span><span className="hide-m">Stage</span><span style={{ textAlign: 'right' }}>Value</span>
              </div>
              {filtered.map(p => {
                const st = stages.find(s => s.id === p.stage_id)
                return (
                  <div key={p.id} className="lrow" onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                    <span style={{ fontWeight: 600 }}>{p.title}</span>
                    <span style={{ color: 'var(--lt-muted)' }}>{p.contact?.name || '—'}</span>
                    <span className="hide-m">{p.project_type ? <span className="chip">{p.project_type}</span> : '—'}</span>
                    <span className="hide-m">{st ? <span className="stagepill" style={{ background: st.color + '22', color: st.color }}><span className="dot" style={{ background: st.color }} />{st.name}</span> : '—'}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(p.value)}</span>
                  </div>
                )
              })}
            </div>
          )
        )}

        {!loading && view === 'board' && filtered.length === 0 && (
          <div className="empty">No projects yet. Click New project, or drop one into a stage to get going.</div>
        )}
      </div>

      <StageMenu />

      {showCreate && (
        <div className="modal" onClick={() => setShowCreate(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">New project</div>
            <div className="field">
              <label className="lab">Project title</label>
              <input className="inp" autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Sarah & Tom, Wedding" />
            </div>
            <div className="grid2">
              <div className="field">
                <label className="lab">Type</label>
                <input className="inp" value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))} placeholder="Wedding, Brand shoot…" />
              </div>
              <div className="field">
                <label className="lab">Client</label>
                <select className="inp" value={form.contact_id} onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}>
                  {contactOptions.map(c => <option key={c.id || 'none'} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid2">
              <div className="field">
                <label className="lab">Event date</label>
                <input className="inp" type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="lab">Value (AUD)</label>
                <input className="inp" type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="2400" />
              </div>
            </div>
            <div className="field">
              <label className="lab">Stage</label>
              <select className="inp" value={form.stage_id} onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lab">Notes</label>
              <textarea className="inp" style={{ minHeight: 80, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything worth remembering…" />
            </div>
            <div className="mactions">
              <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn primary" disabled={saving || !form.title.trim()} style={{ opacity: (saving || !form.title.trim()) ? 0.5 : 1 }} onClick={createProject}>{saving ? 'Saving…' : 'Create project'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={'toast show' + (toast.type === 'err' ? ' err' : '')}>
          {toast.type === 'err' ? '⚠' : '✓'} {toast.msg}
        </div>
      )}
    </div>
  )
}
