import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'
import './Invoicing.css'

const SEND_INVOICE_URL =
  'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-invoice'

const STATUS_OPTIONS = ['draft', 'sent', 'paid']

const initialForm = {
  client_name: '',
  client_email: '',
  due_date: '',
  status: 'draft',
}

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
  if (raw == null) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw
  }
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
  if (!entry || typeof entry !== 'object') {
    return null
  }
  const description = String(entry.description ?? entry.desc ?? '').trim()
  const quantity = Number(entry.quantity ?? entry.qty ?? 0)
  const unit_price = Number(entry.unit_price ?? entry.unitPrice ?? entry.price ?? 0)
  if (!Number.isFinite(quantity) || !Number.isFinite(unit_price)) {
    return null
  }
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
  if (raw === 'draft') {
    return { variant: 'draft', label: 'draft' }
  }
  if (raw === 'sent') {
    return { variant: 'sent', label: 'sent' }
  }
  if (raw === 'paid') {
    return { variant: 'paid', label: 'paid' }
  }
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
  if (id == null || id === '') {
    return '—'
  }
  const s = String(id)
  return s.slice(0, 8)
}

function formatDocumentDate(value) {
  if (value == null) {
    return '—'
  }
  const d =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value.includes('T') ? value : `${value}T12:00:00`)
        : new Date(value)
  if (Number.isNaN(d.getTime())) {
    return String(value)
  }
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function resolveAmount(row) {
  const n = row?.amount ?? row?.total ?? row?.total_amount
  if (n === null || n === undefined || n === '') {
    return null
  }
  const num = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(num) ? num : null
}

function resolveInvoiceTotal(row) {
  const fromCol = resolveAmount(row)
  if (fromCol != null) {
    return fromCol
  }
  const normalized = parseItemsFromRow(row)
    .map(normalizeStoredItem)
    .filter(Boolean)
  return normalized.length ? lineItemsTotal(normalized) : null
}

function resolveDueDate(row) {
  const raw = row?.due_date ?? row?.dueDate ?? null
  if (raw == null || raw === '') {
    return null
  }
  const d =
    typeof raw === 'string'
      ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
      : new Date(raw)
  return Number.isNaN(d.getTime()) ? String(raw) : d
}

