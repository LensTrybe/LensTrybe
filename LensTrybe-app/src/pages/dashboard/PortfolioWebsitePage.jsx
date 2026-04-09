import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const CATEGORIES = ['Wedding', 'Portrait', 'Commercial', 'Events', 'Landscape', 'Fashion', 'Street', 'Other']

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '#1e1e1e',
  inner: '#1a1a24',
  innerBorder: '#202027',
  muted: '#888',
  dim: '#555',
  green: '#39ff14',
  red: '#f87171',
}

const font = { fontFamily: 'Inter, sans-serif' }

function slugFromUser(user) {
  const email = user?.email
  if (email && email.includes('@')) {
    const local = email.split('@')[0] || ''
    const s = local.replace(/[^a-z0-9-]/gi, '').toLowerCase()
    if (s) return s
  }
  return user?.id ? String(user.id).replace(/-/g, '').slice(0, 12) : 'you'
}

export default function PortfolioWebsitePage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Wedding',
    tags: '',
    featured: false,
    image_url: '',
  })
  const [copied, setCopied] = useState(false)
  const [portfolioActive, setPortfolioActive] = useState(true)
  const [customDomain, setCustomDomain] = useState('')
  const [domainSaving, setDomainSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchItems = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('creative_id', user.id)
      .order('sort_order', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }, [user])

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data || null)
    if (data) {
      if (typeof data.portfolio_website_active === 'boolean') {
        setPortfolioActive(data.portfolio_website_active)
      } else {
        setPortfolioActive(true)
      }
      setCustomDomain(typeof data.portfolio_custom_domain === 'string' ? data.portfolio_custom_domain : '')
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    /* eslint-disable react-hooks/set-state-in-effect -- mount load */
    fetchItems()
    fetchProfile()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user, fetchItems, fetchProfile])

  const openNew = () => {
    setEditing(null)
    setForm({ title: '', description: '', category: 'Wedding', tags: '', featured: false, image_url: '' })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      title: item.title || '',
      description: item.description || '',
      category: item.category || 'Wedding',
      tags: (item.tags || []).join(', '),
      featured: item.featured || false,
      image_url: item.image_url || '',
    })
    setShowModal(true)
  }

  const uploadImage = async (file) => {
    setUploading(true)
    const path = `${user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('portfolio').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('portfolio').getPublicUrl(path)
      setForm((p) => ({ ...p, image_url: data.publicUrl }))
    }
    setUploading(false)
  }

  const saveItem = async () => {
    if (!form.title.trim()) return
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      creative_id: user.id,
      sort_order: editing ? editing.sort_order : items.length,
    }
    delete payload.tags_raw
    if (editing) {
      const { data } = await supabase.from('portfolio_items').update(payload).eq('id', editing.id).select().single()
      setItems((prev) => prev.map((i) => (i.id === editing.id ? data : i)))
    } else {
      const { data } = await supabase.from('portfolio_items').insert(payload).select().single()
      setItems((prev) => [...prev, data])
    }
    setShowModal(false)
  }

  const deleteItem = async (id) => {
    await supabase.from('portfolio_items').delete().eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setPendingDeleteId(null)
  }

  const portfolioUrl = `${window.location.origin}/portfolio/${user?.id || ''}`
  const defaultSubdomainHost = `${slugFromUser(user)}.lenstrybe.com`

  const copyLink = () => {
    navigator.clipboard.writeText(portfolioUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleSiteActive = async () => {
    const next = !portfolioActive
    setPortfolioActive(next)
    await supabase.from('profiles').update({ portfolio_website_active: next }).eq('id', user.id)
    fetchProfile()
  }

  const saveCustomDomain = async () => {
    if (!user?.id) return
    setDomainSaving(true)
    await supabase.from('profiles').update({ portfolio_custom_domain: customDomain.trim() }).eq('id', user.id)
    setDomainSaving(false)
    fetchProfile()
  }

  const isElite = String(profile?.subscription_tier || '').toLowerCase() === 'elite'

  const labelUpper = {
    display: 'block',
    color: PAGE.muted,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
    ...font,
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: PAGE.inner,
    border: `1px solid ${PAGE.innerBorder}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: '#aaa',
    fontSize: 14,
    outline: 'none',
    ...font,
  }

  return (
    <section
      style={{
        background: PAGE.bg,
        minHeight: '100vh',
        padding: 32,
        color: PAGE.text,
        ...font,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-block',
            marginBottom: 12,
            fontSize: 13,
            color: PAGE.green,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ← Back
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#fff' }}>Portfolio Website</h1>
            <p style={{ margin: 0, fontSize: 13, color: PAGE.muted }}>Manage your public portfolio presence</p>
          </div>
          <a
            href={portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: PAGE.green,
              textDecoration: 'none',
            }}
          >
            View Profile ↗
          </a>
        </div>

        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 12,
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Portfolio Website</div>
              <div style={{ fontSize: 12, color: PAGE.dim, marginTop: 4 }}>Visibility &amp; domain</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Active</span>
              <button
                type="button"
                role="switch"
                aria-checked={portfolioActive}
                onClick={() => user && toggleSiteActive()}
                disabled={!user}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  padding: 2,
                  background: portfolioActive ? PAGE.green : '#2a2a2a',
                  cursor: user ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: portfolioActive ? 'flex-end' : 'flex-start',
                  transition: 'background 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    flexShrink: 0,
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              marginBottom: 8,
              borderLeft: `3px solid ${PAGE.green}`,
              paddingLeft: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>Domain Setup</h2>
          </div>

          <label style={{ ...labelUpper, marginTop: 20 }}>Default Subdomain</label>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: PAGE.dim }}>Your default portfolio URL</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 24 }}>
            <input readOnly value={defaultSubdomainHost} style={{ ...inputStyle, flex: '1 1 200px', color: '#aaa', cursor: 'default' }} />
            <a
              href={portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#1e2a1e',
                border: `1px solid ${PAGE.green}`,
                color: PAGE.green,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Visit
            </a>
            <button
              type="button"
              onClick={copyLink}
              title="Copy portfolio link"
              aria-label="Copy link"
              style={{
                width: 44,
                height: 40,
                borderRadius: 8,
                border: `1px solid ${PAGE.innerBorder}`,
                background: PAGE.inner,
                color: PAGE.muted,
                cursor: 'pointer',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {copied ? '✓' : '⧉'}
            </button>
          </div>

          <label style={labelUpper}>Custom Domain (Elite)</label>
          {isElite ? (
            <>
              <input
                placeholder="portfolio.example.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                style={{ ...inputStyle, color: '#fff', marginBottom: 12 }}
              />
              <button
                type="button"
                onClick={saveCustomDomain}
                disabled={domainSaving || !user}
                style={{
                  background: PAGE.green,
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '9px 20px',
                  border: 'none',
                  fontSize: 14,
                  cursor: domainSaving ? 'wait' : 'pointer',
                  opacity: domainSaving ? 0.7 : 1,
                }}
              >
                {domainSaving ? 'Saving…' : 'Save Domain'}
              </button>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                background: PAGE.inner,
                border: `1px solid ${PAGE.innerBorder}`,
                borderRadius: 8,
                color: PAGE.muted,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 20 }} aria-hidden>
                🔒
              </span>
              Upgrade to Elite to connect a custom domain
            </div>
          )}

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${PAGE.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Portfolio works</span>
              <button
                type="button"
                onClick={openNew}
                style={{
                  background: 'transparent',
                  border: `1px solid ${PAGE.green}`,
                  color: PAGE.green,
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Add Work
              </button>
            </div>

            {loading ? (
              <p style={{ color: PAGE.dim, margin: 0 }}>Loading…</p>
            ) : items.length === 0 ? (
              <p style={{ color: PAGE.dim, margin: 0, fontSize: 13 }}>No portfolio items yet. Add work to show on your public portfolio.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((item) => {
                  const urlLine = item.image_url || item.title || '—'
                  const active = !!item.featured
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: PAGE.inner,
                        border: `1px solid ${PAGE.innerBorder}`,
                        borderRadius: 10,
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: '#fff',
                            fontSize: 14,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={urlLine}
                        >
                          {urlLine}
                        </div>
                        <div style={{ fontSize: 12, color: PAGE.muted, marginTop: 4 }}>{item.title || 'Untitled'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            border: `1px solid ${active ? PAGE.green : '#555'}`,
                            color: active ? PAGE.green : '#555',
                            background: active ? `${PAGE.green}18` : 'transparent',
                          }}
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          style={{
                            background: PAGE.inner,
                            border: `1px solid ${PAGE.innerBorder}`,
                            color: '#aaa',
                            borderRadius: 6,
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(item.id)}
                          style={{
                            background: 'none',
                            border: `1px solid ${PAGE.red}`,
                            color: PAGE.red,
                            borderRadius: 6,
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              background: PAGE.inner,
              border: `1px solid ${PAGE.innerBorder}`,
              borderRadius: 16,
              padding: 28,
              width: 480,
              maxWidth: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              ...font,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#fff' }}>{editing ? 'Edit Work' : 'Add Work'}</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={labelUpper}>Image</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%',
                  height: 140,
                  background: PAGE.card,
                  border: `2px dashed ${PAGE.innerBorder}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: 0,
                }}
              >
                {form.image_url ? (
                  <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ color: PAGE.dim, textAlign: 'center', paddingTop: 36 }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>⬆️</div>
                    <div style={{ fontSize: 12 }}>Click to upload image</div>
                  </div>
                )}
                {uploading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: PAGE.green,
                    }}
                  >
                    Uploading…
                  </div>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelUpper}>Title *</label>
              <input
                placeholder="Summer Wedding — Smith & Jones"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                style={{ ...inputStyle, color: '#fff' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelUpper}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                style={{ ...inputStyle, color: '#fff', cursor: 'pointer' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelUpper}>Description</label>
              <textarea
                placeholder="A short description of this work…"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                style={{ ...inputStyle, color: '#fff', minHeight: 70, resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelUpper}>Tags (comma separated)</label>
              <input
                placeholder="outdoor, golden hour, candid"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                style={{ ...inputStyle, color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input
                type="checkbox"
                id="featured"
                checked={form.featured}
                onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: PAGE.green, cursor: 'pointer' }}
              />
              <label htmlFor="featured" style={{ fontSize: 13, color: '#aaa', cursor: 'pointer' }}>
                Feature this on my portfolio homepage (shown as Active in list)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: `1px solid ${PAGE.innerBorder}`,
                  color: PAGE.muted,
                  borderRadius: 8,
                  padding: '9px 18px',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveItem}
                style={{
                  background: PAGE.green,
                  border: 'none',
                  color: '#000',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {editing ? 'Save' : 'Add Work'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setPendingDeleteId(null)}
          role="presentation"
        >
          <div
            style={{
              background: PAGE.card,
              border: `1px solid ${PAGE.border}`,
              borderRadius: 12,
              padding: 20,
              maxWidth: 360,
              width: '100%',
              ...font,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 16px', color: '#fff', fontWeight: 600 }}>Delete this portfolio item?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${PAGE.innerBorder}`,
                  background: 'transparent',
                  color: PAGE.muted,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteItem(pendingDeleteId)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: PAGE.red,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
