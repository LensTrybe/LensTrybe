import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, AnalyticsTile, CenterModal } from './widgetKit'
import { monthBuckets, monthKeyOf, trendPct, Sparkline, AreaChart } from './analyticsKit'
import InsightsUpgrade from './InsightsUpgrade'
import { isDemoMode, demoThreadsAll, demoBookings } from '../../lib/demoMode'

const ACCENT = '#3b82f6'

export default function LeadsWidget({ userId, insightsLocked = false }) {
  const [threads, setThreads] = useState([])
  const [bookings, setBookings] = useState([])
  const [open, setOpen] = useState(false)
  const range = 6

  useEffect(() => {
    if (!userId) return
    if (isDemoMode()) { setThreads(demoThreadsAll()); setBookings(demoBookings()); return }
    supabase.from('message_threads').select('created_at').eq('creative_id', userId).then(({ data }) => setThreads(data ?? []))
    supabase.from('bookings').select('created_at, booking_date').eq('creative_id', userId).then(({ data }) => setBookings(data ?? []))
  }, [userId])

  const data = useMemo(() => {
    const months = monthBuckets(range)
    const enq = {}; const bok = {}
    for (const r of threads) { const k = monthKeyOf(r.created_at); if (k) enq[k] = (enq[k] || 0) + 1 }
    for (const r of bookings) { const k = monthKeyOf(r.created_at || r.booking_date); if (k) bok[k] = (bok[k] || 0) + 1 }
    const enqSeries = months.map((m) => enq[m.key] || 0)
    const bokSeries = months.map((m) => bok[m.key] || 0)
    const totalEnq = enqSeries.reduce((a, b) => a + b, 0)
    const totalBok = bokSeries.reduce((a, b) => a + b, 0)
    const conv = totalEnq ? Math.round((totalBok / totalEnq) * 100) : 0
    const rowsByMonth = months.map((m, i) => ({ label: m.date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), enq: enqSeries[i], bok: bokSeries[i], conv: enqSeries[i] ? Math.round((bokSeries[i] / enqSeries[i]) * 100) : 0 }))
    return { months, enqSeries, bokSeries, totalEnq, totalBok, conv, labels: months.map((m) => m.label), trend: trendPct(enqSeries), rowsByMonth }
  }, [threads, bookings])

  return (
    <>
      <AnalyticsTile title="Leads" value={`${data.conv}%`} sub="conversion" trend={data.trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={data.enqSeries} color={ACCENT} />
      </AnalyticsTile>

      {open && insightsLocked ? (
        <CenterModal title="Leads & conversion" subtitle={`Last ${range} months`} width={520} onClose={() => setOpen(false)}>
          <InsightsUpgrade value={`${data.conv}%`} sub={`${data.totalBok} booked from ${data.totalEnq} enquiries`} trend={data.trend} accent={ACCENT} feature="lead analytics" />
        </CenterModal>
      ) : open ? (
        <CenterModal title="Leads & conversion" subtitle={`Last ${range} months`} width={760} onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {[{ k: 'Enquiries', v: data.totalEnq }, { k: 'Booked', v: data.totalBok }, { k: 'Conversion', v: `${data.conv}%` }].map((s) => (
              <div key={s.k} style={{ flex: '1 1 140px', background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT }}>{s.k}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, fontFamily: FONT, letterSpacing: '-0.02em', marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, marginBottom: 6 }}>Enquiries over time</div>
          <AreaChart data={data.enqSeries} xLabels={data.labels} color={ACCENT} yFormat={(v) => String(Math.round(v))} />

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, padding: '0 0 6px' }}>
              <span style={{ flex: 1 }}>Month</span><span style={{ width: 90, textAlign: 'right' }}>Enquiries</span><span style={{ width: 80, textAlign: 'right' }}>Booked</span><span style={{ width: 70, textAlign: 'right' }}>Conv.</span>
            </div>
            {data.rowsByMonth.map((r) => (
              <div key={r.label} style={{ display: 'flex', fontSize: 13.5, color: TEXT, fontFamily: FONT, padding: '8px 0', borderBottom: '1px solid var(--lt-surface-2)' }}>
                <span style={{ flex: 1 }}>{r.label}</span><span style={{ width: 90, textAlign: 'right' }}>{r.enq}</span><span style={{ width: 80, textAlign: 'right' }}>{r.bok}</span><span style={{ width: 70, textAlign: 'right', color: MUTED }}>{r.conv}%</span>
              </div>
            ))}
          </div>
        </CenterModal>
      ) : null}
    </>
  )
}
