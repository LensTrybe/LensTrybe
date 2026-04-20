import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

/** Accent is fixed for UI; persisted saves still write this value so DB shape stays valid. */
const DISPLAY_ACCENT = '#ffffff'

const BASE_FONTS = [
  'Inter',
  'Playfair Display',
  'Montserrat',
  'Raleway',
  'Lato',
  'Poppins',
  'Merriweather',
  'Nunito',
  'DM Sans',
  'Cormorant Garamond',
]

const DOC_KEYS = ['invoice', 'quote', 'deliver_gallery']
const DOC_LABELS = {
  invoice: 'Invoice',
  quote: 'Quote',
  deliver_gallery: 'Deliver Gallery',
}

const SERIF_FONTS = new Set(['Playfair Display', 'Merriweather', 'Cormorant Garamond'])

function fontStackCss(name) {
  const q = name.includes(' ') ? `"${name}"` : name
  const fall = SERIF_FONTS.has(name) ? 'serif' : 'sans-serif'
  return `${q}, ${fall}`
}

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Inter:wght@400;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&display=swap'

function emptyDocState() {
  return {
    logo_url: null,
    primary_color: null,
    accent_color: null,
    font: null,
  }
}

function normaliseDocSettings(raw) {
  const src = raw && typeof raw === 'object' ? { ...raw } : {}
  if (src.deliver && !src.deliver_gallery) {
    src.deliver_gallery = src.deliver
  }
  const out = {}
  for (const k of DOC_KEYS) {
    const r = src[k] && typeof src[k] === 'object' ? src[k] : {}
    out[k] = {
      ...emptyDocState(),
      logo_url: r.logo ?? r.logo_url ?? null,
      primary_color: r.primary_colour ?? r.primary_color ?? null,
      accent_color: r.accent_colour ?? r.accent_color ?? null,
      font: r.font ?? null,
    }
  }
  return out
}

/**
 * Persist document_brand_settings: nulls mean inherit from brand base (omit empty override fields).
 * Uses Australian spelling primary_colour and logo_url per stored JSON shape.
 */
function serialiseDocSettingsForDb(internalByKey) {
  const out = {}
  for (const k of DOC_KEYS) {
    const d = internalByKey[k] || emptyDocState()
    const entry = {}
    if (d.logo_url) entry.logo_url = d.logo_url
    if (d.primary_color) entry.primary_colour = d.primary_color
    if (d.font) entry.font = d.font
    const noOverrides = !d.logo_url && !d.primary_color && !d.font
    if (!noOverrides) out[k] = entry
  }
  return out
}

/** Merge serialised doc settings into existing JSON so keys Brand Kit does not edit (e.g. contract) stay in the DB. */
function mergeStoredDocumentSettings(existingRaw, serialized) {
  const base = existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw) ? { ...existingRaw } : {}
  const next = serialized && typeof serialized === 'object' && !Array.isArray(serialized) ? serialized : {}
  return { ...base, ...next }
}

function formatMoneyAud(amount) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(amount) || 0)
}

const PREVIEW_LINE_ITEMS = [
  { description: 'Creative fee', quantity: 1, rate: 880 },
  { description: 'Licence and usage', quantity: 1, rate: 220 },
]

function previewTotal(lines) {
  return lines.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0)
}

function localIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function useNarrow(breakpoint = 960) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  )
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < breakpoint)
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [breakpoint])
  return narrow
}

