import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

function statusVariant(status) {
  if (status === 'paid') return 'green'
  if (status === 'overdue') return 'error'
  if (status === 'sent') return 'info'
  if (status === 'viewed') return 'warning'
  return 'default'
}

const EMPTY_LINE = { description: '', quantity: 1, rate: '' }

export default function InvoicingPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    due_date: '',
    notes: '',
    lines: [{ ...EMPTY_LINE }],
  })

  useEffect(() => { loadInvoices() }, [user])

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

  function resetForm() {
    setForm({ client_name: '', client_email: '', due_date: '', notes: '', lines: [{ ...EMPTY_LINE }] })
  }

  async function createInvoice(status = 'draft') {
    setSaving(true)
    const total = calcTotal(form.lines)
    const { error } = await supabase.from('invoices').insert({
      creative_id: user.id,
      client_name: form.client_name,
      client_email: form.client_email,
      due_date: form.due_date || null,
      notes: form.notes,
      line_items: form.lines,
      amount: total,
      status,
    })
    if (!error) {
      await loadInvoices()
      setShowCreate(false)
      resetForm()
    }
    setSaving(false)
  }

  async function markPaid(id) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    await loadInvoices()
    setShowView(null)
  }

  async function deleteInvoice(id) {
    await supabase.from('invoices').delete().eq('id', id)
    await loadInvoices()
    setShowView(null)
  }

  async function sendInvoice(invoice) {
    setSending(true)
    await supabase.functions.invoke('send-invoice', {
      body: { invoiceId: invoice.id }
    })
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    await loadInvoices()
    setSending(false)
    setShowView(null)
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tableWrap: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 100px 120px 80px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 100px 120px 80px', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)' },
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

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Invoicing</h1>
          <p style={styles.subtitle}>Create and send professional invoices to your clients.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ New Invoice</Button>
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
              {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>${inv.amount?.toFixed(2)}</span>
            <Badge variant={statusVariant(inv.status)} size="sm">{inv.status}</Badge>
            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setShowView(inv) }}>View</Button>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Invoice" size="lg">
        <div style={styles.formSection}>
          <div style={styles.sectionLabel}>Client details</div>
          <div style={styles.formRow}>
            <Input label="Client name" placeholder="Jane Smith" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} />
            <Input label="Client email" type="email" placeholder="jane@example.com" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} />
          </div>
          <div style={styles.formRow}>
            <Input label="Due date" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
          </div>

          <div style={styles.sectionLabel}>Line items</div>
          {form.lines.map((line, i) => (
            <div key={i} style={styles.lineRow}>
              <Input placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
              <Input placeholder="Qty" type="number" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} />
              <Input placeholder="Rate $" type="number" value={line.rate} onChange={e => updateLine(i, 'rate', e.target.value)} />
              <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '8px 0' }}>×</button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addLine}>+ Add line</Button>

          <div style={styles.totalRow}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: '4px' }}>Total</div>
              <div style={styles.totalAmount}>${total.toFixed(2)}</div>
            </div>
          </div>

          <Input label="Notes (optional)" placeholder="Payment instructions, thank you note…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />

          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button variant="secondary" disabled={saving} onClick={() => createInvoice('draft')}>Save as Draft</Button>
            <Button variant="primary" disabled={saving || !form.client_name || !form.client_email} onClick={() => createInvoice('draft')}>Create Invoice</Button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      {showView && (
        <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="Invoice Details" size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={styles.viewGrid}>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Client</div>
                <div style={styles.viewValue}>{showView.client_name}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Email</div>
                <div style={styles.viewValue}>{showView.client_email}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Amount</div>
                <div style={{ ...styles.viewValue, fontFamily: 'var(--font-display)', fontSize: '24px' }}>${showView.amount?.toFixed(2)}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Status</div>
                <Badge variant={statusVariant(showView.status)}>{showView.status}</Badge>
              </div>
            </div>

            {showView.line_items?.length > 0 && (
              <div>
                <div style={{ ...styles.viewLabel, marginBottom: '12px' }}>Line items</div>
                {showView.line_items.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l.description} × {l.quantity}</span>
                    <span style={{ color: 'var(--text-primary)' }}>${(l.quantity * l.rate).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.modalActions}>
              <Button variant="danger" size="sm" onClick={() => deleteInvoice(showView.id)}>Delete</Button>
              {showView.status !== 'paid' && (
                <Button variant="secondary" size="sm" onClick={() => markPaid(showView.id)}>Mark as Paid</Button>
              )}
              {showView.status === 'draft' && (
                <Button variant="primary" size="sm" disabled={sending} onClick={() => sendInvoice(showView)}>
                  {sending ? 'Sending…' : 'Send to Client'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
