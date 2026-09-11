import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import { PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE, partitionFilesByPortfolioImageModeration } from '../../lib/moderateContent'
import { FONT_OPTIONS, PALETTES, STYLES, DEFAULT_THEME, normalizeTheme, mergeTheme, resolveTheme } from '../../lib/siteTheme'

// Website builder — edits the creative's PROFILE-as-website. Content pages
// (Home/About/Contact) live in site_pages; Gallery uses portfolio_items grouped
// into albums by `category` (with `featured` showing on Home); Services uses
// portfolio_services; social links + website live on the profile.
// Gating: Expert/Elite = full builder; Pro = Home + Contact; Basic = upsell.
//
// Theme-aware chrome (light + dark) on the --lt-* tokens. NOTE: the Design tab's
// live preview renders the creative's OWN site theme (resolveTheme -> P.*) and is
// intentionally left on the creative's brand colours, not the --lt-* tokens.

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const PINK = '#FF2D78'
const FONT = { fontFamily: 'Inter, sans-serif' }

// Glass + field recipes on the theme tokens.
const glassCard = {
  background: 'var(--lt-glass-bg)',
  border: 'var(--lt-glass-border)',
  boxShadow: 'var(--lt-glass-shadow)',
  backdropFilter: 'var(--lt-glass-blur)',
  WebkitBackdropFilter: 'var(--lt-glass-blur)',
}
const field = {
  background: 'var(--lt-input-bg)',
  border: '1px solid var(--lt-input-border)',
  color: 'var(--lt-text)',
  fontFamily: 'inherit',
  outline: 'none',
}

