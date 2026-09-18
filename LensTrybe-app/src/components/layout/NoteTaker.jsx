import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { DOCK_EDGE, DOCK_EVENTS, panelBottom } from '../../lib/floatingStack'

// Quick note. Jot something down from any page in the app.
// A LensTrybe signature touch, HoneyBook has no global note-taker.
//
// It used to have its own floating button, and before that a draggable one. Both are gone.
// A button that moves is a button you have to look for, and three fixed buttons in one
// corner is a column of clutter sitting on top of the page. FloatingDock now owns the
// button; this owns the form and opens when the dock says so.

export const NOTE_COLORS = [
  { key: '', label: 'Default' },
  { key: '#f5a524', label: 'Amber' },
  { key: '#4aa3ff', label: 'Blue' },
  { key: '#1DB954', label: 'Green' },
  { key: '#FF2D78', label: 'Pink' },
  { key: '#9b6bff', label: 'Purple' },
]

export default function NoteTaker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [edge, setEdge] = useState(DOCK_EDGE.desktop)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [color, setColor] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    function onOpen() { setOpen(true) }
    window.addEventListener(DOCK_EVENTS.notes, onOpen)
    // An old dragged position is no longer honoured, so clear it rather than leave it behind.
    try { localStorage.removeItem('lt_notetaker_pos') } catch { /* ignore */ }
    return () => window.removeEventListener(DOCK_EVENTS.notes, onOpen)
  }, [])

  // clientWidth, not innerWidth. innerWidth counts the scrollbar and a CSS right offset
  // does not, so measuring the wrong one puts this panel a scrollbar's width out of line
  // with the dock it opens from.
  useEffect(() => {
    function place() {
      setEdge(document.documentElement.clientWidth < 768 ? DOCK_EDGE.mobile : DOCK_EDGE.desktop)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [])

  useEffect(() => {
    if (user && open) {
      if (projects.length === 0) supabase.from('projects').select('id, title').eq('creative_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setProjects(data || []))
      setTimeout(() => bodyRef.current && bodyRef.current.focus(), 60)
    }
  }, [user, open, projects.length])

  async function save() {
    if (!body.trim() && !title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('notes').insert({ creative_id: user.id, title: title.trim() || null, body: body.trim() || null, color: color || null, project_id: projectId || null })
    setSaving(false)
    if (error) return
    setTitle(''); setBody(''); setColor(''); setProjectId('')
    setSaved(true); setTimeout(() => setSaved(false), 1600)
    window.dispatchEvent(new CustomEvent('lt-notes-changed'))
  }

  if (!user || !open) return null

  // Anchored to the same corner as the dock, sitting just above it.
  const panel = {
    position: 'fixed',
    right: edge,
    bottom: panelBottom(edge),
    width: 300,
    maxWidth: `calc(100vw - ${edge * 2}px)`,
    zIndex: 954,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }

  const fieldStyle = { width: '100%', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', borderRadius: 9, padding: '9px 11px', color: 'var(--lt-text)', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 953 }} />
      <div className="lt-notepanel" style={panel} onClick={e => e.stopPropagation()}>
        <div style={{ borderRadius: 16, padding: 15, background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)', boxShadow: 'var(--lt-modal-shadow)', backdropFilter: 'var(--lt-modal-blur)', WebkitBackdropFilter: 'var(--lt-modal-blur)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Quick note</div>
            <span onClick={() => { setOpen(false); navigate('/dashboard/notes') }} style={{ fontSize: 11.5, fontWeight: 600, color: '#1DB954', cursor: 'pointer' }}>All notes →</span>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" style={{ ...fieldStyle, marginBottom: 8, fontWeight: 600 }} />
          <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} placeholder="Jot it down…" style={{ ...fieldStyle, minHeight: 84, resize: 'vertical', marginBottom: 8 }}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save() }} />
          <div style={{ display: 'flex', gap: 7, marginBottom: 10, alignItems: 'center' }}>
            {NOTE_COLORS.map(c => (
              <span key={c.key || 'none'} onClick={() => setColor(c.key)} title={c.label}
                style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', flex: '0 0 auto', background: c.key || 'var(--lt-surface-2)', border: color === c.key ? '2px solid var(--lt-text)' : '2px solid transparent', boxShadow: c.key ? 'none' : 'inset 0 0 0 1px var(--lt-border)' }} />
            ))}
          </div>
          {projects.length > 0 && (
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...fieldStyle, marginBottom: 10, appearance: 'none', cursor: 'pointer', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center', paddingRight: 30 }}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#1DB954', fontWeight: 600, opacity: saved ? 1 : 0, transition: '.2s' }}>Saved ✓</span>
            <button onClick={save} disabled={saving || (!body.trim() && !title.trim())}
              style={{ background: '#1DB954', color: '#04120a', fontWeight: 700, border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: (saving || (!body.trim() && !title.trim())) ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save note'}</button>
          </div>
        </div>
      </div>
    </>
  )
}
