import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'
import './Quotes.css'

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined']
const SEND_QUOTE_URL =
  'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-quote'

const initialForm = {
  client_name: '',
  client_email: '',
  valid_until: '',
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

function buildInvoiceItemsFromQuote(row) {
  return parseItemsFromRow(row)
    .map(normalizeStoredItem)
    .filter(Boolean)
    .map(({ description, quantity, unit_price }) => ({
      description,
      quantity,
      unit_price,
    }))
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
  if (raw === 'accepted') {
    return { variant: 'accepted', label: 'accepted' }
  }
  if (raw === 'declined') {
    return { variant: 'declined', label: 'declined' }
  }
  if (raw === 'converted') {
    return { variant: 'converted', label: 'converted' }
  }
  const label = String(row?.status ?? 'unknown').trim() || 'unknown'
  return { variant: 'unknown', label }
}

function resolveClientName(row) {
  return row?.client_name ?? row?.clientName ?? row?.name ?? 'Client'
}

function resolveAmount(row) {
  const n = row?.amount ?? row?.total ?? row?.total_amount
  if (n === null || n === undefined || n === '') {
    return null
  }
  const num = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(num) ? num : null
}

function resolveQuoteTotal(row) {
  const fromCol = resolveAmount(row)
  if (fromCol != null) {
    return fromCol
  }
  const normalized = parseItemsFromRow(row)
    .map(normalizeStoredItem)
    .filter(Boolean)
  return normalized.length ? lineItemsTotal(normalized) : null
}

function resolveValidUntil(row) {
  const raw =
    row?.valid_until ?? row?.validUntil ?? row?.expires_at ?? row?.valid_until_date ?? null
  if (raw == null || raw === '') {
    return null
  }
  const d =
    typeof raw === 'string'
      ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
      : new Date(raw)
  return Number.isNaN(d.getTime()) ? String(raw) : d
}

function formatValidUntil(value) {
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

function shortQuoteNumber(id) {
  if (id == null || id === '') {
    return '—'
  }
  const s = String(id)
  return s.slice(0, 8)
}

function Quotes() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const [quotes, setQuotes] = useState([])
  const [form, setForm] = useState(initialForm)
  const [lineItems, setLineItems] = useState(() => [newLineItemRow()])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [convertingId, setConvertingId] = useState(null)
  const [convertCardFeedback, setConvertCardFeedback] = useState(null)
  const [sendingQuoteId, setSendingQuoteId] = useState(null)
  const [sendQuoteFeedback, setSendQuoteFeedback] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [previewQuote, setPreviewQuote] = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const previewCloseRef = useRef(null)
  const quoteContentRef = useRef(null)

  const draftTotal = useMemo(() => {
    const payload = buildItemsPayload(lineItems)
    return lineItemsTotal(payload)
  }, [lineItems])

  const loadQuotes = useCallback(async () => {
    if (!supabase || !userId) {
      setQuotes([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('creative_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setQuotes([])
    } else {
      setQuotes(data ?? [])
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    loadQuotes()
  }, [authLoading, loadQuotes])

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
    loadBusinessProfile()
  }, [authLoading, loadBusinessProfile])

  const previewLines = useMemo(
    () => (previewQuote ? buildInvoiceItemsFromQuote(previewQuote) : []),
    [previewQuote],
  )

  useEffect(() => {
    if (!previewQuote) {
      setPdfGenerating(false)
      return undefined
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewQuote(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    previewCloseRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewQuote])

  const handleDownloadPdf = async () => {
    if (!quoteContentRef.current || !previewQuote || pdfGenerating) {
      return
    }

    const quoteNumber = shortQuoteNumber(previewQuote.id)
    setPdfGenerating(true)
    setErrorMessage('')
    try {
      const canvas = await html2canvas(quoteContentRef.current, {
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

      pdf.save(`quote-${quoteNumber}.pdf`)
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
      setErrorMessage('Quote total must be greater than zero.')
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
      valid_until: form.valid_until || null,
      status: form.status,
    }

    const { error } = await supabase.from('quotes').insert(payload)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Quote created.')
      setForm(initialForm)
      setLineItems([newLineItemRow()])
      await loadQuotes()
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

    const { error } = await supabase.from('quotes').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Quote removed.')
      setQuotes((current) => current.filter((row) => row.id !== id))
    }

    setDeletingId(null)
  }

  const handleConvertToInvoice = async (row) => {
    if (!supabase || !userId || !row?.id) {
      return
    }

    setConvertCardFeedback(null)
    setConvertingId(row.id)

    const clientName = String(row.client_name ?? '').trim()
    if (!clientName) {
      setConvertCardFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'Quote is missing a client name.',
      })
      setConvertingId(null)
      return
    }

    const itemsPayload = buildInvoiceItemsFromQuote(row)
    if (itemsPayload.length === 0) {
      setConvertCardFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'Quote has no valid line items to copy.',
      })
      setConvertingId(null)
      return
    }

    const amountTotal = resolveQuoteTotal(row)
    if (amountTotal == null || !Number.isFinite(amountTotal) || amountTotal <= 0) {
      setConvertCardFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'Quote amount is missing or invalid.',
      })
      setConvertingId(null)
      return
    }

    const clientEmail = String(row.client_email ?? '').trim() || null

    const invoicePayload = {
      creative_id: userId,
      client_name: clientName,
      client_email: clientEmail,
      amount: amountTotal,
      items: itemsPayload,
      status: 'draft',
      due_date: null,
    }

    const { error: insertError } = await supabase.from('invoices').insert(invoicePayload)

    if (insertError) {
      setConvertCardFeedback({
        quoteId: row.id,
        kind: 'error',
        message: insertError.message,
      })
      setConvertingId(null)
      return
    }

    const { error: updateError } = await supabase
      .from('quotes')
      .update({ status: 'converted' })
      .eq('id', row.id)
      .eq('creative_id', userId)

    if (updateError) {
      setConvertCardFeedback({
        quoteId: row.id,
        kind: 'error',
        message: updateError.message,
      })
      setConvertingId(null)
      return
    }

    setConvertCardFeedback({
      quoteId: row.id,
      kind: 'success',
      message: 'Invoice created!',
    })
    await loadQuotes()
    setConvertingId(null)
    window.setTimeout(() => {
      setConvertCardFeedback((current) =>
        current?.quoteId === row.id && current?.kind === 'success' ? null : current,
      )
    }, 2500)
  }

  const handleSendQuote = async (row) => {
    if (!supabase || !userId || !row?.id) {
      return
    }

    setSendQuoteFeedback(null)
    setSendingQuoteId(row.id)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (sessionError || !accessToken) {
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message:
          sessionError?.message ?? 'Could not read your session. Try signing in again.',
      })
      setSendingQuoteId(null)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_name, business_email')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message: profileError.message,
      })
      setSendingQuoteId(null)
      return
    }

    const businessName = profile?.business_name?.trim() ?? ''
    const business_email = profile?.business_email?.trim() ?? ''

    if (!businessName) {
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'Add your business name in your profile before sending.',
      })
      setSendingQuoteId(null)
      return
    }

    if (!business_email || !business_email.includes('@')) {
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'Add a valid business email in your profile before sending.',
      })
      setSendingQuoteId(null)
      return
    }

    const to =
      typeof row.client_email === 'string' ? row.client_email.trim() : String(row.client_email ?? '').trim()
    if (!to) {
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'This quote needs a client email before you can send it.',
      })
      setSendingQuoteId(null)
      return
    }

    const clientName =
      typeof row.client_name === 'string'
        ? row.client_name.trim()
        : String(row.client_name ?? '').trim()
    if (!clientName) {
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'This quote needs a client name before you can send it.',
      })
      setSendingQuoteId(null)
      return
    }

    const normalizedItems = buildInvoiceItemsFromQuote(row)
    if (normalizedItems.length === 0) {
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message: 'This quote has no line items to send.',
      })
      setSendingQuoteId(null)
      return
    }

    const invoicePayload = {
      to,
      clientName,
      businessName,
      replyTo: business_email,
      quoteNumber: String(row.id).slice(0, 8),
      validUntil: row.valid_until || 'Not set',
      amount: row.amount,
      items: normalizedItems,
      status: row.status,
    }

    try {
      const response = await fetch(SEND_QUOTE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoicePayload),
      })

      let result = null
      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (!response.ok) {
        const msg =
          result && typeof result.error === 'string' ? result.error : `Send failed (${response.status})`
        setSendQuoteFeedback({
          quoteId: row.id,
          kind: 'error',
          message: msg,
        })
        setSendingQuoteId(null)
        return
      }

      if (result?.success) {
        setSendQuoteFeedback({
          quoteId: row.id,
          kind: 'success',
          message: 'Sent!',
        })
        setSendingQuoteId(null)
        window.setTimeout(() => {
          setSendQuoteFeedback((current) =>
            current?.quoteId === row.id && current?.kind === 'success'
              ? null
              : current,
          )
        }, 2500)
      } else {
        const msg = result && typeof result.error === 'string' ? result.error : 'Send failed.'
        setSendQuoteFeedback({
          quoteId: row.id,
          kind: 'error',
          message: msg,
        })
        setSendingQuoteId(null)
      }
    } catch (err) {
      console.error(err)
      setSendQuoteFeedback({
        quoteId: row.id,
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error while sending.',
      })
      setSendingQuoteId(null)
    }
  }

  if (authLoading) {
    return (
      <section className="quotes-page">
        <p className="quotes-page__subtitle">Loading session…</p>
      </section>
    )
  }

  if (!userId) {
    return (
      <section className="quotes-page">
        <h1 className="quotes-page__title">Quotes</h1>
        <p className="quotes-page__subtitle">Sign in to manage quotes.</p>
      </section>
    )
  }

  return (
    <section className="quotes-page">
      <h1 className="quotes-page__title">Quotes</h1>
      <p className="quotes-page__subtitle">
        Send line-item quotes to clients; totals update from quantity × unit price.
      </p>

      <div className="quotes-page__layout">
        <div className="quotes-page__panel">
          <h2 className="quotes-page__panel-title">New quote</h2>
          <form onSubmit={handleSubmit}>
            <div className="quotes-page__field">
              <label className="quotes-page__label" htmlFor="quote-client-name">
                Client name
              </label>
              <input
                id="quote-client-name"
                name="client_name"
                className="quotes-page__input"
                value={form.client_name}
                onChange={handleFormChange}
                required
                autoComplete="off"
              />
            </div>
            <div className="quotes-page__field">
              <label className="quotes-page__label" htmlFor="quote-client-email">
                Client email
              </label>
              <input
                id="quote-client-email"
                name="client_email"
                type="email"
                className="quotes-page__input"
                value={form.client_email}
                onChange={handleFormChange}
                autoComplete="off"
              />
            </div>
            <div className="quotes-page__field">
              <label className="quotes-page__label" htmlFor="quote-valid-until">
                Valid until
              </label>
              <input
                id="quote-valid-until"
                name="valid_until"
                type="date"
                className="quotes-page__input"
                value={form.valid_until}
                onChange={handleFormChange}
              />
            </div>
            <div className="quotes-page__field">
              <label className="quotes-page__label" htmlFor="quote-status">
                Status
              </label>
              <select
                id="quote-status"
                name="status"
                className="quotes-page__select"
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

            <div className="quotes-page__field quotes-page__field--line-items">
              <div className="quotes-page__line-items-header">
                <span className="quotes-page__label" id="quote-line-items-label">
                  Line items
                </span>
                <button type="button" className="quotes-page__btn-add-line" onClick={addLineItem}>
                  Add line
                </button>
              </div>
              <div
                className="quotes-page__line-items"
                role="group"
                aria-labelledby="quote-line-items-label"
              >
                {lineItems.map((line, index) => (
                  <div key={line.id} className="quotes-page__line-item">
                    <div className="quotes-page__line-item-fields">
                      <div className="quotes-page__line-col quotes-page__line-col--desc">
                        <label className="quotes-page__line-label" htmlFor={`q-desc-${line.id}`}>
                          Description
                        </label>
                        <input
                          id={`q-desc-${line.id}`}
                          className="quotes-page__input"
                          value={line.description}
                          onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                          placeholder="e.g. Half-day shoot"
                          autoComplete="off"
                        />
                      </div>
                      <div className="quotes-page__line-col quotes-page__line-col--qty">
                        <label className="quotes-page__line-label" htmlFor={`q-qty-${line.id}`}>
                          Qty
                        </label>
                        <input
                          id={`q-qty-${line.id}`}
                          type="number"
                          min="1"
                          step="1"
                          className="quotes-page__input"
                          value={line.quantity}
                          onChange={(e) => updateLineItem(line.id, 'quantity', e.target.value)}
                        />
                      </div>
                      <div className="quotes-page__line-col quotes-page__line-col--price">
                        <label className="quotes-page__line-label" htmlFor={`q-price-${line.id}`}>
                          Unit price
                        </label>
                        <input
                          id={`q-price-${line.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="quotes-page__input"
                          value={line.unit_price}
                          onChange={(e) => updateLineItem(line.id, 'unit_price', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="quotes-page__btn-remove-line"
                      onClick={() => removeLineItem(line.id)}
                      disabled={lineItems.length === 1}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="quotes-page__total-row">
                <span className="quotes-page__total-label">Total</span>
                <span className="quotes-page__total-value">{formatMoney(draftTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              className="quotes-page__submit"
              disabled={submitting || loading}
            >
              {submitting ? 'Creating…' : 'Create quote'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="quotes-page__section-heading">Your quotes</h2>
          {loading ? (
            <p className="quotes-page__subtitle">Loading quotes…</p>
          ) : quotes.length === 0 ? (
            <p className="quotes-page__empty">
              No quotes yet. Create your first quote using the form.
            </p>
          ) : (
            <ul className="quotes-page__list">
              {quotes.map((row) => {
                const { variant, label } = getStatusInfo(row)
                const statusClass =
                  variant === 'draft'
                    ? 'quotes-page__status--draft'
                    : variant === 'sent'
                      ? 'quotes-page__status--sent'
                      : variant === 'accepted'
                        ? 'quotes-page__status--accepted'
                        : variant === 'declined'
                          ? 'quotes-page__status--declined'
                          : variant === 'converted'
                            ? 'quotes-page__status--converted'
                            : 'quotes-page__status--unknown'

                const statusRaw = String(row?.status ?? '').toLowerCase().trim()
                const showConvert = statusRaw === 'accepted'
                const showSend = statusRaw !== 'converted'
                const rowConvertFeedback =
                  convertCardFeedback?.quoteId === row.id ? convertCardFeedback : null

                const total = resolveQuoteTotal(row)
                const lineCount = parseItemsFromRow(row).length
                const rowSendFeedback =
                  sendQuoteFeedback?.quoteId === row.id ? sendQuoteFeedback : null

                return (
                  <li key={row.id} className="quotes-page__row">
                    <div className="quotes-page__row-header">
                      <p className="quotes-page__row-client">{resolveClientName(row)}</p>
                      <span className={`quotes-page__status ${statusClass}`}>{label}</span>
                    </div>
                    <p className="quotes-page__row-amount">{formatMoney(total)}</p>
                    <p className="quotes-page__row-meta">
                      Valid until: {formatValidUntil(resolveValidUntil(row))}
                    </p>
                    <p className="quotes-page__row-meta">{formatLineItemCount(lineCount)}</p>
                    <div className="quotes-page__row-actions">
                      <button
                        type="button"
                        className="quotes-page__btn-preview"
                        onClick={() => setPreviewQuote(row)}
                      >
                        Preview
                      </button>
                      {showConvert && (
                        <button
                          type="button"
                          className="quotes-page__convert"
                          disabled={convertingId === row.id || deletingId === row.id}
                          onClick={() => handleConvertToInvoice(row)}
                        >
                          {convertingId === row.id ? 'Converting…' : 'Convert to Invoice'}
                        </button>
                      )}
                      {showSend && (
                        <div className="quotes-page__send-inline">
                          <button
                            type="button"
                            className="quotes-page__send"
                            disabled={sendingQuoteId === row.id}
                            onClick={() => handleSendQuote(row)}
                          >
                            {sendingQuoteId === row.id ? 'Sending...' : 'Send Quote'}
                          </button>
                          {rowSendFeedback && (
                            <span
                              className={
                                rowSendFeedback.kind === 'success'
                                  ? 'quotes-page__send-feedback quotes-page__send-feedback--ok'
                                  : 'quotes-page__send-feedback quotes-page__send-feedback--err'
                              }
                              role={rowSendFeedback.kind === 'error' ? 'alert' : 'status'}
                            >
                              {rowSendFeedback.message}
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        className="quotes-page__delete"
                        disabled={deletingId === row.id || convertingId === row.id}
                        onClick={() => handleDelete(row.id)}
                      >
                        {deletingId === row.id ? 'Removing…' : 'Delete'}
                      </button>
                    </div>
                    {rowConvertFeedback && (
                      <p
                        className={
                          rowConvertFeedback.kind === 'success'
                            ? 'quotes-page__row-inline-msg quotes-page__row-inline-msg--ok'
                            : 'quotes-page__row-inline-msg quotes-page__row-inline-msg--err'
                        }
                        role={rowConvertFeedback.kind === 'error' ? 'alert' : 'status'}
                      >
                        {rowConvertFeedback.message}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="quotes-page__message" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && !errorMessage && (
        <p className="quotes-page__message quotes-page__message--ok" role="status">
          {successMessage}
        </p>
      )}

      {previewQuote && (
        <div
          className="quotes-page__preview-backdrop"
          role="presentation"
          onClick={() => setPreviewQuote(null)}
        >
          <div
            ref={quoteContentRef}
            className="quotes-page__preview-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quotes-page__preview-doc">
              <div className="quotes-page__preview-doc-header">
                <div>
                  <p className="quotes-page__preview-business">
                    {businessName || 'Your business'}
                  </p>
                  <h2 id="quote-preview-title" className="quotes-page__preview-quote-title">
                    QUOTE
                  </h2>
                </div>
                <div className="quotes-page__preview-header-actions">
                  <button
                    type="button"
                    className="quotes-page__preview-download"
                    disabled={pdfGenerating}
                    onClick={handleDownloadPdf}
                  >
                    {pdfGenerating ? 'Generating…' : 'Download PDF'}
                  </button>
                  <button
                    ref={previewCloseRef}
                    type="button"
                    className="quotes-page__preview-close"
                    onClick={() => setPreviewQuote(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="quotes-page__preview-meta-grid">
                <div>
                  <p className="quotes-page__preview-label">Quote #</p>
                  <p className="quotes-page__preview-value">{shortQuoteNumber(previewQuote.id)}</p>
                </div>
                <div>
                  <p className="quotes-page__preview-label">Issue date</p>
                  <p className="quotes-page__preview-value">
                    {formatDocumentDate(new Date())}
                  </p>
                </div>
                <div>
                  <p className="quotes-page__preview-label">Valid Until</p>
                  <p className="quotes-page__preview-value">
                    {formatValidUntil(resolveValidUntil(previewQuote))}
                  </p>
                </div>
                <div className="quotes-page__preview-meta-status">
                  <p className="quotes-page__preview-label">Status</p>
                  {(() => {
                    const { variant, label } = getStatusInfo(previewQuote)
                    const docClass =
                      variant === 'draft'
                        ? 'quotes-page__doc-badge--draft'
                        : variant === 'sent'
                          ? 'quotes-page__doc-badge--sent'
                          : variant === 'accepted'
                            ? 'quotes-page__doc-badge--accepted'
                            : variant === 'declined'
                              ? 'quotes-page__doc-badge--declined'
                              : variant === 'converted'
                                ? 'quotes-page__doc-badge--converted'
                                : 'quotes-page__doc-badge--unknown'
                    return (
                      <span className={`quotes-page__doc-badge ${docClass}`}>{label}</span>
                    )
                  })()}
                </div>
              </div>

              <div className="quotes-page__preview-billto">
                <p className="quotes-page__preview-section-title">Bill to</p>
                <p className="quotes-page__preview-billto-name">
                  {resolveClientName(previewQuote)}
                </p>
                {(() => {
                  const email =
                    typeof previewQuote.client_email === 'string'
                      ? previewQuote.client_email.trim()
                      : String(previewQuote.client_email ?? '').trim()
                  if (!email) {
                    return (
                      <p className="quotes-page__preview-billto-muted">No email on file</p>
                    )
                  }
                  return (
                    <p className="quotes-page__preview-billto-email">{email}</p>
                  )
                })()}
              </div>

              <table className="quotes-page__preview-table">
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col" className="quotes-page__preview-th-num">
                      Qty
                    </th>
                    <th scope="col" className="quotes-page__preview-th-num">
                      Unit Price
                    </th>
                    <th scope="col" className="quotes-page__preview-th-num">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.map((line, index) => (
                    <tr key={index}>
                      <td>{line.description}</td>
                      <td className="quotes-page__preview-td-num">{line.quantity}</td>
                      <td className="quotes-page__preview-td-num">
                        {formatMoney(line.unit_price)}
                      </td>
                      <td className="quotes-page__preview-td-num">
                        {formatMoney(line.quantity * line.unit_price)}
                      </td>
                    </tr>
                  ))}
                  {previewLines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="quotes-page__preview-table-empty">
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="quotes-page__preview-grand">
                <span className="quotes-page__preview-grand-label">Grand total</span>
                <span className="quotes-page__preview-grand-value">
                  {formatMoney(resolveQuoteTotal(previewQuote))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Quotes
