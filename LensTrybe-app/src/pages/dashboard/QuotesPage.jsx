import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'

function quoteFreeTextForModeration(notes, lineItems) {
  const descs = (lineItems || []).map((i) => String(i.description ?? '').trim()).filter(Boolean)
  const n = String(notes ?? '').trim()
  return [n, ...descs].filter(Boolean).join('\n')
}

function statusVariant(status) {
  if (status === 'accepted') return 'green'
  if (status === 'declined') return 'error'
  if (status === 'sent') return 'info'
  if (status === 'viewed') return 'warning'
  return 'default'
}

function getQuoteItems(quote) {
  return quote?.line_items ?? quote?.items ?? []
}

/** Merge `brand_kit` with per-document `quote` settings from `document_brand_settings`. */
function mergeQuoteBrand(brandKit) {
  const base = brandKit || {}
  const raw = base.document_brand_settings
  const docs = raw && typeof raw === 'object' ? raw : {}
  const q = docs.quote && typeof docs.quote === 'object' ? docs.quote : {}
  const primary = q.primary_colour ?? q.primary_color ?? base.primary_color ?? '#1DB954'
  const accent = '#ffffff'
  const font = q.font ?? base.font ?? 'Inter'
  const logo = q.logo_url || base.logo_url || ''
  const secondary = base.secondary_color ?? '#ffffff'
  const hasCustomTemplate = Boolean(q.custom_template_url)
  const fontStack = font.includes(' ') ? `"${font}", sans-serif` : `${font}, sans-serif`
  return { primary, accent, font, logo, secondary, hasCustomTemplate, fontStack }
}

