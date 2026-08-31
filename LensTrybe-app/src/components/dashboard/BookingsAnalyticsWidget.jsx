import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, GREEN, AnalyticsTile, CenterModal } from './widgetKit'
import { monthBuckets, monthKeyOf, trendPct, Sparkline, AreaChart, BarRow } from './analyticsKit'
import { isDemoMode, demoBookings } from '../../lib/demoMode'

const ACCENT = '#1DB954'

export default function BookingsAnalyticsWidget({ userId }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const range = 6

  useEffect(() => {
    if (!userId) return
    if (isDemoMode()) { setRows(demoBookings()); return }
    supabase.from('bookings').select('booking_date, service, status, created_at').eq('creative_id', userId)
      .then(({ data }) => setRows(data ?? []))
  }, [userId])

  const { series, labels, total, trend } = useMemo(() => {
    const months = monthBuckets(range)
    const c = {}
    for (const r of rows) { const k = monthKeyOf(r.booking_date || r.created_at); if (k) c[k] = (c[k] || 0) + 1 }
    const series = months.map((m) => c[m.key] || 0)
    return { series, labels: months.map((m) => m.label), total: series.reduce((a, b) => a + b, 0), trend: trendPct(series) }
  }, [rows])

  const todayStr = new Date().toISOString().slice(0, 10)
  const upcoming = useMemo(() => rows.filter((b) => b.booking_date && b.booking_date >= todayStr).length, [rows, todayStr])
  const services = useMemo(() => {
    const by = {}
    for (const r of rows) { const s = r.service || 'Other'; by[s] = (by[s] || 0) + 1 }
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [rows])
  const svcMax = services.length ? services[0][1] : 0

  return (
    <>
      <AnalyticsTile title="Bookings" value={String(total)} sub={`${range} mo`} trend={trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={series} color={ACCENT} />
      </AnalyticsTile>

      {open ? (
        <CenterModal title="Bookings" subtitle={`Last ${range} months · ${upcoming} upcoming`} width={760} onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: TEXT, fontFamily: FONT }}>{total}</span>
            <span style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>bookings · {upcoming} upcoming</span>
          </div>
          <AreaChart data={series} xLabels={labels} color={ACCENT} yFormat={(v) => String(Math.round(v))} />

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, marginBottom: 8 }}>Most-booked services</div>
            {services.length === 0 ? <div style={{ fontSize: 13.5, color: MUTED, fontFamily: FONT }}>No bookings yet.</div> : services.map(([name, n]) => (
              <BarRow key={name} label={name.length > 6 ? name.slice(0, 6) + '…' : name} value={n} max={svcMax} color={ACCENT} />
            ))}
          </div>
        </CenterModal>
      ) : null}
    </>
  )
}
