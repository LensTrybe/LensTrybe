import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatClientAccountDisplayName } from '../../lib/clientDisplayName'
import {
  MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE,
  messageBodyContainsContactDetails,
  threadOwnerTierContactSharingRestricted,
} from '../../lib/messagingContactPolicy'
import { useAuth } from '../../context/AuthContext'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const PURPLE = '#a855f7'

const CATEGORIES = ['Camera Bodies', 'Lenses', 'Lighting', 'Audio', 'Drones', 'Editing Hardware', 'Bags & Tripods', 'Miscellaneous']
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']

function ListingCard({ l, showSave, saved, onSelect, onToggleSave }) {
  return (
    <div className="ltm-card" onClick={onSelect}>
      {showSave && (
        <button type="button" onClick={onToggleSave} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: 999, width: 30, height: 30, fontSize: 15, cursor: 'pointer', color: saved ? GREEN : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {saved ? '★' : '☆'}
        </button>
      )}
      {l.photos?.[0] && <img src={l.photos[0]} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />}
      <div style={{ fontSize: 16, fontWeight: 800, color: GREEN, marginBottom: 4 }}>AUD {Number(l.price).toFixed(2)}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 3 }}>{l.title}</div>
      <div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>{l.category} · {l.condition}</div>
      {l.location && <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 2 }}>{l.location}</div>}
      {l.open_to_swaps && <div style={{ fontSize: 11, color: PURPLE, marginTop: 6, fontWeight: 600 }}>Open to swaps</div>}
    </div>
  )
}

function StyleBlock() {
  return (
    <style>{`
      .ltm-page { display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
      .ltm-input, .ltm-select { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 14px; color: var(--lt-text); background: var(--lt-input-bg); border: 1px solid var(--lt-input-border); border-radius: 9px; padding: 10px 12px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
      .ltm-input:focus, .ltm-select:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      textarea.ltm-input { resize: vertical; line-height: 1.55; }
      .ltm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltm-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltm-btn-primary:hover { filter: brightness(1.06); }
      .ltm-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltm-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltm-btn:disabled { opacity: 0.5; cursor: default; }
      .ltm-chip { padding: 7px 15px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); }
      .ltm-chip.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltm-card { background: var(--lt-glass-bg); border: var(--lt-glass-border); box-shadow: var(--lt-glass-shadow); backdrop-filter: var(--lt-glass-blur); -webkit-backdrop-filter: var(--lt-glass-blur); border-radius: 16px; padding: 14px; cursor: pointer; position: relative; transition: transform .12s ease; }
      .ltm-card:hover { transform: translateY(-2px); }
      .ltm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .ltm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltm-modal { width: 100%; max-width: 560px; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); }
      .ltm-mhead { padding: 16px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .ltm-mbody { padding: 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
      .ltm-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 22px; border-top: 1px solid var(--lt-hairline); }
      .ltm-label { font-size: 12px; font-weight: 600; color: var(--lt-faint); display: block; margin-bottom: 5px; }
      .ltm-tag { padding: 4px 11px; border-radius: 999px; font-size: 12px; background: var(--lt-surface-2); color: var(--lt-muted); }
      @media (max-width: 767px) {
        .ltm-grid { grid-template-columns: 1fr; }
        .ltm-overlay { padding: 0; }
        .ltm-modal { max-width: 100vw; max-height: 100vh; height: 100vh; border-radius: 0; }
        .ltm-page button { min-height: 40px; }
      }
    `}</style>
  )
}

