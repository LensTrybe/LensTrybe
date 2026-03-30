import { useCallback, useEffect, useMemo, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'
import './Availability.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
      .select('id, date, is_available, notes')
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
          next[row.date] = {
            id: row.id,
            is_available: Boolean(row.is_available),
            notes: row.notes ?? '',
          }
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

  if (authLoading) {
    return (
      <section className="availability-page">
        <p className="availability-page__subtitle">Loading session…</p>
      </section>
    )
  }

  if (!userId) {
    return (
      <section className="availability-page">
        <h1 className="availability-page__title">Availability</h1>
        <p className="availability-page__subtitle">Sign in to manage your calendar.</p>
      </section>
    )
  }

  return (
    <section className="availability-page">
      <h1 className="availability-page__title">Availability</h1>
      <p className="availability-page__subtitle">
        Tap a day to toggle available (green) or unavailable. Add optional notes for the selected
        day.
      </p>

      <div className="availability-page__legend" aria-label="Availability legend">
        <p className="availability-page__legend-title">Legend</p>
        <div className="availability-page__legend-items">
          <div className="availability-page__legend-item">
            <span
              className="availability-page__legend-swatch availability-page__legend-swatch--available"
              aria-hidden
            />
            <span>Available</span>
          </div>
          <div className="availability-page__legend-item">
            <span
              className="availability-page__legend-swatch availability-page__legend-swatch--unavailable"
              aria-hidden
            />
            <span>Unavailable</span>
          </div>
        </div>
      </div>

      <div className="availability-page__toolbar">
        <h2 className="availability-page__month-label">{monthTitle(cursorYear, cursorMonth)}</h2>
        <div className="availability-page__nav">
          <button type="button" onClick={goPrevMonth} disabled={loading || saving}>
            Previous
          </button>
          <button type="button" onClick={goNextMonth} disabled={loading || saving}>
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <p className="availability-page__subtitle">Loading calendar…</p>
      ) : (
        <div className="availability-page__calendar">
          <div className="availability-page__weekdays">
            {WEEKDAYS.map((d) => (
              <div key={d} className="availability-page__weekday">
                {d}
              </div>
            ))}
          </div>
          <div className="availability-page__grid">
            {cells.map((cell) => {
              if (cell.kind === 'pad') {
                return (
                  <div
                    key={cell.key}
                    className="availability-page__cell availability-page__cell--outside"
                    aria-hidden
                  />
                )
              }

              const dateStr = cell.key
              const row = byDate[dateStr]
              const available = row?.is_available ?? false
              const isToday = dateStr === todayISO
              const isSelected = dateStr === selectedDate

              const mods = [
                'availability-page__cell',
                available ? 'availability-page__cell--available' : 'availability-page__cell--unavailable',
              ]
              if (isToday) {
                mods.push('availability-page__cell--today')
              }
              if (isSelected) {
                mods.push('availability-page__cell--selected')
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  className={mods.join(' ')}
                  onClick={() => handleDayClick(dateStr)}
                  disabled={saving}
                  aria-pressed={available}
                  aria-label={`${dateStr}, ${available ? 'available' : 'unavailable'}`}
                >
                  <span className="availability-page__cell-inner">
                    <span className="availability-page__cell-day">{cell.date.getDate()}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedDate && (
        <div className="availability-page__notes">
          <h2>Notes for this day</h2>
          <p className="availability-page__notes-meta">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNotes}
            disabled={saving}
            placeholder="Add context for this date (optional)…"
            aria-label="Notes for selected day"
          />
          <p className="availability-page__notes-hint">
            Notes save automatically when you leave this field. Toggle the day to change available /
            unavailable.
          </p>
        </div>
      )}

      {errorMessage && (
        <p className="availability-page__message" role="alert">
          {errorMessage}
        </p>
      )}
      {statusMessage && !errorMessage && (
        <p className="availability-page__message availability-page__message--ok" role="status">
          {statusMessage}
        </p>
      )}
    </section>
  )
}

export default Availability
