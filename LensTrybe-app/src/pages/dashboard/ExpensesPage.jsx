import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import FinanceTabs from '../../components/dashboard/FinanceTabs'
import {
  FINANCE_CSS, money, money0, fyStartYear, fyRange, fyLabel, inRange, prettyDate,
  gstComponent, EXPENSE_CATEGORIES, CATEGORY_MAP, categoryLabel, categoryColor, PAYMENT_METHODS,
} from '../../lib/financeStyles'

function shortDate(d) {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
}

const BLANK = {
  expense_date: new Date().toISOString().slice(0, 10),
  merchant: '', description: '', category: 'equipment', amount: '',
  has_gst: true, is_deductible: true, payment_method: 'Card', project_id: '', notes: '',
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [projects, setProjects] = useState([])
  const [fy, setFy] = useState(fyStartYear())
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [projFilter, setProjFilter] = useState('')
  const [toast, setToast] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [file, setFile] = useState(null)
  const [existingReceipt, setExistingReceipt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { if (user) load() }, [user])

  function flash(msg, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 2400) }

  async function load() {
    setLoading(true)
    const [ex, pj] = await Promise.all([
      supabase.from('expenses').select('*').eq('creative_id', user.id).order('expense_date', { ascending: false }),
      supabase.from('projects').select('id, title').eq('creative_id', user.id).order('created_at', { ascending: false }),
    ])
    setRows(ex.data || [])
    setProjects(pj.data || [])
    setLoading(false)
  }

  const range = useMemo(() => fyRange(fy, 7), [fy])
  const projTitle = useMemo(() => { const m = {}; projects.forEach(p => { m[p.id] = p.title }); return m }, [projects])

  const inFy = useMemo(() => rows.filter(r => inRange(r.expense_date, range.start, range.end)), [rows, range])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inFy.filter(r =>
      (!q || (r.merchant || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q)) &&
      (!catFilter || r.category === catFilter) &&
      (!projFilter || r.project_id === projFilter))
  }, [inFy, search, catFilter, projFilter])

  const totals = useMemo(() => {
    const total = inFy.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const gst = inFy.reduce((s, r) => s + (r.gst_amount != null ? Number(r.gst_amount) || 0 : (r.has_gst ? gstComponent(r.amount) : 0)), 0)
    const deductible = inFy.filter(r => r.is_deductible).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const byCat = {}
    inFy.forEach(r => { byCat[r.category || 'other'] = (byCat[r.category || 'other'] || 0) + (Number(r.amount) || 0) })
    const cats = Object.entries(byCat).map(([k, v]) => ({ key: k, label: categoryLabel(k), color: categoryColor(k), value: v }))
      .sort((a, b) => b.value - a.value)
    const catMax = Math.max(1, ...cats.map(c => c.value))
    return { total, gst, deductible, count: inFy.length, cats, catMax }
  }, [inFy])

  function openNew() { setEditing(null); setForm(BLANK); setFile(null); setExistingReceipt(null); setShowModal(true) }
  function openEdit(r) {
    setEditing(r)
    setForm({
      expense_date: r.expense_date || new Date().toISOString().slice(0, 10),
      merchant: r.merchant || '', description: r.description || '', category: r.category || 'other',
      amount: r.amount != null ? String(r.amount) : '', has_gst: !!r.has_gst, is_deductible: !!r.is_deductible,
      payment_method: r.payment_method || 'Card', project_id: r.project_id || '', notes: r.notes || '',
    })
    setFile(null)
    setExistingReceipt(r.receipt_path ? { path: r.receipt_path } : null)
    setShowModal(true)
  }

  async function save() {
    if (form.amount === '' || Number.isNaN(Number(form.amount))) { flash('Enter an amount', 'err'); return }
    setSaving(true)
    let receipt_path = existingReceipt ? existingReceipt.path : null
    if (file) {
      const ext = (file.name.split('.').pop() || 'dat').toLowerCase()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const up = await supabase.storage.from('receipts').upload(path, file, { upsert: false })
      if (up.error) { setSaving(false); flash('Receipt upload failed: ' + up.error.message, 'err'); return }
      receipt_path = path
    }
    const amount = Number(form.amount)
    const payload = {
      creative_id: user.id,
      expense_date: form.expense_date || new Date().toISOString().slice(0, 10),
      merchant: form.merchant || null,
      description: form.description || null,
      category: form.category || 'other',
      amount,
      has_gst: form.has_gst,
      gst_amount: form.has_gst ? Number((amount / 11).toFixed(2)) : 0,
      is_deductible: form.is_deductible,
      payment_method: form.payment_method || null,
      project_id: form.project_id || null,
      notes: form.notes || null,
      receipt_path,
      updated_at: new Date().toISOString(),
    }
    let error
    if (editing) ({ error } = await supabase.from('expenses').update(payload).eq('id', editing.id))
    else ({ error } = await supabase.from('expenses').insert(payload))
    setSaving(false)
    if (error) { flash(error.message, 'err'); return }
    setShowModal(false)
    flash(editing ? 'Expense updated' : 'Expense added')
    load()
  }

  async function doDelete(r) {
    setConfirmDel(null)
    if (r.receipt_path) { await supabase.storage.from('receipts').remove([r.receipt_path]).catch(() => {}) }
    const { error } = await supabase.from('expenses').delete().eq('id', r.id)
    if (error) { flash(error.message, 'err'); return }
    flash('Expense deleted')
    load()
  }

  async function viewReceipt(path) {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) { flash('Could not open receipt', 'err'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const projectOptions = [{ id: '', title: 'No project' }, ...projects]

  return (
    <div className="ltf">
      <style>{FINANCE_CSS}</style>
      <div className="inner">
        <FinanceTabs active="expenses" />

        <div className="phead">
          <div>
            <h1>Expenses</h1>
            <div className="sub">Track every deductible dollar, tag it to a project and keep receipts in one place.</div>
          </div>
          <div className="hactions">
            <div className="fypick">
              <button onClick={() => setFy(f => f - 1)} title="Previous year">‹</button>
              <span className="lbl">{fyLabel(fy)}</span>
              <button onClick={() => setFy(f => f + 1)} title="Next year">›</button>
            </div>
            <button className="btn primary" onClick={openNew}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
              Add expense
            </button>
          </div>
        </div>

        {loading ? <div className="empty">Loading expenses…</div> : (
          <>
            <div className="kpis">
              <div className="kpi"><span className="accent" style={{ background: '#FF2D78' }} /><div className="klab">Total spend</div><div className="kval">{money0(totals.total)}</div><div className="ksub">{fyLabel(fy)}</div></div>
              <div className="kpi"><span className="accent" style={{ background: '#f5a524' }} /><div className="klab">GST paid</div><div className="kval">{money0(totals.gst)}</div><div className="ksub">Claimable on BAS</div></div>
              <div className="kpi"><span className="accent" style={{ background: '#1DB954' }} /><div className="klab">Deductible</div><div className="kval">{money0(totals.deductible)}</div><div className="ksub">Reduces taxable income</div></div>
              <div className="kpi"><span className="accent" style={{ background: '#4aa3ff' }} /><div className="klab">Logged</div><div className="kval">{totals.count}</div><div className="ksub">Expenses this year</div></div>
            </div>

            {totals.cats.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-t">Spending by category</div>
                <div className="card-s">Where your money went · {fyLabel(fy)}</div>
                {totals.cats.map(c => (
                  <div key={c.key} className="catrow" style={{ cursor: 'pointer' }} onClick={() => setCatFilter(catFilter === c.key ? '' : c.key)}>
                    <span className="catdot" style={{ background: c.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, width: 168, flex: '0 0 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="hide-m">{c.label}</span>
                    <div className="catbar"><i style={{ width: `${(c.value / totals.catMax) * 100}%`, background: c.color }} /></div>
                    <span className="tnum" style={{ fontSize: 13, width: 76, textAlign: 'right', flex: '0 0 auto' }}>{money0(c.value)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="toolbar">
              <div className="search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
                <input placeholder="Search merchant, note…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="filter" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">All categories</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select className="filter" value={projFilter} onChange={e => setProjFilter(e.target.value)}>
                <option value="">All projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="card"><div className="empty"><div className="big">No expenses{inFy.length ? ' match your filters' : ' yet'}</div>{inFy.length ? 'Try clearing the filters.' : 'Add your first expense to start tracking deductions.'}</div></div>
            ) : (
              <div className="list">
                <div className="lrow head" style={{ gridTemplateColumns: '92px 1fr 150px 96px 92px 40px' }}>
                  <span>Date</span><span>Expense</span><span className="hide-m">Category</span><span className="hide-m" style={{ textAlign: 'right' }}>GST</span><span style={{ textAlign: 'right' }}>Amount</span><span></span>
                </div>
                {filtered.map(r => {
                  const gst = r.gst_amount != null ? Number(r.gst_amount) || 0 : (r.has_gst ? gstComponent(r.amount) : 0)
                  return (
                    <div key={r.id} className="lrow click" style={{ gridTemplateColumns: '92px 1fr 150px 96px 92px 40px' }} onClick={() => openEdit(r)}>
                      <span className="faint" style={{ fontSize: 12.5 }}>{shortDate(r.expense_date)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.merchant || r.description || 'Expense'}</span>
                        {r.project_id && <span className="faint" style={{ fontSize: 11 }}>{projTitle[r.project_id] || 'Project'}</span>}
                        {!r.is_deductible && <span className="faint" style={{ fontSize: 11 }}> · non-deductible</span>}
                      </span>
                      <span className="hide-m"><span className="pill" style={{ background: categoryColor(r.category) + '22', color: categoryColor(r.category) }}><span className="dot" style={{ background: categoryColor(r.category) }} />{categoryLabel(r.category)}</span></span>
                      <span className="hide-m faint tnum" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{gst > 0 ? money(gst, { cents: true }) : '—'}</span>
                      <span className="tnum" style={{ textAlign: 'right', fontSize: 13.5 }}>{money(r.amount, { cents: true })}</span>
                      <span style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        {r.receipt_path
                          ? <span className="rthumb" title="View receipt" onClick={() => viewReceipt(r.receipt_path)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z" /><path d="M9 8h6M9 12h6" /></svg></span>
                          : <span className="rthumb faint" title="No receipt" style={{ opacity: .4, cursor: 'default' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z" /></svg></span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modalbox" onClick={e => e.stopPropagation()}>
            <div className="mtitle">{editing ? 'Edit expense' : 'Add expense'}</div>
            <div className="msub">Keep it deductible. Tag a project to see true per-job profit.</div>

            <div className="fgrid2">
              <div className="field">
                <label className="lab">Date</label>
                <input className="inp" type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="lab">Amount (AUD, inc GST)</label>
                <input className="inp" type="number" min="0" step="0.01" autoFocus value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
            </div>

            <div className="field">
              <label className="lab">Merchant / who you paid</label>
              <input className="inp" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} placeholder="B&H Photo, Adobe, Uber…" />
            </div>

            <div className="fgrid2">
              <div className="field">
                <label className="lab">Category</label>
                <select className="inp" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="lab">Project (optional)</label>
                <select className="inp" value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                  {projectOptions.map(p => <option key={p.id || 'none'} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>

            <div className="fgrid2">
              <div className="field">
                <label className="lab">Payment method</label>
                <select className="inp" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="lab">Description (optional)</label>
                <input className="inp" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was it for" />
              </div>
            </div>

            <div className="field" style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="toggle" onClick={() => setForm(f => ({ ...f, has_gst: !f.has_gst }))}>
                <span className={'switch' + (form.has_gst ? ' on' : '')}><i /></span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Includes GST {form.has_gst && form.amount ? <span className="faint">({money(Number(form.amount) / 11, { cents: true })})</span> : null}</span>
              </div>
              <div className="toggle" onClick={() => setForm(f => ({ ...f, is_deductible: !f.is_deductible }))}>
                <span className={'switch' + (form.is_deductible ? ' on' : '')}><i /></span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Tax deductible</span>
              </div>
            </div>

            <div className="field">
              <label className="lab">Receipt</label>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn sm" type="button" onClick={() => fileRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
                  {file ? 'Change file' : existingReceipt ? 'Replace receipt' : 'Attach receipt'}
                </button>
                {file && <span className="faint" style={{ fontSize: 12.5 }}>{file.name}</span>}
                {!file && existingReceipt && <button className="btn ghost sm" type="button" onClick={() => viewReceipt(existingReceipt.path)}>View current</button>}
              </div>
            </div>

            <div className="field">
              <label className="lab">Notes (optional)</label>
              <textarea className="inp" style={{ minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything worth remembering" />
            </div>

            <div className="mactions">
              {editing && <button className="btn ghost" style={{ marginRight: 'auto', color: '#f0516d' }} onClick={() => setConfirmDel(editing)}>Delete</button>}
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="modal" onClick={() => setConfirmDel(null)}>
          <div className="modalbox" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="mtitle">Delete this expense?</div>
            <div className="msub">{confirmDel.merchant || confirmDel.description || 'This expense'} · {money(confirmDel.amount, { cents: true })}. This can't be undone.</div>
            <div className="mactions">
              <button className="btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn primary" style={{ background: '#f0516d', boxShadow: 'none' }} onClick={() => { const r = confirmDel; setShowModal(false); doDelete(r) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={'toast show' + (toast.type === 'err' ? ' err' : '')}>{toast.type === 'err' ? '⚠' : '✓'} {toast.msg}</div>}
    </div>
  )
}