function Btn({ variant = 'primary', size = 'md', children, style, disabled, ...props }) {
  const pad = size === 'sm' ? '7px 14px' : '10px 18px'
  const fs = size === 'sm' ? 12.5 : 13.5
  const variants = {
    primary: { background: GREEN, color: GREEN_TEXT, border: '1px solid transparent' },
    secondary: { background: 'var(--lt-surface)', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
    ghost: { background: 'transparent', color: 'var(--lt-text)', border: '1px solid var(--lt-border)' },
  }
  return (
    <button {...props} disabled={disabled}
      style={{ padding: pad, fontSize: fs, fontWeight: 700, borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'transform .12s ease, opacity .12s ease', opacity: disabled ? 0.55 : 1, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

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
  services: [
    { id: 't1', name: 'Cards', desc: 'A grid of cards, each with a photo, name and price.' },
    { id: 't2', name: 'List', desc: 'Rows with the photo on the left and details on the right.' },
    { id: 't3', name: 'Price list', desc: 'A clean text price list, no photos.' },
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
  const box = { background: 'var(--lt-surface)', border: '1px solid var(--lt-hairline)', borderRadius: 4 }
  const bar = (w, h = 6) => ({ height: h, width: w, borderRadius: 3, background: 'var(--lt-border)' })
  const accent = { background: '#1DB954' }
  const frame = { height: 92, borderRadius: 8, padding: 8, display: 'flex', gap: 6, overflow: 'hidden', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-hairline)' }
  const col = { display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }
  if (pageType === 'home') {
    if (id === 't2') return (<div style={frame}><div style={{ ...col, flex: 1, padding: 4 }}><div style={bar('80%', 10)} /><div style={bar('60%')} /><div style={{ ...bar('34%', 12), ...accent, marginTop: 4 }} /></div><div style={{ ...box, flex: 1 }} /></div>)
    if (id === 't3') return (<div style={{ ...frame, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10 }}><div style={{ width: 22, height: 12, borderRadius: 3, background: 'var(--lt-border)', marginBottom: 4 }} /><div style={bar('62%', 11)} /><div style={bar('40%')} /><div style={{ ...bar('30%', 12), ...accent, marginTop: 4 }} /></div>)
    return (<div style={{ ...frame, position: 'relative', padding: 0, alignItems: 'center', justifyContent: 'center' }}><div style={{ position: 'absolute', inset: 0, background: 'var(--lt-border)', borderRadius: 8, opacity: 0.5 }} /><div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}><div style={{ ...bar(54, 12), background: '#fff' }} /><div style={{ ...bar(34), background: 'rgba(255,255,255,0.8)' }} /></div></div>)
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
  if (pageType === 'services') {
    if (id === 't2') return (<div style={{ ...frame, flexDirection: 'column', gap: 6, padding: 8 }}>{[0, 1].map((i) => <div key={i} style={{ display: 'flex', gap: 6, flex: 1 }}><div style={{ ...box, width: 30 }} /><div style={{ ...col, flex: 1, padding: 3 }}><div style={bar('60%', 6)} /><div style={{ ...bar('30%', 6), ...accent }} /></div></div>)}</div>)
    if (id === 't3') return (<div style={{ ...frame, flexDirection: 'column', justifyContent: 'center', gap: 8, padding: 12 }}>{[0, 1, 2].map((i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: i ? '1px solid var(--lt-hairline)' : 'none', paddingTop: i ? 5 : 0 }}><div style={bar(46, 6)} /><div style={{ ...bar(20, 6), ...accent }} /></div>)}</div>)
    return (<div style={{ ...frame, gap: 6 }}>{[0, 1, 2].map((i) => <div key={i} style={{ ...box, flex: 1, display: 'flex', flexDirection: 'column' }}><div style={{ height: 34, background: 'var(--lt-border)' }} /><div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}><div style={bar('80%', 5)} /><div style={{ ...bar('40%', 5), ...accent }} /></div></div>)}</div>)
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
              <button key={t.id} type="button" onClick={() => onTemplate(t.id)} style={{ textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer', border: active ? '2px solid #1DB954' : '1px solid var(--lt-border)', background: active ? 'rgba(29,185,84,0.06)' : 'var(--lt-surface)', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TemplateSkeleton pageType={pageType} id={t.id} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--lt-text)' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--lt-faint)', lineHeight: 1.45 }}>{t.desc}</div>
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
                {url ? <img src={url} alt="" style={{ width: 'min(100%, 300px)', maxHeight: 150, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--lt-border)' }} /> : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn variant="secondary" type="button" disabled={uploadingField === f.key} onClick={() => { setPendingField(f.key); fileRef.current?.click() }}>{uploadingField === f.key ? 'Uploading…' : url ? 'Replace image' : 'Upload image'}</Btn>
                  {url ? <Btn variant="ghost" type="button" onClick={() => onField(f.key, '')}>Remove</Btn> : null}
                </div>
              </div>
            </div>
          )
        }
        if (f.type === 'textarea') return (<div key={f.key}><div style={label}>{f.label}</div><textarea value={content[f.key] || ''} onChange={(e) => onField(f.key, e.target.value)} rows={f.rows || 4} placeholder={f.placeholder} style={{ ...inputStyle, marginTop: 8, resize: 'vertical', minHeight: 90 }} /></div>)
        return (<div key={f.key}><div style={label}>{f.label}</div><input value={content[f.key] || ''} onChange={(e) => onField(f.key, e.target.value)} placeholder={f.placeholder} style={{ ...inputStyle, marginTop: 8 }} /></div>)
      })}
      {pageType !== 'home' ? (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--lt-hairline)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--lt-text)' }}>
          <span>Show this page in the menu</span>
          <input type="checkbox" checked={visible} onChange={(e) => onVisible(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1DB954' }} />
        </label>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Btn variant="primary" type="button" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : `Save ${PAGE_LABEL[pageType]} page`}</Btn>
        {saved ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'inherit' }}>Saved.</span> : null}
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
      <p style={{ margin: 0, fontSize: 13, color: 'var(--lt-faint)', fontFamily: 'inherit', lineHeight: 1.6 }}>Create albums for different parts of your work (e.g. Weddings, Portraits, Commercial). Each album becomes a tab on your Gallery, and visitors also get an "All" tab showing every photo. Tick "Feature on Home" to show a photo on your landing page (up to 12).</p>
      <div style={{ border: '1px dashed var(--lt-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={label}>Add to album</div>
        <input value={albumInput} onChange={(e) => setAlbumInput(e.target.value)} placeholder="Album name (e.g. Weddings) — leave blank for Unsorted" style={inputStyle} />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files; if (fl?.length) onUpload(Array.from(fl)); if (fileRef.current) fileRef.current.value = '' }} />
        <div><Btn variant="primary" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : albumInput.trim() ? `Upload to "${albumInput.trim()}"` : 'Upload photos'}</Btn></div>
      </div>
      {items.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--lt-faint)', fontFamily: 'inherit' }}>No photos yet.</p> : albums.map(([album, photos]) => (
        <div key={album} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)', fontFamily: 'inherit' }}>{album} <span style={{ color: 'var(--lt-faint)', fontWeight: 400 }}>· {photos.length}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            {photos.map((it) => (
              <div key={it.id} style={{ border: '1px solid var(--lt-hairline)', borderRadius: 12, overflow: 'hidden', background: 'var(--lt-surface)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ aspectRatio: '4/3', background: 'var(--lt-surface-2)', overflow: 'hidden' }}>
                  {it.file_type === 'video' ? <video src={it.file_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={it.file_url || it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input defaultValue={it.category || ''} placeholder="Album" onBlur={(e) => { if ((e.target.value || '') !== (it.category || '')) onSetCategory(it, e.target.value.trim()) }} style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--lt-muted)', fontFamily: 'inherit', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!it.featured} onChange={(e) => onToggleFeatured(it, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#1DB954' }} /> Feature on Home
                  </label>
                  <Btn variant="ghost" size="sm" type="button" onClick={() => onDelete(it)}>Delete</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// How many photos/videos show on the website's Home page.
const HOME_MEDIA_CAP = { pro: 8, expert: 12, elite: 12 }

// Home page photos and videos. Every plan with a website picks what shows on Home
// from their portfolio (the `featured` flag); Pro has no Gallery page, so this is
// where their work goes.
function HomeMediaManager({ items, cap, fullBuilder, uploading, notice, onUpload, onToggle, onDelete, onOpenGallery }) {
  const fileRef = useRef(null)
  const shownCount = items.filter((it) => it.featured).length
  const autoPick = shownCount === 0
  const atCap = shownCount >= cap
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 20, borderTop: '1px solid var(--lt-hairline)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Photos and videos on your Home page</div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--lt-faint)', lineHeight: 1.6 }}>
            Show off your best work, up to {cap} photos or videos. Tick "Show on Home" to choose which ones appear.
            {autoPick ? ` Until you pick, your first ${cap} portfolio items show.` : ''}
            {fullBuilder ? ' Everything you upload also appears in your Gallery.' : ' These also appear on your LensTrybe profile.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: atCap ? 'rgba(255,45,120,0.1)' : 'rgba(29,185,84,0.12)', color: atCap ? PINK : GREEN }}>{shownCount} of {cap} chosen</span>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files; if (fl?.length) onUpload(Array.from(fl)); if (fileRef.current) fileRef.current.value = '' }} />
          <Btn variant="primary" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading === 'checking' ? 'Checking photos…' : uploading ? 'Uploading…' : '+ Add photos or videos'}</Btn>
        </div>
      </div>
      {notice ? <div style={{ whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.55, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,45,120,0.35)', background: 'rgba(255,45,120,0.08)', color: 'var(--lt-text)' }}>{notice}</div> : null}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', borderRadius: 12, border: '1px dashed var(--lt-border)', color: 'var(--lt-faint)', fontSize: 13 }}>No photos or videos yet. Add some to bring your Home page to life.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {items.map((it, idx) => {
            const on = !!it.featured
            const showing = on || (autoPick && idx < cap)
            const blocked = !on && atCap
            const url = it.file_url || it.image_url
            return (
              <div key={it.id} style={{ border: on ? '2px solid #1DB954' : '2px solid var(--lt-hairline)', borderRadius: 12, overflow: 'hidden', background: 'var(--lt-surface)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--lt-surface-2)', overflow: 'hidden' }}>
                  {it.file_type === 'video'
                    ? <video src={`${url}#t=0.1`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  {it.file_type === 'video' ? <span style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>▶ Video</span> : null}
                  {showing && !on ? <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>Showing</span> : null}
                  <button type="button" onClick={() => onDelete(it)} aria-label="Delete" style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
                <label title={blocked ? `You've chosen ${cap}. Untick one to swap it.` : ''} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 12.5, color: blocked ? 'var(--lt-faint)' : 'var(--lt-text)', cursor: blocked ? 'not-allowed' : 'pointer' }}>
                  <input type="checkbox" checked={on} disabled={blocked} onChange={(e) => onToggle(it, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#1DB954' }} /> Show on Home
                </label>
              </div>
            )
          })}
        </div>
      )}
      {atCap ? <p style={{ margin: 0, fontSize: 12.5, color: 'var(--lt-faint)' }}>You've chosen {cap}. Untick one to swap in another.</p> : null}
      {fullBuilder ? <div><Btn variant="ghost" size="sm" type="button" onClick={onOpenGallery}>Organise albums in Gallery</Btn></div> : null}
    </div>
  )
}

const emptyService = () => ({ id: null, name: '', description: '', price: '', image_url: '' })

function ServiceRow({ s, idx, onChangeLocal, onSaveRow, onDeleteRow, onUploadImage, uploading, inputStyle, isMobile }) {
  const fileRef = useRef(null)
  return (
    <div style={{ border: '1px solid var(--lt-hairline)', borderRadius: 10, padding: 12, background: 'var(--lt-surface)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '130px 1fr', gap: 12, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: '100%', aspectRatio: '3/2', borderRadius: 8, overflow: 'hidden', background: 'var(--lt-surface-2)', border: '1px dashed var(--lt-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {s.image_url ? <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: 'var(--lt-faint)', fontFamily: 'inherit' }}>No photo</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadImage(idx, f); if (fileRef.current) fileRef.current.value = '' }} />
        <Btn variant="secondary" size="sm" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : s.image_url ? 'Replace photo' : 'Add photo'}</Btn>
        {s.image_url ? <Btn variant="ghost" size="sm" type="button" onClick={() => onChangeLocal(idx, { image_url: '' })}>Remove</Btn> : null}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <input value={s.name || ''} onChange={(e) => onChangeLocal(idx, { name: e.target.value })} style={inputStyle} placeholder="Service name (e.g. Wedding collection)" />
        <textarea value={s.description || ''} onChange={(e) => onChangeLocal(idx, { description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Short description" />
        <input value={s.price || ''} onChange={(e) => onChangeLocal(idx, { price: e.target.value })} style={inputStyle} placeholder="Price (e.g. From $2,500, POA)" />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="primary" size="sm" type="button" onClick={() => onSaveRow(s, idx)} disabled={s.isSaving}>{s.isSaving ? 'Saving…' : 'Save'}</Btn>
          <Btn variant="ghost" size="sm" type="button" onClick={() => onDeleteRow(s, idx)}>Delete</Btn>
        </div>
      </div>
    </div>
  )
}

function ServicesManager({ services, template, onTemplate, onChangeLocal, onAddRow, onSaveRow, onDeleteRow, onUploadImage, uploadingIdx, savedFlash, styles, isMobile }) {
  const { inputStyle, label } = styles
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={label}>Layout</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 8 }}>
          {TEMPLATES.services.map((t) => {
            const active = (template || 't1') === t.id
            return (
              <button key={t.id} type="button" onClick={() => onTemplate(t.id)} style={{ textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer', border: active ? '2px solid #1DB954' : '1px solid var(--lt-border)', background: active ? 'rgba(29,185,84,0.06)' : 'var(--lt-surface)', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TemplateSkeleton pageType="services" id={t.id} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--lt-text)' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--lt-faint)', lineHeight: 1.45 }}>{t.desc}</div>
              </button>
            )
          })}
        </div>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--lt-faint)', fontFamily: 'inherit', lineHeight: 1.6 }}>List what you offer. Add a photo, name, description and price.</p>
      {services.map((s, idx) => <ServiceRow key={s.id ?? `new-${idx}`} s={s} idx={idx} onChangeLocal={onChangeLocal} onSaveRow={onSaveRow} onDeleteRow={onDeleteRow} onUploadImage={onUploadImage} uploading={uploadingIdx === idx} inputStyle={inputStyle} isMobile={isMobile} />)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn variant="secondary" type="button" onClick={onAddRow}>Add service</Btn>
        {savedFlash ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'inherit' }}>Saved.</span> : null}
      </div>
    </div>
  )
}

