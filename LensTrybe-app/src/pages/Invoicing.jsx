import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

const SEND_INVOICE_URL =
  'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-invoice'

const initialForm = {
  client_name: '',
  client_email: '',
  invoice_title: '',
  due_date: '',
  status: 'draft',
  tax_percent: '10',
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

function formatBsbInput(value) {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 6)
  if (d.length <= 3) return d
  return `${d.slice(0, 3)}-${d.slice(3)}`
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
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
  } catch {
    return String(amount)
  }
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

  const BANKING_DEFAULT = { region: 'au', accountHolder: '', bsb: '', accountNumber: '', international: '' }
  const [banking, setBanking] = useState(() => {
    if (typeof window === 'undefined') return BANKING_DEFAULT
    try {
      const raw = localStorage.getItem('lt-banking-details')
      if (raw) return { ...BANKING_DEFAULT, ...JSON.parse(raw) }
    } catch {
      /* ignore */
    }
    return BANKING_DEFAULT
  })
  const [invoiceFilter, setInvoiceFilter] = useState('all')
  const [paidUpdatingId, setPaidUpdatingId] = useState(null)

  const { draftSubtotal, draftTax, draftTotalWithTax } = useMemo(() => {
    const payload = buildItemsPayload(lineItems)
    const sub = lineItemsTotal(payload)
    const pct = Number(form.tax_percent)
    const tax = Number.isFinite(pct) ? sub * (pct / 100) : 0
    return { draftSubtotal: sub, draftTax: tax, draftTotalWithTax: sub + tax }
  }, [lineItems, form.tax_percent])

  const previewLines = useMemo(
    () => (previewInvoice ? getNormalizedInvoiceLines(previewInvoice) : []),
    [previewInvoice],
  )

  const revenueSummary = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    let monthInvoiced = 0
    let monthPaid = 0
    let ytdInvoiced = 0
    let ytdPaid = 0
    for (const inv of invoices) {
      const amt = Number(inv.amount) || 0
      const created = inv.created_at ? new Date(inv.created_at) : null
      if (!created || Number.isNaN(created.getTime())) continue
      const isPaid = String(inv.status).toLowerCase() === 'paid'
      if (created.getFullYear() === y && created.getMonth() === m) {
        monthInvoiced += amt
        if (isPaid) monthPaid += amt
      }
      if (created.getFullYear() === y) {
        ytdInvoiced += amt
        if (isPaid) ytdPaid += amt
      }
    }
    return { monthInvoiced, monthPaid, ytdInvoiced, ytdPaid }
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((row) => {
      const { variant } = getStatusInfo(row)
      const due = resolveDueDate(row)
      const overdue = variant !== 'paid' && due instanceof Date && due.getTime() < Date.now()
      if (invoiceFilter === 'all') return true
      if (invoiceFilter === 'overdue') return overdue
      if (invoiceFilter === 'paid') return variant === 'paid'
      if (invoiceFilter === 'draft') return variant === 'draft' && !overdue
      if (invoiceFilter === 'sent') return variant === 'sent' && !overdue
      return true
    })
  }, [invoices, invoiceFilter])

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
    let itemsPayload = buildItemsPayload(lineItems)
    if (itemsPayload.length === 0) { setErrorMessage('Add at least one line item.'); return }
    const titlePrefix = form.invoice_title.trim()
    if (titlePrefix) {
      itemsPayload = itemsPayload.map((it, idx) =>
        idx === 0 ? { ...it, description: `${titlePrefix} — ${it.description}`.trim() } : it,
      )
    }
    const subtotal = lineItemsTotal(itemsPayload)
    const taxPct = Number(form.tax_percent)
    const taxAmt = Number.isFinite(taxPct) ? subtotal * (taxPct / 100) : 0
    const amountTotal = subtotal + taxAmt
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

  const handleMarkPaid = async (id) => {
    if (!supabase || !id) return
    setSuccessMessage('')
    setErrorMessage('')
    setPaidUpdatingId(id)
    const { error } = await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    if (error) setErrorMessage(error.message)
    else {
      setSuccessMessage('Invoice marked as paid.')
      setInvoices((c) => c.map((row) => (row.id === id ? { ...row, status: 'paid' } : row)))
      setPreviewInvoice((open) => (open?.id === id ? { ...open, status: 'paid' } : open))
    }
    setPaidUpdatingId(null)
  }

  const saveBankingDetails = () => {
    try {
      localStorage.setItem('lt-banking-details', JSON.stringify(banking))
      setSuccessMessage('Banking details saved.')
      setErrorMessage('')
    } catch {
      setErrorMessage('Could not save banking details.')
    }
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

  const T = {
    pageBg: '#0a0a0f',
    text: 'rgb(242, 242, 242)',
    subtitle: '#666',
    muted: '#555',
    card: '#13131a',
    cardBorder: '1px solid #1e1e1e',
    inner: '#1a1a24',
    innerBorder: '1px solid #202027',
    inputBorder: '1px solid #202027',
    label: '#888',
    green: '#39ff14',
    yellow: '#facc15',
    red: '#f87171',
    grey: '#9ca3af',
    darkBtnBg: '#1a1a24',
    darkBtnBorder: '1px solid #202027',
    darkBtnColor: '#aaa',
  }

  const lbl = {
    color: T.label,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'block',
    marginBottom: 8,
  }

  const helperMuted = {
    color: T.label,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 1.45,
    fontFamily: 'Inter, sans-serif',
  }

  const sectionTitle = {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    borderLeft: `3px solid ${T.green}`,
    paddingLeft: 10,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'Inter, sans-serif',
  }

  const subSectionTitle = {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12,
    fontFamily: 'Inter, sans-serif',
  }

  const now = new Date()
  const monthTitle = now.toLocaleDateString('en-AU', { month: 'long' })
  const yearTitle = String(now.getFullYear())

  const inp = {
    background: T.inner,
    border: T.inputBorder,
    borderRadius: 8,
    padding: '10px 14px',
    color: 'rgb(242, 242, 242)',
    fontFamily: 'Inter, sans-serif',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const statusBadgeStyle = (variant) => {
    const v = String(variant || '').toLowerCase()
    if (v === 'paid') return { color: T.green, border: `${T.green}55`, bg: `${T.green}18` }
    if (v === 'sent') return { color: T.yellow, border: `${T.yellow}55`, bg: `${T.yellow}18` }
    if (v === 'draft') return { color: T.muted, border: `${T.muted}55`, bg: `${T.muted}18` }
    if (v === 'overdue') return { color: T.red, border: `${T.red}55`, bg: `${T.red}18` }
    return { color: T.text, border: T.innerBorder, bg: '#1a1a1a' }
  }

  const smallDarkBtn = (disabled) => ({
    background: T.darkBtnBg,
    border: T.darkBtnBorder,
    color: T.darkBtnColor,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    fontFamily: 'Inter, sans-serif',
  })

  if (authLoading)
    return (
      <section
        style={{
          background: T.pageBg,
          minHeight: '100vh',
          padding: 32,
          color: T.text,
          fontFamily: 'Inter, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Invoicing</div>
          <div style={{ fontSize: 13, color: T.subtitle, marginTop: 6 }}>Create and send professional invoices</div>
          <p style={{ margin: '18px 0 0', color: T.muted, fontSize: 13 }}>Loading session…</p>
        </div>
      </section>
    )

  if (!userId)
    return (
      <section
        style={{
          background: T.pageBg,
          minHeight: '100vh',
          padding: 32,
          color: T.text,
          fontFamily: 'Inter, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Invoicing</div>
          <div style={{ fontSize: 13, color: T.subtitle, marginTop: 6 }}>Create and send professional invoices</div>
          <p style={{ margin: '18px 0 0', color: T.muted, fontSize: 13 }}>Sign in to manage invoices.</p>
        </div>
      </section>
    )

  return (
    <section
      style={{
        background: T.pageBg,
        minHeight: '100vh',
        padding: 32,
        color: T.text,
        fontFamily: 'Inter, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Invoicing</div>
          <div style={{ fontSize: 13, color: T.subtitle, marginTop: 6 }}>Create and send professional invoices</div>
        </div>

        {(errorMessage || successMessage) && (
          <div style={{ marginBottom: 16 }}>
            {errorMessage && (
              <div style={{ color: T.red, fontWeight: 700, fontSize: 13 }} role="alert">
                {errorMessage}
              </div>
            )}
            {successMessage && !errorMessage && (
              <div style={{ color: T.green, fontWeight: 700, fontSize: 13 }} role="status">
                {successMessage}
              </div>
            )}
          </div>
        )}

        {/* Section 1 — Revenue Summary */}
        <div style={{ marginBottom: 20 }}>
          <div style={sectionTitle}>
            <span aria-hidden style={{ fontSize: 18 }}>
              📈
            </span>
            Revenue Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <div
              style={{
                background: T.card,
                border: T.cardBorder,
                borderRadius: 12,
                padding: 20,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 16, fontFamily: 'Inter, sans-serif' }}>
                This Month ({monthTitle})
              </div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>Invoiced</div>
              <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 14, lineHeight: 1.2, fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(revenueSummary.monthInvoiced)}
              </div>
              <div style={{ color: T.green, fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>Paid</div>
              <div style={{ color: T.green, fontSize: 26, fontWeight: 800, lineHeight: 1.2, fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(revenueSummary.monthPaid)}
              </div>
            </div>
            <div
              style={{
                background: T.card,
                border: T.cardBorder,
                borderRadius: 12,
                padding: 20,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 16, fontFamily: 'Inter, sans-serif' }}>
                Year to Date ({yearTitle})
              </div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>Invoiced</div>
              <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 14, lineHeight: 1.2, fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(revenueSummary.ytdInvoiced)}
              </div>
              <div style={{ color: T.green, fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>Paid</div>
              <div style={{ color: T.green, fontSize: 26, fontWeight: 800, lineHeight: 1.2, fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(revenueSummary.ytdPaid)}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Banking Details */}
        <div
          style={{
            background: T.card,
            border: T.cardBorder,
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={sectionTitle}>
            <span aria-hidden style={{ fontSize: 18 }}>
              $
            </span>
            Banking Details
          </div>
          <div
            style={{
              background: T.inner,
              border: T.innerBorder,
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 18,
              color: T.label,
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            These details will appear on all invoices you send. Clients will see exactly where to transfer payment.
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ ...lbl, marginBottom: 10 }}>Country</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['au', 'international'].map((r) => {
                const active = banking.region === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBanking((b) => ({ ...b, region: r }))}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 999,
                      border: active ? `1px solid ${T.green}` : `1px solid ${T.innerBorder}`,
                      background: active ? '#1e2a1e' : T.inner,
                      color: active ? T.green : T.muted,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {r === 'au' ? 'Australia' : 'International'}
                  </button>
                )
              })}
            </div>
          </div>
          {banking.region === 'au' ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label htmlFor="bank-holder" style={lbl}>
                  Account Holder Name
                </label>
                <input
                  id="bank-holder"
                  value={banking.accountHolder}
                  onChange={(e) => setBanking((b) => ({ ...b, accountHolder: e.target.value }))}
                  style={inp}
                />
              </div>
              <div>
                <label htmlFor="bank-bsb" style={lbl}>
                  BSB Code
                </label>
                <input
                  id="bank-bsb"
                  value={banking.bsb}
                  onChange={(e) => setBanking((b) => ({ ...b, bsb: formatBsbInput(e.target.value) }))}
                  placeholder="XXX-XXX"
                  style={inp}
                />
                <div style={helperMuted}>Format: XXX-XXX</div>
              </div>
              <div>
                <label htmlFor="bank-acct" style={lbl}>
                  Account Number
                </label>
                <input
                  id="bank-acct"
                  value={banking.accountNumber}
                  onChange={(e) => setBanking((b) => ({ ...b, accountNumber: e.target.value }))}
                  style={inp}
                />
                <div style={helperMuted}>Typically 6–10 digits</div>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="bank-intl" style={lbl}>
                Bank details
              </label>
              <textarea
                id="bank-intl"
                value={banking.international}
                onChange={(e) => setBanking((b) => ({ ...b, international: e.target.value }))}
                rows={4}
                style={{ ...inp, minHeight: 100, resize: 'vertical' }}
              />
            </div>
          )}
          <button
            type="button"
            onClick={saveBankingDetails}
            style={{
              marginTop: 18,
              width: '100%',
              background: T.green,
              color: '#000',
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              padding: '12px 20px',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
            }}
          >
            Save Banking Details
          </button>
        </div>

        {/* Section 3 — Create New Invoice */}
        <div
          style={{
            background: T.card,
            border: T.cardBorder,
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ ...sectionTitle, marginBottom: 20 }}>Create New Invoice</div>

          <form onSubmit={handleSubmit}>
            <div style={subSectionTitle}>Client Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 22 }}>
              <div>
                <label htmlFor="inv-client-name" style={lbl}>
                  Client Name
                </label>
                <input
                  id="inv-client-name"
                  name="client_name"
                  value={form.client_name}
                  onChange={handleFormChange}
                  required
                  autoComplete="off"
                  style={inp}
                />
              </div>
              <div>
                <label htmlFor="inv-client-email" style={lbl}>
                  Client Email
                </label>
                <input
                  id="inv-client-email"
                  name="client_email"
                  type="email"
                  value={form.client_email}
                  onChange={handleFormChange}
                  autoComplete="off"
                  style={inp}
                />
              </div>
            </div>

            <div style={subSectionTitle}>Project Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 22 }}>
              <div>
                <label htmlFor="inv-title" style={lbl}>
                  Invoice Title
                </label>
                <input
                  id="inv-title"
                  name="invoice_title"
                  value={form.invoice_title}
                  onChange={handleFormChange}
                  autoComplete="off"
                  style={inp}
                />
              </div>
              <div>
                <label htmlFor="inv-due" style={lbl}>
                  Due Date
                </label>
                <input id="inv-due" name="due_date" type="date" value={form.due_date} onChange={handleFormChange} style={inp} />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ ...subSectionTitle, marginBottom: 0 }}>Line Items</div>
              <button
                type="button"
                onClick={addLineItem}
                style={{
                  background: '#1e2a1e',
                  border: `1px solid ${T.green}`,
                  color: T.green,
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                + Add Item
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 80px 120px 120px minmax(72px, auto)',
                  gap: 10,
                  alignItems: 'center',
                  padding: '0 0 10px',
                  borderBottom: '1px solid #1e1e1e',
                }}
              >
                <span style={{ fontSize: 11, color: T.label, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Inter, sans-serif' }}>
                  Description
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: T.label,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    textAlign: 'center',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Qty
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: T.label,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    textAlign: 'right',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Rate
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: T.label,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    textAlign: 'right',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: T.label,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    textAlign: 'center',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Remove
                </span>
              </div>

              {lineItems.map((line, index) => {
                const q = Number(line.quantity)
                const r = Number(line.unit_price)
                const rowTot = Number.isFinite(q) && Number.isFinite(r) ? q * r : 0
                return (
                  <div
                    key={line.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: T.inner,
                      border: T.innerBorder,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 10,
                    }}
                  >
                    <input
                      value={line.description}
                      onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                      placeholder="Description"
                      style={{ ...inp, flex: 1, minWidth: 0 }}
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLineItem(line.id, 'quantity', e.target.value)}
                      style={{ ...inp, width: 80, textAlign: 'center' }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLineItem(line.id, 'unit_price', e.target.value)}
                      placeholder="0"
                      style={{ ...inp, width: 120, textAlign: 'center' }}
                    />
                    <div style={{ width: 120, textAlign: 'right', color: 'rgb(242, 242, 242)', fontWeight: 600, fontSize: 13 }}>
                      {formatMoney(rowTot)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLineItem(line.id)}
                      disabled={lineItems.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                      style={{
                        ...smallDarkBtn(lineItems.length === 1),
                        width: 96,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>

            <div style={{ borderTop: `1px solid ${T.innerBorder}`, paddingTop: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: T.muted, fontSize: 14 }}>Subtotal</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{formatMoney(draftSubtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: T.muted, fontSize: 14 }}>Tax (GST) %</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', justifyContent: 'flex-end' }}>
                  <input
                    name="tax_percent"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.tax_percent}
                    onChange={handleFormChange}
                    style={{ ...inp, maxWidth: 120 }}
                  />
                  <span style={{ color: 'rgb(242, 242, 242)', fontWeight: 700 }}>{formatMoney(draftTax)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Total</span>
                <span style={{ color: T.green, fontSize: 26, fontWeight: 800 }}>{formatMoney(draftTotalWithTax)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              style={{
                marginTop: 20,
                width: '100%',
                background: T.green,
                color: '#000',
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                padding: 14,
                fontSize: 15,
                cursor: submitting || loading ? 'not-allowed' : 'pointer',
                opacity: submitting || loading ? 0.65 : 1,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {submitting ? 'Creating…' : 'Create Invoice'}
            </button>
          </form>
        </div>

        {/* Section 4 — Invoices list */}
        <div
          style={{
            background: T.card,
            border: T.cardBorder,
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ ...sectionTitle, marginBottom: 16 }}>
            <span aria-hidden style={{ fontSize: 18 }}>
              🧾
            </span>
            Invoices
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {['all', 'draft', 'sent', 'paid', 'overdue'].map((k) => {
              const active = invoiceFilter === k
              const lab = k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setInvoiceFilter(k)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: active ? `1px solid ${T.green}` : `1px solid ${T.innerBorder}`,
                    background: active ? '#1e2a1e' : T.inner,
                    color: active ? T.green : T.label,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {lab}
                </button>
              )
            })}
          </div>

          {loading ? (
            <div style={{ color: T.muted, fontSize: 13 }}>Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 14, lineHeight: 1 }} aria-hidden="true">
                🧾
              </div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>No invoices yet.</div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: 24 }}>
              No invoices match this filter.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredInvoices.map((row) => {
                const { variant, label } = getStatusInfo(row)
                const total = resolveInvoiceTotal(row)
                const due = resolveDueDate(row)
                const createdAt = row?.created_at ? new Date(row.created_at) : null
                const isOverdue = variant !== 'paid' && due instanceof Date && due.getTime() < Date.now()
                const badge = statusBadgeStyle(isOverdue ? 'overdue' : variant)
                const rowSendFeedback = sendInvoiceFeedback?.invoiceId === row.id ? sendInvoiceFeedback : null
                const busy = sendingId === row.id || deletingId === row.id || paidUpdatingId === row.id

                return (
                  <div
                    key={row.id}
                    style={{
                      background: T.inner,
                      border: T.innerBorder,
                      borderRadius: 10,
                      padding: 16,
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{resolveClientName(row)}</div>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: `1px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.color,
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isOverdue ? 'overdue' : label}
                      </span>
                    </div>
                    <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{formatMoney(total)}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, color: T.muted, fontSize: 12 }}>
                      <span>Created: {createdAt ? formatDateTime(createdAt) : '—'}</span>
                      <span>Due: {formatDueDate(due)}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <button type="button" onClick={() => setPreviewInvoice(row)} style={smallDarkBtn(false)}>
                        View
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSendInvoice(row)}
                        style={smallDarkBtn(busy)}
                      >
                        {sendingId === row.id ? 'Sending…' : 'Send'}
                      </button>
                      <button
                        type="button"
                        disabled={busy || variant === 'paid'}
                        onClick={() => handleMarkPaid(row.id)}
                        style={smallDarkBtn(busy || variant === 'paid')}
                      >
                        {paidUpdatingId === row.id ? '…' : 'Mark Paid'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(row.id)}
                        style={smallDarkBtn(busy)}
                      >
                        {deletingId === row.id ? '…' : 'Delete'}
                      </button>
                      {rowSendFeedback && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: rowSendFeedback.kind === 'success' ? T.green : T.red,
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
