import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

// Inject print styles
if (typeof document !== 'undefined' && !document.getElementById('invoice-print-style')) {
  const style = document.createElement('style')
  style.id = 'invoice-print-style'
  style.textContent = `@media print { body > * { display: none !important; } #invoice-print-area { display: block !important; position: fixed; inset: 0; padding: 40px; } }`
  document.head.appendChild(style)
}

function statusVariant(status) {
  if (status === 'paid') return 'green'
  if (status === 'overdue') return 'error'
  if (status === 'sent') return 'info'
  if (status === 'viewed') return 'warning'
  return 'default'
}

const EMPTY_LINE = { description: '', quantity: 1, rate: '' }

function getInvoiceItems(invoice) {
  return invoice?.line_items ?? invoice?.items ?? []
}

/** Merge `brand_kit` row with per-document `invoice` settings from `document_brand_settings` (on `brand_kit`). */
function mergeInvoiceBrand(brandKit) {
  const base = brandKit || {}
  const raw = base.document_brand_settings
  const docs = raw && typeof raw === 'object' ? raw : {}
  const inv = docs.invoice && typeof docs.invoice === 'object' ? docs.invoice : {}
  const primary = inv.primary_colour ?? inv.primary_color ?? base.primary_color ?? '#1DB954'
  const accent = '#ffffff'
  const font = inv.font ?? base.font ?? 'Inter'
  const logo = inv.logo_url || base.logo_url || ''
  const secondary = base.secondary_color ?? '#ffffff'
  const hasCustomTemplate = Boolean(inv.custom_template_url)
  const fontStack = font.includes(' ') ? `"${font}", sans-serif` : `${font}, sans-serif`
  return { primary, accent, font, logo, secondary, hasCustomTemplate, fontStack }
}

