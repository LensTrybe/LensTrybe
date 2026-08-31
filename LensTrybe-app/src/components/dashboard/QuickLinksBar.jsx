import { useRef, useState } from 'react'

// Drag-to-reorder is off for now (kept in code, gated). Add + remove still work.
const DRAG_ENABLED = false

const FONT = "'Inter', sans-serif"
const TEXT = 'var(--lt-text)'
const MUTED = 'var(--lt-muted)'
const GREEN = '#1DB954'

// Theme-aware liquid glass, matching the tiles/sidebar.
const CHIP_GLASS = {
  background: 'var(--lt-glass-bg)',
  backdropFilter: 'var(--lt-glass-blur)',
  WebkitBackdropFilter: 'var(--lt-glass-blur)',
  border: 'var(--lt-glass-border)',
  boxShadow: 'var(--lt-glass-shadow)',
}

// Editable row of quick-link chips. Click a chip (when not editing) to open its
// drawer. In edit mode chips wobble, can be dragged to reorder (pointer-based),
// removed via a − badge, and re-added via the trailing + chip.
export default function QuickLinksBar({ items, editing, onReorder, onRemove, onOpen, hiddenList, onAdd }) {
  const [dragId, setDragId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const chipRefs = useRef({})

  function onPointerDown(e, id) {
    if (!DRAG_ENABLED || !editing || e.button !== 0) return
    setDragId(id)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  function onPointerMove(e) {
    if (!dragId) return
    let targetId = null
    for (const it of items) {
      const el = chipRefs.current[it.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { targetId = it.id; break }
    }
    if (!targetId || targetId === dragId) return
    const from = items.findIndex((it) => it.id === dragId)
    const to = items.findIndex((it) => it.id === targetId)
    if (from !== -1 && to !== -1 && from !== to) onReorder(from, to)
  }
  function endDrag() { if (dragId) setDragId(null) }

  return (
    <>
      <style>{`
        @keyframes ltChipWiggle { 0%,100%{transform:rotate(-0.8deg)} 50%{transform:rotate(0.8deg)} }
        .lt-chip.editing { animation: ltChipWiggle 0.5s ease-in-out infinite; }
      `}</style>
      <div
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', userSelect: editing ? 'none' : 'auto', touchAction: editing ? 'none' : 'auto' }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            ref={(el) => { chipRefs.current[item.id] = el }}
            className={`lt-chip${editing && DRAG_ENABLED ? ' editing' : ''}`}
            onPointerDown={(e) => onPointerDown(e, item.id)}
            style={{ position: 'relative', flex: '1 1 0', minWidth: 120, animationDelay: `${(index % 5) * 0.06}s`, opacity: dragId === item.id ? 0.4 : 1 }}
          >
            {editing ? (
              <button type="button" aria-label="Remove link"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
                style={{ position: 'absolute', top: -8, left: -8, zIndex: 5, width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(20,20,28,0.95)', color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px -3px rgba(0,0,0,0.6)' }}>−</button>
            ) : null}
            <button
              type="button"
              onClick={() => { if (!editing) onOpen(item.id) }}
              style={{ ...CHIP_GLASS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 16px', borderRadius: 999, color: TEXT, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: editing ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0, boxShadow: `0 0 8px ${GREEN}` }} />
              {item.label}
            </button>
          </div>
        ))}

        {editing ? (
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setAddOpen((v) => !v)}
              style={{ ...CHIP_GLASS, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999, color: MUTED, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', whiteSpace: 'nowrap', borderStyle: 'dashed' }}>
              + Add link
            </button>
            {addOpen ? (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60, minWidth: 190, background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)', backdropFilter: 'var(--lt-modal-blur)', WebkitBackdropFilter: 'var(--lt-modal-blur)', borderRadius: 14, padding: 8, boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6)' }}>
                {hiddenList.length === 0 ? (
                  <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT, padding: '8px 10px' }}>All links are on your dashboard.</div>
                ) : hiddenList.map((l) => (
                  <button key={l.id} type="button" onClick={() => { onAdd(l.id); setAddOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: TEXT, fontSize: 13.5, fontFamily: FONT, padding: '9px 10px', borderRadius: 9, cursor: 'pointer' }}>+ {l.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}
