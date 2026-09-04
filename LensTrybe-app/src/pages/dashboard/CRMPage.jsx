import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Canonical pipeline stages. Incoming values are normalised to these
// case-insensitively so a stray 'lead' (e.g. from a website enquiry) still lands
// in the right column.
const STAGES = ['Lead', 'In Discussion', 'Booked', 'Completed', 'Archived']
const STAGE_COLORS = { Lead: '#8b8f9a', 'In Discussion': '#4aa3ff', Booked: '#1DB954', Completed: '#9b6bff', Archived: '#6b7280' }
const STAGE_ALIAS = { lead: 'Lead', 'new': 'Lead', enquiry: 'Lead', 'new enquiry': 'Lead', 'website enquiry': 'Lead', contacted: 'In Discussion', 'in discussion': 'In Discussion', quoted: 'In Discussion', booked: 'Booked', completed: 'Completed', complete: 'Completed', archived: 'Archived' }

function normStage(s) {
  if (!s) return 'Lead'
  const k = String(s).trim().toLowerCase()
  if (STAGE_ALIAS[k]) return STAGE_ALIAS[k]
  const hit = STAGES.find((st) => st.toLowerCase() === k)
  return hit || 'Lead'
}

function money(v) {
  if (v == null || v === '') return '$0'
  const n = Number(v)
  if (Number.isNaN(n)) return '$0'
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function prettyDate(d) {
  if (!d) return null
  const dt = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

function avatarColor(name) {
  const palette = ['#1DB954', '#4aa3ff', '#FF2D78', '#f5a524', '#9b6bff', '#38d16f']
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % palette.length
  return palette[h]
}

const CSS = `
.ltcrm{padding:28px 32px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text);max-width:1400px;margin:0 auto}
.ltcrm *{box-sizing:border-box}
.ltcrm .head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.ltcrm .title{font-size:26px;font-weight:800;letter-spacing:-0.02em;margin:0}
.ltcrm .sub{font-size:13.5px;color:var(--lt-muted);margin-top:3px}
.ltcrm .btn{font-family:inherit;font-size:13px;font-weight:700;border-radius:10px;padding:10px 16px;cursor:pointer;border:1px solid transparent;transition:.15s;display:inline-flex;align-items:center;gap:7px}
.ltcrm .btn.primary{background:#1DB954;color:#04120a;border-color:#1DB954}
.ltcrm .btn.primary:hover{filter:brightness(1.06)}
.ltcrm .btn.ghost{background:var(--lt-surface);color:var(--lt-text);border-color:var(--lt-border)}
.ltcrm .btn.ghost:hover{background:var(--lt-surface-2)}
.ltcrm .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.ltcrm .stat{background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur);border-radius:15px;padding:15px 17px}
.ltcrm .stat .n{font-size:24px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.ltcrm .stat .l{font-size:11.5px;font-weight:600;color:var(--lt-faint);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
.ltcrm .toolbar{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
.ltcrm .search{flex:1;min-width:200px;background:var(--lt-input-bg);border:1px solid var(--lt-input-border);border-radius:10px;padding:10px 14px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none}
.ltcrm .search:focus{border-color:#1DB954}
.ltcrm .seg{display:inline-flex;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:10px;padding:3px}
.ltcrm .seg button{font-family:inherit;font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:7px;border:none;background:none;color:var(--lt-muted);cursor:pointer}
.ltcrm .seg button.on{background:#1DB954;color:#04120a}
.ltcrm .filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px}
.ltcrm .fchip{font-size:12px;font-weight:600;padding:5px 12px;border-radius:99px;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-muted);cursor:pointer;transition:.12s}
.ltcrm .fchip.on{background:var(--lt-surface-2);color:var(--lt-text);border-color:#1DB954}
.ltcrm .list{border-radius:16px;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.ltcrm .lrow{display:grid;grid-template-columns:2.4fr 2fr 1.4fr 1fr 40px;gap:12px;padding:14px 18px;border-bottom:1px solid var(--lt-hairline);align-items:center;cursor:pointer;transition:.12s}
.ltcrm .lrow:last-child{border-bottom:none}
.ltcrm .lrow:hover{background:var(--lt-surface)}
.ltcrm .lrow.head{cursor:default;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint);background:var(--lt-surface)}
.ltcrm .lrow.head:hover{background:var(--lt-surface)}
.ltcrm .who{display:flex;align-items:center;gap:11px;min-width:0}
.ltcrm .avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex:0 0 auto}
.ltcrm .nm{font-size:14px;font-weight:700;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltcrm .sm{font-size:12px;color:var(--lt-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltcrm .pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:4px 11px;border-radius:99px;white-space:nowrap}
.ltcrm .dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
.ltcrm .iconbtn{width:30px;height:30px;border-radius:8px;border:none;background:none;color:var(--lt-faint);cursor:pointer;display:flex;align-items:center;justify-content:center}
.ltcrm .iconbtn:hover{background:var(--lt-surface-2);color:#f0516d}
.ltcrm .pipeline{display:flex;gap:14px;overflow-x:auto;padding-bottom:12px}
.ltcrm .col{flex:0 0 260px;width:260px}
.ltcrm .colhead{display:flex;align-items:center;gap:8px;margin-bottom:11px;padding:0 3px}
.ltcrm .colhead .cn{font-size:13px;font-weight:700}
.ltcrm .colhead .cc{font-size:11px;color:var(--lt-faint);font-weight:600;background:var(--lt-surface);border-radius:99px;padding:1px 8px}
.ltcrm .pcard{background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur);border-radius:13px;padding:13px;margin-bottom:9px;cursor:pointer;transition:.15s}
.ltcrm .pcard:hover{transform:translateY(-1px)}
.ltcrm .pcard .pn{font-size:13.5px;font-weight:700;margin-bottom:3px}
.ltcrm .pcard .pm{font-size:11.5px;color:var(--lt-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltcrm .empty{padding:70px 20px;text-align:center;color:var(--lt-muted);font-size:14px}
/* modal + drawer */
.ltcrm .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px}
.ltcrm .modalbox{background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur);border-radius:18px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:26px}
.ltcrm .drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);background:var(--lt-modal-bg);border-left:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur);z-index:1101;overflow-y:auto;padding:24px 24px 60px}
.ltcrm .mtitle{font-size:17px;font-weight:800;letter-spacing:-0.02em;margin-bottom:18px}
.ltcrm .field{margin-bottom:13px}
.ltcrm .lab{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-faint);display:block;margin-bottom:6px}
.ltcrm .inp{width:100%;background:var(--lt-surface);border:1px solid var(--lt-input-border);border-radius:10px;padding:10px 12px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none}
.ltcrm .inp:focus{border-color:#1DB954}
.ltcrm textarea.inp{min-height:74px;resize:vertical}
.ltcrm select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.ltcrm .grid2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.ltcrm .mactions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
.ltcrm .dhead{display:flex;align-items:center;gap:13px;margin-bottom:16px}
.ltcrm .dhead .av{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;flex:0 0 auto}
.ltcrm .dhead .dn{font-size:19px;font-weight:800;letter-spacing:-0.02em}
.ltcrm .dhead .dc{font-size:13px;color:var(--lt-muted)}
.ltcrm .dclose{margin-left:auto;width:34px;height:34px;border-radius:9px;border:none;background:var(--lt-surface);color:var(--lt-muted);font-size:17px;cursor:pointer}
.ltcrm .qa{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.ltcrm .drow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
.ltcrm .dstat{background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:12px;padding:12px 13px}
.ltcrm .dstat .n{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.ltcrm .dstat .l{font-size:10.5px;font-weight:600;color:var(--lt-faint);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
.ltcrm .sect{background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:14px;padding:15px 16px;margin-bottom:13px}
.ltcrm .sect h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint);margin:0 0 11px;display:flex;align-items:center;justify-content:space-between}
.ltcrm .item{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--lt-hairline)}
.ltcrm .item:first-of-type{border-top:none}
.ltcrm .item .g{flex:1;min-width:0}
.ltcrm .item .t{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltcrm .item .s{font-size:11.5px;color:var(--lt-muted)}
.ltcrm .item .v{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.ltcrm .item.click{cursor:pointer}
.ltcrm .item.click:hover .t{color:#1DB954}
.ltcrm .tinypill{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.ltcrm .tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.ltcrm .tag{font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:7px;background:var(--lt-surface-2);color:var(--lt-muted)}
.ltcrm .muted{color:var(--lt-muted);font-size:12.5px}
.ltcrm .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300}
.ltcrm .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ltcrm .toast.err{border-color:rgba(240,81,109,0.5)}
.ltcrm .spin{padding:30px;text-align:center;color:var(--lt-faint);font-size:13px}
@media (max-width:767px){
  .ltcrm{padding:16px}
  .ltcrm .stats{grid-template-columns:1fr 1fr}
  .ltcrm .lrow{grid-template-columns:1.6fr 40px}
  .ltcrm .lrow .hide-m{display:none}
  .ltcrm .drow{grid-template-columns:1fr}
  .ltcrm .grid2{grid-template-columns:1fr}
  .ltcrm .drawer{width:100vw}
}
`

const EMPTY_FORM = { name: '', email: '', phone: '', company: '', status: 'Lead', notes: '' }

export default function CRMPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => { if (user) loadContacts() }, [user])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  async function loadContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('creative_id', user.id)
      .order('last_contacted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    setContacts((data ?? []).map((c) => ({ ...c, _stage: normStage(c.status) })))
    setLoading(false)
  }

  async function createContact() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      creative_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      status: normStage(form.status),
      notes: form.notes.trim() || null,
      last_contacted_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crm_contacts').insert(payload)
    setSaving(false)
    if (error) { showToast(error.message, 'error'); return }
    setShowCreate(false)
    setForm(EMPTY_FORM)
    showToast('Client added')
    loadContacts()
  }

  async function updateContact(id, updates) {
    if (updates.status) updates.status = normStage(updates.status)
    const { error } = await supabase.from('crm_contacts').update(updates).eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates, _stage: normStage(updates.status || c.status) } : c)))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev))
    showToast('Saved')
  }

  async function deleteContact(id) {
    if (!window.confirm('Delete this client? This does not delete their invoices, messages or projects.')) return
    await supabase.from('crm_contacts').delete().eq('id', id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
    if (selected?.id === id) closeDetail()
    showToast('Client deleted')
  }

  async function openContact(c) {
    setSelected(c)
    setDetail(null)
    setDetailLoading(true)
    const email = (c.email || '').trim()
    const byEmail = (q) => (email ? q.ilike('client_email', email) : q.eq('id', '00000000-0000-0000-0000-000000000000'))
    const [proj, quo, inv, bk, thr, rev, portal] = await Promise.all([
      supabase.from('projects').select('id,title,stage,value,event_date').eq('creative_id', user.id).eq('contact_id', c.id),
      byEmail(supabase.from('quotes').select('id,amount,status,created_at').eq('creative_id', user.id)),
      byEmail(supabase.from('invoices').select('id,amount,status,due_date,created_at').eq('creative_id', user.id)),
      byEmail(supabase.from('bookings').select('id,service,booking_date,status').eq('creative_id', user.id)),
      byEmail(supabase.from('message_threads').select('id,subject,last_message_at,unread_count').eq('creative_id', user.id)),
      email ? supabase.from('reviews').select('id,rating,body,comment,created_at').eq('creative_id', user.id).ilike('reviewer_email', email) : Promise.resolve({ data: [] }),
      email ? supabase.from('client_portals').select('portal_token').eq('creative_id', user.id).ilike('client_email', email).maybeSingle() : Promise.resolve({ data: null }),
    ])
    const invoices = inv.data ?? []
    const paid = invoices.filter((i) => String(i.status).toLowerCase() === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    const outstanding = invoices.filter((i) => ['sent', 'overdue', 'unpaid', 'pending'].includes(String(i.status).toLowerCase())).reduce((s, i) => s + Number(i.amount || 0), 0)
    setDetail({
      projects: proj.data ?? [],
      quotes: quo.data ?? [],
      invoices,
      bookings: bk.data ?? [],
      threads: thr.data ?? [],
      reviews: rev.data ?? [],
      portalToken: portal.data?.portal_token || null,
      paid,
      outstanding,
    })
    setDetailLoading(false)
    // Freshen last_contacted_at so the list ordering reflects recent activity — light touch.
  }

  function closeDetail() { setSelected(null); setDetail(null) }

  const q = search.trim().toLowerCase()
  const filtered = contacts.filter((c) => {
    if (statusFilter !== 'All' && c._stage !== statusFilter) return false
    if (!q) return true
    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q)
  })

  const now = Date.now()
  const weekAgo = now - 7 * 24 * 3600 * 1000
  const stats = {
    total: contacts.length,
    leads: contacts.filter((c) => c._stage === 'Lead').length,
    booked: contacts.filter((c) => c._stage === 'Booked').length,
    newWeek: contacts.filter((c) => new Date(c.created_at).getTime() >= weekAgo).length,
  }

  function StagePill({ stage }) {
    const col = STAGE_COLORS[stage] || '#8b8f9a'
    return <span className="pill" style={{ background: col + '22', color: col }}><span className="dot" style={{ background: col }} />{stage}</span>
  }

  return (
    <div className="ltcrm">
      <style>{CSS}</style>

      <div className="head">
        <div>
          <h1 className="title">Clients</h1>
          <div className="sub">Every lead and client in one place, linked to their projects, messages and money.</div>
        </div>
        <button className="btn primary" onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }}>+ Add client</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="n">{stats.total}</div><div className="l">Total clients</div></div>
        <div className="stat"><div className="n" style={{ color: '#8b8f9a' }}>{stats.leads}</div><div className="l">Open leads</div></div>
        <div className="stat"><div className="n" style={{ color: '#1DB954' }}>{stats.booked}</div><div className="l">Booked</div></div>
        <div className="stat"><div className="n">{stats.newWeek}</div><div className="l">New this week</div></div>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search by name, email or company..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="seg">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
          <button className={view === 'pipeline' ? 'on' : ''} onClick={() => setView('pipeline')}>Pipeline</button>
        </div>
      </div>

      {view === 'list' && (
        <div className="filters">
          <span className={`fchip ${statusFilter === 'All' ? 'on' : ''}`} onClick={() => setStatusFilter('All')}>All</span>
          {STAGES.map((st) => <span key={st} className={`fchip ${statusFilter === st ? 'on' : ''}`} onClick={() => setStatusFilter(st)}>{st}</span>)}
        </div>
      )}

      {loading ? (
        <div className="spin">Loading clients...</div>
      ) : view === 'list' ? (
        filtered.length === 0 ? (
          <div className="list"><div className="empty">{contacts.length === 0 ? 'No clients yet. Add your first client, or they will appear here automatically when someone enquires.' : 'No clients match your search.'}</div></div>
        ) : (
          <div className="list">
            <div className="lrow head">
              <div>Client</div>
              <div className="hide-m">Email</div>
              <div className="hide-m">Company</div>
              <div className="hide-m">Stage</div>
              <div></div>
            </div>
            {filtered.map((c) => (
              <div className="lrow" key={c.id} onClick={() => openContact(c)}>
                <div className="who">
                  <div className="avatar" style={{ background: avatarColor(c.name) }}>{initials(c.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{c.name}</div>
                    {c.phone && <div className="sm">{c.phone}</div>}
                  </div>
                </div>
                <div className="sm hide-m">{c.email || '—'}</div>
                <div className="sm hide-m">{c.company || '—'}</div>
                <div className="hide-m"><StagePill stage={c._stage} /></div>
                <div onClick={(e) => e.stopPropagation()}>
                  <button className="iconbtn" title="Delete" onClick={() => deleteContact(c.id)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="pipeline">
          {STAGES.map((stage) => {
            const items = filtered.filter((c) => c._stage === stage)
            const col = STAGE_COLORS[stage]
            return (
              <div className="col" key={stage}>
                <div className="colhead"><span className="dot" style={{ background: col }} /><span className="cn">{stage}</span><span className="cc">{items.length}</span></div>
                {items.map((c) => (
                  <div className="pcard" key={c.id} onClick={() => openContact(c)}>
                    <div className="pn">{c.name}</div>
                    {c.company && <div className="pm">{c.company}</div>}
                    {c.email && <div className="pm">{c.email}</div>}
                    <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                      <select className="inp" style={{ padding: '7px 9px', fontSize: 12 }} value={c._stage} onChange={(e) => updateContact(c.id, { status: e.target.value })}>
                        {STAGES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="muted" style={{ padding: '8px 3px' }}>Nothing here</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="modalbox">
            <div className="mtitle">Add client</div>
            <div className="grid2">
              <div className="field"><label className="lab">Name *</label><input className="inp" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" /></div>
              <div className="field"><label className="lab">Email</label><input className="inp" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" /></div>
            </div>
            <div className="grid2">
              <div className="field"><label className="lab">Phone</label><input className="inp" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="0400 000 000" /></div>
              <div className="field"><label className="lab">Company</label><input className="inp" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} placeholder="Smith Co." /></div>
            </div>
            <div className="field"><label className="lab">Stage</label>
              <select className="inp" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>{STAGES.map((st) => <option key={st} value={st}>{st}</option>)}</select>
            </div>
            <div className="field"><label className="lab">Notes</label><textarea className="inp" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any notes..." /></div>
            <div className="mactions">
              <button className="btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn primary" disabled={saving || !form.name.trim()} style={{ opacity: !form.name.trim() ? 0.5 : 1 }} onClick={createContact}>{saving ? 'Saving...' : 'Add client'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 360 client record */}
      {selected && (
        <>
          <div className="modal" style={{ background: 'rgba(6,5,12,0.5)' }} onClick={closeDetail} />
          <div className="drawer">
            <div className="dhead">
              <div className="av" style={{ background: avatarColor(selected.name) }}>{initials(selected.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="dn">{selected.name}</div>
                <div className="dc">{selected.company || selected.email || '—'}</div>
              </div>
              <button className="dclose" onClick={closeDetail}>&#10005;</button>
            </div>

            <div className="qa">
              <button className="btn ghost" onClick={() => navigate('/dashboard/clients/messages')}>Message</button>
              {detail?.portalToken && <button className="btn ghost" onClick={() => window.open(`/portal/${detail.portalToken}`, '_blank')}>Open portal</button>}
              <select className="inp" style={{ width: 'auto', padding: '8px 30px 8px 12px' }} value={selected._stage} onChange={(e) => updateContact(selected.id, { status: e.target.value })}>
                {STAGES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>

            {detailLoading ? <div className="spin">Loading history...</div> : detail && (
              <>
                <div className="drow">
                  <div className="dstat"><div className="n" style={{ color: '#1DB954' }}>{money(detail.paid)}</div><div className="l">Lifetime paid</div></div>
                  <div className="dstat"><div className="n" style={{ color: detail.outstanding > 0 ? '#f5a524' : 'var(--lt-text)' }}>{money(detail.outstanding)}</div><div className="l">Outstanding</div></div>
                  <div className="dstat"><div className="n">{detail.projects.length}</div><div className="l">Projects</div></div>
                </div>

                {/* Details */}
                <div className="sect">
                  <h4>Details</h4>
                  <div className="grid2">
                    <div className="field"><label className="lab">Name</label><input className="inp" defaultValue={selected.name || ''} onBlur={(e) => updateContact(selected.id, { name: e.target.value })} /></div>
                    <div className="field"><label className="lab">Email</label><input className="inp" defaultValue={selected.email || ''} onBlur={(e) => updateContact(selected.id, { email: e.target.value || null })} /></div>
                  </div>
                  <div className="grid2">
                    <div className="field"><label className="lab">Phone</label><input className="inp" defaultValue={selected.phone || ''} onBlur={(e) => updateContact(selected.id, { phone: e.target.value || null })} /></div>
                    <div className="field"><label className="lab">Company</label><input className="inp" defaultValue={selected.company || ''} onBlur={(e) => updateContact(selected.id, { company: e.target.value || null })} /></div>
                  </div>
                  <div className="grid2">
                    <div className="field"><label className="lab">Instagram</label><input className="inp" defaultValue={selected.instagram || ''} onBlur={(e) => updateContact(selected.id, { instagram: e.target.value || null })} placeholder="@handle" /></div>
                    <div className="field"><label className="lab">Website</label><input className="inp" defaultValue={selected.website || ''} onBlur={(e) => updateContact(selected.id, { website: e.target.value || null })} /></div>
                  </div>
                  <div className="field"><label className="lab">Tags (comma separated)</label><input className="inp" defaultValue={(selected.tags || []).join(', ')} onBlur={(e) => updateContact(selected.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="wedding, referral" /></div>
                  <div className="field" style={{ marginBottom: 0 }}><label className="lab">Notes</label><textarea className="inp" defaultValue={selected.notes || ''} onBlur={(e) => updateContact(selected.id, { notes: e.target.value || null })} placeholder="Anything worth remembering..." /></div>
                </div>

                {/* Projects */}
                <div className="sect">
                  <h4>Projects</h4>
                  {detail.projects.length === 0 ? <div className="muted">No projects yet.</div> : detail.projects.map((p) => (
                    <div className="item click" key={p.id} onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                      <div className="g"><div className="t">{p.title || 'Untitled project'}</div><div className="s">{p.stage || '—'}{p.event_date ? ' · ' + prettyDate(p.event_date) : ''}</div></div>
                      {p.value != null && p.value !== '' && <div className="v">{money(p.value)}</div>}
                    </div>
                  ))}
                </div>

                {/* Money */}
                <div className="sect">
                  <h4>Quotes &amp; invoices</h4>
                  {detail.quotes.length === 0 && detail.invoices.length === 0 ? <div className="muted">Nothing yet.</div> : (
                    <>
                      {detail.quotes.map((x) => (
                        <div className="item click" key={'q' + x.id} onClick={() => navigate('/dashboard/finance/quotes')}>
                          <div className="g"><div className="t">Quote {money(x.amount)}</div><div className="s">{prettyDate(x.created_at)}</div></div>
                          <span className="tinypill" style={{ background: 'var(--lt-surface-2)', color: 'var(--lt-muted)' }}>{x.status}</span>
                        </div>
                      ))}
                      {detail.invoices.map((x) => {
                        const paid = String(x.status).toLowerCase() === 'paid'
                        return (
                          <div className="item click" key={'i' + x.id} onClick={() => navigate('/dashboard/finance/invoicing')}>
                            <div className="g"><div className="t">Invoice {money(x.amount)}</div><div className="s">{prettyDate(x.created_at)}</div></div>
                            <span className="tinypill" style={{ background: paid ? 'rgba(29,185,84,0.16)' : 'rgba(245,165,36,0.16)', color: paid ? '#1DB954' : '#f5a524' }}>{x.status}</span>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>

                {/* Bookings */}
                {detail.bookings.length > 0 && (
                  <div className="sect">
                    <h4>Bookings</h4>
                    {detail.bookings.map((b) => (
                      <div className="item" key={b.id}>
                        <div className="g"><div className="t">{b.service || 'Booking'}</div><div className="s">{b.booking_date ? prettyDate(b.booking_date) : 'No date set'}</div></div>
                        <span className="tinypill" style={{ background: 'var(--lt-surface-2)', color: 'var(--lt-muted)' }}>{b.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Messages */}
                {detail.threads.length > 0 && (
                  <div className="sect">
                    <h4>Messages</h4>
                    {detail.threads.map((t) => (
                      <div className="item click" key={t.id} onClick={() => navigate('/dashboard/clients/messages')}>
                        <div className="g"><div className="t">{t.subject || 'Conversation'}</div><div className="s">{t.last_message_at ? prettyDate(t.last_message_at) : ''}</div></div>
                        {t.unread_count > 0 && <span className="tinypill" style={{ background: 'rgba(255,45,120,0.18)', color: '#FF2D78' }}>{t.unread_count} new</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reviews */}
                {detail.reviews.length > 0 && (
                  <div className="sect">
                    <h4>Reviews</h4>
                    {detail.reviews.map((r) => (
                      <div className="item" key={r.id} style={{ alignItems: 'flex-start' }}>
                        <div className="g"><div className="t" style={{ color: '#1DB954' }}>{'★'.repeat(Math.max(0, Math.min(5, r.rating || 0)))}<span style={{ color: 'var(--lt-faint)' }}>{'★'.repeat(5 - Math.max(0, Math.min(5, r.rating || 0)))}</span></div>{(r.body || r.comment) && <div className="s" style={{ whiteSpace: 'normal', marginTop: 3 }}>{r.body || r.comment}</div>}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mactions" style={{ justifyContent: 'space-between' }}>
                  <button className="btn ghost" style={{ color: '#f0516d', borderColor: 'rgba(240,81,109,0.35)' }} onClick={() => deleteContact(selected.id)}>Delete client</button>
                  <button className="btn ghost" onClick={closeDetail}>Close</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {toast && <div className={`toast show ${toast.type === 'error' ? 'err' : ''}`}>{toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}</div>}
    </div>
  )
}
