import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

// Inventory hub. Creatives log their gear into folders they name themselves
// (shown as tabs), see it as a photo gallery or a list, track total value for
// insurance, and check items out to a project (quantity out, checked back in
// here or from the project workspace).

function money(v) {
  const n = Number(v) || 0
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function prettyDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
}

const CSS = `
.lti{position:relative;min-height:60vh;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.lti *{box-sizing:border-box}
.lti .inner{max-width:1240px;margin:0 auto;position:relative;z-index:1}
.lti .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.lti h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0}
.lti .sub{color:var(--lt-muted);font-size:13.5px;margin-top:4px;max-width:600px}
.lti .hactions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.lti .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}
.lti .btn:hover{background:var(--lt-surface-2)}
.lti .btn svg{width:15px;height:15px}
.lti .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700;box-shadow:0 6px 18px -8px rgba(29,185,84,0.7)}
.lti .btn.primary:hover{background:#22c95f}
.lti .btn.sm{padding:6px 11px;font-size:12px}
.lti .btn.ghost{background:transparent;border-color:transparent;color:var(--lt-muted)}
.lti .btn.ghost:hover{color:var(--lt-text);background:var(--lt-surface)}
.lti .btn.danger{color:#f0516d}
.lti .btn:disabled{opacity:.5;cursor:default}
.lti .valuebox{display:flex;align-items:center;gap:14px;padding:11px 16px;border-radius:14px;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.lti .valuebox .vl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-muted)}
.lti .valuebox .vv{font-size:20px;font-weight:800;letter-spacing:-0.02em}
.lti .tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:16px;padding-bottom:4px;scrollbar-width:none;align-items:center}
.lti .tabs::-webkit-scrollbar{display:none}
.lti .tab{display:inline-flex;align-items:center;gap:8px;font-family:inherit;font-size:13px;font-weight:600;color:var(--lt-muted);padding:8px 14px;border-radius:11px;white-space:nowrap;border:1px solid transparent;transition:.15s;cursor:pointer;background:transparent}
.lti .tab:hover{color:var(--lt-text);background:var(--lt-surface)}
.lti .tab.on{color:var(--lt-text);background:var(--lt-surface);border-color:var(--lt-border)}
.lti .tab .ct{font-size:11px;color:var(--lt-faint);font-weight:700}
.lti .tab .edit{opacity:.6;display:inline-flex}
.lti .tab .edit:hover{opacity:1;color:#1DB954}
.lti .tab.add{color:var(--lt-faint);border:1px dashed var(--lt-border)}
.lti .tab.add:hover{color:#1DB954;border-color:#1DB954}
.lti .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.lti .search{flex:1;min-width:200px;display:flex;align-items:center;gap:9px;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:9px 13px;color:var(--lt-muted)}
.lti .search input{flex:1;background:none;border:none;outline:none;color:var(--lt-text);font-family:inherit;font-size:13.5px}
.lti .search input::placeholder{color:var(--lt-faint)}
.lti .segment{display:flex;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:3px}
.lti .segment button{font-family:inherit;font-size:12.5px;font-weight:600;border:none;background:none;color:var(--lt-muted);padding:6px 12px;border-radius:8px;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px}
.lti .segment button.on{background:var(--lt-border);color:var(--lt-text)}
.lti .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.lti .icard{border-radius:15px;overflow:hidden;cursor:pointer;transition:.15s;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.lti .icard:hover{transform:translateY(-2px)}
.lti .photo{position:relative;aspect-ratio:4/3;background:var(--lt-surface-2);display:flex;align-items:center;justify-content:center;overflow:hidden}
.lti .photo img{width:100%;height:100%;object-fit:cover}
.lti .photo .ph{color:var(--lt-faint);opacity:.5}
.lti .photo .ph svg{width:38px;height:38px}
.lti .badge{position:absolute;top:10px;left:10px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;letter-spacing:0.02em}
.lti .ibody{padding:13px 14px}
.lti .isku{font-size:11px;color:var(--lt-faint);font-weight:600;margin-bottom:2px}
.lti .iname{font-size:13.5px;font-weight:700;letter-spacing:-0.01em;margin-bottom:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lti .irow{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--lt-muted)}
.lti .irow .q{font-weight:700;color:var(--lt-text);font-variant-numeric:tabular-nums}
.lti .iacts{display:flex;gap:6px;padding:0 14px 13px}
.lti .list{border-radius:15px;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur)}
.lti .lrow{display:grid;grid-template-columns:46px 2fr 1fr 1fr 1fr 120px;gap:12px;padding:11px 16px;border-bottom:1px solid var(--lt-hairline);align-items:center}
.lti .lrow:last-child{border-bottom:none}
.lti .lrow.head{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint);background:var(--lt-surface)}
.lti .lthumb{width:38px;height:38px;border-radius:8px;object-fit:cover;background:var(--lt-surface-2);display:flex;align-items:center;justify-content:center;color:var(--lt-faint)}
.lti .pill{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px}
.lti .pill .dot{width:7px;height:7px;border-radius:50%}
.lti .tnum{font-variant-numeric:tabular-nums}
.lti .muted{color:var(--lt-muted)}
.lti .faint{color:var(--lt-faint)}
.lti .empty{padding:56px 20px;text-align:center;color:var(--lt-muted);font-size:14px}
.lti .empty .big{font-size:16px;font-weight:700;color:var(--lt-text);margin-bottom:6px}
.lti .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto}
.lti .modalbox{width:100%;max-width:560px;border-radius:20px;padding:24px;background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.lti .modalbox.sm{max-width:420px}
.lti .mtitle{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px}
.lti .msub{font-size:12.5px;color:var(--lt-muted);margin-bottom:18px}
.lti .field{margin-bottom:14px}
.lti .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.lti .inp{width:100%;background:var(--lt-input-bg);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none;transition:.15s}
.lti .inp:focus{border-color:#1DB954}
.lti select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.lti .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lti .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.lti .mactions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
.lti .uploader{aspect-ratio:16/9;border-radius:12px;border:1px dashed var(--lt-border);background:var(--lt-surface);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;color:var(--lt-faint);position:relative}
.lti .uploader:hover{border-color:#1DB954;color:#1DB954}
.lti .uploader img{width:100%;height:100%;object-fit:cover}
.lti .uploader .cam{display:flex;flex-direction:column;align-items:center;gap:7px;font-size:12.5px;font-weight:600}
.lti .uploader .cam svg{width:26px;height:26px}
.lti .cohist{margin-top:6px;border-top:1px solid var(--lt-hairline);padding-top:14px}
.lti .cohist .co{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--lt-hairline)}
.lti .cohist .co:last-child{border-bottom:none}
.lti .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300;display:flex;align-items:center;gap:9px}
.lti .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.lti .toast.err{border-color:rgba(240,81,109,0.5)}
@media (max-width:1000px){.lti .grid{grid-template-columns:repeat(3,1fr)}}
@media (max-width:760px){.lti .grid{grid-template-columns:repeat(2,1fr)}.lti .g2,.lti .g3{grid-template-columns:1fr}.lti .lrow{grid-template-columns:40px 1.6fr 1fr}.lti .lrow .hide-m{display:none}}
`

