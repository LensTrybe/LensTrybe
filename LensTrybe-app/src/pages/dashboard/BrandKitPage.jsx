import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'

const FONTS = [
  'Inter', 'Geist', 'Playfair Display', 'Instrument Serif',
  'Montserrat', 'Raleway', 'Lato', 'Nunito', 'DM Sans', 'Libre Baskerville'
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
    font: 'Inter',
  })

  useEffect(() => { loadBrandKit() }, [user])

  async function loadBrandKit() {
    if (!user) return
    const { data } = await supabase
      .from('brand_kit')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      setForm({
        logo_url: data.logo_url ?? null,
        primary_color: data.primary_color ?? '#1DB954',
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
    const { data: existing } = await supabase
      .from('brand_kit')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('brand_kit').update({
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        font: form.font,
      }).eq('user_id', user.id)
    } else {
      await supabase.from('brand_kit').insert({
        user_id: user.id,
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        font: form.font,
      })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    section: { display: 'flex', flexDirection: 'column', gap: '16px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    sectionSubtitle: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '-8px' },
    logoUpload: {
      border: '2px dashed var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      padding: '32px',
      textAlign: 'center',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      transition: 'border-color var(--transition-base)',
      background: 'var(--bg-elevated)',
    },
    logoPreview: { maxWidth: '160px', maxHeight: '80px', objectFit: 'contain' },
    colorRow: { display: 'flex', alignItems: 'center', gap: '16px' },
    colorSwatch: { width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', cursor: 'pointer', flexShrink: 0 },
    colorInput: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', flex: 1 },
    fontGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
    fontOption: (selected) => ({
      padding: '12px 16px',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`,
      background: selected ? 'var(--green-dim)' : 'var(--bg-elevated)',
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      fontSize: '13px',
      color: selected ? 'var(--green)' : 'var(--text-secondary)',
      fontFamily: 'var(--font-ui)',
    }),
    preview: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
    },
    previewHeader: (color) => ({
      background: color,
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }),
    previewBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' },
    previewTitle: (font) => ({ fontFamily: font, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }),
    previewText: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading brand kit…</div>

  return (
    <div style={styles.page}>
      <div>
        <h1 style={styles.title}>Brand Kit</h1>
        <p style={styles.subtitle}>Your logo, colours and fonts applied automatically across invoices, portals and galleries.</p>
      </div>

      <div style={styles.grid}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Logo</div>
          <div style={styles.sectionSubtitle}>Appears on invoices, client portals and Deliver galleries.</div>
          <div style={styles.logoUpload} onClick={() => document.getElementById('logo-upload').click()}>
            {form.logo_url
              ? <img src={form.logo_url} alt="Logo" style={styles.logoPreview} />
              : <div style={{ fontSize: '28px' }}>🏷</div>
            }
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
              {uploading ? 'Uploading…' : form.logo_url ? 'Click to replace logo' : 'Click to upload logo'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>PNG or SVG recommended, transparent background</div>
          </div>
          <input id="logo-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Primary Colour</div>
          <div style={styles.sectionSubtitle}>Used for buttons, accents and highlights in your branded outputs.</div>
          <div style={styles.colorRow}>
            <input
              type="color"
              value={form.primary_color}
              onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
              style={{ ...styles.colorSwatch, padding: 0, border: 'none' }}
            />
            <input
              type="text"
              value={form.primary_color}
              onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
              style={styles.colorInput}
              placeholder="#1DB954"
            />
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Font</div>
          <div style={styles.sectionSubtitle}>Applied to documents, portals and your portfolio website.</div>
          <div style={styles.fontGrid}>
            {FONTS.map(font => (
              <div key={font} style={styles.fontOption(form.font === font)} onClick={() => setForm(p => ({ ...p, font }))}>
                {font}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Preview</div>
          <div style={styles.sectionSubtitle}>How your brand looks on client-facing outputs.</div>
          <div style={styles.preview}>
            <div style={styles.previewHeader(form.primary_color)}>
              {form.logo_url
                ? <img src={form.logo_url} alt="Logo" style={{ height: '32px', objectFit: 'contain' }} />
                : <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', fontFamily: form.font }}>Your Business Name</div>
              }
            </div>
            <div style={styles.previewBody}>
              <div style={styles.previewTitle(form.font)}>Invoice #001</div>
              <div style={styles.previewText}>Due: 30 April 2026 · Amount: $1,200.00</div>
              <div style={{ marginTop: '8px', padding: '8px 12px', background: form.primary_color, borderRadius: 'var(--radius-md)', display: 'inline-block', fontSize: '12px', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>
                View Invoice
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <Button variant="primary" disabled={saving} onClick={saveBrandKit}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Brand Kit'}
        </Button>
      </div>
    </div>
  )
}
