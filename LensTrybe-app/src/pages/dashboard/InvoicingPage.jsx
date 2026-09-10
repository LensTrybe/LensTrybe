import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'
import { resolveDocTheme } from '../../lib/documentTemplate'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const BLUE = '#4A9EFF'
const AMBER = '#f59e0b'

function invoiceFreeTextForModeration(notes, lineItems) {
  const descs = (lineItems || []).map((i) => String(i.description ?? '').trim()).filter(Boolean)
  const n = String(notes ?? '').trim()
  return [n, ...descs].filter(Boolean).join('\n')
}

// Inject print styles (used by the View modal's Print / Save PDF button).
if (typeof document !== 'undefined' && !document.getElementById('invoice-print-style')) {
  const style = document.createElement('style')
  style.id = 'invoice-print-style'
  style.textContent = `@media print { body > * { display: none !important; } #invoice-print-area { display: block !important; position: fixed; inset: 0; padding: 40px; } }`
  document.head.appendChild(style)
}

const STATUS_META = {
  paid: { label: 'Paid', color: GREEN, bg: 'rgba(29,185,84,0.14)' },
  overdue: { label: 'Overdue', color: PINK, bg: 'rgba(255,45,120,0.14)' },
  sent: { label: 'Sent', color: BLUE, bg: 'rgba(74,158,255,0.16)' },
  viewed: { label: 'Viewed', color: AMBER, bg: 'rgba(245,158,11,0.16)' },
  draft: { label: 'Draft', color: 'var(--lt-muted)', bg: 'var(--lt-surface-2)' },
}
function statusMeta(s) { return STATUS_META[s] || STATUS_META.draft }

function getInvoiceItems(invoice) {
  return invoice?.line_items ?? invoice?.items ?? []
}

/** Merge brand_kit with per-document invoice settings via the shared resolver. */
function mergeInvoiceBrand(brandKit) {
  const t = resolveDocTheme(brandKit, 'invoice')
  return { primary: t.accent, accent: '#ffffff', font: 'Inter', logo: t.logoUrl || '', secondary: t.accentText, hasCustomTemplate: false, fontStack: t.bodyFont }
}

function StyleBlock() {
  return (
    <style>{`
      .lti-page { display: flex; flex-direction: column; gap: 22px; overflow-x: hidden; }
      .lti-input { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 13.5px; color: var(--lt-text); background: var(--lt-input-bg); border: 1px solid var(--lt-input-border); border-radius: 9px; padding: 9px 12px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
      .lti-input:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      .lti-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .lti-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .lti-btn-primary:hover { filter: brightness(1.06); }
      .lti-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .lti-btn-ghost:hover { background: var(--lt-surface-2); }
      .lti-btn:disabled { opacity: 0.5; cursor: default; }
      .lti-row { display: grid; grid-template-columns: 1fr 150px 120px 110px; gap: 12px; align-items: center; padding: 13px 18px; border-top: 1px solid var(--lt-hairline); cursor: pointer; transition: background .12s ease; }
      .lti-row:hover { background: var(--lt-surface-2); }
      .lti-chip { padding: 6px 13px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); }
      .lti-chip.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .lti-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .lti-modal { width: 100%; max-width: 720px; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); }
      .lti-mhead { padding: 14px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      @media (max-width: 767px) {
        .lti-row { grid-template-columns: 1fr auto; }
        .lti-row .lti-col-due, .lti-row .lti-col-status { display: none; }
        .lti-overlay { padding: 0; }
        .lti-modal { max-width: 100vw; max-height: 100vh; height: 100vh; border-radius: 0; }
        .lti-page button { min-height: 40px; }
      }
    `}</style>
  )
}

