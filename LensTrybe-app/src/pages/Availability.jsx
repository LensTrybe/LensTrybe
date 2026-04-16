import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

/* eslint-disable no-unused-vars -- calendar helpers kept for upcoming UI iterations */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_MON_START = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const THEME = {
  pageBg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  subtitle: '#666',
  muted: '#555',
  label: '#888',
  cardBg: '#13131a',
  cardBorder: '1px solid #20202740',
  controlBg: '#1a1a24',
  controlBorder: '#202027',
  green: '#39ff14',
  red: '#f87171',
}

function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthRangeISO(year, monthIndex) {
  const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
  const last = new Date(year, monthIndex + 1, 0)
  const end = toISODate(last)
  return { start, end }
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const startWeekday = first.getDay()
  const cells = []
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ kind: 'pad', key: `pad-${i}` })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day)
    cells.push({ kind: 'day', key: toISODate(date), date })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ kind: 'pad', key: `trail-${cells.length}` })
  }
  return cells
}

function monthTitle(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function mondayIndexFromSundayIndex(sunIdx) {
  return (sunIdx + 6) % 7
}

function buildMonthCellsMonStart(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const startWeekdaySun = first.getDay()
  const startWeekdayMon = mondayIndexFromSundayIndex(startWeekdaySun)
  const cells = []
  for (let i = 0; i < startWeekdayMon; i += 1) {
    cells.push({ kind: 'pad', key: `pad-${i}` })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day)
    cells.push({ kind: 'day', key: toISODate(date), date })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ kind: 'pad', key: `trail-${cells.length}` })
  }
  return cells
}

function CalendarEmptyIcon() {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ display: 'block', margin: '0 auto 14px' }}
    >
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" stroke="#666" strokeWidth="1.2" />
      <path d="M3.5 9.5h17" stroke="#666" strokeWidth="1.2" />
      <path d="M8 3.5v4M16 3.5v4" stroke="#666" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function parseSlotTimes(notes) {
  const raw = String(notes ?? '').trim()
  if (!raw) {
    return { start: '—', end: '—' }
  }
  const pipe = raw.split('|')
  if (pipe.length === 2 && pipe[0] && pipe[1]) {
    return { start: pipe[0].trim(), end: pipe[1].trim() }
  }
  return { start: '—', end: '—', extra: raw }
}

