import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined']
const SEND_QUOTE_URL = 'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-quote'

const initialForm = { client_name: '', client_email: '', valid_until: '', status: 'draft' }

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
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount) } catch { return String(amount) }
}

function formatLineItemCount(n) {
  if (n === 0) return '0 line items'
  if (n === 1) return '1 line item'
  return `${n} line items`
}

function shortQuoteNumber(id) { if (id == null || id === '') return '—'; return String(id).slice(0, 8) }

function Quotes() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

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
    inputBg: '#1a1a1a',
    inputBorder: '#2a2a2a',
  }

  const labelStyle = {
    color: '#888',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block',
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${ui.inputBorder}`,
    background: ui.inputBg,
    color: ui.text,
    fontFamily: 'inherit',
    outline: 'none',
    fontSize: 14,
  }

  const cardStyle = {
    background: ui.card,
    border: `1px solid ${ui.border}`,
    borderRadius: 12,
    padding: 24,
  }

  const pillStyle = (active) => ({
    background: active ? '#1e2a1e' : ui.inputBg,
    border: `1px solid ${active ? ui.green : ui.inputBorder}`,
    color: active ? ui.green : '#666',
    borderRadius: 20,
    padding: '6px 16px',
    fontSize: 12,
    fontWeight: 700,
    userSelect: 'none',
  })

  const statusBadgeStyle = (variant) => {
    const v = String(variant || '').toLowerCase()
    if (v === 'accepted') return { bg: `${ui.green}18`, border: `${ui.green}55`, color: ui.green }
    if (v === 'sent') return { bg: `${ui.yellow}18`, border: `${ui.yellow}55`, color: ui.yellow }
    if (v === 'declined') return { bg: `${ui.red}18`, border: `${ui.red}55`, color: ui.red }
    if (v === 'draft') return { bg: `${ui.grey}18`, border: `${ui.grey}55`, color: ui.grey }
    if (v === 'converted') return { bg: '#1a1a1a', border: ui.inputBorder, color: '#93c5fd' }
    return { bg: '#1a1a1a', border: ui.inputBorder, color: ui.text }
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
  const [businessName, setBusinessName] = useState('')
  const [brandKit, setBrandKit] = useState(null)
  const [previewQuote, setPreviewQuote] = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const previewCloseRef = useRef(null)
  const quoteContentRef = useRef(null)

  const draftTotal = useMemo(() => lineItemsTotal(buildItemsPayload(lineItems)), [lineItems])
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
    e.preventDefault(); setSuccessMessage('')
    if (!supabase || !userId) { setErrorMessage('Not signed in.'); return }
    if (!form.client_name.trim()) { setErrorMessage('Client name is required.'); return }
    const itemsPayload = buildItemsPayload(lineItems)
    if (itemsPayload.length === 0) { setErrorMessage('Add at least one line item.'); return }
    const amountTotal = lineItemsTotal(itemsPayload)
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) { setErrorMessage('Quote total must be greater than zero.'); return }
    setSubmitting(true); setErrorMessage('')
    const payload = { creative_id: userId, client_name: form.client_name.trim(), client_email: form.client_email.trim() || null, amount: amountTotal, items: itemsPayload, valid_until: form.valid_until || null, status: form.status }
    const { error } = await supabase.from('quotes').insert(payload)
    if (error) setErrorMessage(error.message)
    else { setSuccessMessage('Quote created.'); setForm(initialForm); setLineItems([newLineItemRow()]); await loadQuotes() }
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
          background: ui.bg,
          minHeight: '100vh',
          padding: 28,
          color: ui.text,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          boxSizing: 'border-box',
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
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Quotes</h1>
        <p style={{ margin: '8px 0 0', color: ui.muted, fontSize: 13 }}>
          Sign in to manage quotes.
        </p>
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
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Quotes</h1>
        <p style={{ margin: '8px 0 0', color: ui.muted, fontSize: 13 }}>
          Create and send professional quotes to your clients
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <span style={pillStyle(true)}>All</span>
        <span style={pillStyle(false)}>Draft</span>
        <span style={pillStyle(false)}>Sent</span>
        <span style={pillStyle(false)}>Accepted</span>
        <span style={pillStyle(false)}>Declined</span>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            Create New Quote
          </div>

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle} htmlFor="quote-client-name">
                  Client Name
                </label>
                <input
                  id="quote-client-name"
                  name="client_name"
                  value={form.client_name}
                  onChange={handleFormChange}
                  required
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="quote-client-email">
                  Client Email
                </label>
                <input
                  id="quote-client-email"
                  name="client_email"
                  type="email"
                  value={form.client_email}
                  onChange={handleFormChange}
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="quote-valid-until">
                  Valid Until
                </label>
                <input
                  id="quote-valid-until"
                  name="valid_until"
                  type="date"
                  value={form.valid_until}
                  onChange={handleFormChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle} htmlFor="quote-status">
                Status
              </label>
              <select
                id="quote-status"
                name="status"
                value={form.status}
                onChange={handleFormChange}
                style={inputStyle}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Line Items</div>
                <button
                  type="button"
                  onClick={addLineItem}
                  style={{
                    background: ui.inputBg,
                    border: `1px solid ${ui.inputBorder}`,
                    color: '#666',
                    borderRadius: 20,
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Add Item
                </button>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                {lineItems.map((line, index) => {
                  const qty = Number(line.quantity)
                  const rate = Number(line.unit_price)
                  const lineTotal = Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0
                  return (
                    <div
                      key={line.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 90px 120px 120px auto',
                        gap: 10,
                        alignItems: 'end',
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${ui.inputBorder}`,
                        background: ui.inputBg,
                      }}
                    >
                      <div>
                        <label style={labelStyle} htmlFor={`q-desc-${line.id}`}>
                          Description
                        </label>
                        <input
                          id={`q-desc-${line.id}`}
                          value={line.description}
                          onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                          placeholder="e.g. Half-day shoot"
                          autoComplete="off"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle} htmlFor={`q-qty-${line.id}`}>
                          Qty
                        </label>
                        <input
                          id={`q-qty-${line.id}`}
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(e) => updateLineItem(line.id, 'quantity', e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle} htmlFor={`q-price-${line.id}`}>
                          Rate
                        </label>
                        <input
                          id={`q-price-${line.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => updateLineItem(line.id, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <span style={labelStyle}>Total</span>
                        <div style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${ui.inputBorder}`, background: '#111', color: ui.text, fontWeight: 700 }}>
                          {formatMoney(lineTotal)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(line.id)}
                        disabled={lineItems.length === 1}
                        aria-label={`Remove line ${index + 1}`}
                        style={{
                          borderRadius: 8,
                          border: `1px solid ${ui.inputBorder}`,
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
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${ui.border}` }}>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Total</div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{formatMoney(draftTotal)}</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              style={{
                marginTop: 16,
                width: '100%',
                background: ui.green,
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '12px 14px',
                fontWeight: 700,
                fontSize: 14,
                cursor: submitting || loading ? 'not-allowed' : 'pointer',
                opacity: submitting || loading ? 0.6 : 1,
              }}
            >
              {submitting ? 'Creating…' : 'Create Quote'}
            </button>
          </form>
        </div>

        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Quotes</div>

          {loading ? (
            <p style={{ margin: 0, color: ui.muted }}>Loading quotes…</p>
          ) : quotes.length === 0 ? (
            <div
              style={{
                background: ui.card,
                border: `1px dashed ${ui.border}`,
                borderRadius: 12,
                padding: 22,
                color: ui.muted,
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#fff', fontWeight: 700 }}>No quotes yet</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>Create your first quote using the form.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {quotes.map((row) => {
                const { variant, label } = getStatusInfo(row)
                const statusRaw = String(row?.status ?? '').toLowerCase().trim()
                const showConvert = statusRaw === 'accepted'
                const showSend = statusRaw !== 'converted'
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
                      background: ui.card,
                      border: `1px solid ${ui.border}`,
                      borderRadius: 12,
                      padding: 18,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                          {resolveClientName(row)}
                        </div>
                        <div style={{ marginTop: 4, color: ui.muted, fontSize: 13 }}>
                          Quote #{String(row.id).slice(0, 8)}
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
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: ui.muted, fontSize: 12, fontWeight: 700 }}>Amount</div>
                        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{formatMoney(total)}</div>
                      </div>
                      <div>
                        <div style={{ color: ui.muted, fontSize: 12, fontWeight: 700 }}>Date</div>
                        <div style={{ color: ui.text, fontSize: 13, fontWeight: 700 }}>
                          {createdAt ? formatDocumentDate(createdAt) : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: ui.muted, fontSize: 12, fontWeight: 700 }}>Valid until</div>
                        <div style={{ color: ui.text, fontSize: 13, fontWeight: 700 }}>
                          {formatValidUntil(resolveValidUntil(row))}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: ui.muted, fontSize: 12, fontWeight: 700 }}>Items</div>
                        <div style={{ color: ui.text, fontSize: 13, fontWeight: 700 }}>
                          {formatLineItemCount(lineCount)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setPreviewQuote(row)}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: `1px solid ${ui.inputBorder}`,
                          background: ui.inputBg,
                          color: ui.text,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        View
                      </button>

                      {showSend && (
                        <button
                          type="button"
                          disabled={sendingQuoteId === row.id}
                          onClick={() => handleSendQuote(row)}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 8,
                            border: `1px solid ${ui.inputBorder}`,
                            background: ui.inputBg,
                            color: ui.text,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: sendingQuoteId === row.id ? 'not-allowed' : 'pointer',
                            opacity: sendingQuoteId === row.id ? 0.6 : 1,
                          }}
                        >
                          {sendingQuoteId === row.id ? 'Sending...' : 'Send'}
                        </button>
                      )}

                      {showConvert && (
                        <button
                          type="button"
                          disabled={convertingId === row.id || deletingId === row.id}
                          onClick={() => handleConvertToInvoice(row)}
                          style={{
                            padding: '9px 10px',
                            borderRadius: 8,
                            border: `1px solid ${ui.inputBorder}`,
                            background: ui.inputBg,
                            color: ui.text,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor:
                              convertingId === row.id || deletingId === row.id
                                ? 'not-allowed'
                                : 'pointer',
                            opacity: convertingId === row.id || deletingId === row.id ? 0.6 : 1,
                          }}
                        >
                          {convertingId === row.id ? 'Converting…' : 'Convert to Invoice'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={deletingId === row.id || convertingId === row.id}
                        onClick={() => handleDelete(row.id)}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 8,
                          border: `1px solid ${ui.inputBorder}`,
                          background: 'transparent',
                          color: ui.red,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor:
                            deletingId === row.id || convertingId === row.id
                              ? 'not-allowed'
                              : 'pointer',
                          opacity: deletingId === row.id || convertingId === row.id ? 0.6 : 1,
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
                            color: rowSendFeedback.kind === 'success' ? ui.green : ui.red,
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
                            color: rowConvertFeedback.kind === 'success' ? ui.green : ui.red,
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

      {errorMessage && (
        <div style={{ marginTop: 14, color: ui.red, fontWeight: 700, fontSize: 13 }} role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && !errorMessage && (
        <div style={{ marginTop: 14, color: ui.green, fontWeight: 700, fontSize: 13 }} role="status">
          {successMessage}
        </div>
      )}

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
