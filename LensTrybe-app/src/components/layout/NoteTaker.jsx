import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { FLOAT_BOTTOM, FLOAT_ICON, FLOAT_RIGHT, FLOAT_SIZE, glassCircle } from '../../lib/floatingStack'

// Floating quick-note button. Click to jot a note from any page.
// A LensTrybe signature touch, HoneyBook has no global note-taker.
//
// It used to be draggable, with the position remembered. That sounded friendly and was not:
// a button that moves is a button you have to look for, it could be parked on top of
// something that mattered, and it made the panel's own position a moving target. It now
// sits in one place, directly above Lumi, on every page and every visit.

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
  const [pos, setPos] = useState(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [color, setColor] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const bodyRef = useRef(null)

  // Anchored to the bottom right corner, above Lumi. Kept as an x and y because the note
  // panel works out which way to open from where the button is.
  useEffect(() => {
    function place() {
      const mobile = window.innerWidth < 768
      const right = mobile ? FLOAT_RIGHT.mobile : FLOAT_RIGHT.desktop
      const bottom = mobile ? FLOAT_BOTTOM.notes.mobile : FLOAT_BOTTOM.notes.desktop
      setPos({ x: window.innerWidth - right - FLOAT_SIZE, y: window.innerHeight - bottom - FLOAT_SIZE })
    }
    place()
    window.addEventListener('resize', place)
    // An old dragged position is no longer honoured, so clear it rather than leave it behind.
    try { localStorage.removeItem('lt_notetaker_pos') } catch { /* ignore */ }
    return () => window.removeEventListener('resize', place)
  }, [])

  useEffect(() => {
    if (user && open) {
      if (projects.length === 0) supabase.from('projects').select('id, title').eq('creative_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setProjects(data || []))
      setTimeout(() => bodyRef.current && bodyRef.current.focus(), 60)
    }
  }, [user, open])


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

  if (!user || !pos) return null

  const openLeft = pos.x > window.innerWidth / 2
  const openUp = pos.y > window.innerHeight / 2
  const panelW = 300
  const panel = {
    position: 'fixed', width: panelW, zIndex: 1400,
    left: Math.max(8, Math.min(window.innerWidth - panelW - 8, openLeft ? pos.x - panelW + 52 : pos.x)),
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }
  if (openUp) panel.bottom = window.innerHeight - pos.y + 10
  else panel.top = pos.y + 62

  const fieldStyle = { width: '100%', background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', borderRadius: 9, padding: '9px 11px', color: 'var(--lt-text)', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }

  return (
    <>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1399 }} />
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
      )}
      <style>{`
        .lt-note-fab:hover { transform: translateY(-2px); border-color: #1DB954; }
        .lt-note-fab:active { transform: translateY(0); }
      `}</style>
      <button
        className="lt-note-fab"
        aria-label="Quick note"
        onClick={() => setOpen(o => !o)}
        style={{ ...glassCircle(), position: 'fixed', left: pos.x, top: pos.y, zIndex: 1401, cursor: 'pointer' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FLOAT_ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
    </>
  )
}