export default function InvoicingPage() {
  const { user, profile } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const invoicePrintRef = useRef(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [brandKit, setBrandKit] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [newInvoice, setNewInvoice] = useState({
    client_name: '', client_email: '', client_phone: '', client_address: '',
    due_date: '', notes: '', skill_type: '', discipline: '',
    line_items: [{ description: '', quantity: 1, rate: 0 }],
  })
  const [bankDetails, setBankDetails] = useState({ bank_name: '', bank_bsb: '', bank_account: '', bank_account_name: '' })
  const [editingBank, setEditingBank] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [invoiceViewModerationError, setInvoiceViewModerationError] = useState('')

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadBrandKit = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle()
    setBrandKit(data ?? null)
  }, [user])

  const loadInvoices = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('invoices').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setInvoices(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadInvoices(); loadBrandKit() }, [loadInvoices, loadBrandKit])
  useEffect(() => {
    window.addEventListener('focus', loadBrandKit)
    return () => window.removeEventListener('focus', loadBrandKit)
  }, [loadBrandKit])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  useEffect(() => {
    if (profile) {
      setBankDetails({
        bank_name: profile.bank_name ?? '', bank_bsb: profile.bank_bsb ?? '',
        bank_account: profile.bank_account ?? '', bank_account_name: profile.bank_account_name ?? '',
      })
    }
  }, [profile])

  function formatMoney(amount) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(amount) || 0)
  }

  async function createInvoice(status = 'draft') {
    if (!supabase || !user?.id) { setSaveError('You must be signed in to create an invoice.'); return }
    setSaveError('')
    const itext = invoiceFreeTextForModeration(newInvoice.notes, newInvoice.line_items)
    if (itext.trim()) {
      const mod = await moderateText(itext)
      if (mod?.blocked) { setSaveError(MODERATION_BLOCKED_USER_MESSAGE); return }
      if (mod?.flagged) console.warn('[moderation] Flagged new invoice text', mod.reason)
    }
    setSaving(true)
    const total = newInvoice.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
    const invoiceStatus = status === 'sent' ? 'draft' : status
    const { data, error } = await supabase.from('invoices').insert({
      creative_id: user.id,
      client_name: newInvoice.client_name.trim(),
      client_email: newInvoice.client_email.trim() || null,
      client_phone: newInvoice.client_phone.trim() || null,
      client_address: newInvoice.client_address.trim() || null,
      due_date: newInvoice.due_date || null,
      notes: newInvoice.notes?.trim() || null,
      items: newInvoice.line_items,
      amount: total,
      status: invoiceStatus,
      skill_type: newInvoice.skill_type || null,
      discipline: newInvoice.discipline || null,
    }).select().single()
    if (error) {
      setSaveError(error.message)
    } else {
      if (status === 'sent') {
        const sendMessage = await invokeSendInvoiceEdge(data)
        if (sendMessage) { setSaveError(sendMessage); setSaving(false); await loadInvoices(); return }
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', data.id)
      }
      await loadInvoices()
      setShowCreate(false)
      setSaveError('')
      setNewInvoice({ client_name: '', client_email: '', client_phone: '', client_address: '', due_date: '', notes: '', skill_type: '', discipline: '', line_items: [{ description: '', quantity: 1, rate: 0 }] })
    }
    setSaving(false)
  }

  async function markPaid(id) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    await loadInvoices()
  }

  async function deleteInvoice(id) {
    await supabase.from('invoices').delete().eq('id', id)
    await loadInvoices()
    setShowView(null); setEditingInvoice(false)
  }

  async function saveBankDetails() {
    setBankSaving(true)
    await supabase.from('profiles').update({
      bank_name: bankDetails.bank_name, bank_bsb: bankDetails.bank_bsb,
      bank_account: bankDetails.bank_account, bank_account_name: bankDetails.bank_account_name,
    }).eq('id', user.id)
    setBankSaving(false)
    setEditingBank(false)
  }

  async function saveInvoiceEdits() {
    const itext = invoiceFreeTextForModeration(editForm.notes, editForm.line_items)
    if (itext.trim()) {
      const mod = await moderateText(itext)
      if (mod?.blocked) { setInvoiceViewModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
      if (mod?.flagged) console.warn('[moderation] Flagged invoice edit text', mod.reason)
    }
    setInvoiceViewModerationError('')
    const total = editForm.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
    const { data } = await supabase.from('invoices').update({
      client_name: editForm.client_name,
      client_email: editForm.client_email || null,
      notes: editForm.notes?.trim() || null,
      items: editForm.line_items,
      amount: total,
    }).eq('id', showView.id).select().single()
    if (data) {
      setShowView(data)
      setInvoices(prev => prev.map(i => i.id === data.id ? data : i))
    }
    setEditingInvoice(false)
  }

  async function invokeSendInvoiceEdge(invoice) {
    if (!supabase || !invoice?.id) return 'Not configured.'
    const { data, error } = await supabase.functions.invoke('send-invoice', { body: { invoice_id: invoice.id } })
    if (error) return error.message
    if (data?.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
    return ''
  }

  async function sendInvoice(invoice) {
    if (!supabase || !user?.id || !invoice?.id) return
    setSending(true); setSendError('')
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice', { body: { invoice_id: invoice.id } })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
      await loadInvoices()
      setShowView(prev => (prev && prev.id === invoice.id ? { ...prev, status: 'sent' } : prev))
      setSendError('')
      showToast('Invoice sent successfully')
    } catch (err) {
      const msg = err?.message || 'Failed to send invoice'
      setSendError(msg); showToast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  function printInvoice() {
    const area = document.getElementById('invoice-print-area')
    if (!area) return
    const win = window.open('', '_blank')
    const safeFont = brandFontStack.replace(/</g, '')
    win.document.write(`<html><head><title>Invoice - ${showView?.client_name || ''}</title><style>body{font-family:${safeFont};margin:0;padding:40px;}@media print{body{padding:0;}}</style></head><body>${area.innerHTML}</body></html>`)
    win.document.close(); win.focus(); win.print()
  }

  // ---- brand + derived ----
  const invoiceBrand = useMemo(() => mergeInvoiceBrand(brandKit), [brandKit])
  const brandColor = invoiceBrand.primary
  const brandAccent = invoiceBrand.accent
  const brandLogo = invoiceBrand.logo
  const brandFontStack = invoiceBrand.fontStack
  const brandHeaderBg = { background: invoiceBrand.primary }
  const headerTextColor = invoiceBrand.secondary
  const invoiceDocSurface = { padding: isMobile ? '16px' : '40px 48px', overflowY: 'auto', flex: 1, background: '#fff', color: '#111', fontFamily: brandFontStack }

  const stats = useMemo(() => {
    let outstanding = 0, paid = 0, overdue = 0, drafts = 0
    for (const inv of invoices) {
      const a = Number(inv.amount) || 0
      if (inv.status === 'paid') paid += a
      else if (inv.status === 'overdue') { overdue += a; outstanding += a }
      else if (inv.status === 'sent' || inv.status === 'viewed') outstanding += a
      else if (inv.status === 'draft') drafts += 1
    }
    return { outstanding, paid, overdue, drafts }
  }, [invoices])

  const filtered = useMemo(() => {
    if (filter === 'all') return invoices
    return invoices.filter((i) => i.status === filter)
  }, [invoices, filter])

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
  ]

  const bankSummary = bankDetails.bank_account
    ? `${bankDetails.bank_name ? bankDetails.bank_name + ' · ' : ''}BSB ${bankDetails.bank_bsb} · Acct ${bankDetails.bank_account}${bankDetails.bank_account_name ? ' · ' + bankDetails.bank_account_name : ''}`
    : 'No bank details set yet. These appear on every invoice you send.'

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18 }
  const stat = { ...GLASS, flex: '1 1 150px', borderRadius: 16, padding: '16px 18px' }

  const customTemplateBanner = null // custom-template file preview intentionally not shown in the builder

  return (
    <>
      <StyleBlock />
      <style>{`@keyframes ltiSlide { from { transform: translateY(16px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : '#ef4444', color: toast.type === 'success' ? GREEN_DARK : '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 10px 30px -8px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 8, animation: 'ltiSlide .2s ease' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      <div className="lti-page">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Invoicing</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Create, send and track professional invoices.</p>
          </div>
          <button type="button" className="lti-btn lti-btn-primary" onClick={() => setShowCreate(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New invoice
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{formatMoney(stats.outstanding)}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Outstanding</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{formatMoney(stats.paid)}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Paid</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: stats.overdue ? PINK : 'var(--lt-text)' }}>{formatMoney(stats.overdue)}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Overdue</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{stats.drafts}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Drafts</div></div>
        </div>

        {/* Payment details */}
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)', marginBottom: 2 }}>Payment details</div>
              {!editingBank && <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>{bankSummary}</div>}
            </div>
            <button type="button" className={editingBank ? 'lti-btn lti-btn-primary' : 'lti-btn lti-btn-ghost'} onClick={() => editingBank ? saveBankDetails() : setEditingBank(true)}>
              {bankSaving ? 'Saving…' : editingBank ? 'Save details' : 'Edit'}
            </button>
          </div>
          {editingBank && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div><label style={{ fontSize: 12, color: 'var(--lt-faint)', display: 'block', marginBottom: 5 }}>Bank name</label><input className="lti-input" value={bankDetails.bank_name} onChange={e => setBankDetails(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. Commonwealth Bank" /></div>
              <div><label style={{ fontSize: 12, color: 'var(--lt-faint)', display: 'block', marginBottom: 5 }}>Account name</label><input className="lti-input" value={bankDetails.bank_account_name} onChange={e => setBankDetails(p => ({ ...p, bank_account_name: e.target.value }))} placeholder="e.g. Jane Smith" /></div>
              <div><label style={{ fontSize: 12, color: 'var(--lt-faint)', display: 'block', marginBottom: 5 }}>BSB</label><input className="lti-input" value={bankDetails.bank_bsb} onChange={e => setBankDetails(p => ({ ...p, bank_bsb: e.target.value }))} placeholder="e.g. 062-000" /></div>
              <div><label style={{ fontSize: 12, color: 'var(--lt-faint)', display: 'block', marginBottom: 5 }}>Account number</label><input className="lti-input" value={bankDetails.bank_account} onChange={e => setBankDetails(p => ({ ...p, bank_account: e.target.value }))} placeholder="e.g. 12345678" /></div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filters.map((f) => (
            <button key={f.key} type="button" className={`lti-chip${filter === f.key ? ' on' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1fr 150px 120px 110px', gap: 12, padding: '11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--lt-faint)' }}>
            <span>Client</span>
            {!isMobile && <span>Due date</span>}
            {!isMobile && <span style={{ textAlign: 'right' }}>Amount</span>}
            <span style={{ textAlign: isMobile ? 'right' : 'left' }}>{isMobile ? 'Amount' : 'Status'}</span>
          </div>
          {loading ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14, borderTop: '1px solid var(--lt-hairline)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14, borderTop: '1px solid var(--lt-hairline)' }}>
              {invoices.length === 0 ? 'No invoices yet. Create your first one.' : 'No invoices in this filter.'}
            </div>
          ) : filtered.map((inv) => {
            const m = statusMeta(inv.status)
            return (
              <div key={inv.id} className="lti-row" onClick={() => setShowView(inv)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.client_name || 'Untitled'}</div>
                  <div style={{ fontSize: 12, color: 'var(--lt-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.client_email || '—'}</div>
                  {isMobile && <span style={{ display: 'inline-block', marginTop: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: m.color, background: m.bg }}>{m.label}</span>}
                </div>
                <span className="lti-col-due" style={{ fontSize: 13, color: 'var(--lt-muted)' }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)', textAlign: 'right' }}>{formatMoney(inv.amount)}</span>
                <span className="lti-col-status" style={{ textAlign: 'left' }}>
                  <span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: m.color, background: m.bg }}>{m.label}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---- Create modal ---- */}
      {showCreate && (
        <div className="lti-overlay">
          <div className="lti-modal">
            <div className="lti-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>New invoice</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="lti-btn lti-btn-ghost" onClick={() => createInvoice('draft')} disabled={saving || !newInvoice.client_name}>{saving ? 'Saving…' : 'Save draft'}</button>
                <button className="lti-btn lti-btn-primary" onClick={() => createInvoice('sent')} disabled={saving || !newInvoice.client_name || !newInvoice.client_email}>{saving ? 'Sending…' : 'Send invoice'}</button>
                <button onClick={() => { setShowCreate(false); setNewInvoice({ client_name: '', client_email: '', client_phone: '', client_address: '', due_date: '', notes: '', skill_type: '', discipline: '', line_items: [{ description: '', quantity: 1, rate: 0 }] }) }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {saveError && <div style={{ padding: '11px 20px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13 }}>{saveError}</div>}

            {/* Internal analytics tags (not shown on the client's invoice) */}
            {(() => {
              const skillTypes = Array.isArray(profile?.skill_types) ? profile.skill_types : []
              const sbt = profile?.specialties_by_type && typeof profile.specialties_by_type === 'object' ? profile.specialties_by_type : {}
              const disciplineOptions = newInvoice.skill_type && Array.isArray(sbt[newInvoice.skill_type]) && sbt[newInvoice.skill_type].length ? sbt[newInvoice.skill_type] : (Array.isArray(profile?.specialties) ? profile.specialties : [])
              if (!skillTypes.length && !(Array.isArray(profile?.specialties) && profile.specialties.length)) return null
              return (
                <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--lt-hairline)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--lt-faint)', marginBottom: 8 }}>For your analytics only · not shown to the client</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select className="lti-input" style={{ flex: '1 1 180px' }} value={newInvoice.skill_type} onChange={e => setNewInvoice(p => ({ ...p, skill_type: e.target.value, discipline: '' }))}>
                      <option value="">Specialty (optional)</option>
                      {skillTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="lti-input" style={{ flex: '1 1 180px' }} value={newInvoice.discipline} onChange={e => setNewInvoice(p => ({ ...p, discipline: e.target.value }))}>
                      <option value="">Discipline (optional)</option>
                      {disciplineOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              )
            })()}

            {/* Invoice document (white, branded) */}
            <div style={invoiceDocSurface}>
              {customTemplateBanner}
              <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...brandHeaderBg, color: headerTextColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {brandLogo && <img src={brandLogo} alt="Logo" style={{ height: 48, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4, fontFamily: brandFontStack }}>{profile?.business_name ?? 'Your Business'}</div>
                      <div style={{ fontSize: 13, opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', fontFamily: brandFontStack }}>INVOICE</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${brandAccent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Bill To</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={newInvoice.client_name} onChange={e => setNewInvoice(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: 6, fontSize: 14, color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input value={newInvoice.client_email} onChange={e => setNewInvoice(p => ({ ...p, client_email: e.target.value }))} placeholder="Client email" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: 6, fontSize: 14, color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input value={newInvoice.client_phone} onChange={e => setNewInvoice(p => ({ ...p, client_phone: e.target.value }))} placeholder="Phone (optional)" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: 6, fontSize: 14, color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input value={newInvoice.client_address} onChange={e => setNewInvoice(p => ({ ...p, client_address: e.target.value }))} placeholder="Address (optional)" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: 6, fontSize: 14, color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input type="date" value={newInvoice.due_date} onChange={e => setNewInvoice(p => ({ ...p, due_date: e.target.value }))} style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: 6, fontSize: 14, color: '#111', width: isMobile ? '100%' : '50%', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: isMobile ? 560 : '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${brandColor}`, background: `${brandAccent}33` }}>
                      <th style={{ textAlign: 'left', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: 80 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: 100 }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: 100 }}>Amount</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {newInvoice.line_items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}><input value={item.description} onChange={e => setNewInvoice(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} placeholder="Description" style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, color: '#111', boxSizing: 'border-box' }} /></td>
                        <td style={{ padding: '8px 4px' }}><input type="number" value={item.quantity} onChange={e => setNewInvoice(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, textAlign: 'center', color: '#111', boxSizing: 'border-box' }} /></td>
                        <td style={{ padding: '8px 4px' }}><input type="number" value={item.rate} onChange={e => setNewInvoice(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, rate: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, textAlign: 'right', color: '#111', boxSizing: 'border-box' }} /></td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#111' }}>AUD {(Number(item.quantity) * Number(item.rate)).toFixed(2)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}><button onClick={() => setNewInvoice(p => ({ ...p, line_items: p.line_items.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button></td>
                      </tr>
                    ))}
                    <tr><td colSpan={5} style={{ paddingTop: 12 }}><button onClick={() => setNewInvoice(p => ({ ...p, line_items: [...p.line_items, { description: '', quantity: 1, rate: 0 }] }))} style={{ padding: '6px 14px', background: 'none', border: '1px dashed #d1d5db', borderRadius: 6, fontSize: 13, color: '#666', cursor: 'pointer' }}>+ Add line item</button></td></tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32, paddingTop: 16, borderTop: `1px solid ${brandAccent}` }}>
                <div style={{ width: 240 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `2px solid ${brandAccent}` }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>Total</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: brandColor }}>{formatMoney(newInvoice.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0))}</span>
                  </div>
                </div>
              </div>

              {(bankDetails.bank_account || bankDetails.bank_bsb) && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '16px 20px', marginBottom: 24, borderLeft: `4px solid ${brandAccent}`, borderTop: `1px solid ${brandAccent}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Payment Details</div>
                  {bankDetails.bank_name && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Bank: {bankDetails.bank_name}</div>}
                  {bankDetails.bank_account_name && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Account Name: {bankDetails.bank_account_name}</div>}
                  {bankDetails.bank_bsb && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>BSB: {bankDetails.bank_bsb}</div>}
                  {bankDetails.bank_account && <div style={{ fontSize: 13, color: '#374151' }}>Account: {bankDetails.bank_account}</div>}
                </div>
              )}

              <div style={{ paddingTop: 20, borderTop: `1px solid ${brandAccent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</div>
                <textarea value={newInvoice.notes ?? ''} onChange={e => setNewInvoice(p => ({ ...p, notes: e.target.value }))} placeholder="Add notes, payment instructions…" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, minHeight: 80, resize: 'vertical', color: '#111', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${brandAccent}`, fontSize: 12, color: '#999', textAlign: 'center' }}>Thank you for your business</div>
            </div>
          </div>
        </div>
      )}

      {/* ---- View modal ---- */}
      {showView && (
        <div className="lti-overlay">
          <div className="lti-modal">
            <div className="lti-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>Invoice</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="lti-btn lti-btn-ghost" onClick={() => {
                  if (editingInvoice) { void saveInvoiceEdits() }
                  else { setInvoiceViewModerationError(''); setEditingInvoice(true); setEditForm({ client_name: showView.client_name, client_email: showView.client_email, notes: showView.notes ?? '', line_items: getInvoiceItems(showView) }) }
                }} style={editingInvoice ? { color: GREEN, borderColor: 'rgba(29,185,84,0.4)' } : undefined}>{editingInvoice ? '✓ Save' : 'Edit'}</button>
                <button className="lti-btn lti-btn-ghost" onClick={printInvoice}>Print / PDF</button>
                {showView.status !== 'paid' && <button className="lti-btn lti-btn-ghost" style={{ color: GREEN, borderColor: 'rgba(29,185,84,0.4)' }} onClick={() => { markPaid(showView.id); setShowView(prev => ({ ...prev, status: 'paid' })) }}>✓ Mark paid</button>}
                {showView.status !== 'paid' && <button className="lti-btn lti-btn-primary" type="button" disabled={sending} onClick={() => sendInvoice(showView)}>{sending ? 'Sending…' : showView.status === 'sent' ? 'Resend' : 'Send'}</button>}
                <button className="lti-btn lti-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => deleteInvoice(showView.id)}>Delete</button>
                <button onClick={() => { setShowView(null); setEditingInvoice(false); setInvoiceViewModerationError('') }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {sendError && <div style={{ padding: '11px 20px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13 }}>{sendError}</div>}
            {invoiceViewModerationError && <div style={{ padding: '11px 20px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13 }}>{invoiceViewModerationError}</div>}

            <div ref={invoicePrintRef} id="invoice-print-area" style={invoiceDocSurface}>
              {customTemplateBanner}
              <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...brandHeaderBg, color: headerTextColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {brandLogo && <img src={brandLogo} alt="Logo" style={{ height: 48, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4, fontFamily: brandFontStack }}>{profile?.business_name ?? 'Your Business'}</div>
                      <div style={{ fontSize: 13, opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', fontFamily: brandFontStack }}>INVOICE</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>#{showView.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{new Date(showView.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: `1px solid ${brandAccent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Bill To</div>
                {editingInvoice ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111' }} placeholder="Client name" />
                    <input value={editForm.client_email} onChange={e => setEditForm(p => ({ ...p, client_email: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, color: '#111' }} placeholder="Client email" />
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{showView.client_name}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{showView.client_email}</div>
                    {showView.client_phone && <div style={{ fontSize: 13, color: '#666' }}>{showView.client_phone}</div>}
                    {showView.client_address && <div style={{ fontSize: 13, color: '#666' }}>{showView.client_address}</div>}
                  </>
                )}
              </div>

              <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${brandAccent}` }}>
                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: showView.status === 'paid' ? '#dcfce7' : showView.status === 'overdue' ? '#fee2e2' : '#f3f4f6', color: showView.status === 'paid' ? '#166534' : showView.status === 'overdue' ? '#991b1b' : '#374151' }}>{showView.status}</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: isMobile ? 560 : '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${brandColor}`, background: `${brandAccent}33` }}>
                      <th style={{ textAlign: 'left', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: 80 }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: 100 }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: 100 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingInvoice ? (
                      <>
                        {editForm.line_items.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 0' }}><input value={item.description} onChange={e => setEditForm(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} placeholder="Description" /></td>
                            <td style={{ padding: '8px 4px' }}><input type="number" value={item.quantity} onChange={e => setEditForm(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'center', boxSizing: 'border-box' }} /></td>
                            <td style={{ padding: '8px 4px' }}><input type="number" value={item.rate} onChange={e => setEditForm(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, rate: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} /></td>
                            <td style={{ padding: '8px 0', textAlign: 'right' }}><span style={{ fontSize: 13, fontWeight: 600 }}>AUD {(Number(item.quantity) * Number(item.rate)).toFixed(2)}</span><button onClick={() => setEditForm(p => ({ ...p, line_items: p.line_items.filter((_, j) => j !== i) }))} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button></td>
                          </tr>
                        ))}
                        <tr><td colSpan={4} style={{ paddingTop: 12 }}><button onClick={() => setEditForm(p => ({ ...p, line_items: [...p.line_items, { description: '', quantity: 1, rate: 0 }] }))} style={{ padding: '6px 14px', background: 'none', border: '1px dashed #d1d5db', borderRadius: 6, fontSize: 13, color: '#666', cursor: 'pointer' }}>+ Add line item</button></td></tr>
                      </>
                    ) : (
                      getInvoiceItems(showView).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '14px 0', fontSize: 14, color: '#111' }}>{item.description}</td>
                          <td style={{ padding: '14px 0', fontSize: 14, color: '#111', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '14px 0', fontSize: 14, color: '#111', textAlign: 'right' }}>{formatMoney(item.rate)}</td>
                          <td style={{ padding: '14px 0', fontSize: 14, color: '#111', textAlign: 'right', fontWeight: 600 }}>{formatMoney(Number(item.quantity) * Number(item.rate))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40, paddingTop: 16, borderTop: `1px solid ${brandAccent}` }}>
                <div style={{ width: 240 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `2px solid ${brandAccent}` }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>Total</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: brandColor }}>{formatMoney(editingInvoice ? editForm.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0) : Number(showView.amount))}</span>
                  </div>
                </div>
              </div>

              {(bankDetails.bank_account || bankDetails.bank_bsb) && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '16px 20px', marginBottom: 24, borderLeft: `4px solid ${brandAccent}`, borderTop: `1px solid ${brandAccent}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Payment Details</div>
                  {bankDetails.bank_name && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Bank: {bankDetails.bank_name}</div>}
                  {bankDetails.bank_account_name && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>Account Name: {bankDetails.bank_account_name}</div>}
                  {bankDetails.bank_bsb && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>BSB: {bankDetails.bank_bsb}</div>}
                  {bankDetails.bank_account && <div style={{ fontSize: 13, color: '#374151' }}>Account: {bankDetails.bank_account}</div>}
                </div>
              )}

              {(editingInvoice || showView.notes) && (
                <div style={{ borderTop: `1px solid ${brandAccent}`, paddingTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Notes</div>
                  {editingInvoice ? (
                    <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }} placeholder="Add notes…" />
                  ) : showView.notes ? (
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{showView.notes}</div>
                  ) : null}
                </div>
              )}

              <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${brandAccent}`, fontSize: 12, color: '#999', textAlign: 'center' }}>Thank you for your business</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