const BLANK = { name: '', folder_id: '', sku: '', quantity: 1, unit_value: '', reorder_level: 0, notes: '' }

export default function InventoryPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [folders, setFolders] = useState([])
  const [items, setItems] = useState([])
  const [checkouts, setCheckouts] = useState([])
  const [projects, setProjects] = useState([])
  const [active, setActive] = useState('all')
  const [view, setView] = useState('gallery')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  const [showItem, setShowItem] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  const [checkout, setCheckout] = useState(null) // item being checked out
  const [coForm, setCoForm] = useState({ project_id: '', quantity: 1, note: '' })
  const [folderModal, setFolderModal] = useState(null) // { mode:'new'|'edit', id, name }
  const fileRef = useRef(null)

  useEffect(() => { if (user) load() }, [user])
  function flash(msg, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 2400) }

  async function load() {
    setLoading(true)
    const [fl, it, co, pj] = await Promise.all([
      supabase.from('inventory_folders').select('*').eq('creative_id', user.id).order('position', { ascending: true }),
      supabase.from('inventory_items').select('*').eq('creative_id', user.id).order('created_at', { ascending: false }),
      supabase.from('inventory_checkouts').select('*, project:projects(title)').eq('creative_id', user.id).is('returned_at', null),
      supabase.from('projects').select('id, title').eq('creative_id', user.id).order('created_at', { ascending: false }),
    ])
    setFolders(fl.data || [])
    setItems(it.data || [])
    setCheckouts(co.data || [])
    setProjects(pj.data || [])
    setLoading(false)
  }

  function photoUrl(path) {
    if (!path) return null
    return supabase.storage.from('inventory').getPublicUrl(path).data.publicUrl
  }

  const outByItem = useMemo(() => {
    const m = {}
    checkouts.forEach(c => { m[c.item_id] = (m[c.item_id] || 0) + (Number(c.quantity) || 0) })
    return m
  }, [checkouts])

  function availableOf(it) { return (Number(it.quantity) || 0) - (outByItem[it.id] || 0) }
  function statusOf(it) {
    const a = availableOf(it)
    if (a <= 0) return { key: 'out', label: 'Out of stock', color: '#8b8f9a' }
    if (it.reorder_level > 0 && a <= it.reorder_level) return { key: 'low', label: 'Low stock', color: '#f5a524' }
    return { key: 'in', label: 'In stock', color: '#1DB954' }
  }

  const totalValue = useMemo(() => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_value) || 0), 0), [items])
  const totalQty = useMemo(() => items.reduce((s, it) => s + (Number(it.quantity) || 0), 0), [items])

  const folderCounts = useMemo(() => {
    const m = { all: items.length, uncat: 0 }
    items.forEach(it => { const k = it.folder_id || 'uncat'; m[k] = (m[k] || 0) + 1; if (!it.folder_id) m.uncat++ })
    return m
  }, [items])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(it => {
      if (active === 'uncat' && it.folder_id) return false
      if (active !== 'all' && active !== 'uncat' && it.folder_id !== active) return false
      if (q && !((it.name || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q) || (it.notes || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [items, active, search])

  // ── Items ──
  function openNew() {
    setEditing(null)
    setForm({ ...BLANK, folder_id: (active !== 'all' && active !== 'uncat') ? active : '' })
    setFile(null); setPreview(null); setShowItem(true)
  }
  function openEdit(it) {
    setEditing(it)
    setForm({ name: it.name || '', folder_id: it.folder_id || '', sku: it.sku || '', quantity: it.quantity ?? 1, unit_value: it.unit_value ?? '', reorder_level: it.reorder_level ?? 0, notes: it.notes || '' })
    setFile(null); setPreview(it.photo_path ? photoUrl(it.photo_path) : null); setShowItem(true)
  }
  function pickFile(f) { if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)) }

  async function saveItem() {
    if (!form.name.trim()) { flash('Give it a name', 'err'); return }
    setSaving(true)
    let photo_path = editing ? editing.photo_path : null
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const up = await supabase.storage.from('inventory').upload(path, file, { upsert: false })
      if (up.error) { setSaving(false); flash('Photo upload failed', 'err'); return }
      photo_path = path
    }
    const payload = {
      creative_id: user.id,
      folder_id: form.folder_id || null,
      name: form.name.trim(),
      sku: form.sku || null,
      quantity: form.quantity === '' ? 0 : parseInt(form.quantity, 10) || 0,
      unit_value: form.unit_value === '' ? 0 : Number(form.unit_value),
      reorder_level: form.reorder_level === '' ? 0 : parseInt(form.reorder_level, 10) || 0,
      notes: form.notes || null,
      photo_path,
      updated_at: new Date().toISOString(),
    }
    let error
    if (editing) ({ error } = await supabase.from('inventory_items').update(payload).eq('id', editing.id))
    else ({ error } = await supabase.from('inventory_items').insert(payload))
    setSaving(false)
    if (error) { flash(error.message, 'err'); return }
    setShowItem(false)
    flash(editing ? 'Item updated' : 'Item added')
    load()
  }

  async function deleteItem(it) {
    if (it.photo_path) await supabase.storage.from('inventory').remove([it.photo_path]).catch(() => {})
    await supabase.from('inventory_items').delete().eq('id', it.id)
    setShowItem(false)
    flash('Item deleted')
    load()
  }

  // ── Checkout / check-in ──
  function openCheckout(it) { setCheckout(it); setCoForm({ project_id: projects[0]?.id || '', quantity: 1, note: '' }) }
  async function doCheckout() {
    const it = checkout
    const qty = parseInt(coForm.quantity, 10) || 0
    if (!coForm.project_id) { flash('Pick a project', 'err'); return }
    if (qty <= 0) { flash('Quantity must be at least 1', 'err'); return }
    if (qty > availableOf(it)) { flash('Only ' + availableOf(it) + ' available', 'err'); return }
    const { error } = await supabase.from('inventory_checkouts').insert({
      creative_id: user.id, item_id: it.id, project_id: coForm.project_id, quantity: qty, note: coForm.note || null,
    })
    if (error) { flash(error.message, 'err'); return }
    setCheckout(null)
    flash('Checked out')
    load()
  }
  async function checkIn(co) {
    await supabase.from('inventory_checkouts').update({ returned_at: new Date().toISOString() }).eq('id', co.id)
    setCheckouts(prev => prev.filter(x => x.id !== co.id))
    flash('Checked back in')
  }

  // ── Folders ──
  async function saveFolder() {
    const name = (folderModal.name || '').trim()
    if (!name) { flash('Name the folder', 'err'); return }
    if (folderModal.mode === 'new') {
      const { data, error } = await supabase.from('inventory_folders').insert({ creative_id: user.id, name, position: folders.length }).select().single()
      if (error) { flash(error.message, 'err'); return }
      setFolders(prev => [...prev, data]); setActive(data.id)
    } else {
      await supabase.from('inventory_folders').update({ name }).eq('id', folderModal.id)
      setFolders(prev => prev.map(f => f.id === folderModal.id ? { ...f, name } : f))
    }
    setFolderModal(null)
    flash('Folder saved')
  }
  async function deleteFolder(id) {
    await supabase.from('inventory_items').update({ folder_id: null }).eq('folder_id', id)
    await supabase.from('inventory_folders').delete().eq('id', id)
    setFolderModal(null)
    if (active === id) setActive('all')
    flash('Folder deleted, items kept')
    load()
  }

  const itemCheckouts = editing ? checkouts.filter(c => c.item_id === editing.id) : []
  const folderName = (fid) => folders.find(f => f.id === fid)?.name

  function Badge({ it }) { const s = statusOf(it); return <span className="badge" style={{ background: s.color + '22', color: s.color }}>{s.label}</span> }

  return (
    <div className="lti">
      <style>{CSS}</style>
      <div className="inner">
        <div className="phead">
          <div>
            <h1>Inventory</h1>
            <div className="sub">Log your gear, keep it organised in folders, and check it out to a project so you always know what went where.</div>
          </div>
          <div className="hactions">
            <div className="valuebox">
              <div>
                <div className="vl">Total value</div>
                <div className="vv">{money(totalValue)}</div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--lt-hairline)' }} />
              <div>
                <div className="vl">Items</div>
                <div className="vv">{items.length}</div>
              </div>
            </div>
            <button className="btn primary" onClick={openNew}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>Add item
            </button>
          </div>
        </div>

        {/* Folder tabs */}
        <div className="tabs">
          <button className={'tab' + (active === 'all' ? ' on' : '')} onClick={() => setActive('all')}>All items <span className="ct">{folderCounts.all || 0}</span></button>
          {folders.map(f => (
            <button key={f.id} className={'tab' + (active === f.id ? ' on' : '')} onClick={() => setActive(f.id)}>
              {f.name} <span className="ct">{folderCounts[f.id] || 0}</span>
              {active === f.id && (
                <span className="edit" onClick={e => { e.stopPropagation(); setFolderModal({ mode: 'edit', id: f.id, name: f.name }) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4-1 10-10-3-3L5 16z" /></svg>
                </span>
              )}
            </button>
          ))}
          {folderCounts.uncat > 0 && <button className={'tab' + (active === 'uncat' ? ' on' : '')} onClick={() => setActive('uncat')}>Unfiled <span className="ct">{folderCounts.uncat}</span></button>}
          <button className="tab add" onClick={() => setFolderModal({ mode: 'new', name: '' })}>+ New folder</button>
        </div>

        <div className="toolbar">
          <div className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            <input placeholder="Search gear, SKU…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="segment">
            <button className={view === 'gallery' ? 'on' : ''} onClick={() => setView('gallery')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>Gallery
            </button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>List
            </button>
          </div>
        </div>

        {loading ? <div className="empty">Loading your inventory…</div> : shown.length === 0 ? (
          <div className="list"><div className="empty">
            <div className="big">{items.length === 0 ? 'No gear logged yet' : 'Nothing in this folder'}</div>
            {items.length === 0 ? 'Add your first item, photo and all, to start your kit list.' : 'Add an item here or pick another folder.'}
          </div></div>
        ) : view === 'gallery' ? (
          <div className="grid">
            {shown.map(it => {
              const url = photoUrl(it.photo_path)
              const avail = availableOf(it)
              return (
                <div key={it.id} className="icard">
                  <div className="photo" onClick={() => openEdit(it)}>
                    <Badge it={it} />
                    {url ? <img src={url} alt={it.name} /> : <span className="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" /></svg></span>}
                  </div>
                  <div className="ibody" onClick={() => openEdit(it)}>
                    {it.sku && <div className="isku">{it.sku}</div>}
                    <div className="iname">{it.name}</div>
                    <div className="irow"><span>Available</span><span className="q">{avail} / {it.quantity}</span></div>
                  </div>
                  <div className="iacts">
                    <button className="btn sm" style={{ flex: 1, justifyContent: 'center' }} disabled={avail <= 0} onClick={() => openCheckout(it)}>Check out</button>
                    <button className="btn sm ghost" onClick={() => openEdit(it)}>Details</button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="list">
            <div className="lrow head">
              <span></span><span>Item</span><span className="hide-m">Folder</span><span className="hide-m">Available</span><span className="hide-m">Value</span><span></span>
            </div>
            {shown.map(it => {
              const url = photoUrl(it.photo_path)
              const s = statusOf(it); const avail = availableOf(it)
              return (
                <div key={it.id} className="lrow">
                  <span className="lthumb">{url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>}</span>
                  <span style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => openEdit(it)}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                    <span className="pill" style={{ background: s.color + '22', color: s.color, marginTop: 3 }}><span className="dot" style={{ background: s.color }} />{s.label}</span>
                  </span>
                  <span className="hide-m muted" style={{ fontSize: 12.5 }}>{folderName(it.folder_id) || '—'}</span>
                  <span className="hide-m tnum" style={{ fontSize: 13, fontWeight: 700 }}>{avail} / {it.quantity}</span>
                  <span className="hide-m tnum muted" style={{ fontSize: 13 }}>{money((Number(it.quantity) || 0) * (Number(it.unit_value) || 0))}</span>
                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn sm" disabled={avail <= 0} onClick={() => openCheckout(it)}>Check out</button>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Item add/edit modal */}
      {showItem && (
        <div className="modal" onClick={() => setShowItem(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">{editing ? 'Item details' : 'Add item'}</div>
            <div className="msub">A photo and a value make this a proper asset register.</div>

            <div className="field">
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0])} />
              <div className="uploader" onClick={() => fileRef.current?.click()}>
                {preview ? <img src={preview} alt="" /> : <span className="cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>Add a photo</span>}
              </div>
            </div>

            <div className="field"><label className="lab">Name</label><input className="inp" autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sony A7 IV body" /></div>
            <div className="g2">
              <div className="field"><label className="lab">Folder</label>
                <select className="inp" value={form.folder_id} onChange={e => setForm(f => ({ ...f, folder_id: e.target.value }))}>
                  <option value="">Unfiled</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="field"><label className="lab">SKU / serial (optional)</label><input className="inp" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Anything you use to ID it" /></div>
            </div>
            <div className="g3">
              <div className="field"><label className="lab">Quantity</label><input className="inp" type="number" min="0" step="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div className="field"><label className="lab">Unit value (AUD)</label><input className="inp" type="number" min="0" step="0.01" value={form.unit_value} onChange={e => setForm(f => ({ ...f, unit_value: e.target.value }))} placeholder="0.00" /></div>
              <div className="field"><label className="lab">Low stock at</label><input className="inp" type="number" min="0" step="1" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))} /></div>
            </div>
            <div className="field"><label className="lab">Notes (optional)</label><textarea className="inp" style={{ minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Condition, accessories, anything worth noting" /></div>

            {editing && itemCheckouts.length > 0 && (
              <div className="cohist">
                <label className="lab">Currently checked out</label>
                {itemCheckouts.map(c => (
                  <div key={c.id} className="co">
                    <div style={{ fontSize: 12.5 }}>
                      <strong>{c.quantity}</strong> to {c.project?.title || 'a project'} <span className="faint">· {prettyDate(c.checked_out_at)}</span>
                      {c.note ? <div className="faint" style={{ fontSize: 11.5 }}>{c.note}</div> : null}
                    </div>
                    <button className="btn sm" onClick={() => checkIn(c)}>Check in</button>
                  </div>
                ))}
              </div>
            )}

            <div className="mactions">
              {editing && <button className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => deleteItem(editing)}>Delete</button>}
              <button className="btn" onClick={() => setShowItem(false)}>Cancel</button>
              <button className="btn primary" disabled={saving || !form.name.trim()} onClick={saveItem}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add item'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {checkout && (
        <div className="modal" onClick={() => setCheckout(null)}>
          <div className="modalbox sm" onClick={e => e.stopPropagation()}>
            <div className="mtitle">Check out · {checkout.name}</div>
            <div className="msub">{availableOf(checkout)} available. This drops the available count until it’s checked back in.</div>
            <div className="field"><label className="lab">Project</label>
              <select className="inp" value={coForm.project_id} onChange={e => setCoForm(f => ({ ...f, project_id: e.target.value }))}>
                {projects.length === 0 && <option value="">No projects yet</option>}
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="field"><label className="lab">Quantity</label><input className="inp" type="number" min="1" max={availableOf(checkout)} value={coForm.quantity} onChange={e => setCoForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div className="field"><label className="lab">Note (optional)</label><input className="inp" value={coForm.note} onChange={e => setCoForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. spare body for the day" /></div>
            <div className="mactions">
              <button className="btn" onClick={() => setCheckout(null)}>Cancel</button>
              <button className="btn primary" disabled={!coForm.project_id} onClick={doCheckout}>Check out</button>
            </div>
          </div>
        </div>
      )}

      {/* Folder modal */}
      {folderModal && (
        <div className="modal" onClick={() => setFolderModal(null)}>
          <div className="modalbox sm" onClick={e => e.stopPropagation()}>
            <div className="mtitle">{folderModal.mode === 'new' ? 'New folder' : 'Rename folder'}</div>
            <div className="msub">Group your gear however you like, camera, lighting, audio, whatever suits you.</div>
            <div className="field"><label className="lab">Folder name</label><input className="inp" autoFocus value={folderModal.name} onChange={e => setFolderModal(m => ({ ...m, name: e.target.value }))} placeholder="Camera equipment" onKeyDown={e => { if (e.key === 'Enter') saveFolder() }} /></div>
            <div className="mactions">
              {folderModal.mode === 'edit' && <button className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => deleteFolder(folderModal.id)}>Delete folder</button>}
              <button className="btn" onClick={() => setFolderModal(null)}>Cancel</button>
              <button className="btn primary" onClick={saveFolder}>Save</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast show' + (toast.type === 'err' ? ' err' : '')}>{toast.type === 'err' ? '⚠' : '✓'} {toast.msg}</div>}
    </div>
  )
}
