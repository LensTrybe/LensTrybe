import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import {
  PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE,
  partitionFilesByPortfolioImageModeration,
} from '../../lib/moderateContent'

// Theme-aware Portfolio (light + dark) built on the --lt-* tokens. Styling only:
// the image grid, aspect ratios, object-fit, hover overlay and upload controls are
// preserved exactly; only colours, borders, glass, fields and buttons changed.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'
const ERROR = '#ef4444'
const FONT = { fontFamily: 'Inter, sans-serif' }

const LIMITS = { basic: 5, pro: 20, expert: 40, elite: 999 }

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

const MODAL_SIZES = { sm: 400, md: 520, lg: 720 }

function LtModal({ isOpen, onClose, title, size = 'md', children }) {
  if (!isOpen) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '48px 16px', background: 'rgba(0,0,0,0.55)', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: MODAL_SIZES[size] || MODAL_SIZES.md, borderRadius: 16,
          background: 'var(--lt-modal-bg)', border: 'var(--lt-modal-border)', boxShadow: 'var(--lt-modal-shadow)',
          backdropFilter: 'var(--lt-modal-blur)', WebkitBackdropFilter: 'var(--lt-modal-blur)', ...FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--lt-hairline)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--lt-text)' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--lt-muted)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

export default function PortfolioPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const { tier } = useSubscription()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [showEdit, setShowEdit] = useState(null)
  const [editForm, setEditForm] = useState({ headline: '', description: '', alt_text: '' })
  const limit = LIMITS[tier] ?? 5

  useEffect(() => { loadItems() }, [user])
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadItems() {
    if (!user) return
    const { data } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }

  async function handleUpload(e) {
    const rawFiles = Array.from(e.target.files)
    if (!rawFiles.length) return
    setUploadError(null)
    setUploading(true)
    setUploadPhase('checking')
    try {
      const { filesToUpload, blockedFileNames, moderationFailedFileNames } =
        await partitionFilesByPortfolioImageModeration(rawFiles)

      if (blockedFileNames.length || moderationFailedFileNames.length) {
        const parts = []
        if (blockedFileNames.length) {
          parts.push(
            `${PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE}\n\nRejected: ${blockedFileNames.join(', ')}`,
          )
        }
        if (moderationFailedFileNames.length) {
          parts.push(`Could not verify: ${moderationFailedFileNames.join(', ')}`)
        }
        setUploadError(parts.join('\n\n'))
      }

      if (!filesToUpload.length) {
        await loadItems()
        return
      }

      if (items.length + filesToUpload.length > limit) {
        alert(`You can only have ${limit} portfolio items on your current plan.`)
        return
      }

      setUploadPhase('uploading')
      let nextOrder = items.length
      for (const file of filesToUpload) {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('portfolio').upload(path, file)
        if (uploadErr) continue
        const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
        const isVideo = file.type.startsWith('video/')
        await supabase.from('portfolio_items').insert({
          user_id: user.id,
          file_url: publicUrl,
          file_type: isVideo ? 'video' : 'image',
          sort_order: nextOrder,
          headline: '',
          description: '',
          alt_text: '',
        })
        nextOrder += 1
      }
      await loadItems()
    } finally {
      setUploadPhase(null)
      setUploading(false)
      e.target.value = ''
    }
  }

  async function deleteItem(id, fileUrl) {
    const path = fileUrl.split('/portfolio/')[1]
    if (path) await supabase.storage.from('portfolio').remove([path])
    await supabase.from('portfolio_items').delete().eq('id', id)
    await loadItems()
    setSelected(null)
  }

  async function saveEdit() {
    await supabase.from('portfolio_items').update({
      headline: editForm.headline,
      description: editForm.description,
      alt_text: editForm.alt_text,
    }).eq('id', showEdit.id)
    await loadItems()
    setShowEdit(null)
  }

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden', color: 'var(--lt-text)', ...FONT },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    title: { fontSize: isMobile ? '24px' : '28px', color: 'var(--lt-text)', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, fontFamily: 'inherit' },
    subtitle: { fontSize: '14px', color: 'var(--lt-muted)', fontFamily: 'inherit', marginTop: '4px' },
    limitBar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    limitTrack: { flex: 1, height: '4px', background: 'var(--lt-track)', borderRadius: '999px', overflow: 'hidden' },
    limitFill: { height: '100%', background: items.length >= limit ? ERROR : GREEN, borderRadius: '999px', transition: 'width 0.2s ease' },
    limitText: { fontSize: '12px', color: 'var(--lt-muted)', fontFamily: 'inherit', whiteSpace: 'nowrap' },
    uploadZone: { border: '2px dashed var(--lt-border)', borderRadius: '16px', padding: isMobile ? '16px' : '48px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '12px' },
    gridItem: (sel) => ({ position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '1', cursor: 'pointer', border: `2px solid ${sel ? GREEN : 'transparent'}`, transition: 'border-color 0.12s ease' }),
    img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    overlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0, transition: 'opacity 0.12s ease' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: '14px', fontFamily: 'inherit' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    inputWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '13px', fontWeight: 500, color: 'var(--lt-muted)', fontFamily: 'inherit' },
    input: { ...field, borderRadius: '12px', padding: '10px 14px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
    textarea: { ...field, borderRadius: '12px', padding: '10px 14px', fontSize: '14px', width: '100%', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  }

  return (
    <div style={styles.page} className="portfolio-page">
      <style>{`
        @media (max-width: 767px) {
          .portfolio-page button { min-height: 44px; }
          .portfolio-page input, .portfolio-page textarea, .portfolio-page select { width: 100% !important; font-size: 14px !important; }
        }
      `}</style>
      {uploadError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: ERROR,
            fontSize: '13px',
            fontFamily: 'inherit',
            whiteSpace: 'pre-line',
            lineHeight: 1.5,
          }}
        >
          {uploadError}
        </div>
      )}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Portfolio</h1>
          <p style={styles.subtitle}>Showcase your best work to potential clients.</p>
        </div>
        <Btn variant="primary" disabled={items.length >= limit || uploading} onClick={() => document.getElementById('portfolio-upload').click()}>
          {uploading ? (uploadPhase === 'checking' ? 'Checking photos...' : 'Uploading…') : '+ Add Photos'}
        </Btn>
        <input id="portfolio-upload" type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      <div style={styles.limitBar}>
        <div style={styles.limitTrack}>
          <div style={{ ...styles.limitFill, width: `${Math.min(100, (items.length / limit) * 100)}%` }} />
        </div>
        <div style={styles.limitText}>{items.length} / {limit === 999 ? '∞' : limit} items</div>
        {(tier === 'basic' || tier === 'pro') && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', color: 'var(--lt-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Upgrade for more
          </span>
        )}
      </div>

      {loading ? (
        <div style={styles.emptyState}>Loading portfolio…</div>
      ) : items.length === 0 ? (
        <div style={styles.uploadZone} onClick={() => document.getElementById('portfolio-upload').click()}>
          <div style={{ fontSize: '32px' }}></div>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--lt-text)', fontFamily: 'inherit' }}>Upload your first photo or video</div>
          <div style={{ fontSize: '13px', color: 'var(--lt-muted)', fontFamily: 'inherit' }}>JPG, PNG, MP4: drag and drop or click to browse</div>
        </div>
      ) : (
        <div style={styles.grid}>
          {items.map((item) => (
            <div
              key={item.id}
              style={styles.gridItem(selected?.id === item.id)}
              onClick={() => setSelected(selected?.id === item.id ? null : item)}
              onMouseEnter={e => e.currentTarget.querySelector('.overlay').style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.querySelector('.overlay').style.opacity = '0'}
            >
              {item.file_type === 'video'
                ? <video src={item.file_url} style={styles.img} muted />
                : <img src={item.file_url} alt={item.alt_text || ''} style={styles.img} />
              }
              <div className="overlay" style={styles.overlay}>
                <Btn variant="secondary" size="sm" onClick={e => { e.stopPropagation(); setEditForm({ headline: item.headline ?? '', description: item.description ?? '', alt_text: item.alt_text ?? '' }); setShowEdit(item) }}>Edit</Btn>
                <Btn variant="danger" size="sm" onClick={e => { e.stopPropagation(); deleteItem(item.id, item.file_url) }}>Delete</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      <LtModal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Portfolio Item" size="md">
        <div style={styles.formSection}>
          {showEdit && (
            <img src={showEdit.file_url} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '12px' }} />
          )}
          <div style={styles.inputWrap}>
            <label style={styles.label}>Headline</label>
            <input style={styles.input} placeholder="e.g. Golden Hour Wedding, Byron Bay" value={editForm.headline} onChange={e => setEditForm(p => ({ ...p, headline: e.target.value }))} />
          </div>
          <div style={styles.inputWrap}>
            <label style={styles.label}>Description</label>
            <textarea style={styles.textarea} placeholder="Describe this shot or project…" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div style={styles.inputWrap}>
            <label style={styles.label}>Alt text (for SEO)</label>
            <input style={styles.input} placeholder="e.g. Wedding photographer Brisbane outdoor ceremony" value={editForm.alt_text} onChange={e => setEditForm(p => ({ ...p, alt_text: e.target.value }))} />
          </div>
          <div style={styles.modalActions}>
            <Btn variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveEdit}>Save Changes</Btn>
          </div>
        </div>
      </LtModal>
    </div>
  )
}
