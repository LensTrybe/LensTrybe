import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { onCalendarChange, emitCalendarChange } from '../../lib/calendarBus'
import { FONT, SERIF, TEXT, MUTED, FAINT, GREEN, Tile, CenterModal } from './widgetKit'
import { isDemoMode, demoEvents } from '../../lib/demoMode'

const COLORS = [
  { key: 'green', v: '#1DB954' },
  { key: 'pink', v: '#FF2D78' },
  { key: 'blue', v: '#3b82f6' },
  { key: 'purple', v: '#a855f7' },
  { key: 'amber', v: '#f59e0b' },
]
const colorVal = (k) => (COLORS.find((c) => c.key === k)?.v ?? GREEN)
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TIME_OPTS = (() => { const out = []; for (let h = 0; h < 24; h++) for (const m of [0, 30]) out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`); return out })()

function ymd(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}` }
function pad(n) { return String(n).padStart(2, '0') }
function gridStart(year, month) { const first = new Date(year, month, 1); const dow = (first.getDay() + 6) % 7; return new Date(year, month, 1 - dow) }
function fmtTime(t) { if (!t) return ''; const [h, min] = t.split(':'); const hr = Number(h); const ap = hr >= 12 ? 'pm' : 'am'; const h12 = ((hr + 11) % 12) + 1; return `${h12}${min && min !== '00' ? ':' + min : ''}${ap}` }
function addHour(t) { const [h, m] = (t || '09:00').split(':').map(Number); const total = (h * 60 + m + 60) % (24 * 60); return `${pad(Math.floor(total / 60))}:${pad(total % 60)}` }

const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: TEXT, fontFamily: FONT, outline: 'none', colorScheme: 'dark' }
const ctrlBtn = { background: 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)', color: TEXT, borderRadius: 9, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, padding: '6px 10px', lineHeight: 1 }
const labelStyle = { fontSize: 11, color: MUTED, fontFamily: FONT, marginBottom: 4, display: 'block' }
const headingStyle = { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, fontFamily: FONT }

function TimeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const listRef = useRef(null)
  useEffect(() => { if (open && listRef.current) { const idx = Math.max(0, TIME_OPTS.indexOf(value)); listRef.current.scrollTop = idx * 32 - 64 } }, [open, value])
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer', color: value ? TEXT : MUTED }}>{value ? fmtTime(value) : 'Set time'}</button>
      {open ? (
        <div ref={listRef} style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, marginTop: 6, maxHeight: 176, overflowY: 'auto', background: 'rgba(24,24,32,0.98)', border: '1px solid var(--lt-input-border)', borderRadius: 10 }}>
          {TIME_OPTS.map((t) => (
            <button key={t} type="button" onClick={() => { onChange(t); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', height: 32, boxSizing: 'border-box', background: t === value ? 'rgba(29,185,84,0.2)' : 'transparent', color: t === value ? GREEN : TEXT, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: FONT }}>{fmtTime(t)}</button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function EventForm({ dateStr, initial, onSave, onDelete, onCancel }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [allDay, setAllDay] = useState(initial?.all_day ?? false)
  const [start, setStart] = useState(initial?.start_time ? initial.start_time.slice(0, 5) : '09:00')
  const [end, setEnd] = useState(initial?.end_time ? initial.end_time.slice(0, 5) : '10:00')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [invite, setInvite] = useState(Array.isArray(initial?.invitees) ? initial.invitees.join(', ') : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [color, setColor] = useState(initial?.color ?? 'green')

  function submit() {
    const v = title.trim(); if (!v) return
    const emails = invite.split(',').map((s) => s.trim()).filter(Boolean)
    onSave({ title: v, event_date: dateStr, all_day: allDay, start_time: allDay ? null : (start || null), end_time: allDay ? null : (end || null), location: location.trim() || null, invitees: emails.length ? emails : null, notes: notes.trim() || null, color }, initial?.id)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={headingStyle}>{initial ? 'Edit event' : 'New event'}</div>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" style={inputStyle} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: TEXT, fontFamily: FONT, cursor: 'pointer' }}>
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ accentColor: GREEN, width: 16, height: 16 }} /> All day
      </label>
      {!allDay ? (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><span style={labelStyle}>Starts</span><TimeSelect value={start} onChange={setStart} /></div>
          <div style={{ flex: 1 }}><span style={labelStyle}>Ends</span><TimeSelect value={end} onChange={setEnd} /></div>
        </div>
      ) : null}
      <div><span style={labelStyle}>Location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add a location" style={inputStyle} /></div>
      <div><span style={labelStyle}>Invite (emails, comma separated)</span><input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="name@email.com, ..." style={inputStyle} /></div>
      <div><span style={labelStyle}>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" style={inputStyle} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {COLORS.map((c) => (
          <button key={c.key} type="button" onClick={() => setColor(c.key)} aria-label={c.key} style={{ width: 24, height: 24, borderRadius: '50%', background: c.v, cursor: 'pointer', border: color === c.key ? '2px solid #fff' : '2px solid transparent', boxShadow: color === c.key ? `0 0 10px -2px ${c.v}` : 'none' }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {initial ? <button type="button" onClick={() => onDelete(initial)} style={{ ...ctrlBtn, color: '#e06a78', borderColor: 'rgba(224,106,120,0.4)' }}>Delete</button> : null}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={onCancel} style={ctrlBtn}>Cancel</button>
          <button type="button" onClick={submit} style={{ background: GREEN, color: '#04121f', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13.5, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>{initial ? 'Save' : 'Add event'}</button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarWidget({ userId, hostName, hostEmail }) {
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(ymd(now))
  const [form, setForm] = useState(null) // null | 'add' | eventObj

  const start = useMemo(() => gridStart(year, month), [year, month])
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), [start])
  const rangeStart = ymd(cells[0])
  const rangeEnd = ymd(cells[41])

  async function load() {
    if (!userId) return
    if (isDemoMode()) { setEvents(demoEvents().filter((e) => e.event_date >= rangeStart && e.event_date <= rangeEnd)); return }
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id', userId).gte('event_date', rangeStart).lte('event_date', rangeEnd)
    setEvents(data ?? [])
  }
  useEffect(() => { void load() }, [userId, rangeStart, rangeEnd])
  useEffect(() => onCalendarChange(() => { void load() }), [userId, rangeStart, rangeEnd])

  const byDay = useMemo(() => { const map = {}; for (const ev of events) { (map[ev.event_date] = map[ev.event_date] || []).push(ev) } return map }, [events])

  async function saveEvent(payload, id) {
    let saved
    if (id) {
      const updated = { ...payload, updated_at: new Date().toISOString() }
      setEvents((p) => p.map((x) => (x.id === id ? { ...x, ...updated } : x)))
      await supabase.from('calendar_events').update(updated).eq('id', id)
      saved = { ...updated, id }
    } else {
      const { data } = await supabase.from('calendar_events').insert({ user_id: userId, ...payload }).select().single()
      if (data) setEvents((p) => [...p, data])
      saved = data
    }
    emitCalendarChange()
    setForm(null)
    if (saved && Array.isArray(saved.invitees) && saved.invitees.length) {
      try { await supabase.functions.invoke('send-event-invite', { body: { event: saved, host: { name: hostName, email: hostEmail } } }) } catch { /* best effort */ }
    }
  }
  async function delEvent(ev) {
    setEvents((p) => p.filter((x) => x.id !== ev.id))
    await supabase.from('calendar_events').delete().eq('id', ev.id)
    emitCalendarChange()
    setForm(null)
  }

  function prev() { const d = new Date(year, month - 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()) }
  function next() { const d = new Date(year, month + 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()) }
  function goToday() { const d = new Date(); setYear(d.getFullYear()); setMonth(d.getMonth()); setSelected(ymd(d)) }

  const todayStr = ymd(new Date())
  const selDate = new Date(selected + 'T00:00:00')
  const selEvents = (byDay[selected] || []).slice().sort((a, b) => (a.all_day === b.all_day ? String(a.start_time || '').localeCompare(String(b.start_time || '')) : a.all_day ? -1 : 1))

  return (
    <>
      <Tile label={WEEKDAYS_FULL[now.getDay()]} onClick={() => setOpen(true)}>
        <div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', color: TEXT, fontFamily: FONT, lineHeight: 1 }}>{now.getDate()}</div>
          <div style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT, marginTop: 4 }}>{MONTHS[now.getMonth()]}</div>
        </div>
      </Tile>

      {open ? (
        <CenterModal title={`${MONTHS[month]} ${year}`} width={1600} onClose={() => setOpen(false)}
          headerRight={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={goToday} style={ctrlBtn}>Today</button>
              <button type="button" onClick={prev} aria-label="Previous month" style={{ ...ctrlBtn, width: 30, height: 30, padding: 0 }}>‹</button>
              <button type="button" onClick={next} aria-label="Next month" style={{ ...ctrlBtn, width: 30, height: 30, padding: 0 }}>›</button>
            </div>
          )}
        >
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Month grid */}
            <div style={{ flex: '2 1 440px', minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                {WEEKDAYS.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: MUTED, fontFamily: FONT, paddingBottom: 6 }}>{w}</div>)}
                {cells.map((dcell) => {
                  const ds = ymd(dcell)
                  const inMonth = dcell.getMonth() === month
                  const isToday = ds === todayStr
                  const isSel = ds === selected
                  const dayEvents = byDay[ds] || []
                  return (
                    <button key={ds} type="button" onClick={() => { setSelected(ds); setForm(null) }} style={{
                      minHeight: 'clamp(90px, 12vh, 150px)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 3, borderRadius: 10, cursor: 'pointer', padding: '8px 8px 6px',
                      border: isSel ? `1px solid ${GREEN}` : '1px solid var(--lt-border)',
                      background: isSel ? 'rgba(29,185,84,0.14)' : 'var(--lt-surface)',
                      opacity: inMonth ? 1 : 0.4, fontFamily: FONT, textAlign: 'left',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? GREEN : (inMonth ? TEXT : FAINT), lineHeight: 1, marginBottom: 2 }}>{dcell.getDate()}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                        {dayEvents.slice(0, 4).map((ev) => (
                          <span key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorVal(ev.color), flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                          </span>
                        ))}
                        {dayEvents.length > 4 ? <span style={{ fontSize: 10, color: FAINT }}>+{dayEvents.length - 4} more</span> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Scheduled panel */}
            <div style={{ flex: '1 1 260px', minWidth: 0, borderLeft: '1px solid var(--lt-border)', paddingLeft: 20, alignSelf: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, color: TEXT, lineHeight: 1 }}>Scheduled</div>
                  <div style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT, marginTop: 5 }}>{selDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                </div>
                {!form ? <button type="button" onClick={() => setForm('add')} aria-label="Add event" style={{ ...ctrlBtn, width: 32, height: 32, padding: 0, fontSize: 18, color: GREEN, borderColor: `${GREEN}66`, background: `${GREEN}1f` }}>+</button> : null}
              </div>

              {form ? (
                <EventForm dateStr={selected} initial={form === 'add' ? null : form} onSave={saveEvent} onDelete={delEvent} onCancel={() => setForm(null)} />
              ) : selEvents.length === 0 ? (
                <div style={{ fontSize: 13.5, color: MUTED, fontFamily: FONT, padding: '8px 0' }}>Nothing scheduled. Tap + to add.</div>
              ) : selEvents.map((ev) => {
                const c = colorVal(ev.color)
                const range = ev.all_day || !ev.start_time ? 'All day' : `${fmtTime(ev.start_time)}${ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}`
                return (
                  <button key={ev.id} type="button" onClick={() => setForm(ev)} style={{ display: 'block', width: '100%', textAlign: 'left', background: `${c}1f`, border: 'none', borderLeft: `3px solid ${c}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT, marginBottom: 2 }}>{range}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: FONT }}>{ev.title}</div>
                    {ev.location ? <div style={{ fontSize: 12, color: FAINT, fontFamily: FONT, marginTop: 2 }}>{ev.location}</div> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </CenterModal>
      ) : null}
    </>
  )
}
