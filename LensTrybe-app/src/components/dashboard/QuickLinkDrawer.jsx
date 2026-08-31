import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { onCalendarChange } from '../../lib/calendarBus'
import { isDemoMode, demoEvents } from '../../lib/demoMode'

const FONT = "'Inter', sans-serif"
const SERIF = "'Instrument Serif', Georgia, serif"

// Matches the left sidebar's liquid glass — theme-aware via the shared --lt-* vars.
const PANEL_GLASS = {
  background: 'var(--lt-modal-bg)',
  backdropFilter: 'var(--lt-modal-blur)',
  WebkitBackdropFilter: 'var(--lt-modal-blur)',
  border: 'var(--lt-modal-border)',
  boxShadow: 'var(--lt-modal-shadow)',
  borderRadius: 24,
}
const SHEEN = 'var(--lt-sheen)'
const TEXT = 'var(--lt-text)'
const MUTED = 'var(--lt-muted)'
const FAINT = 'var(--lt-faint)'
const GREEN = '#1DB954'
const PINK = '#FF2D78'
const DANGER = '#e06a78'

const COLORS = { green: '#1DB954', pink: '#FF2D78', blue: '#3b82f6', purple: '#a855f7', amber: '#f59e0b' }
const colorVal = (k) => COLORS[k] || GREEN

const LINK_TITLES = {
  enquiries: 'Enquiries',
  messages: 'Messages',
  calendar: 'This week',
  bookings: 'Bookings',
  invoices: 'Invoices',
}

function ymd(d) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fmtTime(t) {
  if (!t) return ''
  const [h, min] = t.split(':')
  const hr = Number(h); const ap = hr >= 12 ? 'pm' : 'am'; const h12 = ((hr + 11) % 12) + 1
  return `${h12}${min && min !== '00' ? ':' + min : ''}${ap}`
}
function timeAgo(v) {
  if (!v) return ''
  const s = Math.max(1, Math.floor((Date.now() - new Date(v).getTime()) / 1000))
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
function currency(n) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(n || 0))
}
function niceDate(v) {
  return new Date(v + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, margin: '18px 0 8px' }
const emptyStyle = { fontSize: 13.5, color: MUTED, fontFamily: FONT, padding: '10px 0' }
const rowBtn = { display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--lt-hairline)', cursor: 'pointer' }
const linkStyle = { marginTop: 16, background: 'none', border: 'none', color: GREEN, fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', padding: 0 }

function Row({ dot, title, sub, right, onClick }) {
  return (
    <button type="button" onClick={onClick} style={rowBtn}>
      {dot ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, boxShadow: `0 0 8px ${dot}` }} /> : null}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        {sub ? <span style={{ display: 'block', fontSize: 12, color: FAINT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span> : null}
      </span>
      {right ? <span style={{ flexShrink: 0, fontSize: 12.5, color: MUTED, fontFamily: FONT }}>{right}</span> : null}
    </button>
  )
}

function ThreadsContent({ userId, onlyUnread, navigate }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!userId) return
    let q = supabase.from('message_threads').select('id, client_name, nickname, subject, unread_count, last_message_at').eq('creative_id', userId).order('last_message_at', { ascending: false })
    if (onlyUnread) q = q.gt('unread_count', 0)
    else q = q.limit(40)
    q.then(({ data }) => setRows(data ?? []))
  }, [userId, onlyUnread])

  if (rows === null) return <div style={emptyStyle}>Loading…</div>
  if (rows.length === 0) return <div style={emptyStyle}>{onlyUnread ? 'No new enquiries right now.' : 'No conversations yet.'}</div>
  return (
    <>
      {rows.map((th) => (
        <Row key={th.id}
          dot={th.unread_count > 0 ? PINK : 'rgba(255,255,255,0.2)'}
          title={th.nickname || th.client_name || 'Client'}
          sub={th.subject || null}
          right={timeAgo(th.last_message_at)}
          onClick={() => navigate('/dashboard/clients/messages')}
        />
      ))}
      <button type="button" onClick={() => navigate('/dashboard/clients/messages')} style={linkStyle}>Open messages →</button>
    </>
  )
}

