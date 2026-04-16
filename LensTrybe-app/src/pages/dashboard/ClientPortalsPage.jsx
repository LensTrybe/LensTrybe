import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'

export default function ClientPortalsPage() {
  const { user } = useAuth()
  const [portals, setPortals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
  })

  useEffect(() => { loadPortals() }, [user])

  async function loadPortals() {
    if (!user) return
    const { data } = await supabase
      .from('client_portals')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setPortals(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ client_name: '', client_email: '' })
  }

  async function createPortal() {
    setSaving(true)
    const portal_token = crypto.randomUUID()
    await supabase.from('client_portals').insert({
      creative_id: user.id,
      client_name: form.client_name,
      client_email: form.client_email,
      portal_token,
    })
    await loadPortals()
    setShowCreate(false)
    resetForm()
    setSaving(false)
  }

  async function deletePortal(id) {
    await supabase.from('client_portals').delete().eq('id', id)
    await loadPortals()
  }

  function getPortalUrl(portal_token) {
    return `${window.location.origin}/portal/${portal_token}`
  }

  function copyLink(portal_token) {
    navigator.clipboard.writeText(getPortalUrl(portal_token))
    setCopied(portal_token)
    setTimeout(() => setCopied(null), 2000)
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    infoBox: { padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
    portalCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
    clientName: { fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    clientEmail: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '2px' },
    copyRow: { display: 'flex', gap: '8px', alignItems: 'center' },
    copyInput: { flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    cardActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    createdAt: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Client Portals</h1>
          <p style={styles.subtitle}>Share a private project space with each client — no login required.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ New Portal</Button>
      </div>

      <div style={styles.infoBox}>
        Each portal gives your client a private link to view messages, invoices, contracts, bookings and delivered files for their project. No account needed — just share the link.
      </div>

      {loading ? (
        <div style={styles.emptyState}>Loading portals…</div>
      ) : portals.length === 0 ? (
        <div style={styles.emptyState}>No portals yet. Create one for your next project.</div>
      ) : (
        <div style={styles.grid}>
          {portals.map(portal => (
            <div key={portal.id} style={styles.portalCard}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.clientName}>{portal.client_name}</div>
                  <div style={styles.clientEmail}>{portal.client_email}</div>
                </div>
              </div>

              <div style={styles.copyRow}>
                <input
                  readOnly
                  style={styles.copyInput}
                  value={getPortalUrl(portal.portal_token)}
                />
                <Button variant="secondary" size="sm" onClick={() => copyLink(portal.portal_token)}>
                  {copied === portal.portal_token ? '✓' : 'Copy'}
                </Button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={styles.createdAt}>
                  Created {new Date(portal.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div style={styles.cardActions}>
                  <Button variant="ghost" size="sm" onClick={() => window.open(getPortalUrl(portal.portal_token), '_blank')}>
                    Open
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => deletePortal(portal.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Client Portal" size="md">
        <div style={styles.formSection}>
          <div style={styles.formRow}>
            <Input
              label="Client name"
              placeholder="Jane Smith"
              value={form.client_name}
              onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
            />
            <Input
              label="Client email"
              type="email"
              placeholder="jane@example.com"
              value={form.client_email}
              onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))}
            />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
            A unique link will be generated for this portal. Share it with your client — they can access it without creating an account.
          </div>
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button
              variant="primary"
              disabled={saving || !form.client_name || !form.client_email}
              onClick={createPortal}
            >
              {saving ? 'Creating…' : 'Create Portal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
