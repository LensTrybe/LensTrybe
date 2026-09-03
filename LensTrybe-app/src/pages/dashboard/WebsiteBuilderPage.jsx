import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import { GLASS_CARD, GLASS_NATIVE_FIELD } from '../../lib/glassTokens'

// In-app multi-page website builder. The public site renders in the creative's
// own brand (see pages/public/PublicSitePage.jsx). Content shapes here MUST match
// exactly what that renderer reads:
//   home    -> { headline, subheadline, hero_image, intro, cta_text }
//   about   -> { heading, body, portrait_image }
//   contact -> { heading, blurb }
// Gating: Expert/Elite = full builder (Home/About/Contact). Pro = Home only.
// Basic = locked upsell.

const PAGE_ORDER = ['home', 'about', 'contact']
const PAGE_LABEL = { home: 'Home', about: 'About', contact: 'Contact' }

const TEMPLATES = {
  home: [
    { id: 't1', name: 'Full-bleed hero', desc: 'Big background image with your headline over it.' },
    { id: 't2', name: 'Split hero', desc: 'Text on the left, image on the right.' },
  ],
  about: [
    { id: 't1', name: 'Photo beside text', desc: 'Portrait on the left, your story on the right.' },
    { id: 't2', name: 'Centred', desc: 'Round portrait with centred text.' },
  ],
  contact: [
    { id: 't1', name: 'Centred form', desc: 'A simple, centred enquiry form.' },
    { id: 't2', name: 'Split', desc: 'Your blurb on the left, the form on the right.' },
  ],
}

