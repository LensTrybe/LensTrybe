import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/** Per-document settings: `deliver` overrides `deliver_gallery` when both exist (Brand Kit tabs). */
function mergeDeliverGalleryBrand(brandKit) {
  const base = brandKit || {}
  const raw = base.document_brand_settings
  const docs = raw && typeof raw === 'object' ? raw : {}
  const g = docs.deliver_gallery && typeof docs.deliver_gallery === 'object' ? docs.deliver_gallery : {}
  const d = docs.deliver && typeof docs.deliver === 'object' ? docs.deliver : {}
  const doc = { ...g, ...d }
  const primary = doc.primary_colour ?? doc.primary_color ?? base.primary_color ?? '#1DB954'
  const accent = '#ffffff'
  const font = doc.font ?? base.font ?? 'Inter'
  const logo = doc.logo_url || base.logo_url || ''
  const secondary = base.secondary_color ?? '#ffffff'
  const hasCustomTemplate = Boolean(doc.custom_template_url)
  const fontStack = font.includes(' ') ? `"${font}", sans-serif` : `${font}, sans-serif`
  return { primary, accent, font, logo, secondary, hasCustomTemplate, fontStack }
}

export default function DeliverPage() {
  const { user, profile } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const { tier } = useSubscription()
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const [toast, setToast] = useState(null)
  const [editingDelivery, setEditingDelivery] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editFiles, setEditFiles] = useState([])
  const [uploadingEditFiles, setUploadingEditFiles] = useState(false)
  const [brandKit, setBrandKit] = useState(null)

  const storageLimit = tier === 'elite' ? 200 : 50

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [form, setForm] = useState({
    title: '',
    client_name: '',
    client_email: '',
    message: '',
    password_protected: false,
    password: '',
    files: [],
  })

  const loadBrandKit = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle()
    setBrandKit(data ?? null)
  }, [user])

  useEffect(() => {
    if (user) {
      loadDeliveries()
      loadBrandKit()
    }
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

  async function loadDeliveries() {
    if (!user) return
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setDeliveries(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ title: '', client_name: '', client_email: '', message: '', password_protected: false, password: '', files: [] })
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files)
    setForm(p => ({ ...p, files: [...p.files, ...files] }))
  }

  async function createDelivery() {
    setSaving(true)
    const download_token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: delivery, error } = await supabase.from('deliveries').insert({
      creative_id: user.id,
      title: form.title,
      client_name: form.client_name,
      client_email: form.client_email,
      message: form.message,
      password: form.password_protected ? form.password : null,
      download_token,
      expires_at: expiresAt,
      files: [],
    }).select().single()

    if (error) { setSaving(false); return }

    if (form.files.length > 0) {
      setUploading(true)
      const uploadedFiles = []
      for (const file of form.files) {
        const path = `${user.id}/${delivery.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('portfolio').upload(path, file)
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
          uploadedFiles.push({ name: file.name, url: publicUrl, type: file.type, size: file.size })
        }
      }
      await supabase.from('deliveries').update({ files: uploadedFiles }).eq('id', delivery.id)
      setUploading(false)
    }

    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', delivery.id)
      .single()

    await supabase.functions.invoke('send-delivery', {
      body: {
        delivery: data ?? delivery,
        profile,
      },
    })

    await loadDeliveries()
    setShowCreate(false)
    resetForm()
    setSaving(false)
  }

  async function deleteDelivery(id) {
    await supabase.from('deliveries').delete().eq('id', id)
    await loadDeliveries()
    setShowView(null)
  }

  async function extendExpiry(id) {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('deliveries').update({ expires_at: newExpiry }).eq('id', id)
    await loadDeliveries()
    setShowView(prev => prev ? { ...prev, expires_at: newExpiry } : null)
  }

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function getGalleryUrl(download_token) {
    return `${window.location.origin}/deliver/${download_token}`
  }

  function daysUntilExpiry(expiresAt) {
    return Math.ceil((new Date(expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
  }

  async function resendDelivery(delivery) {
    const { error } = await supabase.functions.invoke('send-delivery', {
      body: { delivery, profile },
    })
    if (!error) showToast('Delivery resent to ' + delivery.client_email)
    else showToast('Failed to resend', 'error')
  }

  async function saveEditDelivery() {
    const { error } = await supabase.from('deliveries').update({
      title: editForm.title,
      client_name: editForm.client_name,
      client_email: editForm.client_email,
      message: editForm.notes || null,
      files: editFiles,
    }).eq('id', editingDelivery.id)
    if (!error) {
      await loadDeliveries()
      setEditingDelivery(null)
      setEditFiles([])
      showToast('Delivery updated')
    } else {
      showToast(error.message, 'error')
    }
  }

  async function uploadEditFiles(newFiles) {
    if (!user || !editingDelivery || !newFiles?.length) return
    setUploadingEditFiles(true)
    try {
      const uploaded = []
      for (const file of newFiles) {
        const path = `deliveries/${user.id}/${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from('deliveries').upload(path, file)
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from('deliveries').getPublicUrl(path)
          uploaded.push({ name: file.name, url: publicUrl, type: file.type, size: file.size })
        }
      }
      setEditFiles(prev => [...prev, ...uploaded])
    } finally {
      setUploadingEditFiles(false)
    }
  }

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { ...TYPO.body, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tableWrap: { ...GLASS_CARD, borderRadius: 'var(--radius-xl)', overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden' },
    tableHeader: { display: 'grid', gridTemplateColumns: '1fr 160px 80px 120px minmax(200px, 1fr)', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: isMobile ? '760px' : 'auto' },
    tableRow: { display: 'grid', gridTemplateColumns: '1fr 160px 80px 120px minmax(200px, 1fr)', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', alignItems: 'center', cursor: 'pointer', transition: 'background var(--transition-fast)', minWidth: isMobile ? '760px' : 'auto' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' },
    toggle: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
    toggleTrack: (on) => ({ width: '40px', height: '22px', borderRadius: 'var(--radius-full)', background: on ? 'var(--green)' : 'var(--border-strong)', position: 'relative', transition: 'background var(--transition-base)', flexShrink: 0 }),
    toggleThumb: (on) => ({ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left var(--transition-base)' }),
    toggleLabel: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    fileZone: { border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-xl)', padding: isMobile ? '16px' : '32px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' },
    fileList: { display: 'flex', flexDirection: 'column', gap: '6px' },
    fileItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' },
    copyRow: { display: 'flex', alignItems: 'center', gap: '8px' },
    copyInput: { flex: 1, ...GLASS_CARD, borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', outline: 'none' },
    viewGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    storageBar: { display: 'flex', flexDirection: 'column', gap: '8px' },
    storageTrack: { height: '4px', background: 'var(--border-default)', borderRadius: 'var(--radius-full)', overflow: 'hidden' },
  }

  const totalStorageUsed = deliveries.reduce((sum, d) => {
    return sum + (d.files ?? []).reduce((s, f) => s + (f.size ?? 0), 0)
  }, 0)
  const storageUsedGB = totalStorageUsed / (1024 * 1024 * 1024)
  const storagePercent = Math.min(100, (storageUsedGB / storageLimit) * 100)

  const deliverBrand = useMemo(() => mergeDeliverGalleryBrand(brandKit), [brandKit])
  const deliverPrimary = deliverBrand.primary
  const deliverAccent = deliverBrand.accent
  const deliverFontStack = deliverBrand.fontStack
  const deliverLogo = deliverBrand.logo
  const deliverHeaderText = deliverBrand.secondary
  const galleryPreviewCard = (
    <div style={{ border: `1px solid ${deliverAccent}44`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: deliverPrimary, color: deliverHeaderText }}>
        {deliverLogo ? <img src={deliverLogo} alt="" style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }} /> : null}
        <span style={{ fontWeight: 700, fontFamily: deliverFontStack, fontSize: '14px' }}>Gallery preview</span>
      </div>
      <div style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: deliverFontStack, borderTop: `3px solid ${deliverAccent}`, background: 'var(--bg-base)' }}>
        Client-facing delivery pages use your Brand Kit colours, font and logo. This card shows how that header will look.
      </div>
    </div>
  )
  const customDeliverTemplateBanner = deliverBrand.hasCustomTemplate ? (
    <div
      role="status"
      style={{
        marginBottom: '12px',
        padding: '10px 14px',
        borderRadius: '8px',
        border: `1px solid ${deliverAccent}55`,
        background: `${deliverAccent}12`,
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.45,
        fontFamily: 'var(--font-ui)',
      }}
    >
      A custom template is active for delivery galleries in Brand Kit. Colours and font still apply; the uploaded file is not previewed here.
    </div>
  ) : null

  return (
    <div style={styles.page} className="deliver-page">
      <style>{`
        @media (max-width: 767px) {
          .deliver-page button { min-height: 44px; }
          .deliver-page input, .deliver-page textarea, .deliver-page select { width: 100% !important; font-size: 14px !important; }
          .deliver-page .deliver-gallery-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontFamily: 'var(--font-ui)' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>LensTrybe Deliver</h1>
          <p style={styles.subtitle}>Upload and share finished work with clients via a private gallery link.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ New Delivery</Button>
      </div>

      <div style={styles.storageBar}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          <span>Storage used</span>
          <span>{storageUsedGB.toFixed(2)} GB / {storageLimit} GB</span>
        </div>
        <div style={styles.storageTrack}>
          <div style={{ height: '100%', width: `${storagePercent}%`, background: storagePercent > 90 ? 'var(--error)' : deliverPrimary, borderRadius: 'var(--radius-full)', transition: 'width var(--transition-base)' }} />
        </div>
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <span>Project</span>
          <span>Client</span>
          <span>Files</span>
          <span>Expires</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div style={styles.emptyState}>Loading…</div>
        ) : deliveries.length === 0 ? (
          <div style={styles.emptyState}>No deliveries yet. Create your first one.</div>
        ) : deliveries.map((d, i) => (
          <div
            key={d.id}
            style={{ ...styles.tableRow, borderBottom: i === deliveries.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
            onClick={() => setShowView(d)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{d.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{d.password ? '🔒 Password protected' : '🔓 Open access'}</div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{d.client_name}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{(d.files ?? []).length}</span>
            <span style={{ fontSize: '12px', color: daysUntilExpiry(d.expires_at) <= 5 ? 'var(--warning)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {daysUntilExpiry(d.expires_at) > 0 ? `${daysUntilExpiry(d.expires_at)}d` : 'Expired'}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => resendDelivery(d)}
                style={{ padding: '5px 12px', ...GLASS_CARD, borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                Resend
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingDelivery(d)
                  setEditForm({ title: d.title, client_name: d.client_name, client_email: d.client_email, notes: d.notes ?? d.message ?? '' })
                  setEditFiles(d.files ?? [])
                }}
                style={{ padding: '5px 12px', ...GLASS_CARD, borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                Edit
              </button>
              <Button variant="ghost" size="sm" onClick={() => setShowView(d)}>View</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="New Delivery" size="lg">
        <div style={styles.formSection}>
          {customDeliverTemplateBanner}
          {galleryPreviewCard}
          <div style={styles.formRow}>
            <Input label="Project title" placeholder="Wedding photos, Smith and Jones" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Input label="Client name" placeholder="Jane Smith" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} />
          </div>
          <Input label="Client email" type="email" placeholder="jane@example.com" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} />
          <Input label="Message to client (optional)" placeholder="Here are your final photos! Password is below if required." value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />

          <div style={styles.toggle} onClick={() => setForm(p => ({ ...p, password_protected: !p.password_protected, password: p.password_protected ? '' : generatePassword() }))}>
            <div style={{ ...styles.toggleTrack(form.password_protected), background: form.password_protected ? deliverPrimary : styles.toggleTrack(false).background }}>
              <div style={styles.toggleThumb(form.password_protected)} />
            </div>
            <span style={styles.toggleLabel}>Password protect this gallery</span>
          </div>

          {form.password_protected && (
            <div style={styles.copyRow}>
              <Input label="Gallery password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              <div style={{ marginTop: '20px' }}>
                <Button variant="secondary" size="sm" onClick={() => setForm(p => ({ ...p, password: generatePassword() }))}>Generate</Button>
              </div>
            </div>
          )}

          <div
            style={styles.fileZone}
            onClick={() => document.getElementById('deliver-files').click()}
            onMouseEnter={e => { e.currentTarget.style.borderColor = deliverAccent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          >
            <div style={{ fontSize: '24px' }}>📁</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: deliverFontStack }}>Click to select files to upload</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: deliverFontStack }}>Photos, videos, ZIPs or any file type</div>
          </div>
          <input id="deliver-files" type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />

          {form.files.length > 0 && (
            <div style={styles.fileList}>
              {form.files.map((file, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', ...GLASS_CARD, borderRadius: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{file.type?.startsWith('image') ? '🖼️' : file.type?.startsWith('video') ? '🎬' : '📄'}</span>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{file.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, files: prev.files.filter((_, j) => j !== i) }))}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}
                  >Remove</button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" disabled={saving || uploading || !form.title || !form.client_email} onClick={createDelivery}>
              {uploading ? 'Uploading files…' : saving ? 'Creating…' : 'Create & Send Gallery Link'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      {showView && (
        <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="Delivery Details" size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {customDeliverTemplateBanner}
            {galleryPreviewCard}
            <div style={styles.viewGrid}>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Project</div>
                <div style={styles.viewValue}>{showView.title}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Client</div>
                <div style={styles.viewValue}>{showView.client_name}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Files</div>
                <div style={styles.viewValue}>{(showView.files ?? []).length} files</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Expires</div>
                <div style={styles.viewValue}>{daysUntilExpiry(showView.expires_at) > 0 ? `${daysUntilExpiry(showView.expires_at)} days` : 'Expired'}</div>
              </div>
            </div>

            <div style={styles.viewField}>
              <div style={styles.viewLabel}>Gallery Link</div>
              <div style={styles.copyRow}>
                <input readOnly style={styles.copyInput} value={getGalleryUrl(showView.download_token)} />
                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(getGalleryUrl(showView.download_token), 'link')}>
                  {copied === 'link' ? '✓ Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {showView.password && (
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Gallery Password</div>
                <div style={styles.copyRow}>
                  <input readOnly style={styles.copyInput} value={showView.password} />
                  <Button variant="secondary" size="sm" onClick={() => copyToClipboard(showView.password, 'password')}>
                    {copied === 'password' ? '✓ Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}

            <div style={styles.modalActions}>
              <Button variant="danger" size="sm" onClick={() => deleteDelivery(showView.id)}>Delete</Button>
              <Button variant="secondary" size="sm" onClick={() => extendExpiry(showView.id)}>Extend 30 Days</Button>
              <Button variant="primary" size="sm" onClick={() => window.open(getGalleryUrl(showView.download_token), '_blank')}>Open Gallery</Button>
            </div>
          </div>
        </Modal>
      )}

      {editingDelivery && (
        <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ ...GLASS_MODAL_PANEL, borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Delivery</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Project Name</label>
                <input style={{ width: '100%', padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Client Name</label>
                <input style={{ width: '100%', padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Client Email</label>
                <input style={{ width: '100%', padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }} value={editForm.client_email} onChange={e => setEditForm(p => ({ ...p, client_email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes to Client</label>
                <textarea style={{ width: '100%', padding: '9px 12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' }} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Files ({editFiles.length})</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {editFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', ...GLASS_CARD, borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '12px', flexShrink: 0 }}>{f.type?.startsWith('image') ? '🖼️' : f.type?.startsWith('video') ? '🎬' : '📄'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '10px', cursor: 'pointer', flexShrink: 0, marginLeft: '4px' }}
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div
                  onClick={() => document.getElementById('edit-delivery-files').click()}
                  style={{ border: '2px dashed var(--border-default)', borderRadius: '8px', padding: '14px', textAlign: 'center', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)' }}
                >
                  {uploadingEditFiles ? 'Uploading...' : '+ Add more files'}
                </div>
                <input id="edit-delivery-files" type="file" multiple style={{ display: 'none' }} onChange={e => { uploadEditFiles(Array.from(e.target.files || [])); e.target.value = '' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => { setEditingDelivery(null); setEditFiles([]) }} style={{ padding: '9px 18px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Cancel</button>
              <button type="button" onClick={saveEditDelivery} style={{ padding: '9px 18px', background: deliverPrimary, border: 'none', borderRadius: '8px', color: deliverHeaderText, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
