import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import {
  PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE,
  partitionFilesByPortfolioImageModeration,
} from '../../lib/moderateContent'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const BLUE = '#4A9EFF'
const AMBER = '#f59e0b'

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
  const primary = doc.primary_colour ?? doc.primary_color ?? base.primary_color ?? GREEN
  const font = doc.font ?? base.font ?? 'Inter'
  const logo = doc.logo_url || base.logo_url || ''
  const hasCustomTemplate = Boolean(doc.custom_template_url)
  const fontStack = font.includes(' ') ? `"${font}", sans-serif` : `${font}, sans-serif`
  return { primary, font, logo, hasCustomTemplate, fontStack }
}

function isImage(f) {
  return f?.type?.startsWith('image') || /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f?.url || '')
}

function deliveryStatus(d) {
  if ((d.download_count ?? 0) > 0 || d.downloaded_at) return { label: 'Downloaded', color: BLUE, bg: 'rgba(74,158,255,0.16)' }
  if (d.opened_at) return { label: 'Opened', color: GREEN, bg: 'rgba(29,185,84,0.14)' }
  return { label: 'Sent', color: AMBER, bg: 'rgba(245,158,11,0.16)' }
}

function StyleBlock() {
  return (
    <style>{`
      .ltd-page { display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
      .ltd-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltd-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltd-btn-primary:hover { filter: brightness(1.06); }
      .ltd-btn-primary:disabled { opacity: .5; cursor: default; }
      .ltd-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltd-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltd-btn-sm { padding: 6px 12px; font-size: 12.5px; border-radius: 8px; }
      .ltd-input, .ltd-textarea { width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-input-border); box-sizing: border-box; }
      .ltd-textarea { min-height: 90px; resize: vertical; line-height: 1.6; }
      .ltd-input:focus, .ltd-textarea:focus { border-color: ${GREEN}; }
      .ltd-input::placeholder, .ltd-textarea::placeholder { color: var(--lt-faint); }
      .ltd-label { font-size: 12px; font-weight: 700; color: var(--lt-muted); display: block; margin-bottom: 6px; }
      .ltd-row { display: grid; grid-template-columns: 1.6fr 1fr 120px 130px auto; gap: 12px; align-items: center; padding: 14px 18px; border-top: 1px solid var(--lt-hairline); cursor: pointer; transition: background .12s ease; }
      .ltd-row:hover { background: var(--lt-surface-2); }
      .ltd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltd-modal { width: 100%; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); overflow: hidden; max-height: 92vh; display: flex; flex-direction: column; }
      .ltd-mhead { padding: 16px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
      .ltd-mbody { padding: 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
      .ltd-toggle-track { width: 42px; height: 24px; border-radius: 999px; position: relative; transition: background .2s ease; flex-shrink: 0; }
      .ltd-toggle-thumb { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .ltd-drop { border: 2px dashed var(--lt-border); border-radius: 12px; padding: 26px; text-align: center; cursor: pointer; color: var(--lt-muted); font-size: 14px; transition: border-color .12s ease, background .12s ease; }
      .ltd-drop:hover { border-color: ${GREEN}; background: var(--lt-surface-2); }
      .ltd-cover { width: 100%; aspect-ratio: 1; border-radius: 10px; overflow: hidden; cursor: pointer; border: 2px solid transparent; position: relative; }
      .ltd-cover.on { border-color: ${GREEN}; }
      .ltd-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
      @media (max-width: 767px) {
        .ltd-row { grid-template-columns: 1fr auto; }
        .ltd-row .ltd-col-client, .ltd-row .ltd-col-files, .ltd-row .ltd-col-exp { display: none; }
        .ltd-overlay { padding: 16px; }
        .ltd-page button { min-height: 40px; }
      }
    `}</style>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--lt-text)' }}>{value}</div>
    </div>
  )
}

function Pill({ children, color, bg }) {
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color, background: bg, whiteSpace: 'nowrap' }}>{children}</span>
}

