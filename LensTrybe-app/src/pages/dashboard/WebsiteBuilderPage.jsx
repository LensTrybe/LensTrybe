import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import { GLASS_CARD, GLASS_NATIVE_FIELD } from '../../lib/glassTokens'
import { FONT_OPTIONS, PALETTES, STYLES, DEFAULT_THEME, normalizeTheme, mergeTheme, resolveTheme } from '../../lib/siteTheme'

// Website builder — edits the creative's PROFILE-as-website. Content pages
// (Home/About/Contact) live in site_pages; Gallery uses portfolio_items grouped
// into albums by `category` (with `featured` showing on Home); Services uses
// portfolio_services; social links + website live on the profile.
// Gating: Expert/Elite = full builder; Pro = Home + Contact; Basic = upsell.

const PAGE_ORDER = ['home', 'about', 'gallery', 'services', 'contact']
const TABS = [...PAGE_ORDER, 'design', 'settings']
const PAGE_LABEL = { home: 'Home', about: 'About', gallery: 'Gallery', services: 'Services', contact: 'Contact', design: 'Design', settings: 'Settings' }
const CONTENT_PAGES = ['home', 'about', 'contact']

const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website URL', placeholder: 'https://yourstudio.com' },
  { key: 'instagram_url', label: 'Instagram', placeholder: '@yourhandle' },
  { key: 'tiktok_url', label: 'TikTok', placeholder: '@yourhandle' },
  { key: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
  { key: 'twitter_url', label: 'X (Twitter)', placeholder: 'https://x.com/you' },
]

const SIZE_OPTIONS = [{ label: 'S', v: 15 }, { label: 'M', v: 17 }, { label: 'L', v: 19 }]
const WEIGHT_OPTIONS = [{ label: 'Light', v: 400 }, { label: 'Regular', v: 600 }, { label: 'Bold', v: 700 }, { label: 'Extra', v: 800 }]
const BTN_SHAPES = [{ label: 'Square', v: 0 }, { label: 'Rounded', v: 10 }, { label: 'Pill', v: 999 }]
const CORNERS = [{ label: 'Sharp', v: 0 }, { label: 'Soft', v: 10 }, { label: 'Rounded', v: 20 }]

const TEMPLATES = {
  home: [
    { id: 't1', name: 'Full-bleed hero', desc: 'Big background image with your headline over it.' },
    { id: 't2', name: 'Split hero', desc: 'Text on the left, image on the right.' },
    { id: 't3', name: 'Centred', desc: 'Logo and headline centred, with your hero photo below.' },
  ],
  about: [
    { id: 't1', name: 'Photo beside text', desc: 'Portrait on the left, your story on the right.' },
    { id: 't2', name: 'Centred', desc: 'Round portrait with centred text.' },
    { id: 't3', name: 'Photo on the right', desc: 'Your story on the left, portrait on the right.' },
  ],
  contact: [
    { id: 't1', name: 'Centred form', desc: 'A simple, centred enquiry form.' },
    { id: 't2', name: 'Split', desc: 'Your blurb on the left, the form on the right.' },
    { id: 't3', name: 'Minimal', desc: 'Left-aligned heading with the form below.' },
  ],
}

const FIELDS = {
  home: [
    { key: 'headline', label: 'Headline', type: 'text', placeholder: 'e.g. Timeless wedding photography' },
    { key: 'subheadline', label: 'Subheadline', type: 'text', placeholder: 'One line under your headline' },
    { key: 'hero_image', label: 'Hero image', type: 'image' },
    { key: 'intro', label: 'Welcome paragraph', type: 'textarea', placeholder: 'A short welcome shown under your hero.', rows: 4 },
    { key: 'cta_text', label: 'Button text', type: 'text', placeholder: 'Enquire Now' },
  ],
  about: [
    { key: 'heading', label: 'Heading', type: 'text', placeholder: 'About me' },
    { key: 'portrait_image', label: 'Portrait photo', type: 'image' },
    { key: 'body', label: 'Your story', type: 'textarea', placeholder: 'Tell visitors about you and your work. Press Enter for a new paragraph.', rows: 8 },
  ],
  contact: [
    { key: 'heading', label: 'Heading', type: 'text', placeholder: 'Get in touch' },
    { key: 'blurb', label: 'Intro text', type: 'textarea', placeholder: 'Tell visitors what happens when they reach out.', rows: 4 },
  ],
}

function flash(setter, ms = 2600) { setter(true); setTimeout(() => setter(false), ms) }

