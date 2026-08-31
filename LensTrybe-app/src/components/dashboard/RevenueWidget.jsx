import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, GREEN, DANGER, AnalyticsTile, CenterModal } from './widgetKit'
import InsightsUpgrade from './InsightsUpgrade'
import { currency, monthBuckets, monthKeyOf, trendPct, Sparkline, MultiLineChart, SERIES_COLORS } from './analyticsKit'
import { isDemoMode, demoInvoices, demoQuotes } from '../../lib/demoMode'

const ACCENT = '#a855f7'
const OPEN_QUOTE = ['sent', 'pending', 'awaiting_approval']

const seg = (active) => ({ border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontFamily: FONT, cursor: 'pointer', background: active ? 'rgba(168,85,247,0.28)' : 'transparent', color: active ? '#fff' : MUTED, whiteSpace: 'nowrap' })
const segWrap = { display: 'flex', gap: 3, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)', borderRadius: 10, padding: 3 }
const card = { flex: '1 1 170px', background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 14, padding: '14px 16px' }
const cardLabel = { fontSize: 11.5, color: MUTED, fontFamily: FONT }
const cardValue = { fontSize: 24, fontWeight: 700, color: TEXT, fontFamily: FONT, letterSpacing: '-0.02em', marginTop: 3 }
const secLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, marginBottom: 8 }

