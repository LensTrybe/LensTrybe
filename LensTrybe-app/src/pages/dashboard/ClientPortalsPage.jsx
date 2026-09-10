import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { creativeSenderDisplayName } from '../../lib/creativeDisplayName'
import { useAuth } from '../../context/AuthContext'

// Theme-aware Client Portals (light + dark) built on the --lt-* tokens.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'
const FONT = { fontFamily: 'Inter, sans-serif' }

// Glass + field recipes on the theme tokens.
const glassCard = {
  background: 'var(--lt-glass-bg)',
  border: 'var(--lt-glass-border)',
  boxShadow: 'var(--lt-glass-shadow)',
  backdropFilter: 'var(--lt-glass-blur)',
  WebkitBackdropFilter: 'var(--lt-glass-blur)',
}
const field = {
  background: 'var(--lt-input-bg)',
  border: '1px solid var(--lt-input-border)',
  color: 'var(--lt-text)',
  fontFamily: 'inherit',
  outline: 'none',
}

function Btn({ variant = 'primary', size = 'md', children, style, disabled, ...props }) {
  const pad = size === 'sm' ? '7px 14px' : '10px 18px'
  const fs = size === 'sm' ? 12.5 : 13.5
  const variants = {
    primary: { background: GREEN, color: GREEN_TEXT, border: '1px solid transparent' },
    secondary: { background: 'var(--lt-surface)', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
    ghost: { background: 'transparent', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
    danger: { background: PINK, color: '#fff', border: '1px solid transparent' },
  }
  return (
    <button {...props} disabled={disabled}
      style={{ padding: pad, fontSize: fs, fontWeight: 700, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'transform .12s ease, opacity .12s ease', opacity: disabled ? 0.55 : 1, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, ...FONT }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, borderRadius: 16, padding: 24, boxSizing: 'border-box', background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)', boxShadow: 'var(--lt-modal-shadow)', backdropFilter: 'var(--lt-modal-blur)', WebkitBackdropFilter: 'var(--lt-modal-blur)' }}>
        {title && <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px', color: 'var(--lt-text)' }}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export default function ClientPortalsPage() {
  const { user, profile } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [portals, setPortals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
  })

  useEffect(() => { loadPortals() }, [user])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

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
    if (!user?.id) { showToast('Your session expired — please sign in again to save.', 'error'); return }
    setSaving(true)
    try {
      const token = crypto.randomUUID()
      const { error } = await supabase.from('client_portals').insert({
        creative_id: user.id,
        client_name: form.client_name,
        client_email: form.client_email,
        portal_token: token,
      }).select().single()
      if (error) throw error

      const portalUrl = `https://lenstrybe.com/portal/${token}`

      await supabase.functions.invoke('send-portal-link', {
        body: {
          to: form.client_email,
          client_name: form.client_name,
          creative_name: creativeSenderDisplayName(profile, user),
          portal_url: portalUrl,
        },
      })

      await loadPortals()
      setShowCreate(false)
      resetForm()
      showToast('Portal created and link sent to client')
    } catch (err) {
      showToast('Failed to create portal: ' + err.message, 'error')
    }
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
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden', color: 'var(--lt-text)', ...FONT },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    title: { fontSize: isMobile ? '24px' : '28px', color: 'var(--lt-text)', fontWeight: 800, letterSpacing: '-0.01em', margin: 0 },
    subtitle: { fontSize: '14px', color: 'var(--lt-muted)', marginTop: '4px' },
    infoBox: { padding: '16px', ...glassCard, borderRadius: 16, fontSize: '14px', color: 'var(--lt-muted)', lineHeight: 1.7 },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' },
    portalCard: { ...glassCard, borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
    cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
    clientName: { fontSize: '16px', fontWeight: 600, color: 'var(--lt-text)' },
    clientEmail: { fontSize: '12px', color: 'var(--lt-muted)', marginTop: '2px' },
    copyRow: { display: 'flex', gap: '8px', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' },
    copyInput: { flex: 1, width: '100%', ...field, borderRadius: 8, padding: '8px 12px', fontSize: '14px', color: 'var(--lt-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box' },
    cardActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: '14px', ...glassCard, borderRadius: 16 },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    createdAt: { fontSize: '11px', color: 'var(--lt-faint)' },
    fieldLabel: { display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--lt-text)', marginBottom: '6px' },
    fieldInput: { ...field, width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: '13px', boxSizing: 'border-box' },
  }

  return (
    <div style={styles.page} className="client-portals-page">
      <style>{`
        @media (max-width: 767px) {
          .client-portals-page button { min-height: 44px; }
          .client-portals-page input, .client-portals-page textarea, .client-portals-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? GREEN : PINK, color: toast.type === 'success' ? GREEN_TEXT : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Client Portals</h1>
          <p style={styles.subtitle}>Share a private project space with each client, no login required.</p>
        </div>
        <Btn variant="primary" onClick={() => setShowCreate(true)}>+ New Portal</Btn>
      </div>

      <div style={styles.infoBox}>
        Each portal gives your client a private link to view messages, invoices, contracts, bookings and delivered files for their project. No account needed, just share the link.
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
                <Btn variant="secondary" size="sm" onClick={() => copyLink(portal.portal_token)}>
                  {copied === portal.portal_token ? '✓' : 'Copy'}
                </Btn>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={styles.createdAt}>
                  Created {new Date(portal.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div style={styles.cardActions}>
                  <Btn variant="ghost" size="sm" onClick={() => window.open(getPortalUrl(portal.portal_token), '_blank')}>
                    Open
                  </Btn>
                  <Btn variant="danger" size="sm" onClick={() => deletePortal(portal.id)}>
                    Delete
                  </Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Client Portal">
        <div style={styles.formSection}>
          <div style={styles.formRow}>
            <div>
              <label style={styles.fieldLabel}>Client name</label>
              <input
                placeholder="Jane Smith"
                value={form.client_name}
                onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                style={styles.fieldInput}
              />
            </div>
            <div>
              <label style={styles.fieldLabel}>Client email</label>
              <input
                type="email"
                placeholder="jane@example.com"
                value={form.client_email}
                onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))}
                style={styles.fieldInput}
              />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--lt-muted)', lineHeight: 1.6 }}>
            A unique link will be generated for this portal. Share it with your client: they can access it without creating an account.
          </div>
          <div style={styles.modalActions}>
            <Btn variant="ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={saving || !form.client_name || !form.client_email}
              onClick={createPortal}
            >
              {saving ? 'Creating…' : 'Create Portal'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
