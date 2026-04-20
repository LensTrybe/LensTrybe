import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'

const DEFAULT_SECTIONS = {
  client_reviews: true,
  services_pricing: true,
  contact_form: true,
  content_gallery: true,
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

function mergeSections(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SECTIONS }
  return { ...DEFAULT_SECTIONS, ...raw }
}

function extractStoragePath(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null
  try {
    const u = new URL(publicUrl)
    const i = u.pathname.indexOf('/object/public/portfolio-website/')
    if (i === -1) return null
    return u.pathname.slice(i + '/object/public/portfolio-website/'.length)
  } catch {
    return null
  }
}

function normalizeVanityUrl(raw) {
  const t = (raw ?? '').trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function flash(setter, ms = 2800) {
  setter(true)
  setTimeout(() => setter(false), ms)
}

function FileThumb({ url, mime, label }) {
  const isImg = mime?.startsWith('image/')
  const isVid = mime?.startsWith('video/')
  if (isImg) {
    return <img src={url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-default)' }} />
  }
  if (isVid) {
    return (
      <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-default)', background: '#111', position: 'relative' }}>
        <video src={url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶</span>
      </div>
    )
  }
  return (
    <div style={{ width: 48, height: 48, borderRadius: 8, border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
      {label}
    </div>
  )
}

const emptyService = (sortOrder = 0) => ({ id: null, name: '', description: '', price: '', sort_order: sortOrder, isSaving: false, isDeleting: false })

export default function PortfolioWebsitePage() {
  const { user, profile, fetchUserData } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const { tier } = useSubscription()
  const hasAccess = tier === 'expert' || tier === 'elite'
  const isElite = profile?.subscription_tier?.toLowerCase() === 'elite'

  const [brandKit, setBrandKit] = useState(null)
  const [contentRows, setContentRows] = useState([])
  const [loadingContent, setLoadingContent] = useState(false)

  const [published, setPublished] = useState(false)
  const [savingPublish, setSavingPublish] = useState(false)
  const [publishSaved, setPublishSaved] = useState(false)

  const [subdomain, setSubdomain] = useState('')
  const [slugAvailable, setSlugAvailable] = useState(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [savingWebsiteUrl, setSavingWebsiteUrl] = useState(false)
  const [websiteUrlSaved, setWebsiteUrlSaved] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [vanityUrl, setVanityUrl] = useState('')

  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [headline, setHeadline] = useState('')
  const [tagline, setTagline] = useState('')
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [appearanceSaved, setAppearanceSaved] = useState(false)

  const [sections, setSections] = useState({ ...DEFAULT_SECTIONS })
  const [savingSections, setSavingSections] = useState(false)
  const [sectionsSaved, setSectionsSaved] = useState(false)

  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderCover, setNewFolderCover] = useState(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [manageTarget, setManageTarget] = useState(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const [services, setServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [servicesSaved, setServicesSaved] = useState(false)
  const [dragServiceId, setDragServiceId] = useState(null)

  const coverInputRef = useRef(null)
  const newFolderCoverRef = useRef(null)
  const addFilesRef = useRef(null)

  const loadBrandKit = useCallback(async () => {
    if (!user?.id || !supabase) return
    const { data } = await supabase.from('brand_kit').select('primary_color, font').eq('creative_id', user.id).maybeSingle()
    setBrandKit(data ?? null)
  }, [user?.id])

  const loadContent = useCallback(async () => {
    if (!user?.id || !supabase) return
    setLoadingContent(true)
    const { data, error } = await supabase
      .from('portfolio_website_content')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: true })
    if (!error) setContentRows(data ?? [])
    setLoadingContent(false)
  }, [user?.id])

  const loadServices = useCallback(async () => {
    if (!user?.id || !supabase) return
    setLoadingServices(true)
    const { data, error } = await supabase
      .from('portfolio_services')
      .select('*')
      .eq('creative_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (!error) {
      setServices((data ?? []).map((s) => ({ ...s, isSaving: false, isDeleting: false })))
    }
    setLoadingServices(false)
  }, [user?.id])

  useEffect(() => {
    if (!hasAccess || !profile) return
    setPublished(!!profile.portfolio_website_active)
    setSubdomain((profile.custom_domain ?? slugFromBusinessName(profile.business_name)).toLowerCase())
    setHeadline(profile.portfolio_headline ?? '')
    setTagline(profile.portfolio_tagline ?? '')
    setSections(mergeSections(profile.portfolio_sections))
    setVanityUrl(profile.portfolio_website_vanity_url ?? '')
    if (profile.portfolio_cover_url) setCoverPreview(profile.portfolio_cover_url)
  }, [profile, hasAccess])

  useEffect(() => {
    if (!hasAccess) return
    loadBrandKit()
    loadContent()
    loadServices()
  }, [hasAccess, loadBrandKit, loadContent, loadServices])

  useEffect(() => {
    if (!hasAccess || !user?.id || !supabase) return
    const s = subdomain.trim().toLowerCase()
    if (!isValidSlug(s)) {
      setSlugAvailable(null)
      setCheckingSlug(false)
      return
    }
    setCheckingSlug(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('custom_domain', s).neq('id', user.id).maybeSingle()
      setSlugAvailable(!data)
      setCheckingSlug(false)
    }, 420)
    return () => clearTimeout(t)
  }, [subdomain, user?.id, hasAccess])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const folders = useMemo(() => contentRows.filter((r) => r.content_type === 'folder'), [contentRows])
  const files = useMemo(() => contentRows.filter((r) => r.content_type === 'file'), [contentRows])

  function filesForFolder(folderId) {
    if (folderId === 'general') return files.filter((f) => !f.parent_folder_id)
    return files.filter((f) => f.parent_folder_id === folderId)
  }

  async function savePublish(next) {
    if (!user?.id || !supabase) return
    setSavingPublish(true)
    const { error } = await supabase.from('profiles').update({ portfolio_website_active: next }).eq('id', user.id)
    setSavingPublish(false)
    if (error) {
      window.alert(error.message)
      return
    }
    setPublished(next)
    await fetchUserData(user.id)
    flash(setPublishSaved)
  }

  const displaySlug = (profile?.custom_domain ?? subdomain).trim().toLowerCase()
  const publicSiteHref = isValidSlug(displaySlug) ? `https://${displaySlug}.lenstrybe.com` : null

  async function saveWebsiteUrlAndVanity() {
    console.log('[PortfolioWebsitePage] saveWebsiteUrlAndVanity:start', {
      subdomain,
      slugAvailable,
      isElite,
      vanityUrl,
      userId: user?.id ?? null,
      hasSupabase: !!supabase,
    })
    setSlugError('')
    setWebsiteUrlSaved(false)
    const s = subdomain.trim().toLowerCase()
    if (!user?.id || !supabase) {
      console.log('[PortfolioWebsitePage] saveWebsiteUrlAndVanity:early-return missing user or supabase', {
        userId: user?.id ?? null,
        hasSupabase: !!supabase,
      })
      return
    }
    const savedVanityForDb = isElite ? normalizeVanityUrl(vanityUrl) : null
    const savedVanityForState = isElite ? (savedVanityForDb ?? '') : vanityUrl
    const shouldSaveVanity = isElite
    const hasValidSlug = isValidSlug(s)
    const slugIsAvailable = slugAvailable !== false
    const shouldSaveSlug = hasValidSlug && slugIsAvailable

    if (!hasValidSlug) {
      console.log('[PortfolioWebsitePage] saveWebsiteUrlAndVanity:skip slug save invalid slug', { s })
      setSlugError('Use 2 to 63 characters: lowercase letters, numbers and hyphens only. No spaces.')
    } else if (!slugIsAvailable) {
      console.log('[PortfolioWebsitePage] saveWebsiteUrlAndVanity:skip slug save slug unavailable', { s, slugAvailable })
      setSlugError('That subdomain is already taken. Try another.')
    }

    if (!shouldSaveSlug && !shouldSaveVanity) {
      console.log('[PortfolioWebsitePage] saveWebsiteUrlAndVanity:early-return nothing to save', {
        shouldSaveSlug,
        shouldSaveVanity,
      })
      return
    }

    setSavingWebsiteUrl(true)
    try {
      if (shouldSaveSlug) {
        const { error: slugErr } = await supabase
          .from('profiles')
          .update({ custom_domain: s })
          .eq('id', user.id)
        if (slugErr) throw slugErr
      }

      if (shouldSaveVanity) {
        const { error: vanityErr } = await supabase
          .from('profiles')
          .update({ portfolio_website_vanity_url: savedVanityForDb })
          .eq('id', user.id)
        if (vanityErr) throw vanityErr
      }

      await fetchUserData(user.id)
      setVanityUrl(savedVanityForState)
      flash(setWebsiteUrlSaved)
    } catch (error) {
      if (error?.code === '23505' || error?.message?.includes('unique')) {
        setSlugError('That subdomain is already taken.')
      } else {
        setSlugError(error?.message || 'Could not save URL settings')
      }
    } finally {
      setSavingWebsiteUrl(false)
    }
  }

  async function saveAppearance() {
    if (!user?.id || !supabase) return
    setSavingAppearance(true)
    let coverUrl = profile?.portfolio_cover_url ?? null
    try {
      if (coverFile) {
        const ext = coverFile.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg'
        const path = `${user.id}/cover/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, coverFile, { upsert: true })
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
        coverUrl = pub.publicUrl
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          portfolio_cover_url: coverUrl,
          portfolio_headline: headline.trim() || null,
          portfolio_tagline: tagline.trim() || null,
        })
        .eq('id', user.id)
      if (error) throw new Error(error.message)
      setCoverFile(null)
      if (coverUrl) setCoverPreview(coverUrl)
      await fetchUserData(user.id)
      flash(setAppearanceSaved)
    } catch (e) {
      window.alert(e.message || 'Could not save appearance')
    } finally {
      setSavingAppearance(false)
    }
  }

  async function saveSections() {
    if (!user?.id || !supabase) return
    setSavingSections(true)
    const { error } = await supabase.from('profiles').update({ portfolio_sections: sections }).eq('id', user.id)
    setSavingSections(false)
    if (error) {
      window.alert(error.message)
      return
    }
    await fetchUserData(user.id)
    flash(setSectionsSaved)
  }

  function updateServiceLocal(id, patch) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function addServiceRow() {
    setServices((prev) => [...prev, emptyService(prev.length)])
  }

  async function saveServiceRow(service, idx) {
    if (!user?.id || !supabase) return
    const name = (service.name || '').trim()
    if (!name) {
      window.alert('Service name is required.')
      return
    }
    const description = (service.description || '').trim()
    const price = (service.price || '').trim()
    if (service.id) updateServiceLocal(service.id, { isSaving: true })
    try {
      if (service.id) {
        const { error } = await supabase
          .from('portfolio_services')
          .update({ name, description: description || null, price: price || null })
          .eq('id', service.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('portfolio_services')
          .insert({
            creative_id: user.id,
            name,
            description: description || null,
            price: price || null,
            sort_order: idx,
          })
          .select()
          .single()
        if (error) throw error
        setServices((prev) => prev.map((s, i) => (i === idx ? { ...data, isSaving: false, isDeleting: false } : s)))
      }
      flash(setServicesSaved, 2000)
    } catch (e) {
      window.alert(e.message || 'Could not save service')
    } finally {
      if (service.id) updateServiceLocal(service.id, { isSaving: false })
    }
  }

  async function deleteServiceRow(service, idx) {
    if (service.id && !window.confirm('Delete this service?')) return
    if (!service.id) {
      setServices((prev) => prev.filter((_, i) => i !== idx).map((s, i2) => ({ ...s, sort_order: i2 })))
      return
    }
    updateServiceLocal(service.id, { isDeleting: true })
    const { error } = await supabase.from('portfolio_services').delete().eq('id', service.id)
    if (error) {
      updateServiceLocal(service.id, { isDeleting: false })
      window.alert(error.message)
      return
    }
    const next = services.filter((s) => s.id !== service.id).map((s, i) => ({ ...s, sort_order: i }))
    setServices(next)
    await Promise.all(next.filter((s) => s.id).map((s, i) => supabase.from('portfolio_services').update({ sort_order: i }).eq('id', s.id)))
    flash(setServicesSaved, 2000)
  }

  async function persistServiceOrder(next) {
    setServices(next)
    const updates = next.filter((s) => s.id).map((s, idx) => supabase.from('portfolio_services').update({ sort_order: idx }).eq('id', s.id))
    await Promise.all(updates)
    flash(setServicesSaved, 2000)
  }

  async function onServiceDrop(dropIndex) {
    if (!dragServiceId) return
    const current = [...services]
    const fromIndex = current.findIndex((s) => String(s.id ?? `tmp-${services.indexOf(s)}`) === dragServiceId)
    if (fromIndex < 0 || fromIndex === dropIndex) {
      setDragServiceId(null)
      return
    }
    const [moved] = current.splice(fromIndex, 1)
    current.splice(dropIndex, 0, moved)
    const reindexed = current.map((s, i) => ({ ...s, sort_order: i }))
    await persistServiceOrder(reindexed)
    setDragServiceId(null)
  }

  async function createFolder() {
    const name = newFolderName.trim()
    if (!name || !user?.id || !supabase) return
    setCreatingFolder(true)
    try {
      const { data: folder, error } = await supabase
        .from('portfolio_website_content')
        .insert({ creative_id: user.id, content_type: 'folder', name, cover_url: null, sort_order: folders.length })
        .select()
        .single()
      if (error) throw new Error(error.message)
      if (newFolderCover && folder?.id) {
        const ext = newFolderCover.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg'
        const path = `${user.id}/content/${folder.id}/cover.${ext}`
        const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, newFolderCover, { upsert: true })
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
        await supabase.from('portfolio_website_content').update({ cover_url: pub.publicUrl }).eq('id', folder.id)
      }
      setNewFolderName('')
      setNewFolderCover(null)
      await loadContent()
    } catch (e) {
      window.alert(e.message || 'Could not create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  async function deleteFolder(folder) {
    if (!window.confirm(`Delete folder "${folder.name}" and all files inside it? This cannot be undone.`)) return
    const inFolder = filesForFolder(folder.id)
    const paths = []
    for (const f of inFolder) {
      const p = f.storage_path || extractStoragePath(f.file_url)
      if (p) paths.push(p)
    }
    const coverPath = extractStoragePath(folder.cover_url)
    if (coverPath) paths.push(coverPath)
    if (paths.length && supabase) await supabase.storage.from('portfolio-website').remove(paths)
    await supabase.from('portfolio_website_content').delete().eq('id', folder.id)
    await loadContent()
    if (manageTarget === folder.id) setManageTarget(null)
  }

  async function deleteFile(row) {
    if (!window.confirm(`Remove "${row.filename}" from your gallery?`)) return
    const p = row.storage_path || extractStoragePath(row.file_url)
    if (p) await supabase.storage.from('portfolio-website').remove([p])
    await supabase.from('portfolio_website_content').delete().eq('id', row.id)
    await loadContent()
  }

  async function uploadFilesToTarget(fileList, targetFolderId) {
    if (!user?.id || !supabase || !fileList?.length) return
    setUploadingFiles(true)
    try {
      const segment = targetFolderId === 'general' ? 'general' : targetFolderId
      for (const file of fileList) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${user.id}/content/${segment}/${Date.now()}-${safe}`
        const { error: upErr } = await supabase.storage.from('portfolio-website').upload(path, file)
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from('portfolio-website').getPublicUrl(path)
        const parent = targetFolderId === 'general' ? null : targetFolderId
        const { error: insErr } = await supabase.from('portfolio_website_content').insert({
          creative_id: user.id,
          content_type: 'file',
          parent_folder_id: parent,
          file_url: pub.publicUrl,
          storage_path: path,
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
        })
        if (insErr) throw new Error(insErr.message)
      }
      await loadContent()
    } catch (e) {
      window.alert(e.message || 'Upload failed')
    } finally {
      setUploadingFiles(false)
      if (addFilesRef.current) addFilesRef.current.value = ''
    }
  }

  const card = { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }
  const label = { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.05em' }
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', boxSizing: 'border-box' }

  if (!user) return <div style={{ padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Sign in to manage your portfolio website.</div>

  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '28px 32px', maxWidth: 720, margin: '0 auto' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>Portfolio website</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '8px', lineHeight: 1.6 }}>
            Your own public site at a LensTrybe subdomain, with sections you control and a gallery for client-ready files.
          </p>
        </div>
        <div style={{ ...card, textAlign: 'center', alignItems: 'center', gap: '20px', padding: '40px 28px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)' }}>Upgrade to Expert or Elite</div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, maxWidth: 440, margin: 0 }}>
            The portfolio website builder is available on Expert and Elite.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            <Link to="/pricing"><Button variant="primary">View plans</Button></Link>
            <Link to="/dashboard/settings/subscription"><Button variant="secondary">Manage subscription</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: isMobile ? '16px' : '28px 24px 48px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }} className="portfolio-website-page">
      <style>{`
        @media (max-width: 767px) {
          .portfolio-website-page h1, .portfolio-website-page h2 { font-size: 24px !important; }
          .portfolio-website-page button:not(.dash-switch) { min-height: 44px; }
          .portfolio-website-page input, .portfolio-website-page textarea, .portfolio-website-page select { width: 100% !important; font-size: 14px !important; }
          .portfolio-website-page .folder-grid-mobile { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      <header>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 28px)', color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>Portfolio website</h1>
      </header>

      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div><div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Your Website</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', fontFamily: 'var(--font-ui)', background: published ? 'rgba(29,185,84,0.15)' : 'rgba(156,163,175,0.12)', color: published ? '#1DB954' : 'var(--text-muted)', border: published ? '1px solid rgba(29,185,84,0.35)' : '1px solid var(--border-default)' }}>{published ? 'Live' : 'Offline'}</span>
            <button
              type="button"
              className="dash-switch"
              role="switch"
              aria-checked={published}
              disabled={savingPublish}
              onClick={() => savePublish(!published)}
              style={
                isMobile
                  ? { width: 40, height: 24, minHeight: 24, padding: 0, borderRadius: 999, border: '1px solid var(--border-default)', background: published ? '#1DB954' : 'var(--bg-base)', position: 'relative', cursor: savingPublish ? 'wait' : 'pointer', flexShrink: 0 }
                  : { width: 52, height: 28, minHeight: 28, padding: 0, borderRadius: 999, border: '1px solid var(--border-default)', background: published ? '#1DB954' : 'var(--bg-base)', position: 'relative', cursor: savingPublish ? 'wait' : 'pointer', flexShrink: 0 }
              }
            >
              <span
                style={
                  isMobile
                    ? { position: 'absolute', top: 4, left: published ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }
                    : { position: 'absolute', top: 3, left: published ? 26 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }
                }
              />
            </button>
          </div>
        </div>
        {published && publicSiteHref ? <a href={publicSiteHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', color: '#1DB954', fontFamily: 'var(--font-ui)', wordBreak: 'break-all' }}>{publicSiteHref.replace(/^https:\/\//, '')}</a> : null}
        {publishSaved ? <p style={{ margin: 0, fontSize: '13px', color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</p> : null}
      </section>

      <section style={card}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Your Website URL</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
          <input value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} style={{ ...inputStyle, maxWidth: 280, flex: '1 1 160px' }} autoComplete="off" spellCheck={false} />
          <span style={{ color: 'var(--text-muted)' }}>.lenstrybe.com</span>
        </div>
        <div style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', minHeight: 18 }}>
          {checkingSlug ? <span style={{ color: 'var(--text-muted)' }}>Checking availability…</span> : null}
          {!checkingSlug && slugAvailable === true && isValidSlug(subdomain.trim()) ? <span style={{ color: '#1DB954' }}>This subdomain is available.</span> : null}
          {!checkingSlug && slugAvailable === false ? <span style={{ color: '#f87171' }}>This subdomain is already taken.</span> : null}
        </div>
        {isElite ? (
          <>
            <div style={{ ...label, marginTop: 4 }}>Custom Domain Link</div>
            <input value={vanityUrl} onChange={(e) => setVanityUrl(e.target.value)} style={inputStyle} placeholder="https://www.mywebsite.com" />
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>This link appears on your public profile. No DNS configuration required.</p>
          </>
        ) : null}
        {slugError ? <p style={{ margin: 0, fontSize: '13px', color: '#f87171', fontFamily: 'var(--font-ui)' }}>{slugError}</p> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={saveWebsiteUrlAndVanity} disabled={savingWebsiteUrl}>
            {savingWebsiteUrl ? 'Saving…' : 'Save URL'}
          </Button>
          {websiteUrlSaved ? <span style={{ fontSize: '13px', color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
        </div>
      </section>

      <section style={card}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Appearance</div>
        <div>
          <div style={label}>Cover photo (hero banner)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: 8 }}>
            {(coverPreview || profile?.portfolio_cover_url) ? <img src={coverPreview || profile?.portfolio_cover_url} alt="" style={{ width: 'min(100%, 320px)', maxHeight: 140, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border-default)' }} /> : null}
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
            <Button variant="secondary" type="button" onClick={() => coverInputRef.current?.click()}>{coverFile ? 'Replace image' : 'Choose image'}</Button>
          </div>
        </div>
        <div><div style={label}>Headline</div><input value={headline} onChange={(e) => setHeadline(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} /></div>
        <div><div style={label}>Tagline</div><textarea value={tagline} onChange={(e) => setTagline(e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 8, resize: 'vertical', minHeight: 72 }} /></div>
        <div style={{ padding: '12px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.55 }}>
            Your colour scheme is pulled from your Brand Kit{brandKit?.primary_color ? ` (${brandKit.primary_color}).` : '.'} Your font is pulled from your Brand Kit{brandKit?.font ? ` (${brandKit.font}).` : '.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={saveAppearance} disabled={savingAppearance}>{savingAppearance ? 'Saving…' : 'Save appearance'}</Button>
          {appearanceSaved ? <span style={{ fontSize: '13px', color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
        </div>
      </section>

      <section style={card}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Sections</div>
        {[
          { key: 'client_reviews', title: 'Client reviews' },
          { key: 'services_pricing', title: 'Services and pricing' },
          { key: 'contact_form', title: 'Contact form' },
          { key: 'content_gallery', title: 'Gallery' },
        ].map(({ key, title }) => {
          const on = !!sections[key]
          if (isMobile) {
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)' }}>
                <span>{title}</span>
                <button
                  type="button"
                  className="dash-switch"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                  style={{
                    width: 40,
                    height: 22,
                    minHeight: 22,
                    padding: 0,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-default)',
                    background: on ? '#1DB954' : 'var(--bg-base)',
                    position: 'relative',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: on ? 21 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.15s ease',
                    }}
                  />
                </button>
              </div>
            )
          }
          return (
            <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)' }}>
              <span>{title}</span>
              <input type="checkbox" checked={on} onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.checked }))} style={{ width: 18, height: 18, accentColor: '#1DB954' }} />
            </label>
          )
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={saveSections} disabled={savingSections}>{savingSections ? 'Saving…' : 'Save sections'}</Button>
          {sectionsSaved ? <span style={{ fontSize: '13px', color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
        </div>
      </section>

      <section style={card}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Services and Pricing</div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          Build your public services list. This appears when Services and Pricing is enabled.
        </p>
        {loadingServices ? <p style={{ margin: 0, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading…</p> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {services.map((service, idx) => {
            const dragKey = String(service.id ?? `new-${idx}`)
            return (
              <div
                key={dragKey}
                draggable
                onDragStart={() => setDragServiceId(dragKey)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onServiceDrop(idx)}
                style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, background: 'var(--bg-base)', display: 'grid', gap: 10 }}
              >
                <input value={service.name || ''} onChange={(e) => setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s)))} style={inputStyle} placeholder="Service name" />
                <textarea value={service.description || ''} onChange={(e) => setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, description: e.target.value } : s)))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Description" />
                <input value={service.price || ''} onChange={(e) => setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, price: e.target.value } : s)))} style={inputStyle} placeholder="$500, From $800, POA" />
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button variant="primary" size="sm" type="button" onClick={() => saveServiceRow(service, idx)} disabled={service.isSaving || service.isDeleting}>
                    {service.isSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => deleteServiceRow(service, idx)} disabled={service.isSaving || service.isDeleting}>
                    {service.isDeleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="secondary" onClick={addServiceRow} type="button">Add Service</Button>
          {servicesSaved ? <span style={{ fontSize: 13, color: '#1DB954', fontFamily: 'var(--font-ui)' }}>Saved.</span> : null}
        </div>
      </section>

      <section style={{ ...card, gap: '20px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Gallery</div>
        <div style={{ border: '1px dashed var(--border-default)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>New folder</div>
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} style={inputStyle} placeholder="Folder name" />
          <input ref={newFolderCoverRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => setNewFolderCover(e.target.files?.[0] ?? null)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <Button variant="secondary" type="button" size="sm" onClick={() => newFolderCoverRef.current?.click()}>{newFolderCover ? 'Change cover' : 'Optional cover'}</Button>
          </div>
          <Button variant="primary" type="button" onClick={createFolder} disabled={creatingFolder || !newFolderName.trim()}>{creatingFolder ? 'Creating…' : 'Create folder'}</Button>
        </div>
        {loadingContent ? <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '13px' }}>Loading…</p> : (
          <div className="folder-grid-mobile" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '12px' }}>
            <GeneralRow count={filesForFolder('general').length} manageOpen={manageTarget === 'general'} onManage={() => setManageTarget((t) => (t === 'general' ? null : 'general'))} onAddFiles={(fl) => uploadFilesToTarget(fl, 'general')} files={filesForFolder('general')} onDeleteFile={deleteFile} uploadingFiles={uploadingFiles} addFilesRef={addFilesRef} />
            {folders.map((folder) => (
              <FolderRow key={folder.id} folder={folder} fileCount={filesForFolder(folder.id).length} manageOpen={manageTarget === folder.id} onManage={() => setManageTarget((t) => (t === folder.id ? null : folder.id))} onDelete={() => deleteFolder(folder)} files={filesForFolder(folder.id)} onDeleteFile={deleteFile} onAddFiles={(fl) => uploadFilesToTarget(fl, folder.id)} uploadingFiles={uploadingFiles} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function GeneralRow({ count, manageOpen, onManage, onAddFiles, files, onDeleteFile, uploadingFiles, addFilesRef }) {
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>General</div>
          <div><div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>General</div><div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{count} file{count === 1 ? '' : 's'}</div></div>
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={onManage}>{manageOpen ? 'Close' : 'Manage Files'}</Button>
      </div>
      {manageOpen ? <ManagePanel files={files} onDeleteFile={onDeleteFile} onPickFiles={(e) => { const fl = e.target.files; if (fl?.length) onAddFiles(Array.from(fl)) }} uploadingFiles={uploadingFiles} inputRef={addFilesRef} /> : null}
    </div>
  )
}

function FolderRow({ folder, fileCount, manageOpen, onManage, onDelete, files, onDeleteFile, onAddFiles, uploadingFiles }) {
  const localRef = useRef(null)
  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {folder.cover_url ? <img src={folder.cover_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-default)' }} /> : <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }} />}
          <div><div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{folder.name}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{fileCount} file{fileCount === 1 ? '' : 's'}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" type="button" onClick={onManage}>{manageOpen ? 'Close' : 'Manage Files'}</Button>
          <Button variant="ghost" size="sm" type="button" onClick={onDelete}>Delete Folder</Button>
        </div>
      </div>
      {manageOpen ? <ManagePanel files={files} onDeleteFile={onDeleteFile} onPickFiles={(e) => { const fl = e.target.files; if (fl?.length) onAddFiles(Array.from(fl)) }} uploadingFiles={uploadingFiles} inputRef={localRef} /> : null}
    </div>
  )
}

function ManagePanel({ files, onDeleteFile, onPickFiles, uploadingFiles, inputRef }) {
  return (
    <div style={{ marginTop: 4, padding: '14px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: 12 }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Files in this folder</span>
        <div>
          <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,.pdf,application/pdf" style={{ display: 'none' }} onChange={onPickFiles} />
          <Button variant="secondary" size="sm" type="button" disabled={uploadingFiles} onClick={() => inputRef.current?.click()}>{uploadingFiles ? 'Uploading…' : 'Add Files'}</Button>
        </div>
      </div>
      {files.length === 0 ? <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>No files yet. Add images, video or PDF.</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {files.map((f) => (
            <li key={f.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <FileThumb url={f.file_url} mime={f.mime_type} label="PDF" />
              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', wordBreak: 'break-word' }}>{f.filename}</div>
                <span style={{ display: 'inline-block', marginTop: 4, fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.12)', color: '#A855F7', fontFamily: 'var(--font-ui)' }}>{(f.mime_type || '').split('/')[1] || 'file'}</span>
              </div>
              <Button variant="ghost" size="sm" type="button" onClick={() => onDeleteFile(f)}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
