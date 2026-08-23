import { useState } from 'react'

const FONT = "'Inter', sans-serif"
export const SIZE_SPAN = { sm: 4, md: 6, lg: 12 }
export const SIZE_ORDER = ['sm', 'md', 'lg']
export function nextSize(size) {
  const i = SIZE_ORDER.indexOf(size)
  return SIZE_ORDER[(i + 1) % SIZE_ORDER.length]
}

function CtrlBtn({ children, onClick, title, t }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      onMouseDown={(e) => e.stopPropagation()}
      draggable={false}
      style={{
        width: 24, height: 24, borderRadius: 8,
        border: t.ctrlBorder, background: t.ctrlBg, color: t.ctrlText,
        cursor: 'pointer', fontSize: 12, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function WidgetShell({ item, editing, isDragging, onResize, onHide, dnd, t }) {
  return (
    <div
      draggable={editing}
      onDragStart={dnd.onDragStart}
      onDragEnter={dnd.onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={dnd.onDragEnd}
      style={{
        gridColumn: `span ${SIZE_SPAN[item.size] || 6}`,
        minWidth: 0,
        transition: 'opacity 0.15s ease',
        opacity: isDragging ? 0.35 : 1,
      }}
      className={editing ? 'lt-widget-editing' : undefined}
    >
      <div
        style={{
          background: t.glassBg,
          border: t.glassBorder,
          boxShadow: t.glassShadow,
          backdropFilter: t.glassBlur,
          WebkitBackdropFilter: t.glassBlur,
          borderRadius: 22,
          padding: 18,
          height: '100%',
          minHeight: item.size === 'lg' ? 0 : 150,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          cursor: editing ? 'grab' : 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.title, fontFamily: FONT, textShadow: t.dark ? `0 0 12px ${t.title}55` : 'none' }}>{item.title}</span>
          {editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <CtrlBtn t={t} onClick={() => onResize(item.id)} title="Resize">⤢</CtrlBtn>
              <CtrlBtn t={t} onClick={() => onHide(item.id)} title="Hide">–</CtrlBtn>
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', pointerEvents: editing ? 'none' : 'auto' }}>
          {item.content}
        </div>
      </div>
    </div>
  )
}

export default function WidgetGrid({ items, editing, onReorder, onResize, onHide, t }) {
  const [dragIndex, setDragIndex] = useState(null)

  const dndFor = (index) => ({
    onDragStart: () => setDragIndex(index),
    onDragEnter: () => {
      if (dragIndex === null || dragIndex === index) return
      onReorder(dragIndex, index)
      setDragIndex(index)
    },
    onDragEnd: () => setDragIndex(null),
  })

  return (
    <>
      <style>{`
        @keyframes ltWiggle { 0%,100%{transform:rotate(-0.35deg)} 50%{transform:rotate(0.35deg)} }
        .lt-widget-editing > div { animation: ltWiggle 0.45s ease-in-out infinite; }
        @media (max-width: 767px) { .lt-widget-grid > div { grid-column: span 12 !important; } }
      `}</style>
      <div className="lt-widget-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16, alignItems: 'stretch' }}>
        {items.map((item, index) => (
          <WidgetShell key={item.id} item={item} editing={editing} isDragging={dragIndex === index} onResize={onResize} onHide={onHide} dnd={dndFor(index)} t={t} />
        ))}
      </div>
    </>
  )
}
