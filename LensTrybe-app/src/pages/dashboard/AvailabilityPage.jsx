import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { timeText } from '../../lib/bookings'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const TIMES = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
]

function StyleBlock() {
  return (
    <style>{`
      .ltav-page { display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
      .ltav-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltav-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltav-btn-primary:hover { filter: brightness(1.06); }
      .ltav-btn-block { background: ${PINK}; color: #fff; }
      .ltav-btn-block:hover { filter: brightness(1.06); }
      .ltav-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltav-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltav-nav { background: var(--lt-input-bg); border: 1px solid var(--lt-border); border-radius: 9px; width: 34px; height: 34px; cursor: pointer; color: var(--lt-text); font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background .12s ease; }
      .ltav-nav:hover { background: var(--lt-surface-2); }
      .ltav-day { aspect-ratio: 1; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13.5px; position: relative; transition: background .1s ease, border-color .1s ease; }
      .ltav-select { width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-input-border); }
      .ltav-select:focus { border-color: ${GREEN}; }
      .ltav-input { width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-input-border); box-sizing: border-box; }
      .ltav-input:focus { border-color: ${GREEN}; }
      .ltav-input::placeholder { color: var(--lt-faint); }
      .ltav-toggle { flex: 1; padding: 10px; border-radius: 10px; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 700; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); transition: all .12s ease; }
      .ltav-toggle.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltav-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltav-modal { width: 100%; max-width: 460px; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); overflow: hidden; }
      .ltav-mhead { padding: 16px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; }
      @media (max-width: 767px) {
        .ltav-overlay { padding: 16px; }
        .ltav-page button { min-height: 40px; }
        .ltav-nav { min-height: 34px; }
      }
    `}</style>
  )
}

