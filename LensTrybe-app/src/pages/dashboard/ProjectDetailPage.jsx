import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

function money(v) {
  const n = Number(v || 0)
  if (Number.isNaN(n)) return '$0'
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function prettyDate(d) {
  if (!d) return null
  const dt = new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00' : d)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fromNow(d) {
  if (!d) return ''
  const dt = new Date(d)
  const diff = Date.now() - dt.getTime()
  const day = 86400000
  if (diff < day && dt.getDate() === new Date().getDate()) return 'Today'
  if (diff < 2 * day) return 'Yesterday'
  if (diff < 7 * day) return Math.floor(diff / day) + ' days ago'
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
function darken(hex, amt = 46) {
  try {
    const n = parseInt(hex.slice(1), 16)
    let r = (n >> 16) - amt, g = ((n >> 8) & 255) - amt, b = (n & 255) - amt
    return '#' + ((1 << 24) + (Math.max(0, r) << 16) + (Math.max(0, g) << 8) + Math.max(0, b)).toString(16).slice(1)
  } catch { return hex }
}
function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
function statusClass(s) {
  const v = (s || '').toLowerCase()
  if (['paid', 'signed', 'accepted', 'completed', 'complete'].includes(v)) return 'paid'
  if (['sent', 'awaiting', 'awaiting_signature', 'pending', 'viewed'].includes(v)) return 'sent'
  if (['overdue', 'declined', 'expired'].includes(v)) return 'overdue'
  return 'draft'
}
function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${ap}`
}
function meetingWhen(date, start, end) {
  if (!date) return 'Time to be confirmed'
  const d = prettyDate(date)
  if (!start) return d
  return `${d} · ${fmtTime(start)}${end ? ' – ' + fmtTime(end) : ''}`
}
const MSTATUS = {
  draft: { label: 'Draft', cls: 'draft' },
  sent: { label: 'Awaiting reply', cls: 'sent' },
  accepted: { label: 'Confirmed', cls: 'paid' },
  declined: { label: 'Declined', cls: 'overdue' },
  reschedule: { label: 'New time proposed', cls: 'amber' },
}

const CSS = `
.ltw{position:relative;min-height:60vh;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.ltw *{box-sizing:border-box}
.ltw .inner{max-width:1240px;margin:0 auto;position:relative;z-index:1}
.ltw .back{display:inline-flex;align-items:center;gap:7px;color:var(--lt-muted);font-size:13px;font-weight:600;cursor:pointer;margin-bottom:18px;background:none;border:none;font-family:inherit}
.ltw .back:hover{color:var(--lt-text)}
.ltw .back svg{width:16px;height:16px}
.ltw .whero{display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:22px}
.ltw .big{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex:0 0 auto}
.ltw .wtitle{font-size:23px;font-weight:800;letter-spacing:-0.03em}
.ltw .wmeta{display:flex;align-items:center;gap:14px;color:var(--lt-muted);font-size:13px;margin-top:7px;flex-wrap:wrap}
.ltw .wmeta b{color:var(--lt-text);font-weight:600}
.ltw .stagepill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:99px;cursor:pointer;border:none;font-family:inherit}
.ltw .dot{width:8px;height:8px;border-radius:50%}
.ltw .wstats{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}
.ltw .stat{background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:13px;padding:11px 16px;min-width:104px}
.ltw .stat .k{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-faint)}
.ltw .stat .v{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px;letter-spacing:-0.02em}
.ltw .v.green{color:#38d16f}.ltw .v.red{color:#f0516d}.ltw .v.amber{color:#f5a524}
.ltw .actbar{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:6px}
.ltw .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 14px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}
.ltw .btn:hover{background:var(--lt-surface-2);border-color:var(--lt-border)}
.ltw .btn svg{width:15px;height:15px}
.ltw .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700}
.ltw .btn.primary:hover{background:#22c95f}
.ltw .btn.sm{padding:7px 11px;font-size:12px}
.ltw .tabs{display:flex;gap:3px;border-bottom:1px solid var(--lt-hairline);margin:22px 0 24px;overflow-x:auto;scrollbar-width:none}
.ltw .tabs::-webkit-scrollbar{display:none}
.ltw .tab{font-family:inherit;font-size:13px;font-weight:600;color:var(--lt-muted);background:none;border:none;padding:11px 14px;cursor:pointer;position:relative;white-space:nowrap;transition:.15s}
.ltw .tab:hover{color:var(--lt-text)}
.ltw .tab.on{color:var(--lt-text)}
.ltw .tab.on::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;background:#1DB954;border-radius:2px}
.ltw .tab .badge{font-size:10px;font-weight:700;background:var(--lt-border);color:var(--lt-muted);border-radius:99px;padding:0 6px;margin-left:6px}
.ltw .grid2{display:grid;grid-template-columns:1.6fr 1fr;gap:18px;align-items:start}
.ltw .panel{background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:15px;padding:18px;margin-bottom:16px}
.ltw .panel h3{font-size:14px;font-weight:700;margin:0 0 14px;letter-spacing:-0.01em;display:flex;align-items:center;justify-content:space-between}
.ltw .panel h3 a{font-size:12px;font-weight:600;color:#38d16f;cursor:pointer}
.ltw .fin{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ltw .finbox{background:var(--lt-surface);border-radius:12px;padding:13px 15px}
.ltw .finbox .k{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-faint)}
.ltw .finbox .v{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:4px;letter-spacing:-0.02em}
.ltw .bar{height:7px;border-radius:99px;background:var(--lt-border);overflow:hidden;margin-top:14px}
.ltw .bar span{display:block;height:100%;background:linear-gradient(90deg,#1DB954,#38d16f);border-radius:99px}
.ltw .barlbl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--lt-muted);margin-top:8px}
.ltw .drow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--lt-surface-2)}
.ltw .drow:last-child{border-bottom:none}
.ltw .dicon{width:36px;height:36px;border-radius:10px;background:var(--lt-surface);display:flex;align-items:center;justify-content:center;flex:0 0 auto;color:var(--lt-muted)}
.ltw .dicon svg{width:17px;height:17px}
.ltw .dmain{flex:1;min-width:0}
.ltw .dt{font-size:13.5px;font-weight:600}
.ltw .ds{font-size:11.5px;color:var(--lt-faint);margin-top:2px}
.ltw .status{font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap}
.ltw .status.paid{background:rgba(29,185,84,0.14);color:#38d16f}
.ltw .status.sent{background:rgba(74,163,255,0.14);color:#4aa3ff}
.ltw .status.overdue{background:rgba(240,81,109,0.14);color:#f0516d}
.ltw .status.draft{background:var(--lt-border);color:var(--lt-muted)}
.ltw .timeline{position:relative}
.ltw .tev{display:flex;gap:13px;padding-bottom:20px;position:relative}
.ltw .tev:last-child{padding-bottom:0}
.ltw .tev::before{content:"";position:absolute;left:12px;top:26px;bottom:-2px;width:1.5px;background:var(--lt-hairline)}
.ltw .tev:last-child::before{display:none}
.ltw .tdot{width:25px;height:25px;border-radius:50%;background:var(--lt-surface);border:1px solid var(--lt-border);display:flex;align-items:center;justify-content:center;flex:0 0 auto;z-index:1;color:var(--lt-muted)}
.ltw .tdot svg{width:13px;height:13px}
.ltw .tdot.g{background:rgba(29,185,84,0.14);border-color:transparent;color:#38d16f}
.ltw .tdot.p{background:rgba(255,45,120,0.14);border-color:transparent;color:#FF2D78}
.ltw .tbody{font-size:13px;padding-top:3px}
.ltw .tbody b{font-weight:600}
.ltw .ttime{font-size:11px;color:var(--lt-faint);margin-top:2px}
.ltw .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.ltw .gcard{border:1px solid var(--lt-border);border-radius:12px;overflow:hidden;cursor:pointer;background:var(--lt-surface);transition:.15s}
.ltw .gcard:hover{border-color:var(--lt-border)}
.ltw .gcard .thumb{aspect-ratio:1.5;background:linear-gradient(135deg,#1DB954,#0d5c2b);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.9)}
.ltw .gcard .thumb svg{width:26px;height:26px}
.ltw .gcard .cap{padding:9px 11px}
.ltw .gcard .cap .t{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ltw .gcard .cap .s{font-size:11px;color:var(--lt-faint);margin-top:2px}
.ltw .task{display:flex;align-items:center;gap:12px;padding:12px 2px;border-bottom:1px solid var(--lt-surface-2)}
.ltw .task:last-child{border-bottom:none}
.ltw .check{width:21px;height:21px;border-radius:7px;border:1.5px solid var(--lt-input-border);cursor:pointer;flex:0 0 auto;display:flex;align-items:center;justify-content:center;transition:.15s}
.ltw .check.on{background:#1DB954;border-color:#1DB954}
.ltw .check svg{width:13px;height:13px;color:#04120a;opacity:0}
.ltw .check.on svg{opacity:1}
.ltw .tasktext{font-size:13.5px;flex:1}
.ltw .task.done .tasktext{color:var(--lt-faint);text-decoration:line-through}
.ltw .addtask{display:flex;gap:9px;margin-top:14px}
.ltw .addtask input{flex:1;background:var(--lt-surface);border:1px solid var(--lt-input-border);border-radius:10px;padding:10px 13px;color:var(--lt-text);font-family:inherit;font-size:13.5px;outline:none}
.ltw .addtask input:focus{border-color:#1DB954}
.ltw .kv{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--lt-surface-2);font-size:13px;gap:10px}
.ltw .kv:last-child{border-bottom:none}
.ltw .kv .k{color:var(--lt-muted)}
.ltw .kv .v{font-weight:600;text-align:right}
.ltw .client{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.ltw .client .avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff}
.ltw .clientname{font-size:15px;font-weight:700}
.ltw .clientsub{font-size:12px;color:var(--lt-muted)}
.ltw .clientrow{display:flex;gap:8px;margin-top:12px}
.ltw .person{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--lt-hairline)}
.ltw .person:last-of-type{border-bottom:none}
.ltw .person .avatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex:0 0 auto}
.ltw .pmain{flex:1;min-width:0}
.ltw .pname{font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px}
.ltw .prole{font-size:10px;font-weight:600;padding:2px 7px;border-radius:99px;background:var(--lt-surface-2);color:var(--lt-muted)}
.ltw .pcontact{font-size:12px;color:var(--lt-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ltw .premove{background:none;border:none;color:var(--lt-faint);font-size:19px;cursor:pointer;line-height:1;padding:2px 7px;border-radius:6px;flex:0 0 auto}
.ltw .premove:hover{color:#f0516d;background:var(--lt-surface)}
.ltw .addpart{display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:14px;border-top:1px solid var(--lt-hairline)}
.ltw .addpart .inp{padding:9px 11px;font-size:13px}
.ltw .status.amber{background:rgba(245,165,36,0.14);color:#f5a524}
.ltw .mform{display:flex;flex-direction:column;gap:6px;margin-bottom:18px;padding:16px;border:1px solid var(--lt-border);border-radius:12px;background:var(--lt-surface)}
.ltw .mrow{padding:13px 0;border-bottom:1px solid var(--lt-hairline)}
.ltw .mrow:last-child{border-bottom:none}
.ltw .mnote{margin:9px 0 0 48px;font-size:12.5px;background:var(--lt-surface);border-radius:8px;padding:10px 13px}
.ltw .mactions2{display:flex;gap:8px;flex-wrap:wrap;margin:11px 0 0 48px}
.ltw .empty{padding:34px 16px;text-align:center;color:var(--lt-faint);font-size:13px}
.ltw .thread{display:flex;flex-direction:column;gap:10px}
.ltw .trow{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:var(--lt-surface);border:1px solid var(--lt-surface-2);cursor:pointer}
.ltw .trow:hover{border-color:var(--lt-border)}
.ltw .pop{position:fixed;z-index:1200;background:var(--lt-modal-bg);border:1px solid var(--lt-input-border);border-radius:12px;padding:6px;min-width:180px;box-shadow:var(--lt-modal-shadow)}
.ltw .pop button{display:flex;align-items:center;gap:9px;width:100%;font-family:inherit;font-size:13px;color:var(--lt-text);background:none;border:none;padding:9px 10px;border-radius:8px;cursor:pointer;text-align:left}
.ltw .pop button:hover{background:var(--lt-surface-2)}
.ltw .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px}
.ltw .modalbox{background:var(--lt-modal-bg);border:1px solid var(--lt-input-border);border-radius:18px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:26px}
.ltw .mtitle{font-size:17px;font-weight:800;letter-spacing:-0.02em;margin-bottom:20px}
.ltw .field{margin-bottom:14px}
.ltw .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.ltw .inp{width:100%;background:var(--lt-surface);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none}
.ltw .inp:focus{border-color:#1DB954}
.ltw select.inp{appearance:none;cursor:pointer}
.ltw .mgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ltw .mactions{display:flex;gap:10px;justify-content:space-between;margin-top:22px}
.ltw .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300}
.ltw .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
@media (max-width:900px){.ltw .grid2{grid-template-columns:1fr}.ltw .wstats{margin-left:0}}
@media (max-width:767px){.ltw .mgrid{grid-template-columns:1fr}}
.ltw .panel,.ltw .stat,.ltw .list{background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltw .modalbox,.ltw .pop{background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
`

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'messages', label: 'Messages' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'gear', label: 'Gear' },
]

export default function ProjectDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState(null)
  const [stages, setStages] = useState([])
  const [invoices, setInvoices] = useState([])
  const [quotes, setQuotes] = useState([])
  const [contracts, setContracts] = useState([])
  const [galleries, setGalleries] = useState([])
  const [threads, setThreads] = useState([])
  const [tasks, setTasks] = useState([])
  const [contacts, setContacts] = useState([])
  const [participants, setParticipants] = useState([])
  const [showAddPart, setShowAddPart] = useState(false)
  const [partForm, setPartForm] = useState({ name: '', email: '', phone: '', role: '' })
  const [meetings, setMeetings] = useState([])
  const [checkouts, setCheckouts] = useState([])
  const [hostName, setHostName] = useState('')
  const [showMeeting, setShowMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ title: '', meeting_date: '', start_time: '', end_time: '', location: '', description: '', client_name: '', client_email: '' })
  const [tab, setTab] = useState('overview')
  const [newTask, setNewTask] = useState('')
  const [stageMenu, setStageMenu] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [edit, setEdit] = useState(null)
  const [toast, setToast] = useState(null)
  const stagePillRef = useRef(null)

  useEffect(() => { if (user && id) load() }, [user, id])
  useEffect(() => {
    function close() { setStageMenu(null) }
    if (stageMenu) { window.addEventListener('click', close); return () => window.removeEventListener('click', close) }
  }, [stageMenu])

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2200) }

  async function load() {
    setLoading(true)
    const { data: p } = await supabase.from('projects').select('*, contact:crm_contacts(id, name, email, phone, company)').eq('id', id).single()
    setProject(p)
    const { data: st } = await supabase.from('pipeline_stages').select('*').eq('creative_id', user.id).order('position', { ascending: true })
    setStages(st || [])
    const { data: cts } = await supabase.from('crm_contacts').select('id, name').eq('creative_id', user.id).order('name', { ascending: true })
    setContacts(cts || [])
    const [inv, qt, ct, dl, th, tk, pt, mt, prof, co] = await Promise.all([
      supabase.from('invoices').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('quotes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('deliveries').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('message_threads').select('*').eq('project_id', id).order('last_message_at', { ascending: false }),
      supabase.from('creative_tasks').select('*').eq('project_id', id).order('position', { ascending: true }),
      supabase.from('project_participants').select('*').eq('project_id', id).order('created_at', { ascending: true }),
      supabase.from('meetings').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('business_name').eq('id', user.id).maybeSingle(),
      supabase.from('inventory_checkouts').select('*, item:inventory_items(name, photo_path)').eq('project_id', id).order('checked_out_at', { ascending: false }),
    ])
    setInvoices(inv.data || [])
    setQuotes(qt.data || [])
    setContracts(ct.data || [])
    setGalleries(dl.data || [])
    setThreads(th.data || [])
    setTasks(tk.data || [])
    setParticipants(pt.data || [])
    setMeetings(mt.data || [])
    setCheckouts(co.data || [])
    setHostName((prof.data && prof.data.business_name) || '')
    setLoading(false)
  }

  async function setStage(stageId) {
    setProject(p => ({ ...p, stage_id: stageId }))
    await supabase.from('projects').update({ stage_id: stageId, updated_at: new Date().toISOString() }).eq('id', id)
    const st = stages.find(s => s.id === stageId)
    if (st) flash('Moved to ' + st.name)
  }

  async function toggleTask(t) {
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: !x.done } : x))
    await supabase.from('creative_tasks').update({ done: !t.done, updated_at: new Date().toISOString() }).eq('id', t.id)
  }
  async function addTask() {
    const title = newTask.trim()
    if (!title) return
    setNewTask('')
    const { data, error } = await supabase.from('creative_tasks').insert({ user_id: user.id, project_id: id, title, done: false, kind: 'project', position: tasks.length }).select().single()
    if (!error && data) setTasks(prev => [...prev, data])
    else flash('Could not add task')
  }

  async function addParticipant() {
    const { name, email, phone, role } = partForm
    if (!name.trim() && !email.trim() && !phone.trim()) return
    const { data, error } = await supabase.from('project_participants').insert({
      project_id: id, creative_id: user.id,
      name: name.trim() || null, email: email.trim() || null, phone: phone.trim() || null, role: role.trim() || null,
    }).select().single()
    if (error) { flash('Could not add participant'); return }
    setParticipants(prev => [...prev, data])
    setPartForm({ name: '', email: '', phone: '', role: '' })
    setShowAddPart(false)
    flash('Participant added')
  }
  async function removeParticipant(pid) {
    setParticipants(prev => prev.filter(x => x.id !== pid))
    await supabase.from('project_participants').delete().eq('id', pid)
    flash('Participant removed')
  }

  function openNewMeeting() {
    setMeetingForm({
      title: '', meeting_date: '', start_time: '', end_time: '', location: '', description: '',
      client_name: client?.name || (participants[0] && participants[0].name) || '',
      client_email: client?.email || (participants[0] && participants[0].email) || '',
    })
    setShowMeeting(true)
  }
  async function createMeeting() {
    if (!meetingForm.title.trim()) return
    const payload = {
      creative_id: user.id, project_id: id, title: meetingForm.title.trim(),
      description: meetingForm.description || null, location: meetingForm.location || null,
      meeting_date: meetingForm.meeting_date || null, start_time: meetingForm.start_time || null, end_time: meetingForm.end_time || null,
      client_name: meetingForm.client_name || null, client_email: meetingForm.client_email || null, status: 'draft',
    }
    const { data, error } = await supabase.from('meetings').insert(payload).select().single()
    if (error) { flash('Could not create meeting'); return }
    setMeetings(prev => [data, ...prev])
    setShowMeeting(false)
    flash('Meeting created')
  }
  async function sendMeeting(m) {
    if (!m.client_email) { flash('Add a client email first'); return }
    const { error } = await supabase.functions.invoke('send-meeting', { body: { meetingId: m.id, appUrl: window.location.origin, host: { name: hostName || 'Your LensTrybe creative', email: user.email } } })
    if (error) { flash('Could not send meeting'); return }
    setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, status: 'sent' } : x))
    flash('Meeting sent to the client')
  }
  async function confirmMeeting(m, useProposed) {
    const date = useProposed ? m.client_proposed_date : m.meeting_date
    const start = useProposed ? m.client_proposed_time : m.start_time
    if (!date) { flash('Set a date first'); return }
    const evPayload = { user_id: user.id, title: m.title, event_date: date, start_time: start || null, end_time: m.end_time || null, location: m.location || null, notes: m.description || null, project_id: id, invitees: m.client_email ? [m.client_email] : [] }
    let calId = m.calendar_event_id
    if (calId) await supabase.from('calendar_events').update({ ...evPayload, updated_at: new Date().toISOString() }).eq('id', calId)
    else { const { data: ev } = await supabase.from('calendar_events').insert(evPayload).select().single(); calId = ev && ev.id }
    const patch = { status: 'accepted', meeting_date: date, start_time: start || null, calendar_event_id: calId || null, updated_at: new Date().toISOString() }
    await supabase.from('meetings').update(patch).eq('id', m.id)
    setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, ...patch } : x))
    flash('Meeting confirmed and added to your calendar')
    try { await supabase.functions.invoke('send-event-invite', { body: { event: { ...evPayload, id: calId, updated_at: new Date().toISOString() }, host: { name: hostName, email: user.email } } }) } catch { /* best effort */ }
  }
  async function checkInGear(co) {
    setCheckouts(prev => prev.map(x => x.id === co.id ? { ...x, returned_at: new Date().toISOString() } : x))
    await supabase.from('inventory_checkouts').update({ returned_at: new Date().toISOString() }).eq('id', co.id)
    flash('Gear checked back in')
  }
  async function deleteMeeting(mid) {
    setMeetings(prev => prev.filter(x => x.id !== mid))
    await supabase.from('meetings').delete().eq('id', mid)
    flash('Meeting deleted')
  }

  async function saveEdit() {
    const patch = {
      title: edit.title.trim() || project.title,
      project_type: edit.project_type || null,
      contact_id: edit.contact_id || null,
      event_date: edit.event_date || null,
      value: edit.value === '' ? null : Number(edit.value),
      lead_source: edit.lead_source || null,
      notes: edit.notes || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('projects').update(patch).eq('id', id)
    setShowEdit(false)
    flash('Saved')
    load()
  }

  if (loading) return <div className="ltw"><style>{CSS}</style><div className="inner"><div className="empty" style={{ padding: 80 }}>Loading project…</div></div></div>
  if (!project) return <div className="ltw"><style>{CSS}</style><div className="inner"><button className="back" onClick={() => navigate('/dashboard/projects')}>← All projects</button><div className="empty" style={{ padding: 80 }}>Project not found.</div></div></div>

  const stage = stages.find(s => s.id === project.stage_id)
  const stColor = stage ? stage.color : '#8b8f9a'
  const client = project.contact

  const invoiced = invoices.reduce((a, b) => a + Number(b.amount || 0), 0)
  const paid = invoices.filter(i => (i.status || '').toLowerCase() === 'paid').reduce((a, b) => a + Number(b.amount || 0), 0)
  const acceptedQuotes = quotes.filter(q => (q.status || '').toLowerCase() === 'accepted').reduce((a, b) => a + Number(b.amount || 0), 0)
  const quoted = acceptedQuotes || Number(project.value || 0) || quotes.reduce((a, b) => Math.max(a, Number(b.amount || 0)), 0)
  const outstanding = Math.max(0, invoiced - paid)
  const headlineValue = Number(project.value || 0) || quoted || invoiced
  const collectedPct = invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0

  // Synthesised activity feed from linked records.
  const events = []
  invoices.forEach(i => {
    events.push({ t: i.created_at, icon: 'inv', text: `Invoice for ${money(i.amount)}${i.status ? ' (' + i.status + ')' : ''}`, tone: (i.status || '').toLowerCase() === 'paid' ? 'g' : '' })
  })
  quotes.forEach(qq => events.push({ t: qq.created_at, icon: 'quote', text: `Quote for ${money(qq.amount)}${qq.status ? ' (' + qq.status + ')' : ''}`, tone: (qq.status || '').toLowerCase() === 'accepted' ? 'g' : '' }))
  contracts.forEach(c => events.push({ t: c.signed_at || c.created_at, icon: 'contract', text: `Contract ${c.title || ''} ${(c.status || '').toLowerCase() === 'signed' ? 'signed' : 'created'}`, tone: (c.status || '').toLowerCase() === 'signed' ? 'p' : '' }))
  galleries.forEach(g => events.push({ t: g.created_at, icon: 'gallery', text: `Gallery "${g.title || 'Delivery'}" created`, tone: '' }))
  events.push({ t: project.created_at, icon: 'created', text: `Project created${project.lead_source ? ' from ' + project.lead_source : ''}`, tone: 'p' })
  events.sort((a, b) => new Date(b.t || 0) - new Date(a.t || 0))

  const ICONS = {
    inv: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8" /></svg>,
    quote: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h6M9 11h6" /></svg>,
    contract: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l5 5v13H6z" /></svg>,
    gallery: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5-4 4 3 3-2 4 3" /></svg>,
    created: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5" /></svg>,
  }

  const openTasks = tasks.filter(t => !t.done)

  return (
    <div className="ltw">
      <style>{CSS}</style>
      <div className="inner">
        <button className="back" onClick={() => navigate('/dashboard/projects')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>All projects
        </button>

        <div className="whero">
          <div className="big" style={{ background: `linear-gradient(140deg, ${stColor}, ${darken(stColor)})` }}>{initials(client?.name || project.title)}</div>
          <div>
            <div className="wtitle">{project.title}</div>
            <div className="wmeta">
              <button ref={stagePillRef} className="stagepill" style={{ background: stColor + '22', color: stColor }} onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setStageMenu({ x: r.left, y: r.bottom + 6 }) }}>
                <span className="dot" style={{ background: stColor }} />{stage ? stage.name : 'No stage'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {client?.name && <span>👤 <b>{client.name}</b></span>}
              {project.event_date && <span>📅 <b>{prettyDate(project.event_date)}</b></span>}
              {project.project_type && <span>🏷 <b>{project.project_type}</b></span>}
            </div>
          </div>
          <div className="wstats">
            <div className="stat"><div className="k">Value</div><div className="v">{money(headlineValue)}</div></div>
            <div className="stat"><div className="k">Paid</div><div className="v green">{money(paid)}</div></div>
            <div className="stat"><div className="k">Outstanding</div><div className="v amber">{money(outstanding)}</div></div>
          </div>
        </div>

        <div className="actbar">
          <button className="btn" onClick={() => navigate('/dashboard/finance/invoicing')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>New invoice</button>
          <button className="btn" onClick={() => navigate('/dashboard/finance/quotes')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></svg>New quote</button>
          <button className="btn" onClick={() => navigate('/dashboard/finance/contracts')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l5 5v13H6z" /></svg>New contract</button>
          <button className="btn" onClick={() => navigate('/dashboard/portfolio-design/deliver')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15V4m0 0 4 4m-4-4-4 4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></svg>Upload gallery</button>
          <button className="btn" onClick={() => navigate('/dashboard/clients/messages')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z" /></svg>Message</button>
          <button className="btn" onClick={() => { setEdit({ title: project.title || '', project_type: project.project_type || '', contact_id: project.contact_id || '', event_date: project.event_date || '', value: project.value ?? '', lead_source: project.lead_source || '', notes: project.notes || '' }); setShowEdit(true) }} style={{ marginLeft: 'auto' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4-1 10-10-3-3L5 16z" /></svg>Edit details</button>
        </div>

        <div className="tabs">
          {TABS.map(t => {
            const counts = { invoices: invoices.length, quotes: quotes.length, contracts: contracts.length, gallery: galleries.length, messages: threads.length, tasks: tasks.length, meetings: meetings.length, gear: checkouts.filter(c => !c.returned_at).length }
            const c = counts[t.id]
            return (
              <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
                {t.label}{c ? <span className="badge">{c}</span> : null}
              </button>
            )
          })}
        </div>

        {tab === 'overview' && (
          <div className="grid2">
            <div>
              <div className="panel">
                <h3>Money <a onClick={() => setTab('invoices')}>View invoices</a></h3>
                <div className="fin">
                  <div className="finbox"><div className="k">Quoted</div><div className="v">{money(quoted)}</div></div>
                  <div className="finbox"><div className="k">Invoiced</div><div className="v">{money(invoiced)}</div></div>
                  <div className="finbox"><div className="k">Paid</div><div className="v" style={{ color: '#38d16f' }}>{money(paid)}</div></div>
                  <div className="finbox"><div className="k">Outstanding</div><div className="v" style={{ color: '#f5a524' }}>{money(outstanding)}</div></div>
                </div>
                <div className="bar"><span style={{ width: collectedPct + '%' }} /></div>
                <div className="barlbl"><span>{collectedPct}% collected</span><span>{invoiced === 0 ? 'No invoices yet' : money(outstanding) + ' outstanding'}</span></div>
              </div>
              <div className="panel">
                <h3>Recent activity <a onClick={() => setTab('activity')}>See all</a></h3>
                {events.length === 0 ? <div className="empty">Nothing yet.</div> : (
                  <div className="timeline">
                    {events.slice(0, 4).map((e, i) => (
                      <div className="tev" key={i}><div className={'tdot ' + e.tone}>{ICONS[e.icon]}</div><div><div className="tbody">{e.text}</div><div className="ttime">{fromNow(e.t)}</div></div></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="panel">
                <h3>Participants <a onClick={() => setShowAddPart(v => !v)}>+ Add</a></h3>
                {client && (
                  <div className="person">
                    <div className="avatar" style={{ background: 'linear-gradient(140deg,#FF2D78,#c81d5c)' }}>{initials(client.name)}</div>
                    <div className="pmain">
                      <div className="pname">{client.name}<span className="prole">Client</span></div>
                      {(client.email || client.phone) && <div className="pcontact">{[client.email, client.phone].filter(Boolean).join('  ·  ')}</div>}
                    </div>
                  </div>
                )}
                {participants.map(pp => (
                  <div className="person" key={pp.id}>
                    <div className="avatar" style={{ background: 'linear-gradient(140deg,#4aa3ff,#2a5f9e)' }}>{initials(pp.name || pp.email)}</div>
                    <div className="pmain">
                      <div className="pname">{pp.name || 'Participant'}{pp.role && <span className="prole">{pp.role}</span>}</div>
                      {(pp.email || pp.phone) && <div className="pcontact">{[pp.email, pp.phone].filter(Boolean).join('  ·  ')}</div>}
                    </div>
                    <button className="premove" onClick={() => removeParticipant(pp.id)} title="Remove participant">×</button>
                  </div>
                ))}
                {!client && participants.length === 0 && !showAddPart && (
                  <div className="empty" style={{ padding: '10px 0' }}>No participants yet. Add the people on this project.</div>
                )}
                {showAddPart && (
                  <div className="addpart">
                    <input className="inp" autoFocus placeholder="Name" value={partForm.name} onChange={e => setPartForm(f => ({ ...f, name: e.target.value }))} />
                    <input className="inp" placeholder="Email" value={partForm.email} onChange={e => setPartForm(f => ({ ...f, email: e.target.value }))} />
                    <input className="inp" placeholder="Phone" value={partForm.phone} onChange={e => setPartForm(f => ({ ...f, phone: e.target.value }))} />
                    <input className="inp" placeholder="Role, e.g. Partner, Planner (optional)" value={partForm.role} onChange={e => setPartForm(f => ({ ...f, role: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addParticipant() }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn sm" style={{ flex: 1 }} onClick={() => { setShowAddPart(false); setPartForm({ name: '', email: '', phone: '', role: '' }) }}>Cancel</button>
                      <button className="btn primary sm" style={{ flex: 1 }} onClick={addParticipant}>Add participant</button>
                    </div>
                  </div>
                )}
                <div className="clientrow">
                  <button className="btn sm" style={{ flex: 1 }} onClick={() => navigate('/dashboard/clients/messages')}>Message</button>
                  <button className="btn sm" style={{ flex: 1 }} onClick={() => { if (client) { navigate('/dashboard/clients/crm') } else { setEdit({ title: project.title || '', project_type: project.project_type || '', contact_id: project.contact_id || '', event_date: project.event_date || '', value: project.value ?? '', lead_source: project.lead_source || '', notes: project.notes || '' }); setShowEdit(true) } }}>{client ? 'Open client' : 'Link client'}</button>
                </div>
              </div>
              <div className="panel">
                <h3>Next steps</h3>
                {openTasks.length === 0 ? <div className="empty" style={{ padding: '10px 0' }}>No open tasks. <a style={{ color: '#38d16f', cursor: 'pointer' }} onClick={() => setTab('tasks')}>Add one</a></div> : openTasks.slice(0, 4).map(t => (
                  <div className="task" key={t.id}>
                    <div className="check" onClick={() => toggleTask(t)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg></div>
                    <div className="tasktext">{t.title}</div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <h3>Details</h3>
                <div className="kv"><span className="k">Stage</span><span className="v">{stage ? stage.name : '—'}</span></div>
                <div className="kv"><span className="k">Type</span><span className="v">{project.project_type || '—'}</span></div>
                <div className="kv"><span className="k">Lead source</span><span className="v">{project.lead_source || '—'}</span></div>
                <div className="kv"><span className="k">Event date</span><span className="v">{prettyDate(project.event_date) || '—'}</span></div>
                <div className="kv"><span className="k">Created</span><span className="v">{prettyDate(project.created_at) || '—'}</span></div>
              </div>
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="panel">
            {events.length === 0 ? <div className="empty">No activity yet.</div> : (
              <div className="timeline">
                {events.map((e, i) => (
                  <div className="tev" key={i}><div className={'tdot ' + e.tone}>{ICONS[e.icon]}</div><div><div className="tbody">{e.text}</div><div className="ttime">{fromNow(e.t)}</div></div></div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'invoices' && (
          <div className="panel">
            <h3>Invoices <a onClick={() => navigate('/dashboard/finance/invoicing')}>+ New invoice</a></h3>
            {invoices.length === 0 ? <div className="empty">No invoices linked to this project yet.</div> : invoices.map(i => (
              <div className="drow" key={i.id}>
                <div className="dicon">{ICONS.inv}</div>
                <div className="dmain"><div className="dt">{i.notes || 'Invoice'}</div><div className="ds">{i.due_date ? 'Due ' + prettyDate(i.due_date) + ' · ' : ''}{money(i.amount)}</div></div>
                <span className={'status ' + statusClass(i.status)}>{i.status || 'Draft'}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'quotes' && (
          <div className="panel">
            <h3>Quotes <a onClick={() => navigate('/dashboard/finance/quotes')}>+ New quote</a></h3>
            {quotes.length === 0 ? <div className="empty">No quotes linked to this project yet.</div> : quotes.map(qq => (
              <div className="drow" key={qq.id}>
                <div className="dicon">{ICONS.quote}</div>
                <div className="dmain"><div className="dt">Quote</div><div className="ds">{qq.valid_until ? 'Valid until ' + prettyDate(qq.valid_until) + ' · ' : ''}{money(qq.amount)}</div></div>
                <span className={'status ' + statusClass(qq.status)}>{qq.status || 'Draft'}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'contracts' && (
          <div className="panel">
            <h3>Contracts <a onClick={() => navigate('/dashboard/finance/contracts')}>+ New contract</a></h3>
            {contracts.length === 0 ? <div className="empty">No contracts linked to this project yet.</div> : contracts.map(c => (
              <div className="drow" key={c.id}>
                <div className="dicon">{ICONS.contract}</div>
                <div className="dmain"><div className="dt">{c.title || 'Contract'}</div><div className="ds">{c.signed_at ? 'Signed ' + prettyDate(c.signed_at) : 'Created ' + prettyDate(c.created_at)}</div></div>
                <span className={'status ' + statusClass(c.status)}>{c.status || 'Draft'}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'gallery' && (
          <div className="panel">
            <h3>Gallery <a onClick={() => navigate('/dashboard/portfolio-design/deliver')}>+ Upload</a></h3>
            {galleries.length === 0 ? <div className="empty">No galleries delivered for this project yet.</div> : (
              <div className="gallery">
                {galleries.map(g => {
                  const count = Array.isArray(g.files) ? g.files.length : 0
                  return (
                    <div className="gcard" key={g.id} onClick={() => navigate('/dashboard/portfolio-design/deliver')}>
                      <div className="thumb">{ICONS.gallery}</div>
                      <div className="cap"><div className="t">{g.title || 'Delivery'}</div><div className="s">{count} file{count === 1 ? '' : 's'}{g.is_final ? ' · final' : ''}</div></div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div className="panel">
            <h3>Messages <a onClick={() => navigate('/dashboard/clients/messages')}>Open messages</a></h3>
            {threads.length === 0 ? <div className="empty">No conversations linked to this project yet.</div> : (
              <div className="thread">
                {threads.map(t => (
                  <div className="trow" key={t.id} onClick={() => navigate('/dashboard/clients/messages')}>
                    <div className="dicon">{ICONS.created}</div>
                    <div className="dmain"><div className="dt">{t.subject || t.client_name || 'Conversation'}</div><div className="ds">{t.last_message_at ? 'Last message ' + fromNow(t.last_message_at) : 'No messages yet'}</div></div>
                    {t.unread_count ? <span className="status sent">{t.unread_count} new</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="panel">
            <h3>Tasks</h3>
            {tasks.length === 0 ? <div className="empty" style={{ padding: '10px 0' }}>No tasks yet. Add your first below.</div> : tasks.map(t => (
              <div className={'task' + (t.done ? ' done' : '')} key={t.id}>
                <div className={'check' + (t.done ? ' on' : '')} onClick={() => toggleTask(t)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg></div>
                <div className="tasktext">{t.title}</div>
              </div>
            ))}
            <div className="addtask">
              <input placeholder="Add a task and press Enter…" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask() }} />
              <button className="btn primary" onClick={addTask}>Add</button>
            </div>
          </div>
        )}

        {tab === 'meetings' && (
          <div className="panel">
            <h3>Meetings <a onClick={openNewMeeting}>+ New meeting</a></h3>
            {showMeeting && (
              <div className="mform">
                <div className="field"><label className="lab">Title</label><input className="inp" autoFocus value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} placeholder="Pre-shoot call" /></div>
                <div className="mgrid">
                  <div className="field"><label className="lab">Date</label><input className="inp" type="date" value={meetingForm.meeting_date} onChange={e => setMeetingForm(f => ({ ...f, meeting_date: e.target.value }))} /></div>
                  <div className="field"><label className="lab">Location or video link</label><input className="inp" value={meetingForm.location} onChange={e => setMeetingForm(f => ({ ...f, location: e.target.value }))} placeholder="Zoom, phone, cafe…" /></div>
                </div>
                <div className="mgrid">
                  <div className="field"><label className="lab">Start</label><input className="inp" type="time" value={meetingForm.start_time} onChange={e => setMeetingForm(f => ({ ...f, start_time: e.target.value }))} /></div>
                  <div className="field"><label className="lab">End</label><input className="inp" type="time" value={meetingForm.end_time} onChange={e => setMeetingForm(f => ({ ...f, end_time: e.target.value }))} /></div>
                </div>
                <div className="mgrid">
                  <div className="field"><label className="lab">Client name</label><input className="inp" value={meetingForm.client_name} onChange={e => setMeetingForm(f => ({ ...f, client_name: e.target.value }))} /></div>
                  <div className="field"><label className="lab">Client email</label><input className="inp" value={meetingForm.client_email} onChange={e => setMeetingForm(f => ({ ...f, client_email: e.target.value }))} placeholder="Where the invite is sent" /></div>
                </div>
                <div className="field"><label className="lab">Details</label><textarea className="inp" style={{ minHeight: 70, resize: 'vertical' }} value={meetingForm.description} onChange={e => setMeetingForm(f => ({ ...f, description: e.target.value }))} placeholder="What the meeting is about…" /></div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn sm" onClick={() => setShowMeeting(false)}>Cancel</button>
                  <button className="btn primary sm" onClick={createMeeting}>Create meeting</button>
                </div>
              </div>
            )}
            {meetings.length === 0 && !showMeeting ? (
              <div className="empty">No meetings yet. Create one and send it to your client to accept, decline or propose a new time.</div>
            ) : meetings.map(m => {
              const st = MSTATUS[m.status] || MSTATUS.draft
              return (
                <div className="mrow" key={m.id}>
                  <div className="drow" style={{ borderBottom: 'none', padding: '2px 0' }}>
                    <div className="dicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></svg></div>
                    <div className="dmain">
                      <div className="dt">{m.title}</div>
                      <div className="ds">{meetingWhen(m.meeting_date, m.start_time, m.end_time)}{m.location ? ' · ' + m.location : ''}{m.client_name ? ' · ' + m.client_name : ''}</div>
                    </div>
                    <span className={'status ' + st.cls}>{st.label}</span>
                  </div>
                  {m.status === 'reschedule' && (
                    <div className="mnote">
                      <div><b>Client proposed:</b> {meetingWhen(m.client_proposed_date, m.client_proposed_time)}</div>
                      {m.client_message && <div style={{ marginTop: 5, color: 'var(--lt-muted)' }}>“{m.client_message}”</div>}
                    </div>
                  )}
                  {m.status === 'declined' && m.client_message && (
                    <div className="mnote" style={{ color: 'var(--lt-muted)' }}>“{m.client_message}”</div>
                  )}
                  <div className="mactions2">
                    {m.status === 'draft' && <button className="btn primary sm" onClick={() => sendMeeting(m)}>Send to client</button>}
                    {m.status === 'sent' && <><button className="btn sm" onClick={() => sendMeeting(m)}>Resend</button><button className="btn primary sm" onClick={() => confirmMeeting(m, false)}>Confirm</button></>}
                    {m.status === 'reschedule' && <><button className="btn primary sm" onClick={() => confirmMeeting(m, true)}>Accept their time</button><button className="btn sm" onClick={() => sendMeeting(m)}>Send new time</button></>}
                    {m.status === 'declined' && <button className="btn sm" onClick={() => sendMeeting(m)}>Propose another time</button>}
                    {m.status === 'accepted' && <span className="ds" style={{ color: '#38d16f' }}>✓ On your calendar</span>}
                    <button className="btn sm" onClick={() => deleteMeeting(m.id)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'gear' && (
          <div className="panel">
            <h3>Gear <a onClick={() => navigate('/dashboard/inventory')}>+ Check out gear</a></h3>
            {(() => {
              const open = checkouts.filter(c => !c.returned_at)
              const returned = checkouts.filter(c => c.returned_at)
              if (checkouts.length === 0) return <div className="empty">No gear checked out to this project yet. Head to Inventory to check items out, then check them back in here when the job wraps.</div>
              return (
                <>
                  {open.map(c => (
                    <div className="mrow" key={c.id}>
                      <div className="drow" style={{ borderBottom: 'none', padding: '2px 0' }}>
                        <div className="dicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" /></svg></div>
                        <div className="dmain">
                          <div className="dt">{c.item?.name || 'Item'} · {c.quantity}</div>
                          <div className="ds">Checked out {new Date(c.checked_out_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}{c.note ? ' · ' + c.note : ''}</div>
                        </div>
                        <button className="btn primary sm" onClick={() => checkInGear(c)}>Check in</button>
                      </div>
                    </div>
                  ))}
                  {returned.length > 0 && (
                    <div style={{ marginTop: open.length ? 14 : 0 }}>
                      <div className="ds" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11, marginBottom: 8 }}>Returned</div>
                      {returned.map(c => (
                        <div className="drow" key={c.id} style={{ opacity: 0.6 }}>
                          <div className="dicon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg></div>
                          <div className="dmain">
                            <div className="dt">{c.item?.name || 'Item'} · {c.quantity}</div>
                            <div className="ds">Returned {new Date(c.returned_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>

      {stageMenu && (
        <div className="pop" style={{ top: stageMenu.y, left: stageMenu.x }} onClick={e => e.stopPropagation()}>
          {stages.map(s => (
            <button key={s.id} onClick={() => { setStage(s.id); setStageMenu(null) }}>
              <span className="dot" style={{ background: s.color, width: 9, height: 9, borderRadius: '50%' }} />{s.name}
            </button>
          ))}
        </div>
      )}

      {showEdit && edit && (
        <div className="modal" onClick={() => setShowEdit(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">Edit project</div>
            <div className="field"><label className="lab">Title</label><input className="inp" value={edit.title} onChange={e => setEdit(x => ({ ...x, title: e.target.value }))} /></div>
            <div className="field"><label className="lab">Client</label>
              <select className="inp" value={edit.contact_id} onChange={e => setEdit(x => ({ ...x, contact_id: e.target.value }))}>
                <option value="">No client yet</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="mgrid">
              <div className="field"><label className="lab">Type</label><input className="inp" value={edit.project_type} onChange={e => setEdit(x => ({ ...x, project_type: e.target.value }))} /></div>
              <div className="field"><label className="lab">Lead source</label><input className="inp" value={edit.lead_source} onChange={e => setEdit(x => ({ ...x, lead_source: e.target.value }))} placeholder="Marketplace, Instagram…" /></div>
            </div>
            <div className="mgrid">
              <div className="field"><label className="lab">Event date</label><input className="inp" type="date" value={edit.event_date || ''} onChange={e => setEdit(x => ({ ...x, event_date: e.target.value }))} /></div>
              <div className="field"><label className="lab">Value (AUD)</label><input className="inp" type="number" min="0" step="0.01" value={edit.value} onChange={e => setEdit(x => ({ ...x, value: e.target.value }))} /></div>
            </div>
            <div className="field"><label className="lab">Notes</label><textarea className="inp" style={{ minHeight: 80, resize: 'vertical' }} value={edit.notes} onChange={e => setEdit(x => ({ ...x, notes: e.target.value }))} /></div>
            <div className="mactions">
              <button className="btn" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show">✓ {toast}</div>}
    </div>
  )
}
