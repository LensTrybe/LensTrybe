import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'

const FONTS = [
  'Inter', 'Geist', 'Playfair Display', 'Instrument Serif',
  'Montserrat', 'Raleway', 'Lato', 'Nunito', 'DM Sans', 'Libre Baskerville',
]

export default function BrandKitPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    logo_url: null,
    primary_color: '#1DB954',
    secondary_color: '#ffffff',
    accent_color: '#0a0a0f',
    font: 'Inter',
  })

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Instrument+Serif&family=Montserrat:wght@400;600;700&family=Raleway:wght@400;600;700&family=Lato:wght@400;700&family=Nunito:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Libre+Baskerville:wght@400;700&display=swap'
    document.head.appendChild(link)
  }, [])

  useEffect(() => { loadBrandKit() }, [user])

  async function loadBrandKit() {
    if (!user) return
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle()
    if (data) {
      setForm({
        logo_url: data.logo_url ?? null,
        primary_color: data.primary_color ?? '#1DB954',
        secondary_color: data.secondary_color ?? '#ffffff',
        accent_color: data.accent_color ?? '#0a0a0f',
        font: data.font ?? 'Inter',
      })
    }
    setLoading(false)
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/logo.${ext}`
    await supabase.storage.from('portfolio').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
    setForm(p => ({ ...p, logo_url: publicUrl }))
    setUploading(false)
  }

  async function saveBrandKit() {
    setSaving(true)
    const payload = {
      logo_url: form.logo_url,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      accent_color: form.accent_color,
      font: form.font,
    }
    const { data: existing } = await supabase.from('brand_kit').select('id').eq('creative_id', user.id).maybeSingle()
    if (existing) {
      await supabase.from('brand_kit').update(payload).eq('creative_id', user.id)
    } else {
      await supabase.from('brand_kit').insert({ creative_id: user.id, user_id: user.id, ...payload })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const s = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px', padding: '32px 40px', fontFamily: 'var(--font-ui)' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    section: { display: 'flex', flexDirection: 'column', gap: '12px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' },
    sectionSub: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '-6px' },
    card: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px' },
    logoUpload: { border: '2px dashed var(--border-default)', borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: 'var(--bg-elevated)' },
    colorRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    colorSwatch: { width: '40px', height: '40px', borderRadius: '8px', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 },
    colorInput: { flex: 1, padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' },
    colorLabel: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' },
    fontGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
    fontOption: (sel) => ({ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${sel ? '#1DB954' : 'var(--border-default)'}`, background: sel ? 'rgba(29,185,84,0.1)' : 'var(--bg-elevated)', cursor: 'pointer', fontSize: '13px', color: sel ? '#1DB954' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }),
    actions: { display: 'flex', justifyContent: 'flex-end' },
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading brand kit…</div>

  return (
    <div style={s.page}>
      <div>
        <h1 style={s.title}>Brand Kit</h1>
        <p style={s.subtitle}>Your logo, colours and font — applied automatically to invoices, quotes, contracts and delivery galleries.</p>
      </div>

      <div style={s.grid}>
        {/* Logo */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Logo</div>
          <div style={s.sectionSub}>Appears on all client-facing documents and galleries.</div>
          <div style={s.logoUpload} onClick={() => document.getElementById('logo-upload').click()}>
            {form.logo_url
              ? <img src={form.logo_url} alt="Logo" style={{ maxWidth: '160px', maxHeight: '80px', objectFit: 'contain' }} />
              : <div style={{ fontSize: '28px' }}>🏷</div>
            }
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {uploading ? 'Uploading…' : form.logo_url ? 'Click to replace' : 'Click to upload logo'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PNG or SVG, transparent background recommended</div>
          </div>
          <input id="logo-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        {/* Colours */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Colours</div>
          <div style={s.sectionSub}>Used across invoices, quotes, contracts and galleries.</div>
          <div style={s.card}>
            {[
              { key: 'primary_color', label: 'Primary Colour', hint: 'Headers, buttons, accents' },
              { key: 'secondary_color', label: 'Secondary Colour', hint: 'Text and highlights' },
            ].map(({ key, label, hint }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <div style={s.colorLabel}>{label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {hint}</span></div>
                <div style={s.colorRow}>
                  <input type="color" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={s.colorSwatch} />
                  <input type="text" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={s.colorInput} placeholder="#000000" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Font */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Font</div>
          <div style={s.sectionSub}>Applied to all documents and your portfolio website.</div>
          <div style={s.fontGrid}>
            {FONTS.map(font => (
              <div key={font} style={s.fontOption(form.font === font)} onClick={() => setForm(p => ({ ...p, font }))}>
                {font}
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Preview</div>
          <div style={s.sectionSub}>How your brand looks on client documents.</div>
          <div style={{ background: form.accent_color, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
            <div style={{ background: form.primary_color, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {form.logo_url
                ? <img src={form.logo_url} alt="Logo" style={{ height: '28px', objectFit: 'contain' }} />
                : <div style={{ fontSize: '14px', fontWeight: 700, color: form.secondary_color, fontFamily: form.font }}>Your Business</div>
              }
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontFamily: form.font, fontSize: '16px', fontWeight: 700, color: form.secondary_color, marginBottom: '4px' }}>Invoice #001</div>
              <div style={{ fontSize: '13px', color: form.secondary_color, opacity: 0.6, marginBottom: '16px' }}>Due: 30 April 2026 · $1,200.00</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ padding: '8px 16px', background: form.primary_color, borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: form.accent_color, fontFamily: form.font }}>Pay Now</div>
                <div style={{ padding: '8px 16px', border: `1px solid ${form.primary_color}`, borderRadius: '6px', fontSize: '12px', color: form.primary_color, fontFamily: form.font }}>View Invoice</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={s.actions}>
        <Button variant="primary" disabled={saving} onClick={saveBrandKit}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Brand Kit'}
        </Button>
      </div>
    </div>
  )
}
