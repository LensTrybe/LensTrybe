import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'

const LIMITS = { basic: 5, pro: 20, expert: 40, elite: 999 }

export default function PortfolioPage() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const { tier } = useSubscription()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
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
    const files = Array.from(e.target.files)
    if (!files.length) return
    if (items.length + files.length > limit) {
      alert(`You can only have ${limit} portfolio items on your current plan.`)
      return
    }
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('portfolio').upload(path, file)
      if (uploadError) continue
      const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
      const isVideo = file.type.startsWith('video/')
      await supabase.from('portfolio_items').insert({
        user_id: user.id,
        file_url: publicUrl,
        file_type: isVideo ? 'video' : 'image',
        sort_order: items.length,
        headline: '',
        description: '',
        alt_text: '',
      })
    }
    await loadItems()
    setUploading(false)
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
    page: { display: 'flex', flexDirection: 'column', gap: '32px', overflowX: 'hidden' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexDirection: isMobile ? 'column' : 'row' },
    title: { fontFamily: 'var(--font-display)', fontSize: isMobile ? '24px' : '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    limitBar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    limitTrack: { flex: 1, height: '4px', background: 'var(--border-default)', borderRadius: 'var(--radius-full)', overflow: 'hidden' },
    limitFill: { height: '100%', background: items.length >= limit ? 'var(--error)' : 'var(--green)', borderRadius: 'var(--radius-full)', transition: 'width var(--transition-base)' },
    limitText: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' },
    uploadZone: { border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-xl)', padding: isMobile ? '16px' : '48px', textAlign: 'center', cursor: 'pointer', transition: 'all var(--transition-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
    grid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '12px' },
    gridItem: (sel) => ({ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', aspectRatio: '1', cursor: 'pointer', border: `2px solid ${sel ? 'var(--green)' : 'transparent'}`, transition: 'border-color var(--transition-fast)' }),
    img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    overlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0, transition: 'opacity var(--transition-fast)' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    inputWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
    input: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' },
    textarea: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' },
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
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Portfolio</h1>
          <p style={styles.subtitle}>Showcase your best work to potential clients.</p>
        </div>
        <Button variant="primary" disabled={items.length >= limit || uploading} onClick={() => document.getElementById('portfolio-upload').click()}>
          {uploading ? 'Uploading…' : '+ Add Photos'}
        </Button>
        <input id="portfolio-upload" type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      <div style={styles.limitBar}>
        <div style={styles.limitTrack}>
          <div style={{ ...styles.limitFill, width: `${Math.min(100, (items.length / limit) * 100)}%` }} />
        </div>
        <div style={styles.limitText}>{items.length} / {limit === 999 ? '∞' : limit} items</div>
        {(tier === 'basic' || tier === 'pro') && <Badge variant="default" size="sm">Upgrade for more</Badge>}
      </div>

      {loading ? (
        <div style={styles.emptyState}>Loading portfolio…</div>
      ) : items.length === 0 ? (
        <div style={styles.uploadZone} onClick={() => document.getElementById('portfolio-upload').click()}>
          <div style={{ fontSize: '32px' }}>📷</div>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Upload your first photo or video</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>JPG, PNG, MP4 — drag and drop or click to browse</div>
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
                <Button variant="secondary" size="sm" onClick={e => { e.stopPropagation(); setEditForm({ headline: item.headline ?? '', description: item.description ?? '', alt_text: item.alt_text ?? '' }); setShowEdit(item) }}>Edit</Button>
                <Button variant="danger" size="sm" onClick={e => { e.stopPropagation(); deleteItem(item.id, item.file_url) }}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Portfolio Item" size="md">
        <div style={styles.formSection}>
          {showEdit && (
            <img src={showEdit.file_url} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />
          )}
          <div style={styles.inputWrap}>
            <label style={styles.label}>Headline</label>
            <input style={styles.input} placeholder="e.g. Golden Hour Wedding — Byron Bay" value={editForm.headline} onChange={e => setEditForm(p => ({ ...p, headline: e.target.value }))} />
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
            <Button variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