export default function MarketplacePage() {
  const { user, profile, clientAccount } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
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
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function closeCreateModal() {
    setShowCreate(false); setPhotoUrls([]); setPhotoFiles([])
  }

  async function loadListings() {
    const { data } = await supabase.from('marketplace_listings').select('*').eq('status', 'active').order('created_at', { ascending: false })
    const raw = data ?? []
    const sellerIds = [...new Set(raw.map((l) => l.creative_id).filter(Boolean))]
    let adminSellerIds = new Set()
    if (sellerIds.length > 0) {
      const { data: adminRows } = await supabase.from('profiles').select('id').in('id', sellerIds).eq('is_admin', true)
      adminSellerIds = new Set((adminRows ?? []).map((r) => r.id))
    }
    setListings(raw.filter((l) => !adminSellerIds.has(l.creative_id)))
  }

  async function loadMyListings() {
    const { data } = await supabase.from('marketplace_listings').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setMyListings(data ?? [])
  }

  async function loadSaved() {
    const { data } = await supabase.from('saved_listings').select('listing_id, marketplace_listings(*)').eq('user_id', user.id)
    const rows = data ?? []
    const listings = rows.map((s) => s.marketplace_listings).filter(Boolean)
    const sellerIds = [...new Set(listings.map((l) => l.creative_id).filter(Boolean))]
    let adminSellerIds = new Set()
    if (sellerIds.length > 0) {
      const { data: adminRows } = await supabase.from('profiles').select('id').in('id', sellerIds).eq('is_admin', true)
      adminSellerIds = new Set((adminRows ?? []).map((r) => r.id))
    }
    const kept = rows.filter((s) => s.marketplace_listings && !adminSellerIds.has(s.marketplace_listings.creative_id))
    setSavedIds(new Set(kept.map((s) => s.listing_id)))
    setSavedListings(kept.map((s) => s.marketplace_listings).filter(Boolean))
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
      title: editForm.title, category: editForm.category, condition: editForm.condition,
      price: parseFloat(editForm.price), description: editForm.description || null,
      location: editForm.location || null, open_to_swaps: editForm.open_to_swaps, photos: editPhotoUrls,
    }).eq('id', selected.id)
    if (!error) {
      await loadListings(); await loadMyListings()
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
      creative_id: user.id, title: form.title, category: form.category, condition: form.condition,
      price: parseFloat(form.price), description: form.description || null, location: form.location || null,
      open_to_swaps: form.open_to_swaps, status: 'active', photos: photoUrls,
    }
    const { error } = await supabase.from('marketplace_listings').insert(payload).select()
    if (!error) {
      await loadListings(); await loadMyListings()
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
    if (selected?.id === id) { setSelected(null); setEditing(false) }
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
      const { data: sellerRow } = await supabase.from('profiles').select('subscription_tier, business_email, business_name').eq('id', selected.creative_id).eq('is_admin', false).maybeSingle()
      if (threadOwnerTierContactSharingRestricted(sellerRow?.subscription_tier) && messageBodyContainsContactDetails(contactMessage.trim())) {
        showToast(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE, 'error')
        setSendingContact(false)
        return
      }
      const subject = `Marketplace: ${selected.title}`
      const isCreative = !!profile
      const buyerDisplayName = formatClientAccountDisplayName(clientAccount) || profile?.business_name || user.email
      let existingQuery = supabase.from('message_threads').select('id').eq('creative_id', selected.creative_id).eq('subject', subject)
      if (isCreative) existingQuery = existingQuery.eq('client_email', user.email ?? '')
      else existingQuery = existingQuery.eq('client_user_id', user.id)
      const { data: existingThread } = await existingQuery.maybeSingle()
      let threadId = existingThread?.id
      if (!threadId) {
        const { data: thread } = await supabase.from('message_threads').insert({
          creative_id: selected.creative_id, client_user_id: user.id, client_name: buyerDisplayName, client_email: user.email, subject,
        }).select().single()
        threadId = thread?.id
      }
      if (!threadId) { showToast('Could not create message thread', 'error'); return }
      const msgRow = { thread_id: threadId, sender_type: 'client', sender_name: buyerDisplayName, body: contactMessage.trim() }
      if (isCreative) msgRow.creative_id = user.id
      await supabase.from('messages').insert(msgRow)
      if (sellerRow?.business_email) {
        await supabase.functions.invoke('send-message-notification', {
          body: {
            to: sellerRow.business_email, toName: sellerRow.business_name ?? 'there',
            fromName: buyerDisplayName, subject: `New message about your listing: ${selected.title}`,
            messageBody: contactMessage.trim(), threadSubject: subject,
          },
        })
      }
      setContactMessage(''); setShowContactSeller(false)
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

  const tabs = [
    { key: 'browse', label: `Browse (${listings.length})` },
    { key: 'my', label: `My listings (${myListings.length})` },
    { key: 'saved', label: `Saved (${savedListings.length})` },
  ]

  return (
    <>
      <StyleBlock />
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : '#ef4444', color: toast.type === 'success' ? GREEN_DARK : '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 10px 30px -8px rgba(0,0,0,0.4)' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <div className="ltm-page">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Marketplace</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Buy, sell and swap gear with other creatives.</p>
          </div>
          <button type="button" className="ltm-btn ltm-btn-primary" onClick={() => setShowCreate(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Post listing
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map((t) => <button key={t.key} type="button" className={`ltm-chip${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>

        {tab === 'browse' && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input className="ltm-input" style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }} placeholder="Search listings…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="ltm-select" style={{ flex: isMobile ? '1 1 100%' : '0 0 220px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="All">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {filtered.length === 0
              ? <div style={{ padding: '60px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No listings found.</div>
              : <div className="ltm-grid">{filtered.map(l => <ListingCard key={l.id} l={l} showSave saved={savedIds.has(l.id)} onSelect={() => setSelected(l)} onToggleSave={(e) => toggleSave(l.id, e)} />)}</div>}
          </>
        )}

        {tab === 'my' && (
          myListings.length === 0
            ? <div style={{ padding: '60px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>You haven&apos;t posted any listings yet.</div>
            : <div className="ltm-grid">{myListings.map(l => (
              <div key={l.id} style={{ position: 'relative' }}>
                <ListingCard l={l} showSave={false} saved={false} onSelect={() => setSelected(l)} onToggleSave={() => {}} />
                {l.creative_id === user?.id && (
                  <button type="button" onClick={() => deleteListing(l.id)} style={{ position: 'absolute', bottom: 12, right: 12, padding: '4px 10px', background: 'rgba(255,45,120,0.14)', border: '1px solid rgba(255,45,120,0.4)', borderRadius: 8, color: PINK, fontSize: 11, cursor: 'pointer' }}>Delete</button>
                )}
              </div>
            ))}</div>
        )}

        {tab === 'saved' && (
          savedListings.length === 0
            ? <div style={{ padding: '60px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No saved listings yet. Browse and tap ☆ to save.</div>
            : <div className="ltm-grid">{savedListings.map(l => <ListingCard key={l.id} l={l} showSave saved={savedIds.has(l.id)} onSelect={() => setSelected(l)} onToggleSave={(e) => toggleSave(l.id, e)} />)}</div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="ltm-overlay">
          <div className="ltm-modal">
            <div className="ltm-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>Post a listing</span>
              <button type="button" onClick={closeCreateModal} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltm-mbody">
              <div><label className="ltm-label">Title *</label><input className="ltm-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Sony A7III body" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div><label className="ltm-label">Category</label><select className="ltm-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="ltm-label">Condition</label><select className="ltm-select" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div><label className="ltm-label">Price (AUD) *</label><input type="number" className="ltm-input" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" /></div>
                <div><label className="ltm-label">Location</label><input className="ltm-input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Brisbane, QLD" /></div>
              </div>
              <div><label className="ltm-label">Description</label><textarea className="ltm-input" style={{ minHeight: 80 }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the item, include any accessories…" /></div>
              <div>
                <label className="ltm-label">Photos (optional, up to 5)</label>
                <div style={{ border: '2px dashed var(--lt-border)', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer' }} onClick={() => document.getElementById('marketplace-photo-input')?.click()}>
                  <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>{uploadingPhotos ? 'Uploading…' : 'Click to add photos'}</div>
                  <input id="marketplace-photo-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { const picked = Array.from(e.target.files || []).slice(0, 5 - photoUrls.length); setPhotoFiles(picked); uploadPhotos(picked); e.target.value = '' }} />
                </div>
                {photoUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {photoUrls.map((url, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--lt-border)' }} />
                        <button type="button" onClick={e => { e.stopPropagation(); setPhotoUrls(prev => prev.filter((_, j) => j !== i)) }} style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', fontSize: 10, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--lt-muted)' }}>
                <input type="checkbox" checked={form.open_to_swaps} onChange={e => setForm(p => ({ ...p, open_to_swaps: e.target.checked }))} />
                Open to swaps
              </label>
            </div>
            <div className="ltm-actions">
              <button type="button" className="ltm-btn ltm-btn-ghost" onClick={closeCreateModal}>Cancel</button>
              <button type="button" className="ltm-btn ltm-btn-primary" disabled={saving || !form.title || !form.price} onClick={createListing}>{saving ? 'Posting…' : 'Post listing'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View / edit modal */}
      {selected && (
        <div className="ltm-overlay">
          <div className="ltm-modal" style={{ maxWidth: 520 }}>
            <div className="ltm-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{editing ? 'Edit listing' : selected.title}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {selected?.creative_id === user?.id && !editing && (
                  <button type="button" className="ltm-btn ltm-btn-ghost" onClick={() => { setEditing(true); setEditForm({ title: selected.title, category: selected.category, condition: selected.condition, price: String(selected.price), description: selected.description ?? '', location: selected.location ?? '', open_to_swaps: selected.open_to_swaps ?? false }); setEditPhotoUrls(selected.photos ?? []) }}>Edit</button>
                )}
                <button type="button" onClick={() => { setSelected(null); setEditing(false) }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            <div className="ltm-mbody">
              {!editing ? (
                <>
                  {selected.photos?.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                      {selected.photos.map((url, i) => (
                        <img key={i} src={url} alt="" onClick={e => { e.stopPropagation(); setLightbox(url) }} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, flexShrink: 0, cursor: 'zoom-in' }} />
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 28, fontWeight: 800, color: GREEN }}>AUD {Number(selected.price).toFixed(2)}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="ltm-tag">{selected.category}</span>
                    <span className="ltm-tag">{selected.condition}</span>
                    {selected.open_to_swaps && <span style={{ padding: '4px 11px', background: 'rgba(168,85,247,0.14)', borderRadius: 999, fontSize: 12, color: PURPLE, fontWeight: 600 }}>Open to swaps</span>}
                  </div>
                  {selected.location && <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>{selected.location}</div>}
                  {selected.description && <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.6 }}>{selected.description}</div>}
                </>
              ) : (
                <>
                  <div><label className="ltm-label">Title *</label><input className="ltm-input" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div><label className="ltm-label">Category</label><select className="ltm-select" value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="ltm-label">Condition</label><select className="ltm-select" value={editForm.condition} onChange={e => setEditForm(p => ({ ...p, condition: e.target.value }))}>{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div><label className="ltm-label">Price (AUD) *</label><input type="number" className="ltm-input" value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} /></div>
                    <div><label className="ltm-label">Location</label><input className="ltm-input" value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} /></div>
                  </div>
                  <div><label className="ltm-label">Description</label><textarea className="ltm-input" style={{ minHeight: 80 }} value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div>
                    <label className="ltm-label">Photos</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {editPhotoUrls.map((url, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--lt-border)' }} />
                          <button type="button" onClick={() => setEditPhotoUrls(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', fontSize: 10, cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                      {editPhotoUrls.length < 5 && (
                        <div onClick={() => document.getElementById('edit-photo-input')?.click()} style={{ width: 72, height: 72, border: '2px dashed var(--lt-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: 'var(--lt-muted)' }}>+</div>
                      )}
                      <input id="edit-photo-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { const picked = Array.from(e.target.files || []).slice(0, 5 - editPhotoUrls.length); uploadEditPhotos(picked); e.target.value = '' }} />
                    </div>
                    {uploadingEditPhotos && <div style={{ fontSize: 12, color: 'var(--lt-muted)' }}>Uploading…</div>}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--lt-muted)' }}>
                    <input type="checkbox" checked={editForm.open_to_swaps} onChange={e => setEditForm(p => ({ ...p, open_to_swaps: e.target.checked }))} />
                    Open to swaps
                  </label>
                </>
              )}
            </div>

            <div className="ltm-actions">
              {editing ? (
                <>
                  <button type="button" className="ltm-btn ltm-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="button" className="ltm-btn ltm-btn-primary" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save changes'}</button>
                </>
              ) : (
                <>
                  {selected?.creative_id !== user?.id && <button type="button" className="ltm-btn ltm-btn-primary" onClick={() => setShowContactSeller(true)}>Contact seller</button>}
                  {selected?.creative_id === user?.id && <button type="button" className="ltm-btn ltm-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => deleteListing(selected.id)}>Delete</button>}
                  <button type="button" className="ltm-btn ltm-btn-ghost" onClick={() => { setSelected(null); setEditing(false) }}>Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact seller */}
      {showContactSeller && selected && (
        <div className="ltm-overlay" style={{ zIndex: 2000 }}>
          <div className="ltm-modal" style={{ maxWidth: 460 }}>
            <div className="ltm-mbody">
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Contact seller</div>
              <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: -6 }}>About: {selected.title}</div>
              <textarea className="ltm-input" value={contactMessage} onChange={e => setContactMessage(e.target.value)} placeholder="Hi, I'm interested in your listing. Is it still available?" style={{ minHeight: 100 }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ltm-btn ltm-btn-ghost" onClick={() => { setShowContactSeller(false); setContactMessage('') }}>Cancel</button>
                <button type="button" className="ltm-btn ltm-btn-primary" onClick={() => void contactSeller()} disabled={sendingContact || !contactMessage.trim()}>{sendingContact ? 'Sending…' : 'Send message'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <button type="button" onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          <img src={lightbox} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </>
  )
}
