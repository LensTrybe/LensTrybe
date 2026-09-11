// One expandable card on the Admin page. The header always shows the title, a one-line
// summary and an optional badge, so the page reads at a glance with every card closed.
// Children stay mounted while closed (just hidden) so their data and summaries keep loading.
// Uses the theme-aware --lt-* tokens.

const GREEN = '#1DB954'
const PINK = '#FF2D78'
const AMBER = '#F5A623'

const ICONS = {
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  invite: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  support: <><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" /><path d="M12 18h.01" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z" />,
  chart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
}

function Icon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || ICONS.chart}
    </svg>
  )
}

function Badge({ badge }) {
  if (!badge || badge.text == null || badge.text === '') return null
  const color = badge.tone === 'attention' ? PINK : badge.tone === 'warning' ? AMBER : badge.tone === 'good' ? GREEN : 'var(--lt-muted)'
  const bg = badge.tone === 'attention' ? 'rgba(255,45,120,0.12)' : badge.tone === 'warning' ? 'rgba(245,166,35,0.12)' : badge.tone === 'good' ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface-2)'
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color, background: bg, whiteSpace: 'nowrap' }}>{badge.text}</span>
}

export default function AdminSection({ id, icon, title, summary, badge, open, onToggle, children }) {
  return (
    <section id={`admin-${id}`} style={{
      borderRadius: 16, overflow: 'hidden',
      background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)',
      backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)',
    }}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`admin-${id}-body`} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', color: 'var(--lt-text)',
      }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(29,185,84,0.12)', color: GREEN }}>
          <Icon name={icon} />
        </span>
        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{title}</span>
          {summary && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2, lineHeight: 1.4 }}>{summary}</span>}
        </span>
        <Badge badge={badge} />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lt-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ flexShrink: 0, transition: 'transform .18s ease', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div id={`admin-${id}-body`} hidden={!open} style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--lt-hairline)' }}>
        <div style={{ paddingTop: 14 }}>{children}</div>
      </div>
    </section>
  )
}