function formatDueDate(value) {
  if (value == null) {
    return '—'
  }
  if (value instanceof Date) {
    return value.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  return String(value)
}

function formatMoney(amount) {
  if (amount === null || amount === undefined) {
    return '—'
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  } catch {
    return String(amount)
  }
}

function formatLineItemCount(n) {
  if (n === 0) {
    return '0 line items'
  }
  if (n === 1) {
    return '1 line item'
  }
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
    if (!supabase || !userId) {
      setInvoices([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('creative_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setInvoices([])
    } else {
      setInvoices(data ?? [])
    }

    setLoading(false)
  }, [userId])

  const loadBusinessProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setBusinessName('')
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('business_name')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data?.business_name?.trim()) {
      setBusinessName('')
    } else {
      setBusinessName(data.business_name.trim())
    }
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    loadInvoices()
    loadBusinessProfile()
  }, [authLoading, loadInvoices, loadBusinessProfile])

  useEffect(() => {
    if (!previewInvoice) {
      setPdfGenerating(false)
      return undefined
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewInvoice(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    previewCloseRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewInvoice])

  const handleDownloadPdf = async () => {
    if (!invoiceContentRef.current || !previewInvoice || pdfGenerating) {
      return
    }
    const num = shortInvoiceNumber(previewInvoice.id)
    setPdfGenerating(true)
    setErrorMessage('')
    try {
      const canvas = await html2canvas(invoiceContentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let yOffset = 0
      while (yOffset < imgHeight) {
        if (yOffset > 0) {
          pdf.addPage()
        }
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight)
        yOffset += pageHeight
      }

      pdf.save(`invoice-${num}.pdf`)
    } catch (err) {
      console.error(err)
      setErrorMessage(err instanceof Error ? err.message : 'Could not generate PDF.')
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const updateLineItem = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    )
  }

  const addLineItem = () => {
    setLineItems((prev) => [...prev, newLineItemRow()])
  }

  const removeLineItem = (id) => {
    setLineItems((prev) => {
      const next = prev.filter((line) => line.id !== id)
      return next.length === 0 ? [newLineItemRow()] : next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSuccessMessage('')

    if (!supabase || !userId) {
      setErrorMessage('Supabase is not configured or you are not signed in.')
      return
    }

    if (!form.client_name.trim()) {
      setErrorMessage('Client name is required.')
      return
    }

    const itemsPayload = buildItemsPayload(lineItems)
    if (itemsPayload.length === 0) {
      setErrorMessage('Add at least one line item with description, quantity, and unit price.')
      return
    }

    const amountTotal = lineItemsTotal(itemsPayload)
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
      setErrorMessage('Invoice total must be greater than zero.')
      return
    }

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

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Invoice created.')
      setForm(initialForm)
      setLineItems([newLineItemRow()])
      await loadInvoices()
    }

    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!supabase || !id) {
      return
    }

    setSuccessMessage('')
    setDeletingId(id)
    setErrorMessage('')

    const { error } = await supabase.from('invoices').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Invoice removed.')
      setInvoices((current) => current.filter((row) => row.id !== id))
      setPreviewInvoice((open) => (open?.id === id ? null : open))
    }

    setDeletingId(null)
  }

  const handleSendInvoice = async (row) => {
    if (!supabase || !userId || !row?.id) {
      return
    }

    setSendInvoiceFeedback((current) =>
      current?.invoiceId === row.id ? null : current,
    )
    setSendingId(row.id)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (sessionError || !accessToken) {
      setSendInvoiceFeedback({
        invoiceId: row.id,
        kind: 'error',
        message: sessionError?.message ?? 'Could not read your session. Try signing in again.',
      })
      setSendingId(null)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_name, business_email')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      setSendInvoiceFeedback({
        invoiceId: row.id,
        kind: 'error',
        message: profileError.message,
      })
      setSendingId(null)
      return
    }

    const businessName = profile?.business_name?.trim() ?? ''
    const business_email = profile?.business_email?.trim() ?? ''

    if (!businessName) {
      setSendInvoiceFeedback({
        invoiceId: row.id,
        kind: 'error',
        message: 'Add your business name in your profile before sending.',
      })
      setSendingId(null)
      return
    }

    if (!business_email || !business_email.includes('@')) {
      setSendInvoiceFeedback({
        invoiceId: row.id,
        kind: 'error',
        message: 'Add a valid business email in your profile before sending.',
      })
      setSendingId(null)
      return
    }

    const to =
      typeof row.client_email === 'string'
        ? row.client_email.trim()
        : String(row.client_email ?? '').trim()
    if (!to) {
      setSendInvoiceFeedback({
        invoiceId: row.id,
        kind: 'error',
        message: 'This invoice needs a client email before you can send it.',
      })
      setSendingId(null)
      return
    }

    const normalizedItems = getNormalizedInvoiceLines(row)
    if (normalizedItems.length === 0) {
      setSendInvoiceFeedback({
        invoiceId: row.id,
        kind: 'error',
        message: 'This invoice has no line items to send.',
      })
      setSendingId(null)
      return
    }

    const clientName =
      typeof row.client_name === 'string' ? row.client_name : String(row.client_name ?? '')
    const invoiceNumber = String(row.id).slice(0, 8)
    const dueDate = row.due_date || 'Not set'

    const payload = {
      to,
      clientName,
      businessName,
      replyTo: business_email,
      invoiceNumber,
      dueDate,
      amount: row.amount,
      items: normalizedItems,
      status: row.status,
    }

    try {
      const response = await fetch(SEND_INVOICE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      let result = null
      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (!response.ok) {
        const msg =
          result && typeof result.error === 'string'
            ? result.error
            : `Send failed (${response.status})`
        setSendInvoiceFeedback({
          invoiceId: row.id,
          kind: 'error',
          message: msg,
        })
        setSendingId(null)
        return
      }

      if (result?.success) {
        setSendInvoiceFeedback({
          invoiceId: row.id,
          kind: 'success',
          message: 'Sent!',
        })
        setSendingId(null)
        window.setTimeout(() => {
          setSendInvoiceFeedback((current) =>
            current?.invoiceId === row.id && current?.kind === 'success' ? null : current,
          )
        }, 2500)
      } else {
        const msg =
          result && typeof result.error === 'string' ? result.error : 'Send failed.'
        setSendInvoiceFeedback({
          invoiceId: row.id,
          kind: 'error',
          message: msg,
        })
        setSendingId(null)
      }
    } catch (err) {
      console.error(err)
      setSendInvoiceFeedback({
        invoiceId: row.id,
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error while sending.',
      })
      setSendingId(null)
    }
  }

  if (authLoading) {
    return (
      <section className="invoicing-page">
        <p className="invoicing-page__subtitle">Loading session…</p>
      </section>
    )
  }

  if (!userId) {
    return (
      <section className="invoicing-page">
        <h1 className="invoicing-page__title">Invoicing</h1>
        <p className="invoicing-page__subtitle">Sign in to manage invoices.</p>
      </section>
    )
  }

  return (
    <section className="invoicing-page">
      <h1 className="invoicing-page__title">Invoicing</h1>
      <p className="invoicing-page__subtitle">
        Build invoices with line items; totals update automatically from quantity × unit price.
      </p>

      <div className="invoicing-page__layout">
        <div className="invoicing-page__panel">
          <h2 className="invoicing-page__panel-title">New invoice</h2>
          <form onSubmit={handleSubmit}>
            <div className="invoicing-page__field">
              <label className="invoicing-page__label" htmlFor="invoice-client-name">
                Client name
              </label>
              <input
                id="invoice-client-name"
                name="client_name"
                className="invoicing-page__input"
                value={form.client_name}
                onChange={handleFormChange}
                required
                autoComplete="off"
              />
            </div>
            <div className="invoicing-page__field">
              <label className="invoicing-page__label" htmlFor="invoice-client-email">
                Client email
              </label>
              <input
                id="invoice-client-email"
                name="client_email"
                type="email"
                className="invoicing-page__input"
                value={form.client_email}
                onChange={handleFormChange}
                autoComplete="off"
              />
            </div>

            <div className="invoicing-page__field invoicing-page__field--line-items">
              <div className="invoicing-page__line-items-header">
                <span className="invoicing-page__label" id="invoice-line-items-label">
                  Line items
                </span>
                <button
                  type="button"
                  className="invoicing-page__btn-add-line"
                  onClick={addLineItem}
                >
                  Add line
                </button>
              </div>
              <div className="invoicing-page__line-items" role="group" aria-labelledby="invoice-line-items-label">
                {lineItems.map((line, index) => (
                  <div key={line.id} className="invoicing-page__line-item">
                    <div className="invoicing-page__line-item-fields">
                      <div className="invoicing-page__line-col invoicing-page__line-col--desc">
                        <label className="invoicing-page__line-label" htmlFor={`inv-desc-${line.id}`}>
                          Description
                        </label>
                        <input
                          id={`inv-desc-${line.id}`}
                          className="invoicing-page__input"
                          value={line.description}
                          onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                          placeholder="e.g. Portrait session"
                          autoComplete="off"
                        />
                      </div>
                      <div className="invoicing-page__line-col invoicing-page__line-col--qty">
                        <label className="invoicing-page__line-label" htmlFor={`inv-qty-${line.id}`}>
                          Qty
                        </label>
                        <input
                          id={`inv-qty-${line.id}`}
                          type="number"
                          min="1"
                          step="1"
                          className="invoicing-page__input"
                          value={line.quantity}
                          onChange={(e) => updateLineItem(line.id, 'quantity', e.target.value)}
                        />
                      </div>
                      <div className="invoicing-page__line-col invoicing-page__line-col--price">
                        <label className="invoicing-page__line-label" htmlFor={`inv-price-${line.id}`}>
                          Unit price
                        </label>
                        <input
                          id={`inv-price-${line.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="invoicing-page__input"
                          value={line.unit_price}
                          onChange={(e) => updateLineItem(line.id, 'unit_price', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="invoicing-page__btn-remove-line"
                      onClick={() => removeLineItem(line.id)}
                      disabled={lineItems.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="invoicing-page__total-row">
                <span className="invoicing-page__total-label">Total</span>
                <span className="invoicing-page__total-value">{formatMoney(draftTotal)}</span>
              </div>
            </div>

            <div className="invoicing-page__field">
              <label className="invoicing-page__label" htmlFor="invoice-due-date">
                Due date
              </label>
              <input
                id="invoice-due-date"
                name="due_date"
                type="date"
                className="invoicing-page__input"
                value={form.due_date}
                onChange={handleFormChange}
              />
            </div>
            <div className="invoicing-page__field">
              <label className="invoicing-page__label" htmlFor="invoice-status">
                Status
              </label>
              <select
                id="invoice-status"
                name="status"
                className="invoicing-page__select"
                value={form.status}
                onChange={handleFormChange}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="invoicing-page__submit"
              disabled={submitting || loading}
            >
              {submitting ? 'Creating…' : 'Create invoice'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="invoicing-page__section-heading">Your invoices</h2>
          {loading ? (
            <p className="invoicing-page__subtitle">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <p className="invoicing-page__empty">
              No invoices yet. Create your first invoice using the form.
            </p>
          ) : (
            <ul className="invoicing-page__list">
              {invoices.map((row) => {
                const { variant, label } = getStatusInfo(row)
                const statusClass =
                  variant === 'draft'
                    ? 'invoicing-page__status--draft'
                    : variant === 'sent'
                      ? 'invoicing-page__status--sent'
                      : variant === 'paid'
                        ? 'invoicing-page__status--paid'
                        : 'invoicing-page__status--unknown'

                const total = resolveInvoiceTotal(row)
                const lineCount = parseItemsFromRow(row).length
                const rowSendFeedback =
                  sendInvoiceFeedback?.invoiceId === row.id ? sendInvoiceFeedback : null

                return (
                  <li key={row.id} className="invoicing-page__row">
                    <div className="invoicing-page__row-header">
                      <p className="invoicing-page__row-client">{resolveClientName(row)}</p>
                      <span className={`invoicing-page__status ${statusClass}`}>{label}</span>
                    </div>
                    <p className="invoicing-page__row-amount">{formatMoney(total)}</p>
                    <p className="invoicing-page__row-meta">
                      Due: {formatDueDate(resolveDueDate(row))}
                    </p>
                    <p className="invoicing-page__row-meta">{formatLineItemCount(lineCount)}</p>
                    <div className="invoicing-page__row-actions">
                      <button
                        type="button"
                        className="invoicing-page__btn-preview"
                        onClick={() => setPreviewInvoice(row)}
                      >
                        Preview
                      </button>
                      <div className="invoicing-page__send-inline">
                        <button
                          type="button"
                          className="invoicing-page__btn-send"
                          disabled={sendingId === row.id || deletingId === row.id}
                          onClick={() => handleSendInvoice(row)}
                        >
                          {sendingId === row.id ? 'Sending...' : 'Send Invoice'}
                        </button>
                        {rowSendFeedback && (
                          <span
                            className={
                              rowSendFeedback.kind === 'success'
                                ? 'invoicing-page__send-feedback invoicing-page__send-feedback--ok'
                                : 'invoicing-page__send-feedback invoicing-page__send-feedback--err'
                            }
                            role={rowSendFeedback.kind === 'error' ? 'alert' : 'status'}
                          >
                            {rowSendFeedback.message}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="invoicing-page__delete"
                        disabled={deletingId === row.id || sendingId === row.id}
                        onClick={() => handleDelete(row.id)}
                      >
                        {deletingId === row.id ? 'Removing…' : 'Delete'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="invoicing-page__message" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && !errorMessage && (
        <p className="invoicing-page__message invoicing-page__message--ok" role="status">
          {successMessage}
        </p>
      )}

      {previewInvoice && (
        <div
          className="invoicing-page__preview-backdrop"
          role="presentation"
          onClick={() => setPreviewInvoice(null)}
        >
          <div
            ref={invoiceContentRef}
            className="invoicing-page__preview-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invoicing-page__preview-doc">
              <div className="invoicing-page__preview-doc-header">
                <div>
                  <p className="invoicing-page__preview-business">
                    {businessName || 'Your business'}
                  </p>
                  <h2 id="invoice-preview-title" className="invoicing-page__preview-invoice-title">
                    INVOICE
                  </h2>
                </div>
                <div className="invoicing-page__preview-header-actions">
                  <button
                    type="button"
                    className="invoicing-page__preview-download"
                    disabled={pdfGenerating}
                    onClick={handleDownloadPdf}
                  >
                    {pdfGenerating ? 'Generating…' : 'Download PDF'}
                  </button>
                  <button
                    ref={previewCloseRef}
                    type="button"
                    className="invoicing-page__preview-close"
                    onClick={() => setPreviewInvoice(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="invoicing-page__preview-meta-grid">
                <div>
                  <p className="invoicing-page__preview-label">Invoice #</p>
                  <p className="invoicing-page__preview-value">{shortInvoiceNumber(previewInvoice.id)}</p>
                </div>
                <div>
                  <p className="invoicing-page__preview-label">Issue date</p>
                  <p className="invoicing-page__preview-value">
                    {formatDocumentDate(new Date())}
                  </p>
                </div>
                <div>
                  <p className="invoicing-page__preview-label">Due date</p>
                  <p className="invoicing-page__preview-value">
                    {formatDocumentDate(resolveDueDate(previewInvoice))}
                  </p>
                </div>
                <div className="invoicing-page__preview-meta-status">
                  <p className="invoicing-page__preview-label">Status</p>
                  {(() => {
                    const { variant, label } = getStatusInfo(previewInvoice)
                    const docClass =
                      variant === 'draft'
                        ? 'invoicing-page__doc-badge--draft'
                        : variant === 'sent'
                          ? 'invoicing-page__doc-badge--sent'
                          : variant === 'paid'
                            ? 'invoicing-page__doc-badge--paid'
                            : 'invoicing-page__doc-badge--unknown'
                    return (
                      <span className={`invoicing-page__doc-badge ${docClass}`}>{label}</span>
                    )
                  })()}
                </div>
              </div>

              <div className="invoicing-page__preview-billto">
                <p className="invoicing-page__preview-section-title">Bill to</p>
                <p className="invoicing-page__preview-billto-name">{resolveClientName(previewInvoice)}</p>
                {resolveClientEmail(previewInvoice) ? (
                  <p className="invoicing-page__preview-billto-email">
                    {resolveClientEmail(previewInvoice)}
                  </p>
                ) : (
                  <p className="invoicing-page__preview-billto-muted">No email on file</p>
                )}
              </div>

              <table className="invoicing-page__preview-table">
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col" className="invoicing-page__preview-th-num">
                      Qty
                    </th>
                    <th scope="col" className="invoicing-page__preview-th-num">
                      Unit price
                    </th>
                    <th scope="col" className="invoicing-page__preview-th-num">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.map((line, index) => (
                    <tr key={index}>
                      <td>{line.description}</td>
                      <td className="invoicing-page__preview-td-num">{line.quantity}</td>
                      <td className="invoicing-page__preview-td-num">
                        {formatMoney(line.unit_price)}
                      </td>
                      <td className="invoicing-page__preview-td-num">
                        {formatMoney(line.quantity * line.unit_price)}
                      </td>
                    </tr>
                  ))}
                  {previewLines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="invoicing-page__preview-table-empty">
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="invoicing-page__preview-grand">
                <span className="invoicing-page__preview-grand-label">Total due</span>
                <span className="invoicing-page__preview-grand-value">
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