function CalendarContent({ userId }) {
  const [events, setEvents] = useState(null)
  const week = useMemo(() => {
    const now = new Date()
    const dow = (now.getDay() + 6) % 7 // Monday = 0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
    const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
    return { start: ymd(days[0]), end: ymd(days[6]), days }
  }, [])
  useEffect(() => {
    if (!userId) return
    function load() {
      if (isDemoMode()) { setEvents(demoEvents().filter((e) => e.event_date >= week.start && e.event_date <= week.end)); return }
      supabase.from('calendar_events').select('*').eq('user_id', userId).gte('event_date', week.start).lte('event_date', week.end)
        .then(({ data }) => setEvents(data ?? []))
    }
    load()
    return onCalendarChange(load)
  }, [userId, week.start, week.end])

  if (events === null) return <div style={emptyStyle}>Loading…</div>
  const todayStr = ymd(new Date())
  return (
    <>
      {week.days.map((d) => {
        const ds = ymd(d)
        const dayEvents = events.filter((e) => e.event_date === ds).sort((a, b) => (a.all_day === b.all_day ? String(a.start_time || '').localeCompare(String(b.start_time || '')) : a.all_day ? -1 : 1))
        return (
          <div key={ds}>
            <div style={{ ...sectionLabel, color: ds === todayStr ? GREEN : FAINT }}>{ds === todayStr ? 'Today · ' : ''}{d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
            {dayEvents.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', fontFamily: FONT, padding: '2px 0 4px' }}>—</div>
            ) : dayEvents.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: '1px solid var(--lt-surface-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorVal(ev.color), flexShrink: 0 }} />
                <span style={{ width: 66, flexShrink: 0, fontSize: 12, color: FAINT, fontFamily: FONT }}>{ev.all_day || !ev.start_time ? 'All day' : fmtTime(ev.start_time)}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13.5, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                  {ev.location ? <span style={{ display: 'block', fontSize: 11.5, color: FAINT, fontFamily: FONT }}>{ev.location}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function BookingsContent({ userId, navigate }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('bookings').select('id, client_name, service, booking_date, status').eq('creative_id', userId).order('booking_date', { ascending: true })
      .then(({ data }) => setRows(data ?? []))
  }, [userId])

  if (rows === null) return <div style={emptyStyle}>Loading…</div>
  if (rows.length === 0) return <div style={emptyStyle}>No bookings yet.</div>
  const todayStr = ymd(new Date())
  const upcoming = rows.filter((b) => b.booking_date && b.booking_date >= todayStr)
  const past = rows.filter((b) => !b.booking_date || b.booking_date < todayStr).reverse()
  return (
    <>
      <div style={sectionLabel}>Upcoming</div>
      {upcoming.length === 0 ? <div style={emptyStyle}>No upcoming bookings.</div> : upcoming.map((b) => (
        <Row key={b.id} dot={GREEN} title={b.client_name || 'Client'} sub={b.service || (b.status || 'Booking')} right={b.booking_date ? niceDate(b.booking_date) : ''} onClick={() => navigate('/dashboard/my-work/my-bookings')} />
      ))}
      {past.length > 0 ? (
        <>
          <div style={sectionLabel}>Recent</div>
          {past.slice(0, 8).map((b) => (
            <Row key={b.id} dot={'rgba(255,255,255,0.2)'} title={b.client_name || 'Client'} sub={b.service || (b.status || 'Booking')} right={b.booking_date ? niceDate(b.booking_date) : ''} onClick={() => navigate('/dashboard/my-work/my-bookings')} />
          ))}
        </>
      ) : null}
      <button type="button" onClick={() => navigate('/dashboard/my-work/my-bookings')} style={linkStyle}>Open bookings →</button>
    </>
  )
}

function InvoicesContent({ userId, navigate }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('invoices').select('id, client_name, amount, status, due_date, created_at').eq('creative_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [userId])

  if (rows === null) return <div style={emptyStyle}>Loading…</div>
  const todayStr = ymd(new Date())
  const isPaid = (s) => String(s || '').toLowerCase() === 'paid'
  const unpaid = rows.filter((i) => !isPaid(i.status))
  const outstanding = unpaid.reduce((s, i) => s + Number(i.amount || 0), 0)
  const overdue = unpaid.filter((i) => i.due_date && i.due_date < todayStr)

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT }}>Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: overdue.length ? DANGER : TEXT, fontFamily: FONT, letterSpacing: '-0.02em' }}>{currency(outstanding)}</div>
          <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT }}>{overdue.length ? `${overdue.length} overdue` : `${unpaid.length} unpaid`}</div>
        </div>
      </div>
      <div style={sectionLabel}>Unpaid</div>
      {unpaid.length === 0 ? <div style={emptyStyle}>Nothing outstanding. Nice.</div> : unpaid.map((i) => {
        const od = i.due_date && i.due_date < todayStr
        return (
          <Row key={i.id} dot={od ? DANGER : '#f59e0b'} title={i.client_name || 'Client'} sub={i.due_date ? `Due ${niceDate(i.due_date)}${od ? ' · overdue' : ''}` : (i.status || 'Sent')} right={currency(i.amount)} onClick={() => navigate('/dashboard/finance/invoicing')} />
        )
      })}
      <button type="button" onClick={() => navigate('/dashboard/finance/invoicing')} style={linkStyle}>Open invoicing →</button>
    </>
  )
}

export default function QuickLinkDrawer({ linkId, userId, onClose }) {
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function go(path) { onClose(); navigate(path) }

  let content = null
  if (linkId === 'enquiries') content = <ThreadsContent userId={userId} onlyUnread navigate={go} />
  else if (linkId === 'messages') content = <ThreadsContent userId={userId} onlyUnread={false} navigate={go} />
  else if (linkId === 'calendar') content = <CalendarContent userId={userId} />
  else if (linkId === 'bookings') content = <BookingsContent userId={userId} navigate={go} />
  else if (linkId === 'invoices') content = <InvoicesContent userId={userId} navigate={go} />

  return (
    <>
      <style>{`@keyframes ltDrawerIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(6,6,10,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'flex-end', padding: 16, boxSizing: 'border-box' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...PANEL_GLASS, position: 'relative', overflow: 'hidden', width: 'min(420px, 92vw)', height: '100%', display: 'flex', flexDirection: 'column', animation: 'ltDrawerIn 0.28s cubic-bezier(0.22,1,0.36,1)' }}>
          <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '42%', background: SHEEN, pointerEvents: 'none', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 12px', flexShrink: 0 }}>
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: TEXT, lineHeight: 1 }}>{LINK_TITLES[linkId] || 'Details'}</div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'var(--lt-border)', border: '1px solid var(--lt-input-border)', color: TEXT, width: 32, height: 32, borderRadius: 9, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 28px' }}>
            {content}
          </div>
        </div>
      </div>
    </>
  )
}