export default function DeliverPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const { tier } = useSubscription()
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deliveryFilesPhase, setDeliveryFilesPhase] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const [toast, setToast] = useState(null)
  const [editingDelivery, setEditingDelivery] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editFiles, setEditFiles] = useState([])
  const [uploadingEditFiles, setUploadingEditFiles] = useState(false)
  const [brandKit, setBrandKit] = useState(null)
  const [favView, setFavView] = useState(null)

  const storageLimit = tier === 'elite' ? 200 : 50

  function showToast(msg, type = 'success', durationMs = 3000) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), durationMs)
  }

  const [form, setForm] = useState({
    title: '', client_name: '', client_email: '', message: '',
    password_protected: false, password: '', files: [],
  })

  const loadBrandKit = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle()
    setBrandKit(data ?? null)
  }, [user])

  useEffect(() => {
    if (user) { loadDeliveries(); loadBrandKit() }
  }, [user, loadBrandKit])

  useEffect(() => {
    window.addEventListener('focus', loadBrandKit)
    return () => window.removeEventListener('focus', loadBrandKit)
  }, [loadBrandKit])

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
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
    if (!user?.id) { showToast('Your session expired — please sign in again to save.', 'error'); return }
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
      password_protected: form.password_protected,
      download_token,
      expires_at: expiresAt,
      files: [],
    }).select().single()

    if (error) { setSaving(false); showToast('Could not save delivery: ' + error.message, 'error'); return }

    if (form.files.length > 0) {
      setUploading(true)
      try {
        setDeliveryFilesPhase('checking')
        const { filesToUpload, blockedFileNames, moderationFailedFileNames } =
          await partitionFilesByPortfolioImageModeration(form.files)
        if (blockedFileNames.length || moderationFailedFileNames.length) {
          const lines = []
          if (blockedFileNames.length) {
            lines.push(`${PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE}\n\nNot uploaded: ${blockedFileNames.join(', ')}`)
          }
          if (moderationFailedFileNames.length) {
            lines.push(`Could not verify: ${moderationFailedFileNames.join(', ')}`)
          }
          showToast(lines.join(' '), 'error', 9000)
        }
        setDeliveryFilesPhase('uploading')
        const uploadedFiles = []
        for (const file of filesToUpload) {
          const path = `${user.id}/${delivery.id}/${Date.now()}-${file.name}`
          const { error: uploadError } = await supabase.storage.from('portfolio').upload(path, file)
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
            uploadedFiles.push({ name: file.name, url: publicUrl, type: file.type, size: file.size })
          }
        }
        const firstImage = uploadedFiles.find(isImage)
        await supabase.from('deliveries').update({
          files: uploadedFiles,
          cover_url: firstImage ? firstImage.url : null,
        }).eq('id', delivery.id)
      } finally {
        setDeliveryFilesPhase(null)
        setUploading(false)
      }
    }

    const { data } = await supabase.from('deliveries').select('*').eq('id', delivery.id).maybeSingle()

    await supabase.functions.invoke('send-delivery', {
      body: { delivery: data ?? delivery, profile },
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
    await supabase.from('deliveries').update({ expires_at: newExpiry, expiry_reminder_sent: false }).eq('id', id)
    await loadDeliveries()
    setShowView(prev => prev ? { ...prev, expires_at: newExpiry } : null)
    showToast('Expiry extended by 30 days')
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
    const { error } = await supabase.functions.invoke('send-delivery', { body: { delivery, profile } })
    if (!error) showToast('Delivery resent to ' + delivery.client_email)
    else showToast('Failed to resend', 'error')
  }

  function openEdit(d) {
    setEditingDelivery(d)
    setEditForm({
      title: d.title,
      client_name: d.client_name,
      client_email: d.client_email,
      notes: d.message ?? '',
      password_protected: !!d.password,
      password: d.password ?? '',
      cover_url: d.cover_url ?? '',
    })
    setEditFiles(d.files ?? [])
  }

  async function saveEditDelivery() {
    const { error } = await supabase.from('deliveries').update({
      title: editForm.title,
      client_name: editForm.client_name,
      client_email: editForm.client_email,
      message: editForm.notes || null,
      files: editFiles,
      password: editForm.password_protected ? (editForm.password || null) : null,
      password_protected: !!editForm.password_protected,
      cover_url: editForm.cover_url || null,
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

  const totalStorageUsed = deliveries.reduce((sum, d) => sum + (d.files ?? []).reduce((s, f) => s + (f.size ?? 0), 0), 0)
  const storageUsedGB = totalStorageUsed / (1024 * 1024 * 1024)
  const storagePercent = Math.min(100, (storageUsedGB / storageLimit) * 100)

  const deliverBrand = useMemo(() => mergeDeliverGalleryBrand(brandKit), [brandKit])
  const onAccentText = useMemo(() => {
    try {
      let h = String(deliverBrand.primary || GREEN).replace('#', '')
      if (h.length === 3) h = h.split('').map(c => c + c).join('')
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#04120a' : '#ffffff'
    } catch { return '#04120a' }
  }, [deliverBrand.primary])

  const stats = useMemo(() => ({
    total: deliveries.length,
    opened: deliveries.filter(d => d.opened_at).length,
    downloaded: deliveries.filter(d => (d.download_count ?? 0) > 0 || d.downloaded_at).length,
    favourites: deliveries.filter(d => Array.isArray(d.favourites) && d.favourites.length > 0).length,
  }), [deliveries])

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18 }
  const stat = { ...GLASS, flex: '1 1 140px', borderRadius: 16, padding: '16px 18px' }

  const galleryPreviewCard = (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--lt-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: deliverBrand.primary, color: onAccentText }}>
        {deliverBrand.logo ? <img src={deliverBrand.logo} alt="" style={{ height: 32, maxWidth: 120, objectFit: 'contain' }} /> : null}
        <span style={{ fontWeight: 700, fontFamily: deliverBrand.fontStack, fontSize: 14 }}>Gallery preview</span>
      </div>
      <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--lt-muted)', background: 'var(--lt-surface-2)' }}>
        Client galleries use your Brand Kit colours, font and logo. This shows how the header accent will look.
      </div>
    </div>
  )

  const customDeliverTemplateBanner = deliverBrand.hasCustomTemplate ? (
    <div role="status" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--lt-border)', background: 'var(--lt-surface-2)', fontSize: 12.5, color: 'var(--lt-muted)', lineHeight: 1.45 }}>
      A custom template is active for delivery galleries in Brand Kit. Colours and font still apply; the uploaded file is not previewed here.
    </div>
  ) : null

  const favMatchedFiles = favView ? (favView.files ?? []).filter(f => (favView.favourites ?? []).includes(f.url)) : []

  return (
    <>
      <StyleBlock />
      <div className="ltd-page">
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : PINK, color: toast.type === 'success' ? GREEN_DARK : '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxWidth: 'min(420px, calc(100vw - 32px))', whiteSpace: 'pre-line' }}>
            {toast.type === 'success' ? '✓ ' : '✕ '}{toast.msg}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Deliver</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Upload and share finished work with clients via a private, branded gallery link.</p>
          </div>
          <button type="button" className="ltd-btn ltd-btn-primary" onClick={() => setShowCreate(true)}>+ New delivery</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{stats.total}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Deliveries</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{stats.opened}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Opened</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>{stats.downloaded}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Downloaded</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: stats.favourites ? PINK : 'var(--lt-text)' }}>{stats.favourites}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>With favourites</div></div>
        </div>

        {/* Storage meter */}
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--lt-muted)' }}>
            <span>Storage used</span>
            <span>{storageUsedGB.toFixed(2)} GB / {storageLimit} GB</span>
          </div>
          <div style={{ height: 6, background: 'var(--lt-track)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${storagePercent}%`, background: storagePercent > 90 ? PINK : GREEN, borderRadius: 999, transition: 'width .3s ease' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1.6fr 1fr 120px 130px auto', gap: 12, padding: '11px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--lt-faint)' }}>
            <span>Project</span>
            {!isMobile && <span>Client</span>}
            {!isMobile && <span>Status</span>}
            {!isMobile && <span>Expires</span>}
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          {loading ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14, borderTop: '1px solid var(--lt-hairline)' }}>Loading…</div>
          ) : deliveries.length === 0 ? (
            <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14, borderTop: '1px solid var(--lt-hairline)' }}>No deliveries yet. Create your first one.</div>
          ) : deliveries.map((d) => {
            const st = deliveryStatus(d)
            const exp = daysUntilExpiry(d.expires_at)
            const favCount = Array.isArray(d.favourites) ? d.favourites.length : 0
            return (
              <div key={d.id} className="ltd-row" onClick={() => setShowView(d)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--lt-faint)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span>{d.password ? 'Password protected' : 'Open access'} · {(d.files ?? []).length} files</span>
                    {favCount > 0 && <span style={{ color: PINK, fontWeight: 700 }}>♥ {favCount}</span>}
                  </div>
                  {isMobile && <span style={{ display: 'inline-block', marginTop: 6 }}><Pill color={st.color} bg={st.bg}>{st.label}</Pill></span>}
                </div>
                <span className="ltd-col-client" style={{ fontSize: 13, color: 'var(--lt-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.client_name}</span>
                <span className="ltd-col-files"><Pill color={st.color} bg={st.bg}>{st.label}</Pill></span>
                <span className="ltd-col-exp" style={{ fontSize: 12.5, color: exp <= 5 ? AMBER : 'var(--lt-muted)' }}>{exp > 0 ? `${exp}d left` : 'Expired'}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                  <button type="button" className="ltd-btn ltd-btn-ghost ltd-btn-sm" onClick={() => resendDelivery(d)}>Resend</button>
                  <button type="button" className="ltd-btn ltd-btn-ghost ltd-btn-sm" onClick={() => openEdit(d)}>Edit</button>
                  <button type="button" className="ltd-btn ltd-btn-ghost ltd-btn-sm" onClick={() => setShowView(d)}>View</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="ltd-overlay" onClick={() => { setShowCreate(false); resetForm() }}>
          <div className="ltd-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="ltd-mhead">
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>New delivery</span>
              <button type="button" onClick={() => { setShowCreate(false); resetForm() }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltd-mbody">
              {customDeliverTemplateBanner}
              {galleryPreviewCard}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div><label className="ltd-label">Project title</label><input className="ltd-input" placeholder="Wedding photos, Smith and Jones" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div><label className="ltd-label">Client name</label><input className="ltd-input" placeholder="Jane Smith" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} /></div>
              </div>
              <div><label className="ltd-label">Client email</label><input className="ltd-input" type="email" placeholder="jane@example.com" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} /></div>
              <div><label className="ltd-label">Message to client (optional)</label><textarea className="ltd-textarea" placeholder="Here are your final photos! Password is below if required." value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} /></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setForm(p => ({ ...p, password_protected: !p.password_protected, password: p.password_protected ? '' : generatePassword() }))}>
                <div className="ltd-toggle-track" style={{ background: form.password_protected ? GREEN : 'var(--lt-track)' }}>
                  <div className="ltd-toggle-thumb" style={{ left: form.password_protected ? 21 : 3 }} />
                </div>
                <span style={{ fontSize: 14, color: 'var(--lt-text)' }}>Password protect this gallery</span>
              </div>

              {form.password_protected && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}><label className="ltd-label">Gallery password</label><input className="ltd-input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
                  <button type="button" className="ltd-btn ltd-btn-ghost" onClick={() => setForm(p => ({ ...p, password: generatePassword() }))}>Generate</button>
                </div>
              )}

              <div className="ltd-drop" onClick={() => document.getElementById('deliver-files').click()}>
                <div style={{ fontWeight: 700, color: 'var(--lt-text)', marginBottom: 4 }}>+ Click to select files</div>
                <div style={{ fontSize: 12.5 }}>Photos, videos, ZIPs or any file type. The first photo becomes the cover.</div>
              </div>
              <input id="deliver-files" type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />

              {form.files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.files.map((file, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-hairline)', borderRadius: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--lt-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--lt-faint)' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                      </div>
                      <button type="button" onClick={() => setForm(prev => ({ ...prev, files: prev.files.filter((_, j) => j !== i) }))} style={{ background: 'none', border: '1px solid rgba(255,45,120,0.4)', borderRadius: 6, color: PINK, fontSize: 12, padding: '4px 10px', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ltd-btn ltd-btn-ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</button>
                <button type="button" className="ltd-btn ltd-btn-primary" disabled={saving || uploading || !form.title || !form.client_email} onClick={createDelivery}>
                  {uploading ? (deliveryFilesPhase === 'checking' ? 'Checking photos…' : 'Uploading files…') : saving ? 'Creating…' : 'Create & send link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {showView && (() => {
        const st = deliveryStatus(showView)
        const favCount = Array.isArray(showView.favourites) ? showView.favourites.length : 0
        return (
          <div className="ltd-overlay" onClick={() => setShowView(null)}>
            <div className="ltd-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div className="ltd-mhead">
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>{showView.title}</span>
                <button type="button" onClick={() => setShowView(null)} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
              <div className="ltd-mbody">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Pill color={st.color} bg={st.bg}>{st.label}</Pill>
                  <span style={{ fontSize: 12.5, color: 'var(--lt-muted)' }}>
                    {showView.opened_at ? `Opened ${new Date(showView.opened_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : 'Not opened yet'}
                    {(showView.download_count ?? 0) > 0 ? ` · ${showView.download_count} download${showView.download_count === 1 ? '' : 's'}` : ''}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <Field label="Client" value={showView.client_name || '—'} />
                  <Field label="Files" value={`${(showView.files ?? []).length} files`} />
                  <Field label="Expires" value={daysUntilExpiry(showView.expires_at) > 0 ? `${daysUntilExpiry(showView.expires_at)} days` : 'Expired'} />
                  <Field label="Favourites" value={favCount > 0 ? `${favCount} selected` : 'None yet'} />
                </div>

                {favCount > 0 && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="ltd-btn ltd-btn-ghost ltd-btn-sm" onClick={() => setFavView(showView)}>View {favCount} favourite{favCount === 1 ? '' : 's'}</button>
                    <button type="button" className="ltd-btn ltd-btn-ghost ltd-btn-sm" style={{ color: GREEN, borderColor: 'rgba(29,185,84,0.4)' }} onClick={() => { setShowView(null); navigate('/dashboard/finance/invoicing'); showToast('Create an invoice for the extra selections') }}>Invoice for extras</button>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Gallery link</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input readOnly value={getGalleryUrl(showView.download_token)} className="ltd-input" style={{ flex: 1, fontSize: 12.5 }} />
                    <button type="button" className="ltd-btn ltd-btn-ghost" onClick={() => copyToClipboard(getGalleryUrl(showView.download_token), 'link')}>{copied === 'link' ? '✓' : 'Copy'}</button>
                  </div>
                </div>

                {showView.password && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Gallery password</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input readOnly value={showView.password} className="ltd-input" style={{ flex: 1, fontSize: 12.5 }} />
                      <button type="button" className="ltd-btn ltd-btn-ghost" onClick={() => copyToClipboard(showView.password, 'password')}>{copied === 'password' ? '✓' : 'Copy'}</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 4 }}>
                  <button type="button" className="ltd-btn ltd-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => deleteDelivery(showView.id)}>Delete</button>
                  <button type="button" className="ltd-btn ltd-btn-ghost" onClick={() => extendExpiry(showView.id)}>Extend 30 days</button>
                  <button type="button" className="ltd-btn ltd-btn-primary" onClick={() => window.open(getGalleryUrl(showView.download_token), '_blank')}>Open gallery</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Favourites modal */}
      {favView && (
        <div className="ltd-overlay" onClick={() => setFavView(null)}>
          <div className="ltd-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="ltd-mhead">
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>{favView.client_name || 'Client'}'s favourites ({favMatchedFiles.length})</span>
              <button type="button" onClick={() => setFavView(null)} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltd-mbody">
              {favMatchedFiles.length === 0 ? (
                <div style={{ color: 'var(--lt-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>The selected files are no longer in this delivery.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                  {favMatchedFiles.map((f) => (
                    <div key={f.url} style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: 1, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-hairline)' }}>
                      {isImage(f)
                        ? <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ padding: 10, fontSize: 11, color: 'var(--lt-muted)', wordBreak: 'break-word' }}>{f.name}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="ltd-btn ltd-btn-primary" onClick={() => { setFavView(null); navigate('/dashboard/finance/invoicing'); showToast('Create an invoice for the extra selections') }}>Invoice for extras</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingDelivery && (
        <div className="ltd-overlay" onClick={() => { setEditingDelivery(null); setEditFiles([]) }}>
          <div className="ltd-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="ltd-mhead">
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Edit delivery</span>
              <button type="button" onClick={() => { setEditingDelivery(null); setEditFiles([]) }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltd-mbody">
              <div><label className="ltd-label">Project name</label><input className="ltd-input" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div><label className="ltd-label">Client name</label><input className="ltd-input" value={editForm.client_name} onChange={e => setEditForm(p => ({ ...p, client_name: e.target.value }))} /></div>
                <div><label className="ltd-label">Client email</label><input className="ltd-input" value={editForm.client_email} onChange={e => setEditForm(p => ({ ...p, client_email: e.target.value }))} /></div>
              </div>
              <div><label className="ltd-label">Notes to client</label><textarea className="ltd-textarea" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} /></div>

              {/* Password controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setEditForm(p => ({ ...p, password_protected: !p.password_protected, password: p.password_protected ? '' : (p.password || generatePassword()) }))}>
                <div className="ltd-toggle-track" style={{ background: editForm.password_protected ? GREEN : 'var(--lt-track)' }}>
                  <div className="ltd-toggle-thumb" style={{ left: editForm.password_protected ? 21 : 3 }} />
                </div>
                <span style={{ fontSize: 14, color: 'var(--lt-text)' }}>Password protect this gallery</span>
              </div>
              {editForm.password_protected && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}><label className="ltd-label">Gallery password</label><input className="ltd-input" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} /></div>
                  <button type="button" className="ltd-btn ltd-btn-ghost" onClick={() => setEditForm(p => ({ ...p, password: generatePassword() }))}>Generate</button>
                </div>
              )}

              {/* Cover picker */}
              {editFiles.some(isImage) && (
                <div>
                  <label className="ltd-label">Cover image</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                    {editFiles.filter(isImage).map((f) => (
                      <div key={f.url} className={`ltd-cover${editForm.cover_url === f.url ? ' on' : ''}`} onClick={() => setEditForm(p => ({ ...p, cover_url: p.cover_url === f.url ? '' : f.url }))}>
                        <img src={f.url} alt={f.name} />
                        {editForm.cover_url === f.url && <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: GREEN, color: GREEN_DARK, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✓</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              <div>
                <label className="ltd-label">Files ({editFiles.length})</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {editFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-hairline)', borderRadius: 8 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--lt-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button type="button" onClick={() => setEditFiles(prev => prev.filter((_, j) => j !== i))} style={{ padding: '2px 7px', background: 'none', border: '1px solid rgba(255,45,120,0.4)', borderRadius: 5, color: PINK, fontSize: 11, cursor: 'pointer', flexShrink: 0, marginLeft: 6 }}>✕</button>
                    </div>
                  ))}
                </div>
                <div className="ltd-drop" style={{ padding: 14 }} onClick={() => document.getElementById('edit-delivery-files').click()}>
                  {uploadingEditFiles ? 'Uploading…' : '+ Add more files'}
                </div>
                <input id="edit-delivery-files" type="file" multiple style={{ display: 'none' }} onChange={e => { uploadEditFiles(Array.from(e.target.files || [])); e.target.value = '' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ltd-btn ltd-btn-ghost" onClick={() => { setEditingDelivery(null); setEditFiles([]) }}>Cancel</button>
                <button type="button" className="ltd-btn ltd-btn-primary" onClick={saveEditDelivery}>Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
