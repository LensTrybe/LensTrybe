import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

const SEND_QUOTE_URL = 'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-quote'

const initialForm = {
  client_name: '',
  client_email: '',
  quote_title: '',
  valid_days: '14',
  tax_percent: '10',
  status: 'draft',
}

function newLineItemRow() {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    description: '', quantity: '1', unit_price: '',
  }
}

function parseItemsFromRow(row) {
  const raw = row?.items
  if (raw == null) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] } }
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

function lineItemsTotal(lines) { return lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0) }

function buildInvoiceItemsFromQuote(row) {
  return parseItemsFromRow(row).map(normalizeStoredItem).filter(Boolean).map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }))
}

function buildItemsPayload(lineRows) {
  return lineRows.map((line) => ({ description: line.description.trim(), quantity: Number(line.quantity), unit_price: Number(line.unit_price) }))
    .filter((line) => line.description.length > 0 && Number.isFinite(line.quantity) && line.quantity > 0 && Number.isFinite(line.unit_price) && line.unit_price >= 0)
}

function getStatusInfo(row) {
  const raw = String(row?.status ?? 'draft').toLowerCase().trim()
  if (raw === 'draft') return { variant: 'draft', label: 'draft' }
  if (raw === 'sent') return { variant: 'sent', label: 'sent' }
  if (raw === 'accepted') return { variant: 'accepted', label: 'accepted' }
  if (raw === 'declined') return { variant: 'declined', label: 'declined' }
  if (raw === 'converted') return { variant: 'converted', label: 'converted' }
  return { variant: 'unknown', label: String(row?.status ?? 'unknown').trim() || 'unknown' }
}

function resolveClientName(row) { return row?.client_name ?? row?.clientName ?? row?.name ?? 'Client' }

function resolveAmount(row) {
  const n = row?.amount ?? row?.total ?? row?.total_amount
  if (n === null || n === undefined || n === '') return null
  const num = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(num) ? num : null
}

function resolveQuoteTotal(row) {
  const fromCol = resolveAmount(row)
  if (fromCol != null) return fromCol
  const normalized = parseItemsFromRow(row).map(normalizeStoredItem).filter(Boolean)
  return normalized.length ? lineItemsTotal(normalized) : null
}

function resolveValidUntil(row) {
  const raw = row?.valid_until ?? row?.validUntil ?? null
  if (raw == null || raw === '') return null
  const d = typeof raw === 'string' ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`) : new Date(raw)
  return Number.isNaN(d.getTime()) ? String(raw) : d
}

function formatValidUntil(value) {
  if (value == null) return '—'
  if (value instanceof Date) return value.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  return String(value)
}

function formatDocumentDate(value) {
  if (value == null) return '—'
  const d = value instanceof Date ? value : typeof value === 'string' ? new Date(value.includes('T') ? value : `${value}T12:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatMoney(amount) {
  if (amount === null || amount === undefined) return '—'
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
  } catch {
    return String(amount)
  }
}

function formatLineItemCount(n) {
  if (n === 0) return '0 line items'
  if (n === 1) return '1 line item'
  return `${n} line items`
}

function shortQuoteNumber(id) { if (id == null || id === '') return '—'; return String(id).slice(0, 8) }

function resolveQuoteTitle(row) {
  const t = row?.title ?? row?.service
  if (t && String(t).trim()) return String(t).trim()
  const raw = parseItemsFromRow(row)[0]
  if (raw && typeof raw === 'object') {
    const d = String(raw.description ?? raw.desc ?? '').trim()
    if (d) return d.length > 80 ? `${d.slice(0, 80)}…` : d
  }
  return `Quote #${shortQuoteNumber(row.id)}`
}

