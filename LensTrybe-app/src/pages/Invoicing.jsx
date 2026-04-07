import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

const SEND_INVOICE_URL =
  'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-invoice'

const STATUS_OPTIONS = ['draft', 'sent', 'paid']

const initialForm = {
  client_name: '',
  client_email: '',
  due_date: '',
  status: 'draft',
}

const formatDateTime = (ts) => {
  if (!ts) return ""
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
};

function newLineItemRow() {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    description: '',
    quantity: '1',
    unit_price: '',
  }
}

function parseItemsFromRow(row) {
  const raw = row?.items
  if (raw == null) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeStoredItem(entry) {
  if (!entry || typeof entry !== 'object') return null
  const description = String(entry.description ?? entry.desc ?? '').trim()
  const quantity = Number(entry.quantity ?? entry.qty ?? 0)
  const unit_price = Number(entry.unit_price ?? entry.unitPrice ?? entry.price ?? 0)
  if (!Number.isFinite(quantity) || !Number.isFinite(unit_price)) return null
  return { description, quantity, unit_price }
}

function lineItemsTotal(lines) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
}

function getNormalizedInvoiceLines(row) {
  return parseItemsFromRow(row).map(normalizeStoredItem).filter(Boolean)
}

function buildItemsPayload(lineRows) {
  return lineRows
    .map((line) => ({
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price),
    }))
    .filter(
      (line) =>
        line.description.length > 0 &&
        Number.isFinite(line.quantity) &&
        line.quantity > 0 &&
        Number.isFinite(line.unit_price) &&
        line.unit_price >= 0,
    )
}

function getStatusInfo(row) {
  const raw = String(row?.status ?? 'draft').toLowerCase().trim()
  if (raw === 'draft') return { variant: 'draft', label: 'draft' }
  if (raw === 'sent') return { variant: 'sent', label: 'sent' }
  if (raw === 'paid') return { variant: 'paid', label: 'paid' }
  const label = String(row?.status ?? 'unknown').trim() || 'unknown'
  return { variant: 'unknown', label }
}

function resolveClientName(row) {
  return row?.client_name ?? row?.clientName ?? row?.name ?? 'Client'
}

function resolveClientEmail(row) {
  const e = row?.client_email ?? row?.clientEmail ?? row?.email ?? ''
  return typeof e === 'string' ? e.trim() : ''
}

function shortInvoiceNumber(id) {
  if (id == null || id === '') return '—'
  return String(id).slice(0, 8)
}

function formatDocumentDate(value) {
  if (value == null) return '—'
  const d =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value.includes('T') ? value : `${value}T12:00:00`)
        : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function resolveAmount(row) {
  const n = row?.amount ?? row?.total ?? row?.total_amount
  if (n === null || n === undefined || n === '') return null
  const num = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(num) ? num : null
}

function resolveInvoiceTotal(row) {
  const fromCol = resolveAmount(row)
  if (fromCol != null) return fromCol
  const normalized = parseItemsFromRow(row).map(normalizeStoredItem).filter(Boolean)
  return normalized.length ? lineItemsTotal(normalized) : null
}