function LockedPanel({ pageLabel }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 18, color: 'var(--lt-text)' }}>{pageLabel} is an Expert feature</div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--lt-muted)', fontFamily: 'inherit', maxWidth: 420, lineHeight: 1.6 }}>Upgrade to Expert or Elite to add a {pageLabel} page to your website.</p>
      <Link to="/pricing"><Btn variant="primary" size="sm">View plans</Btn></Link>
    </div>
  )
}

function Seg({ value, options, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = value === o.v
        return <button key={o.label} type="button" onClick={() => onChange(o.v)} style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, border: active ? '1px solid #1DB954' : '1px solid var(--lt-border)', background: active ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface)', color: active ? '#1DB954' : 'var(--lt-text)' }}>{o.label}</button>
      })}
    </div>
  )
}

const DESIGN_PAGES = [{ id: 'all', label: 'All pages' }, { id: 'home', label: 'Home' }, { id: 'about', label: 'About' }, { id: 'gallery', label: 'Gallery' }, { id: 'services', label: 'Services' }, { id: 'contact', label: 'Contact' }]

function jump(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('wb-flash'); void el.offsetWidth; el.classList.add('wb-flash')
  setTimeout(() => el.classList.remove('wb-flash'), 2600)
}

function DesignEditor({ scope, setScope, active, customised, onCustomised, onApplyPalette, onApplyStyle, onChange, logo, onUploadLogo, uploadingLogo, onSave, saving, saved, styles, isMobile }) {
  const logoRef = useRef(null)
  const { inputStyle, label } = styles
  const small = { ...label, textTransform: 'none', letterSpacing: 0, fontSize: 12, color: 'var(--lt-muted)' }
  const autoText = !active.colors.text
  const editingPage = scope !== 'all'
  const disabled = editingPage && !customised
  // Creative's OWN resolved site theme — this drives the live preview below and is
  // intentionally NOT converted to --lt-* tokens.
  const P = resolveTheme({ site_theme: active, site_logo_url: logo }, null)
  const paletteActiveId = (PALETTES.find((p) => p.primary === active.colors.primary && p.background === active.colors.background) || {}).id
  const styleActiveId = (STYLES.find((s) => s.fonts.heading === active.fonts.heading && Number(s.buttons.radius) === Number(active.buttons.radius) && Number(s.corners.radius) === Number(active.corners.radius)) || {}).id
  const colorRow = (val, on) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <input type="color" value={/^#/.test(val || '') ? val : '#000000'} onChange={(e) => on(e.target.value)} style={{ width: 44, height: 38, border: '1px solid var(--lt-border)', borderRadius: 8, background: 'none', cursor: 'pointer', padding: 2 }} />
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
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--lt-faint)', fontFamily: 'inherit' }}>Style your whole site at once, or pick a page to give it its own look.</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {DESIGN_PAGES.map((pg) => {
              const on = scope === pg.id
              const isOverridden = pg.id !== 'all' && customisedMap(active, pg.id)
              return <button key={pg.id} type="button" onClick={() => setScope(pg.id)} style={{ padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, border: on ? '1px solid #1DB954' : '1px solid var(--lt-border)', background: on ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface)', color: on ? '#1DB954' : 'var(--lt-text)' }}>{pg.label}</button>
            })}
          </div>
          {editingPage && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--lt-hairline)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--lt-text)' }}>
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
                  <button key={p.id} type="button" onClick={() => onApplyPalette(p)} style={{ padding: 8, borderRadius: 10, cursor: 'pointer', border: on ? '2px solid #1DB954' : '1px solid var(--lt-border)', background: 'var(--lt-surface)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', width: '100%', height: 24, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--lt-hairline)' }}><span style={{ flex: 1, background: p.background }} /><span style={{ flex: 1, background: p.primary }} /></div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lt-text)', fontFamily: 'inherit' }}>{p.name}</span>
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
                  <button key={s.id} type="button" onClick={() => onApplyStyle(s)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: on ? '2px solid #1DB954' : '1px solid var(--lt-border)', background: 'var(--lt-surface)', textAlign: 'left' }}>
                    <div style={{ fontFamily: `"${s.fonts.heading}", serif`, fontWeight: s.fonts.headingWeight, fontSize: 17, color: 'var(--lt-text)', lineHeight: 1 }}>Aa</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lt-text)', fontFamily: 'inherit', marginTop: 6 }}>{s.name}</div>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--lt-muted)', fontFamily: 'inherit', margin: '6px 0', cursor: 'pointer' }}>
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
              <div><div style={small}>Heading font</div><select className="wb-select" value={active.fonts.heading} onChange={(e) => onChange('fonts', 'heading', e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>{FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
              <div><div style={small}>Body font</div><select className="wb-select" value={active.fonts.body} onChange={(e) => onChange('fonts', 'body', e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>{FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
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
            <p style={{ margin: '6px 0', fontSize: 12.5, color: 'var(--lt-faint)', fontFamily: 'inherit' }}>Roundness of cards and images.</p>
            <Seg value={active.corners.radius} options={CORNERS} onChange={(v) => onChange('corners', 'radius', v)} />
          </div>
        </div>

        {/* Logo (global only) */}
        {!editingPage && (
          <div id="wb-logo">
            <div style={label}>Logo</div>
            <p style={{ margin: '6px 0', fontSize: 12.5, color: 'var(--lt-faint)', fontFamily: 'inherit' }}>Shown in your website header. Leave blank to show your business name.</p>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadLogo(f); if (logoRef.current) logoRef.current.value = '' }} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {logo ? <img src={logo} alt="" style={{ height: 40, objectFit: 'contain', background: 'var(--lt-surface)', border: '1px solid var(--lt-hairline)', borderRadius: 8, padding: 4 }} /> : null}
              <Btn variant="secondary" type="button" disabled={uploadingLogo} onClick={() => logoRef.current?.click()}>{uploadingLogo ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}</Btn>
              {logo ? <Btn variant="ghost" type="button" onClick={() => onUploadLogo(null)}>Remove</Btn> : null}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save design'}</Btn>
          {saved ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'inherit' }}>Saved.</span> : null}
        </div>
      </div>

      {/* Live preview (renders the creative's OWN site theme via P.* — left on brand colours, not --lt-*) */}
      <div style={{ position: isMobile ? 'static' : 'sticky', top: 12 }}>
        <div style={label}>Live preview{editingPage ? ` · ${scope}` : ''}</div>
        <div style={{ marginTop: 8, border: '1px solid var(--lt-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: P.bg, padding: 18, fontFamily: P.bodyFont }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }} onClick={() => jump('wb-logo')} title="Logo & name">
              {logo ? <img src={logo} alt="" style={{ height: 20, objectFit: 'contain' }} /> : <span style={{ fontFamily: P.headingFont, fontWeight: P.headingWeight, color: P.heading, fontSize: 15 }}>Studio</span>}
              <span style={{ fontSize: 11, color: P.soft }}>Home · About · Contact</span>
            </div>
            <div onClick={() => jump('wb-typography')} title="Typography" style={{ cursor: 'pointer' }}>
              <div style={{ fontFamily: P.headingFont, fontWeight: P.headingWeight, color: P.heading, fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Your headline</div>
              <div style={{ color: P.soft, fontSize: P.baseSize - 3, lineHeight: 1.6, margin: '8px 0 14px' }}>A short line about the work you do and who you help.</div>
            </div>
            <span onClick={() => jump('wb-buttons')} title="Buttons" style={{ display: 'inline-block', padding: '9px 18px', borderRadius: P.btnRadius, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: P.btnStyle === 'outline' ? 'transparent' : P.accent, color: P.btnStyle === 'outline' ? P.accent : P.btnText, border: P.btnStyle === 'outline' ? `2px solid ${P.accent}` : 'none' }}>Enquire Now</span>
            <div onClick={() => jump('wb-corners')} title="Corners" style={{ cursor: 'pointer', marginTop: 16, background: P.surface, border: `1px solid ${P.surfaceBorder}`, borderRadius: P.radius, padding: 12 }}>
              <div style={{ color: P.accent, fontSize: 12, marginBottom: 6 }}>★★★★★</div>
              <div style={{ color: P.ink, fontSize: 12.5, fontStyle: 'italic', lineHeight: 1.5 }}>"Absolutely brilliant to work with."</div>
            </div>
          </div>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--lt-faint)', fontFamily: 'inherit', lineHeight: 1.5 }}>Tip: click a part of the preview to jump to its setting. Save to apply.</p>
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
  const [homeUploading, setHomeUploading] = useState(false)
  const [homeNotice, setHomeNotice] = useState('')
  const homeCap = HOME_MEDIA_CAP[tier] || 8

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
  // Upload from the Home tab: moderated like the portfolio, and chosen for Home
  // straight away while there's room.
  async function homeMediaUpload(files) {
    if (!user?.id || !supabase) return
    setHomeNotice('')
    setHomeUploading('checking')
    const notes = []
    try {
      const { filesToUpload, blockedFileNames, moderationFailedFileNames } = await partitionFilesByPortfolioImageModeration(files)
      if (blockedFileNames.length) notes.push(`${PORTFOLIO_PHOTO_MODERATION_BLOCKED_MESSAGE}\nRejected: ${blockedFileNames.join(', ')}`)
      if (moderationFailedFileNames.length) notes.push(`We couldn't check these photos, so they weren't added. Please try again: ${moderationFailedFileNames.join(', ')}`)
      setHomeUploading('uploading')
      let chosen = gallery.filter((g) => g.featured).length
      let order = gallery.length
      const failed = []
      for (const file of filesToUpload) {
        const isVideo = (file.type || '').startsWith('video/')
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const bucket = isVideo ? 'portfolio-videos' : 'portfolio'
        const path = `${user.id}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file)
        if (upErr) { failed.push(file.name); continue }
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
        const featured = chosen < homeCap
        const { data, error } = await supabase.from('portfolio_items').insert({ user_id: user.id, creative_id: user.id, file_url: pub.publicUrl, image_url: pub.publicUrl, file_type: isVideo ? 'video' : 'image', featured, sort_order: order }).select().single()
        if (error) { failed.push(file.name); continue }
        if (featured) chosen += 1
        order += 1
        setGallery((prev) => [...prev, data])
      }
      if (failed.length) notes.push(`These didn't upload (large videos can be too big, try a shorter clip): ${failed.join(', ')}`)
      if (filesToUpload.length - failed.length > 0 && chosen >= homeCap) notes.push(`Your Home page is full (${homeCap}). New uploads are saved to your portfolio; tick "Show on Home" after unticking another to swap them in.`)
    } catch (e) {
      notes.push(e.message || 'Upload failed. Please try again.')
    } finally {
      setHomeUploading(false)
      setHomeNotice(notes.join('\n\n'))
    }
  }
  async function homeMediaToggle(item, on) {
    if (on && gallery.filter((g) => g.featured).length >= homeCap) { window.alert(`Your Home page can show up to ${homeCap} photos or videos. Untick one first to swap it.`); return }
    await galleryToggleFeatured(item, on)
  }
  async function homeMediaDelete(item) {
    if (!window.confirm(item.file_type === 'video' ? 'Delete this video from your portfolio?' : 'Delete this photo from your portfolio?')) return
    await supabase.from('portfolio_items').delete().eq('id', item.id)
    setGallery((prev) => prev.filter((g) => g.id !== item.id))
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
  async function saveServicesTemplate(t) {
    setPages((prev) => ({ ...prev, services: { ...(prev.services || { content: {}, visible: true }), template: t } }))
    if (!user?.id || !supabase) return
    const row = { creative_id: user.id, page_type: 'services', template: t, content: pages.services?.content || {}, visible: pages.services?.visible !== false, position: PAGE_ORDER.indexOf('services'), updated_at: new Date().toISOString() }
    await supabase.from('site_pages').upsert(row, { onConflict: 'creative_id,page_type' })
  }
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

  const card = { ...glassCard, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }
  const label = { fontSize: 12, fontWeight: 600, color: 'var(--lt-faint)', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.05em' }
  const inputStyle = { ...field, width: '100%', padding: '10px 12px', borderRadius: 8 }
  const editorStyles = { inputStyle, label }

  // Scoped styles for native <select> so it themes in light + dark.
  const selectStyle = (
    <style>{`
      .wb-select {
        -webkit-appearance: none; -moz-appearance: none; appearance: none;
        background-color: var(--lt-input-bg);
        color: var(--lt-text);
        border: 1px solid var(--lt-input-border);
        padding-right: 34px;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 11px center;
      }
      [data-theme="light"] .wb-select { color-scheme: light; }
      [data-theme="dark"] .wb-select { color-scheme: dark; }
      .wb-select:disabled { opacity: .55; cursor: not-allowed; }
    `}</style>
  )

  if (!user) return <div style={{ padding: 32, color: 'var(--lt-faint)', fontFamily: 'inherit', ...FONT }}>Sign in to manage your website.</div>

  if (!canBuild) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '28px 32px', maxWidth: 720, margin: '0 auto', color: 'var(--lt-text)', background: 'transparent', ...FONT }}>
        <div>
          <h1 style={{ fontFamily: 'inherit', fontSize: 28, color: 'var(--lt-text)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Website</h1>
          <p style={{ fontSize: 14, color: 'var(--lt-faint)', fontFamily: 'inherit', marginTop: 8, lineHeight: 1.6 }}>Turn your profile into a full multi-page website in your own brand, with a gallery, services and enquiries flowing straight into your CRM.</p>
        </div>
        <div style={{ ...card, textAlign: 'center', alignItems: 'center', gap: 20, padding: '40px 28px' }}>
          <div style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 22, color: 'var(--lt-text)' }}>Unlock the website builder</div>
          <p style={{ fontSize: 14, color: 'var(--lt-muted)', fontFamily: 'inherit', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>Pro gets a Home and Contact page. Expert and Elite unlock the full site: About, Gallery and Services too, plus social links and your external website link.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link to="/pricing"><Btn variant="primary">View plans</Btn></Link>
            <Link to="/dashboard/settings/subscription"><Btn variant="secondary">Manage subscription</Btn></Link>
          </div>
        </div>
      </div>
    )
  }

  const isContentPage = CONTENT_PAGES.includes(activeTab)
  const activeEditable = activeTab === 'settings' || activeTab === 'design' || editablePages.includes(activeTab)
  const activeData = pages[activeTab] || { template: 't1', content: {}, visible: true }
  const profileHref = `/creatives/${user.id}`
  // Public website link: open to everyone, no LensTrybe sign-in needed.
  const siteHref = `/site/${profile?.custom_domain || user.id}`
  const siteUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://lenstrybe.com'}${siteHref}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: isMobile ? 16 : '28px 24px 48px', maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', color: 'var(--lt-text)', background: 'transparent', ...FONT }} className="website-builder-page">
      {selectStyle}
      <style>{`@media (max-width: 767px){ .website-builder-page h1{font-size:24px !important} .website-builder-page input,.website-builder-page textarea{font-size:14px !important} } @keyframes wbflash{0%{box-shadow:0 0 0 0 rgba(29,185,84,0)}8%{box-shadow:0 0 0 3px rgba(29,185,84,0.6)}75%{box-shadow:0 0 0 3px rgba(29,185,84,0.6)}100%{box-shadow:0 0 0 0 rgba(29,185,84,0)}} .wb-flash{border-radius:12px;animation:wbflash 2.6s ease}`}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'inherit', fontSize: 'clamp(24px, 4vw, 28px)', color: 'var(--lt-text)', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Website</h1>
          <p style={{ fontSize: 13, color: 'var(--lt-faint)', fontFamily: 'inherit', marginTop: 8, lineHeight: 1.6 }}>
            {proOnePage ? "You're on Pro: a Home page (with up to 8 photos or videos) and a Contact page. Upgrade to Expert for About, Gallery and Services." : 'Your profile is your website. Edit each page below; it updates your public profile live.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={proOnePage || editablePages.length ? siteHref : profileHref} target="_blank" rel="noopener noreferrer"><Btn variant="secondary" size="sm" type="button">View my website</Btn></a>
          <Btn variant="secondary" size="sm" type="button" onClick={(e) => { const b = e.currentTarget; try { navigator.clipboard.writeText(siteUrl); b.textContent = 'Link copied'; setTimeout(() => { b.textContent = 'Copy website link' }, 2000) } catch { /* ignore */ } }}>Copy website link</Btn>
        </div>
      </header>

      <section style={card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((pt) => {
            const locked = pt !== 'settings' && pt !== 'design' && !editablePages.includes(pt)
            const active = activeTab === pt
            return (
              <button key={pt} type="button" onClick={() => setActiveTab(pt)} style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, border: active ? '1px solid #1DB954' : '1px solid var(--lt-border)', background: active ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface)', color: active ? '#1DB954' : locked ? 'var(--lt-faint)' : 'var(--lt-text)' }}>{PAGE_LABEL[pt]}{locked ? ' 🔒' : ''}</button>
            )
          })}
        </div>
        <div style={{ height: 1, background: 'var(--lt-hairline)', margin: '4px 0' }} />

        {activeTab === 'design' ? (
          <DesignEditor scope={designScope} setScope={setDesignScope} active={activeDesign} customised={pageCustomised} onCustomised={setPageCustomised} onApplyPalette={applyPalette} onApplyStyle={applyStyle} onChange={onDesignChange} logo={siteLogo} onUploadLogo={uploadLogo} uploadingLogo={uploadingLogo} onSave={saveDesign} saving={savingDesign} saved={designSaved} styles={editorStyles} isMobile={isMobile} />
        ) : activeTab === 'settings' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={label}>Social links & website</div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--lt-faint)', fontFamily: 'inherit' }}>These appear as icons in your footer and on your Contact page.</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 10 }}>
                {SOCIAL_FIELDS.map((f) => (
                  <div key={f.key}>
                    <div style={{ ...label, textTransform: 'none', letterSpacing: 0, fontSize: 12, color: 'var(--lt-muted)' }}>{f.label}</div>
                    <input value={links[f.key]} onChange={(e) => setLinks((l) => ({ ...l, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ ...inputStyle, marginTop: 6 }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={label}>Areas covered</div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--lt-faint)', fontFamily: 'inherit' }}>Suburbs or regions you serve. Shown on your Home and Contact pages.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <input value={areaInput} onChange={(e) => setAreaInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArea() } }} placeholder="e.g. Sydney" style={{ ...inputStyle, maxWidth: 240, flex: '1 1 160px' }} />
                <Btn variant="secondary" type="button" onClick={addArea}>Add</Btn>
              </div>
              {areas.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {areas.map((a, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', fontSize: 13, color: 'var(--lt-text)', border: '1px solid var(--lt-border)', borderRadius: 999, padding: '5px 6px 5px 12px' }}>{a}<button type="button" onClick={() => setAreas((p) => p.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--lt-faint)', fontSize: 14, lineHeight: 1, padding: '0 4px' }} aria-label={`Remove ${a}`}>×</button></span>
                  ))}
                </div>
              ) : null}
            </div>
            <div><div style={label}>Search title (SEO)</div><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="e.g. Jane Doe Photography | Sydney Weddings" style={{ ...inputStyle, marginTop: 8 }} /></div>
            <div><div style={label}>Search description (SEO)</div><textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} rows={3} placeholder="A short sentence that appears in Google results." style={{ ...inputStyle, marginTop: 8, resize: 'vertical', minHeight: 72 }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Btn variant="primary" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save settings'}</Btn>
              {settingsSaved ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'inherit' }}>Saved.</span> : null}
            </div>
          </div>
        ) : loadingPages ? (
          <p style={{ color: 'var(--lt-faint)', fontFamily: 'inherit', fontSize: 13 }}>Loading…</p>
        ) : !activeEditable ? (
          <LockedPanel pageLabel={PAGE_LABEL[activeTab]} />
        ) : activeTab === 'gallery' ? (
          <GalleryManager items={gallery} uploading={galleryUploading} albumInput={albumInput} setAlbumInput={setAlbumInput} onUpload={galleryUpload} onSetCategory={gallerySetCategory} onToggleFeatured={homeMediaToggle} onDelete={galleryDelete} styles={editorStyles} />
        ) : activeTab === 'services' ? (
          <ServicesManager services={services} template={pages.services?.template || 't1'} onTemplate={saveServicesTemplate} onChangeLocal={serviceChangeLocal} onAddRow={serviceAddRow} onSaveRow={serviceSaveRow} onDeleteRow={serviceDeleteRow} onUploadImage={serviceUploadImage} uploadingIdx={uploadingServiceIdx} savedFlash={servicesSaved} styles={editorStyles} isMobile={isMobile} />
        ) : isContentPage ? (
          <>
            <PageEditor key={activeTab} pageType={activeTab} content={activeData.content || {}} template={activeData.template || 't1'} visible={activeData.visible !== false} onField={(k, v) => setField(activeTab, k, v)} onTemplate={(t) => setTemplate(activeTab, t)} onVisible={(v) => setVisible(activeTab, v)} onUploadImage={(field, file) => uploadImage(activeTab, field, file)} uploadingField={uploadingField} onSave={() => savePage(activeTab)} saving={savingPage === activeTab} saved={savedPage === activeTab} styles={editorStyles} />
            {activeTab === 'home' ? (
              <HomeMediaManager items={gallery} cap={homeCap} fullBuilder={fullBuilder} uploading={homeUploading} notice={homeNotice} onUpload={homeMediaUpload} onToggle={homeMediaToggle} onDelete={homeMediaDelete} onOpenGallery={() => { setActiveTab('gallery'); window.scrollTo(0, 0) }} />
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  )
}
