import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { NOTE_COLORS } from '../../components/layout/NoteTaker'

function prettyDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const CSS = `
.ltn{position:relative;min-height:60vh;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text)}
.ltn *{box-sizing:border-box}
.ltn .inner{max-width:1180px;margin:0 auto;position:relative;z-index:1}
.ltn .phead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.ltn h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0}
.ltn .sub{color:var(--lt-muted);font-size:13.5px;margin-top:4px;max-width:620px}
.ltn .btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:9px 15px;cursor:pointer;border:1px solid var(--lt-border);background:var(--lt-surface);color:var(--lt-text);display:inline-flex;align-items:center;gap:7px;transition:.15s;white-space:nowrap}
.ltn .btn:hover{background:var(--lt-surface-2)}
.ltn .btn svg{width:15px;height:15px}
.ltn .btn.primary{background:#1DB954;border-color:transparent;color:#04120a;font-weight:700;box-shadow:0 6px 18px -8px rgba(29,185,84,0.7)}
.ltn .btn.primary:hover{background:#22c95f}
.ltn .btn.sm{padding:6px 10px;font-size:12px}
.ltn .btn.ghost{background:transparent;border-color:transparent;color:var(--lt-muted)}
.ltn .btn.ghost:hover{color:var(--lt-text);background:var(--lt-surface)}
.ltn .btn.danger{color:#f0516d}
.ltn .btn:disabled{opacity:.5;cursor:default}
.ltn .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.ltn .search{flex:1;min-width:200px;display:flex;align-items:center;gap:9px;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:9px 13px;color:var(--lt-muted)}
.ltn .search input{flex:1;background:none;border:none;outline:none;color:var(--lt-text);font-family:inherit;font-size:13.5px}
.ltn .search input::placeholder{color:var(--lt-faint)}
.ltn .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.ltn .note{border-radius:15px;padding:15px 16px;position:relative;overflow:hidden;background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur);display:flex;flex-direction:column;gap:8px;min-height:120px}
.ltn .note .accent{position:absolute;left:0;top:0;bottom:0;width:4px}
.ltn .ntitle{font-size:14px;font-weight:700;letter-spacing:-0.01em;padding-left:4px}
.ltn .nbody{font-size:13px;color:var(--lt-muted);line-height:1.55;white-space:pre-wrap;padding-left:4px;flex:1}
.ltn .nmeta{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:4px;margin-top:2px}
.ltn .ntag{font-size:11px;font-weight:600;color:var(--lt-faint)}
.ltn .nacts{display:flex;gap:4px;opacity:0;transition:.15s}
.ltn .note:hover .nacts{opacity:1}
.ltn .iconbtn{width:26px;height:26px;border-radius:7px;border:none;background:transparent;color:var(--lt-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.ltn .iconbtn:hover{background:var(--lt-surface-2);color:var(--lt-text)}
.ltn .iconbtn.on{color:#f5a524}
.ltn .iconbtn.danger:hover{color:#f0516d}
.ltn .iconbtn svg{width:15px;height:15px}
.ltn .empty{padding:56px 20px;text-align:center;color:var(--lt-muted);font-size:14px}
.ltn .empty .big{font-size:16px;font-weight:700;color:var(--lt-text);margin-bottom:6px}
.ltn .sectlbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--lt-faint);margin:6px 2px 12px;display:flex;align-items:center;gap:6px}
.ltn .modal{position:fixed;inset:0;background:rgba(6,5,12,0.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:1100;display:flex;align-items:flex-start;justify-content:center;padding:44px 20px;overflow-y:auto}
.ltn .modalbox{width:100%;max-width:480px;border-radius:20px;padding:24px;background:var(--lt-modal-bg);border:var(--lt-modal-border);box-shadow:var(--lt-modal-shadow);backdrop-filter:var(--lt-modal-blur);-webkit-backdrop-filter:var(--lt-modal-blur)}
.ltn .mtitle{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin-bottom:16px}
.ltn .field{margin-bottom:14px}
.ltn .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-muted);display:block;margin-bottom:6px}
.ltn .inp{width:100%;background:var(--lt-input-bg);border:1px solid var(--lt-input-border);border-radius:10px;padding:11px 13px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none}
.ltn .inp:focus{border-color:#1DB954}
.ltn select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.ltn .swatches{display:flex;gap:8px;align-items:center}
.ltn .sw{width:24px;height:24px;border-radius:50%;cursor:pointer;flex:0 0 auto}
.ltn .mactions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
.ltn .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300}
.ltn .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
`

const BLANK = { title: '', body: '', color: '', project_id: '', pinned: false }

