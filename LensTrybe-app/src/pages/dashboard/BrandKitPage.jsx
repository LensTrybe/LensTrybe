import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'

const FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Poppins',
  'Montserrat',
  'Playfair Display',
  'Lato',
  'Open Sans',
  'Merriweather',
  'Raleway',
  'DM Sans',
]

const DEFAULT_PRIMARY = '#D946EF'
const DEFAULT_SECONDARY = '#4ADE80'

function fontToGoogleParam(name) {
  return encodeURIComponent(name).replace(/%20/g, '+')
}

export default function BrandKitPage() {
  const [user, setUser] = useState(null)
  const [kit, setKit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState({})
  const [previewTab, setPreviewTab] = useState('invoice')
  const [form, setForm] = useState({
    primary_color: DEFAULT_PRIMARY,
    secondary_color: DEFAULT_SECONDARY,
    accent_color: '#ffffff',
    background_color: '#0f0f0f',
    heading_font: 'Inter',
    body_font: 'Inter',
    logo_url: '',
    logo_dark_url: '',
    logo_icon_url: '',
    tagline: '',
    assets: [],
  })

  const logoRef = useRef(null)

  const PAGE = {
    bg: '#0a0a0f',
    text: 'rgb(242, 242, 242)',
    card: '#13131a',
    border: '#1e1e1e',
    inner: '#1a1a24',
    innerBorder: '#202027',
    muted: '#888',
    green: '#39ff14',
  }

  const font = { fontFamily: 'Inter, sans-serif' }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchKit = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).single()
    if (data) {
      setKit(data)
      setForm({
        primary_color: data.primary_color || DEFAULT_PRIMARY,
        secondary_color: data.secondary_color || DEFAULT_SECONDARY,
        accent_color: data.accent_color || '#ffffff',
        background_color: data.background_color || '#0f0f0f',
        heading_font: data.heading_font || 'Inter',
        body_font: data.body_font || data.heading_font || 'Inter',
        logo_url: data.logo_url || '',
        logo_dark_url: data.logo_dark_url || '',
        logo_icon_url: data.logo_icon_url || '',
        tagline: data.tagline || '',
        assets: data.assets || [],
      })
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    /* eslint-disable react-hooks/set-state-in-effect -- mount load for brand_kit */
    fetchKit()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user, fetchKit])

  useEffect(() => {
    const id = 'brandkit-font-preview-link'
    let el = document.getElementById(id)
    if (!el) {
      el = document.createElement('link')
      el.id = id
      el.rel = 'stylesheet'
      document.head.appendChild(el)
    }
    el.href = `https://fonts.googleapis.com/css2?family=${fontToGoogleParam(form.heading_font)}:wght@400;600;700&display=swap`
  }, [form.heading_font])

  const saveKit = async () => {
    setSaving(true)
    const payload = { ...form, creative_id: user.id, updated_at: new Date().toISOString() }
    if (kit) {
      await supabase.from('brand_kit').update(payload).eq('creative_id', user.id)
    } else {
      await supabase.from('brand_kit').insert(payload)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchKit()
    setSaving(false)
  }

  const uploadFile = async (file, field) => {
    setUploading((p) => ({ ...p, [field]: true }))
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${field}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('brand-kit').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('brand-kit').getPublicUrl(path)
      setForm((p) => ({ ...p, [field]: data.publicUrl }))
    }
    setUploading((p) => ({ ...p, [field]: false }))
  }

  const f = (field, val) => setForm((p) => ({ ...p, [field]: val }))

  const setBrandFont = (name) => {
    setForm((p) => ({ ...p, heading_font: name, body_font: name }))
  }

  const labelStyle = {
    display: 'block',
    color: PAGE.muted,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 10,
    ...font,
  }

  const hexInputStyle = {
    background: PAGE.inner,
    border: `1px solid ${PAGE.innerBorder}`,
    borderRadius: 6,
    padding: '8px 12px',
    color: '#fff',
    width: 120,
    fontFamily: 'ui-monospace, monospace',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const pillTab = (active) => ({
    padding: '8px 18px',
    borderRadius: 20,
    border: active ? `1px solid ${PAGE.green}` : `1px solid ${PAGE.innerBorder}`,
    background: active ? '#1e2a1e' : PAGE.inner,
    color: active ? PAGE.green : PAGE.muted,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    ...font,
  })

  const primary = form.primary_color || DEFAULT_PRIMARY
  const secondary = form.secondary_color || DEFAULT_SECONDARY
  const previewFont = `"${form.heading_font}", sans-serif`

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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Left: settings */}
        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 12,
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#fff' }}>Brand Kit</h1>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: PAGE.muted, lineHeight: 1.45 }}>
            Customize your branding for all client-facing materials
          </p>

          <label style={labelStyle}>Logo</label>
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            style={{
              width: '100%',
              border: `2px dashed ${PAGE.innerBorder}`,
              background: PAGE.inner,
              borderRadius: 10,
              padding: 24,
              cursor: 'pointer',
              textAlign: 'center',
              marginBottom: 24,
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt="Logo"
                style={{ maxHeight: 100, maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            ) : (
              <>
                <div style={{ fontSize: 32, color: PAGE.green, marginBottom: 8 }} aria-hidden>
                  ☁️
                </div>
                <span style={{ color: PAGE.text, fontSize: 14, fontWeight: 600 }}>Upload Logo</span>
              </>
            )}
            {uploading.logo_url && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: PAGE.green,
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 8,
                }}
              >
                Uploading…
              </div>
            )}
          </button>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'logo_url')}
          />
          {form.logo_url && (
            <button
              type="button"
              onClick={() => f('logo_url', '')}
              style={{
                background: 'none',
                border: 'none',
                color: '#f87171',
                fontSize: 12,
                cursor: 'pointer',
                marginBottom: 20,
                padding: 0,
              }}
            >
              Remove logo
            </button>
          )}

          <label style={labelStyle}>Primary Brand Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(form.primary_color) ? form.primary_color : DEFAULT_PRIMARY}
              onChange={(e) => f('primary_color', e.target.value)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: 'transparent',
              }}
            />
            <input
              type="text"
              value={form.primary_color}
              onChange={(e) => f('primary_color', e.target.value)}
              maxLength={7}
              style={hexInputStyle}
            />
          </div>

          <label style={labelStyle}>Secondary Color (Optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(form.secondary_color) ? form.secondary_color : DEFAULT_SECONDARY}
              onChange={(e) => f('secondary_color', e.target.value)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: 'transparent',
              }}
            />
            <input
              type="text"
              value={form.secondary_color}
              onChange={(e) => f('secondary_color', e.target.value)}
              maxLength={7}
              style={hexInputStyle}
            />
          </div>

          <label style={labelStyle}>Brand Font</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {FONT_OPTIONS.map((name) => {
              const selected = form.heading_font === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setBrandFont(name)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: selected ? `1px solid ${PAGE.green}` : `1px solid ${PAGE.innerBorder}`,
                    background: selected ? '#1e2a1e' : PAGE.inner,
                    color: selected ? PAGE.green : PAGE.muted,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    ...font,
                  }}
                >
                  {selected && <span aria-hidden>✓</span>}
                  {name}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={saveKit}
            disabled={saving || !user}
            style={{
              width: '100%',
              marginTop: 20,
              background: saved ? '#22c55e' : PAGE.green,
              color: '#000',
              fontWeight: 700,
              borderRadius: 8,
              padding: 12,
              border: 'none',
              fontSize: 14,
              cursor: saving || !user ? 'not-allowed' : 'pointer',
              opacity: saving || !user ? 0.65 : 1,
              ...font,
            }}
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Brand Kit'}
          </button>
        </div>

        {/* Right: live preview */}
        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 12,
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#fff' }}>Live Preview</h2>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: PAGE.muted, lineHeight: 1.45 }}>
            See how your brand kit will look across all client-facing materials
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <button type="button" style={pillTab(previewTab === 'invoice')} onClick={() => setPreviewTab('invoice')}>
              Invoice Preview
            </button>
            <button type="button" style={pillTab(previewTab === 'gallery')} onClick={() => setPreviewTab('gallery')}>
              Gallery Preview
            </button>
          </div>

          {previewTab === 'invoice' && (
            <div
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: 20,
                color: '#111',
                fontFamily: previewFont,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ borderBottom: `3px solid ${primary}`, paddingBottom: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: primary }}>Your Business Name</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Professional Services Invoice</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#9ca3af' }}>INVOICE</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>#BK-1024</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18, fontSize: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#9ca3af', marginBottom: 6 }}>BILL TO</div>
                  <div style={{ fontWeight: 700, color: '#111' }}>Sample Client</div>
                  <div style={{ color: '#6b7280', marginTop: 2 }}>client@example.com</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#9ca3af', marginBottom: 6 }}>INVOICE DETAILS</div>
                  <div style={{ color: '#374151' }}>
                    <span style={{ color: '#9ca3af' }}>Date </span>Apr 9, 2026
                  </div>
                  <div style={{ color: '#374151', marginTop: 4 }}>
                    <span style={{ color: '#9ca3af' }}>Due </span>May 9, 2026
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
                <thead>
                  <tr style={{ background: `${primary}14` }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 800 }}>
                      Description
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 800 }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb', color: '#111' }}>Photography Services (8 hours)</td>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600 }}>$1,200.00</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb', color: '#111' }}>Editing &amp; Post-Production</td>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600 }}>$400.00</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 12, marginBottom: 16 }}>
                <div style={{ color: '#6b7280' }}>
                  Subtotal <span style={{ color: '#111', fontWeight: 600, marginLeft: 16 }}>$1,600.00</span>
                </div>
                <div style={{ color: '#6b7280' }}>
                  Tax (10%) <span style={{ color: '#111', fontWeight: 600, marginLeft: 16 }}>$160.00</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: primary, marginTop: 4 }}>
                  Total <span style={{ marginLeft: 16 }}>$1,760.00</span>
                </div>
              </div>

              <div style={{ borderTop: `2px solid ${primary}`, paddingTop: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Thank you for your business!</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Powered by LensTrybe</div>
              </div>
            </div>
          )}

          {previewTab === 'gallery' && (
            <div
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                background: '#fff',
                fontFamily: previewFont,
              }}
            >
              <div
                style={{
                  minHeight: 120,
                  background: `linear-gradient(90deg, ${primary} 0%, ${secondary} 100%)`,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" style={{ height: 48, width: 'auto', maxWidth: 120, objectFit: 'contain' }} />
                ) : null}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.25)' }}>Your Business Name</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 4 }}>Professional Content Gallery</div>
                </div>
              </div>
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1',
                      background: '#f9fafb',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: primary,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ fontSize: 22 }} aria-hidden>
                      📷
                    </span>
                    Gallery Image
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
