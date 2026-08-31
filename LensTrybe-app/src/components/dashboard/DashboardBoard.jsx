import { useRef, useState } from 'react'
import { TILE_SIZE } from './widgetKit'

// Uniform tile grid. Every widget is the same small square, so tiles pack into
// a clean grid and can be dragged to reorder with no fit/overlap issues. In
// edit mode tiles wobble, lift and follow the cursor while the rest reflow, and
// each shows a remove (−) badge. Clicking a tile (when not editing) expands the
// widget into its centered modal — handled inside each widget.
export default function DashboardBoard({ items, editing, onReorder, onRemove }) {
  const [drag, setDrag] = useState(null) // { id, offX, offY, x, y }
  const tileRefs = useRef({})

  function onPointerDown(e, id) {
    if (!editing || e.button !== 0) return
    const el = tileRefs.current[id]
    if (!el) return
    const r = el.getBoundingClientRect()
    setDrag({ id, offX: e.clientX - r.left, offY: e.clientY - r.top, x: r.left, y: r.top, w: r.width, h: r.height })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  function onPointerMove(e) {
    if (!drag) return
    setDrag((d) => (d ? { ...d, x: e.clientX - d.offX, y: e.clientY - d.offY } : d))
    let targetId = null
    for (const it of items) {
      if (it.id === drag.id) continue
      const el = tileRefs.current[it.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { targetId = it.id; break }
    }
    if (targetId) {
      const from = items.findIndex((it) => it.id === drag.id)
      const to = items.findIndex((it) => it.id === targetId)
      if (from !== -1 && to !== -1 && from !== to) onReorder(from, to)
    }
  }
  function endDrag() { if (drag) setDrag(null) }

  return (
    <>
      <style>{`
        @keyframes ltTileWiggle { 0%,100%{transform:rotate(-1deg)} 50%{transform:rotate(1deg)} }
        .lt-tile.editing { animation: ltTileWiggle 0.5s ease-in-out infinite; cursor: grab; }
        .lt-tile.editing:active { cursor: grabbing; }
      `}</style>
      <div
        style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', userSelect: editing ? 'none' : 'auto', touchAction: editing ? 'none' : 'auto' }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {items.map((item, index) => {
          const lifted = drag?.id === item.id
          return (
            <div
              key={item.id}
              ref={(el) => { tileRefs.current[item.id] = el }}
              className={`lt-tile${editing && !lifted ? ' editing' : ''}`}
              onPointerDown={(e) => onPointerDown(e, item.id)}
              style={lifted
                ? { position: 'fixed', left: drag.x, top: drag.y, width: drag.w || TILE_SIZE, height: drag.h || TILE_SIZE, zIndex: 1000, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }
                : { position: 'relative', animationDelay: `${(index % 5) * 0.06}s` }}
            >
              {editing && !lifted ? (
                <button
                  type="button"
                  aria-label="Remove widget"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
                  style={{ position: 'absolute', top: -8, left: -8, zIndex: 5, width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(20,20,28,0.92)', color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -4px rgba(0,0,0,0.6)' }}
                >
                  −
                </button>
              ) : null}
              <div style={{ pointerEvents: editing ? 'none' : 'auto' }}>
                {item.node}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
