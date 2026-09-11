import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

// Broadcast messages from the LensTrybe team (sent from Admin > Broadcast).
//  * Banner style: a slim bar at the top of the dashboard until dismissed.
//  * Card style: a card in the middle of the screen until they tap Got it.
//  * Both also sit in the notification bell; tapping one there re-opens it (?broadcast=id).
// Mounted in the creative DashboardLayout and the client dashboard. Theme-aware through the
// --lt-* tokens, with light fallbacks for the client dashboard.

const GREEN = '#1DB954'
const PINK = '#FF2D78'
const POLL_MS = 60000

function MegaphoneIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function ctaButtonStyle() {
  return { padding: '8px 16px', borderRadius: 10, border: 'none', background: GREEN, color: '#04120a', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
}

// Slim bar across the top of the dashboard.
export function BroadcastBanner({ b, onDismiss, onCta }) {
  const [expanded, setExpanded] = useState(false)
  const long = (b.body || '').length > 160 || (b.body || '').includes('\n')
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', marginBottom: 12, borderRadius: 14,
      border: '1.5px solid rgba(29,185,84,0.45)', background: 'rgba(29,185,84,0.08)',
      color: 'var(--lt-text, #14111a)', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', width: '100%',
    }}>
      <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(29,185,84,0.16)', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MegaphoneIcon size={16} /></span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{b.title}</div>
        <div style={{
          fontSize: 13.5, lineHeight: 1.5, color: 'var(--lt-muted, #55535e)', marginTop: 2, whiteSpace: 'pre-wrap',
          ...(expanded || !long ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}>{b.body}</div>
        {long && (
          <button type="button" onClick={() => setExpanded((e) => !e)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        {b.cta_label && b.cta_url && <div style={{ marginTop: 10 }}><button type="button" style={ctaButtonStyle()} onClick={() => onCta(b)}>{b.cta_label}</button></div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        <button type="button" aria-label="Dismiss" onClick={() => onDismiss(b)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--lt-muted, #55535e)', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>×</button>
      </div>
    </div>
  )
}

// Card in the middle of the screen.
export function BroadcastCard({ b, onDismiss, onCta, inline = false }) {
  const panel = (
    <div role="dialog" aria-modal={inline ? undefined : 'true'} aria-labelledby={`bc-title-${b.id}`} onClick={(e) => e.stopPropagation()} style={{
      width: '100%', maxWidth: 460, boxSizing: 'border-box', borderRadius: 20, padding: '26px 26px 22px',
      background: 'var(--lt-modal-bg, #ffffff)', border: 'var(--lt-modal-border, 1px solid rgba(20,17,26,0.1))',
      boxShadow: 'var(--lt-modal-shadow, 0 30px 80px -24px rgba(20,17,26,0.45))', backdropFilter: 'var(--lt-modal-blur, none)', WebkitBackdropFilter: 'var(--lt-modal-blur, none)',
      color: 'var(--lt-text, #14111a)', fontFamily: 'Inter, sans-serif', textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(29,185,84,0.14)', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MegaphoneIcon /></span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: PINK }}>From the LensTrybe team</span>
      </div>
      <h2 id={`bc-title-${b.id}`} style={{ margin: '0 0 10px', fontSize: 20, lineHeight: 1.3, fontWeight: 800 }}>{b.title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--lt-muted, #55535e)', whiteSpace: 'pre-wrap', maxHeight: '45vh', overflowY: 'auto' }}>{b.body}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onDismiss(b)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--lt-border, rgba(20,17,26,0.14))', background: 'transparent', color: 'var(--lt-text, #14111a)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Got it</button>
        {b.cta_label && b.cta_url && <button type="button" style={{ ...ctaButtonStyle(), padding: '9px 18px', fontSize: 13.5 }} onClick={() => onCta(b)}>{b.cta_label}</button>}
      </div>
    </div>
  )
  if (inline) return panel
  return (
    <div onClick={() => onDismiss(b)} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(5,5,10,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {panel}
    </div>
  )
}

// Loads the signed-in person's broadcasts. Render <BroadcastHost /> where banners belong;
// cards float over the page.
export default function BroadcastHost({ bannerWrapStyle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [reopened, setReopened] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_broadcasts')
    if (!error) setItems(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  // Opened from the bell: ?broadcast=<id> shows it as a card, even if dismissed earlier.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const id = params.get('broadcast')
    if (!id) return
    params.delete('broadcast')
    const qs = params.toString()
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true })
    ;(async () => {
      const { data } = await supabase.rpc('get_broadcast', { p_id: id })
      const row = Array.isArray(data) ? data[0] : null
      if (row) setReopened(row)
    })()
  }, [location.search, location.pathname, navigate])

  function dismiss(b) {
    setItems((prev) => prev.filter((x) => x.id !== b.id))
    if (reopened?.id === b.id) setReopened(null)
    void supabase.rpc('dismiss_broadcast', { p_id: b.id })
  }

  function cta(b) {
    dismiss(b)
    const url = String(b.cta_url || '')
    if (url.startsWith('/')) navigate(url)
    else if (url.startsWith('https://')) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const banners = items.filter((b) => b.style !== 'card')
  const card = reopened || items.find((b) => b.style === 'card') || null

  return (
    <>
      {banners.length > 0 && (
        <div style={bannerWrapStyle}>
          {banners.map((b) => <BroadcastBanner key={b.id} b={b} onDismiss={dismiss} onCta={cta} />)}
        </div>
      )}
      {card && <BroadcastCard b={card} onDismiss={dismiss} onCta={cta} />}
    </>
  )
}
