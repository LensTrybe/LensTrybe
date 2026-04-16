import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function AvailabilityPage() {
  const { user } = useAuth()
  const [blockedDates, setBlockedDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => { loadAvailability() }, [user])

  async function loadAvailability() {
    if (!user) return
    const { data } = await supabase
      .from('availability')
      .select('*')
      .eq('creative_id', user.id)
    setBlockedDates(data?.map(d => d.date) ?? [])
    setLoading(false)
  }

  async function toggleDate(dateStr) {
    setSaving(true)
    const isBlocked = blockedDates.includes(dateStr)
    if (isBlocked) {
      await supabase.from('availability').delete().eq('creative_id', user.id).eq('date', dateStr)
      setBlockedDates(prev => prev.filter(d => d !== dateStr))
    } else {
      await supabase.from('availability').insert({ creative_id: user.id, date: dateStr, available: false })
      setBlockedDates(prev => [...prev, dateStr])
    }
    setSaving(false)
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay()
  }

  function formatDate(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date().toISOString().split('T')[0]

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1))
  }

  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1))
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    layout: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' },
    calendarCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    calendarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    monthTitle: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', fontWeight: 400 },
    navBtn: { background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', width: '32px', height: '32px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--transition-fast)' },
    dayHeaders: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' },
    dayHeader: { textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 600, letterSpacing: '0.06em', padding: '4px 0' },
    calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' },
    dayCell: (isBlocked, isToday, isPast, isEmpty) => ({
      aspectRatio: '1',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontFamily: 'var(--font-ui)',
      cursor: isEmpty || isPast ? 'default' : 'pointer',
      background: isEmpty ? 'transparent' : isBlocked ? 'rgba(239,68,68,0.15)' : isToday ? 'var(--green-dim)' : 'var(--bg-subtle)',
      color: isEmpty ? 'transparent' : isBlocked ? 'var(--error)' : isToday ? 'var(--green)' : isPast ? 'var(--text-muted)' : 'var(--text-secondary)',
      border: isEmpty ? 'none' : isToday ? '1px solid rgba(29,185,84,0.3)' : isBlocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
      fontWeight: isToday ? 600 : 400,
      opacity: isPast ? 0.4 : 1,
      transition: 'all var(--transition-fast)',
      userSelect: 'none',
    }),
    legendCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    legendTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    legendDot: (color, bg) => ({ width: '16px', height: '16px', borderRadius: 'var(--radius-sm)', background: bg, border: `1px solid ${color}`, flexShrink: 0 }),
    blockedList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' },
    blockedItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    infoBox: { padding: '14px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 },
  }

  const upcomingBlocked = blockedDates
    .filter(d => d >= today)
    .sort()

  return (
    <div style={styles.page}>
      <div>
        <h1 style={styles.title}>Availability</h1>
        <p style={styles.subtitle}>Block dates you are unavailable. Clients won't see you in search results for blocked dates.</p>
      </div>

      <div style={styles.layout}>
        <div style={styles.calendarCard}>
          <div style={styles.calendarHeader}>
            <button style={styles.navBtn} onClick={prevMonth}>‹</button>
            <div style={styles.monthTitle}>{MONTHS[month]} {year}</div>
            <button style={styles.navBtn} onClick={nextMonth}>›</button>
          </div>

          <div>
            <div style={styles.dayHeaders}>
              {DAYS.map(d => <div key={d} style={styles.dayHeader}>{d}</div>)}
            </div>
            <div style={styles.calendarGrid}>
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} style={styles.dayCell(false, false, false, true)}>·</div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = formatDate(year, month, day)
                const isBlocked = blockedDates.includes(dateStr)
                const isToday = dateStr === today
                const isPast = dateStr < today
                return (
                  <div
                    key={day}
                    style={styles.dayCell(isBlocked, isToday, isPast, false)}
                    onClick={() => !isPast && toggleDate(dateStr)}
                    onMouseEnter={e => { if (!isPast) e.currentTarget.style.opacity = '0.75' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = isPast ? '0.4' : '1' }}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={styles.infoBox}>
            Click any future date to block or unblock it. Blocked dates are shown in red. Clients searching for a specific date will not see your profile if that date is blocked.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={styles.legendCard}>
            <div style={styles.legendTitle}>Legend</div>
            <div style={styles.legendItem}>
              <div style={styles.legendDot('rgba(29,185,84,0.3)', 'var(--green-dim)')} />
              Today
            </div>
            <div style={styles.legendItem}>
              <div style={styles.legendDot('rgba(239,68,68,0.3)', 'rgba(239,68,68,0.15)')} />
              Blocked — unavailable
            </div>
            <div style={styles.legendItem}>
              <div style={styles.legendDot('transparent', 'var(--bg-subtle)')} />
              Available
            </div>
          </div>

          <div style={styles.legendCard}>
            <div style={styles.legendTitle}>
              Blocked Dates ({upcomingBlocked.length})
            </div>
            {upcomingBlocked.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                No dates blocked. You appear as available to all clients.
              </div>
            ) : (
              <div style={styles.blockedList}>
                {upcomingBlocked.map(date => (
                  <div key={date} style={styles.blockedItem}>
                    <span>{new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <Button variant="ghost" size="sm" onClick={() => toggleDate(date)}>×</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