function resolveDueDate(row) {
  const raw = row?.due_date ?? row?.dueDate ?? null
  if (raw == null || raw === '') return null
  const d = typeof raw === 'string' ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`) : new Date(raw)
  return Number.isNaN(d.getTime()) ? String(raw) : d
}

function formatDueDate(value) {
  if (value == null) return '—'
  if (value instanceof Date)
    return value.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  return String(value)
}

function formatMoney(amount) {
  if (amount === null || amount === undefined) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount)
  } catch {
    return String(amount)
  }
}

function formatLineItemCount(n) {
  if (n === 0) return '0 line items'
  if (n === 1) return '1 line item'
  return `${n} line items`
}

function Invoicing() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const [invoices, setInvoices] = useState([])
  const [form, setForm] = useState(initialForm)
  const [lineItems, setLineItems] = useState(() => [newLineItemRow()])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [sendInvoiceFeedback, setSendInvoiceFeedback] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [brandKit, setBrandKit] = useState(null)
  const [previewInvoice, setPreviewInvoice] = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const previewCloseRef = useRef(null)
  const invoiceContentRef = useRef(null)

  const draftTotal = useMemo(() => {
    const payload = buildItemsPayload(lineItems)
    return lineItemsTotal(payload)
  }, [lineItems])

  const previewLines = useMemo(
    () => (previewInvoice ? getNormalizedInvoiceLines(previewInvoice) : []),
    [previewInvoice],
  )

  const loadInvoices = useCallback(async () => {
    if (!supabase || !userId) { setInvoices([]); setLoading(false); return }
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('creative_id', userId)
      .order('created_at', { ascending: false })
    if (error) { setErrorMessage(error.message); setInvoices([]) }
    else setInvoices(data ?? [])
    setLoading(false)
  }, [userId])

  const loadBusinessProfile = useCallback(async () => {
    if (!supabase || !userId) { setBusinessName(''); return }
    const { data } = await supabase.from('profiles').select('business_name').eq('id', userId).maybeSingle()
    setBusinessName(data?.business_name?.trim() || '')
  }, [userId])

  const loadBrandKit = useCallback(async () => {
    if (!supabase || !userId) { setBrandKit(null); return }
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', userId).maybeSingle()
    setBrandKit(data || null)
  }, [userId])

  useEffect(() => {
    if (authLoading) return
    loadInvoices()
    loadBusinessProfile()
    loadBrandKit()
  }, [authLoading, loadInvoices, loadBusinessProfile, loadBrandKit])

  useEffect(() => {
    if (!previewInvoice) { setPdfGenerating(false); return undefined }
    const onKeyDown = (e) => { if (e.key === 'Escape') setPreviewInvoice(null) }
    window.addEventListener('keydown', onKeyDown)
    previewCloseRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewInvoice])

  const handleDownloadPdf = async () => {
    if (!invoiceContentRef.current || !previewInvoice || pdfGenerating) return
    const num = shortInvoiceNumber(previewInvoice.id)
    setPdfGenerating(true)
    setErrorMessage('')
    try {
      const canvas = await html2canvas(invoiceContentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let yOffset = 0
      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight)
        yOffset += pageHeight
      }
      pdf.save(`invoice-${num}.pdf`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not generate PDF.')
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((c) => ({ ...c, [name]: value }))
  }

  const updateLineItem = (id, field, value) => {
    setLineItems((prev) => prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)))
  }

  const addLineItem = () => setLineItems((prev) => [...prev, newLineItemRow()])

  const removeLineItem = (id) => {
    setLineItems((prev) => {
      const next = prev.filter((line) => line.id !== id)
      return next.length === 0 ? [newLineItemRow()] : next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccessMessage('')
    if (!supabase || !userId) { setErrorMessage('Not signed in.'); return }
    if (!form.client_name.trim()) { setErrorMessage('Client name is required.'); return }
    const itemsPayload = buildItemsPayload(lineItems)
    if (itemsPayload.length === 0) { setErrorMessage('Add at least one line item.'); return }
    const amountTotal = lineItemsTotal(itemsPayload)
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) { setErrorMessage('Invoice total must be greater than zero.'); return }
    setSubmitting(true)
    setErrorMessage('')
    const payload = {
      creative_id: userId,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      amount: amountTotal,
      items: itemsPayload,
      due_date: form.due_date || null,
      status: form.status,
    }
    const { error } = await supabase.from('invoices').insert(payload)
    if (error) setErrorMessage(error.message)
    else {
      setSuccessMessage('Invoice created.')
      setForm(initialForm)
      setLineItems([newLineItemRow()])
      await loadInvoices()
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!supabase || !id) return
    setSuccessMessage('')
    setDeletingId(id)
    setErrorMessage('')
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) setErrorMessage(error.message)
    else {
      setSuccessMessage('Invoice removed.')
      setInvoices((c) => c.filter((row) => row.id !== id))
      setPreviewInvoice((open) => (open?.id === id ? null : open))
    }
    setDeletingId(null)
  }

  const handleSendInvoice = async (row) => {
    if (!supabase || !userId || !row?.id) return
    setSendInvoiceFeedback((c) => c?.invoiceId === row.id ? null : c)
    setSendingId(row.id)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (sessionError || !accessToken) {
      setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: sessionError?.message ?? 'Session error.' })
      setSendingId(null); return
    }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('business_name, business_email').eq('id', userId).maybeSingle()
    if (profileError) { setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: profileError.message }); setSendingId(null); return }
    const bName = profile?.business_name?.trim() ?? ''
    const bEmail = profile?.business_email?.trim() ?? ''
    if (!bName) { setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: 'Add your business name in your profile before sending.' }); setSendingId(null); return }
    if (!bEmail || !bEmail.includes('@')) { setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: 'Add a valid business email in your profile before sending.' }); setSendingId(null); return }
    const to = typeof row.client_email === 'string' ? row.client_email.trim() : String(row.client_email ?? '').trim()
    if (!to) { setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: 'This invoice needs a client email before you can send it.' }); setSendingId(null); return }
    const normalizedItems = getNormalizedInvoiceLines(row)
    if (normalizedItems.length === 0) { setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: 'This invoice has no line items to send.' }); setSendingId(null); return }
    const payload = {
      to,
      clientName: typeof row.client_name === 'string' ? row.client_name : String(row.client_name ?? ''),
      businessName: bName,
      replyTo: bEmail,
      invoiceNumber: String(row.id).slice(0, 8),
      dueDate: row.due_date || 'Not set',
      amount: row.amount,
      items: normalizedItems,
      status: row.status,
    }
    try {
      const response = await fetch(SEND_INVOICE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let result = null
      try { result = await response.json() } catch { result = null }
      if (!response.ok) {
        setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: result?.error ?? `Send failed (${response.status})` })
        setSendingId(null); return
      }
      if (result?.success) {
        setSendInvoiceFeedback({ invoiceId: row.id, kind: 'success', message: 'Sent!' })
        setSendingId(null)
        window.setTimeout(() => setSendInvoiceFeedback((c) => c?.invoiceId === row.id && c?.kind === 'success' ? null : c), 2500)
      } else {
        setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: result?.error ?? 'Send failed.' })
        setSendingId(null)
      }
    } catch (err) {
      setSendInvoiceFeedback({ invoiceId: row.id, kind: 'error', message: err instanceof Error ? err.message : 'Network error.' })
      setSendingId(null)
    }
  }

  // Brand kit values
  const brandColor = brandKit?.primary_color || '#000000'
  const brandLogo = brandKit?.logo_url || ''

  const ui = {
    bg: '#0f0f0f',
    card: '#141414',
    border: '#1e1e1e',
    text: '#e8e8e8',
    muted: '#555',
    green: '#39ff14',
    yellow: '#facc15',
    red: '#f87171',
    grey: '#9ca3af',
  }

  const formTopRef = useRef(null)

  const statusPillStyle = (active) => ({
    padding: '6px 16px',
    borderRadius: 20,
    border: `1px solid ${active ? ui.green : '#2a2a2a'}`,
    background: active ? '#1e2a1e' : '#1a1a1a',
    color: active ? ui.green : '#666',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'default',
    userSelect: 'none',
  })

  const statusBadgeStyle = (variant) => {
    const v = String(variant || '').toLowerCase()
    if (v === 'paid') return { color: ui.green, border: `${ui.green}55`, bg: `${ui.green}18` }
    if (v === 'sent') return { color: ui.yellow, border: `${ui.yellow}55`, bg: `${ui.yellow}18` }
    if (v === 'draft') return { color: ui.grey, border: `${ui.grey}55`, bg: `${ui.grey}18` }
    if (v === 'overdue') return { color: ui.red, border: `${ui.red}55`, bg: `${ui.red}18` }
    return { color: ui.text, border: ui.border, bg: '#1a1a1a' }
  }

  if (authLoading)
    return (
      <section
        style={{
          background: ui.bg,
          minHeight: '100vh',
          padding: 28,
          color: ui.text,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0, color: ui.muted }}>Loading session…</p>
      </section>
    )

  if (!userId)
    return (
      <section
        style={{
          background: ui.bg,
          minHeight: '100vh',
          padding: 28,
          color: ui.text,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Invoicing</h1>
        <p style={{ margin: '8px 0 0', color: ui.muted, fontSize: 13 }}>Sign in to manage invoices.</p>
      </section>
    )

  return (
    <section
      style={{
        background: ui.bg,
        minHeight: '100vh',
        padding: 28,
        color: ui.text,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Invoicing</h1>
          <p style={{ margin: '8px 0 0', color: ui.muted, fontSize: 13 }}>
            Create and send professional invoices to your clients
          </p>
        </div>
        <button
          type="button"
          onClick={() => formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={{
            background: ui.green,
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          + New Invoice
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <span style={statusPillStyle(true)}>All</span>
        <span style={statusPillStyle(false)}>Draft</span>
        <span style={statusPillStyle(false)}>Sent</span>
        <span style={statusPillStyle(false)}>Paid</span>
        <span style={statusPillStyle(false)}>Overdue</span>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 18,
          }}
        >
          <div
            ref={formTopRef}
            style={{
              background: ui.card,
              border: `1px solid ${ui.border}`,
              borderRadius: 12,
              padding: 18,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>New Invoice</h2>

            <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="invoice-client-name" style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Client Name
                  </label>
                  <input
                    id="invoice-client-name"
                    name="client_name"
                    value={form.client_name}
                    onChange={handleFormChange}
                    required
                    autoComplete="off"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #2a2a2a',
                      background: '#1a1a1a',
                      color: '#e8e8e8',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="invoice-client-email" style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Client Email
                  </label>
                  <input
                    id="invoice-client-email"
                    name="client_email"
                    type="email"
                    value={form.client_email}
                    onChange={handleFormChange}
                    autoComplete="off"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #2a2a2a',
                      background: '#1a1a1a',
                      color: '#e8e8e8',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="invoice-due-date" style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Due Date
                  </label>
                  <input
                    id="invoice-due-date"
                    name="due_date"
                    type="date"
                    value={form.due_date}
                    onChange={handleFormChange}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #2a2a2a',
                      background: '#1a1a1a',
                      color: '#e8e8e8',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="invoice-status" style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Status
                  </label>
                  <select
                    id="invoice-status"
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #2a2a2a',
                      background: '#1a1a1a',
                      color: '#e8e8e8',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Line Items</div>
                  <button
                    type="button"
                    onClick={addLineItem}
                    style={{
                      borderRadius: 8,
                      border: '1px solid #2a2a2a',
                      background: '#1a1a1a',
                      color: '#666',
                      padding: '6px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Add
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                  {lineItems.map((line, index) => (
                    <div
                      key={line.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 90px 120px auto',
                        gap: 10,
                        alignItems: 'end',
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid #2a2a2a',
                        background: '#1a1a1a',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label htmlFor={`inv-desc-${line.id}`} style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Description
                        </label>
                        <input
                          id={`inv-desc-${line.id}`}
                          value={line.description}
                          onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                          placeholder="e.g. Portrait session"
                          autoComplete="off"
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid #2a2a2a',
                            background: '#1a1a1a',
                            color: '#e8e8e8',
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label htmlFor={`inv-qty-${line.id}`} style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Qty
                        </label>
                        <input
                          id={`inv-qty-${line.id}`}
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(e) => updateLineItem(line.id, 'quantity', e.target.value)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid #2a2a2a',
                            background: '#1a1a1a',
                            color: '#e8e8e8',
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label htmlFor={`inv-price-${line.id}`} style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Rate
                        </label>
                        <input
                          id={`inv-price-${line.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => updateLineItem(line.id, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid #2a2a2a',
                            background: '#1a1a1a',
                            color: '#e8e8e8',
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(line.id)}
                        disabled={lineItems.length === 1}
                        aria-label={`Remove line ${index + 1}`}
                        style={{
                          borderRadius: 8,
                          border: '1px solid #2a2a2a',
                          background: 'transparent',
                          color: ui.red,
                          padding: '10px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: lineItems.length === 1 ? 'not-allowed' : 'pointer',
                          opacity: lineItems.length === 1 ? 0.5 : 1,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1px solid ${ui.border}`,
                  }}
                >
                  <span style={{ color: ui.muted, fontWeight: 800 }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                    {formatMoney(draftTotal)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: ui.green,
                  color: '#000',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting || loading ? 'not-allowed' : 'pointer',
                  opacity: submitting || loading ? 0.6 : 1,
                }}
              >
                {submitting ? 'Creating…' : 'Create invoice'}
              </button>
            </form>
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>Invoices</h2>
            {loading ? (
              <p style={{ margin: '10px 0 0', color: ui.muted }}>Loading invoices…</p>
            ) : invoices.length === 0 ? (
              <div
                style={{
                  marginTop: 12,
                  border: `1px dashed ${ui.border}`,
                  borderRadius: 12,
                  padding: 22,
                  background: ui.card,
                  textAlign: 'center',
                  color: ui.muted,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>🧾</div>
                <div style={{ fontWeight: 900, color: ui.text }}>No invoices yet</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  Create your first invoice using the form.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {invoices.map((row) => {
                  const { variant, label } = getStatusInfo(row)
                  const total = resolveInvoiceTotal(row)
                  const due = resolveDueDate(row)
                  const createdAt = row?.created_at ? new Date(row.created_at) : null
                  const isOverdue =
                    variant !== 'paid' && due instanceof Date && due.getTime() < Date.now()
                  const badge = statusBadgeStyle(isOverdue ? 'overdue' : variant)
                  const rowSendFeedback =
                    sendInvoiceFeedback?.invoiceId === row.id ? sendInvoiceFeedback : null

                  return (
                    <div
                      key={row.id}
                      style={{
                        background: ui.card,
                        border: `1px solid ${ui.border}`,
                        borderRadius: 12,
                        padding: 16,
                        display: 'grid',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>
                            <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                              {resolveClientName(row)}
                            </span>
                          </div>
                          <div style={{ marginTop: 4, color: ui.muted, fontSize: 12 }}>
                            Invoice #{String(row.id).slice(0, 8)}
                          </div>
                        </div>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: 999,
                            border: `1px solid ${badge.border}`,
                            background: badge.bg,
                            color: badge.color,
                            fontSize: 11,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isOverdue ? 'overdue' : label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ color: ui.muted, fontSize: 12, fontWeight: 800 }}>Amount</div>
                          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>
                            {formatMoney(total)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: ui.muted, fontSize: 12, fontWeight: 800 }}>Created</div>
                          <div style={{ fontSize: 13, fontWeight: 900 }}>
                            {createdAt ? formatDateTime(createdAt) : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: ui.muted, fontSize: 12, fontWeight: 800 }}>Due</div>
                          <div style={{ fontSize: 13, fontWeight: 900 }}>
                            {formatDueDate(due)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(row)}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 10,
                            border: `1px solid ${ui.border}`,
                            background: '#101010',
                            color: ui.text,
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          disabled={sendingId === row.id || deletingId === row.id}
                          onClick={() => handleSendInvoice(row)}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 10,
                            border: `1px solid ${ui.border}`,
                            background: '#101010',
                            color: ui.text,
                            fontSize: 12,
                            fontWeight: 900,
                            cursor:
                              sendingId === row.id || deletingId === row.id
                                ? 'not-allowed'
                                : 'pointer',
                            opacity: sendingId === row.id || deletingId === row.id ? 0.6 : 1,
                          }}
                        >
                          {sendingId === row.id ? 'Sending...' : 'Send'}
                        </button>

                        <button
                          type="button"
                          disabled
                          title="Mark Paid UI only (no existing mutation in this file)."
                          style={{
                            padding: '9px 10px',
                            borderRadius: 10,
                            border: `1px solid ${ui.border}`,
                            background: 'transparent',
                            color: ui.muted,
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: 'not-allowed',
                            opacity: 0.6,
                          }}
                        >
                          Mark Paid
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === row.id || sendingId === row.id}
                          onClick={() => handleDelete(row.id)}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 10,
                            border: `1px solid ${ui.border}`,
                            background: 'transparent',
                            color: ui.red,
                            fontSize: 12,
                            fontWeight: 900,
                            cursor:
                              deletingId === row.id || sendingId === row.id
                                ? 'not-allowed'
                                : 'pointer',
                            opacity: deletingId === row.id || sendingId === row.id ? 0.6 : 1,
                          }}
                        >
                          {deletingId === row.id ? 'Removing…' : 'Delete'}
                        </button>

                        {rowSendFeedback && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 12,
                              fontWeight: 900,
                              color: rowSendFeedback.kind === 'success' ? ui.green : ui.red,
                            }}
                            role={rowSendFeedback.kind === 'error' ? 'alert' : 'status'}
                          >
                            {rowSendFeedback.message}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div style={{ marginTop: 14 }}>
          {errorMessage && (
            <div style={{ color: ui.red, fontWeight: 900, fontSize: 13 }} role="alert">
              {errorMessage}
            </div>
          )}
          {successMessage && !errorMessage && (
            <div style={{ color: ui.green, fontWeight: 900, fontSize: 13 }} role="status">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {previewInvoice && (
        <div
          role="presentation"
          onClick={() => setPreviewInvoice(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '24px 12px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.65)',
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={invoiceContentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-preview-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 720,
              borderRadius: 12,
              background: '#fff',
              color: '#111827',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '22px 24px 24px', fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif" }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 16,
                  marginBottom: 16,
                  borderBottom: `3px solid ${brandColor}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {brandLogo && (
                    <img
                      src={brandLogo}
                      alt="Logo"
                      style={{ height: 48, width: 'auto', objectFit: 'contain' }}
                    />
                  )}
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>
                      {businessName || 'Your business'}
                    </p>
                    <h2
                      id="invoice-preview-title"
                      style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 900,
                        letterSpacing: '0.14em',
                        color: brandColor,
                      }}
                    >
                      INVOICE
                    </h2>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    disabled={pdfGenerating}
                    onClick={handleDownloadPdf}
                    style={{
                      padding: '9px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#111827',
                      background: '#fff',
                      border: '1px solid #111827',
                      borderRadius: 10,
                      cursor: pdfGenerating ? 'not-allowed' : 'pointer',
                      opacity: pdfGenerating ? 0.7 : 1,
                    }}
                  >
                    {pdfGenerating ? 'Generating…' : 'Download PDF'}
                  </button>
                  <button
                    ref={previewCloseRef}
                    type="button"
                    onClick={() => setPreviewInvoice(null)}
                    style={{
                      padding: '9px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#fff',
                      background: '#111827',
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>
                    Invoice #
                  </div>
                  <div style={{ fontWeight: 800 }}>{shortInvoiceNumber(previewInvoice.id)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>
                    Issue date
                  </div>
                  <div style={{ fontWeight: 800 }}>{formatDocumentDate(new Date())}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>
                    Due date
                  </div>
                  <div style={{ fontWeight: 800 }}>{formatDocumentDate(resolveDueDate(previewInvoice))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
                    Status
                  </div>
                  {(() => {
                    const { variant, label } = getStatusInfo(previewInvoice)
                    const map =
                      variant === 'paid'
                        ? { c: '#14532d', b: '#86efac', bg: '#dcfce7' }
                        : variant === 'sent'
                          ? { c: '#92400e', b: '#fcd34d', bg: '#fef3c7' }
                          : variant === 'draft'
                            ? { c: '#4b5563', b: '#d1d5db', bg: '#f3f4f6' }
                            : { c: '#4b5563', b: '#e5e7eb', bg: '#f9fafb' }
                    return (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: `1px solid ${map.b}`,
                          background: map.bg,
                          color: map.c,
                          fontSize: 11,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {label}
                      </span>
                    )
                  })()}
                </div>
              </div>

              <div
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: brandColor, marginBottom: 6 }}>
                  Bill to
                </div>
                <div style={{ fontWeight: 800 }}>{resolveClientName(previewInvoice)}</div>
                <div style={{ color: '#374151', marginTop: 4 }}>
                  {resolveClientEmail(previewInvoice) || <em style={{ color: '#9ca3af' }}>No email on file</em>}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                <thead style={{ background: `${brandColor}18` }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #111827', fontSize: 11, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#374151' }}>
                      Description
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #111827', fontSize: 11, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#374151' }}>
                      Qty
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #111827', fontSize: 11, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#374151' }}>
                      Unit price
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #111827', fontSize: 11, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#374151' }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.map((line, index) => (
                    <tr key={index}>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb' }}>
                        {line.description}
                      </td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {line.quantity}
                      </td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatMoney(line.unit_price)}
                      </td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatMoney(line.quantity * line.unit_price)}
                      </td>
                    </tr>
                  ))}
                  {previewLines.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', padding: 14 }}>
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 12, paddingTop: 10, borderTop: `2px solid ${brandColor}` }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#374151' }}>Total due</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: brandColor }}>
                  {formatMoney(resolveAmount(previewInvoice) ?? resolveInvoiceTotal(previewInvoice))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Invoicing
