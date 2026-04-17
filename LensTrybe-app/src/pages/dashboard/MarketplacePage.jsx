import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const CATEGORIES = ['Camera Bodies', 'Lenses', 'Lighting', 'Audio', 'Drones', 'Editing Hardware', 'Bags & Tripods', 'Miscellaneous']
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']

export default function MarketplacePage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('browse')
  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [savedListings, setSavedListings] = useState([])
  const [savedIds, setSavedIds] = useState(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [form, setForm] = useState({ title: '', category: 'Camera Bodies', condition: 'Good', price: '', description: '', location: '', open_to_swaps: false })
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [photoFiles, setPhotoFiles] = useState([])
  const [photoUrls, setPhotoUrls] = useState([])
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editPhotoUrls, setEditPhotoUrls] = useState([])
  const [uploadingEditPhotos, setUploadingEditPhotos] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [showContactSeller, setShowContactSeller] = useState(false)
  const [contactMessage, setContactMessage] = useState('')
  const [sendingContact, setSendingContact] = useState(false)

  useEffect(() => { if (user) { loadListings(); loadMyListings(); loadSaved() } }, [user])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function closeCreateModal() {
    setShowCreate(false)
    setPhotoUrls([])
    setPhotoFiles([])
  }

  async function loadListings() {
    const { data } = await supabase.from('marketplace_listings').select('*').eq('status', 'active').order('created_at', { ascending: false })
    setListings(data ?? [])
  }

  async function loadMyListings() {
    const { data } = await supabase.from('marketplace_listings').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setMyListings(data ?? [])
  }

  async function loadSaved() {
    const { data } = await supabase.from('saved_listings').select('listing_id, marketplace_listings(*)').eq('user_id', user.id)
    setSavedIds(new Set((data ?? []).map(s => s.listing_id)))
    setSavedListings((data ?? []).map(s => s.marketplace_listings).filter(Boolean))
  }

  async function uploadPhotos(files) {
    if (!files?.length || !user) return
    setUploadingPhotos(true)
    const urls = []
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('marketplace').upload(path, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('marketplace').getPublicUrl(path)
        urls.push(publicUrl)
      }
    }
    setPhotoUrls(prev => [...prev, ...urls])
    setUploadingPhotos(false)
  }

  async function uploadEditPhotos(files) {
    if (!files?.length || !user) return
    setUploadingEditPhotos(true)
    const urls = []
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('marketplace').upload(path, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('marketplace').getPublicUrl(path)
        urls.push(publicUrl)
      }
    }
    setEditPhotoUrls(prev => [...prev, ...urls])
    setUploadingEditPhotos(false)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('marketplace_listings').update({
      title: editForm.title,
      category: editForm.category,
      condition: editForm.condition,
      price: parseFloat(editForm.price),
      description: editForm.description || null,
      location: editForm.location || null,
      open_to_swaps: editForm.open_to_swaps,
      photos: editPhotoUrls,
    }).eq('id', selected.id)
    if (!error) {
      await loadListings()
      await loadMyListings()
      setSelected(prev => ({ ...prev, ...editForm, price: parseFloat(editForm.price), photos: editPhotoUrls }))
      setEditing(false)
      showToast('Listing updated')
    } else {
      showToast(error.message, 'error')
    }
    setSaving(false)
  }

  async function createListing() {
    if (!form.title || !form.price) { showToast('Title and price are required', 'error'); return }
    setSaving(true)
    const payload = {
      creative_id: user.id,
      title: form.title,
      category: form.category,
      condition: form.condition,
      price: parseFloat(form.price),
      description: form.description || null,
      location: form.location || null,
      open_to_swaps: form.open_to_swaps,
      status: 'active',
      photos: photoUrls,
    }
    console.log('Creating listing:', payload)
    const { data, error } = await supabase.from('marketplace_listings').insert(payload).select()
    console.log('Result:', data, error)
    if (!error) {
      await loadListings()
      await loadMyListings()
      closeCreateModal()
      setForm({ title: '', category: 'Camera Bodies', condition: 'Good', price: '', description: '', location: '', open_to_swaps: false })
      showToast('Listing posted')
    } else {
      showToast(error.message, 'error')
    }
    setSaving(false)
  }

  async function deleteListing(id) {
    if (!window.confirm('Delete this listing?')) return
    await supabase.from('marketplace_listings').delete().eq('id', id)
    setMyListings(prev => prev.filter(l => l.id !== id))
    setListings(prev => prev.filter(l => l.id !== id))
    if (selected?.id === id) {
      setSelected(null)
      setEditing(false)
    }
    showToast('Listing deleted')
  }

  async function toggleSave(listingId, e) {
    e.stopPropagation()
    if (savedIds.has(listingId)) {
      await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', listingId)
      setSavedIds(prev => { const next = new Set(prev); next.delete(listingId); return next })
      setSavedListings(prev => prev.filter(l => l.id !== listingId))
    } else {
      await supabase.from('saved_listings').insert({ user_id: user.id, listing_id: listingId })
      setSavedIds(prev => new Set([...prev, listingId]))
      await loadSaved()
    }
  }

  async function contactSeller() {
    if (!contactMessage.trim() || !selected || !user?.id) return
    setSendingContact(true)
    try {
      const subject = `Marketplace: ${selected.title}`
      const isCreative = !!profile

      let existingQuery = supabase
        .from('message_threads')
        .select('id')
        .eq('creative_id', selected.creative_id)
        .eq('subject', subject)

      if (isCreative) {
        existingQuery = existingQuery.eq('client_email', user.email ?? '')
      } else {
        existingQuery = existingQuery.eq('client_user_id', user.id)
      }

      const { data: existingThread } = await existingQuery.maybeSingle()

      let threadId = existingThread?.id

      if (!threadId) {
        const { data: thread } = await supabase.from('message_threads').insert({
          creative_id: selected.creative_id,
          client_user_id: user.id,
          client_name: profile?.business_name ?? user.email,
          client_email: user.email,
          subject,
        }).select().single()
        threadId = thread?.id
      }

      if (!threadId) {
        showToast('Could not create message thread', 'error')
        return
      }

      const msgRow = {
        thread_id: threadId,
        sender_type: 'client',
        sender_name: profile?.business_name ?? user.email,
        body: contactMessage.trim(),
      }
      if (isCreative) {
        msgRow.creative_id = user.id
      }

      await supabase.from('messages').insert(msgRow)

      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('business_email, business_name')
        .eq('id', selected.creative_id)
        .maybeSingle()

      if (sellerProfile?.business_email) {
        await supabase.functions.invoke('send-message-notification', {
          body: {
            to: sellerProfile.business_email,
            toName: sellerProfile.business_name ?? 'there',
            fromName: profile?.business_name ?? user.email,
            subject: `New message about your listing: ${selected.title}`,
            messageBody: contactMessage.trim(),
            threadSubject: subject,
          },
        })
      }

      setContactMessage('')
      setShowContactSeller(false)
      showToast('Message sent to seller')
    } catch (err) {
      showToast('Failed to send: ' + err.message, 'error')
    }
    setSendingContact(false)
  }

  const filtered = listings.filter(l => {
    const matchSearch = l.title?.toLowerCase().includes(search.toLowerCase()) || l.description?.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'All' || l.category === filterCat
    return matchSearch && matchCat
  })

  const s = {
    page: { padding: '32px 40px', fontFamily: 'var(--font-ui)' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 },
    tabs: { display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', marginBottom: '20px' },
    tab: (active) => ({ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'var(--bg-base)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s', fontFamily: 'var(--font-ui)' }),
    postBtn: { padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' },
    filters: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    searchInput: { flex: 1, minWidth: '200px', padding: '9px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' },
    select: { padding: '9px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-ui)', outline: 'none' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
    card: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '16px', cursor: 'pointer', position: 'relative', transition: 'border-color 0.15s' },
    cardTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' },
    cardPrice: { fontSize: '16px', fontWeight: 700, color: '#1DB954', marginBottom: '6px' },
    cardMeta: { fontSize: '12px', color: 'var(--text-muted)' },
    saveBtn: { position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '2px' },
    empty: { padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' },
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
    modalBox: { background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    modalHeader: { padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody: { padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' },
    label: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' },
    input: { width: '100%', padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    actions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' },
    cancelBtn: { padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  }

  return (
    <div style={s.page}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <div style={s.header}>
        <div style={s.title}>Marketplace</div>
        <button type="button" style={s.postBtn} onClick={() => setShowCreate(true)}>+ Post Listing</button>
      </div>

      <div style={s.tabs}>
        <button type="button" style={s.tab(tab === 'browse')} onClick={() => setTab('browse')}>Browse ({listings.length})</button>
        <button type="button" style={s.tab(tab === 'my')} onClick={() => setTab('my')}>My Listings ({myListings.length})</button>
        <button type="button" style={s.tab(tab === 'saved')} onClick={() => setTab('saved')}>Saved ({savedListings.length})</button>
      </div>

      {tab === 'browse' && (
        <>
          <div style={s.filters}>
            <input style={s.searchInput} placeholder="Search listings…" value={search} onChange={e => setSearch(e.target.value)} />
            <select style={s.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {filtered.length === 0
            ? <div style={s.empty}>No listings found.</div>
            : <div style={s.grid}>{filtered.map(l => (
              <div
                key={l.id}
                style={s.card}
                onClick={() => setSelected(l)}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#1DB954'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
              >
                <button type="button" style={{ ...s.saveBtn, color: savedIds.has(l.id) ? '#1DB954' : 'var(--text-muted)' }} onClick={e => toggleSave(l.id, e)}>
                  {savedIds.has(l.id) ? '★' : '☆'}
                </button>
                {l.photos?.[0] && <img src={l.photos[0]} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />}
                <div style={s.cardPrice}>AUD {Number(l.price).toFixed(2)}</div>
                <div style={s.cardTitle}>{l.title}</div>
                <div style={s.cardMeta}>{l.category} · {l.condition}</div>
                {l.location && <div style={s.cardMeta}>{l.location}</div>}
                {l.open_to_swaps && <div style={{ fontSize: '11px', color: '#a855f7', marginTop: '6px', fontWeight: 600 }}>Open to swaps</div>}
              </div>
            ))}</div>
          }
        </>
      )}

      {tab === 'my' && (
        myListings.length === 0
          ? <div style={s.empty}>{"You haven't posted any listings yet."}</div>
          : <div style={s.grid}>
              {myListings.map(l => (
                <div key={l.id} style={{ position: 'relative' }}>
                  <div
                    style={s.card}
                    onClick={() => setSelected(l)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#1DB954'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                  >
                    {l.photos?.[0] && <img src={l.photos[0]} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />}
                    <div style={s.cardPrice}>AUD {Number(l.price).toFixed(2)}</div>
                    <div style={s.cardTitle}>{l.title}</div>
                    <div style={s.cardMeta}>{l.category} · {l.condition}</div>
                    {l.location && <div style={s.cardMeta}>{l.location}</div>}
                    {l.open_to_swaps && <div style={{ fontSize: '11px', color: '#a855f7', marginTop: '6px', fontWeight: 600 }}>Open to swaps</div>}
                  </div>
                  {l.creative_id === user?.id && (
                    <button type="button" onClick={() => deleteListing(l.id)} style={{ position: 'absolute', bottom: '10px', right: '10px', padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                  )}
                </div>
              ))}
            </div>
      )}

      {tab === 'saved' && (
        savedListings.length === 0
          ? <div style={s.empty}>No saved listings yet. Browse and click ☆ to save listings.</div>
          : <div style={s.grid}>{savedListings.map(l => (
            <div
              key={l.id}
              style={s.card}
              onClick={() => setSelected(l)}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#1DB954'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            >
              <button type="button" style={{ ...s.saveBtn, color: savedIds.has(l.id) ? '#1DB954' : 'var(--text-muted)' }} onClick={e => toggleSave(l.id, e)}>
                {savedIds.has(l.id) ? '★' : '☆'}
              </button>
              {l.photos?.[0] && <img src={l.photos[0]} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />}
              <div style={s.cardPrice}>AUD {Number(l.price).toFixed(2)}</div>
              <div style={s.cardTitle}>{l.title}</div>
              <div style={s.cardMeta}>{l.category} · {l.condition}</div>
              {l.location && <div style={s.cardMeta}>{l.location}</div>}
              {l.open_to_swaps && <div style={{ fontSize: '11px', color: '#a855f7', marginTop: '6px', fontWeight: 600 }}>Open to swaps</div>}
            </div>
          ))}</div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Post a Listing</span>
              <button type="button" onClick={closeCreateModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div>
                <label style={s.label}>Title *</label>
                <input style={s.input} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Sony A7III Body" />
              </div>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Category</label>
                  <select style={{ ...s.input }} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Condition</label>
                  <select style={{ ...s.input }} value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Price (AUD) *</label>
                  <input type="number" style={s.input} value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label style={s.label}>Location</label>
                  <input style={s.input} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Brisbane, QLD" />
                </div>
              </div>
              <div>
                <label style={s.label}>Description</label>
                <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the item, include any accessories..." />
              </div>
              <div>
                <label style={s.label}>Photos (optional, up to 5)</label>
                <div
                  style={{ border: '2px dashed var(--border-default)', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => document.getElementById('marketplace-photo-input')?.click()}
                >
                  {uploadingPhotos ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Uploading...</div>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click to add photos</div>
                  )}
                  <input
                    id="marketplace-photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => {
                      const picked = Array.from(e.target.files || []).slice(0, 5 - photoUrls.length)
                      setPhotoFiles(picked)
                      uploadPhotos(picked)
                      e.target.value = ''
                    }}
                  />
                </div>
                {photoUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {photoUrls.map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={url} alt="" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-default)' }} />
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setPhotoUrls(prev => prev.filter((_, j) => j !== i)) }}
                          style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '18px', height: '18px', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                <input type="checkbox" checked={form.open_to_swaps} onChange={e => setForm(p => ({ ...p, open_to_swaps: e.target.checked }))} />
                Open to swaps
              </label>
            </div>
            <div style={s.actions}>
              <button type="button" style={s.cancelBtn} onClick={closeCreateModal}>Cancel</button>
              <button type="button" style={{ ...s.postBtn, opacity: saving || !form.title || !form.price ? 0.5 : 1 }} disabled={saving || !form.title || !form.price} onClick={createListing}>
                {saving ? 'Posting…' : 'Post Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View / Edit Listing Modal */}
      {selected && (
        <div style={s.modal}>
          <div style={{ ...s.modalBox, maxWidth: '520px' }}>
            <div style={s.modalHeader}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editing ? 'Edit Listing' : selected.title}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selected?.creative_id === user?.id && !editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true)
                      setEditForm({
                        title: selected.title,
                        category: selected.category,
                        condition: selected.condition,
                        price: String(selected.price),
                        description: selected.description ?? '',
                        location: selected.location ?? '',
                        open_to_swaps: selected.open_to_swaps ?? false,
                      })
                      setEditPhotoUrls(selected.photos ?? [])
                    }}
                    style={{ padding: '6px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                  >✎ Edit</button>
                )}
                <button type="button" onClick={() => { setSelected(null); setEditing(false) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!editing ? (
                <>
                  {selected.photos?.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                      {selected.photos.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          onClick={e => { e.stopPropagation(); setLightbox(url) }}
                          style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, cursor: 'zoom-in', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#1DB954' }}>AUD {Number(selected.price).toFixed(2)}</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', background: 'var(--bg-base)', borderRadius: '999px', fontSize: '12px', color: 'var(--text-muted)' }}>{selected.category}</span>
                    <span style={{ padding: '4px 10px', background: 'var(--bg-base)', borderRadius: '999px', fontSize: '12px', color: 'var(--text-muted)' }}>{selected.condition}</span>
                    {selected.open_to_swaps && <span style={{ padding: '4px 10px', background: 'rgba(168,85,247,0.1)', borderRadius: '999px', fontSize: '12px', color: '#a855f7', fontWeight: 600 }}>Open to swaps</span>}
                  </div>
                  {selected.location && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>📍 {selected.location}</div>}
                  {selected.description && <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selected.description}</div>}
                </>
              ) : (
                <>
                  <div>
                    <label style={s.label}>Title *</label>
                    <input style={s.input} value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div style={s.grid2}>
                    <div>
                      <label style={s.label}>Category</label>
                      <select style={{ ...s.input }} value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Condition</label>
                      <select style={{ ...s.input }} value={editForm.condition} onChange={e => setEditForm(p => ({ ...p, condition: e.target.value }))}>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={s.grid2}>
                    <div>
                      <label style={s.label}>Price (AUD) *</label>
                      <input type="number" style={s.input} value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} />
                    </div>
                    <div>
                      <label style={s.label}>Location</label>
                      <input style={s.input} value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Description</label>
                    <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div>
                    <label style={s.label}>Photos</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {editPhotoUrls.map((url, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={url} alt="" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-default)' }} />
                          <button type="button" onClick={() => setEditPhotoUrls(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '18px', height: '18px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                      {editPhotoUrls.length < 5 && (
                        <div
                          onClick={() => document.getElementById('edit-photo-input')?.click()}
                          style={{ width: '72px', height: '72px', border: '2px dashed var(--border-default)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', color: 'var(--text-muted)' }}
                        >+</div>
                      )}
                      <input
                        id="edit-photo-input"
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                          const picked = Array.from(e.target.files || []).slice(0, 5 - editPhotoUrls.length)
                          uploadEditPhotos(picked)
                          e.target.value = ''
                        }}
                      />
                    </div>
                    {uploadingEditPhotos && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Uploading...</div>}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                    <input type="checkbox" checked={editForm.open_to_swaps} onChange={e => setEditForm(p => ({ ...p, open_to_swaps: e.target.checked }))} />
                    Open to swaps
                  </label>
                </>
              )}
            </div>

            <div style={s.actions}>
              {editing ? (
                <>
                  <button type="button" style={s.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
                  <button type="button" style={{ ...s.postBtn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={saveEdit}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  {selected?.creative_id !== user?.id && !editing && (
                    <button
                      type="button"
                      onClick={() => setShowContactSeller(true)}
                      style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                    >
                      💬 Contact Seller
                    </button>
                  )}
                  {selected?.creative_id === user?.id && (
                    <button type="button" onClick={() => deleteListing(selected.id)} style={{ padding: '9px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Delete</button>
                  )}
                  <button type="button" style={s.cancelBtn} onClick={() => { setSelected(null); setEditing(false) }}>Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showContactSeller && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '16px', width: '100%', maxWidth: '460px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Contact Seller</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>About: {selected.title}</div>
            <textarea
              value={contactMessage}
              onChange={e => setContactMessage(e.target.value)}
              placeholder="Hi, I'm interested in your listing. Is it still available?"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box', outline: 'none', minHeight: '100px', resize: 'vertical', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setShowContactSeller(false); setContactMessage('') }} style={{ padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Cancel</button>
              <button
                type="button"
                onClick={() => void contactSeller()}
                disabled={sendingContact || !contactMessage.trim()}
                style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: sendingContact || !contactMessage.trim() ? 0.5 : 1 }}
              >
                {sendingContact ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out' }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}
          >✕</button>
          <img
            src={lightbox}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}
    </div>
  )
}