export default function QuotesPage() {
  const { user, profile } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [brandKit, setBrandKit] = useState(null)
  const [editingQuote, setEditingQuote] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [newQuote, setNewQuote] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    due_date: '',
    notes: '',
    line_items: [{ description: '', quantity: 1, rate: 0 }],
  })
  const [bankDetails, setBankDetails] = useState({ bank_name: '', bank_bsb: '', bank_account: '', bank_account_name: '' })
  const [editingBank, setEditingBank] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [quoteViewModerationError, setQuoteViewModerationError] = useState('')

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadBrandKit = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('brand_kit')
      .select('*')
      .eq('creative_id', user.id)
      .maybeSingle()
    setBrandKit(data ?? null)
  }, [user])

  useEffect(() => {
    loadQuotes()
    loadBrandKit()
  }, [user, loadBrandKit])

  useEffect(() => {
    window.addEventListener('focus', loadBrandKit)
    return () => window.removeEventListener('focus', loadBrandKit)
  }, [loadBrandKit])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (profile) {
      setBankDetails({
        bank_name: profile.bank_name ?? '',
        bank_bsb: profile.bank_bsb ?? '',
        bank_account: profile.bank_account ?? '',
        bank_account_name: profile.bank_account_name ?? '',
      })
    }
  }, [profile])

  async function loadQuotes() {
    if (!user) return
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setQuotes(data ?? [])
    setLoading(false)
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(amount) || 0)
  }

  async function saveBankDetails() {
    setBankSaving(true)
    await supabase.from('profiles').update({
      bank_name: bankDetails.bank_name,
      bank_bsb: bankDetails.bank_bsb,
      bank_account: bankDetails.bank_account,
      bank_account_name: bankDetails.bank_account_name,
    }).eq('id', user.id)
    setBankSaving(false)
    setEditingBank(false)
  }

  async function invokeSendQuoteEdge(quote) {
    if (!supabase || !quote?.id) return 'Not configured.'
    const quoteForEmail = { ...quote, line_items: getQuoteItems(quote) }
    const { data, error } = await supabase.functions.invoke('send-quote', {
      body: {
        quote: quoteForEmail,
        profile,
        bankDetails,
      },
    })
    if (error) return error.message
    if (data?.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
    return ''
  }

  async function createQuote(status = 'draft') {
    if (!supabase || !user?.id) {
      setSaveError('You must be signed in to create a quote.')
      return
    }

    setSaveError('')
    const qtext = quoteFreeTextForModeration(newQuote.notes, newQuote.line_items)
    if (qtext.trim()) {
      const mod = await moderateText(qtext)
      if (mod?.blocked) {
        setSaveError(MODERATION_BLOCKED_USER_MESSAGE)
        return
      }
      if (mod?.flagged) console.warn('[moderation] Flagged new quote text', mod.reason)
    }

    setSaving(true)
    const total = newQuote.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
    const quoteStatus = status === 'sent' ? 'draft' : status
    const { data, error } = await supabase.from('quotes').insert({
      creative_id: user.id,
      client_name: newQuote.client_name.trim(),
      client_email: newQuote.client_email.trim() || null,
      client_phone: newQuote.client_phone.trim() || null,
      client_address: newQuote.client_address.trim() || null,
      due_date: newQuote.due_date || null,
      notes: newQuote.notes?.trim() || null,
      line_items: newQuote.line_items,
      amount: total,
      status: quoteStatus,
      download_token: crypto.randomUUID(),
    }).select().single()

    if (error) {
      setSaveError(error.message)
    } else {
      if (status === 'sent') {
        const sendMessage = await invokeSendQuoteEdge(data)
        if (sendMessage) {
          setSaveError(sendMessage)
          setSaving(false)
          await loadQuotes()
          return
        }
        await supabase.from('quotes').update({ status: 'sent' }).eq('id', data.id)
        showToast('Quote sent successfully')
      }
      await loadQuotes()
      setShowCreate(false)
      setSaveError('')
      setNewQuote({
        client_name: '',
        client_email: '',
        client_phone: '',
        client_address: '',
        due_date: '',
        notes: '',
        line_items: [{ description: '', quantity: 1, rate: 0 }],
      })
    }
    setSaving(false)
  }

  async function markAccepted(id) {
    await supabase.from('quotes').update({ status: 'accepted' }).eq('id', id)
    await loadQuotes()
    setShowView(null)
    setEditingQuote(false)
  }

  async function deleteQuote(id) {
    await supabase.from('quotes').delete().eq('id', id)
    await loadQuotes()
    setShowView(null)
    setEditingQuote(false)
  }

  async function saveQuoteEdits() {
    const qtext = quoteFreeTextForModeration(editForm.notes, editForm.line_items)
    if (qtext.trim()) {
      const mod = await moderateText(qtext)
      if (mod?.blocked) {
        setQuoteViewModerationError(MODERATION_BLOCKED_USER_MESSAGE)
        return
      }
      if (mod?.flagged) console.warn('[moderation] Flagged quote edit text', mod.reason)
    }
    setQuoteViewModerationError('')
    const total = editForm.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
    const { data } = await supabase.from('quotes').update({
      client_name: editForm.client_name,
      client_email: editForm.client_email || null,
      client_phone: editForm.client_phone?.trim() || null,
      client_address: editForm.client_address?.trim() || null,
      line_items: editForm.line_items,
      amount: total,
      notes: editForm.notes?.trim() || null,
    }).eq('id', showView.id).select().single()
    if (data) {
      setShowView(data)
      setQuotes(prev => prev.map(q => q.id === data.id ? data : q))
    }
    setEditingQuote(false)
  }

  async function sendQuote(quote) {
    if (!supabase || !user?.id || !quote?.id) return

    setSending(true)
    setSendError('')
    try {
      const quoteForEmail = { ...quote, line_items: getQuoteItems(quote) }
      const { data, error } = await supabase.functions.invoke('send-quote', {
        body: {
          quote: quoteForEmail,
          profile,
          bankDetails,
        },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))

      await supabase.from('quotes').update({ status: 'sent' }).eq('id', quote.id)
      await loadQuotes()
      setShowView(prev => (prev && prev.id === quote.id ? { ...prev, status: 'sent' } : prev))
      setSendError('')
      showToast('Quote sent successfully')
    } catch (err) {
      const msg = err?.message || 'Failed to send quote'
      setSendError(msg)
      showToast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  async function convertToInvoice(quote) {
    const { data, error } = await supabase.from('invoices').insert({
      creative_id: user.id,
      client_name: quote.client_name,
      client_email: quote.client_email,
      client_phone: quote.client_phone ?? null,
      client_address: quote.client_address ?? null,
      line_items: getQuoteItems(quote),
      amount: quote.amount,
      notes: quote.notes ?? null,
      status: 'draft',
      download_token: crypto.randomUUID(),
    }).select().single()
    if (!error && data) {
      showToast('Quote converted to invoice')
      setShowView(null)
      navigate('/dashboard/finance/invoicing')
    } else if (error) {
      showToast('Failed to convert quote: ' + error.message, 'error')
    }
  }

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { ...TYPO.body, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tableWrap: { ...GLASS_CARD, borderRadius: 'var(--radius-xl)', overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 100px 120px 80px', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: isMobile ? '560px' : 'auto' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 100px 120px 80px', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)', minWidth: isMobile ? '560px' : 'auto' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
  }

  const quoteBrandMerged = useMemo(() => mergeQuoteBrand(brandKit), [brandKit])
  const brandLogo = quoteBrandMerged.logo
  const quoteBrandColor = quoteBrandMerged.primary
  const quoteBrandAccent = quoteBrandMerged.accent
  const quoteBrandFontStack = quoteBrandMerged.fontStack
  const quoteHeaderTextColor = quoteBrandMerged.secondary
  const quoteHeaderBg = { background: quoteBrandColor }
  const quoteDocSurface = { padding: isMobile ? '16px' : '40px 48px', overflowY: 'auto', flex: 1, background: '#fff', color: '#111', fontFamily: quoteBrandFontStack }
  const customQuoteTemplateBanner = quoteBrandMerged.hasCustomTemplate ? (
    <div
      role="status"
      style={{
        marginBottom: '16px',
        padding: '10px 14px',
        borderRadius: '8px',
        border: `1px solid ${quoteBrandAccent}55`,
        background: `${quoteBrandAccent}12`,
        fontSize: '12px',
        color: '#374151',
        lineHeight: 1.45,
      }}
    >
      A custom template is active for quotes in Brand Kit. Your colours and font still apply to this layout; the uploaded file is not shown here.
    </div>
  ) : null

  return (
    <>
      <style>{`
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (max-width: 767px) {
          .quotes-page button { min-height: 44px; }
          .quotes-page input, .quotes-page textarea, .quotes-page select { width: 100% !important; font-size: 14px !important; }
          .quotes-page * { min-width: 0; }
        }
      `}</style>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          background: toast.type === 'success' ? '#1DB954' : '#ef4444',
          color: toast.type === 'success' ? '#000' : '#fff',
          padding: '12px 20px', borderRadius: '10px',
          fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-ui)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'slideIn 0.2s ease',
        }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
      <div style={styles.page} className="quotes-page">
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>Quotes</h1>
            <p style={styles.subtitle}>Create and send professional quotes to your clients.</p>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>+ New Quote</Button>
        </div>

        <div style={{ ...GLASS_CARD, borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: editingBank ? '16px' : '0', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '0' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>Payment Details</div>
              {!editingBank && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {bankDetails.bank_account ? `${bankDetails.bank_name ? bankDetails.bank_name + ' · ' : ''}BSB ${bankDetails.bank_bsb} · Acct ${bankDetails.bank_account}${bankDetails.bank_account_name ? ' · ' + bankDetails.bank_account_name : ''}` : 'No bank details set. These details appear on your quotes.'}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => editingBank ? saveBankDetails() : setEditingBank(true)}
              style={{ padding: '7px 14px', background: editingBank ? quoteBrandColor : 'var(--bg-base)', border: `1px solid ${editingBank ? quoteBrandColor : 'var(--border-default)'}`, borderRadius: '8px', color: editingBank ? quoteHeaderTextColor : 'var(--text-secondary)', fontSize: '13px', fontWeight: editingBank ? 600 : 400, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
            >
              {bankSaving ? 'Saving…' : editingBank ? 'Save Details' : ' Edit'}
            </button>
          </div>

          {editingBank && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bank Name</label>
                <input value={bankDetails.bank_name} onChange={e => setBankDetails(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. Commonwealth Bank" style={{ width: '100%', padding: '8px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Account Name</label>
                <input value={bankDetails.bank_account_name} onChange={e => setBankDetails(p => ({ ...p, bank_account_name: e.target.value }))} placeholder="e.g. John Smith" style={{ width: '100%', padding: '8px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>BSB</label>
                <input value={bankDetails.bank_bsb} onChange={e => setBankDetails(p => ({ ...p, bank_bsb: e.target.value }))} placeholder="e.g. 062-000" style={{ width: '100%', padding: '8px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Account Number</label>
                <input value={bankDetails.bank_account} onChange={e => setBankDetails(p => ({ ...p, bank_account: e.target.value }))} placeholder="e.g. 12345678" style={{ width: '100%', padding: '8px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHeader}>
            <span>Client</span>
            <span>Valid Until</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {loading ? (
            <div style={styles.emptyState}>Loading…</div>
          ) : quotes.length === 0 ? (
            <div style={styles.emptyState}>No quotes yet. Create your first one.</div>
          ) : quotes.map((q, i) => (
            <div
              key={q.id}
              style={{ ...styles.tableRow, borderBottom: i === quotes.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
              onClick={() => setShowView(q)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{q.client_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{q.client_email}</div>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                {q.due_date ? new Date(q.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{formatMoney(q.amount)}</span>
              <Badge variant={statusVariant(q.status)} size="sm">{q.status}</Badge>
              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setShowView(q) }}>View</Button>
            </div>
          ))}
        </div>

        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' }}>
            <div style={{ ...GLASS_MODAL_PANEL, borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100vw' : '680px', maxHeight: isMobile ? '100vh' : '90vh', height: isMobile ? '100vh' : 'auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              <div style={{ padding: isMobile ? '12px 14px' : '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>New Quote</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => createQuote('draft')}
                    disabled={saving || !newQuote.client_name}
                    style={{ padding: '7px 14px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Saving…' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => createQuote('sent')}
                    disabled={saving || !newQuote.client_name || !newQuote.client_email}
                    style={{ padding: '7px 14px', background: quoteBrandColor, border: 'none', borderRadius: '8px', color: quoteHeaderTextColor, fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-ui)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Sending…' : 'Send Quote'}
                  </button>
                  <button type="button" onClick={() => { setShowCreate(false); setNewQuote({ client_name: '', client_email: '', client_phone: '', client_address: '', due_date: '', notes: '', line_items: [{ description: '', quantity: 1, rate: 0 }] }) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              {saveError && (
                <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                  {saveError}
                </div>
              )}

              <div style={quoteDocSurface}>
                {customQuoteTemplateBanner}

                <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...quoteHeaderBg, color: quoteHeaderTextColor }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '10px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      {brandLogo && <img src={brandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />}
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px', fontFamily: quoteBrandFontStack }}>{profile?.business_name ?? 'Your Business'}</div>
                        <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', fontFamily: quoteBrandFontStack }}>QUOTE</div>
                      <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: quoteBrandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Bill To</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input value={newQuote.client_name} onChange={e => setNewQuote(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" style={{ padding: '8px 12px', border: `1px solid ${quoteBrandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                    <input value={newQuote.client_email} onChange={e => setNewQuote(p => ({ ...p, client_email: e.target.value }))} placeholder="Client email" style={{ padding: '8px 12px', border: `1px solid ${quoteBrandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                    <input value={newQuote.client_phone} onChange={e => setNewQuote(p => ({ ...p, client_phone: e.target.value }))} placeholder="Phone (optional)" style={{ padding: '8px 12px', border: `1px solid ${quoteBrandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                    <input value={newQuote.client_address} onChange={e => setNewQuote(p => ({ ...p, client_address: e.target.value }))} placeholder="Address (optional)" style={{ padding: '8px 12px', border: `1px solid ${quoteBrandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                    <input type="date" value={newQuote.due_date} onChange={e => setNewQuote(p => ({ ...p, due_date: e.target.value }))} style={{ padding: '8px 12px', border: `1px solid ${quoteBrandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '50%', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: isMobile ? '560px' : '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${quoteBrandColor}`, background: `${quoteBrandColor}22`, boxShadow: `inset 0 -2px 0 0 ${quoteBrandAccent}66` }}>
                      <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '80px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Amount</th>
                      <th style={{ width: '32px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {newQuote.line_items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}>
                          <input value={item.description} onChange={e => setNewQuote(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} placeholder="Description" style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', color: '#111' }} />
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <input type="number" value={item.quantity} onChange={e => setNewQuote(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'center', color: '#111' }} />
                        </td>
                        <td style={{ padding: '8px 4px' }}>
                          <input type="number" value={item.rate} onChange={e => setNewQuote(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, rate: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'right', color: '#111' }} />
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#111' }}>
                          AUD {(Number(item.quantity) * Number(item.rate)).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>
                          <button type="button" onClick={() => setNewQuote(p => ({ ...p, line_items: p.line_items.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} style={{ paddingTop: '12px' }}>
                        <button type="button" onClick={() => setNewQuote(p => ({ ...p, line_items: [...p.line_items, { description: '', quantity: 1, rate: 0 }] }))} style={{ padding: '6px 14px', background: 'none', border: '1px dashed #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#666', cursor: 'pointer' }}>+ Add Line Item</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
                  <div style={{ width: '240px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `2px solid ${quoteBrandColor}`, borderBottom: `1px solid ${quoteBrandAccent}55` }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#111' }}>Total</span>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: quoteBrandColor }}>{formatMoney(newQuote.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0))}</span>
                    </div>
                  </div>
                </div>

                {(bankDetails.bank_account || bankDetails.bank_bsb) && (
                  <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', borderLeft: `4px solid ${quoteBrandAccent}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: quoteBrandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Payment Details</div>
                    {bankDetails.bank_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Bank: {bankDetails.bank_name}</div>}
                    {bankDetails.bank_account_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Account Name: {bankDetails.bank_account_name}</div>}
                    {bankDetails.bank_bsb && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>BSB: {bankDetails.bank_bsb}</div>}
                    {bankDetails.bank_account && <div style={{ fontSize: '13px', color: '#374151' }}>Account: {bankDetails.bank_account}</div>}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: quoteBrandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
                  <textarea value={newQuote.notes ?? ''} onChange={e => setNewQuote(p => ({ ...p, notes: e.target.value }))} placeholder="Add notes or terms" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', minHeight: '80px', resize: 'vertical', color: '#111', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: `1px solid ${quoteBrandAccent}33`, fontSize: '12px', color: '#999', textAlign: 'center' }}>
                  Thank you for your business
                </div>
              </div>
            </div>
          </div>
        )}

        {showView && (
          <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' }}>
            <div style={{ ...GLASS_MODAL_PANEL, borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100vw' : '680px', maxHeight: isMobile ? '100vh' : '90vh', height: isMobile ? '100vh' : 'auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              <div style={{ padding: isMobile ? '12px 14px' : '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>Quote</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingQuote) {
                        void saveQuoteEdits()
                      } else {
                        setQuoteViewModerationError('')
                        setEditingQuote(true)
                        setEditForm({
                          client_name: showView.client_name,
                          client_email: showView.client_email,
                          client_phone: showView.client_phone ?? '',
                          client_address: showView.client_address ?? '',
                          notes: showView.notes ?? '',
                          line_items: getQuoteItems(showView),
                        })
                      }
                    }}
                    style={{ padding: '7px 14px', background: editingQuote ? `color-mix(in srgb, ${quoteBrandColor} 15%, var(--bg-elevated))` : 'var(--bg-elevated)', border: `1px solid ${editingQuote ? `color-mix(in srgb, ${quoteBrandColor} 40%, transparent)` : 'var(--border-default)'}`, borderRadius: '8px', color: editingQuote ? quoteBrandColor : 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
                  >
                    {editingQuote ? '✓ Save' : ' Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('quote-print-area')
                      if (!el) return
                      const printContents = el.innerHTML
                      const win = window.open('', '_blank')
                      const safeFont = quoteBrandFontStack.replace(/</g, '')
                      win.document.write(`
                    <html>
                      <head>
                        <title>Quote - ${showView.client_name}</title>
                        <style>
                          body { font-family: ${safeFont}; margin: 0; padding: 40px; }
                          @media print { body { padding: 0; } }
                        </style>
                      </head>
                      <body>${printContents}</body>
                    </html>
                  `)
                      win.document.close()
                      win.focus()
                      win.print()
                    }}
                    style={{ padding: '7px 14px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
                  >
                    Print / Save PDF
                  </button>
                {showView.status !== 'accepted' && showView.status !== 'declined' && (
                  <>
                    <button type="button" onClick={() => markAccepted(showView.id)} style={{ padding: '7px 14px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: '8px', color: '#1DB954', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
                      ✓ Mark as Accepted
                    </button>
                    <button
                      type="button"
                      style={{ padding: '7px 14px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: '8px', color: '#1DB954', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
                      onClick={() => convertToInvoice(showView)}
                    >
                      → Convert to Invoice
                    </button>
                  </>
                )}
                  {(showView.status === 'draft' || showView.status === 'sent') && (
                    <button type="button" disabled={sending} onClick={() => sendQuote(showView)} style={{ padding: '7px 14px', background: quoteBrandColor, border: 'none', borderRadius: '8px', color: quoteHeaderTextColor, fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-ui)', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.65 : 1 }}>
                      {sending ? 'Sending…' : showView.status === 'sent' ? 'Resend Quote' : 'Send Quote'}
                    </button>
                  )}
                  <button type="button" onClick={() => { deleteQuote(showView.id); setShowView(null); setEditingQuote(false) }} style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
                    Delete
                  </button>
                  <button type="button" onClick={() => { setShowView(null); setEditingQuote(false); setQuoteViewModerationError('') }} style={{ padding: '7px 14px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              {sendError && (
                <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                  {sendError}
                </div>
              )}
              {quoteViewModerationError && (
                <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                  {quoteViewModerationError}
                </div>
              )}

              <div id="quote-print-area" style={quoteDocSurface}>
                {customQuoteTemplateBanner}

                <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...quoteHeaderBg, color: quoteHeaderTextColor }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '10px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      {brandLogo && <img src={brandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />}
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px', fontFamily: quoteBrandFontStack }}>{profile?.business_name ?? 'Your Business'}</div>
                        <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', fontFamily: quoteBrandFontStack }}>QUOTE</div>
                      <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>#{showView.id.slice(0, 8).toUpperCase()}</div>
                      <div style={{ fontSize: '13px', opacity: 0.85 }}>{new Date(showView.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: quoteBrandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Bill To</div>
                  {editingQuote ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#111' }} placeholder="Client name" />
                      <input value={editForm.client_email} onChange={e => setEditForm(p => ({ ...p, client_email: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#111' }} placeholder="Client email" />
                      <input value={editForm.client_phone} onChange={e => setEditForm(p => ({ ...p, client_phone: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#111' }} placeholder="Phone" />
                      <input value={editForm.client_address} onChange={e => setEditForm(p => ({ ...p, client_address: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#111' }} placeholder="Address" />
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#111' }}>{showView.client_name}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>{showView.client_email}</div>
                      {showView.client_phone && <div style={{ fontSize: '13px', color: '#666' }}>{showView.client_phone}</div>}
                      {showView.client_address && <div style={{ fontSize: '13px', color: '#666' }}>{showView.client_address}</div>}
                    </>
                  )}
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: showView.status === 'accepted' ? '#dcfce7' : showView.status === 'declined' ? '#fee2e2' : '#f3f4f6', color: showView.status === 'accepted' ? '#166534' : showView.status === 'declined' ? '#991b1b' : '#374151' }}>
                    {showView.status}
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: isMobile ? '560px' : '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${quoteBrandColor}`, background: `${quoteBrandColor}22`, boxShadow: `inset 0 -2px 0 0 ${quoteBrandAccent}66` }}>
                      <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</th>
                      <th style={{ textAlign: 'center', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '80px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingQuote ? (
                      <>
                        {editForm.line_items.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 0' }}>
                              <input value={item.description} onChange={e => setEditForm(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} placeholder="Description" />
                            </td>
                            <td style={{ padding: '8px 4px' }}>
                              <input type="number" value={item.quantity} onChange={e => setEditForm(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'center' }} />
                            </td>
                            <td style={{ padding: '8px 4px' }}>
                              <input type="number" value={item.rate} onChange={e => setEditForm(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, rate: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '8px 0', textAlign: 'right' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>AUD {(Number(item.quantity) * Number(item.rate)).toFixed(2)}</span>
                              <button type="button" onClick={() => setEditForm(p => ({ ...p, line_items: p.line_items.filter((_, j) => j !== i) }))} style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={4} style={{ paddingTop: '12px' }}>
                            <button type="button" onClick={() => setEditForm(p => ({ ...p, line_items: [...p.line_items, { description: '', quantity: 1, rate: 0 }] }))} style={{ padding: '6px 14px', background: 'none', border: '1px dashed #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#666', cursor: 'pointer' }}>+ Add Line Item</button>
                          </td>
                        </tr>
                      </>
                    ) : (
                      getQuoteItems(showView).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '14px 0', fontSize: '14px', color: '#111' }}>{item.description}</td>
                          <td style={{ padding: '14px 0', fontSize: '14px', color: '#111', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '14px 0', fontSize: '14px', color: '#111', textAlign: 'right' }}>{formatMoney(item.rate)}</td>
                          <td style={{ padding: '14px 0', fontSize: '14px', color: '#111', textAlign: 'right', fontWeight: 600 }}>{formatMoney(Number(item.quantity) * Number(item.rate))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
                  <div style={{ width: '240px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `2px solid ${quoteBrandColor}`, borderBottom: `1px solid ${quoteBrandAccent}55` }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#111' }}>Total</span>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: quoteBrandColor }}>
                        {formatMoney(editingQuote
                          ? editForm.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
                          : Number(showView.amount))}
                      </span>
                    </div>
                  </div>
                </div>

                {(bankDetails.bank_account || bankDetails.bank_bsb) && (
                  <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', borderLeft: `4px solid ${quoteBrandAccent}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: quoteBrandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Payment Details</div>
                    {bankDetails.bank_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Bank: {bankDetails.bank_name}</div>}
                    {bankDetails.bank_account_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Account Name: {bankDetails.bank_account_name}</div>}
                    {bankDetails.bank_bsb && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>BSB: {bankDetails.bank_bsb}</div>}
                    {bankDetails.bank_account && <div style={{ fontSize: '13px', color: '#374151' }}>Account: {bankDetails.bank_account}</div>}
                  </div>
                )}

                {(editingQuote || showView.notes) && (
                  <div style={{ borderTop: `1px solid ${quoteBrandAccent}33`, paddingTop: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: quoteBrandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
                    {editingQuote ? (
                      <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', minHeight: '80px', resize: 'vertical' }} placeholder="Add notes..." />
                    ) : showView.notes ? (
                      <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>{showView.notes}</div>
                    ) : null}
                  </div>
                )}

                <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: `1px solid ${quoteBrandAccent}33`, fontSize: '12px', color: '#999', textAlign: 'center' }}>
                  Thank you for your business
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