async function upsertAvailability({ userId, date, isAvailable, notes }) {
  const payload = {
    creative_id: userId,
    date,
    is_available: isAvailable,
    notes: notes?.trim() ? notes.trim() : null,
  }

  const { data: existing, error: selectError } = await supabase
    .from('availability')
    .select('id')
    .eq('creative_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('availability')
      .update({
        is_available: isAvailable,
        notes: payload.notes,
      })
      .eq('id', existing.id)
    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const { error } = await supabase.from('availability').insert(payload)
  if (error) {
    throw new Error(error.message)
  }
}

function Availability() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const now = new Date()
  const [cursorYear, setCursorYear] = useState(now.getFullYear())
  const [cursorMonth, setCursorMonth] = useState(now.getMonth())

  const [byDate, setByDate] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const [slotModal, setSlotModal] = useState({
    open: false,
    date: '',
    start: '',
    end: '',
    all_day: false,
  })

  const todayISO = toISODate(new Date())

  const loadMonth = useCallback(async () => {
    if (!supabase || !userId) {
      setByDate({})
      setLoading(false)
      return
    }

    const { start, end } = monthRangeISO(cursorYear, cursorMonth)
    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('availability')
      .select('id, date, is_available, notes, start_time, end_time, all_day')
      .eq('creative_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      setByDate({})
    } else {
      const next = {}
      for (const row of data ?? []) {
        if (row?.date) {
          if (!next[row.date]) next[row.date] = []
          const legacy = parseSlotTimes(row.notes)
          next[row.date].push({
            id: row.id,
            date: row.date,
            is_available: Boolean(row.is_available),
            all_day: Boolean(row.all_day),
            start_time: row.start_time ?? legacy.start,
            end_time: row.end_time ?? legacy.end,
          })
        }
      }
      setByDate(next)
    }

    setLoading(false)
  }, [cursorYear, cursorMonth, userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    loadMonth()
  }, [authLoading, loadMonth])

  useEffect(() => {
    if (!selectedDate) {
      setNoteDraft('')
      return
    }
    const row = byDate[selectedDate]
    setNoteDraft(row?.notes ?? '')
  }, [selectedDate, byDate])

  const cells = useMemo(
    () => buildMonthCells(cursorYear, cursorMonth),
    [cursorYear, cursorMonth],
  )

  const cellsMonStart = useMemo(
    () => buildMonthCellsMonStart(cursorYear, cursorMonth),
    [cursorYear, cursorMonth],
  )

  const goPrevMonth = () => {
    setCursorMonth((m) => {
      if (m === 0) {
        setCursorYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }

  const goNextMonth = () => {
    setCursorMonth((m) => {
      if (m === 11) {
        setCursorYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  const handleDayClick = async (dateStr) => {
    if (!supabase || !userId) {
      setErrorMessage('Supabase is not configured or you are not signed in.')
      return
    }

    setSelectedDate(dateStr)
    setStatusMessage('')

    const current = byDate[dateStr]
    const nextAvailable = !(current?.is_available ?? false)
    const notes = current?.notes ?? ''

    setSaving(true)
    setErrorMessage('')

    try {
      await upsertAvailability({
        userId,
        date: dateStr,
        isAvailable: nextAvailable,
        notes,
      })
      setByDate((prev) => ({
        ...prev,
        [dateStr]: {
          ...prev[dateStr],
          is_available: nextAvailable,
          notes,
        },
      }))
      setStatusMessage(nextAvailable ? 'Marked available.' : 'Marked unavailable.')
    } catch (e) {
      setErrorMessage(e.message ?? 'Could not save availability.')
    } finally {
      setSaving(false)
    }
  }

  const saveNotes = async () => {
    if (!supabase || !userId || !selectedDate) {
      return
    }

    const current = byDate[selectedDate]
    const isAvailable = current?.is_available ?? false
    const prevNotes = (current?.notes ?? '').trim()
    const nextNotes = noteDraft.trim()
    if (prevNotes === nextNotes) {
      return
    }

    setSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await upsertAvailability({
        userId,
        date: selectedDate,
        isAvailable,
        notes: noteDraft,
      })
      setByDate((prev) => ({
        ...prev,
        [selectedDate]: {
          ...prev[selectedDate],
          is_available: isAvailable,
          notes: noteDraft.trim(),
        },
      }))
      setStatusMessage('Note saved.')
    } catch (e) {
      setErrorMessage(e.message ?? 'Could not save note.')
    } finally {
      setSaving(false)
    }
  }

  const openAddModal = () => {
    setErrorMessage('')
    setStatusMessage('')
    setSlotModal({
      open: true,
      date: slotModal.date || todayISO,
      start: '',
      end: '',
      all_day: false,
    })
  }

  const closeAddModal = () => {
    setSlotModal((prev) => ({ ...prev, open: false }))
  }

  const submitAddSlot = async () => {
    if (!supabase || !userId) {
      setErrorMessage('Supabase is not configured or you are not signed in.')
      return
    }
    const dateStr = slotModal.date
    if (!dateStr) {
      setErrorMessage('Please choose a date.')
      return
    }
    if (!slotModal.all_day && (!slotModal.start || !slotModal.end)) {
      setErrorMessage('Please set start and end times.')
      return
    }

    const start = slotModal.all_day ? '00:00' : slotModal.start
    const end = slotModal.all_day ? '23:59' : slotModal.end
    const d = new Date(`${dateStr}T12:00:00`)
    if (!Number.isNaN(d.getTime())) {
      setCursorYear(d.getFullYear())
      setCursorMonth(d.getMonth())
    }

    setSaving(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const payload = {
        creative_id: userId,
        date: dateStr,
        is_available: true,
        all_day: Boolean(slotModal.all_day),
        start_time: start,
        end_time: end,
      }

      const { data: inserted, error } = await supabase
        .from('availability')
        .insert(payload)
        .select('id, date, is_available, all_day, start_time, end_time')
        .single()

      if (error) {
        throw new Error(error.message)
      }

      setByDate((prev) => {
        const next = { ...prev }
        const list = Array.isArray(next[dateStr]) ? next[dateStr].slice() : []
        list.push(inserted)
        next[dateStr] = list
        return next
      })
      setStatusMessage('Time slot added.')
      closeAddModal()
    } catch (e) {
      setErrorMessage(e.message ?? 'Could not add time slot.')
    } finally {
      setSaving(false)
    }
  }

  const deleteSlot = async (slotId) => {
    if (!supabase || !userId) {
      return
    }
    setSaving(true)
    setErrorMessage('')
    setStatusMessage('')
    try {
      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('id', slotId)
        .eq('creative_id', userId)

      if (error) {
        throw new Error(error.message)
      }

      setByDate((prev) => {
        const next = {}
        for (const [dateStr, rows] of Object.entries(prev || {})) {
          const kept = (Array.isArray(rows) ? rows : []).filter((r) => r?.id !== slotId)
          if (kept.length) next[dateStr] = kept
        }
        return next
      })

      setStatusMessage('Time slot removed.')
    } catch (e) {
      setErrorMessage(e.message ?? 'Could not remove time slot.')
    } finally {
      setSaving(false)
    }
  }

  const shellStyle = {
    background: THEME.pageBg,
    minHeight: '100vh',
    padding: 32,
    color: THEME.text,
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
  }

  const wrapStyle = { maxWidth: 800, margin: '0 auto' }

  const cardStyle = {
    background: THEME.cardBg,
    border: THEME.cardBorder,
    borderRadius: 12,
    padding: 24,
  }

  const labelStyle = {
    display: 'block',
    color: THEME.label,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 6,
  }

  const modalLabelStyle = {
    display: 'block',
    color: THEME.label,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 5,
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: THEME.controlBg,
    border: `1px solid ${THEME.controlBorder}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: 'rgb(242, 242, 242)',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    outline: 'none',
  }

  const slotRows = Object.values(byDate || {})
    .flat()
    .filter((row) => row?.is_available)
    .sort((a, b) => {
      const ad = String(a?.date || '')
      const bd = String(b?.date || '')
      if (ad !== bd) return ad.localeCompare(bd)
      const at = String(a?.start_time || '')
      const bt = String(b?.start_time || '')
      return at.localeCompare(bt)
    })

  const pageHeaderRow = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: '1 1 240px' }}>
        <Link
          to="/dashboard"
          style={{
            color: THEME.green,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ← Back
        </Link>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: 'Inter, sans-serif', lineHeight: 1.2 }}>
            Availability
          </div>
          <div
            style={{
              fontSize: 13,
              color: THEME.subtitle,
              marginTop: 6,
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.35,
            }}
          >
            Manage your available time slots for client bookings
          </div>
        </div>
      </div>
    </div>
  )

  if (authLoading) {
    return (
      <section style={shellStyle}>
        <div style={wrapStyle}>
          {pageHeaderRow()}
          <div style={{ marginTop: 8, color: THEME.muted, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
            Loading session…
          </div>
        </div>
      </section>
    )
  }

  if (!userId) {
    return (
      <section style={shellStyle}>
        <div style={wrapStyle}>
          {pageHeaderRow()}
          <div style={{ marginTop: 8, color: THEME.muted, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
            Sign in to manage your calendar.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={shellStyle}>
      <div style={wrapStyle}>
        {pageHeaderRow()}

        {(errorMessage || statusMessage) && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              background: errorMessage ? '#2a1a1a' : '#1e2a1e',
              border: errorMessage ? '1px solid #3a1a1a' : `1px solid ${THEME.green}33`,
              color: errorMessage ? THEME.red : THEME.green,
            }}
            role={errorMessage ? 'alert' : 'status'}
          >
            {errorMessage || statusMessage}
          </div>
        )}

        <div style={{ marginBottom: 0 }}>
          <div
            style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Manage Availability
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  borderLeft: `3px solid ${THEME.green}`,
                  paddingLeft: 10,
                  margin: 0,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Availability Calendar
              </div>
              <button
                type="button"
                onClick={openAddModal}
                disabled={saving}
                style={{
                  background: THEME.green,
                  color: '#000',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 18px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                + Add Time Slot
              </button>
            </div>

            {loading ? (
              <div style={{ color: THEME.muted, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                Loading calendar…
              </div>
            ) : slotRows.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <CalendarEmptyIcon />
                <div
                  style={{
                    color: THEME.text,
                    fontSize: 14,
                    fontWeight: 400,
                    marginBottom: 8,
                    lineHeight: 1.45,
                  }}
                >
                  No availability slots yet.
                </div>
                <div style={{ color: THEME.subtitle, fontSize: 13, lineHeight: 1.45 }}>
                  Add time slots to let clients book with you.
                </div>
              </div>
            ) : (
              <div>
                {slotRows.map((row) => {
                  const datePretty = new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                  return (
                    <div
                      key={row.id}
                      style={{
                        background: THEME.controlBg,
                        border: `1px solid ${THEME.controlBorder}`,
                        borderRadius: 10,
                        padding: '14px 18px',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                          {datePretty}
                        </div>
                        <div style={{ color: THEME.green, fontSize: 13, fontWeight: 600 }}>
                          {row.all_day ? 'All day' : `${row.start_time} → ${row.end_time}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSlot(row.id)}
                        disabled={saving}
                        style={{
                          background: 'none',
                          border: `1px solid ${THEME.red}`,
                          color: THEME.red,
                          borderRadius: 6,
                          padding: '4px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: saving ? 'not-allowed' : 'pointer',
                          opacity: saving ? 0.55 : 1,
                          fontFamily: 'Inter, sans-serif',
                          flexShrink: 0,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {slotModal.open && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 50,
            boxSizing: 'border-box',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAddModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-slot-title"
            style={{
              background: THEME.cardBg,
              border: THEME.cardBorder,
              borderRadius: 14,
              padding: 28,
              width: 420,
              maxWidth: '90vw',
              boxSizing: 'border-box',
              fontFamily: 'Inter, sans-serif',
              position: 'relative',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  id="add-slot-title"
                  style={{
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.25,
                  }}
                >
                  Add Availability Slot
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: THEME.subtitle,
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.4,
                  }}
                >
                  Set a date and time when you&apos;re available for bookings.
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeAddModal}
                disabled={saving}
                style={{
                  flexShrink: 0,
                  background: 'none',
                  border: 'none',
                  color: THEME.label,
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  padding: '0 4px',
                  fontFamily: 'Inter, sans-serif',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14, marginBottom: 0 }}>
              <div>
                <label htmlFor="slot-date" style={modalLabelStyle}>
                  Date
                </label>
                <input
                  id="slot-date"
                  type="date"
                  value={slotModal.date}
                  onChange={(e) => setSlotModal((p) => ({ ...p, date: e.target.value }))}
                  disabled={saving}
                  style={inputStyle}
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 14,
                }}
              >
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={modalLabelStyle}>All Day</label>
                  <button
                    type="button"
                    onClick={() => setSlotModal((p) => ({ ...p, all_day: !p.all_day }))}
                    disabled={saving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      width: '100%',
                      background: THEME.controlBg,
                      border: `1px solid ${THEME.controlBorder}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      color: THEME.text,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 14,
                      boxSizing: 'border-box',
                      opacity: saving ? 0.65 : 1,
                    }}
                    aria-pressed={slotModal.all_day}
                  >
                    <span style={{ color: slotModal.all_day ? THEME.green : THEME.muted, fontWeight: 700 }}>
                      {slotModal.all_day ? 'On' : 'Off'}
                    </span>
                    <span style={{ color: THEME.subtitle, fontSize: 13 }}>Save 00:00–23:59</span>
                  </button>
                </div>

                {!slotModal.all_day ? (
                  <>
                    <div>
                      <label htmlFor="slot-start" style={modalLabelStyle}>
                        Start Time
                      </label>
                      <input
                        id="slot-start"
                        type="time"
                        value={slotModal.start}
                        onChange={(e) => setSlotModal((p) => ({ ...p, start: e.target.value }))}
                        disabled={saving}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="slot-end" style={modalLabelStyle}>
                        End Time
                      </label>
                      <input
                        id="slot-end"
                        type="time"
                        value={slotModal.end}
                        onChange={(e) => setSlotModal((p) => ({ ...p, end: e.target.value }))}
                        disabled={saving}
                        style={inputStyle}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={closeAddModal}
                disabled={saving}
                style={{
                  background: 'none',
                  border: `1px solid ${THEME.controlBorder}`,
                  color: '#888',
                  borderRadius: 8,
                  padding: '9px 18px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddSlot}
                disabled={saving}
                style={{
                  background: THEME.green,
                  color: '#000',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 20px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.65 : 1,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                }}
              >
                Add Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Availability

/* eslint-enable no-unused-vars */