export default function InvoicingPage() {
  const { user, profile } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const invoicePrintRef = useRef(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [brandKit, setBrandKit] = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [newInvoice, setNewInvoice] = useState({
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

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    due_date: '',
    notes: '',
    lines: [{ ...EMPTY_LINE }],
  })

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
    loadInvoices()
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

  async function loadInvoices() {
    if (!user) return
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setInvoices(data ?? [])
    setLoading(false)
  }

  function updateLine(i, field, value) {
    setForm(prev => {
      const lines = [...prev.lines]
      lines[i] = { ...lines[i], [field]: value }
      return { ...prev, lines }
    })
  }

  function addLine() {
    setForm(prev => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE }] }))
  }

  function removeLine(i) {
    setForm(prev => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }))
  }

  function calcTotal(lines) {
    return lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0)
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(amount) || 0)
  }

  async function generateInvoicePdfData(invoice) {
    if (!invoicePrintRef.current || !invoice?.id) return null

    setPdfGenerating(true)
    try {
      const canvas = await html2canvas(invoicePrintRef.current, {
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
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight)
        yOffset += pageHeight
      }

      const dataUri = pdf.output('datauristring')
      return {
        fileName: `invoice-${String(invoice.id).slice(0, 8)}.pdf`,
        base64: dataUri.split(',')[1] ?? '',
      }
    } finally {
      setPdfGenerating(false)
    }
  }

  async function downloadInvoicePdf(invoice) {
    const pdfData = await generateInvoicePdfData(invoice)
    if (!pdfData?.base64) return

    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${pdfData.base64}`
    link.download = pdfData.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function resetForm() {
    setForm({ client_name: '', client_email: '', due_date: '', notes: '', lines: [{ ...EMPTY_LINE }] })
  }

  async function createInvoice(status = 'draft') {
    if (!supabase || !user?.id) {
      setSaveError('You must be signed in to create an invoice.')
      return
    }

    setSaving(true)
    setSaveError('')
    const total = newInvoice.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
    const invoiceStatus = status === 'sent' ? 'draft' : status
    const { data, error } = await supabase.from('invoices').insert({
      creative_id: user.id,
      client_name: newInvoice.client_name.trim(),
      client_email: newInvoice.client_email.trim() || null,
      client_phone: newInvoice.client_phone.trim() || null,
      client_address: newInvoice.client_address.trim() || null,
      due_date: newInvoice.due_date || null,
      items: newInvoice.line_items,
      amount: total,
      status: invoiceStatus,
    }).select().single()
    if (error) {
      setSaveError(error.message)
    } else {
      if (status === 'sent') {
        const sendMessage = await invokeSendInvoiceEdge(data)
        if (sendMessage) {
          setSaveError(sendMessage)
          setSaving(false)
          await loadInvoices()
          return
        }
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', data.id)
      }
      await loadInvoices()
      setShowCreate(false)
      setSaveError('')
      setNewInvoice({ client_name: '', client_email: '', client_phone: '', client_address: '', due_date: '', notes: '', line_items: [{ description: '', quantity: 1, rate: 0 }] })
    }
    setSaving(false)
  }

  async function markPaid(id) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    await loadInvoices()
    setShowView(null); setEditingInvoice(false)
  }

  async function deleteInvoice(id) {
    await supabase.from('invoices').delete().eq('id', id)
    await loadInvoices()
    setShowView(null); setEditingInvoice(false)
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

  async function saveInvoiceEdits() {
    const total = editForm.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
    const { data } = await supabase.from('invoices').update({
      client_name: editForm.client_name,
      client_email: editForm.client_email || null,
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
    const invoiceForEmail = { ...invoice, line_items: getInvoiceItems(invoice) }
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: {
        invoice: invoiceForEmail,
        profile,
        bankDetails,
      },
    })
    if (error) return error.message
    if (data?.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
    return ''
  }

  async function sendInvoice(invoice) {
    if (!supabase || !user?.id || !invoice?.id) return

    setSending(true)
    setSendError('')
    try {
      const invoiceForEmail = { ...invoice, line_items: getInvoiceItems(invoice) }
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: {
          invoice: invoiceForEmail,
          profile,
          bankDetails,
        },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))

      await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
      await loadInvoices()
      setShowView(prev => (prev && prev.id === invoice.id ? { ...prev, status: 'sent' } : prev))
      setSendError('')
      showToast('Invoice sent successfully')
    } catch (err) {
      const msg = err?.message || 'Failed to send invoice'
      setSendError(msg)
      showToast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    title: { fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tableWrap: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 100px 120px 80px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: isMobile ? '560px' : 'auto' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 100px 120px 80px', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)', minWidth: isMobile ? '560px' : 'auto' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    sectionLabel: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '-4px' },
    lineRow: { display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: '8px', alignItems: 'center' },
    totalRow: { display: 'flex', justifyContent: 'flex-end', padding: '16px 0 0', borderTop: '1px solid var(--border-subtle)' },
    totalAmount: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  }

  const total = calcTotal(form.lines)
  const invoiceBrand = useMemo(() => mergeInvoiceBrand(brandKit), [brandKit])
  const brandColor = invoiceBrand.primary
  const brandAccent = invoiceBrand.accent
  const brandLogo = invoiceBrand.logo
  const brandFontStack = invoiceBrand.fontStack
  const brandHeaderBg = { background: invoiceBrand.primary }
  const headerTextColor = invoiceBrand.secondary
  const invoiceDocSurface = { padding: isMobile ? '16px' : '40px 48px', overflowY: 'auto', flex: 1, background: '#fff', color: '#111', fontFamily: brandFontStack }
  const customTemplateBanner = invoiceBrand.hasCustomTemplate ? (
    <div
      role="status"
      style={{
        marginBottom: '16px',
        padding: '10px 14px',
        borderRadius: '8px',
        border: `1px solid ${brandAccent}55`,
        background: `${brandAccent}12`,
        fontSize: '12px',
        color: '#374151',
        lineHeight: 1.45,
      }}
    >
      A custom template is active for invoices in Brand Kit. Your colours and font still apply to this layout; the uploaded file is not shown here.
    </div>
  ) : null

  return (
    <>
      <style>{`
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (max-width: 767px) {
          .invoicing-page button { min-height: 44px; }
          .invoicing-page input, .invoicing-page textarea, .invoicing-page select { width: 100% !important; font-size: 14px !important; }
          .invoicing-page * { min-width: 0; }
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
    <div style={styles.page} className="invoicing-page">
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Invoicing</h1>
          <p style={styles.subtitle}>Create and send professional invoices to your clients.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ New Invoice</Button>
      </div>

      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: editingBank ? '16px' : '0', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '0' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>Payment Details</div>
            {!editingBank && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {bankDetails.bank_account ? `${bankDetails.bank_name ? bankDetails.bank_name + ' · ' : ''}BSB ${bankDetails.bank_bsb} · Acct ${bankDetails.bank_account}${bankDetails.bank_account_name ? ' · ' + bankDetails.bank_account_name : ''}` : 'No bank details set. These details appear on your invoices.'}
              </div>
            )}
          </div>
          <button
            onClick={() => editingBank ? saveBankDetails() : setEditingBank(true)}
            style={{ padding: '7px 14px', background: editingBank ? '#1DB954' : 'var(--bg-base)', border: `1px solid ${editingBank ? '#1DB954' : 'var(--border-default)'}`, borderRadius: '8px', color: editingBank ? '#000' : 'var(--text-secondary)', fontSize: '13px', fontWeight: editingBank ? 600 : 400, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
          >
            {bankSaving ? 'Saving…' : editingBank ? 'Save Details' : '✎ Edit'}
          </button>
        </div>

        {editingBank && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bank Name</label>
              <input value={bankDetails.bank_name} onChange={e => setBankDetails(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. Commonwealth Bank" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Account Name</label>
              <input value={bankDetails.bank_account_name} onChange={e => setBankDetails(p => ({ ...p, bank_account_name: e.target.value }))} placeholder="e.g. John Smith" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>BSB</label>
              <input value={bankDetails.bank_bsb} onChange={e => setBankDetails(p => ({ ...p, bank_bsb: e.target.value }))} placeholder="e.g. 062-000" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Account Number</label>
              <input value={bankDetails.bank_account} onChange={e => setBankDetails(p => ({ ...p, bank_account: e.target.value }))} placeholder="e.g. 12345678" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <span>Client</span>
          <span>Due Date</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div style={styles.emptyState}>Loading…</div>
        ) : invoices.length === 0 ? (
          <div style={styles.emptyState}>No invoices yet. Create your first one.</div>
        ) : invoices.map((inv, i) => (
          <div
            key={inv.id}
            style={{ ...styles.tableRow, borderBottom: i === invoices.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
            onClick={() => setShowView(inv)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{inv.client_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{inv.client_email}</div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
              {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>${inv.amount?.toFixed(2)}</span>
            <Badge variant={statusVariant(inv.status)} size="sm">{inv.status}</Badge>
            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setShowView(inv) }}>View</Button>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' }}>
          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100vw' : '680px', maxHeight: isMobile ? '100vh' : '90vh', height: isMobile ? '100vh' : 'auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: isMobile ? '12px 14px' : '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>New Invoice</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={() => createInvoice('draft')}
                  disabled={saving || !newInvoice.client_name}
                  style={{ padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => createInvoice('sent')}
                  disabled={saving || !newInvoice.client_name || !newInvoice.client_email}
                  style={{ padding: '7px 14px', background: brandColor, border: 'none', borderRadius: '8px', color: headerTextColor, fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-ui)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Sending…' : 'Send Invoice'}
                </button>
                <button onClick={() => { setShowCreate(false); setNewInvoice({ client_name: '', client_email: '', client_phone: '', client_address: '', due_date: '', notes: '', line_items: [{ description: '', quantity: 1, rate: 0 }] }) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            {saveError && (
              <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                {saveError}
              </div>
            )}

            {/* Invoice document */}
            <div style={invoiceDocSurface}>
              {customTemplateBanner}

              {/* Header */}
              <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...brandHeaderBg, color: headerTextColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '10px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {brandLogo && <img src={brandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px', fontFamily: brandFontStack }}>{profile?.business_name ?? 'Your Business'}</div>
                      <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', fontFamily: brandFontStack }}>INVOICE</div>
                    <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${brandAccent}` }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Bill To</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={newInvoice.client_name} onChange={e => setNewInvoice(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input value={newInvoice.client_email} onChange={e => setNewInvoice(p => ({ ...p, client_email: e.target.value }))} placeholder="Client email" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input value={newInvoice.client_phone} onChange={e => setNewInvoice(p => ({ ...p, client_phone: e.target.value }))} placeholder="Phone (optional)" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input value={newInvoice.client_address} onChange={e => setNewInvoice(p => ({ ...p, client_address: e.target.value }))} placeholder="Address (optional)" style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '100%', boxSizing: 'border-box' }} />
                  <input type="date" value={newInvoice.due_date} onChange={e => setNewInvoice(p => ({ ...p, due_date: e.target.value }))} style={{ padding: '8px 12px', border: `1px solid ${brandAccent}40`, borderRadius: '6px', fontSize: '14px', color: '#111', width: '50%', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Line items */}
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: isMobile ? '560px' : '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${brandColor}`, background: `${brandAccent}33` }}>
                    <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</th>
                    <th style={{ textAlign: 'center', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '80px' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Amount</th>
                    <th style={{ width: '32px' }} />
                  </tr>
                </thead>
                <tbody>
                  {newInvoice.line_items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 0' }}>
                        <input value={item.description} onChange={e => setNewInvoice(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) }))} placeholder="Description" style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', color: '#111' }} />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input type="number" value={item.quantity} onChange={e => setNewInvoice(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'center', color: '#111' }} />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input type="number" value={item.rate} onChange={e => setNewInvoice(p => ({ ...p, line_items: p.line_items.map((x, j) => j === i ? { ...x, rate: e.target.value } : x) }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'right', color: '#111' }} />
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#111' }}>
                        AUD {(Number(item.quantity) * Number(item.rate)).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>
                        <button onClick={() => setNewInvoice(p => ({ ...p, line_items: p.line_items.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} style={{ paddingTop: '12px' }}>
                      <button onClick={() => setNewInvoice(p => ({ ...p, line_items: [...p.line_items, { description: '', quantity: 1, rate: 0 }] }))} style={{ padding: '6px 14px', background: 'none', border: '1px dashed #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#666', cursor: 'pointer' }}>+ Add Line Item</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px', paddingTop: '16px', borderTop: `1px solid ${brandAccent}` }}>
                <div style={{ width: '240px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `2px solid ${brandAccent}` }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#111' }}>Total</span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: brandColor }}>{formatMoney(newInvoice.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0))}</span>
                  </div>
                </div>
              </div>

              {/* Payment details */}
              {(bankDetails.bank_account || bankDetails.bank_bsb) && (
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', borderLeft: `4px solid ${brandAccent}`, borderTop: `1px solid ${brandAccent}` }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Payment Details</div>
                  {bankDetails.bank_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Bank: {bankDetails.bank_name}</div>}
                  {bankDetails.bank_account_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Account Name: {bankDetails.bank_account_name}</div>}
                  {bankDetails.bank_bsb && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>BSB: {bankDetails.bank_bsb}</div>}
                  {bankDetails.bank_account && <div style={{ fontSize: '13px', color: '#374151' }}>Account: {bankDetails.bank_account}</div>}
                </div>
              )}

              {/* Notes */}
              <div style={{ paddingTop: '20px', borderTop: `1px solid ${brandAccent}` }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
                <textarea value={newInvoice.notes ?? ''} onChange={e => setNewInvoice(p => ({ ...p, notes: e.target.value }))} placeholder="Add notes, payment instructions..." style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', minHeight: '80px', resize: 'vertical', color: '#111', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: `1px solid ${brandAccent}`, fontSize: '12px', color: '#999', textAlign: 'center' }}>
                Thank you for your business
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showView && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' }}>
          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100vw' : '680px', maxHeight: isMobile ? '100vh' : '90vh', height: isMobile ? '100vh' : 'auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Modal header */}
            <div style={{ padding: isMobile ? '12px 14px' : '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>Invoice</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    if (editingInvoice) {
                      saveInvoiceEdits()
                    } else {
                      setEditingInvoice(true)
                      setEditForm({
                        client_name: showView.client_name,
                        client_email: showView.client_email,
                        notes: showView.notes ?? '',
                        line_items: getInvoiceItems(showView),
                      })
                    }
                  }}
                  style={{ padding: '7px 14px', background: editingInvoice ? 'rgba(29,185,84,0.1)' : 'var(--bg-elevated)', border: `1px solid ${editingInvoice ? 'rgba(29,185,84,0.3)' : 'var(--border-default)'}`, borderRadius: '8px', color: editingInvoice ? '#1DB954' : 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
                >
                  {editingInvoice ? '✓ Save' : '✎ Edit'}
                </button>
                <button onClick={() => {
                  const printContents = document.getElementById('invoice-print-area').innerHTML
                  const win = window.open('', '_blank')
                  const safeFont = brandFontStack.replace(/</g, '')
                  win.document.write(`
                    <html>
                      <head>
                        <title>Invoice - ${showView.client_name}</title>
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
                }} style={{ padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
                  Print / Save PDF
                </button>
                {showView.status !== 'paid' && (
                  <button onClick={() => { markPaid(showView.id); setShowView(prev => ({ ...prev, status: 'paid' })) }} style={{ padding: '7px 14px', background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: '8px', color: '#1DB954', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
                    ✓ Mark as Paid
                  </button>
                )}
                {showView.status !== 'paid' && (
                  <button type="button" disabled={sending} onClick={() => sendInvoice(showView)} style={{ padding: '7px 14px', background: brandColor, border: 'none', borderRadius: '8px', color: headerTextColor, fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-ui)', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.65 : 1 }}>
                    {sending ? 'Sending…' : showView.status === 'sent' ? 'Resend Invoice' : 'Send Invoice'}
                  </button>
                )}
                <button onClick={() => { deleteInvoice(showView.id); setShowView(null); setEditingInvoice(false) }} style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
                  Delete
                </button>
                <button onClick={() => { setShowView(null); setEditingInvoice(false); }} style={{ padding: '7px 14px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            {sendError && (
              <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                {sendError}
              </div>
            )}

            {/* Invoice document */}
            <div ref={invoicePrintRef} id="invoice-print-area" style={invoiceDocSurface}>
              {customTemplateBanner}

              {/* Header */}
              <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...brandHeaderBg, color: headerTextColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '10px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {brandLogo && <img src={brandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px', fontFamily: brandFontStack }}>{profile?.business_name ?? 'Your Business'}</div>
                      <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', fontFamily: brandFontStack }}>INVOICE</div>
                    <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>#{showView.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '13px', opacity: 0.85 }}>{new Date(showView.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              {/* Bill to */}
              <div style={{ marginBottom: '32px', paddingBottom: '16px', borderBottom: `1px solid ${brandAccent}` }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Bill To</div>
                {editingInvoice ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#111' }} placeholder="Client name" />
                    <input value={editForm.client_email} onChange={e => setEditForm(p => ({ ...p, client_email: e.target.value }))} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#111' }} placeholder="Client email" />
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

              {/* Status badge */}
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${brandAccent}` }}>
                <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: showView.status === 'paid' ? '#dcfce7' : showView.status === 'overdue' ? '#fee2e2' : '#f3f4f6', color: showView.status === 'paid' ? '#166534' : showView.status === 'overdue' ? '#991b1b' : '#374151' }}>
                  {showView.status}
                </span>
              </div>

              {/* Line items table */}
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: isMobile ? '560px' : '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${brandColor}`, background: `${brandAccent}33` }}>
                    <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</th>
                    <th style={{ textAlign: 'center', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '80px' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', width: '100px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {editingInvoice ? (
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
                            <button onClick={() => setEditForm(p => ({ ...p, line_items: p.line_items.filter((_, j) => j !== i) }))} style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={4} style={{ paddingTop: '12px' }}>
                          <button onClick={() => setEditForm(p => ({ ...p, line_items: [...p.line_items, { description: '', quantity: 1, rate: 0 }] }))} style={{ padding: '6px 14px', background: 'none', border: '1px dashed #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#666', cursor: 'pointer' }}>+ Add Line Item</button>
                        </td>
                      </tr>
                    </>
                  ) : (
                    getInvoiceItems(showView).map((item, i) => (
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

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px', paddingTop: '16px', borderTop: `1px solid ${brandAccent}` }}>
                <div style={{ width: '240px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `2px solid ${brandAccent}` }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#111' }}>Total</span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: brandColor }}>
                      {formatMoney(editingInvoice
                        ? editForm.line_items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
                        : Number(showView.amount))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment details */}
              {(bankDetails.bank_account || bankDetails.bank_bsb) && (
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', borderLeft: `4px solid ${brandAccent}`, borderTop: `1px solid ${brandAccent}` }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Payment Details</div>
                  {bankDetails.bank_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Bank: {bankDetails.bank_name}</div>}
                  {bankDetails.bank_account_name && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Account Name: {bankDetails.bank_account_name}</div>}
                  {bankDetails.bank_bsb && <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>BSB: {bankDetails.bank_bsb}</div>}
                  {bankDetails.bank_account && <div style={{ fontSize: '13px', color: '#374151' }}>Account: {bankDetails.bank_account}</div>}
                </div>
              )}

              {/* Notes */}
              {(editingInvoice || showView.notes) && (
                <div style={{ borderTop: `1px solid ${brandAccent}`, paddingTop: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: brandAccent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Notes</div>
                  {editingInvoice ? (
                    <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', minHeight: '80px', resize: 'vertical' }} placeholder="Add notes..." />
                  ) : showView.notes ? (
                    <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>{showView.notes}</div>
                  ) : null}
                </div>
              )}

              <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: `1px solid ${brandAccent}`, fontSize: '12px', color: '#999', textAlign: 'center' }}>
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