export default function NotesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState([])
  const [projects, setProjects] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { if (user) load() }, [user])
  useEffect(() => {
    function onChanged() { if (user) load() }
    window.addEventListener('lt-notes-changed', onChanged)
    return () => window.removeEventListener('lt-notes-changed', onChanged)
  }, [user])

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 2200) }

  async function load() {
    const [nt, pj] = await Promise.all([
      supabase.from('notes').select('*').eq('creative_id', user.id).order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('projects').select('id, title').eq('creative_id', user.id).order('created_at', { ascending: false }),
    ])
    setNotes(nt.data || [])
    setProjects(pj.data || [])
    setLoading(false)
  }

  const projTitle = useMemo(() => { const m = {}; projects.forEach(p => { m[p.id] = p.title }); return m }, [projects])
  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => notes.filter(n => !q || (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q)), [notes, q])
  const pinned = filtered.filter(n => n.pinned)
  const rest = filtered.filter(n => !n.pinned)

  function openNew() { setEditing(null); setForm(BLANK); setShowModal(true) }
  function openEdit(n) { setEditing(n); setForm({ title: n.title || '', body: n.body || '', color: n.color || '', project_id: n.project_id || '', pinned: !!n.pinned }); setShowModal(true) }

  async function save() {
    if (!form.title.trim() && !form.body.trim()) { flash('Write something first'); return }
    setSaving(true)
    const payload = { creative_id: user.id, title: form.title.trim() || null, body: form.body.trim() || null, color: form.color || null, project_id: form.project_id || null, pinned: form.pinned, updated_at: new Date().toISOString() }
    let error
    if (editing) ({ error } = await supabase.from('notes').update(payload).eq('id', editing.id))
    else ({ error } = await supabase.from('notes').insert(payload))
    setSaving(false)
    if (error) { flash('Could not save note'); return }
    setShowModal(false); flash(editing ? 'Note updated' : 'Note saved'); load()
  }
  async function togglePin(n) {
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x))
    await supabase.from('notes').update({ pinned: !n.pinned, updated_at: new Date().toISOString() }).eq('id', n.id)
    load()
  }
  async function remove(n) {
    setNotes(prev => prev.filter(x => x.id !== n.id))
    await supabase.from('notes').delete().eq('id', n.id)
    flash('Note deleted')
  }

  function Card({ n }) {
    return (
      <div className="note">
        {n.color && <span className="accent" style={{ background: n.color }} />}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openEdit(n)}>
            {n.title && <div className="ntitle">{n.title}</div>}
          </div>
          <div className="nacts">
            <button className={'iconbtn' + (n.pinned ? ' on' : '')} title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(n)}>
              <svg viewBox="0 0 24 24" fill={n.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 17v5M9 3h6l-1 7 3 2v2H7v-2l3-2z" /></svg>
            </button>
            <button className="iconbtn" title="Edit" onClick={() => openEdit(n)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4-1 10-10-3-3L5 16z" /></svg></button>
            <button className="iconbtn danger" title="Delete" onClick={() => remove(n)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg></button>
          </div>
        </div>
        {n.body && <div className="nbody" onClick={() => openEdit(n)}>{n.body}</div>}
        <div className="nmeta">
          <span className="ntag">{n.project_id ? (projTitle[n.project_id] || 'Project') : ''}</span>
          <span className="ntag">{prettyDate(n.updated_at || n.created_at)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ltn">
      <style>{CSS}</style>
      <div className="inner">
        <div className="phead">
          <div>
            <h1>Notes</h1>
            <div className="sub">Every thought you've jotted, in one place. Use the floating note button to capture one from any page.</div>
          </div>
          <button className="btn primary" onClick={openNew}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>New note
          </button>
        </div>

        <div className="toolbar">
          <div className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
            <input placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <div className="empty">Loading notes…</div> : filtered.length === 0 ? (
          <div className="note" style={{ minHeight: 0 }}><div className="empty">
            <div className="big">{notes.length === 0 ? 'No notes yet' : 'No notes match your search'}</div>
            {notes.length === 0 ? 'Tap the floating note button (bottom-right) or New note to capture your first thought.' : 'Try a different search.'}
          </div></div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className="sectlbl"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17v5M9 3h6l-1 7 3 2v2H7v-2l3-2z" /></svg> Pinned</div>
                <div className="grid" style={{ marginBottom: rest.length ? 24 : 0 }}>{pinned.map(n => <Card key={n.id} n={n} />)}</div>
              </>
            )}
            {rest.length > 0 && (
              <>
                {pinned.length > 0 && <div className="sectlbl">Others</div>}
                <div className="grid">{rest.map(n => <Card key={n.id} n={n} />)}</div>
              </>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">{editing ? 'Edit note' : 'New note'}</div>
            <div className="field"><label className="lab">Title (optional)</label><input className="inp" autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Give it a title" /></div>
            <div className="field"><label className="lab">Note</label><textarea className="inp" style={{ minHeight: 120, resize: 'vertical' }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your note…" /></div>
            <div className="field">
              <label className="lab">Colour</label>
              <div className="swatches">
                {NOTE_COLORS.map(c => (
                  <span key={c.key || 'none'} className="sw" title={c.label} onClick={() => setForm(f => ({ ...f, color: c.key }))}
                    style={{ background: c.key || 'var(--lt-surface-2)', border: form.color === c.key ? '2px solid var(--lt-text)' : '2px solid transparent', boxShadow: c.key ? 'none' : 'inset 0 0 0 1px var(--lt-border)' }} />
                ))}
              </div>
            </div>
            <div className="field">
              <label className="lab">Attach to project (optional)</label>
              <select className="inp" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1DB954' }} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Pin to top</span>
            </label>
            <div className="mactions">
              {editing && <button className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => { const n = editing; setShowModal(false); remove(n) }}>Delete</button>}
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save note'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show">✓ {toast}</div>}
    </div>
  )
}
