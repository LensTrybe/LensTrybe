import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const GREEN = '#1DB954'
const PINK = '#FF2D78'

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const bellRef = useRef(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems(data ?? [])
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [user, load])

  useEffect(() => {
    function onDoc(e) {
      if (!open) return
      if (panelRef.current && panelRef.current.contains(e.target)) return
      if (bellRef.current && bellRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const unread = items.filter((n) => !n.read).length

  async function markRead(id) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }
  async function markAll() {
    const ids = items.filter((n) => !n.read).map((n) => n.id)
    if (!ids.length) return
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', ids)
  }
  function openItem(n) {
    if (!n.read) markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  if (!user) return null

  return (
    <>
      <style>{`
        .ltn-bell { position: fixed; right: 24px; bottom: 88px; z-index: 950; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--lt-text, #14111a); background: var(--lt-glass-bg, rgba(255,255,255,0.9)); border: var(--lt-glass-border, 1px solid rgba(20,17,26,0.1)); box-shadow: var(--lt-glass-shadow, 0 10px 30px -12px rgba(40,30,60,0.35)); backdrop-filter: var(--lt-glass-blur, blur(16px)); -webkit-backdrop-filter: var(--lt-glass-blur, blur(16px)); transition: transform .12s ease; }
        .ltn-bell:hover { transform: translateY(-2px); }
        .ltn-badge { position: absolute; top: -3px; right: -3px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: ${PINK}; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .ltn-panel { position: fixed; right: 24px; bottom: 146px; z-index: 951; width: 340px; max-width: calc(100vw - 32px); max-height: 62vh; display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; background: var(--lt-modal-bg, rgba(255,255,255,0.97)); border: var(--lt-modal-border, 1px solid rgba(20,17,26,0.1)); box-shadow: var(--lt-modal-shadow, 0 24px 60px -20px rgba(40,30,60,0.35)); backdrop-filter: var(--lt-modal-blur, blur(20px)); -webkit-backdrop-filter: var(--lt-modal-blur, blur(20px)); }
        .ltn-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--lt-hairline, rgba(20,17,26,0.08)); flex-shrink: 0; }
        .ltn-title { font-size: 14px; font-weight: 800; color: var(--lt-text, #14111a); }
        .ltn-markall { background: none; border: none; color: ${GREEN}; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; padding: 0; }
        .ltn-list { overflow-y: auto; }
        .ltn-item { display: flex; gap: 10px; padding: 13px 16px; border-bottom: 1px solid var(--lt-hairline, rgba(20,17,26,0.08)); cursor: pointer; transition: background .12s ease; }
        .ltn-item:hover { background: var(--lt-surface-2, rgba(20,17,26,0.04)); }
        .ltn-dot { width: 8px; height: 8px; border-radius: 50%; background: ${GREEN}; flex-shrink: 0; margin-top: 5px; }
        .ltn-dot.read { background: transparent; }
        .ltn-empty { padding: 32px 16px; text-align: center; color: var(--lt-muted, #6b6a75); font-size: 13px; }
        @media (max-width: 767px) {
          .ltn-bell { right: 16px; bottom: 84px; }
          .ltn-panel { right: 16px; bottom: 142px; }
        }
      `}</style>

      <button ref={bellRef} type="button" className="ltn-bell" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <BellIcon />
        {unread > 0 && <span className="ltn-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="ltn-panel" ref={panelRef}>
          <div className="ltn-head">
            <span className="ltn-title">Notifications{unread > 0 ? ` (${unread})` : ''}</span>
            {unread > 0 && <button type="button" className="ltn-markall" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="ltn-list">
            {items.length === 0 ? (
              <div className="ltn-empty">You're all caught up.</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="ltn-item" onClick={() => openItem(n)}>
                  <span className={`ltn-dot${n.read ? ' read' : ''}`} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--lt-text, #14111a)', lineHeight: 1.35 }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: 12.5, color: 'var(--lt-muted, #6b6a75)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                    <div style={{ fontSize: 11, color: 'var(--lt-faint, #8a8995)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
