// Shared building blocks so every widget tile and expanded modal uses the same
// liquid-glass design as the left sidebar.
export const FONT = "'Inter', sans-serif"
export const SERIF = "'Instrument Serif', Georgia, serif"
// Theme-aware tokens. Values come from the --lt-* CSS variables set per theme in
// DashboardLayout, so every tile, modal, chart, drawer and the sidebar flip
// together: hero-style frosted white glass + dark text in light mode, deep HUD
// glass + light text in dark mode.
export const TEXT = 'var(--lt-text)'
export const MUTED = 'var(--lt-muted)'
export const FAINT = 'var(--lt-faint)'
export const GREEN = '#1DB954'
export const PINK = '#FF2D78'
export const DANGER = '#e0556a'

// Shared inner-surface tokens (cards, inputs, borders, separators, bar tracks).
export const SURFACE = 'var(--lt-surface)'
export const SURFACE_2 = 'var(--lt-surface-2)'
export const CARD_BORDER = 'var(--lt-border)'
export const INPUT_BG = 'var(--lt-input-bg)'
export const INPUT_BORDER = 'var(--lt-input-border)'
export const HAIRLINE = 'var(--lt-hairline)'
export const TRACK = 'var(--lt-track)'

export const TILE_SIZE = 156

// Liquid glass — light frosted white (hero) or deep HUD, via CSS variables.
export const GLASS = {
  background: 'var(--lt-glass-bg)',
  backdropFilter: 'var(--lt-glass-blur)',
  WebkitBackdropFilter: 'var(--lt-glass-blur)',
  border: 'var(--lt-glass-border)',
  boxShadow: 'var(--lt-glass-shadow)',
  borderRadius: 22,
}
export const MODAL_GLASS = {
  background: 'var(--lt-modal-bg)',
  backdropFilter: 'var(--lt-modal-blur)',
  WebkitBackdropFilter: 'var(--lt-modal-blur)',
  border: 'var(--lt-modal-border)',
  boxShadow: 'var(--lt-modal-shadow)',
  borderRadius: 24,
}
export const SHEEN = 'var(--lt-sheen)'

// Uniform square tile. Shows a label (top) and any glanceable content (bottom).
export function Tile({ label, corner, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...GLASS, position: 'relative', overflow: 'hidden', width: TILE_SIZE, height: TILE_SIZE, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, appearance: 'none', WebkitAppearance: 'none' }}
    >
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', background: SHEEN, pointerEvents: 'none', borderTopLeftRadius: 22, borderTopRightRadius: 22 }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
        {corner || null}
      </div>
      <div style={{ position: 'relative' }}>{children}</div>
    </button>
  )
}

// Wide analytics tile: 3 tiles wide, 1 tile tall. Shows a KPI + trend pill and
// a mini chart (passed as children). Expands on click.
export const ANALYTICS_W = TILE_SIZE * 3 + 32 // 500

export function AnalyticsTile({ title, value, sub, trend, accent = '#a855f7', onClick, children }) {
  const hasTrend = trend !== null && trend !== undefined && !Number.isNaN(trend)
  const up = hasTrend && trend >= 0
  return (
    <button type="button" onClick={onClick} style={{ ...GLASS, position: 'relative', overflow: 'hidden', width: ANALYTICS_W, maxWidth: '100%', height: TILE_SIZE, padding: 16, display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, appearance: 'none', WebkitAppearance: 'none' }}>
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: `radial-gradient(120% 100% at 85% 0%, ${accent}44 0%, transparent 60%), ${SHEEN}`, pointerEvents: 'none', borderTopLeftRadius: 22, borderTopRightRadius: 22 }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED }}>{title}</span>
        {hasTrend ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 600, color: up ? GREEN : DANGER, background: up ? 'rgba(29,185,84,0.14)' : 'rgba(224,106,120,0.14)', border: `1px solid ${up ? 'rgba(29,185,84,0.3)' : 'rgba(224,106,120,0.3)'}`, borderRadius: 999, padding: '2px 8px' }}>{up ? '↑' : '↓'} {Math.abs(trend)}%</span>
        ) : null}
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: TEXT, lineHeight: 1 }}>{value}</span>
        {sub ? <span style={{ fontSize: 12.5, color: MUTED }}>{sub}</span> : null}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, marginTop: 6, display: 'flex', alignItems: 'flex-end' }}>{children}</div>
    </button>
  )
}

// Centered expanding modal (liquid glass). width is the desired px width.
export function CenterModal({ title, subtitle, onClose, width = 560, headerRight, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(6,6,10,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}>
      <style>{`@keyframes ltModalIn { from { opacity: 0; transform: translateY(8px) scale(0.99) } to { opacity: 1; transform: none } }`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ ...MODAL_GLASS, position: 'relative', overflow: 'hidden', width: `min(${width}px, 96vw)`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'ltModalIn 0.24s cubic-bezier(0.22,1,0.36,1)' }}>
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: SHEEN, pointerEvents: 'none', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '22px 24px 14px', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: TEXT, lineHeight: 1 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT, marginTop: 5 }}>{subtitle}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {headerRight || null}
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: TEXT, width: 32, height: 32, borderRadius: 9, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