export default function AvailabilityPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [blockedDates, setBlockedDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [timeForm, setTimeForm] = useState({ all_day: true, start_time: '09:00', end_time: '17:00', notes: '' })
  const [toast, setToast] = useState(null)
  const [bookings, setBookings] = useState([])
  const navigate = useNavigate()

  useEffect(() => { loadAvailability() }, [user])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadAvailability() {
    if (!user) return
    const [{ data }, { data: bk }] = await Promise.all([
      supabase.from('availability').select('*').eq('creative_id', user.id),
      supabase.from('bookings').select('id, booking_date, all_day, start_time, end_time, client_name, service').eq('creative_id', user.id).eq('status', 'confirmed').not('booking_date', 'is', null),
    ])
    setBlockedDates(data ?? [])
    setBookings(bk ?? [])
    setLoading(false)
  }

  function getBlockForDate(dateStr) {
    return blockedDates.find(d => d.date === dateStr)
  }

  async function blockDate(dateStr) {
    setSaving(true)
    const payload = {
      creative_id: user.id,
      date: dateStr,
      is_available: false,
      all_day: timeForm.all_day,
      start_time: timeForm.all_day ? null : timeForm.start_time,
      end_time: timeForm.all_day ? null : timeForm.end_time,
      notes: timeForm.notes || null,
    }
    const { data, error } = await supabase.from('availability').insert(payload).select().single()
    if (!error) {
      setBlockedDates(prev => [...prev, data])
      showToast('Date blocked')
    } else {
      showToast(error.message, 'error')
    }
    setShowTimeModal(false)
    setSaving(false)
  }

  async function unblockDate(dateStr) {
    setSaving(true)
    const { error } = await supabase.from('availability').delete().eq('creative_id', user.id).eq('date', dateStr)
    if (!error) {
      setBlockedDates(prev => prev.filter(d => d.date !== dateStr))
      showToast('Date unblocked')
    }
    setSaving(false)
  }

  function handleDayClick(dateStr, isPast) {
    if (isPast) return
    const existing = getBlockForDate(dateStr)
    if (existing) {
      unblockDate(dateStr)
    } else {
      setSelectedDate(dateStr)
      setTimeForm({ all_day: true, start_time: '09:00', end_time: '17:00', notes: '' })
      setShowTimeModal(true)
    }
  }

  function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }
  function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay() }
  function formatDate(y, m, day) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date().toISOString().split('T')[0]
  const upcomingBlocked = blockedDates.filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const bookingsByDate = useMemo(() => {
    const m = {}
    for (const b of bookings) (m[b.booking_date] = m[b.booking_date] || []).push(b)
    return m
  }, [bookings])
  const upcomingBookings = bookings.filter(b => b.booking_date >= today).sort((a, b) => a.booking_date.localeCompare(b.booking_date))

  const stats = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return {
      upcoming: upcomingBlocked.length,
      thisMonth: blockedDates.filter(d => d.date.startsWith(monthPrefix)).length,
    }
  }, [blockedDates, upcomingBlocked, year, month])

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18, padding: isMobile ? 16 : 20 }
  const stat = { ...GLASS, flex: '1 1 150px', borderRadius: 16, padding: '16px 18px' }
  const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--lt-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }

  function dayStyle(isBlocked, isToday, isPast, isEmpty) {
    return {
      cursor: isEmpty || isPast ? 'default' : 'pointer',
      background: isEmpty ? 'transparent' : isBlocked ? 'rgba(255,45,120,0.14)' : isToday ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface-2)',
      color: isEmpty ? 'transparent' : isBlocked ? PINK : isToday ? GREEN : isPast ? 'var(--lt-faint)' : 'var(--lt-text)',
      border: isEmpty ? '1px solid transparent' : isToday ? `1px solid rgba(29,185,84,0.4)` : isBlocked ? `1px solid rgba(255,45,120,0.4)` : '1px solid var(--lt-hairline)',
      opacity: isPast && !isEmpty ? 0.45 : 1,
      fontWeight: isToday || isBlocked ? 700 : 500,
    }
  }

  return (
    <>
      <StyleBlock />
      <div className="ltav-page">
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : PINK, color: toast.type === 'success' ? GREEN_DARK : '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
            {toast.msg}
          </div>
        )}

        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Availability</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Block the dates or time slots you're unavailable. Confirmed bookings show here automatically, and clients can't request times that are blocked or booked.</p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: stats.upcoming ? PINK : 'var(--lt-text)' }}>{stats.upcoming}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Upcoming blocked</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{stats.thisMonth}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Blocked in {MONTHS[month]}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 20, alignItems: 'start' }}>
          {/* Calendar */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <button type="button" className="ltav-nav" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>‹</button>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lt-text)' }}>{MONTHS[month]} {year}</div>
              <button type="button" className="ltav-nav" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 5 }}>
              {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--lt-faint)', fontWeight: 700, padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="ltav-day" style={dayStyle(false, false, false, true)} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = formatDate(year, month, day)
                const block = getBlockForDate(dateStr)
                const isBlocked = !!block
                const isToday = dateStr === today
                const isPast = dateStr < today
                const dayBookings = bookingsByDate[dateStr] || []
                return (
                  <div
                    key={day}
                    className="ltav-day"
                    style={dayStyle(isBlocked, isToday, isPast, false)}
                    onClick={() => handleDayClick(dateStr, isPast)}
                    title={[block ? (block.all_day ? 'Blocked all day' : `Blocked ${block.start_time} to ${block.end_time}`) : '', ...dayBookings.map(b => `Booked: ${b.client_name || 'Client'}, ${timeText(b)}`)].filter(Boolean).join('\n')}
                  >
                    {day}
                    {dayBookings.length > 0 && <div style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: GREEN, boxShadow: '0 0 0 2px var(--lt-surface-2)' }} />}
                    {isBlocked && !block.all_day && <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: PINK }} />}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-hairline)', borderRadius: 12, fontSize: 12.5, color: 'var(--lt-muted)', lineHeight: 1.6 }}>
              Click a date to block it. Click a blocked date (pink) to unblock it.
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)', marginBottom: 12 }}>Legend</div>
              {[
                { border: 'rgba(29,185,84,0.4)', bg: 'rgba(29,185,84,0.12)', label: 'Today' },
                { border: 'rgba(255,45,120,0.4)', bg: 'rgba(255,45,120,0.14)', label: 'Blocked' },
                { dot: true, label: 'Has a confirmed booking' },
                { border: 'var(--lt-hairline)', bg: 'var(--lt-surface-2)', label: 'Available' },
              ].map(({ border, bg, label, dot }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--lt-muted)', marginBottom: 9 }}>
                  {dot
                    ? <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} /></div>
                    : <div style={{ width: 16, height: 16, borderRadius: 5, background: bg, border: `1px solid ${border}`, flexShrink: 0 }} />}
                  {label}
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)' }}>Booked ({upcomingBookings.length})</span>
                <button type="button" onClick={() => navigate('/dashboard/my-work/my-bookings')} style={{ background: 'none', border: 'none', color: GREEN, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>All bookings</button>
              </div>
              {upcomingBookings.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>No upcoming bookings.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {upcomingBookings.slice(0, 20).map(b => (
                    <div key={b.id} onClick={() => navigate(`/dashboard/my-work/my-bookings?booking=${b.id}`)} style={{ padding: '9px 12px', background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.25)', borderRadius: 10, cursor: 'pointer' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--lt-text)' }}>{new Date(b.booking_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} · {timeText(b)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--lt-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.client_name || 'Client'}{b.service ? `, ${b.service}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)', marginBottom: 12 }}>Blocked ({upcomingBlocked.length})</div>
              {loading ? (
                <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>Loading…</div>
              ) : upcomingBlocked.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>No dates blocked.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {upcomingBlocked.map(block => (
                    <div key={block.id} style={{ padding: '9px 12px', background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.22)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--lt-text)' }}>
                            {new Date(block.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--lt-muted)' }}>
                            {block.all_day ? 'All day' : `${block.start_time} – ${block.end_time}`}
                          </div>
                          {block.notes && <div style={{ fontSize: 11.5, color: 'var(--lt-faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.notes}</div>}
                        </div>
                        <button type="button" onClick={() => unblockDate(block.date)} style={{ background: 'none', border: 'none', color: PINK, fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Block date modal */}
      {showTimeModal && selectedDate && (
        <div className="ltav-overlay" onClick={() => setShowTimeModal(false)}>
          <div className="ltav-modal" onClick={e => e.stopPropagation()}>
            <div className="ltav-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>Block date</span>
              <button type="button" onClick={() => setShowTimeModal(false)} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 13.5, color: 'var(--lt-muted)' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>

              <div>
                <label style={labelStyle}>Block type</label>
                <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                  <button type="button" className={`ltav-toggle${timeForm.all_day ? ' on' : ''}`} onClick={() => setTimeForm(p => ({ ...p, all_day: true }))}>All day</button>
                  <button type="button" className={`ltav-toggle${!timeForm.all_day ? ' on' : ''}`} onClick={() => setTimeForm(p => ({ ...p, all_day: false }))}>Time slot</button>
                </div>
              </div>

              {!timeForm.all_day && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Start time</label>
                    <select className="ltav-select" value={timeForm.start_time} onChange={e => setTimeForm(p => ({ ...p, start_time: e.target.value }))}>
                      {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>End time</label>
                    <select className="ltav-select" value={timeForm.end_time} onChange={e => setTimeForm(p => ({ ...p, end_time: e.target.value }))}>
                      {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <input className="ltav-input" value={timeForm.notes} onChange={e => setTimeForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Holiday, existing booking" />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ltav-btn ltav-btn-ghost" onClick={() => setShowTimeModal(false)}>Cancel</button>
                <button type="button" className="ltav-btn ltav-btn-block" onClick={() => blockDate(selectedDate)} disabled={saving} style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Blocking…' : 'Block date'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