const FIELDS = {
  home: [
    { key: 'headline', label: 'Headline', type: 'text', placeholder: 'e.g. Timeless wedding photography' },
    { key: 'subheadline', label: 'Subheadline', type: 'text', placeholder: 'One line under your headline' },
    { key: 'hero_image', label: 'Hero image', type: 'image' },
    { key: 'intro', label: 'Welcome paragraph', type: 'textarea', placeholder: 'A short welcome shown under your hero.', rows: 4 },
    { key: 'cta_text', label: 'Button text', type: 'text', placeholder: 'Get in touch' },
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

function slugFromBusinessName(name) {
  const s = (name ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'studio'
}

function isValidSlug(slug) {
  if (!slug || slug.length < 2 || slug.length > 63) return false
  return /^[a-z0-9-]{2,63}$/.test(slug)
}

function flash(setter, ms = 2600) {
  setter(true)
  setTimeout(() => setter(false), ms)
}

function PageEditor({ pageType, content, template, visible, onField, onTemplate, onVisible, onUploadImage, uploadingField, onSave, saving, saved, styles }) {
  const fileRef = useRef(null)
  const [pendingField, setPendingField] = useState(null)
  const { inputStyle, label } = styles

  function pickImage(field) {
    setPendingField(field)
    fileRef.current?.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && pendingField) onUploadImage(pendingField, f)
          if (fileRef.current) fileRef.current.value = ''
        }}
      />

      <div>
        <div style={label}>Layout</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 8 }}>
          {TEMPLATES[pageType].map((t) => {
            const active = (template || 't1') === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTemplate(t.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: active ? '2px solid #1DB954' : '1px solid var(--border-default)',
                  background: active ? 'rgba(29,185,84,0.08)' : 'var(--bg-base)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{t.desc}</div>
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
                  <Button variant="secondary" type="button" disabled={uploadingField === f.key} onClick={() => pickImage(f.key)}>
                    {uploadingField === f.key ? 'Uploading…' : url ? 'Replace image' : 'Upload image'}
                  </Button>
                  {url ? <Button variant="ghost" type="button" onClick={() => onField(f.key, '')}>Remove</Button> : null}
                </div>
              </div>
            </div>
          )
        }
        if (f.type === 'textarea') {
          return (
            <div key={f.key}>
              <div style={label}>{f.label}</div>
              <textarea
                value={content[f.key] || ''}
                onChange={(e) => onField(f.key, e.target.value)}
                rows={f.rows || 4}
                placeholder={f.placeholder}
                style={{ ...inputStyle, marginTop: 8, resize: 'vertical', minHeight: 90 }}
              />
            </div>
          )
        }
        return (
          <div key={f.key}>
            <div style={label}>{f.label}</div>
            <input
              value={content[f.key] || ''}
              onChange={(e) => onField(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{ ...inputStyle, marginTop: 8 }}
            />
          </div>
        )
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

export default function WebsiteBuilderPage() {
  const { user, profile, fetchUserData } = useAuth()
  const { tier } = useSubscription()
  const fullBuilder = tier === 'expert' || tier === 'elite'
  const proOnePage = tier === 'pro'
  const canBuild = fullBuilder || proOnePage
  const editablePages = fullBuilder ? PAGE_ORDER : proOnePage ? ['home'] : []

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  // Settings
  const [published, setPublished] = useState(false)
  const [savingPublish, setSavingPublish] = useState(false)
  const [publishSaved, setPublishSaved] = useState(false)

  const [subdomain, setSubdomain] = useState('')
  const [slugAvailable, setSlugAvailable] = useState(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [savingUrl, setSavingUrl] = useState(false)
  const [urlSaved, setUrlSaved] = useState(false)
  const [slugError, setSlugError] = useState('')

  const [areas, setAreas] = useState([])
  const [areaInput, setAreaInput] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [showMadeWith, setShowMadeWith] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Pages
  const [pages, setPages] = useState({}) // page_type -> { id, template, content, visible }
  const [loadingPages, setLoadingPages] = useState(true)
  const [activePage, setActivePage] = useState('home')
  const [savingPage, setSavingPage] = useState('')
  const [savedPage, setSavedPage] = useState('')
  const [uploadingField, setUploadingField] = useState('')

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Hydrate settings from profile
  useEffect(() => {
    if (!profile) return
    setPublished(!!profile.portfolio_website_active)
    setSubdomain((profile.custom_domain ?? slugFromBusinessName(profile.business_name)).toLowerCase())
    setAreas(Array.isArray(profile.site_service_areas) ? profile.site_service_areas : [])
    setSeoTitle(profile.site_seo_title ?? '')
    setSeoDesc(profile.site_seo_description ?? '')
    setShowMadeWith(profile.site_show_made_with !== false)
  }, [profile])

  // Slug availability
  useEffect(() => {
    if (!canBuild || !user?.id || !supabase) return
    const s = subdomain.trim().toLowerCase()
    if (!isValidSlug(s)) { setSlugAvailable(null); setCheckingSlug(false); return }
    setCheckingSlug(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('custom_domain', s).neq('id', user.id).maybeSingle()
      setSlugAvailable(!data)
      setCheckingSlug(false)
    }, 420)
    return () => clearTimeout(t)
  }, [subdomain, user?.id, canBuild])

  const loadPages = useCallback(async () => {
    if (!user?.id || !supabase || !canBuild) { setLoadingPages(false); return }
    setLoadingPages(true)
    const { data } = await supabase.from('site_pages').select('*').eq('creative_id', user.id)
    const byType = {}
    ;(data ?? []).forEach((r) => { byType[r.page_type] = { id: r.id, template: r.template || 't1', content: r.content || {}, visible: r.visible !== false } })

    // Seed any editable pages the creative doesn't have yet.
    const toSeed = editablePages.filter((pt) => !byType[pt])
    if (toSeed.length) {
      const rows = toSeed.map((pt) => ({ creative_id: user.id, page_type: pt, template: 't1', content: {}, visible: true, position: PAGE_ORDER.indexOf(pt) }))
      const { data: seeded } = await supabase.from('site_pages').insert(rows).select()
      ;(seeded ?? []).forEach((r) => { byType[r.page_type] = { id: r.id, template: r.template || 't1', content: r.content || {}, visible: r.visible !== false } })
    }

    setPages(byType)
    setLoadingPages(false)
  }, [user?.id, canBuild, fullBuilder, proOnePage])

  useEffect(() => { loadPages() }, [loadPages])

  const displaySlug = (profile?.custom_domain ?? subdomain).trim().toLowerCase()
  const prettyUrl = isValidSlug(displaySlug) ? `${displaySlug}.lenstrybe.com` : null
  const previewHref = isValidSlug(displaySlug) ? `/site/${displaySlug}` : null

  async function savePublish(next) {
    if (!user?.id || !supabase) return
    if (next && !isValidSlug(displaySlug)) { window.alert('Set your website address first, then publish.'); return }
    setSavingPublish(true)
    const { error } = await supabase.from('profiles').update({ portfolio_website_active: next }).eq('id', user.id)
    setSavingPublish(false)
    if (error) { window.alert(error.message); return }
    setPublished(next)
    await fetchUserData(user.id)
    flash(setPublishSaved)
  }

  async function saveUrl() {
    setSlugError('')
    const s = subdomain.trim().toLowerCase()
    if (!user?.id || !supabase) return
    if (!isValidSlug(s)) { setSlugError('Use 2 to 63 characters: lowercase letters, numbers and hyphens only. No spaces.'); return }
    if (slugAvailable === false) { setSlugError('That address is already taken. Try another.'); return }
    setSavingUrl(true)
    try {
      const { error } = await supabase.from('profiles').update({ custom_domain: s }).eq('id', user.id)
      if (error) throw error
      await fetchUserData(user.id)
      flash(setUrlSaved)
    } catch (e) {
      if (e?.code === '23505' || e?.message?.includes('unique')) setSlugError('That address is already taken.')
      else setSlugError(e?.message || 'Could not save your address.')
    } finally {
      setSavingUrl(false)
    }
  }

  function addArea() {
    const v = areaInput.trim()
    if (!v) return
    if (areas.some((a) => a.toLowerCase() === v.toLowerCase())) { setAreaInput(''); return }
    setAreas((prev) => [...prev, v])
    setAreaInput('')
  }

  async function saveSettings() {
    if (!user?.id || !supabase) return
    setSavingSettings(true)
    const patch = {
      site_service_areas: areas,
      site_seo_title: seoTitle.trim() || null,
      site_seo_description: seoDesc.trim() || null,
    }
    if (fullBuilder) patch.site_show_made_with = showMadeWith
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    setSavingSettings(false)
    if (error) { window.alert(error.message); return }
    await fetchUserData(user.id)
    flash(setSettingsSaved)
  }

  function setField(pageType, key, value) {
    setPages((prev) => ({ ...prev, [pageType]: { ...prev[pageType], content: { ...(prev[pageType]?.content || {}), [key]: value } } }))
  }
  function setTemplate(pageType, template) {
    setPages((prev) => ({ ...prev, [pageType]: { ...prev[pageType], template } }))
  }
  function setVisible(pageType, visible) {
    setPages((prev) => ({ ...prev, [pageType]: { ...prev[pageType], visible } }))
  }

  async function uploadImage(pageType, field, file) {
    if (!user?.id || !supabase) return
    setUploadingField(field)
    try {
      const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg'
      const path = `${user.id}/site/${pageType}/${field}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, file, { upsert: true })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
      setField(pageType, field, pub.publicUrl)
    } catch (e) {
      window.alert(e.message || 'Upload failed')
    } finally {
      setUploadingField('')
    }
  }

  async function savePage(pageType) {
    if (!user?.id || !supabase) return
    const p = pages[pageType]
    if (!p) return
    setSavingPage(pageType)
    try {
      const row = {
        creative_id: user.id,
        page_type: pageType,
        template: p.template || 't1',
        content: p.content || {},
        visible: p.visible !== false,
        position: PAGE_ORDER.indexOf(pageType),
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('site_pages').upsert(row, { onConflict: 'creative_id,page_type' }).select().single()
      if (error) throw error
      setPages((prev) => ({ ...prev, [pageType]: { id: data.id, template: data.template || 't1', content: data.content || {}, visible: data.visible !== false } }))
      setSavedPage(pageType)
      setTimeout(() => setSavedPage(''), 2600)
    } catch (e) {
      window.alert(e.message || 'Could not save this page.')
    } finally {
      setSavingPage('')
    }
  }

  const card = { ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }
  const label = { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }
  const inputStyle = { ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: '8px' }
  const editorStyles = { inputStyle, label }

  if (!user) return <div style={{ background: 'transparent', padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Sign in to manage your website.</div>

  if (!canBuild) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '28px 32px', maxWidth: 720, margin: '0 auto' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>Website</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '8px', lineHeight: 1.6 }}>
            Build a real multi-page website at your own LensTrybe address, styled in your brand colours and fonts, with enquiries flowing straight into your CRM.
          </p>
        </div>
        <div style={{ ...card, textAlign: 'center', alignItems: 'center', gap: '20px', padding: '40px 28px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)' }}>Unlock the website builder</div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>
            Pro gets a single-page site. Expert and Elite unlock the full builder: Home, About and Contact pages, service areas, SEO and the option to remove the LensTrybe badge.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            <Link to="/pricing"><Button variant="primary">View plans</Button></Link>
            <Link to="/dashboard/settings/subscription"><Button variant="secondary">Manage subscription</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  const activeEditable = editablePages.includes(activePage)
  const activeData = pages[activePage] || { template: 't1', content: {}, visible: true }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: isMobile ? '16px' : '28px 24px 48px', maxWidth: 820, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }} className="website-builder-page">
      <style>{`
        @media (max-width: 767px) {
          .website-builder-page h1 { font-size: 24px !important; }
          .website-builder-page button:not(.dash-switch):not(.wb-tab) { min-height: 44px; }
          .website-builder-page input, .website-builder-page textarea { font-size: 14px !important; }
        }
      `}</style>

      <header>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 28px)', color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>Website</h1>
        {proOnePage ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: 8, lineHeight: 1.6 }}>
            You're on Pro, so you have a single-page site. Upgrade to Expert or Elite to add About and Contact pages.
          </p>
        ) : null}
      </header>

      {/* Publish */}
      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Your website</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', fontFamily: 'var(--font-ui)', background: published ? 'rgba(29,185,84,0.15)' : 'rgba(156,163,175,0.12)', color: published ? '#1DB954' : 'var(--text-muted)', border: published ? '1px solid rgba(29,185,84,0.35)' : '1px solid var(--border-default)' }}>{published ? 'Live' : 'Offline'}</span>
            <button
              type="button"
              className="dash-switch"
              role="switch"
              aria-checked={published}
              disabled={savingPublish}
              onClick={() => savePublish(!published)}
              style={{ width: 52, height: 28, minHeight: 28, padding: 0, borderRadius: 999, border: '1px solid var(--border-default)', background: published ? '#1DB954' : 'var(--bg-base)', position: 'relative', cursor: savingPublish ? 'wait' : 'pointer', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, left: published ? 26 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }} />
            </button>
          </div>
        </div>
        {prettyUrl ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', wordBreak: 'break-all' }}>{prettyUrl}</span>
            {previewHref ? <a href={previewHref} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm" type="button">View site</Button></a> : null}
          </div>
        ) : null}
        {publishSaved ? <p style={{ margin: 0, fontSize: '13px', color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</p> : null}
      </section>

      {/* Address */}
      <section style={card}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Website address</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
          <input value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} style={{ ...inputStyle, maxWidth: 280, flex: '1 1 160px' }} autoComplete="off" spellCheck={false} />
          <span style={{ color: 'var(--text-muted)' }}>.lenstrybe.com</span>
        </div>
        <div style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', minHeight: 18 }}>
          {checkingSlug ? <span style={{ color: 'var(--text-muted)' }}>Checking availability…</span> : null}
          {!checkingSlug && slugAvailable === true && isValidSlug(subdomain.trim()) ? <span style={{ color: '#1DB954' }}>This address is available.</span> : null}
          {!checkingSlug && slugAvailable === false ? <span style={{ color: '#f87171' }}>This address is already taken.</span> : null}
        </div>
        {slugError ? <p style={{ margin: 0, fontSize: '13px', color: '#f87171', fontFamily: 'var(--font-ui)' }}>{slugError}</p> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={saveUrl} disabled={savingUrl}>{savingUrl ? 'Saving…' : 'Save address'}</Button>
          {urlSaved ? <span style={{ fontSize: '13px', color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
        </div>
      </section>

      {/* Page tabs + editor */}
      <section style={card}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Pages</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PAGE_ORDER.map((pt) => {
            const locked = !editablePages.includes(pt)
            const active = activePage === pt
            return (
              <button
                key={pt}
                type="button"
                className="wb-tab"
                onClick={() => setActivePage(pt)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: active ? '1px solid #1DB954' : '1px solid var(--border-default)',
                  background: active ? 'rgba(29,185,84,0.12)' : 'var(--bg-base)',
                  color: active ? '#1DB954' : locked ? 'var(--text-muted)' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {PAGE_LABEL[pt]}{locked ? ' 🔒' : ''}
              </button>
            )
          })}
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

        {loadingPages ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>Loading…</p>
        ) : activeEditable ? (
          <PageEditor
            key={activePage}
            pageType={activePage}
            content={activeData.content || {}}
            template={activeData.template || 't1'}
            visible={activeData.visible !== false}
            onField={(k, v) => setField(activePage, k, v)}
            onTemplate={(t) => setTemplate(activePage, t)}
            onVisible={(v) => setVisible(activePage, v)}
            onUploadImage={(field, file) => uploadImage(activePage, field, file)}
            uploadingField={uploadingField}
            onSave={() => savePage(activePage)}
            saving={savingPage === activePage}
            saved={savedPage === activePage}
            styles={editorStyles}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 16px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)' }}>{PAGE_LABEL[activePage]} page is an Expert feature</div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', maxWidth: 420, lineHeight: 1.6 }}>
              Upgrade to Expert or Elite to add an {PAGE_LABEL[activePage]} page to your website.
            </p>
            <Link to="/pricing"><Button variant="primary" size="sm">View plans</Button></Link>
          </div>
        )}
      </section>

      {/* Site settings */}
      <section style={card}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Site settings</div>

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
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 999, padding: '5px 6px 5px 12px' }}>
                  {a}
                  <button type="button" onClick={() => setAreas((prev) => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '0 4px' }} aria-label={`Remove ${a}`}>×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div style={label}>Search title (SEO)</div>
          <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="e.g. Jane Doe Photography | Sydney Weddings" style={{ ...inputStyle, marginTop: 8 }} />
        </div>
        <div>
          <div style={label}>Search description (SEO)</div>
          <textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} rows={3} placeholder="A short sentence that appears in Google results." style={{ ...inputStyle, marginTop: 8, resize: 'vertical', minHeight: 72 }} />
        </div>

        {fullBuilder ? (
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-primary)' }}>
            <span>Show "Made with LensTrybe" in the footer</span>
            <input type="checkbox" checked={showMadeWith} onChange={(e) => setShowMadeWith(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1DB954' }} />
          </label>
        ) : (
          <div style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            The "Made with LensTrybe" footer appears on Pro sites. Upgrade to Expert or Elite to remove it.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save settings'}</Button>
          {settingsSaved ? <span style={{ fontSize: '13px', color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
        </div>
      </section>
    </div>
  )
}