export default function RevenueWidget({ userId, goal, insightsLocked = false }) {
  const [invoices, setInvoices] = useState([])
  const [quotes, setQuotes] = useState([])
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState(6)
  const [view, setView] = useState('total') // total | specialty | discipline
  const [compare, setCompare] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (isDemoMode()) { setInvoices(demoInvoices()); setQuotes(demoQuotes()); return }
    const since = new Date(); since.setMonth(since.getMonth() - 24)
    supabase.from('invoices').select('amount, status, created_at, due_date, client_name, skill_type, discipline').eq('creative_id', userId).gte('created_at', since.toISOString()).then(({ data }) => setInvoices(data ?? []))
    supabase.from('quotes').select('status, amount').eq('creative_id', userId).then(({ data }) => setQuotes(data ?? []))
  }, [userId])

  const paid = useMemo(() => invoices.filter((i) => String(i.status).toLowerCase() === 'paid'), [invoices])

  // Tile: last 6 months paid.
  const tile = useMemo(() => {
    const months = monthBuckets(6); const sum = {}
    for (const r of paid) { const k = monthKeyOf(r.created_at); sum[k] = (sum[k] || 0) + Number(r.amount || 0) }
    const series = months.map((m) => sum[m.key] || 0)
    return { series, total: series.reduce((a, b) => a + b, 0), trend: trendPct(series) }
  }, [paid])

  const A = useMemo(() => {
    const months = monthBuckets(range)
    const keys = months.map((m) => m.key)
    const keySet = new Set(keys)
    const inRange = paid.filter((r) => keySet.has(monthKeyOf(r.created_at)))

    const totalByMonth = {}
    for (const r of inRange) { const k = monthKeyOf(r.created_at); totalByMonth[k] = (totalByMonth[k] || 0) + Number(r.amount || 0) }
    const series = keys.map((k) => totalByMonth[k] || 0)
    const total = series.reduce((a, b) => a + b, 0)
    const trend = trendPct(series)

    // previous period (for compare)
    const now = new Date()
    const prevMonths = []
    for (let i = range * 2 - 1; i >= range; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); prevMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
    const prevSet = new Set(prevMonths)
    const prevByMonth = {}
    for (const r of paid) { const k = monthKeyOf(r.created_at); if (prevSet.has(k)) prevByMonth[k] = (prevByMonth[k] || 0) + Number(r.amount || 0) }
    const prevSeries = prevMonths.map((k) => prevByMonth[k] || 0)
    const prevTotal = prevSeries.reduce((a, b) => a + b, 0)

    // category series (specialty or discipline)
    const field = view === 'specialty' ? 'skill_type' : 'discipline'
    const catTotals = {}
    for (const r of inRange) { const c = r[field] || 'Uncategorised'; catTotals[c] = (catTotals[c] || 0) + Number(r.amount || 0) }
    const catNames = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a]).slice(0, 6)
    const catSeries = catNames.map((c, ci) => {
      const bm = {}
      for (const r of inRange) { if ((r[field] || 'Uncategorised') !== c) continue; const k = monthKeyOf(r.created_at); bm[k] = (bm[k] || 0) + Number(r.amount || 0) }
      return { label: c, color: SERIES_COLORS[ci % SERIES_COLORS.length], data: keys.map((k) => bm[k] || 0), total: catTotals[c] }
    })

    // extras
    const count = inRange.length
    const avg = count ? total / count : 0
    const todayStr = new Date().toISOString().slice(0, 10)
    const unpaid = invoices.filter((i) => String(i.status).toLowerCase() !== 'paid')
    const overdue = unpaid.filter((i) => i.due_date && i.due_date < todayStr)
    const outstandingTotal = unpaid.reduce((s, i) => s + Number(i.amount || 0), 0)
    const overdueTotal = overdue.reduce((s, i) => s + Number(i.amount || 0), 0)
    const projected = quotes.filter((q) => OPEN_QUOTE.includes(String(q.status || '').toLowerCase())).reduce((s, q) => s + Number(q.amount || 0), 0)
    const thisKey = monthKeyOf(new Date())
    const thisMonthPaid = totalByMonth[thisKey] || 0

    const topClients = (() => { const by = {}; for (const r of inRange) { const n = r.client_name || 'Unknown'; by[n] = (by[n] || 0) + Number(r.amount || 0) } return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5) })()
    const bestMonths = months.map((m, i) => ({ label: m.date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }), v: series[i] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3)

    return { months, labels: months.map((m) => m.label), series, total, trend, prevSeries, prevTotal, catSeries, count, avg, outstandingTotal, overdueTotal, overdueCount: overdue.length, projected, thisMonthPaid, topClients, bestMonths }
  }, [paid, invoices, quotes, range, view])

  const chartSeries = view === 'total'
    ? [{ label: 'Revenue', color: ACCENT, data: A.series, fill: true }, ...(compare ? [{ label: 'Previous', color: '#c9c9d6', data: A.prevSeries, dash: true }] : [])]
    : A.catSeries

  const goalNum = Number(goal || 0)
  const goalPct = goalNum ? Math.min(100, Math.round((A.thisMonthPaid / goalNum) * 100)) : null

  return (
    <>
      <AnalyticsTile title="Revenue" value={currency(tile.total)} sub="6 mo" trend={tile.trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={tile.series} color={ACCENT} />
      </AnalyticsTile>

      {open && insightsLocked ? (
        <CenterModal title="Revenue" subtitle="Paid invoices" width={520} onClose={() => setOpen(false)}>
          <InsightsUpgrade value={currency(tile.total)} sub="Paid invoices, last 6 months" trend={tile.trend} accent={ACCENT} feature="revenue analytics" />
        </CenterModal>
      ) : open ? (
        <CenterModal title="Revenue" subtitle="Paid invoices" width={1160} onClose={() => setOpen(false)}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div style={segWrap}>
              {[['total', 'Total'], ['specialty', 'By specialty'], ['discipline', 'By discipline']].map(([v, lb]) => (
                <button key={v} type="button" onClick={() => setView(v)} style={seg(view === v)}>{lb}</button>
              ))}
            </div>
            <div style={segWrap}>
              {[3, 6, 12].map((r) => <button key={r} type="button" onClick={() => setRange(r)} style={seg(range === r)}>{r} mo</button>)}
            </div>
            {view === 'total' ? (
              <button type="button" onClick={() => setCompare((c) => !c)} style={{ ...seg(compare), background: compare ? 'rgba(168,85,247,0.28)' : 'var(--lt-surface-2)', border: '1px solid var(--lt-input-border)' }}>{compare ? '✓ ' : ''}Compare previous</button>
            ) : null}
          </div>

          {/* KPI */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: TEXT, fontFamily: FONT }}>{currency(A.total)}</span>
            {A.trend != null ? <span style={{ fontSize: 13.5, fontWeight: 600, color: A.trend >= 0 ? GREEN : DANGER, fontFamily: FONT }}>{A.trend >= 0 ? '↑' : '↓'} {Math.abs(A.trend)}%</span> : null}
            {compare && view === 'total' ? <span style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>vs {currency(A.prevTotal)} previous {range} mo</span> : null}
          </div>

          {/* Chart */}
          <MultiLineChart series={chartSeries} xLabels={A.labels} width={1100} height={300} yFormat={(v) => currency(v)} />

          {/* Legend for category views + compare */}
          {(view !== 'total' || compare) ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              {chartSeries.map((s) => (
                <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED, fontFamily: FONT }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, opacity: s.dash ? 0.7 : 1 }} />
                  {s.label}{s.total != null ? ` · ${currency(s.total)}` : ''}
                </span>
              ))}
            </div>
          ) : null}

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
            <div style={card}><div style={cardLabel}>Avg invoice</div><div style={cardValue}>{currency(A.avg)}</div><div style={cardLabel}>{A.count} paid</div></div>
            <div style={card}><div style={cardLabel}>Outstanding</div><div style={{ ...cardValue, color: A.overdueCount ? DANGER : TEXT }}>{currency(A.outstandingTotal)}</div><div style={cardLabel}>{A.overdueCount ? `${currency(A.overdueTotal)} overdue` : 'none overdue'}</div></div>
            <div style={card}><div style={cardLabel}>Projected</div><div style={cardValue}>{currency(A.projected)}</div><div style={cardLabel}>open quotes</div></div>
            <div style={card}>
              <div style={cardLabel}>This month vs goal</div>
              {goalNum ? (
                <>
                  <div style={cardValue}>{goalPct}%</div>
                  <div style={{ height: 7, borderRadius: 999, background: 'var(--lt-border)', marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${goalPct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})` }} /></div>
                  <div style={{ ...cardLabel, marginTop: 6 }}>{currency(A.thisMonthPaid)} of {currency(goalNum)}</div>
                </>
              ) : <div style={{ ...cardLabel, marginTop: 6 }}>Set an income goal in your profile.</div>}
            </div>
          </div>

          {/* Breakdowns */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 24 }}>
            <div style={{ flex: '1 1 300px', minWidth: 240 }}>
              <div style={secLabel}>Top-paying clients</div>
              {A.topClients.length === 0 ? <div style={{ fontSize: 13.5, color: MUTED, fontFamily: FONT }}>No paid invoices yet.</div> : A.topClients.map(([name, amt]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--lt-surface-2)' }}>
                  <span style={{ fontSize: 14, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 10 }}>{name}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: FONT }}>{currency(amt)}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 220 }}>
              <div style={secLabel}>{view === 'total' ? 'Best months' : (view === 'specialty' ? 'By specialty' : 'By discipline')}</div>
              {view === 'total'
                ? (A.bestMonths.length === 0 ? <div style={{ fontSize: 13.5, color: MUTED, fontFamily: FONT }}>—</div> : A.bestMonths.map((m) => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--lt-surface-2)' }}><span style={{ fontSize: 14, color: TEXT, fontFamily: FONT }}>{m.label}</span><span style={{ fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: FONT }}>{currency(m.v)}</span></div>
                )))
                : (A.catSeries.length === 0 ? <div style={{ fontSize: 13.5, color: MUTED, fontFamily: FONT }}>No tagged invoices yet.</div> : A.catSeries.map((c) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--lt-surface-2)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flexShrink: 0 }} /><span style={{ fontSize: 14, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span></span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: FONT }}>{currency(c.total)}</span>
                  </div>
                )))}
            </div>
          </div>
        </CenterModal>
      ) : null}
    </>
  )
}
