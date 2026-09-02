import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import FinanceTabs from '../../components/dashboard/FinanceTabs'
import {
  FINANCE_CSS, money, money0, fyStartYear, fyRange, fyLabel, fyQuarters, inRange,
  gstComponent, categoryLabel,
} from '../../lib/financeStyles'

function expenseGst(e) {
  if (e.gst_amount != null && e.gst_amount !== '') return Number(e.gst_amount) || 0
  return e.has_gst ? gstComponent(e.amount) : 0
}

// AU resident individual tax brackets. Second bracket steps to 15% from FY2026-27
// (legislated 2025). Estimate only.
function brackets(fyYear) {
  const secondRate = fyYear >= 2026 ? 0.15 : 0.16
  return [
    { upTo: 18200, rate: 0 },
    { upTo: 45000, rate: secondRate },
    { upTo: 135000, rate: 0.30 },
    { upTo: 190000, rate: 0.37 },
    { upTo: Infinity, rate: 0.45 },
  ]
}

function incomeTax(taxable, fyYear) {
  let tax = 0, prev = 0
  for (const b of brackets(fyYear)) {
    if (taxable > prev) { tax += (Math.min(taxable, b.upTo) - prev) * b.rate; prev = b.upTo }
    else break
  }
  return tax
}

export default function TaxHubPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({ gst_registered: false, abn: '', set_aside_percent: 30, fy_start_month: 7 })
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [fy, setFy] = useState(fyStartYear())

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const [s, inv, exp] = await Promise.all([
      supabase.from('finance_settings').select('*').eq('creative_id', user.id).maybeSingle(),
      supabase.from('invoices').select('id, amount, status, created_at').eq('creative_id', user.id),
      supabase.from('expenses').select('id, amount, gst_amount, has_gst, is_deductible, category, expense_date').eq('creative_id', user.id),
    ])
    setSettings(s.data || { gst_registered: false, abn: '', set_aside_percent: 30, fy_start_month: 7 })
    setInvoices(inv.data || [])
    setExpenses(exp.data || [])
    setLoading(false)
  }

  const startMonth = settings.fy_start_month || 7
  const range = useMemo(() => fyRange(fy, startMonth), [fy, startMonth])
  const gstReg = !!settings.gst_registered

  const calc = useMemo(() => {
    const paidFY = invoices.filter(i => i.status === 'paid' && inRange(i.created_at, range.start, range.end))
    const expFY = expenses.filter(e => inRange(e.expense_date, range.start, range.end))

    const grossIncome = paidFY.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const gstCollected = gstReg ? paidFY.reduce((s, i) => s + gstComponent(i.amount), 0) : 0
    const gstPaidAll = gstReg ? expFY.reduce((s, e) => s + expenseGst(e), 0) : 0
    const gstPaidDeductible = gstReg ? expFY.filter(e => e.is_deductible).reduce((s, e) => s + expenseGst(e), 0) : 0
    const gstNet = gstCollected - gstPaidAll

    const deductibleTotal = expFY.filter(e => e.is_deductible).reduce((s, e) => s + (Number(e.amount) || 0), 0)

    // Income tax base (GST removed if registered)
    const assessable = grossIncome - gstCollected
    const deductionsExGst = deductibleTotal - gstPaidDeductible
    const taxable = Math.max(0, assessable - deductionsExGst)
    const tax = incomeTax(taxable, fy)
    const medicare = taxable > 24276 ? taxable * 0.02 : 0
    const totalIncomeTax = tax + medicare
    const effRate = assessable > 0 ? (totalIncomeTax / assessable) * 100 : 0

    // Set-aside pot vs total ATO liability
    const pot = grossIncome * ((Number(settings.set_aside_percent) || 0) / 100)
    const totalLiability = totalIncomeTax + Math.max(0, gstNet)
    const coverage = totalLiability > 0 ? (pot / totalLiability) * 100 : 100

    // BAS quarters
    const quarters = fyQuarters(fy, startMonth).map(q => {
      const qInc = paidFY.filter(i => inRange(i.created_at, q.start, q.end))
      const qExp = expFY.filter(e => inRange(e.expense_date, q.start, q.end))
      const col = gstReg ? qInc.reduce((s, i) => s + gstComponent(i.amount), 0) : 0
      const paid = gstReg ? qExp.reduce((s, e) => s + expenseGst(e), 0) : 0
      return { ...q, collected: col, paid, net: col - paid, sales: qInc.reduce((s, i) => s + (Number(i.amount) || 0), 0) }
    })

    // Deductions by category (for summary)
    const byCat = {}
    expFY.filter(e => e.is_deductible).forEach(e => { byCat[e.category || 'other'] = (byCat[e.category || 'other'] || 0) + (Number(e.amount) || 0) })

    return { grossIncome, gstCollected, gstPaidAll, gstNet, deductibleTotal, assessable, deductionsExGst, taxable, totalIncomeTax, effRate, pot, totalLiability, coverage, quarters, byCat }
  }, [invoices, expenses, settings, fy, startMonth, range, gstReg])

  function downloadSummary() {
    const L = fyLabel(fy)
    const lines = [
      ['LensTrybe tax summary', L],
      [],
      ['Income (paid invoices)', calc.grossIncome.toFixed(2)],
    ]
    if (gstReg) lines.push(['GST collected', calc.gstCollected.toFixed(2)])
    lines.push(['Deductible expenses', calc.deductibleTotal.toFixed(2)])
    if (gstReg) lines.push(['GST paid on expenses', calc.gstPaidAll.toFixed(2)])
    lines.push(
      ['Taxable income (estimate)', calc.taxable.toFixed(2)],
      ['Estimated income tax + Medicare', calc.totalIncomeTax.toFixed(2)],
    )
    if (gstReg) lines.push(['Net GST ' + (calc.gstNet >= 0 ? 'payable' : 'refund'), Math.abs(calc.gstNet).toFixed(2)])
    lines.push([], ['Deductions by category', ''])
    Object.entries(calc.byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => lines.push([categoryLabel(k), v.toFixed(2)]))
    lines.push([], ['Estimate only — not tax advice.'])

    const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `LensTrybe-tax-summary-${L.replace(/[^\w]+/g, '-')}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const covered = calc.coverage >= 100

  return (
    <div className="ltf">
      <style>{FINANCE_CSS}</style>
      <div className="inner">
        <FinanceTabs active="tax" />

        <div className="phead">
          <div>
            <h1>Tax Hub</h1>
            <div className="sub">GST, BAS and income tax for the Australian financial year, worked out for you. An estimate to plan with, not tax advice.</div>
          </div>
          <div className="hactions">
            <div className="fypick">
              <button onClick={() => setFy(f => f - 1)} title="Previous year">‹</button>
              <span className="lbl">{fyLabel(fy)}</span>
              <button onClick={() => setFy(f => f + 1)} title="Next year">›</button>
            </div>
            <button className="btn" onClick={downloadSummary}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
              Download summary
            </button>
          </div>
        </div>

        {loading ? <div className="empty">Loading your tax position…</div> : (
          <>
            <div className="kpis">
              <div className="kpi"><span className="accent" style={{ background: '#4aa3ff' }} /><div className="klab">Taxable income</div><div className="kval">{money0(calc.taxable)}</div><div className="ksub">After deductions</div></div>
              <div className="kpi"><span className="accent" style={{ background: '#FF2D78' }} /><div className="klab">Est. income tax</div><div className="kval">{money0(calc.totalIncomeTax)}</div><div className="ksub">Incl. Medicare levy</div></div>
              <div className="kpi"><span className="accent" style={{ background: '#f5a524' }} /><div className="klab">Net GST</div><div className="kval">{gstReg ? money0(Math.abs(calc.gstNet)) : '—'}</div><div className="ksub">{gstReg ? (calc.gstNet >= 0 ? 'Payable to ATO' : 'Refund due') : 'Not registered'}</div></div>
              <div className="kpi"><span className="accent" style={{ background: '#1DB954' }} /><div className="klab">Set aside</div><div className="kval">{money0(calc.pot)}</div><div className="ksub">{settings.set_aside_percent || 0}% of income</div></div>
            </div>

            {/* Set-aside vs liability */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="prow">
                <div>
                  <div className="card-t">Are you covered for tax time?</div>
                  <div className="card-s">Your set-aside pot against estimated income tax{gstReg ? ' and GST' : ''}</div>
                </div>
                <span className="pill" style={{ background: covered ? 'rgba(29,185,84,0.15)' : 'rgba(240,81,109,0.14)', color: covered ? '#1DB954' : '#f0516d' }}>
                  <span className="dot" style={{ background: covered ? '#1DB954' : '#f0516d' }} />{covered ? 'Covered' : 'Shortfall'}
                </span>
              </div>
              <div className="prow" style={{ marginTop: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{money0(calc.pot)}</span>
                <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>set aside of {money0(calc.totalLiability)} estimated</span>
              </div>
              <div className="prog"><i style={{ width: `${Math.min(100, calc.coverage)}%`, background: covered ? 'linear-gradient(90deg,#1DB954,#38d16f)' : 'linear-gradient(90deg,#f5a524,#f0516d)' }} /></div>
              <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
                {covered
                  ? `You're ahead by ${money0(calc.pot - calc.totalLiability)}. Nicely done.`
                  : `Set aside about ${money0(calc.totalLiability - calc.pot)} more to be ready. Adjust your set-aside % in Finance setup.`}
              </div>
            </div>

            {/* GST / BAS */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-t">GST &amp; BAS</div>
              <div className="card-s">Quarterly breakdown for {fyLabel(fy)}</div>
              {!gstReg ? (
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.55, padding: '6px 0' }}>
                  You're marked as not registered for GST, so there's nothing to report here. Once you register (required at $75k+ turnover), turn on GST in Finance setup and your BAS quarters fill in automatically.
                </div>
              ) : (
                <div className="list" style={{ marginTop: 6, boxShadow: 'none', background: 'transparent', border: '1px solid var(--lt-hairline)' }}>
                  <div className="lrow head" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <span>Quarter</span><span style={{ textAlign: 'right' }}>Collected</span><span style={{ textAlign: 'right' }}>Paid</span><span style={{ textAlign: 'right' }}>Net</span>
                  </div>
                  {calc.quarters.map(q => (
                    <div key={q.key} className="lrow" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                      <span><strong style={{ fontSize: 13 }}>{q.key}</strong> <span className="faint" style={{ fontSize: 11.5 }}>{q.months}</span></span>
                      <span className="tnum" style={{ textAlign: 'right', fontSize: 13 }}>{money0(q.collected)}</span>
                      <span className="tnum muted" style={{ textAlign: 'right', fontSize: 13 }}>{money0(q.paid)}</span>
                      <span className="tnum" style={{ textAlign: 'right', fontSize: 13, color: q.net >= 0 ? '#f5a524' : '#1DB954' }}>{money0(q.net)}</span>
                    </div>
                  ))}
                  <div className="lrow" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', background: 'var(--lt-surface)' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>Year</span>
                    <span className="tnum" style={{ textAlign: 'right', fontSize: 13, fontWeight: 800 }}>{money0(calc.gstCollected)}</span>
                    <span className="tnum" style={{ textAlign: 'right', fontSize: 13, fontWeight: 800 }}>{money0(calc.gstPaidAll)}</span>
                    <span className="tnum" style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: calc.gstNet >= 0 ? '#f5a524' : '#1DB954' }}>{money0(calc.gstNet)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Income tax breakdown */}
            <div className="grid2" style={{ marginBottom: 14 }}>
              <div className="card">
                <div className="card-t">Income tax estimate</div>
                <div className="card-s">How your taxable income is worked out</div>
                <div style={{ marginTop: 6 }}>
                  {[
                    ['Income (paid)', money0(calc.grossIncome), false],
                    ...(gstReg ? [['Less GST collected', '− ' + money0(calc.gstCollected), false]] : []),
                    ['Assessable income', money0(calc.assessable), true],
                    ['Less deductions', '− ' + money0(gstReg ? calc.deductionsExGst : calc.deductibleTotal), false],
                    ['Taxable income', money0(calc.taxable), true],
                    ['Estimated tax + Medicare', money0(calc.totalIncomeTax), false],
                  ].map(([k, v, strong], i) => (
                    <div key={i} className="prow" style={{ padding: '9px 0', borderBottom: '1px solid var(--lt-hairline)' }}>
                      <span style={{ fontSize: 13, fontWeight: strong ? 700 : 500, color: strong ? 'var(--lt-text)' : 'var(--lt-muted)' }}>{k}</span>
                      <span className="tnum" style={{ fontSize: 13.5, fontWeight: strong ? 800 : 600 }}>{v}</span>
                    </div>
                  ))}
                  <div className="prow" style={{ paddingTop: 12 }}>
                    <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>Effective tax rate</span>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{calc.effRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-t">Financial year summary</div>
                <div className="card-s">{fyLabel(fy)} · 1 July – 30 June</div>
                <div style={{ marginTop: 6 }}>
                  {[
                    ['Income', money0(calc.grossIncome), '#1DB954'],
                    ['Deductible expenses', money0(calc.deductibleTotal), '#FF2D78'],
                    ['Net profit', money0(calc.grossIncome - (gstReg ? calc.gstCollected : 0) - calc.deductibleTotal), '#4aa3ff'],
                  ].map(([k, v, c], i) => (
                    <div key={i} className="prow" style={{ padding: '11px 0', borderBottom: '1px solid var(--lt-hairline)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 9 }}><span className="catdot" style={{ background: c }} />{k}</span>
                      <span className="tnum" style={{ fontSize: 14 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <button className="btn" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={downloadSummary}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                  Download tax summary (CSV)
                </button>
                <div className="hint" style={{ textAlign: 'center' }}>Hand this to your accountant, or keep it for your records.</div>
              </div>
            </div>

            <div className="faint" style={{ fontSize: 11.5, textAlign: 'center', padding: '4px 0 8px', lineHeight: 1.6 }}>
              Estimates use current ATO resident individual rates and a 2% Medicare levy. Your actual tax depends on your full circumstances. This isn't tax advice, always confirm with a registered tax agent.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
