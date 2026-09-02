import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import FinanceTabs from '../../components/dashboard/FinanceTabs'
import {
  FINANCE_CSS, money, money0, moneyShort, fyStartYear, fyRange, fyLabel,
  fyMonths, inRange, prettyDate, gstComponent,
} from '../../lib/financeStyles'

function expenseGst(e) {
  if (e.gst_amount != null && e.gst_amount !== '') return Number(e.gst_amount) || 0
  return e.has_gst ? gstComponent(e.amount) : 0
}

export default function FinanceOverviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({ gst_registered: false, abn: '', set_aside_percent: 30, fy_start_month: 7 })
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [goals, setGoals] = useState([])
  const [fy, setFy] = useState(fyStartYear())
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState(null)

  // Settings form
  const [sForm, setSForm] = useState({ gst_registered: false, abn: '', set_aside_percent: 30, goal: '' })
  const [savingS, setSavingS] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  function flash(msg, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 2400) }

  async function load() {
    setLoading(true)
    const [s, inv, exp, pj, gl] = await Promise.all([
      supabase.from('finance_settings').select('*').eq('creative_id', user.id).maybeSingle(),
      supabase.from('invoices').select('id, client_name, amount, status, due_date, created_at, project_id').eq('creative_id', user.id),
      supabase.from('expenses').select('id, merchant, description, category, amount, gst_amount, has_gst, expense_date, project_id').eq('creative_id', user.id),
      supabase.from('projects').select('id, title, value').eq('creative_id', user.id),
      supabase.from('financial_goals').select('*').eq('creative_id', user.id),
    ])
    const st = s.data || { gst_registered: false, abn: '', set_aside_percent: 30, fy_start_month: 7 }
    setSettings(st)
    setInvoices(inv.data || [])
    setExpenses(exp.data || [])
    setProjects(pj.data || [])
    setGoals(gl.data || [])
    setLoading(false)
  }

  const startMonth = settings.fy_start_month || 7
  const range = useMemo(() => fyRange(fy, startMonth), [fy, startMonth])

  const calc = useMemo(() => {
    const now = new Date()
    const paidFY = invoices.filter(i => i.status === 'paid' && inRange(i.created_at, range.start, range.end))
    const expFY = expenses.filter(e => inRange(e.expense_date, range.start, range.end))

    const income = paidFY.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const expenseTotal = expFY.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const profit = income - expenseTotal

    // Outstanding = money owed to you (all time, not FY-bound)
    const sent = invoices.filter(i => i.status === 'sent')
    const outstanding = sent.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const overdue = sent.filter(i => i.due_date && new Date(i.due_date) < now)
    const overdueTotal = overdue.reduce((s, i) => s + (Number(i.amount) || 0), 0)

    // GST
    const gstCollected = settings.gst_registered ? paidFY.reduce((s, i) => s + gstComponent(i.amount), 0) : 0
    const gstPaid = settings.gst_registered ? expFY.reduce((s, e) => s + expenseGst(e), 0) : 0
    const gstNet = gstCollected - gstPaid

    // Set-aside pot (suggested % of income received)
    const setAside = income * ((Number(settings.set_aside_percent) || 0) / 100)

    // Monthly cashflow
    const months = fyMonths(fy, startMonth).map(m => {
      const mi = paidFY.filter(i => inRange(i.created_at, m.start, m.end)).reduce((s, i) => s + (Number(i.amount) || 0), 0)
      const me = expFY.filter(e => inRange(e.expense_date, m.start, m.end)).reduce((s, e) => s + (Number(e.amount) || 0), 0)
      return { label: m.label, income: mi, expense: me, isCurrent: now >= m.start && now <= m.end }
    })
    const chartMax = Math.max(1, ...months.map(m => Math.max(m.income, m.expense)))

    // Goal + forecast
    const goal = goals.find(g => g.financial_year === fy && g.period === 'annual')
    const target = goal ? Number(goal.target_amount) || 0 : 0
    let elapsed = 0
    fyMonths(fy, startMonth).forEach(m => { if (now >= m.start) elapsed++ })
    elapsed = Math.min(12, elapsed)
    const isCurrentFY = now >= range.start && now <= range.end
    const isPastFY = now > range.end
    const projected = isPastFY ? income : (elapsed > 0 ? (income / elapsed) * 12 : 0)

    // Per-project profitability (FY)
    const revBy = {}, expBy = {}
    paidFY.forEach(i => { if (i.project_id) revBy[i.project_id] = (revBy[i.project_id] || 0) + (Number(i.amount) || 0) })
    expFY.forEach(e => { if (e.project_id) expBy[e.project_id] = (expBy[e.project_id] || 0) + (Number(e.amount) || 0) })
    const projRows = projects
      .map(p => ({ id: p.id, title: p.title, rev: revBy[p.id] || 0, exp: expBy[p.id] || 0 }))
      .map(p => ({ ...p, profit: p.rev - p.exp }))
      .filter(p => p.rev || p.exp)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    // Recent activity (all-time, mixed)
    const acts = [
      ...invoices.filter(i => i.status === 'paid').map(i => ({ type: 'in', date: i.created_at, label: i.client_name || 'Invoice paid', amount: Number(i.amount) || 0 })),
      ...expenses.map(e => ({ type: 'out', date: e.expense_date, label: e.merchant || e.description || 'Expense', amount: Number(e.amount) || 0 })),
    ].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7)

    return { income, expenseTotal, profit, outstanding, overdueTotal, overdueCount: overdue.length, sentCount: sent.length,
      gstCollected, gstPaid, gstNet, setAside, months, chartMax, target, projected, elapsed, isCurrentFY, isPastFY, projRows, acts }
  }, [invoices, expenses, projects, goals, settings, fy, startMonth, range])

  function openSettings() {
    const goal = goals.find(g => g.financial_year === fy && g.period === 'annual')
    setSForm({
      gst_registered: !!settings.gst_registered,
      abn: settings.abn || '',
      set_aside_percent: settings.set_aside_percent ?? 30,
      goal: goal ? String(goal.target_amount) : '',
    })
    setShowSettings(true)
  }

  async function saveSettings() {
    setSavingS(true)
    const { error: e1 } = await supabase.from('finance_settings').upsert({
      creative_id: user.id,
      gst_registered: sForm.gst_registered,
      abn: sForm.abn || null,
      set_aside_percent: sForm.set_aside_percent === '' ? 0 : Number(sForm.set_aside_percent),
      fy_start_month: startMonth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'creative_id' })

    let e2 = null
    if (sForm.goal !== '' && !Number.isNaN(Number(sForm.goal))) {
      const r = await supabase.from('financial_goals').upsert({
        creative_id: user.id, period: 'annual', financial_year: fy,
        target_amount: Number(sForm.goal), updated_at: new Date().toISOString(),
      }, { onConflict: 'creative_id,financial_year,period' })
      e2 = r.error
    }
    setSavingS(false)
    if (e1 || e2) { flash((e1 || e2).message, 'err'); return }
    setShowSettings(false)
    flash('Finance settings saved')
    load()
  }

  const goalPct = calc.target > 0 ? Math.min(100, (calc.income / calc.target) * 100) : 0
  const goalRemaining = Math.max(0, calc.target - calc.income)
  const onTrack = calc.target > 0 && calc.projected >= calc.target

  return (
    <div className="ltf">
      <style>{FINANCE_CSS}</style>
      <div className="inner">
        <FinanceTabs active="overview" />

        <div className="phead">
          <div>
            <h1>Finance</h1>
            <div className="sub">Your whole business at a glance. Income, expenses, GST and profit, built for Australian creatives.</div>
          </div>
          <div className="hactions">
            <div className="fypick">
              <button onClick={() => setFy(f => f - 1)} title="Previous year">‹</button>
              <span className="lbl">{fyLabel(fy)}</span>
              <button onClick={() => setFy(f => f + 1)} title="Next year">›</button>
            </div>
            <button className="btn" onClick={openSettings}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              Setup
            </button>
            <button className="btn primary" onClick={() => navigate('/dashboard/finance/expenses')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
              Log expense
            </button>
          </div>
        </div>

        {loading ? <div className="empty">Loading your finances…</div> : (
          <>
            {/* KPIs */}
            <div className="kpis">
              <div className="kpi">
                <span className="accent" style={{ background: '#1DB954' }} />
                <div className="klab"><svg className="kicon" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2.2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>Income</div>
                <div className="kval">{money0(calc.income)}</div>
                <div className="ksub">Paid this year</div>
              </div>
              <div className="kpi">
                <span className="accent" style={{ background: '#FF2D78' }} />
                <div className="klab"><svg className="kicon" viewBox="0 0 24 24" fill="none" stroke="#FF2D78" strokeWidth="2.2"><rect x="2" y="6" width="20" height="13" rx="2.5" /><path d="M2 10h20" /></svg>Expenses</div>
                <div className="kval">{money0(calc.expenseTotal)}</div>
                <div className="ksub">Deductible spend</div>
              </div>
              <div className="kpi">
                <span className="accent" style={{ background: '#4aa3ff' }} />
                <div className="klab"><svg className="kicon" viewBox="0 0 24 24" fill="none" stroke="#4aa3ff" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>Net profit</div>
                <div className="kval" style={{ color: calc.profit < 0 ? '#f0516d' : undefined }}>{money0(calc.profit)}</div>
                <div className="ksub">Income minus expenses</div>
              </div>
              <div className="kpi">
                <span className="accent" style={{ background: '#f5a524' }} />
                <div className="klab"><svg className="kicon" viewBox="0 0 24 24" fill="none" stroke="#f5a524" strokeWidth="2.2"><path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M16 12h.01" /><path d="M3 7l3-4h12l3 4" /></svg>Tax set-aside</div>
                <div className="kval">{money0(calc.setAside)}</div>
                <div className="ksub">{settings.set_aside_percent || 0}% of income · suggested</div>
              </div>
            </div>

            {/* Cashflow chart */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="prow">
                <div>
                  <div className="card-t">Cashflow</div>
                  <div className="card-s">Money in and out, month by month · {fyLabel(fy)}</div>
                </div>
                <div className="legend" style={{ marginTop: 0 }}>
                  <span><i style={{ background: '#1DB954' }} />Income</span>
                  <span><i style={{ background: '#FF2D78' }} />Expenses</span>
                </div>
              </div>
              <div className="chart">
                {[0, 0.5, 1].map((f, i) => <div key={i} className="gl" style={{ bottom: `${f * 150 + 24}px` }} />)}
                {calc.months.map((m, i) => (
                  <div className="cbarwrap" key={i} title={`${m.label}: in ${money(m.income)} · out ${money(m.expense)}`}>
                    <div className="cbars">
                      <div className="cbar inc" style={{ height: `${(m.income / calc.chartMax) * 100}%` }} />
                      <div className="cbar exp" style={{ height: `${(m.expense / calc.chartMax) * 100}%` }} />
                    </div>
                    <span className="clbl" style={{ color: m.isCurrent ? '#1DB954' : undefined, fontWeight: m.isCurrent ? 800 : 600 }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Goal + Money owed */}
            <div className="grid2" style={{ marginBottom: 14 }}>
              <div className="card">
                <div className="card-t">Revenue goal</div>
                <div className="card-s">{calc.target > 0 ? `Target for ${fyLabel(fy)}` : 'Set a target to track your year'}</div>
                {calc.target > 0 ? (
                  <>
                    <div className="prow" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{money0(calc.income)}</span>
                      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>of {money0(calc.target)}</span>
                    </div>
                    <div className="prog"><i style={{ width: `${goalPct}%` }} /></div>
                    <div className="prow" style={{ marginTop: 10 }}>
                      <span className="faint" style={{ fontSize: 12 }}>{goalPct.toFixed(0)}% reached · {money0(goalRemaining)} to go</span>
                    </div>
                    {calc.isCurrentFY && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--lt-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div className="faint" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projected</div>
                          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>{money0(calc.projected)}</div>
                        </div>
                        <span className="pill" style={{ background: onTrack ? 'rgba(29,185,84,0.15)' : 'rgba(245,165,36,0.16)', color: onTrack ? '#1DB954' : '#f5a524' }}>
                          <span className="dot" style={{ background: onTrack ? '#1DB954' : '#f5a524' }} />{onTrack ? 'On track' : 'Behind pace'}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '10px 0 6px' }}>
                    <button className="btn primary" onClick={openSettings}>Set a revenue goal</button>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="prow">
                  <div>
                    <div className="card-t">Money owed to you</div>
                    <div className="card-s">Sent invoices awaiting payment</div>
                  </div>
                  <button className="btn ghost sm" onClick={() => navigate('/dashboard/finance/invoicing')}>View</button>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{money0(calc.outstanding)}</div>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{calc.sentCount} invoice{calc.sentCount === 1 ? '' : 's'} outstanding</div>
                {calc.overdueTotal > 0 && (
                  <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 12, background: 'rgba(240,81,109,0.1)', border: '1px solid rgba(240,81,109,0.28)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0516d" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
                    <div style={{ fontSize: 12.5 }}><strong style={{ color: '#f0516d' }}>{money0(calc.overdueTotal)} overdue</strong> across {calc.overdueCount} invoice{calc.overdueCount === 1 ? '' : 's'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* GST + Top projects */}
            <div className="grid2" style={{ marginBottom: 14 }}>
              <div className="card">
                <div className="prow">
                  <div>
                    <div className="card-t">GST position</div>
                    <div className="card-s">{fyLabel(fy)}</div>
                  </div>
                  <button className="btn ghost sm" onClick={() => navigate('/dashboard/finance/tax')}>Tax Hub</button>
                </div>
                {settings.gst_registered ? (
                  <>
                    <div className="grid2" style={{ gap: 10 }}>
                      <div>
                        <div className="faint" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collected</div>
                        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{money0(calc.gstCollected)}</div>
                      </div>
                      <div>
                        <div className="faint" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid on expenses</div>
                        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{money0(calc.gstPaid)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--lt-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }} className="muted">Net GST {calc.gstNet >= 0 ? 'to pay' : 'refund'}</span>
                      <span style={{ fontSize: 19, fontWeight: 800, color: calc.gstNet >= 0 ? '#f5a524' : '#1DB954' }}>{money0(Math.abs(calc.gstNet))}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '4px 0' }}>
                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 12 }}>You're marked as not registered for GST. Turn it on once you're registered and LensTrybe tracks GST collected and paid automatically.</div>
                    <button className="btn" onClick={openSettings}>I'm registered for GST</button>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-t">Most profitable projects</div>
                <div className="card-s">Revenue minus expenses · {fyLabel(fy)}</div>
                {calc.projRows.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13, padding: '14px 0' }}>Link invoices and expenses to a project to see which jobs make you the most.</div>
                ) : calc.projRows.map(p => (
                  <div key={p.id} className="catrow" style={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{money0(p.rev)} in · {money0(p.exp)} out</div>
                    </div>
                    <div className="tnum" style={{ color: p.profit < 0 ? '#f0516d' : '#1DB954', fontSize: 14 }}>{money0(p.profit)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="card pad0">
              <div style={{ padding: '16px 18px 6px' }}>
                <div className="card-t">Recent activity</div>
              </div>
              {calc.acts.length === 0 ? (
                <div className="empty" style={{ padding: '30px 20px' }}>No activity yet. Paid invoices and logged expenses show up here.</div>
              ) : (
                <div>
                  {calc.acts.map((a, i) => (
                    <div key={i} className="lrow" style={{ gridTemplateColumns: '34px 1fr auto' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.type === 'in' ? 'rgba(29,185,84,0.14)' : 'rgba(255,45,120,0.13)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={a.type === 'in' ? '#1DB954' : '#FF2D78'} strokeWidth="2.4">
                          {a.type === 'in' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
                        </svg>
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</div>
                        <div className="faint" style={{ fontSize: 11.5 }}>{a.type === 'in' ? 'Payment received' : 'Expense'} · {prettyDate(a.date)}</div>
                      </div>
                      <div className="tnum" style={{ color: a.type === 'in' ? '#1DB954' : 'var(--lt-text)', fontSize: 14 }}>{a.type === 'in' ? '+' : '−'}{money0(a.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showSettings && (
        <div className="modal" onClick={() => setShowSettings(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">Finance setup</div>
            <div className="msub">Set these once. They power your GST tracking, tax set-aside and revenue goal.</div>

            <div className="field">
              <label className="lab">Revenue goal for {fyLabel(fy)} (AUD)</label>
              <input className="inp" type="number" min="0" step="100" value={sForm.goal} onChange={e => setSForm(f => ({ ...f, goal: e.target.value }))} placeholder="e.g. 80000" />
            </div>

            <div className="field">
              <label className="lab">Tax set-aside</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input className="inp" type="number" min="0" max="100" step="1" style={{ maxWidth: 110 }} value={sForm.set_aside_percent} onChange={e => setSForm(f => ({ ...f, set_aside_percent: e.target.value }))} />
                <span className="muted" style={{ fontSize: 13 }}>% of income set aside for tax</span>
              </div>
              <div className="hint">A rough guide for sole traders is 25–30%. LensTrybe uses this to show how much to keep aside so tax time never stings.</div>
            </div>

            <div className="field">
              <div className="toggle" onClick={() => setSForm(f => ({ ...f, gst_registered: !f.gst_registered }))}>
                <span className={'switch' + (sForm.gst_registered ? ' on' : '')}><i /></span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Registered for GST</span>
              </div>
              <div className="hint">Turn on once your ABN is registered for GST (required once you turn over $75k+). We'll track GST on your invoices and expenses.</div>
            </div>

            {sForm.gst_registered && (
              <div className="field">
                <label className="lab">ABN</label>
                <input className="inp" value={sForm.abn} onChange={e => setSForm(f => ({ ...f, abn: e.target.value }))} placeholder="12 345 678 901" />
              </div>
            )}

            <div className="mactions">
              <button className="btn" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn primary" disabled={savingS} onClick={saveSettings}>{savingS ? 'Saving…' : 'Save setup'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast show' + (toast.type === 'err' ? ' err' : '')}>{toast.type === 'err' ? '⚠' : '✓'} {toast.msg}</div>}
    </div>
  )
}