export default function BrandKitPage() {
  const { user, profile } = useAuth()
  const narrow = useNarrow(960)
  const [loading, setLoading] = useState(true)
  const [savingBase, setSavingBase] = useState(false)
  const [savingDoc, setSavingDoc] = useState(false)
  const [uploadingBaseLogo, setUploadingBaseLogo] = useState(false)
  const [uploadingDocLogo, setUploadingDocLogo] = useState(false)
  const [baseSaved, setBaseSaved] = useState(false)
  const [docSaved, setDocSaved] = useState(false)
  const [error, setError] = useState('')
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const [secondaryColor, setSecondaryColor] = useState('#ffffff')
  const [brandBase, setBrandBase] = useState({
    logo_url: null,
    primary_color: '#1DB954',
    accent_color: DISPLAY_ACCENT,
    font: 'Inter',
  })
  const [docSettings, setDocSettings] = useState(() => {
    const o = {}
    for (const k of DOC_KEYS) o[k] = emptyDocState()
    return o
  })
  const [activeTab, setActiveTab] = useState('invoice')

  useEffect(() => {
    const id = 'brand-kit-google-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = GOOGLE_FONTS_HREF
    document.head.appendChild(link)
  }, [])

  const loadBrandKit = useCallback(async () => {
    if (!user?.id || !supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle()
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    if (data) {
      setBrandBase({
        logo_url: data.logo_url ?? null,
        primary_color: data.primary_color ?? '#1DB954',
        accent_color: DISPLAY_ACCENT,
        font: BASE_FONTS.includes(data.font) ? data.font : 'Inter',
      })
      setSecondaryColor(data.secondary_color ?? '#ffffff')
      const rawDocs = data.document_brand_settings
      setDocSettings(normaliseDocSettings(rawDocs && typeof rawDocs === 'object' ? rawDocs : {}))
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadBrandKit()
  }, [loadBrandKit])

  useEffect(() => {
    if (!showPreviewModal) return
    const onKey = (e) => {
      if (e.key === 'Escape') setShowPreviewModal(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showPreviewModal])

  const effective = useMemo(() => {
    const tab = activeTab
    const d = docSettings[tab] || emptyDocState()
    return {
      logo_url: d.logo_url || brandBase.logo_url,
      primary_color: d.primary_color || brandBase.primary_color,
      accent_color: DISPLAY_ACCENT,
      font: d.font || brandBase.font,
    }
  }, [activeTab, docSettings, brandBase])

  async function uploadToPortfolio(path, file) {
    const { error: upErr } = await supabase.storage.from('portfolio').upload(path, file, { upsert: true })
    if (upErr) throw new Error(upErr.message)
    const { data } = supabase.storage.from('portfolio').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleBaseLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadingBaseLogo(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/brand-kit/logo.${ext}`
      const url = await uploadToPortfolio(path, file)
      setBrandBase((b) => ({ ...b, logo_url: url }))
    } catch (er) {
      setError(er.message || 'Logo upload failed')
    } finally {
      setUploadingBaseLogo(false)
      e.target.value = ''
    }
  }

  function removeBaseLogo() {
    setBrandBase((b) => ({ ...b, logo_url: null }))
  }

  async function handleDocLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadingDocLogo(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/brand-kit/${activeTab}-logo.${ext}`
      const url = await uploadToPortfolio(path, file)
      setDocSettings((prev) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], logo_url: url },
      }))
    } catch (er) {
      setError(er.message || 'Logo upload failed')
    } finally {
      setUploadingDocLogo(false)
      e.target.value = ''
    }
  }

  async function resetDocumentTabToBrandBase() {
    const msg =
      `Reset ${DOC_LABELS[activeTab]} to your brand base? This clears all overrides for this document type only.`
    if (typeof window !== 'undefined' && !window.confirm(msg)) return
    setError('')
    if (!user?.id || !supabase) return
    setSavingDoc(true)
    try {
      const { data: row, error: selErr } = await supabase
        .from('brand_kit')
        .select('id, document_brand_settings')
        .eq('creative_id', user.id)
        .maybeSingle()
      if (selErr) throw selErr
      const prevDocs = normaliseDocSettings(row?.document_brand_settings)
      const nextDocs = { ...prevDocs, [activeTab]: emptyDocState() }
      const nextDocsPayload = mergeStoredDocumentSettings(row?.document_brand_settings, serialiseDocSettingsForDb(nextDocs))
      if (row?.id) {
        const { error: u } = await supabase
          .from('brand_kit')
          .update({ document_brand_settings: nextDocsPayload })
          .eq('creative_id', user.id)
        if (u) throw u
      } else {
        const { error: ins } = await supabase.from('brand_kit').insert({
          creative_id: user.id,
          user_id: user.id,
          logo_url: brandBase.logo_url,
          primary_color: brandBase.primary_color,
          accent_color: DISPLAY_ACCENT,
          secondary_color: secondaryColor,
          font: brandBase.font,
          document_brand_settings: nextDocsPayload,
        })
        if (ins) throw ins
      }
      setDocSettings(nextDocs)
      setDocSaved(true)
      setTimeout(() => setDocSaved(false), 3200)
    } catch (er) {
      setError(er.message || 'Could not reset document settings')
    } finally {
      setSavingDoc(false)
    }
  }

  function resetDocField(field) {
    setDocSettings((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: null },
    }))
  }

  async function saveBrandBase() {
    if (!user?.id || !supabase) return
    setSavingBase(true)
    setError('')
    setBaseSaved(false)
    const payload = {
      logo_url: brandBase.logo_url,
      primary_color: brandBase.primary_color,
      accent_color: DISPLAY_ACCENT,
      secondary_color: secondaryColor,
      font: brandBase.font,
    }
    const { data: existing } = await supabase.from('brand_kit').select('id').eq('creative_id', user.id).maybeSingle()
    try {
      if (existing?.id) {
        const { error: u } = await supabase.from('brand_kit').update(payload).eq('creative_id', user.id)
        if (u) throw u
      } else {
        const { error: ins } = await supabase.from('brand_kit').insert({
          creative_id: user.id,
          user_id: user.id,
          ...payload,
          document_brand_settings: serialiseDocSettingsForDb(docSettings),
        })
        if (ins) throw ins
      }
      setBaseSaved(true)
      setTimeout(() => setBaseSaved(false), 3200)
    } catch (er) {
      setError(er.message || 'Could not save brand base')
    } finally {
      setSavingBase(false)
    }
  }

  async function saveDocumentTab() {
    if (!user?.id || !supabase) return
    setSavingDoc(true)
    setError('')
    setDocSaved(false)
    const merged = { ...docSettings }
    const { data: row, error: selErr } = await supabase
      .from('brand_kit')
      .select('id, document_brand_settings')
      .eq('creative_id', user.id)
      .maybeSingle()
    if (selErr) {
      setError(selErr.message)
      setSavingDoc(false)
      return
    }
    const prevDocs = normaliseDocSettings(row?.document_brand_settings)
    const nextDocs = { ...prevDocs, [activeTab]: merged[activeTab] }
    const nextDocsPayload = mergeStoredDocumentSettings(row?.document_brand_settings, serialiseDocSettingsForDb(nextDocs))
    try {
      if (row?.id) {
        const { error: u } = await supabase
          .from('brand_kit')
          .update({ document_brand_settings: nextDocsPayload })
          .eq('creative_id', user.id)
        if (u) throw u
      } else {
        const { error: ins } = await supabase.from('brand_kit').insert({
          creative_id: user.id,
          user_id: user.id,
          logo_url: brandBase.logo_url,
          primary_color: brandBase.primary_color,
          accent_color: DISPLAY_ACCENT,
          secondary_color: secondaryColor,
          font: brandBase.font,
          document_brand_settings: nextDocsPayload,
        })
        if (ins) throw ins
      }
      setDocSettings(nextDocs)
      setDocSaved(true)
      setTimeout(() => setDocSaved(false), 3200)
    } catch (er) {
      setError(er.message || 'Could not save document settings')
    } finally {
      setSavingDoc(false)
    }
  }

  const card = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
  }

  const d = docSettings[activeTab]

  if (!user) {
    return (
      <div style={{ padding: '28px 24px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: 800, margin: '0 auto', boxSizing: 'border-box' }}>
        Sign in to manage your brand kit.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 24px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: 800, margin: '0 auto', boxSizing: 'border-box' }}>
        Loading brand kit…
      </div>
    )
  }

  const effectiveDocLogo = d.logo_url || brandBase.logo_url

  return (
    <>
    <style>{`
      @media (max-width: 767px) {
        .brand-kit-page button { min-height: 44px; }
        .brand-kit-page input, .brand-kit-page textarea, .brand-kit-page select { width: 100% !important; font-size: 14px !important; }
        .brand-kit-page [data-font-selector] { flex-wrap: wrap !important; }
      }
    `}</style>
    <div
      className="brand-kit-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '28px 24px 48px',
        maxWidth: 800,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
      }}
    >
      <header style={{ marginBottom: 0 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 28px)', color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>Brand Kit</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: 640, lineHeight: 1.6 }}>
          Set your brand base once, then customise how each client document looks. Word documents are converted to PDF
          before sending to clients.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            border: '1px solid #f87171',
            color: '#f87171',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Section 1: Brand Base */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: '0 0 12px' }}>
        Brand Base
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: '0 0 16px', lineHeight: 1.5 }}>
        These values are the defaults for each document tab. Saving here does not change any per-document overrides you have already saved.
      </p>

      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Logo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 100,
                minWidth: 160,
                border: '2px dashed var(--border-default)',
                borderRadius: 12,
                background: 'var(--bg-base)',
                cursor: uploadingBaseLogo ? 'wait' : 'pointer',
                padding: 12,
              }}
            >
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBaseLogoChange} />
              {brandBase.logo_url ? (
                <img src={brandBase.logo_url} alt="" style={{ maxWidth: 160, maxHeight: 64, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click to upload</span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>PNG or SVG recommended</span>
            </label>
            {brandBase.logo_url ? (
              <button
                type="button"
                onClick={removeBaseLogo}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Primary colour</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="color"
              value={brandBase.primary_color}
              onChange={(e) => setBrandBase((b) => ({ ...b, primary_color: e.target.value }))}
              style={{ width: 44, height: 44, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
            />
            <input
              type="text"
              value={brandBase.primary_color}
              onChange={(e) => setBrandBase((b) => ({ ...b, primary_color: e.target.value }))}
              style={{
                flex: 1,
                minWidth: 120,
                maxWidth: 280,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontFamily: 'var(--font-ui)',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Font</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 8,
            }}
          >
            {BASE_FONTS.map((f) => {
              const sel = brandBase.font === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setBrandBase((b) => ({ ...b, font: f }))}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${sel ? '#1DB954' : 'var(--border-default)'}`,
                    background: sel ? 'rgba(29,185,84,0.12)' : 'var(--bg-base)',
                    color: sel ? '#1DB954' : 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: fontStackCss(f),
                  }}
                >
                  {f}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <button
            type="button"
            onClick={saveBrandBase}
            disabled={savingBase}
            style={{
              background: '#1DB954',
              color: '#000',
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              padding: '12px 22px',
              cursor: savingBase ? 'wait' : 'pointer',
              fontSize: 14,
              fontFamily: 'var(--font-ui)',
            }}
          >
            {savingBase ? 'Saving…' : 'Save Brand Base'}
          </button>
          {baseSaved ? (
            <span style={{ fontSize: 13, color: '#1DB954', fontWeight: 600 }}>Brand base saved.</span>
          ) : null}
        </div>
      </div>

      {/* Section 2: Per-document tabs */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', margin: '0 0 12px' }}>
        Per-document tabs
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Each tab saves separately. Changing one document type never changes the others.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
        }}
      >
        {DOC_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${activeTab === key ? '#1DB954' : 'var(--border-default)'}`,
              background: activeTab === key ? 'rgba(29,185,84,0.12)' : 'var(--bg-base)',
              color: activeTab === key ? '#1DB954' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {DOC_LABELS[key]}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 55fr) minmax(0, 45fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div style={{ ...card, marginBottom: narrow ? 0 : 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: 16 }}>{DOC_LABELS[activeTab]} settings</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Primary colour override</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="color"
                value={d.primary_color || brandBase.primary_color}
                onChange={(e) =>
                  setDocSettings((p) => ({
                    ...p,
                    [activeTab]: { ...p[activeTab], primary_color: e.target.value },
                  }))
                }
                style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
              />
              <input
                type="text"
                value={d.primary_color ?? ''}
                placeholder={brandBase.primary_color}
                onChange={(e) =>
                  setDocSettings((p) => ({
                    ...p,
                    [activeTab]: { ...p[activeTab], primary_color: e.target.value || null },
                  }))
                }
                style={{
                  flex: 1,
                  minWidth: 0,
                  maxWidth: 260,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'var(--font-ui)',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => resetDocField('primary_color')}
              style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Use brand base
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Font override</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {BASE_FONTS.map((f) => {
                const sel = d.font === f
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() =>
                      setDocSettings((p) => ({
                        ...p,
                        [activeTab]: { ...p[activeTab], font: f },
                      }))
                    }
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${sel ? '#1DB954' : 'var(--border-default)'}`,
                      background: sel ? 'rgba(29,185,84,0.12)' : 'var(--bg-base)',
                      color: sel ? '#1DB954' : 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: fontStackCss(f),
                    }}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => resetDocField('font')}
              style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Use brand base
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Logo override</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-base)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {effectiveDocLogo ? (
                  <img src={effectiveDocLogo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: 4, textAlign: 'center' }}>No logo</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-base)',
                    cursor: uploadingDocLogo ? 'wait' : 'pointer',
                    fontSize: 13,
                    width: 'fit-content',
                  }}
                >
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDocLogoChange} />
                  {uploadingDocLogo ? 'Uploading…' : d.logo_url ? 'Replace file' : 'Upload file'}
                </label>
                {d.logo_url ? (
                  <button
                    type="button"
                    onClick={() => resetDocField('logo_url')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-default)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    Remove
                  </button>
                ) : null}
                {d.logo_url ? (
                  <button
                    type="button"
                    onClick={() => resetDocField('logo_url')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}
                  >
                    Use brand base
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={saveDocumentTab}
              disabled={savingDoc}
              style={{
                background: '#1DB954',
                color: '#000',
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                padding: '12px 22px',
                cursor: savingDoc ? 'wait' : 'pointer',
                fontSize: 14,
                fontFamily: 'var(--font-ui)',
              }}
            >
              {savingDoc ? 'Saving…' : `Save ${DOC_LABELS[activeTab]}`}
            </button>
            <button
              type="button"
              onClick={resetDocumentTabToBrandBase}
              disabled={savingDoc}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: savingDoc ? 'wait' : 'pointer',
                textDecoration: 'underline',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Reset to brand base
            </button>
            {docSaved ? (
              <span style={{ fontSize: 13, color: '#1DB954', fontWeight: 600 }}>{DOC_LABELS[activeTab]} settings saved.</span>
            ) : null}
          </div>
        </div>

        <div style={{ ...card, position: narrow ? 'relative' : 'sticky', top: narrow ? 0 : 16 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: 8 }}>Preview</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.45 }}>
            Open a full-screen sample using this tab&apos;s colours, font and logo.
          </p>
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #1DB954',
              background: 'rgba(29,185,84,0.12)',
              color: '#1DB954',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Preview Document
          </button>
        </div>
      </div>
    </div>

    {showPreviewModal ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Document preview"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2000,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex',
          flexDirection: 'column',
          padding: narrow ? 16 : 24,
          boxSizing: 'border-box',
        }}
        onClick={() => setShowPreviewModal(false)}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setShowPreviewModal(false)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Close
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            maxWidth: 720,
            width: '100%',
            margin: '0 auto',
            paddingBottom: 32,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeTab === 'invoice' ? (
            <BrandKitInvoicePreview effective={effective} headerTextColor={secondaryColor} profile={profile} user={user} />
          ) : activeTab === 'quote' ? (
            <BrandKitQuotePreview effective={effective} headerTextColor={secondaryColor} profile={profile} user={user} />
          ) : (
            <DeliverGalleryPreview effective={effective} secondaryColor="#ffffff" />
          )}
        </div>
      </div>
    ) : null}
    </>
  )
}

function readOnlyFieldStyle(brandAccent, muted) {
  return {
    padding: '8px 12px',
    border: `1px solid ${brandAccent}40`,
    borderRadius: '6px',
    fontSize: '14px',
    color: muted ? '#9ca3af' : '#111',
    width: '100%',
    boxSizing: 'border-box',
  }
}

function BrandKitInvoicePreview({ effective, headerTextColor, profile, user }) {
  const brandColor = effective.primary_color
  const brandAccent = DISPLAY_ACCENT
  const brandLogo = effective.logo_url
  const brandFontStack = fontStackCss(effective.font)
  const brandHeaderBg = { background: brandColor }
  const invoiceDocSurface = {
    padding: '40px 48px',
    overflowY: 'auto',
    flex: 1,
    background: '#fff',
    color: '#111',
    fontFamily: brandFontStack,
  }
  const bankDetails = {
    bank_name: profile?.bank_name ?? '',
    bank_bsb: profile?.bank_bsb ?? '',
    bank_account: profile?.bank_account ?? '',
    bank_account_name: profile?.bank_account_name ?? '',
  }
  const todayLong = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const dueIso = localIsoDate()
  const total = previewTotal(PREVIEW_LINE_ITEMS)

  return (
    <div style={{ ...invoiceDocSurface, borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ margin: '-40px -48px 24px -48px', padding: '20px 48px', ...brandHeaderBg, color: headerTextColor }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />
            ) : null}
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px', fontFamily: brandFontStack }}>
                {profile?.business_name ?? 'Your Business'}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', fontFamily: brandFontStack }}>INVOICE</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>{todayLong}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${brandAccent}` }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: brandAccent,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          Bill To
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={readOnlyFieldStyle(brandAccent)}>Sample Client Co.</div>
          <div style={readOnlyFieldStyle(brandAccent, true)}>Client email</div>
          <div style={readOnlyFieldStyle(brandAccent, true)}>Phone (optional)</div>
          <div style={readOnlyFieldStyle(brandAccent, true)}>Address (optional)</div>
          <div style={{ ...readOnlyFieldStyle(brandAccent), width: '50%' }}>{dueIso}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${brandColor}`, background: `${brandAccent}33` }}>
            <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Description
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '10px 0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                width: '80px',
              }}
            >
              Qty
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                width: '100px',
              }}
            >
              Rate
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                width: '100px',
              }}
            >
              Amount
            </th>
            <th style={{ width: '32px' }} />
          </tr>
        </thead>
        <tbody>
          {PREVIEW_LINE_ITEMS.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 0' }}>
                <div style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', color: '#111' }}>
                  {item.description}
                </div>
              </td>
              <td style={{ padding: '8px 4px' }}>
                <div style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'center', color: '#111' }}>
                  {item.quantity}
                </div>
              </td>
              <td style={{ padding: '8px 4px' }}>
                <div style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'right', color: '#111' }}>
                  {item.rate}
                </div>
              </td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#111' }}>
                AUD {(Number(item.quantity) * Number(item.rate)).toFixed(2)}
              </td>
              <td style={{ padding: '8px 0' }} />
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px', paddingTop: '16px', borderTop: `1px solid ${brandAccent}` }}>
        <div style={{ width: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `2px solid ${brandAccent}` }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#111' }}>Total</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: brandColor }}>{formatMoneyAud(total)}</span>
          </div>
        </div>
      </div>

      {(bankDetails.bank_account || bankDetails.bank_bsb) && (
        <div
          style={{
            background: '#f9fafb',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '24px',
            borderLeft: `4px solid ${brandAccent}`,
            borderTop: `1px solid ${brandAccent}`,
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: brandAccent,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            Payment Details
          </div>
          {bankDetails.bank_name ? <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Bank: {bankDetails.bank_name}</div> : null}
          {bankDetails.bank_account_name ? (
            <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Account Name: {bankDetails.bank_account_name}</div>
          ) : null}
          {bankDetails.bank_bsb ? <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>BSB: {bankDetails.bank_bsb}</div> : null}
          {bankDetails.bank_account ? <div style={{ fontSize: '13px', color: '#374151' }}>Account: {bankDetails.bank_account}</div> : null}
        </div>
      )}

      <div style={{ paddingTop: '20px', borderTop: `1px solid ${brandAccent}` }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: brandAccent,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          Notes
        </div>
        <div
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            minHeight: '80px',
            color: '#111',
            boxSizing: 'border-box',
          }}
        >
          Preview notes — your real invoices use the text you enter when creating them.
        </div>
      </div>

      <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: `1px solid ${brandAccent}`, fontSize: '12px', color: '#999', textAlign: 'center' }}>
        Thank you for your business
      </div>
    </div>
  )
}

function BrandKitQuotePreview({ effective, headerTextColor, profile, user }) {
  const brandLogo = effective.logo_url
  const quoteBrandColor = effective.primary_color
  const quoteBrandAccent = DISPLAY_ACCENT
  const quoteBrandFontStack = fontStackCss(effective.font)
  const quoteHeaderBg = { background: quoteBrandColor }
  const quoteDocSurface = {
    padding: '40px 48px',
    overflowY: 'auto',
    flex: 1,
    background: '#fff',
    color: '#111',
    fontFamily: quoteBrandFontStack,
  }
  const bankDetails = {
    bank_name: profile?.bank_name ?? '',
    bank_bsb: profile?.bank_bsb ?? '',
    bank_account: profile?.bank_account ?? '',
    bank_account_name: profile?.bank_account_name ?? '',
  }
  const todayLong = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const dueIso = localIsoDate()
  const total = previewTotal(PREVIEW_LINE_ITEMS)

  return (
    <div style={{ ...quoteDocSurface, borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ margin: '-40px -48px 24px -48px', padding: '20px 48px', ...quoteHeaderBg, color: headerTextColor }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            {brandLogo ? (
              <img src={brandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />
            ) : null}
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '4px', fontFamily: quoteBrandFontStack }}>
                {profile?.business_name ?? 'Your Business'}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email ?? user?.email}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', fontFamily: quoteBrandFontStack }}>QUOTE</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>{todayLong}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: quoteBrandAccent,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          Bill To
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={readOnlyFieldStyle(quoteBrandAccent)}>Sample Client Co.</div>
          <div style={readOnlyFieldStyle(quoteBrandAccent, true)}>Client email</div>
          <div style={readOnlyFieldStyle(quoteBrandAccent, true)}>Phone (optional)</div>
          <div style={readOnlyFieldStyle(quoteBrandAccent, true)}>Address (optional)</div>
          <div style={{ ...readOnlyFieldStyle(quoteBrandAccent), width: '50%' }}>{dueIso}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr
            style={{
              borderBottom: `2px solid ${quoteBrandColor}`,
              background: `${quoteBrandColor}22`,
              boxShadow: `inset 0 -2px 0 0 ${quoteBrandAccent}66`,
            }}
          >
            <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Description
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '10px 0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                width: '80px',
              }}
            >
              Qty
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                width: '100px',
              }}
            >
              Rate
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                width: '100px',
              }}
            >
              Amount
            </th>
            <th style={{ width: '32px' }} />
          </tr>
        </thead>
        <tbody>
          {PREVIEW_LINE_ITEMS.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 0' }}>
                <div style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', color: '#111' }}>
                  {item.description}
                </div>
              </td>
              <td style={{ padding: '8px 4px' }}>
                <div style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'center', color: '#111' }}>
                  {item.quantity}
                </div>
              </td>
              <td style={{ padding: '8px 4px' }}>
                <div style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'right', color: '#111' }}>
                  {item.rate}
                </div>
              </td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#111' }}>
                AUD {(Number(item.quantity) * Number(item.rate)).toFixed(2)}
              </td>
              <td style={{ padding: '8px 0' }} />
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
        <div style={{ width: '240px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderTop: `2px solid ${quoteBrandColor}`,
              borderBottom: `1px solid ${quoteBrandAccent}55`,
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#111' }}>Total</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: quoteBrandColor }}>{formatMoneyAud(total)}</span>
          </div>
        </div>
      </div>

      {(bankDetails.bank_account || bankDetails.bank_bsb) && (
        <div
          style={{
            background: '#f9fafb',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '24px',
            borderLeft: `4px solid ${quoteBrandAccent}`,
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: quoteBrandAccent,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            Payment Details
          </div>
          {bankDetails.bank_name ? <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Bank: {bankDetails.bank_name}</div> : null}
          {bankDetails.bank_account_name ? (
            <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>Account Name: {bankDetails.bank_account_name}</div>
          ) : null}
          {bankDetails.bank_bsb ? <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>BSB: {bankDetails.bank_bsb}</div> : null}
          {bankDetails.bank_account ? <div style={{ fontSize: '13px', color: '#374151' }}>Account: {bankDetails.bank_account}</div> : null}
        </div>
      )}

      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: quoteBrandAccent,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          Notes
        </div>
        <div
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            minHeight: '80px',
            color: '#111',
            boxSizing: 'border-box',
          }}
        >
          Preview notes — your real quotes use the text you enter when creating them.
        </div>
      </div>

      <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: `1px solid ${quoteBrandAccent}33`, fontSize: '12px', color: '#999', textAlign: 'center' }}>
        Thank you for your business
      </div>
    </div>
  )
}

function DeliverGalleryPreview({ effective, secondaryColor }) {
  const { primary_color: p, font: ff, logo_url: logo } = effective
  const fontStack = fontStackCss(ff)

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #ffffff',
        background: '#ffffff14',
        fontFamily: fontStack,
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          background: p,
          borderBottom: '4px solid #ffffff',
          boxShadow: 'inset 0 -1px 0 0 #ffffff88',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontWeight: 700,
          color: secondaryColor,
        }}
      >
        {logo ? <img src={logo} alt="" style={{ height: 28, objectFit: 'contain' }} /> : <span style={{ fontSize: 14 }}>Your studio</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.9 }}>Deliver gallery</span>
      </div>
      <div style={{ padding: 16 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: secondaryColor,
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '2px solid #ffffff',
            display: 'inline-block',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          Client delivery
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                background: `${p}28`,
                border: '2px solid #ffffff66',
                boxShadow: '0 0 0 1px #ffffff22 inset',
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 8,
              background: p,
              color: secondaryColor,
              border: `1px solid ${secondaryColor}`,
            }}
          >
            Download
          </span>
        </div>
      </div>
    </div>
  )
}
