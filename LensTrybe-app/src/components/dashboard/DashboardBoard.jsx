import { useLayoutEffect, useRef, useState } from 'react'
import { TILE_SIZE } from './widgetKit'

// The widget board: a column grid that every tile snaps to.
//
// It used to be a flex-wrap row of fixed 156px squares. Fixed-width children in a
// wrap container leave whatever does not divide evenly as dead space on the right,
// so on a phone two 156px squares and a 16px gap came to 328 inside a 358 column and
// the squares stopped 30px short of the full-width tiles below them. Ragged.
//
// Columns fix that: the tiles are sized by the grid rather than sizing themselves, so
// every edge lines up whatever the screen width. The tiles carry width 100% and the
// squares hold their shape with an aspect ratio.

const GAP = 16

// The smallest a square may get before the grid drops to fewer columns.
const MIN_TILE = 140

// Only these counts, never five. A wide tile is three squares across by design, and
// five columns leaves it stranded with a ragged square beside it on every row. Each
// count below divides evenly by its wide span.
const COLUMN_STEPS = [6, 4, 3, 2]

// How many squares a wide analytics tile covers at each column count. At two and three
// columns it takes the whole row, because anything less looks like a mistake.
const WIDE_SPAN = { 6: 3, 4: 2, 3: 3, 2: 2 }

/** The most columns of at least MIN_TILE that fit in the given width. */
function columnsFor(width) {
  if (!width) return 6
  for (const c of COLUMN_STEPS) {
    if (width >= c * MIN_TILE + (c - 1) * GAP) return c
  }
  return 2
}

export default function DashboardBoard({ items, editing, onReorder, onRemove }) {
  const [drag, setDrag] = useState(null) // { id, offX, offY, x, y }
  const [cols, setCols] = useState(6)
  const tileRefs = useRef({})
  const boardRef = useRef(null)

  // Measured, not guessed from the viewport. The board sits inside the dashboard's
  // content column, which is narrower than the window by the sidebar and the page
  // padding, so a media query on the viewport would pick the wrong column count.
  //
  // Layout effect, not a plain one: the first render has to guess a column count, and
  // six columns on a phone is a screen of 40px slivers. Measuring before paint means
  // nobody sees the guess.
  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el) return undefined
    function measure() { setCols(columnsFor(el.clientWidth)) }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  const wideSpan = WIDE_SPAN[cols] || cols

  return (
    <>
      <style>{`
        @keyframes ltTileWiggle { 0%,100%{transform:rotate(-1deg)} 50%{transform:rotate(1deg)} }
        .lt-tile.editing { animation: ltTileWiggle 0.5s ease-in-out infinite; cursor: grab; }
        .lt-tile.editing:active { cursor: grabbing; }
      `}</style>
      <div
        ref={boardRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: GAP,
          alignItems: 'start',
          userSelect: editing ? 'none' : 'auto',
          touchAction: editing ? 'none' : 'auto',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {items.map((item, index) => {
          const lifted = drag?.id === item.id
          const span = item.wide ? wideSpan : 1
          return (
            <div
              key={item.id}
              ref={(el) => { tileRefs.current[item.id] = el }}
              className={`lt-tile${editing && !lifted ? ' editing' : ''}`}
              onPointerDown={(e) => onPointerDown(e, item.id)}
              style={lifted
                // A lifted tile leaves the grid, so it has to carry the size the grid
                // had given it or it snaps back to its content width mid-drag.
                ? { position: 'fixed', left: drag.x, top: drag.y, width: drag.w || TILE_SIZE, height: drag.h || TILE_SIZE, zIndex: 1000, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }
                : { position: 'relative', gridColumn: `span ${span}`, minWidth: 0, animationDelay: `${(index % 5) * 0.06}s` }}
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
