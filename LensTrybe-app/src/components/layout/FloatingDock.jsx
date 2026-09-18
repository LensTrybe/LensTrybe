import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  DOCK_EDGE, DOCK_EVENTS, DOCK_ITEM, DOCK_SIZE, FAN_ANGLES,
  FLOAT_ICON, FLOAT_PINK, UNREAD_EVENT, UNREAD_PING, fanAt, glassCircle,
} from '../../lib/floatingStack'

// One button in the bottom right corner that fans out into notifications, Lumi and the
// quick-note pad.
//
// These were three separate floating circles stacked up the right edge. Three is a column
// of clutter covering whatever was underneath, and on a phone that was most of the card
// you were trying to read. One button collapses that to a single 56px target, and the
// unread count stays on it while it is shut so nothing goes unnoticed.
//
// The dock owns nothing but the fan. Each tool still owns its own panel, its own data and
// its own open state; tapping an item just fires the event that tool listens for. That
// keeps the notifications poller, the Lumi drawer and the note form exactly where they
// were, and means the client dashboard can still mount the bell on its own.

const ITEMS = [
  {
    key: 'notifications',
    label: 'Notifications',
    event: DOCK_EVENTS.notifications,
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={FLOAT_ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    key: 'lumi',
    label: 'Ask Lumi',
    event: DOCK_EVENTS.lumi,
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={FLOAT_ICON} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.2l2 5.4 5.4 2-5.4 2-2 5.4-2-5.4-5.4-2 5.4-2z" />
        <path d="M18.4 15.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
      </svg>
    ),
  },
  {
    key: 'notes',
    label: 'Quick note',
    event: DOCK_EVENTS.notes,
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={FLOAT_ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    ),
  },
]

export default function FloatingDock() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [edge, setEdge] = useState(DOCK_EDGE.desktop)

  // clientWidth, not innerWidth. innerWidth counts the scrollbar and a CSS right offset
  // does not, so measuring the wrong one puts the dock a scrollbar's width out of line
  // with every panel that opens from it.
  useEffect(() => {
    function onResize() {
      setEdge(document.documentElement.clientWidth < 768 ? DOCK_EDGE.mobile : DOCK_EDGE.desktop)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The bell announces its count whenever it loads. This mounts alongside it, so it can
  // miss the first announcement; the ping asks for a fresh one.
  useEffect(() => {
    function onCount(e) { setUnread(Number(e.detail) || 0) }
    window.addEventListener(UNREAD_EVENT, onCount)
    window.dispatchEvent(new Event(UNREAD_PING))
    return () => window.removeEventListener(UNREAD_EVENT, onCount)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pick = useCallback((event) => {
    setOpen(false)
    window.dispatchEvent(new Event(event))
  }, [])

  if (!user) return null

  const badge = unread > 9 ? '9+' : String(unread)

  return (
    <>
      <style>{`
        .lt-dock-fab:hover { transform: translateY(-2px); border-color: #1DB954; }
        .lt-dock-fab:active { transform: translateY(0); }
        .lt-dock-item { opacity: 0; transform: scale(0.4); transition: opacity .16s ease, transform .2s cubic-bezier(.2,1.3,.4,1); }
        .lt-dock.is-open .lt-dock-item { opacity: 1; transform: scale(1); }
        .lt-dock-item:hover { border-color: #1DB954; }
        .lt-dock-label { opacity: 0; transition: opacity .16s ease .06s; }
        .lt-dock.is-open .lt-dock-label { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .lt-dock-item, .lt-dock-label { transition: none; }
        }
      `}</style>

      <div className={`lt-dock${open ? ' is-open' : ''}`}>
        {open && (
          <div
            onClick={() => setOpen(false)}
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, zIndex: 949, background: 'rgba(8,7,13,0.28)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          />
        )}

        {ITEMS.map((item, i) => {
          const at = fanAt(FAN_ANGLES[i], edge)
          return (
            <button
              key={item.key}
              type="button"
              className="lt-dock-item"
              aria-label={item.label}
              onClick={() => pick(item.event)}
              tabIndex={open ? 0 : -1}
              style={{
                ...glassCircle(DOCK_ITEM),
                position: 'fixed',
                right: at.right,
                bottom: at.bottom,
                zIndex: 951,
                cursor: 'pointer',
                pointerEvents: open ? 'auto' : 'none',
                transitionDelay: open ? `${i * 40}ms` : '0ms',
              }}
            >
              {item.icon}
              {item.key === 'notifications' && unread > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: FLOAT_PINK, color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}>{badge}</span>
              )}
            </button>
          )
        })}

        <button
          type="button"
          className="lt-dock-fab"
          aria-label={open ? 'Close quick actions' : 'Quick actions'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{
            ...glassCircle(DOCK_SIZE),
            position: 'fixed',
            right: edge,
            bottom: `calc(${edge}px + env(safe-area-inset-bottom, 0px))`,
            zIndex: 952,
            cursor: 'pointer',
          }}
        >
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={FLOAT_ICON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(135deg)' : 'rotate(0deg)', transition: 'transform .22s cubic-bezier(.2,1,.3,1)' }}>
            {open ? (
              <>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </>
            ) : (
              <>
                <circle cx="12" cy="6.6" r="2.2" />
                <circle cx="6.6" cy="16" r="2.2" />
                <circle cx="17.4" cy="16" r="2.2" />
              </>
            )}
          </svg>
          {!open && unread > 0 && (
            <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: FLOAT_PINK, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}>{badge}</span>
          )}
        </button>
      </div>
    </>
  )
}
