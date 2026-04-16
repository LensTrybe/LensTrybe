import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

function statusVariant(status) {
  if (status === 'signed') return 'green'
  if (status === 'sent') return 'info'
  if (status === 'expired') return 'error'
  if (status === 'viewed') return 'warning'
  return 'default'
}

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    project_name: '',
    project_date: '',
    content: '',
  })

  useEffect(() => { loadContracts() }, [user])

  async function loadContracts() {
    if (!user) return
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setContracts(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ client_name: '', client_email: '', project_name: '', project_date: '', content: '' })
  }

  async function createContract() {
    setSaving(true)
    const { error } = await supabase.from('contracts').insert({
      creative_id: user.id,
      client_name: form.client_name,
      client_email: form.client_email,
      project_name: form.project_name,
      project_date: form.project_date || null,
      content: form.content,
      status: 'draft',
    })
    if (!error) {
      await loadContracts()
      setShowCreate(false)
      resetForm()
    }
    setSaving(false)
  }

  async function sendContract(contract) {
    setSending(true)
    await supabase.functions.invoke('send-contract', {
      body: { contractId: contract.id }
    })
    await supabase.from('contracts').update({ status: 'sent' }).eq('id', contract.id)
    await loadContracts()
    setSending(false)
    setShowView(null)
  }

  async function deleteContract(id) {
    await supabase.from('contracts').delete().eq('id', id)
    await loadContracts()
    setShowView(null)
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tableWrap: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 120px 80px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 140px 120px 80px', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    disclaimer: { padding: '14px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-lg)', fontSize: '12px', color: 'var(--warning)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 },
    textarea: { width: '100%', minHeight: '200px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    contractContent: { padding: '20px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Contracts</h1>
          <p style={styles.subtitle}>Create and send contracts for your clients to sign digitally.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ New Contract</Button>
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <span>Client</span>
          <span>Project</span>
          <span>Project Date</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div style={styles.emptyState}>Loading…</div>
        ) : contracts.length === 0 ? (
          <div style={styles.emptyState}>No contracts yet. Create your first one.</div>
        ) : contracts.map((c, i) => (
          <div
            key={c.id}
            style={{ ...styles.tableRow, borderBottom: i === contracts.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
            onClick={() => setShowView(c)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{c.client_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{c.client_email}</div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{c.project_name ?? '—'}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
              {c.project_date ? new Date(c.project_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
            <Badge variant={statusVariant(c.status)} size="sm">{c.status}</Badge>
            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setShowView(c) }}>View</Button>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Contract" size="lg">
        <div style={styles.formSection}>
          <div style={styles.disclaimer}>
            LensTrybe provides tools to create and send contracts but does not provide legal advice or templates. You are responsible for the content of your contracts. We recommend consulting a legal professional if unsure.
          </div>
          <div style={styles.formRow}>
            <Input label="Client name" placeholder="Jane Smith" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} />
            <Input label="Client email" type="email" placeholder="jane@example.com" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} />
          </div>
          <div style={styles.formRow}>
            <Input label="Project name" placeholder="Wedding Photography — Smith/Jones" value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} />
            <Input label="Project date" type="date" value={form.project_date} onChange={e => setForm(p => ({ ...p, project_date: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' }}>Contract content</label>
            <textarea
              style={styles.textarea}
              placeholder="Write your contract terms here…"
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            />
          </div>
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" disabled={saving || !form.client_name || !form.client_email} onClick={createContract}>
              {saving ? 'Saving…' : 'Create Contract'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      {showView && (
        <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="Contract Details" size="lg">
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
                <div style={styles.viewLabel}>Project</div>
                <div style={styles.viewValue}>{showView.project_name ?? '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Status</div>
                <Badge variant={statusVariant(showView.status)}>{showView.status}</Badge>
              </div>
            </div>

            {showView.content && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Contract Content</div>
                <div style={styles.contractContent}>{showView.content}</div>
              </div>
            )}

            <div style={styles.modalActions}>
              <Button variant="danger" size="sm" onClick={() => deleteContract(showView.id)}>Delete</Button>
              {(showView.status === 'draft' || showView.status === 'sent') && (
                <Button variant="primary" size="sm" disabled={sending} onClick={() => sendContract(showView)}>
                  {sending ? 'Sending…' : showView.status === 'draft' ? 'Send to Client' : 'Resend'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
