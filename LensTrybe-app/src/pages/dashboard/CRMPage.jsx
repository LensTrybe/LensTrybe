import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

const STAGES = ['Lead', 'In Discussion', 'Booked', 'Completed', 'Archived']

function stageVariant(stage) {
  if (stage === 'Booked') return 'green'
  if (stage === 'Completed') return 'info'
  if (stage === 'Archived') return 'default'
  if (stage === 'In Discussion') return 'warning'
  return 'default'
}

export default function CRMPage() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const limit = tier === 'elite' ? Infinity : 500

  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '',
    stage: 'Lead', notes: '',
  })

  useEffect(() => { loadContacts() }, [user])

  async function loadContacts() {
    if (!user) return
    const { data } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setContacts(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ name: '', email: '', phone: '', company: '', stage: 'Lead', notes: '' })
  }

  async function createContact() {
    setSaving(true)
    await supabase.from('crm_contacts').insert({
      creative_id: user.id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      stage: form.stage,
      notes: form.notes,
    })
    await loadContacts()
    setShowCreate(false)
    resetForm()
    setSaving(false)
  }

  async function updateStage(id, stage) {
    await supabase.from('crm_contacts').update({ stage }).eq('id', id)
    await loadContacts()
    if (showView?.id === id) setShowView(prev => ({ ...prev, stage }))
  }

  async function updateNotes(id, notes) {
    await supabase.from('crm_contacts').update({ notes }).eq('id', id)
  }

  async function deleteContact(id) {
    await supabase.from('crm_contacts').delete().eq('id', id)
    await loadContacts()
    setShowView(null)
  }

  const filtered = contacts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  )

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    toolbar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    viewToggle: { display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
    viewBtn: (active) => ({ padding: '8px 16px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)' }),
    tableWrap: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 180px 140px 120px 80px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 180px 140px 120px 80px', padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    pipelineWrap: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', alignItems: 'start' },
    pipelineCol: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' },
    pipelineHeader: { padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    pipelineLabel: { fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    pipelineCount: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    pipelineBody: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '80px' },
    pipelineCard: { background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '12px', cursor: 'pointer', transition: 'border-color var(--transition-fast)' },
    pipelineName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: '2px' },
    pipelineCompany: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    stageSelect: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', width: '100%' },
    textarea: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', width: '100%', minHeight: '100px', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>CRM</h1>
          <p style={styles.subtitle}>Manage your client relationships and pipeline. {contacts.length} / {limit === Infinity ? '∞' : limit} records.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ Add Client</Button>
      </div>

      <div style={styles.toolbar}>
        <div style={{ flex: 1, maxWidth: '320px' }}>
          <Input placeholder="Search by name, email or company…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={styles.viewToggle}>
          <button style={styles.viewBtn(view === 'list')} onClick={() => setView('list')}>List</button>
          <button style={styles.viewBtn(view === 'pipeline')} onClick={() => setView('pipeline')}>Pipeline</button>
        </div>
      </div>

      {view === 'list' ? (
        <div style={styles.tableWrap}>
          <div style={styles.tableHeader}>
            <span>Name</span>
            <span>Email</span>
            <span>Company</span>
            <span>Stage</span>
            <span>Actions</span>
          </div>
          {loading ? (
            <div style={styles.emptyState}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={styles.emptyState}>{search ? 'No results found.' : 'No clients yet. Add your first one.'}</div>
          ) : filtered.map((c, i) => (
            <div
              key={c.id}
              style={{ ...styles.tableRow, borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
              onClick={() => setShowView(c)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{c.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{c.email}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{c.company || '—'}</div>
              <Badge variant={stageVariant(c.stage)} size="sm">{c.stage}</Badge>
              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setShowView(c) }}>View</Button>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.pipelineWrap}>
          {STAGES.map(stage => {
            const stageContacts = filtered.filter(c => c.stage === stage)
            return (
              <div key={stage} style={styles.pipelineCol}>
                <div style={styles.pipelineHeader}>
                  <span style={styles.pipelineLabel}>{stage}</span>
                  <span style={styles.pipelineCount}>{stageContacts.length}</span>
                </div>
                <div style={styles.pipelineBody}>
                  {stageContacts.map(c => (
                    <div
                      key={c.id}
                      style={styles.pipelineCard}
                      onClick={() => setShowView(c)}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    >
                      <div style={styles.pipelineName}>{c.name}</div>
                      <div style={styles.pipelineCompany}>{c.company || c.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="Add Client" size="md">
        <div style={styles.formSection}>
          <div style={styles.formRow}>
            <Input label="Name" placeholder="Jane Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Email" type="email" placeholder="jane@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div style={styles.formRow}>
            <Input label="Phone (optional)" placeholder="0400 000 000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            <Input label="Company (optional)" placeholder="Smith Co." value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' }}>Stage</label>
            <select style={styles.stageSelect} value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' }}>Notes</label>
            <textarea style={styles.textarea} placeholder="Any notes about this client…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" disabled={saving || !form.name} onClick={createContact}>
              {saving ? 'Saving…' : 'Add Client'}
            </Button>
          </div>
        </div>
      </Modal>

      {showView && (
        <Modal isOpen={!!showView} onClose={() => setShowView(null)} title={showView.name} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={styles.viewGrid}>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Email</div>
                <div style={styles.viewValue}>{showView.email || '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Phone</div>
                <div style={styles.viewValue}>{showView.phone || '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Company</div>
                <div style={styles.viewValue}>{showView.company || '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Stage</div>
                <select
                  style={{ ...styles.stageSelect, fontSize: '13px', padding: '6px 10px' }}
                  value={showView.stage}
                  onChange={e => updateStage(showView.id, e.target.value)}
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={styles.viewField}>
              <div style={styles.viewLabel}>Notes</div>
              <textarea
                style={styles.textarea}
                defaultValue={showView.notes || ''}
                onBlur={e => updateNotes(showView.id, e.target.value)}
                placeholder="Add notes about this client…"
              />
            </div>
            <div style={styles.modalActions}>
              <Button variant="danger" size="sm" onClick={() => deleteContact(showView.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
