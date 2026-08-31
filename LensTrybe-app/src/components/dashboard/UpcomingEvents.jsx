import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { onCalendarChange } from '../../lib/calendarBus'
import { FONT, TEXT, MUTED, FAINT, GREEN, Tile, CenterModal } from './widgetKit'
import { isDemoMode, demoEvents } from '../../lib/demoMode'

const COLORS = { green: '#1DB954', pink: '#FF2D78', blue: '#3b82f6', purple: '#a855f7', amber: '#f59e0b' }
const colorVal = (k) => COLORS[k] || GREEN

function ymd(d) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fmtTime(t) {
  if (!t) return ''
  const [h, min] = t.split(':'); const hr = Number(h); const ap = hr >= 12 ? 'pm' : 'am'; const h12 = ((hr + 11) % 12) + 1
  return `${h12}${min && min !== '00' ? ':' + min : ''}${ap}`
}

export default function UpcomingEvents({ userId }) {
  const [events, setEvents] = useState([])
  const [open, setOpen] = useState(false)

  const today = new Date()
  const startStr = ymd(today)
  const endD = new Date(today); endD.setDate(endD.getDate() + 6)
  const endStr = ymd(endD)

  async function load() {
    if (!userId) return
    if (isDemoMode()) { setEvents(demoEvents().filter((e) => e.event_date >= startStr && e.event_date <= endStr)); return }
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id', userId).gte('event_date', startStr).lte('event_date', endStr)
    setEvents(data ?? [])
  }
  useEffect(() => { void load() }, [userId, startStr, endStr])
  useEffect(() => onCalendarChange(() => { void load() }), [userId, startStr, endStr])

  const groups = useMemo(() => {
    const map = {}
    for (const ev of events) { (map[ev.event_date] = map[ev.event_date] || []).push(ev) }
    const keys = Object.keys(map).sort()
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = ymd(tomorrow)
    return keys.map((k) => {
      const dd = new Date(k + 'T00:00:00')
      let label
      if (k === startStr) label = `Today · ${dd.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`
      else if (k === tomorrowStr) label = `Tomorrow · ${dd.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`
      else label = dd.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
      const items = map[k].sort((a, b) => (a.all_day === b.all_day ? String(a.start_time || '').localeCompare(String(b.start_time || '')) : a.all_day ? -1 : 1))
      return { key: k, label, items }
    })
  }, [events, startStr])

  const count = events.length

  return (
    <>
      <Tile label="Upcoming" onClick={() => setOpen(true)}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: TEXT, fontFamily: FONT, lineHeight: 1 }}>{count}</span>
          <span style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT }}>next 7 days</span>
        </div>
      </Tile>

      {open ? (
        <CenterModal title="Upcoming" subtitle="Next 7 days" width={520} onClose={() => setOpen(false)}>
          {groups.length === 0 ? (
            <div style={{ fontSize: 14, color: MUTED, fontFamily: FONT, padding: '10px 0' }}>Nothing coming up.</div>
          ) : groups.map((g, gi) => (
            <div key={g.key}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, margin: gi === 0 ? '2px 0 8px' : '18px 0 8px' }}>{g.label}</div>
              {g.items.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--lt-surface-2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorVal(ev.color), flexShrink: 0 }} />
                  <span style={{ width: 70, flexShrink: 0, fontSize: 12.5, color: FAINT, fontFamily: FONT }}>{ev.all_day || !ev.start_time ? 'All day' : fmtTime(ev.start_time)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                    {ev.location ? <span style={{ display: 'block', fontSize: 12, color: FAINT, fontFamily: FONT }}>{ev.location}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </CenterModal>
      ) : null}
    </>
  )
}