function Quotes() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const PAGE = {
    bg: '#0a0a0f',
    text: 'rgb(242, 242, 242)',
    card: '#13131a',
    border: '#1e1e1e',
    inner: '#1a1a24',
    innerBorder: '#202027',
    muted: '#555',
    label: '#888',
    green: '#39ff14',
    yellow: '#facc15',
    red: '#f87171',
    grey: '#9ca3af',
  }

  const font = { fontFamily: 'Inter, sans-serif' }

  const labelStyle = {
    color: PAGE.label,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
    display: 'block',
    ...font,
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 6,
    border: `1px solid ${PAGE.innerBorder}`,
    background: PAGE.inner,
    color: '#fff',
    ...font,
    outline: 'none',
    fontSize: 14,
  }

  const cardStyle = {
    background: PAGE.card,
    border: `1px solid ${PAGE.border}`,
    borderRadius: 12,
    padding: 24,
    boxSizing: 'border-box',
    ...font,
  }

  const sectionHeading = {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    borderLeft: `3px solid ${PAGE.green}`,
    paddingLeft: 10,
    marginBottom: 20,
    ...font,
  }

  const subSectionTitle = {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12,
    ...font,
  }

  const pillStyle = (active) => ({
    background: active ? '#1e2a1e' : PAGE.inner,
    border: `1px solid ${active ? PAGE.green : PAGE.innerBorder}`,
    color: active ? PAGE.green : PAGE.label,
    borderRadius: 999,
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    ...font,
  })

  const statusBadgeStyle = (variant) => {
    const v = String(variant || '').toLowerCase()
    if (v === 'accepted') return { bg: `${PAGE.green}18`, border: `${PAGE.green}55`, color: PAGE.green }
    if (v === 'sent') return { bg: `${PAGE.yellow}18`, border: `${PAGE.yellow}55`, color: PAGE.yellow }
    if (v === 'declined') return { bg: `${PAGE.red}18`, border: `${PAGE.red}55`, color: PAGE.red }
    if (v === 'draft') return { bg: `${PAGE.grey}18`, border: `${PAGE.grey}55`, color: PAGE.grey }
    if (v === 'converted') return { bg: '#1a1a1a', border: PAGE.innerBorder, color: '#93c5fd' }
    return { bg: '#1a1a1a', border: PAGE.innerBorder, color: PAGE.text }
  }

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
  const [quoteFilter, setQuoteFilter] = useState('all')
  const [businessName, setBusinessName] = useState('')
  const [brandKit, setBrandKit] = useState(null)
  const [previewQuote, setPreviewQuote] = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const previewCloseRef = useRef(null)
  const quoteContentRef = useRef(null)

  const { draftSubtotal, draftTax, draftTotalWithTax } = useMemo(() => {
    const payload = buildItemsPayload(lineItems)
    const sub = lineItemsTotal(payload)
    const pct = Number(form.tax_percent)
    const tax = Number.isFinite(pct) ? sub * (pct / 100) : 0
    return { draftSubtotal: sub, draftTax: tax, draftTotalWithTax: sub + tax }
  }, [lineItems, form.tax_percent])

  const filteredQuotes = useMemo(() => {
    return quotes.filter((row) => {
      const { variant } = getStatusInfo(row)
      if (quoteFilter === 'all') return true
      if (quoteFilter === 'draft') return variant === 'draft'
      if (quoteFilter === 'sent') return variant === 'sent'
      if (quoteFilter === 'accepted') return variant === 'accepted' || variant === 'converted'
      if (quoteFilter === 'declined') return variant === 'declined'
      return true
    })
  }, [quotes, quoteFilter])

  const previewLines = useMemo(() => (previewQuote ? buildInvoiceItemsFromQuote(previewQuote) : []), [previewQuote])

  const loadQuotes = useCallback(async () => {
    if (!supabase || !userId) { setQuotes([]); setLoading(false); return }
    setLoading(true); setErrorMessage('')
    const { data, error } = await supabase.from('quotes').select('*').eq('creative_id', userId).order('created_at', { ascending: false })
    if (error) { setErrorMessage(error.message); setQuotes([]) } else setQuotes(data ?? [])
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
    loadQuotes(); loadBusinessProfile(); loadBrandKit()
  }, [authLoading, loadQuotes, loadBusinessProfile, loadBrandKit])

  useEffect(() => {
    if (!previewQuote) { setPdfGenerating(false); return undefined }
    const onKeyDown = (e) => { if (e.key === 'Escape') setPreviewQuote(null) }
    window.addEventListener('keydown', onKeyDown)
    previewCloseRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewQuote])

  const handleDownloadPdf = async () => {
    if (!quoteContentRef.current || !previewQuote || pdfGenerating) return
    const quoteNumber = shortQuoteNumber(previewQuote.id)
    setPdfGenerating(true); setErrorMessage('')
    try {
      const canvas = await html2canvas(quoteContentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let yOffset = 0
      while (yOffset < imgHeight) { if (yOffset > 0) pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight); yOffset += pageHeight }
      pdf.save(`quote-${quoteNumber}.pdf`)
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : 'Could not generate PDF.') }
    finally { setPdfGenerating(false) }
  }

  const handleFormChange = (e) => { const { name, value } = e.target; setForm((c) => ({ ...c, [name]: value })) }
  const updateLineItem = (id, field, value) => setLineItems((prev) => prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)))
  const addLineItem = () => setLineItems((prev) => [...prev, newLineItemRow()])
  const removeLineItem = (id) => { setLineItems((prev) => { const next = prev.filter((line) => line.id !== id); return next.length === 0 ? [newLineItemRow()] : next }) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccessMessage('')
    if (!supabase || !userId) {
      setErrorMessage('Not signed in.')
      return
    }
    if (!form.client_name.trim()) {
      setErrorMessage('Client name is required.')
      return
    }
    let itemsPayload = buildItemsPayload(lineItems)
    if (itemsPayload.length === 0) {
      setErrorMessage('Add at least one line item.')
      return
    }
    const titlePrefix = form.quote_title.trim()
    if (titlePrefix) {
      itemsPayload = itemsPayload.map((it, idx) =>
        idx === 0 ? { ...it, description: `${titlePrefix} — ${it.description}`.trim() } : it,
      )
    }
    const subtotal = lineItemsTotal(itemsPayload)
    const taxPct = Number(form.tax_percent)
    const taxAmt = Number.isFinite(taxPct) ? subtotal * (taxPct / 100) : 0
    const amountTotal = subtotal + taxAmt
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
      setErrorMessage('Quote total must be greater than zero.')
      return
    }
    const days = Number(form.valid_days)
    let validUntil = null
    if (Number.isFinite(days) && days > 0) {
      const d = new Date()
      d.setDate(d.getDate() + Math.floor(days))
      validUntil = d.toISOString().slice(0, 10)
    }
    setSubmitting(true)
    setErrorMessage('')
    const payload = {
      creative_id: userId,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      amount: amountTotal,
      items: itemsPayload,
      valid_until: validUntil,
      status: form.status,
    }
    const { error } = await supabase.from('quotes').insert(payload)
    if (error) setErrorMessage(error.message)
    else {
      setSuccessMessage('Quote created.')
      setForm(initialForm)
      setLineItems([newLineItemRow()])
      await loadQuotes()
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!supabase || !id) return
    setSuccessMessage(''); setDeletingId(id); setErrorMessage('')
    const { error } = await supabase.from('quotes').delete().eq('id', id)
    if (error) setErrorMessage(error.message)
    else { setSuccessMessage('Quote removed.'); setQuotes((c) => c.filter((row) => row.id !== id)) }
    setDeletingId(null)
  }

  const handleAcceptQuote = async (id) => {
    if (!supabase || !userId || !id) return
    setSuccessMessage('')
    setErrorMessage('')
    const { error } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', id).eq('creative_id', userId)
    if (error) setErrorMessage(error.message)
    else {
      setSuccessMessage('Quote marked as accepted.')
      setQuotes((c) => c.map((row) => (row.id === id ? { ...row, status: 'accepted' } : row)))
      setPreviewQuote((open) => (open?.id === id ? { ...open, status: 'accepted' } : open))
    }
  }

  const handleConvertToInvoice = async (row) => {
    if (!supabase || !userId || !row?.id) return
    setConvertCardFeedback(null); setConvertingId(row.id)
    const clientName = String(row.client_name ?? '').trim()
    if (!clientName) { setConvertCardFeedback({ quoteId: row.id, kind: 'error', message: 'Quote is missing a client name.' }); setConvertingId(null); return }
    const itemsPayload = buildInvoiceItemsFromQuote(row)
    if (itemsPayload.length === 0) { setConvertCardFeedback({ quoteId: row.id, kind: 'error', message: 'Quote has no valid line items to copy.' }); setConvertingId(null); return }
    const amountTotal = resolveQuoteTotal(row)
    if (amountTotal == null || !Number.isFinite(amountTotal) || amountTotal <= 0) { setConvertCardFeedback({ quoteId: row.id, kind: 'error', message: 'Quote amount is missing or invalid.' }); setConvertingId(null); return }
    const { error: insertError } = await supabase.from('invoices').insert({ creative_id: userId, client_name: clientName, client_email: String(row.client_email ?? '').trim() || null, amount: amountTotal, items: itemsPayload, status: 'draft', due_date: null })
    if (insertError) { setConvertCardFeedback({ quoteId: row.id, kind: 'error', message: insertError.message }); setConvertingId(null); return }
    const { error: updateError } = await supabase.from('quotes').update({ status: 'converted' }).eq('id', row.id).eq('creative_id', userId)
    if (updateError) { setConvertCardFeedback({ quoteId: row.id, kind: 'error', message: updateError.message }); setConvertingId(null); return }
    setConvertCardFeedback({ quoteId: row.id, kind: 'success', message: 'Invoice created!' })
    await loadQuotes(); setConvertingId(null)
    window.setTimeout(() => setConvertCardFeedback((c) => c?.quoteId === row.id && c?.kind === 'success' ? null : c), 2500)
  }

  const handleSendQuote = async (row) => {
    if (!supabase || !userId || !row?.id) return
    setSendQuoteFeedback(null); setSendingQuoteId(row.id)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (sessionError || !accessToken) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: sessionError?.message ?? 'Session error.' }); setSendingQuoteId(null); return }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('business_name, business_email').eq('id', userId).maybeSingle()
    if (profileError) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: profileError.message }); setSendingQuoteId(null); return }
    const bName = profile?.business_name?.trim() ?? ''
    const bEmail = profile?.business_email?.trim() ?? ''
    if (!bName) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: 'Add your business name in your profile before sending.' }); setSendingQuoteId(null); return }
    if (!bEmail || !bEmail.includes('@')) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: 'Add a valid business email in your profile before sending.' }); setSendingQuoteId(null); return }
    const to = typeof row.client_email === 'string' ? row.client_email.trim() : String(row.client_email ?? '').trim()
    if (!to) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: 'This quote needs a client email before you can send it.' }); setSendingQuoteId(null); return }
    const clientName = typeof row.client_name === 'string' ? row.client_name.trim() : String(row.client_name ?? '').trim()
    if (!clientName) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: 'This quote needs a client name before you can send it.' }); setSendingQuoteId(null); return }
    const normalizedItems = buildInvoiceItemsFromQuote(row)
    if (normalizedItems.length === 0) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: 'This quote has no line items to send.' }); setSendingQuoteId(null); return }
    try {
      const response = await fetch(SEND_QUOTE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, clientName, businessName: bName, replyTo: bEmail, quoteNumber: String(row.id).slice(0, 8), validUntil: row.valid_until || 'Not set', amount: row.amount, items: normalizedItems, status: row.status }),
      })
      let result = null
      try { result = await response.json() } catch { result = null }
      if (!response.ok) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: result?.error ?? `Send failed (${response.status})` }); setSendingQuoteId(null); return }
      if (result?.success) {
        setSendQuoteFeedback({ quoteId: row.id, kind: 'success', message: 'Sent!' }); setSendingQuoteId(null)
        window.setTimeout(() => setSendQuoteFeedback((c) => c?.quoteId === row.id && c?.kind === 'success' ? null : c), 2500)
      } else { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: result?.error ?? 'Send failed.' }); setSendingQuoteId(null) }
    } catch (err) { setSendQuoteFeedback({ quoteId: row.id, kind: 'error', message: err instanceof Error ? err.message : 'Network error.' }); setSendingQuoteId(null) }
  }

  const brandColor = brandKit?.primary_color || '#000000'
  const brandLogo = brandKit?.logo_url || ''

  if (authLoading)
    return (
      <section
        style={{
          background: PAGE.bg,
          minHeight: '100vh',
          padding: 32,
          color: PAGE.text,
          ...font,
          boxSizing: 'border-box',
        }}
      >
        <p style={{ margin: 0, color: PAGE.muted }}>Loading session…</p>
      </section>
    )

  if (!userId)
    return (
      <section
        style={{
          background: PAGE.bg,
          minHeight: '100vh',
          padding: 32,
          color: PAGE.text,
          ...font,
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Quotes</h1>
        <p style={{ margin: '8px 0 0', color: PAGE.muted, fontSize: 13 }}>
          Sign in to manage quotes.
        </p>
      </section>
    )

  const colHeader = {
    color: PAGE.label,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    ...font,
  }

  const actionBtn = (disabled) => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${PAGE.innerBorder}`,
    background: PAGE.inner,
    color: PAGE.text,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    ...font,
  })

  const FILTER_KEYS = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'declined', label: 'Declined' },
  ]

  return (
    <section
      style={{
        background: PAGE.bg,
        minHeight: '100vh',
        padding: 32,
        color: PAGE.text,
        ...font,
        boxSizing: 'border-box',
      }}
    >
      {errorMessage && (
        <div style={{ marginBottom: 16, color: PAGE.red, fontWeight: 700, fontSize: 13 }} role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && !errorMessage && (
        <div style={{ marginBottom: 16, color: PAGE.green, fontWeight: 700, fontSize: 13 }} role="status">
          {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
        <div style={cardStyle}>
          <div style={sectionHeading}>Create New Quote</div>

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 24,
                marginBottom: 24,
              }}
            >
              <div>
                <div style={subSectionTitle}>Client Information</div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle} htmlFor="quote-client-name">
                    Client name
                  </label>
                  <input
                    id="quote-client-name"
                    name="client_name"
                    value={form.client_name}
                    onChange={handleFormChange}
                    required
                    autoComplete="off"
                    placeholder="Client name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="quote-client-email">
                    Client email
                  </label>
                  <input
                    id="quote-client-email"
                    name="client_email"
                    type="email"
                    value={form.client_email}
                    onChange={handleFormChange}
                    autoComplete="off"
                    placeholder="Client email"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <div style={subSectionTitle}>Project Details</div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle} htmlFor="quote-title">
                    Quote title
                  </label>
                  <input
                    id="quote-title"
                    name="quote_title"
                    value={form.quote_title}
                    onChange={handleFormChange}
                    autoComplete="off"
                    placeholder="Project title"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="quote-valid-days">
                    Valid until (days from now)
                  </label>
                  <input
                    id="quote-valid-days"
                    name="valid_days"
                    type="number"
                    min="1"
                    step="1"
                    value={form.valid_days}
                    onChange={handleFormChange}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, ...font }}>Line Items</span>
                <button
                  type="button"
                  onClick={addLineItem}
                  style={{
                    background: '#1e2a1e',
                    border: `1px solid ${PAGE.green}`,
                    color: PAGE.green,
                    borderRadius: 8,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    ...font,
                  }}
                >
                  + Add Item
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 120px 120px 36px',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={colHeader}>Description</span>
                <span style={colHeader}>Qty</span>
                <span style={colHeader}>Rate</span>
                <span style={{ ...colHeader, textAlign: 'right' }}>Total</span>
                <span style={colHeader} aria-hidden />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {lineItems.map((line, index) => {
                  const qty = Number(line.quantity)
                  const rate = Number(line.unit_price)
                  const lineTotal = Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0
                  return (
                    <div
                      key={line.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <input
                        id={`q-desc-${line.id}`}
                        value={line.description}
                        onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                        placeholder="Description"
                        autoComplete="off"
                        aria-label={`Line ${index + 1} description`}
                        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                      />
                      <input
                        id={`q-qty-${line.id}`}
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLineItem(line.id, 'quantity', e.target.value)}
                        aria-label={`Line ${index + 1} quantity`}
                        style={{ ...inputStyle, width: 80, textAlign: 'center' }}
                      />
                      <input
                        id={`q-price-${line.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLineItem(line.id, 'unit_price', e.target.value)}
                        placeholder="Rate"
                        aria-label={`Line ${index + 1} rate`}
                        style={{ ...inputStyle, width: 120, textAlign: 'center' }}
                      />
                      <div
                        style={{
                          width: 120,
                          textAlign: 'right',
                          color: '#aaa',
                          fontSize: 13,
                          fontWeight: 600,
                          ...font,
                          minWidth: 0,
                        }}
                      >
                        {formatMoney(lineTotal)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(line.id)}
                        disabled={lineItems.length === 1}
                        aria-label={`Remove line ${index + 1}`}
                        title="Remove"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          color: PAGE.red,
                          fontSize: 20,
                          fontWeight: 700,
                          lineHeight: 1,
                          cursor: lineItems.length === 1 ? 'not-allowed' : 'pointer',
                          opacity: lineItems.length === 1 ? 0.35 : 1,
                          ...font,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 10,
                paddingTop: 16,
                borderTop: `1px solid ${PAGE.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  maxWidth: 320,
                  gap: 16,
                  ...font,
                }}
              >
                <span style={{ color: PAGE.label }}>Subtotal</span>
                <span style={{ color: '#fff' }}>{formatMoney(draftSubtotal)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  maxWidth: 320,
                  gap: 16,
                  ...font,
                }}
              >
                <span style={{ color: PAGE.label }}>Tax (GST)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <input
                    name="tax_percent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tax_percent}
                    onChange={handleFormChange}
                    aria-label="GST percent"
                    style={{ ...inputStyle, width: 60, minWidth: 60, padding: '6px 8px' }}
                  />
                  <span style={{ color: PAGE.label }}>%</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{formatMoney(draftTax)}</span>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  maxWidth: 320,
                  gap: 16,
                  marginTop: 4,
                  ...font,
                }}
              >
                <span style={{ color: '#fff', fontWeight: 700 }}>Total</span>
                <span style={{ color: PAGE.green, fontWeight: 700, fontSize: 20 }}>{formatMoney(draftTotalWithTax)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              style={{
                marginTop: 16,
                width: '100%',
                background: PAGE.green,
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: 12,
                fontWeight: 700,
                fontSize: 14,
                cursor: submitting || loading ? 'not-allowed' : 'pointer',
                opacity: submitting || loading ? 0.6 : 1,
                ...font,
              }}
            >
              {submitting ? 'Creating…' : 'Create Quote'}
            </button>
          </form>
        </div>

        <div style={cardStyle}>
          <div style={sectionHeading}>Quotes</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {FILTER_KEYS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setQuoteFilter(key)} style={pillStyle(quoteFilter === key)}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ margin: 0, color: PAGE.muted }}>Loading quotes…</p>
          ) : quotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: PAGE.muted }}>
              <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}></div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, ...font }}>No quotes yet.</div>
              <div style={{ marginTop: 8, fontSize: 13, color: PAGE.muted, ...font }}>Create your first quote to get started.</div>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: PAGE.muted, ...font }}>No quotes match this filter.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredQuotes.map((row) => {
                const { variant, label } = getStatusInfo(row)
                const statusRaw = String(row?.status ?? '').toLowerCase().trim()
                const showConvert = statusRaw === 'accepted'
                const showSend = statusRaw !== 'converted'
                const showAccept = statusRaw === 'sent'
                const rowConvertFeedback = convertCardFeedback?.quoteId === row.id ? convertCardFeedback : null
                const total = resolveQuoteTotal(row)
                const lineCount = parseItemsFromRow(row).length
                const rowSendFeedback = sendQuoteFeedback?.quoteId === row.id ? sendQuoteFeedback : null

                const badge = statusBadgeStyle(variant)
                const createdAt = row?.created_at ? new Date(row.created_at) : null

                return (
                  <div
                    key={row.id}
                    style={{
                      background: PAGE.inner,
                      border: `1px solid ${PAGE.innerBorder}`,
                      borderRadius: 10,
                      padding: 16,
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, ...font }}>{resolveClientName(row)}</div>
                        <div style={{ marginTop: 6, color: '#aaa', fontSize: 13, ...font }}>{resolveQuoteTitle(row)}</div>
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
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                          ...font,
                        }}
                      >
                        {label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, ...font }}>{formatMoney(total)}</div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: PAGE.label, ...font }}>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>Date</div>
                          <div style={{ color: PAGE.text, fontWeight: 600 }}>{createdAt ? formatDocumentDate(createdAt) : '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>Valid until</div>
                          <div style={{ color: PAGE.text, fontWeight: 600 }}>{formatValidUntil(resolveValidUntil(row))}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>Items</div>
                          <div style={{ color: PAGE.text, fontWeight: 600 }}>{formatLineItemCount(lineCount)}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <button type="button" onClick={() => setPreviewQuote(row)} style={actionBtn(false)}>
                        View
                      </button>

                      {showSend && (
                        <button
                          type="button"
                          disabled={sendingQuoteId === row.id}
                          onClick={() => handleSendQuote(row)}
                          style={actionBtn(sendingQuoteId === row.id)}
                        >
                          {sendingQuoteId === row.id ? 'Sending...' : 'Send'}
                        </button>
                      )}

                      {showAccept && (
                        <button type="button" onClick={() => handleAcceptQuote(row.id)} style={actionBtn(false)}>
                          Accept
                        </button>
                      )}

                      {showConvert && (
                        <button
                          type="button"
                          disabled={convertingId === row.id || deletingId === row.id}
                          onClick={() => handleConvertToInvoice(row)}
                          style={actionBtn(convertingId === row.id || deletingId === row.id)}
                        >
                          {convertingId === row.id ? 'Converting…' : 'Convert to Invoice'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={deletingId === row.id || convertingId === row.id}
                        onClick={() => handleDelete(row.id)}
                        style={{
                          ...actionBtn(deletingId === row.id || convertingId === row.id),
                          background: 'transparent',
                          color: PAGE.red,
                        }}
                      >
                        {deletingId === row.id ? 'Removing…' : 'Delete'}
                      </button>

                      {rowSendFeedback && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            color: rowSendFeedback.kind === 'success' ? PAGE.green : PAGE.red,
                            ...font,
                          }}
                          role={rowSendFeedback.kind === 'error' ? 'alert' : 'status'}
                        >
                          {rowSendFeedback.message}
                        </span>
                      )}

                      {rowConvertFeedback && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            color: rowConvertFeedback.kind === 'success' ? PAGE.green : PAGE.red,
                            ...font,
                          }}
                          role={rowConvertFeedback.kind === 'error' ? 'alert' : 'status'}
                        >
                          {rowConvertFeedback.message}
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

      {previewQuote && (
        <div
          role="presentation"
          onClick={() => setPreviewQuote(null)}
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
            ref={quoteContentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-preview-title"
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
                      id="quote-preview-title"
                      style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 900,
                        letterSpacing: '0.14em',
                        color: brandColor,
                      }}
                    >
                      QUOTE
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
                    onClick={() => setPreviewQuote(null)}
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
                    Quote #
                  </div>
                  <div style={{ fontWeight: 800 }}>{shortQuoteNumber(previewQuote.id)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>
                    Issue date
                  </div>
                  <div style={{ fontWeight: 800 }}>{formatDocumentDate(new Date())}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>
                    Valid Until
                  </div>
                  <div style={{ fontWeight: 800 }}>{formatValidUntil(resolveValidUntil(previewQuote))}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
                    Status
                  </div>
                  {(() => {
                    const { variant, label } = getStatusInfo(previewQuote)
                    const map =
                      variant === 'accepted'
                        ? { c: '#14532d', b: '#86efac', bg: '#dcfce7' }
                        : variant === 'sent'
                          ? { c: '#92400e', b: '#fcd34d', bg: '#fef3c7' }
                          : variant === 'declined'
                            ? { c: '#7f1d1d', b: '#fca5a5', bg: '#fee2e2' }
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
                <div style={{ fontWeight: 800 }}>{resolveClientName(previewQuote)}</div>
                <div style={{ color: '#374151', marginTop: 4 }}>
                  {(() => {
                    const email =
                      typeof previewQuote.client_email === 'string'
                        ? previewQuote.client_email.trim()
                        : String(previewQuote.client_email ?? '').trim()
                    return email || <em style={{ color: '#9ca3af' }}>No email on file</em>
                  })()}
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
                <span style={{ fontSize: 13, fontWeight: 800, color: '#374151' }}>Grand total</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: brandColor }}>
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
