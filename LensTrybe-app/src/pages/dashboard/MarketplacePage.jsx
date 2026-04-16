import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

const CATEGORIES = ['Camera Bodies', 'Lenses', 'Lighting', 'Audio', 'Drones & Accessories', 'Editing Hardware', 'Bags & Tripods', 'Miscellaneous']
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair']
const LIMITS = { basic: 0, pro: 5, expert: 15, elite: 999 }

export default function MarketplacePage() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const [listings, setListings] = useState([])
  const [allListings, setAllListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('browse')
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const limit = LIMITS[tier] ?? 0
  const myListings = listings.filter(l => l.creative_id === user?.id)

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    condition: 'Good',
    category: 'Camera Bodies',
    location: '',
    open_to_swap: false,
  })

  useEffect(() => { loadListings() }, [user])

  async function loadListings() {
    if (!user) return
    const { data } = await supabase
      .from('marketplace_listings')
      .select('*')
      .order('created_at', { ascending: false })
    setAllListings(data ?? [])
    setListings(data ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ title: '', description: '', price: '', condition: 'Good', category: 'Camera Bodies', location: '', open_to_swap: false })
  }

  async function createListing() {
    if (myListings.length >= limit) return
    setSaving(true)
    await supabase.from('marketplace_listings').insert({
      creative_id: user.id,
      title: form.title,
      description: form.description,
      price: parseFloat(form.price) || 0,
      condition: form.condition,
      category: form.category,
      location: form.location,
      open_to_swap: form.open_to_swap,
      status: 'active',
    })
    await loadListings()
    setShowCreate(false)
    resetForm()
    setSaving(false)
  }

  async function deleteListing(id) {
    await supabase.from('marketplace_listings').delete().eq('id', id)
    await loadListings()
    setShowView(null)
  }

  const filtered = allListings.filter(l =>
    (!categoryFilter || l.category === categoryFilter)
  )

  const conditionVariant = (c) => {
    if (c === 'New') return 'green'
    if (c === 'Like New') return 'info'
    if (c === 'Good') return 'default'
    return 'warning'
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tabs: { display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', width: 'fit-content' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400 }),
    toolbar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    select: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
    card: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'border-color var(--transition-fast)' },
    cardTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    cardPrice: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--green)' },
    cardMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
    cardDesc: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    cardLocation: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    label: { fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' },
    textarea: { width: '100%', minHeight: '80px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    toggle: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
    toggleTrack: (on) => ({ width: '40px', height: '22px', borderRadius: 'var(--radius-full)', background: on ? 'var(--green)' : 'var(--border-strong)', position: 'relative', transition: 'background var(--transition-base)', flexShrink: 0 }),
    toggleThumb: (on) => ({ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left var(--transition-base)' }),
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    myListingsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    limitNote: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Marketplace</h1>
          <p style={styles.subtitle}>Buy, swap and sell photography and video gear with other creatives.</p>
        </div>
        {tab === 'my-listings' && limit > 0 && (
          <Button variant="primary" disabled={myListings.length >= limit} onClick={() => setShowCreate(true)}>
            + Post Listing
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={styles.tabs}>
          <button style={styles.tab(tab === 'browse')} onClick={() => setTab('browse')}>Browse All</button>
          <button style={styles.tab(tab === 'my-listings')} onClick={() => setTab('my-listings')}>My Listings ({myListings.length})</button>
        </div>
        {tab === 'browse' && (
          <select style={styles.select} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {tab === 'browse' ? (
        loading ? (
          <div style={styles.emptyState}>Loading listings…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>No listings yet. Be the first to post gear for sale.</div>
        ) : (
          <div style={styles.grid}>
            {filtered.map(listing => (
              <div
                key={listing.id}
                style={styles.card}
                onClick={() => setShowView(listing)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
              >
                <div style={styles.cardTitle}>{listing.title}</div>
                <div style={styles.cardPrice}>${listing.price?.toLocaleString()}</div>
                <div style={styles.cardMeta}>
                  <Badge variant={conditionVariant(listing.condition)} size="sm">{listing.condition}</Badge>
                  <Badge variant="default" size="sm">{listing.category}</Badge>
                  {listing.open_to_swap && <Badge variant="info" size="sm">Open to swap</Badge>}
                </div>
                {listing.description && <div style={styles.cardDesc}>{listing.description}</div>}
                {listing.location && <div style={styles.cardLocation}>📍 {listing.location}</div>}
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={styles.myListingsHeader}>
            <div style={styles.limitNote}>
              {limit === 0 ? 'Upgrade to Pro or above to post listings.' : `${myListings.length} / ${limit === 999 ? '∞' : limit} active listings`}
            </div>
          </div>
          {myListings.length === 0 ? (
            <div style={styles.emptyState}>
              {limit === 0 ? 'Upgrade your plan to post gear for sale.' : 'You have no active listings. Post your first one.'}
            </div>
          ) : (
            <div style={styles.grid}>
              {myListings.map(listing => (
                <div
                  key={listing.id}
                  style={styles.card}
                  onClick={() => setShowView(listing)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                >
                  <div style={styles.cardTitle}>{listing.title}</div>
                  <div style={styles.cardPrice}>${listing.price?.toLocaleString()}</div>
                  <div style={styles.cardMeta}>
                    <Badge variant={conditionVariant(listing.condition)} size="sm">{listing.condition}</Badge>
                    <Badge variant="default" size="sm">{listing.category}</Badge>
                  </div>
                  {listing.description && <div style={styles.cardDesc}>{listing.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title="Post a Listing" size="lg">
        <div style={styles.formSection}>
          <Input label="Title" placeholder="Sony A7III Body — Excellent condition" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <div style={styles.formRow}>
            <div>
              <label style={styles.label}>Category</label>
              <select style={{ ...styles.select, width: '100%' }} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Condition</label>
              <select style={{ ...styles.select, width: '100%' }} value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formRow}>
            <Input label="Price (AUD)" type="number" placeholder="1200" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
            <Input label="Location" placeholder="Brisbane, QLD" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
          </div>
          <div>
            <label style={styles.label}>Description</label>
            <textarea style={styles.textarea} placeholder="Describe the item, what's included, any flaws…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div style={styles.toggle} onClick={() => setForm(p => ({ ...p, open_to_swap: !p.open_to_swap }))}>
            <div style={styles.toggleTrack(form.open_to_swap)}>
              <div style={styles.toggleThumb(form.open_to_swap)} />
            </div>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>Open to swaps</span>
          </div>
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" disabled={saving || !form.title || !form.price} onClick={createListing}>
              {saving ? 'Posting…' : 'Post Listing'}
            </Button>
          </div>
        </div>
      </Modal>

      {showView && (
        <Modal isOpen={!!showView} onClose={() => setShowView(null)} title={showView.title} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--green)' }}>${showView.price?.toLocaleString()}</div>
            <div style={styles.viewGrid}>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Category</div>
                <div style={styles.viewValue}>{showView.category}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Condition</div>
                <Badge variant={conditionVariant(showView.condition)}>{showView.condition}</Badge>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Location</div>
                <div style={styles.viewValue}>{showView.location || '—'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Swap</div>
                <div style={styles.viewValue}>{showView.open_to_swap ? 'Open to swaps' : 'Not swapping'}</div>
              </div>
            </div>
            {showView.description && (
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Description</div>
                <div style={{ ...styles.viewValue, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{showView.description}</div>
              </div>
            )}
            <div style={styles.modalActions}>
              {showView.creative_id === user?.id && (
                <Button variant="danger" size="sm" onClick={() => deleteListing(showView.id)}>Delete Listing</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