function TemplateSkeleton({ pageType, id }) {
  const box = { background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4 }
  const bar = (w, h = 6) => ({ height: h, width: w, borderRadius: 3, background: 'var(--border-default)' })
  const accent = { background: '#1DB954' }
  const frame = { height: 92, borderRadius: 8, padding: 8, display: 'flex', gap: 6, overflow: 'hidden', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }
  const col = { display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }
  if (pageType === 'home') {
    if (id === 't2') return (<div style={frame}><div style={{ ...col, flex: 1, padding: 4 }}><div style={bar('80%', 10)} /><div style={bar('60%')} /><div style={{ ...bar('34%', 12), ...accent, marginTop: 4 }} /></div><div style={{ ...box, flex: 1 }} /></div>)
    if (id === 't3') return (<div style={{ ...frame, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10 }}><div style={{ width: 22, height: 12, borderRadius: 3, background: 'var(--border-default)', marginBottom: 4 }} /><div style={bar('62%', 11)} /><div style={bar('40%')} /><div style={{ ...bar('30%', 12), ...accent, marginTop: 4 }} /></div>)
    return (<div style={{ ...frame, position: 'relative', padding: 0, alignItems: 'center', justifyContent: 'center' }}><div style={{ position: 'absolute', inset: 0, background: 'var(--border-default)', borderRadius: 8, opacity: 0.5 }} /><div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}><div style={{ ...bar(54, 12), background: '#fff' }} /><div style={{ ...bar(34), background: 'rgba(255,255,255,0.8)' }} /></div></div>)
  }
  if (pageType === 'about') {
    if (id === 't2') return (<div style={{ ...frame, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10 }}><div style={{ width: 26, height: 26, borderRadius: '50%', ...box }} /><div style={bar('60%', 8)} /><div style={bar('72%')} /><div style={bar('50%')} /></div>)
    if (id === 't3') return (<div style={frame}><div style={{ ...col, flex: 1, padding: 4 }}><div style={bar('70%', 9)} /><div style={bar('90%')} /><div style={bar('80%')} /><div style={bar('60%')} /></div><div style={{ ...box, width: 34 }} /></div>)
    return (<div style={frame}><div style={{ ...box, width: 34 }} /><div style={{ ...col, flex: 1, padding: 4 }}><div style={bar('70%', 9)} /><div style={bar('90%')} /><div style={bar('80%')} /><div style={bar('60%')} /></div></div>)
  }
  if (pageType === 'contact') {
    if (id === 't2') return (<div style={frame}><div style={{ ...col, flex: 1, padding: 4 }}><div style={bar('70%', 9)} /><div style={bar('86%')} /></div><div style={{ ...box, flex: 1, padding: 6, display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}><div style={bar('100%', 8)} /><div style={bar('100%', 18)} /><div style={{ ...bar('50%', 10), ...accent }} /></div></div>)
    if (id === 't3') return (<div style={{ ...frame, flexDirection: 'column', justifyContent: 'center', padding: 10 }}><div style={bar('50%', 9)} /><div style={bar('100%', 8)} /><div style={bar('100%', 16)} /><div style={{ ...bar('34%', 10), ...accent }} /></div>)
    return (<div style={{ ...frame, alignItems: 'center', justifyContent: 'center', padding: 10 }}><div style={{ ...box, width: '70%', padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}><div style={bar('100%', 8)} /><div style={bar('100%', 16)} /><div style={{ ...bar('50%', 10), ...accent, alignSelf: 'center' }} /></div></div>)
  }
  return null
}

function PageEditor({ pageType, content, template, visible, onField, onTemplate, onVisible, onUploadImage, uploadingField, onSave, saving, saved, styles }) {
  const fileRef = useRef(null)
  const [pendingField, setPendingField] = useState(null)
  const { inputStyle, label } = styles
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f && pendingField) onUploadImage(pendingField, f); if (fileRef.current) fileRef.current.value = '' }} />
      <div>
        <div style={label}>Layout</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 8 }}>
          {TEMPLATES[pageType].map((t) => {
            const active = (template || 't1') === t.id
            return (
              <button key={t.id} type="button" onClick={() => onTemplate(t.id)} style={{ textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer', border: active ? '2px solid #1DB954' : '1px solid var(--border-default)', background: active ? 'rgba(29,185,84,0.06)' : 'var(--bg-base)', fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TemplateSkeleton pageType={pageType} id={t.id} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>{t.desc}</div>
              </button>
            )
          })}
        </div>
      </div>
      {FIELDS[pageType].map((f) => {
        if (f.type === 'image') {
          const url = content[f.key]
          return (
            <div key={f.key}>
              <div style={label}>{f.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 8 }}>
                {url ? <img src={url} alt="" style={{ width: 'min(100%, 300px)', maxHeight: 150, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border-default)' }} /> : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="secondary" type="button" disabled={uploadingField === f.key} onClick={() => { setPendingField(f.key); fileRef.current?.click() }}>{uploadingField === f.key ? 'Uploading…' : url ? 'Replace image' : 'Upload image'}</Button>
                  {url ? <Button variant="ghost" type="button" onClick={() => onField(f.key, '')}>Remove</Button> : null}
                </div>
              </div>
            </div>
          )
        }
        if (f.type === 'textarea') return (<div key={f.key}><div style={label}>{f.label}</div><textarea value={content[f.key] || ''} onChange={(e) => onField(f.key, e.target.value)} rows={f.rows || 4} placeholder={f.placeholder} style={{ ...inputStyle, marginTop: 8, resize: 'vertical', minHeight: 90 }} /></div>)
        return (<div key={f.key}><div style={label}>{f.label}</div><input value={content[f.key] || ''} onChange={(e) => onField(f.key, e.target.value)} placeholder={f.placeholder} style={{ ...inputStyle, marginTop: 8 }} /></div>)
      })}
      {pageType !== 'home' ? (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-primary)' }}>
          <span>Show this page in the menu</span>
          <input type="checkbox" checked={visible} onChange={(e) => onVisible(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1DB954' }} />
        </label>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="primary" type="button" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : `Save ${PAGE_LABEL[pageType]} page`}</Button>
        {saved ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
      </div>
    </div>
  )
}

function GalleryManager({ items, uploading, albumInput, setAlbumInput, onUpload, onSetCategory, onToggleFeatured, onDelete, styles }) {
  const fileRef = useRef(null)
  const { inputStyle, label } = styles
  const albums = useMemo(() => {
    const groups = {}
    items.forEach((it) => { const k = (it.category || '').trim() || 'Unsorted'; (groups[k] = groups[k] || []).push(it) })
    return Object.entries(groups).sort((a, b) => (a[0] === 'Unsorted' ? 1 : b[0] === 'Unsorted' ? -1 : a[0].localeCompare(b[0])))
  }, [items])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>Create albums for different parts of your work (e.g. Weddings, Portraits, Commercial). Each album becomes a tab on your Gallery, and visitors also get an "All" tab showing every photo. Tick "Feature on Home" to show a photo on your landing page.</p>
      <div style={{ border: '1px dashed var(--border-default)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={label}>Add to album</div>
        <input value={albumInput} onChange={(e) => setAlbumInput(e.target.value)} placeholder="Album name (e.g. Weddings) — leave blank for Unsorted" style={inputStyle} />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files; if (fl?.length) onUpload(Array.from(fl)); if (fileRef.current) fileRef.current.value = '' }} />
        <div><Button variant="primary" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : albumInput.trim() ? `Upload to "${albumInput.trim()}"` : 'Upload photos'}</Button></div>
      </div>
      {items.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>No photos yet.</p> : albums.map(([album, photos]) => (
        <div key={album} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{album} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {photos.length}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            {photos.map((it) => (
              <div key={it.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ aspectRatio: '4/3', background: '#111', overflow: 'hidden' }}>
                  {it.file_type === 'video' ? <video src={it.file_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={it.file_url || it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input defaultValue={it.category || ''} placeholder="Album" onBlur={(e) => { if ((e.target.value || '') !== (it.category || '')) onSetCategory(it, e.target.value.trim()) }} style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!it.featured} onChange={(e) => onToggleFeatured(it, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#1DB954' }} /> Feature on Home
                  </label>
                  <Button variant="ghost" size="sm" type="button" onClick={() => onDelete(it)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const emptyService = () => ({ id: null, name: '', description: '', price: '', image_url: '' })

function ServiceRow({ s, idx, onChangeLocal, onSaveRow, onDeleteRow, onUploadImage, uploading, inputStyle, isMobile }) {
  const fileRef = useRef(null)
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, background: 'var(--bg-base)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '130px 1fr', gap: 12, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: '100%', aspectRatio: '3/2', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.image_url ? <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>No photo</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadImage(idx, f); if (fileRef.current) fileRef.current.value = '' }} />
        <Button variant="secondary" size="sm" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : s.image_url ? 'Replace photo' : 'Add photo'}</Button>
        {s.image_url ? <Button variant="ghost" size="sm" type="button" onClick={() => onChangeLocal(idx, { image_url: '' })}>Remove</Button> : null}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <input value={s.name || ''} onChange={(e) => onChangeLocal(idx, { name: e.target.value })} style={inputStyle} placeholder="Service name (e.g. Wedding collection)" />
        <textarea value={s.description || ''} onChange={(e) => onChangeLocal(idx, { description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Short description" />
        <input value={s.price || ''} onChange={(e) => onChangeLocal(idx, { price: e.target.value })} style={inputStyle} placeholder="Price (e.g. From $2,500, POA)" />
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="primary" size="sm" type="button" onClick={() => onSaveRow(s, idx)} disabled={s.isSaving}>{s.isSaving ? 'Saving…' : 'Save'}</Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => onDeleteRow(s, idx)}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

function ServicesManager({ services, onChangeLocal, onAddRow, onSaveRow, onDeleteRow, onUploadImage, uploadingIdx, savedFlash, styles, isMobile }) {
  const { inputStyle } = styles
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>List what you offer. Add a photo, name, description and price — these show as cards on your Services page.</p>
      {services.map((s, idx) => <ServiceRow key={s.id ?? `new-${idx}`} s={s} idx={idx} onChangeLocal={onChangeLocal} onSaveRow={onSaveRow} onDeleteRow={onDeleteRow} onUploadImage={onUploadImage} uploading={uploadingIdx === idx} inputStyle={inputStyle} isMobile={isMobile} />)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="secondary" type="button" onClick={onAddRow}>Add service</Button>
        {savedFlash ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
      </div>
    </div>
  )
}

function LockedPanel({ pageLabel }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)' }}>{pageLabel} is an Expert feature</div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', maxWidth: 420, lineHeight: 1.6 }}>Upgrade to Expert or Elite to add a {pageLabel} page to your website.</p>
      <Link to="/pricing"><Button variant="primary" size="sm">View plans</Button></Link>
    </div>
  )
}

function Seg({ value, options, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = value === o.v
        return <button key={o.label} type="button" onClick={() => onChange(o.v)} style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, border: active ? '1px solid #1DB954' : '1px solid var(--border-default)', background: active ? 'rgba(29,185,84,0.12)' : 'var(--bg-base)', color: active ? '#1DB954' : 'var(--text-primary)' }}>{o.label}</button>
      })}
    </div>
  )
}

const DESIGN_PAGES = [{ id: 'all', label: 'All pages' }, { id: 'home', label: 'Home' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'services', label: 'Services' }, { id: 'contact', label: 'Contact' }]

function jump(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

function DesignEditor({ scope, setScope, active, customised, onCustomised, onApplyPalette, onApplyStyle, onChange, logo, onUploadLogo, uploadingLogo, onSave, saving, saved, styles, isMobile }) {
  const logoRef = useRef(null)
  const { inputStyle, label } = styles
  const small = { ...label, textTransform: 'none', letterSpacing: 0, fontSize: 12, color: 'var(--text-secondary)' }
  const autoText = !active.colors.text
  const editingPage = scope !== 'all'
  const disabled = editingPage && !customised
  const P = resolveTheme({ site_theme: active, site_logo_url: logo }, null)
  const paletteActiveId = (PALETTES.find((p) => p.primary === active.colors.primary && p.background === active.colors.background) || {}).id
  const styleActiveId = (STYLES.find((s) => s.fonts.heading === active.fonts.heading && Number(s.buttons.radius) === Number(active.buttons.radius) && Number(s.corners.radius) === Number(active.corners.radius)) || {}).id
  const colorRow = (val, on) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <input type="color" value={/^#/.test(val || '') ? val : '#000000'} onChange={(e) => on(e.target.value)} style={{ width: 44, height: 38, border: '1px solid var(--border-default)', borderRadius: 8, background: 'none', cursor: 'pointer', padding: 2 }} />
      <input value={val || ''} onChange={(e) => on(e.target.value)} style={{ ...inputStyle, maxWidth: 120 }} />
    </div>
  )
  const clickable = (id) => ({ cursor: 'pointer' })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) 300px', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Scope selector */}
        <div>
          <div style={label}>Applies to</div>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Style your whole site at once, or pick a page to give it its own look.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {DESIGN_PAGES.map((pg) => {
              const on = scope === pg.id
              const isOverridden = pg.id !== 'all' && customisedMap(active, pg.id)
              return <button key={pg.id} type="button" onClick={() => setScope(pg.id)} style={{ padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, border: on ? '1px solid #1DB954' : '1px solid var(--border-default)', background: on ? 'rgba(29,185,84,0.12)' : 'var(--bg-base)', color: on ? '#1DB954' : 'var(--text-primary)' }}>{pg.label}</button>
            })}
          </div>
          {editingPage && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={customised} onChange={(e) => onCustomised(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1DB954' }} />
              Customise this page (otherwise it uses your site styles)
            </label>
          )}
        </div>

        <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Palette + Style */}
          <div>
            <div style={label}>Colour palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, marginTop: 10 }}>
              {PALETTES.map((p) => {
                const on = paletteActiveId === p.id
                return (
                  <button key={p.id} type="button" onClick={() => onApplyPalette(p)} style={{ padding: 8, borderRadius: 10, cursor: 'pointer', border: on ? '2px solid #1DB954' : '1px solid var(--border-default)', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', width: '100%', height: 24, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}><span style={{ flex: 1, background: p.background }} /><span style={{ flex: 1, background: p.primary }} /></div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{p.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div style={label}>Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginTop: 10 }}>
              {STYLES.map((s) => {
                const on = styleActiveId === s.id
                return (
                  <button key={s.id} type="button" onClick={() => onApplyStyle(s)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: on ? '2px solid #1DB954' : '1px solid var(--border-default)', background: 'var(--bg-base)', textAlign: 'left' }}>
                    <div style={{ fontFamily: `"${s.fonts.heading}", serif`, fontWeight: s.fonts.headingWeight, fontSize: 17, color: 'var(--text-primary)', lineHeight: 1 }}>Aa</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginTop: 6 }}>{s.name}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Colours */}
          <div id="wb-colours">
            <div style={label}>Colours</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginTop: 10 }}>
              <div><div style={small}>Accent</div>{colorRow(active.colors.primary, (v) => onChange('colors', 'primary', v))}</div>
              <div><div style={small}>Background</div>{colorRow(active.colors.background, (v) => onChange('colors', 'background', v))}</div>
              <div>
                <div style={small}>Text</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', margin: '6px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoText} onChange={(e) => onChange('colors', 'text', e.target.checked ? '' : '#17151c')} style={{ width: 16, height: 16, accentColor: '#1DB954' }} /> Auto (from background)
                </label>
                {!autoText && colorRow(active.colors.text, (v) => onChange('colors', 'text', v))}
              </div>
            </div>
          </div>

          {/* Typography */}
          <div id="wb-typography">
            <div style={label}>Typography</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginTop: 10 }}>
              <div><div style={small}>Heading font</div><select value={active.fonts.heading} onChange={(e) => onChange('fonts', 'heading', e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>{FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
              <div><div style={small}>Body font</div><select value={active.fonts.body} onChange={(e) => onChange('fonts', 'body', e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>{FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
              <div><div style={small}>Text size</div><div style={{ marginTop: 6 }}><Seg value={active.fonts.baseSize} options={SIZE_OPTIONS} onChange={(v) => onChange('fonts', 'baseSize', v)} /></div></div>
              <div><div style={small}>Heading weight</div><div style={{ marginTop: 6 }}><Seg value={active.fonts.headingWeight} options={WEIGHT_OPTIONS} onChange={(v) => onChange('fonts', 'headingWeight', v)} /></div></div>
            </div>
          </div>

          {/* Buttons */}
          <div id="wb-buttons">
            <div style={label}>Buttons</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 10 }}>
              <div><div style={small}>Shape</div><div style={{ marginTop: 6 }}><Seg value={active.buttons.radius} options={BTN_SHAPES} onChange={(v) => onChange('buttons', 'radius', v)} /></div></div>
              <div><div style={small}>Style</div><div style={{ marginTop: 6 }}><Seg value={active.buttons.style} options={[{ label: 'Solid', v: 'solid' }, { label: 'Outline', v: 'outline' }]} onChange={(v) => onChange('buttons', 'style', v)} /></div></div>
            </div>
          </div>

          {/* Corners */}
          <div id="wb-corners">
            <div style={label}>Corners</div>
            <p style={{ margin: '6px 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Roundness of cards and images.</p>
            <Seg value={active.corners.radius} options={CORNERS} onChange={(v) => onChange('corners', 'radius', v)} />
          </div>
        </div>

        {/* Logo (global only) */}
        {!editingPage && (
          <div id="wb-logo">
            <div style={label}>Logo</div>
            <p style={{ margin: '6px 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Shown in your website header. Leave blank to show your business name.</p>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadLogo(f); if (logoRef.current) logoRef.current.value = '' }} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {logo ? <img src={logo} alt="" style={{ height: 40, objectFit: 'contain', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 4 }} /> : null}
              <Button variant="secondary" type="button" disabled={uploadingLogo} onClick={() => logoRef.current?.click()}>{uploadingLogo ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}</Button>
              {logo ? <Button variant="ghost" type="button" onClick={() => onUploadLogo(null)}>Remove</Button> : null}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save design'}</Button>
          {saved ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
        </div>
      </div>

      {/* Live preview (click a region to jump to its control) */}
      <div style={{ position: isMobile ? 'static' : 'sticky', top: 12 }}>
        <div style={label}>Live preview{editingPage ? ` · ${scope}` : ''}</div>
        <div style={{ marginTop: 8, border: '1px solid var(--border-default)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: P.bg, padding: 18, fontFamily: P.bodyFont }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }} onClick={() => jump('wb-logo')} title="Logo & name">
              {logo ? <img src={logo} alt="" style={{ height: 20, objectFit: 'contain' }} /> : <span style={{ fontFamily: P.headingFont, fontWeight: P.headingWeight, color: P.heading, fontSize: 15 }}>Studio</span>}
              <span style={{ fontSize: 11, color: P.soft }}>Home · About · Contact</span>
            </div>
            <div onClick={() => jump('wb-typography')} title="Typography" style={{ cursor: 'pointer' }}>
              <div style={{ fontFamily: P.headingFont, fontWeight: P.headingWeight, color: P.heading, fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Your headline</div>
              <div style={{ color: P.soft, fontSize: P.baseSize - 3, lineHeight: 1.6, margin: '8px 0 14px' }}>A short line about the work you do and who you help.</div>
            </div>
            <span onClick={() => jump('wb-buttons')} title="Buttons" style={{ display: 'inline-block', padding: '9px 18px', borderRadius: P.btnRadius, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: P.btnStyle === 'outline' ? 'transparent' : P.accent, color: P.btnStyle === 'outline' ? P.accent : '#fff', border: P.btnStyle === 'outline' ? `2px solid ${P.accent}` : 'none' }}>Enquire Now</span>
            <div onClick={() => jump('wb-corners')} title="Corners" style={{ cursor: 'pointer', marginTop: 16, background: P.surface, border: `1px solid ${P.surfaceBorder}`, borderRadius: P.radius, padding: 12 }}>
              <div style={{ color: P.accent, fontSize: 12, marginBottom: 6 }}>★★★★★</div>
              <div style={{ color: P.ink, fontSize: 12.5, fontStyle: 'italic', lineHeight: 1.5 }}>"Absolutely brilliant to work with."</div>
            </div>
          </div>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>Tip: click a part of the preview to jump to its setting. Save to apply.</p>
      </div>
    </div>
  )
}

function customisedMap(active, pageId) { return false }


export default function WebsiteBuilderPage() {
  const { user, profile, fetchUserData } = useAuth()
  const { tier } = useSubscription()
  const fullBuilder = tier === 'expert' || tier === 'elite'
  const proOnePage = tier === 'pro'
  const canBuild = fullBuilder || proOnePage
  const editablePages = fullBuilder ? PAGE_ORDER : proOnePage ? ['home', 'contact'] : []

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [pages, setPages] = useState({})
  const [loadingPages, setLoadingPages] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [savingPage, setSavingPage] = useState('')
  const [savedPage, setSavedPage] = useState('')
  const [uploadingField, setUploadingField] = useState('')

  const [gallery, setGallery] = useState([])
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [albumInput, setAlbumInput] = useState('')

  const [services, setServices] = useState([])
  const [servicesSaved, setServicesSaved] = useState(false)
  const [uploadingServiceIdx, setUploadingServiceIdx] = useState(-1)

  const [areas, setAreas] = useState([])
  const [areaInput, setAreaInput] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [links, setLinks] = useState({ website: '', instagram_url: '', tiktok_url: '', facebook_url: '', linkedin_url: '', twitter_url: '' })
  const [theme, setTheme] = useState(() => normalizeTheme(null))
  const [siteLogo, setSiteLogo] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingDesign, setSavingDesign] = useState(false)
  const [designSaved, setDesignSaved] = useState(false)
  const [designScope, setDesignScope] = useState('all')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => { function r() { setIsMobile(window.innerWidth < 768) } window.addEventListener('resize', r); return () => window.removeEventListener('resize', r) }, [])

  useEffect(() => {
    if (!profile) return
    setAreas(Array.isArray(profile.site_service_areas) ? profile.site_service_areas : [])
    setSeoTitle(profile.site_seo_title ?? '')
    setSeoDesc(profile.site_seo_description ?? '')
    setLinks({
      website: profile.website ?? '', instagram_url: profile.instagram_url ?? '', tiktok_url: profile.tiktok_url ?? '',
      facebook_url: profile.facebook_url ?? '', linkedin_url: profile.linkedin_url ?? '', twitter_url: profile.twitter_url ?? '',
    })
    // Load theme: prefer site_theme; else migrate any legacy site_* columns.
    const lc = {}; if (profile.site_primary_color) lc.primary = profile.site_primary_color; if (profile.site_background_color) lc.background = profile.site_background_color
    const lf = {}; if (profile.site_heading_font) lf.heading = profile.site_heading_font; if (profile.site_body_font) lf.body = profile.site_body_font
    const legacy = (Object.keys(lc).length || Object.keys(lf).length) ? { colors: lc, fonts: lf } : null
    setTheme(normalizeTheme(profile.site_theme || legacy))
    setSiteLogo(profile.site_logo_url || null)
  }, [profile])

  const loadAll = useCallback(async () => {
    if (!user?.id || !supabase || !canBuild) { setLoadingPages(false); return }
    setLoadingPages(true)
    const [pagesRes, galRes, svcRes] = await Promise.all([
      supabase.from('site_pages').select('*').eq('creative_id', user.id),
      supabase.from('portfolio_items').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }),
      supabase.from('portfolio_services').select('*').eq('creative_id', user.id).order('sort_order', { ascending: true }),
    ])
    const byType = {}
    ;(pagesRes.data ?? []).forEach((r) => { byType[r.page_type] = { id: r.id, template: r.template || 't1', content: r.content || {}, visible: r.visible !== false } })
    const toSeed = editablePages.filter((pt) => CONTENT_PAGES.includes(pt) && !byType[pt])
    if (toSeed.length) {
      const rows = toSeed.map((pt) => ({ creative_id: user.id, page_type: pt, template: 't1', content: {}, visible: true, position: PAGE_ORDER.indexOf(pt) }))
      const { data: seeded } = await supabase.from('site_pages').insert(rows).select()
      ;(seeded ?? []).forEach((r) => { byType[r.page_type] = { id: r.id, template: r.template || 't1', content: r.content || {}, visible: r.visible !== false } })
    }
    setPages(byType)
    setGallery(galRes.data ?? [])
    setServices((svcRes.data ?? []).map((s) => ({ ...s, isSaving: false })))
    setLoadingPages(false)
  }, [user?.id, canBuild, fullBuilder, proOnePage])

  useEffect(() => { loadAll() }, [loadAll])

  function setField(pt, key, value) { setPages((p) => ({ ...p, [pt]: { ...p[pt], content: { ...(p[pt]?.content || {}), [key]: value } } })) }
  function setTemplate(pt, template) { setPages((p) => ({ ...p, [pt]: { ...p[pt], template } })) }
  function setVisible(pt, visible) { setPages((p) => ({ ...p, [pt]: { ...p[pt], visible } })) }

  async function uploadImage(pt, field, file) {
    if (!user?.id || !supabase) return
    setUploadingField(field)
    try {
      const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg'
      const path = `${user.id}/site/${pt}/${field}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
      setField(pt, field, pub.publicUrl)
    } catch (e) { window.alert(e.message || 'Upload failed') } finally { setUploadingField('') }
  }

  async function savePage(pt) {
    if (!user?.id || !supabase) return
    const p = pages[pt]; if (!p) return
    setSavingPage(pt)
    try {
      const row = { creative_id: user.id, page_type: pt, template: p.template || 't1', content: p.content || {}, visible: p.visible !== false, position: PAGE_ORDER.indexOf(pt), updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from('site_pages').upsert(row, { onConflict: 'creative_id,page_type' }).select().single()
      if (error) throw error
      setPages((prev) => ({ ...prev, [pt]: { id: data.id, template: data.template || 't1', content: data.content || {}, visible: data.visible !== false } }))
      setSavedPage(pt); setTimeout(() => setSavedPage(''), 2600)
    } catch (e) { window.alert(e.message || 'Could not save this page.') } finally { setSavingPage('') }
  }

  async function galleryUpload(files) {
    if (!user?.id || !supabase) return
    setGalleryUploading(true)
    const cat = albumInput.trim() || null
    try {
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${user.id}/gallery/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, file)
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
        const isVideo = (file.type || '').startsWith('video/')
        const { data, error } = await supabase.from('portfolio_items').insert({ user_id: user.id, creative_id: user.id, file_url: pub.publicUrl, file_type: isVideo ? 'video' : 'image', category: cat, featured: false, sort_order: gallery.length }).select().single()
        if (error) throw error
        setGallery((prev) => [...prev, data])
      }
    } catch (e) { window.alert(e.message || 'Upload failed') } finally { setGalleryUploading(false) }
  }
  async function gallerySetCategory(item, category) { setGallery((prev) => prev.map((g) => (g.id === item.id ? { ...g, category } : g))); await supabase.from('portfolio_items').update({ category: category || null }).eq('id', item.id) }
  async function galleryToggleFeatured(item, featured) { setGallery((prev) => prev.map((g) => (g.id === item.id ? { ...g, featured } : g))); await supabase.from('portfolio_items').update({ featured }).eq('id', item.id) }
  async function galleryDelete(item) { if (!window.confirm('Delete this photo?')) return; await supabase.from('portfolio_items').delete().eq('id', item.id); setGallery((prev) => prev.filter((g) => g.id !== item.id)) }

  function serviceChangeLocal(idx, patch) { setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))) }
  function serviceAddRow() { setServices((prev) => [...prev, { ...emptyService(), isSaving: false }]) }
  async function serviceSaveRow(service, idx) {
    if (!user?.id || !supabase) return
    const name = (service.name || '').trim()
    if (!name) { window.alert('Service name is required.'); return }
    serviceChangeLocal(idx, { isSaving: true })
    try {
      if (service.id) {
        const { error } = await supabase.from('portfolio_services').update({ name, description: (service.description || '').trim() || null, price: (service.price || '').trim() || null, image_url: service.image_url || null }).eq('id', service.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('portfolio_services').insert({ creative_id: user.id, name, description: (service.description || '').trim() || null, price: (service.price || '').trim() || null, image_url: service.image_url || null, sort_order: idx }).select().single()
        if (error) throw error
        setServices((prev) => prev.map((s, i) => (i === idx ? { ...data, isSaving: false } : s)))
      }
      flash(setServicesSaved, 2000)
    } catch (e) { window.alert(e.message || 'Could not save service') } finally { serviceChangeLocal(idx, { isSaving: false }) }
  }
  async function serviceDeleteRow(service, idx) { if (service.id && !window.confirm('Delete this service?')) return; if (service.id) await supabase.from('portfolio_services').delete().eq('id', service.id); setServices((prev) => prev.filter((_, i) => i !== idx)) }
  async function serviceUploadImage(idx, file) {
    if (!user?.id || !supabase) return
    setUploadingServiceIdx(idx)
    try {
      const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg'
      const path = `${user.id}/services/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
      serviceChangeLocal(idx, { image_url: pub.publicUrl })
      const svc = services[idx]
      if (svc && svc.id) await supabase.from('portfolio_services').update({ image_url: pub.publicUrl }).eq('id', svc.id)
    } catch (e) { window.alert(e.message || 'Upload failed') } finally { setUploadingServiceIdx(-1) }
  }

  function addArea() { const v = areaInput.trim(); if (!v) return; if (areas.some((a) => a.toLowerCase() === v.toLowerCase())) { setAreaInput(''); return } setAreas((p) => [...p, v]); setAreaInput('') }
  async function saveSettings() {
    if (!user?.id || !supabase) return
    setSavingSettings(true)
    const patch = {
      site_service_areas: areas, site_seo_title: seoTitle.trim() || null, site_seo_description: seoDesc.trim() || null,
      website: links.website.trim() || null, instagram_url: links.instagram_url.trim() || null, tiktok_url: links.tiktok_url.trim() || null,
      facebook_url: links.facebook_url.trim() || null, linkedin_url: links.linkedin_url.trim() || null, twitter_url: links.twitter_url.trim() || null,
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    setSavingSettings(false)
    if (error) { window.alert(error.message); return }
    await fetchUserData(user.id)
    flash(setSettingsSaved)
  }

  // ---- design / site theme ----
  // Scope-aware theme editing: 'all' edits the global theme; a page id edits
  // that page's override (a partial theme merged over the global at render).
  const designPage = designScope === 'all' ? null : designScope
  const pageCustomised = designPage ? !!(theme.pageOverrides && theme.pageOverrides[designPage]) : false
  const activeDesign = designPage ? mergeTheme(normalizeTheme(theme), theme.pageOverrides?.[designPage] || {}) : normalizeTheme(theme)

  function setGlobalPart(section, key, value) { setTheme((t) => ({ ...t, [section]: { ...t[section], [key]: value } })) }
  function setOverridePart(page, section, key, value) {
    setTheme((t) => {
      const po = { ...(t.pageOverrides || {}) }
      const cur = { ...(po[page] || {}) }
      cur[section] = { ...(cur[section] || {}), [key]: value }
      po[page] = cur
      return { ...t, pageOverrides: po }
    })
  }
  function onDesignChange(section, key, value) {
    if (designPage) setOverridePart(designPage, section, key, value)
    else setGlobalPart(section, key, value)
  }
  function applyPalette(p) { onDesignChange('colors', 'primary', p.primary); onDesignChange('colors', 'background', p.background) }
  function applyStyle(s) {
    ;['heading', 'body', 'baseSize', 'headingWeight'].forEach((k) => onDesignChange('fonts', k, s.fonts[k]))
    onDesignChange('buttons', 'radius', s.buttons.radius); onDesignChange('buttons', 'style', s.buttons.style)
    onDesignChange('corners', 'radius', s.corners.radius)
  }
  function setPageCustomised(on) {
    if (!designPage) return
    setTheme((t) => {
      const po = { ...(t.pageOverrides || {}) }
      if (on) { if (!po[designPage]) po[designPage] = {} }
      else { delete po[designPage] }
      return { ...t, pageOverrides: po }
    })
  }
  async function uploadLogo(file) {
    if (file === null) { setSiteLogo(null); return }
    if (!user?.id || !supabase) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'png'
      const path = `${user.id}/site/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
      setSiteLogo(pub.publicUrl)
    } catch (e) { window.alert(e.message || 'Upload failed') } finally { setUploadingLogo(false) }
  }
  async function saveDesign() {
    if (!user?.id || !supabase) return
    setSavingDesign(true)
    const patch = {
      site_theme: theme, site_logo_url: siteLogo || null,
      site_primary_color: theme.colors.primary || null, site_background_color: theme.colors.background || null,
      site_heading_font: theme.fonts.heading || null, site_body_font: theme.fonts.body || null,
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    setSavingDesign(false)
    if (error) { window.alert(error.message); return }
    await fetchUserData(user.id)
    flash(setDesignSaved)
  }

  const card = { ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }
  const label = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }
  const inputStyle = { ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: 8 }
  const editorStyles = { inputStyle, label }

  if (!user) return <div style={{ padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Sign in to manage your website.</div>

  if (!canBuild) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '28px 32px', maxWidth: 720, margin: '0 auto' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>Website</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 8, lineHeight: 1.6 }}>Turn your profile into a full multi-page website in your own brand, with a gallery, services and enquiries flowing straight into your CRM.</p>
        </div>
        <div style={{ ...card, textAlign: 'center', alignItems: 'center', gap: 20, padding: '40px 28px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)' }}>Unlock the website builder</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>Pro gets a Home and Contact page. Expert and Elite unlock the full site: About, Gallery and Services too, plus social links and your external website link.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link to="/pricing"><Button variant="primary">View plans</Button></Link>
            <Link to="/dashboard/settings/subscription"><Button variant="secondary">Manage subscription</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  const isContentPage = CONTENT_PAGES.includes(activeTab)
  const activeEditable = activeTab === 'settings' || activeTab === 'design' || editablePages.includes(activeTab)
  const activeData = pages[activeTab] || { template: 't1', content: {}, visible: true }
  const profileHref = `/creatives/${user.id}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: isMobile ? 16 : '28px 24px 48px', maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }} className="website-builder-page">
      <style>{`@media (max-width: 767px){ .website-builder-page h1{font-size:24px !important} .website-builder-page input,.website-builder-page textarea{font-size:14px !important} }`}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 28px)', color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>Website</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 8, lineHeight: 1.6 }}>
            {proOnePage ? "You're on Pro: a Home and Contact page. Upgrade to Expert for About, Gallery and Services." : 'Your profile is your website. Edit each page below; it updates your public profile live.'}
          </p>
        </div>
        <a href={profileHref} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm" type="button">View my profile</Button></a>
      </header>

      <section style={card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((pt) => {
            const locked = pt !== 'settings' && pt !== 'design' && !editablePages.includes(pt)
            const active = activeTab === pt
            return (
              <button key={pt} type="button" onClick={() => setActiveTab(pt)} style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 600, border: active ? '1px solid #1DB954' : '1px solid var(--border-default)', background: active ? 'rgba(29,185,84,0.12)' : 'var(--bg-base)', color: active ? '#1DB954' : locked ? 'var(--text-muted)' : 'var(--text-primary)' }}>{PAGE_LABEL[pt]}{locked ? ' 🔒' : ''}</button>
            )
          })}
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

        {activeTab === 'design' ? (
          <DesignEditor scope={designScope} setScope={setDesignScope} active={activeDesign} customised={pageCustomised} onCustomised={setPageCustomised} onApplyPalette={applyPalette} onApplyStyle={applyStyle} onChange={onDesignChange} logo={siteLogo} onUploadLogo={uploadLogo} uploadingLogo={uploadingLogo} onSave={saveDesign} saving={savingDesign} saved={designSaved} styles={editorStyles} isMobile={isMobile} />
        ) : activeTab === 'settings' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={label}>Social links & website</div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>These appear as icons in your footer and on your Contact page.</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 10 }}>
                {SOCIAL_FIELDS.map((f) => (
                  <div key={f.key}>
                    <div style={{ ...label, textTransform: 'none', letterSpacing: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{f.label}</div>
                    <input value={links[f.key]} onChange={(e) => setLinks((l) => ({ ...l, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ ...inputStyle, marginTop: 6 }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={label}>Areas covered</div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Suburbs or regions you serve. Shown on your Home and Contact pages.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <input value={areaInput} onChange={(e) => setAreaInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArea() } }} placeholder="e.g. Sydney" style={{ ...inputStyle, maxWidth: 240, flex: '1 1 160px' }} />
                <Button variant="secondary" type="button" onClick={addArea}>Add</Button>
              </div>
              {areas.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {areas.map((a, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 999, padding: '5px 6px 5px 12px' }}>{a}<button type="button" onClick={() => setAreas((p) => p.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '0 4px' }} aria-label={`Remove ${a}`}>×</button></span>
                  ))}
                </div>
              ) : null}
            </div>
            <div><div style={label}>Search title (SEO)</div><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="e.g. Jane Doe Photography | Sydney Weddings" style={{ ...inputStyle, marginTop: 8 }} /></div>
            <div><div style={label}>Search description (SEO)</div><textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} rows={3} placeholder="A short sentence that appears in Google results." style={{ ...inputStyle, marginTop: 8, resize: 'vertical', minHeight: 72 }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save settings'}</Button>
              {settingsSaved ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
            </div>
          </div>
        ) : loadingPages ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>Loading…</p>
        ) : !activeEditable ? (
          <LockedPanel pageLabel={PAGE_LABEL[activeTab]} />
        ) : activeTab === 'gallery' ? (
          <GalleryManager items={gallery} uploading={galleryUploading} albumInput={albumInput} setAlbumInput={setAlbumInput} onUpload={galleryUpload} onSetCategory={gallerySetCategory} onToggleFeatured={galleryToggleFeatured} onDelete={galleryDelete} styles={editorStyles} />
        ) : activeTab === 'services' ? (
          <ServicesManager services={services} onChangeLocal={serviceChangeLocal} onAddRow={serviceAddRow} onSaveRow={serviceSaveRow} onDeleteRow={serviceDeleteRow} onUploadImage={serviceUploadImage} uploadingIdx={uploadingServiceIdx} savedFlash={servicesSaved} styles={editorStyles} isMobile={isMobile} />
        ) : isContentPage ? (
          <PageEditor key={activeTab} pageType={activeTab} content={activeData.content || {}} template={activeData.template || 't1'} visible={activeData.visible !== false} onField={(k, v) => setField(activeTab, k, v)} onTemplate={(t) => setTemplate(activeTab, t)} onVisible={(v) => setVisible(activeTab, v)} onUploadImage={(field, file) => uploadImage(activeTab, field, file)} uploadingField={uploadingField} onSave={() => savePage(activeTab)} saving={savingPage === activeTab} saved={savedPage === activeTab} styles={editorStyles} />
        ) : null}
      </section>
    </div>
  )
}
