import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import { LT_DASHBOARD_SELECT_CLASS, LT_DASHBOARD_SELECT_STYLE, LtDashboardSelectDarkStyles } from '../../lib/dashboardSelectDark'
import Button from '../../components/ui/Button'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const TIMES = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
]

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

  useEffect(() => { loadAvailability() }, [user])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadAvailability() {
    if (!user) return
    const { data } = await supabase.from('availability').select('*').eq('creative_id', user.id)
    setBlockedDates(data ?? [])
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

  function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
  function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay() }
  function formatDate(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date().toISOString().split('T')[0]
  const upcomingBlocked = blockedDates.filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  const s = {
    page: { background: 'transparent', padding: isMobile ? '16px' : '32px 40px', display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-ui)', overflowX: 'hidden' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    layout: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: '24px', alignItems: 'start' },
    card: { ...GLASS_CARD, borderRadius: '12px', padding: '16px' },
    navBtn: { background: 'none', border: '1px solid var(--border-default)', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    dayCell: (isBlocked, isToday, isPast, isEmpty) => ({
      aspectRatio: '1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', cursor: isEmpty || isPast ? 'default' : 'pointer',
      background: isEmpty ? 'transparent' : isBlocked ? 'rgba(239,68,68,0.15)' : isToday ? 'rgba(29,185,84,0.1)' : 'var(--bg-base)',
      color: isEmpty ? 'transparent' : isBlocked ? '#ef4444' : isToday ? '#1DB954' : isPast ? 'var(--text-muted)' : 'var(--text-secondary)',
      border: isEmpty ? 'none' : isToday ? '1px solid rgba(29,185,84,0.3)' : isBlocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
      opacity: isPast && !isEmpty ? 0.4 : 1,
      fontWeight: isToday ? 600 : 400,
      transition: 'all 0.1s',
    }),
    modal: { position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' },
    modalBox: { ...GLASS_MODAL_PANEL, borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100vw' : '440px', minHeight: isMobile ? '100vh' : 'auto', padding: isMobile ? '16px' : '28px' },
    label: { ...TYPO.label, fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' },
    select: { ...LT_DASHBOARD_SELECT_STYLE, width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' },
    input: { ...GLASS_NATIVE_FIELD, width: '100%', padding: '9px 12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box' },
  }

  return (
    <div style={s.page} className="availability-page">
      <LtDashboardSelectDarkStyles />
      <style>{`
        @media (max-width: 767px) {
          .availability-page button { min-height: 44px; }
          .availability-page input, .availability-page textarea, .availability-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 style={s.title}>Availability</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Block dates or time slots you're unavailable. Clients won't see you in search results for blocked dates.</p>
      </div>

      <div style={s.layout}>
        {/* Calendar */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button type="button" style={s.navBtn} onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>‹</button>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)' }}>{MONTHS[month]} {year}</div>
            <button type="button" style={s.navBtn} onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 0' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={s.dayCell(false, false, false, true)} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = formatDate(year, month, day)
              const block = getBlockForDate(dateStr)
              const isBlocked = !!block
              const isToday = dateStr === today
              const isPast = dateStr < today
              return (
                <div
                  key={day}
                  style={{ ...s.dayCell(isBlocked, isToday, isPast, false), position: 'relative' }}
                  onClick={() => handleDayClick(dateStr, isPast)}
                  title={block ? (block.all_day ? 'Blocked all day' : `Blocked ${block.start_time} – ${block.end_time}`) : ''}
                >
                  {day}
                  {isBlocked && !block.all_day && <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '16px', padding: '12px 14px', ...GLASS_CARD, borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Click a date to block it. Click a blocked date (red) to unblock it.
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Legend */}
          <div style={s.card}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Legend</div>
            {[
              { color: 'rgba(29,185,84,0.3)', bg: 'rgba(29,185,84,0.1)', label: 'Today' },
              { color: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.15)', label: 'Blocked' },
              { color: 'transparent', bg: 'var(--bg-base)', label: 'Available' },
            ].map(({ color, bg, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: bg, border: `1px solid ${color}`, flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>

          {/* Blocked list */}
          <div style={s.card}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Blocked ({upcomingBlocked.length})</div>
            {upcomingBlocked.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No dates blocked.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {upcomingBlocked.map(block => (
                  <div key={block.id} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {new Date(block.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {block.all_day ? 'All day' : `${block.start_time} – ${block.end_time}`}
                        </div>
                        {block.notes && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{block.notes}</div>}
                      </div>
                      <button type="button" onClick={() => unblockDate(block.date)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Time block modal */}
      {showTimeModal && selectedDate && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Block Date</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Block type</label>
              <div style={{ display: 'flex', gap: '8px', flexDirection: isMobile ? 'column' : 'row' }}>
                <button
                  type="button"
                  onClick={() => setTimeForm(p => ({ ...p, all_day: true }))}
                  style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${timeForm.all_day ? '#1DB954' : 'var(--border-default)'}`, background: timeForm.all_day ? 'rgba(29,185,84,0.1)' : 'var(--bg-base)', color: timeForm.all_day ? '#1DB954' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600 }}
                >All Day</button>
                <button
                  type="button"
                  onClick={() => setTimeForm(p => ({ ...p, all_day: false }))}
                  style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${!timeForm.all_day ? '#1DB954' : 'var(--border-default)'}`, background: !timeForm.all_day ? 'rgba(29,185,84,0.1)' : 'var(--bg-base)', color: !timeForm.all_day ? '#1DB954' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600 }}
                >Time Slot</button>
              </div>
            </div>

            {!timeForm.all_day && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={s.label}>Start time</label>
                  <select className={LT_DASHBOARD_SELECT_CLASS} style={s.select} value={timeForm.start_time} onChange={e => setTimeForm(p => ({ ...p, start_time: e.target.value }))}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>End time</label>
                  <select className={LT_DASHBOARD_SELECT_CLASS} style={s.select} value={timeForm.end_time} onChange={e => setTimeForm(p => ({ ...p, end_time: e.target.value }))}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={s.label}>Notes (optional)</label>
              <input style={s.input} value={timeForm.notes} onChange={e => setTimeForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Holiday, existing booking..." />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowTimeModal(false)} style={{ padding: '9px 18px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Cancel</button>
              <button type="button" onClick={() => blockDate(selectedDate)} disabled={saving} style={{ padding: '9px 18px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Blocking…' : 'Block Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
