import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, GREEN, DANGER, AnalyticsTile, CenterModal } from './widgetKit'
import { currency, monthBuckets, monthKeyOf, trendPct, Sparkline, AreaChart } from './analyticsKit'
import { isDemoMode, demoInvoices } from '../../lib/demoMode'

const ACCENT = '#eab308'

function daysOverdue(due) {
  if (!due) return 0
  return Math.floor((Date.now() - new Date(due + 'T00:00:00').getTime()) / 86400000)
}

const card = { flex: '1 1 150px', background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 14, padding: '13px 15px' }
const cardLabel = { fontSize: 11.5, color: MUTED, fontFamily: FONT }
const cardValue = { fontSize: 23, fontWeight: 700, color: TEXT, fontFamily: FONT, letterSpacing: '-0.02em', marginTop: 3 }
const secLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, margin: '18px 0 8px' }

export default function CashflowWidget({ userId }) {
  const [invoices, setInvoices] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (isDemoMode()) { setInvoices(demoInvoices()); return }
    const since = new Date(); since.setMonth(since.getMonth() - 24)
    supabase.from('invoices')
      .select('amount, status, due_date, client_name, client_email, created_at')
      .eq('creative_id', userId)
      .gte('created_at', since.toISOString())
      .then(({ data }) => setInvoices(data ?? []))
  }, [userId])

  const d = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const paid = invoices.filter((i) => String(i.status).toLowerCase() === 'paid')
    const unpaid = invoices.filter((i) => String(i.status).toLowerCase() !== 'paid')
    const overdue = unpaid.filter((i) => i.due_date && i.due_date < today)
    const sum = (arr) => arr.reduce((s, i) => s + Number(i.amount || 0), 0)

    const months = monthBuckets(6)
    const paidByMonth = {}
    for (const i of paid) { const k = monthKeyOf(i.created_at); paidByMonth[k] = (paidByMonth[k] || 0) + Number(i.amount || 0) }
    const paidSeries = months.map((m) => paidByMonth[m.key] || 0)

    // aging buckets on unpaid
    const aging = { current: 0, d30: 0, d60: 0, d60p: 0 }
    for (const i of unpaid) {
      const amt = Number(i.amount || 0)
      const od = i.due_date && i.due_date < today ? daysOverdue(i.due_date) : -1
      if (od < 0) aging.current += amt
      else if (od <= 30) aging.d30 += amt
      else if (od <= 60) aging.d60 += amt
      else aging.d60p += amt
    }

    const overdueList = overdue
      .map((i) => ({ ...i, od: daysOverdue(i.due_date) }))
      .sort((a, b) => b.od - a.od)

    return {
      paidTotal: sum(paid), outstanding: sum(unpaid), overdueTotal: sum(overdue), overdueCount: overdue.length,
      paidSeries, trend: trendPct(paidSeries), labels: months.map((m) => m.label), aging, overdueList,
    }
  }, [invoices])

  function reminderMailto(i) {
    const subject = encodeURIComponent(`Friendly reminder: invoice ${i.amount ? `for ${currency(i.amount)}` : ''}`)
    const body = encodeURIComponent(`Hi ${i.client_name || 'there'},\n\nJust a friendly reminder that this invoice${i.od > 0 ? ` is now ${i.od} day${i.od === 1 ? '' : 's'} overdue` : ' is due'}. When you have a moment, payment would be much appreciated.\n\nThanks so much!`)
    return `mailto:${i.client_email || ''}?subject=${subject}&body=${body}`
  }

  const agingRows = [
    { k: 'Not yet due', v: d.aging.current, c: MUTED },
    { k: '1–30 days over', v: d.aging.d30, c: '#f59e0b' },
    { k: '31–60 days over', v: d.aging.d60, c: '#f97316' },
    { k: '60+ days over', v: d.aging.d60p, c: DANGER },
  ]
  const agingMax = Math.max(1, ...agingRows.map((r) => r.v))

  return (
    <>
      <AnalyticsTile title="Cash flow" value={currency(d.outstanding)} sub={d.overdueCount ? `${currency(d.overdueTotal)} overdue` : 'outstanding'} trend={d.trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={d.paidSeries} color={ACCENT} />
      </AnalyticsTile>

      {open ? (
        <CenterModal title="Cash flow" subtitle="Money in, and what's still owed to you" onClose={() => setOpen(false)} width={820}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={card}><div style={cardLabel}>Paid · 6 mo</div><div style={{ ...cardValue, color: GREEN }}>{currency(d.paidTotal)}</div></div>
            <div style={card}><div style={cardLabel}>Outstanding</div><div style={cardValue}>{currency(d.outstanding)}</div></div>
            <div style={card}><div style={cardLabel}>Overdue</div><div style={{ ...cardValue, color: d.overdueCount ? DANGER : TEXT }}>{currency(d.overdueTotal)}</div><div style={{ fontSize: 12, color: MUTED, fontFamily: FONT, marginTop: 2 }}>{d.overdueCount} invoice{d.overdueCount === 1 ? '' : 's'}</div></div>
          </div>

          <div style={secLabel}>Cash in · last 6 months</div>
          <AreaChart data={d.paidSeries} xLabels={d.labels} color={ACCENT} width={760} height={200} yFormat={(v) => currency(v)} />

          <div style={secLabel}>Outstanding by age</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agingRows.map((r) => (
              <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: FONT }}>
                <span style={{ width: 120, flexShrink: 0, fontSize: 12.5, color: MUTED }}>{r.k}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--lt-track)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.round((r.v / agingMax) * 100)}%`, borderRadius: 999, background: r.c }} />
                </span>
                <span style={{ width: 80, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: TEXT }}>{currency(r.v)}</span>
              </div>
            ))}
          </div>

          <div style={secLabel}>Overdue invoices</div>
          {d.overdueList.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>Nothing overdue. Nice and healthy.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.overdueList.slice(0, 20).map((i) => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(224,85,106,0.06)', border: '1px solid rgba(224,85,106,0.22)', borderRadius: 12, padding: '11px 13px', fontFamily: FONT }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.client_name || 'Unnamed client'}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{currency(i.amount)} · {i.od} day{i.od === 1 ? '' : 's'} overdue</div>
                  </div>
                  <a href={reminderMailto(i)} style={{ flexShrink: 0, textDecoration: 'none', border: `1px solid ${ACCENT}66`, background: `${ACCENT}22`, color: ACCENT, borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 600 }}>Send reminder</a>
                </div>
              ))}
            </div>
          )}
        </CenterModal>
      ) : null}
    </>
  )
}
