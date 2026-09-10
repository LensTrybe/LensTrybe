import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const BRAND_GREEN = '#1DB954'

/* ---------- helpers ---------- */

function onAccentText(hex) {
  try {
    let h = String(hex || BRAND_GREEN).replace('#', '')
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.6 ? '#04120a' : '#ffffff'
  } catch {
    return '#04120a'
  }
}

function isImage(f) {
  return f?.type?.startsWith('image') || /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f?.url || '')
}
function isVideo(f) {
  return f?.type?.startsWith('video') || /\.(mp4|mov|avi|webm|m4v)$/i.test(f?.url || '')
}

let jszipPromise = null
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip)
  if (jszipPromise) return jszipPromise
  jszipPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    s.onload = () => resolve(window.JSZip)
    s.onerror = reject
    document.head.appendChild(s)
  })
  return jszipPromise
}

function saveBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name || 'file'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/* ---------- lightbox (module scope) ---------- */

function Lightbox({ items, index, onClose, onNav, favSet, onToggleFav, onDownload, accent, accentText, slideshow, onToggleSlideshow }) {
  const item = items[index]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onNav(1)
      else if (e.key === 'ArrowLeft') onNav(-1)
      else if (e.key === 'f' || e.key === 'F') onToggleFav(item)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose, onNav, onToggleFav])

  useEffect(() => {
    if (!slideshow) return undefined
    const t = setInterval(() => onNav(1), 3200)
    return () => clearInterval(t)
  }, [slideshow, onNav])

  const touch = useRef(null)
  if (!item) return null
  const fav = favSet.has(item.url)

  return (
    <div
      className="dgl-lb"
      onClick={onClose}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 50) onNav(dx < 0 ? 1 : -1)
        touch.current = null
      }}
    >
      <button type="button" className="dgl-lb-close" onClick={onClose} aria-label="Close">✕</button>

      <button type="button" className="dgl-lb-nav dgl-lb-prev" onClick={(e) => { e.stopPropagation(); onNav(-1) }} aria-label="Previous">‹</button>
      <button type="button" className="dgl-lb-nav dgl-lb-next" onClick={(e) => { e.stopPropagation(); onNav(1) }} aria-label="Next">›</button>

      <div className="dgl-lb-stage" onClick={(e) => e.stopPropagation()}>
        {isVideo(item)
          ? <video src={item.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 10 }} />
          : <img src={item.url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 10 }} />}
        <div className="dgl-lb-bar">
          <span className="dgl-lb-name">{item.name}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="dgl-lb-btn" onClick={onToggleSlideshow}>{slideshow ? '❚❚ Pause' : '▶ Slideshow'}</button>
            <button type="button" className="dgl-lb-btn" onClick={() => onToggleFav(item)} style={fav ? { color: accent, borderColor: accent } : undefined}>
              {fav ? '♥ Favourited' : '♡ Favourite'}
            </button>
            <button type="button" className="dgl-lb-btn" style={{ background: accent, color: accentText, border: 'none' }} onClick={() => onDownload(item)}>Download</button>
          </div>
        </div>
        <div className="dgl-lb-count">{index + 1} / {items.length}</div>
      </div>
    </div>
  )
}

/* ---------- page ---------- */

export default function DeliverDownloadPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [expired, setExpired] = useState(false)
  const [locked, setLocked] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [delivery, setDelivery] = useState(null)
  const [creative, setCreative] = useState(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [favSet, setFavSet] = useState(new Set())
  const [favDirty, setFavDirty] = useState(false)
  const [sendingFav, setSendingFav] = useState(false)
  const [lightbox, setLightbox] = useState(-1)
  const [slideshow, setSlideshow] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const applyLoaded = useCallback((data) => {
    setDelivery(data.delivery)
    setCreative(data.creative ?? null)
    setFavSet(new Set(Array.isArray(data.delivery?.favourites) ? data.delivery.favourites : []))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.functions.invoke('deliver', { body: { action: 'load', token } })
      if (cancelled) return
      if (error || !data || data.error) { setNotFound(true); setLoading(false); return }
      setExpired(Boolean(data.expired))
      setLocked(Boolean(data.locked))
      setCreative(data.creative ?? null)
      setDelivery(data.delivery ?? null)
      if (!data.locked) {
        setUnlocked(true)
        setFavSet(new Set(Array.isArray(data.delivery?.favourites) ? data.delivery.favourites : []))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [token])

  async function unlock() {
    setChecking(true)
    setPasswordError(false)
    const { data, error } = await supabase.functions.invoke('deliver', { body: { action: 'unlock', token, password } })
    setChecking(false)
    if (error || !data?.ok) { setPasswordError(true); return }
    setExpired(Boolean(data.expired))
    applyLoaded(data)
    setUnlocked(true)
    setLocked(false)
  }

  const files = useMemo(() => (unlocked ? (delivery?.files ?? []) : []), [unlocked, delivery])
  const photos = useMemo(() => files.filter(isImage), [files])
  const videos = useMemo(() => files.filter(isVideo), [files])
  const others = useMemo(() => files.filter((f) => !isImage(f) && !isVideo(f)), [files])
  const lightboxItems = useMemo(() => [...photos, ...videos], [photos, videos])

  const brandAccent = delivery?.brand_primary_color || BRAND_GREEN
  const accentText = onAccentText(brandAccent)

  async function trackDownload(name) {
    try { await supabase.functions.invoke('deliver', { body: { action: 'track', token, file_name: name, password: password || undefined } }) } catch { /* ignore */ }
  }

  async function downloadOne(f) {
    trackDownload(f.name)
    try {
      const res = await fetch(f.url)
      const blob = await res.blob()
      saveBlob(blob, f.name)
    } catch {
      window.open(f.url, '_blank')
    }
  }

  async function downloadAll() {
    if (!files.length) return
    setDownloadingAll(true)
    setZipProgress(0)
    trackDownload('__all__')
    try {
      const JSZip = await loadJSZip()
      const zip = new JSZip()
      let done = 0
      for (const f of files) {
        try {
          const res = await fetch(f.url)
          const blob = await res.blob()
          zip.file(f.name || `file-${done + 1}`, blob)
        } catch { /* skip a file that fails */ }
        done += 1
        setZipProgress(Math.round((done / files.length) * 100))
      }
      const out = await zip.generateAsync({ type: 'blob' })
      saveBlob(out, `${delivery?.title || 'gallery'}.zip`)
    } catch {
      // Fallback: sequential individual downloads
      for (const f of files) {
        await downloadOne(f)
        await new Promise((r) => setTimeout(r, 400))
      }
      showToast('Downloaded files individually', 'success')
    } finally {
      setDownloadingAll(false)
      setZipProgress(0)
    }
  }

  function toggleFav(f) {
    setFavSet((prev) => {
      const next = new Set(prev)
      if (next.has(f.url)) next.delete(f.url)
      else next.add(f.url)
      return next
    })
    setFavDirty(true)
  }

  async function sendFavourites() {
    setSendingFav(true)
    const ids = [...favSet]
    const { data, error } = await supabase.functions.invoke('deliver', { body: { action: 'favourites', token, favourites: ids, password: password || undefined } })
    setSendingFav(false)
    if (error || !data?.ok) { showToast('Could not send your picks, please try again', 'error'); return }
    setFavDirty(false)
    showToast(`Sent ${ids.length} favourite${ids.length === 1 ? '' : 's'} to ${creative?.business_name || 'your creative'}`)
  }

  const businessName = creative?.business_name || 'Your gallery'

  return (
    <div className="dgl-root">
      <style>{styles}</style>

      {toast && <div className={`dgl-toast ${toast.type === 'error' ? 'err' : 'ok'}`}>{toast.msg}</div>}

      {loading ? (
        <div className="dgl-center"><div className="dgl-spin" style={{ borderTopColor: brandAccent }} /></div>
      ) : notFound ? (
        <div className="dgl-center">
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="dgl-h1">Gallery not found</div>
            <div className="dgl-sub">This link may have expired or been removed.</div>
          </div>
        </div>
      ) : locked && !unlocked ? (
        <div className="dgl-center">
          <div className="dgl-lock">
            {creative?.avatar_url && <img src={creative.avatar_url} alt="" className="dgl-lock-av" />}
            <div className="dgl-lock-name">{businessName}</div>
            <div className="dgl-sub" style={{ marginBottom: 24 }}>This gallery is password protected</div>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(false) }}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
              className="dgl-input"
              style={passwordError ? { borderColor: '#FF2D78' } : undefined}
            />
            {passwordError && <div className="dgl-err-text">Incorrect password</div>}
            <button type="button" onClick={unlock} disabled={checking} className="dgl-btn-primary" style={{ background: brandAccent, color: accentText, width: '100%', marginTop: 12 }}>
              {checking ? 'Checking…' : 'Unlock gallery'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="dgl-hero" style={delivery?.cover_url ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55)), url(${delivery.cover_url})` } : undefined}>
            <div className={`dgl-hero-inner ${delivery?.cover_url ? 'on-cover' : ''}`}>
              <div className="dgl-brandrow">
                {creative?.avatar_url && <img src={creative.avatar_url} alt="" className="dgl-brand-av" />}
                <div>
                  <div className="dgl-brand-name">{businessName}</div>
                  <div className="dgl-brand-sub">via LensTrybe</div>
                </div>
              </div>
              <h1 className="dgl-title">{delivery?.title || 'Your files'}</h1>
              <div className="dgl-meta">
                {delivery?.file_count ?? files.length} file{(delivery?.file_count ?? files.length) === 1 ? '' : 's'}
                {delivery?.client_name ? ` · for ${delivery.client_name}` : ''}
                {delivery?.expires_at ? ` · available until ${new Date(delivery.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
              </div>
            </div>
          </div>

          <div className="dgl-body">
            {expired ? (
              <div className="dgl-notice">This gallery link has expired. Please contact {businessName} to have it re-shared.</div>
            ) : (
              <>
                {delivery?.message && <div className="dgl-message">{delivery.message}</div>}

                {/* Action bar */}
                {files.length > 0 && (
                  <div className="dgl-actionbar">
                    <button type="button" className="dgl-btn-primary" style={{ background: brandAccent, color: accentText }} onClick={downloadAll} disabled={downloadingAll}>
                      {downloadingAll ? `Preparing ZIP… ${zipProgress}%` : `Download all (${files.length})`}
                    </button>
                    <div className="dgl-fav-count">
                      {favSet.size > 0 ? `${favSet.size} favourite${favSet.size === 1 ? '' : 's'} selected` : 'Tap the heart on any photo to favourite it'}
                    </div>
                    {favDirty && (
                      <button type="button" className="dgl-btn-ghost" onClick={sendFavourites} disabled={sendingFav}>
                        {sendingFav ? 'Sending…' : 'Send my picks'}
                      </button>
                    )}
                  </div>
                )}

                {/* Photos */}
                {photos.length > 0 && (
                  <section className="dgl-section">
                    <div className="dgl-section-title">Photos ({photos.length})</div>
                    <div className="dgl-grid">
                      {photos.map((f) => {
                        const fav = favSet.has(f.url)
                        const lbIndex = lightboxItems.indexOf(f)
                        return (
                          <div key={f.url} className="dgl-tile" onClick={() => setLightbox(lbIndex)}>
                            <img src={f.url} alt={f.name} loading="lazy" />
                            <button
                              type="button"
                              className={`dgl-heart ${fav ? 'on' : ''}`}
                              style={fav ? { color: brandAccent } : undefined}
                              onClick={(e) => { e.stopPropagation(); toggleFav(f) }}
                              aria-label={fav ? 'Remove favourite' : 'Add favourite'}
                            >
                              {fav ? '♥' : '♡'}
                            </button>
                            <button
                              type="button"
                              className="dgl-tile-dl"
                              onClick={(e) => { e.stopPropagation(); downloadOne(f) }}
                            >Download</button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Videos */}
                {videos.length > 0 && (
                  <section className="dgl-section">
                    <div className="dgl-section-title">Videos ({videos.length})</div>
                    <div className="dgl-grid dgl-grid-vid">
                      {videos.map((f) => {
                        const lbIndex = lightboxItems.indexOf(f)
                        return (
                          <div key={f.url} className="dgl-vidcard">
                            <video src={f.url} controls preload="metadata" onClick={() => setLightbox(lbIndex)} />
                            <div className="dgl-vidbar">
                              <span className="dgl-vidname">{f.name}</span>
                              <button type="button" className="dgl-link" style={{ color: brandAccent }} onClick={() => downloadOne(f)}>Download</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Other files */}
                {others.length > 0 && (
                  <section className="dgl-section">
                    <div className="dgl-section-title">Files ({others.length})</div>
                    <div className="dgl-filelist">
                      {others.map((f) => (
                        <div key={f.url} className="dgl-filerow">
                          <span className="dgl-filename">{f.name}</span>
                          <button type="button" className="dgl-link" style={{ color: brandAccent }} onClick={() => downloadOne(f)}>Download</button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {files.length === 0 && <div className="dgl-notice">No files in this gallery yet.</div>}
              </>
            )}

            <div className="dgl-footer">Delivered via <span style={{ color: brandAccent, fontWeight: 700 }}>LensTrybe</span></div>
          </div>
        </>
      )}

      {lightbox >= 0 && lightboxItems[lightbox] && (
        <Lightbox
          items={lightboxItems}
          index={lightbox}
          onClose={() => { setLightbox(-1); setSlideshow(false) }}
          onNav={(dir) => setLightbox((i) => (i + dir + lightboxItems.length) % lightboxItems.length)}
          favSet={favSet}
          onToggleFav={toggleFav}
          onDownload={downloadOne}
          accent={brandAccent}
          accentText={accentText}
          slideshow={slideshow}
          onToggleSlideshow={() => setSlideshow((s) => !s)}
        />
      )}
    </div>
  )
}

/* ---------- theme-aware styles (standalone page, follows the viewer's system theme) ---------- */

const styles = `
  .dgl-root {
    --bg: #f6f5f3; --surface: #ffffff; --surface-2: #f0efec;
    --text: #14111a; --muted: #6a6976; --faint: #9a99a5; --border: rgba(20,17,26,0.10); --hairline: rgba(20,17,26,0.08);
    min-height: 100vh; background: var(--bg); color: var(--text);
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    .dgl-root {
      --bg: #0a0a0f; --surface: #16161e; --surface-2: #1e1e28;
      --text: #f5f5f7; --muted: #9a99a5; --faint: #6a6976; --border: rgba(255,255,255,0.10); --hairline: rgba(255,255,255,0.07);
    }
  }
  .dgl-center { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .dgl-spin { width: 34px; height: 34px; border: 3px solid var(--border); border-top-color: ${BRAND_GREEN}; border-radius: 50%; animation: dglspin .8s linear infinite; }
  @keyframes dglspin { to { transform: rotate(360deg) } }
  .dgl-h1 { font-size: 22px; font-weight: 800; color: var(--text); margin-bottom: 8px; }
  .dgl-sub { font-size: 14px; color: var(--muted); }

  .dgl-lock { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 40px 32px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 18px 50px -20px rgba(0,0,0,0.35); }
  .dgl-lock-av { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; }
  .dgl-lock-name { font-size: 19px; font-weight: 800; color: var(--text); margin-bottom: 4px; }
  .dgl-input { width: 100%; padding: 12px 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 15px; font-family: inherit; box-sizing: border-box; outline: none; }
  .dgl-input:focus { border-color: ${BRAND_GREEN}; }
  .dgl-err-text { font-size: 13px; color: #FF2D78; margin-top: 8px; }
  .dgl-btn-primary { border: none; border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; transition: filter .15s ease, opacity .15s ease; }
  .dgl-btn-primary:hover { filter: brightness(1.06); }
  .dgl-btn-primary:disabled { opacity: .6; cursor: default; }
  .dgl-btn-ghost { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 12px 20px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .dgl-btn-ghost:hover { filter: brightness(1.04); }
  .dgl-btn-ghost:disabled { opacity: .6; cursor: default; }

  .dgl-hero { background-size: cover; background-position: center; background-color: var(--surface); border-bottom: 1px solid var(--hairline); }
  .dgl-hero-inner { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
  .dgl-hero-inner.on-cover { padding: 120px 24px 40px; color: #fff; }
  .dgl-hero-inner.on-cover .dgl-brand-name, .dgl-hero-inner.on-cover .dgl-title { color: #fff; }
  .dgl-hero-inner.on-cover .dgl-brand-sub, .dgl-hero-inner.on-cover .dgl-meta { color: rgba(255,255,255,0.8); }
  .dgl-brandrow { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .dgl-brand-av { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
  .dgl-brand-name { font-size: 16px; font-weight: 800; color: var(--text); }
  .dgl-brand-sub { font-size: 12px; color: var(--faint); }
  .dgl-title { font-size: clamp(26px, 4vw, 40px); font-weight: 800; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--text); }
  .dgl-meta { font-size: 14px; color: var(--muted); }

  .dgl-body { max-width: 1100px; margin: 0 auto; padding: 32px 24px 80px; }
  .dgl-message { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; margin-bottom: 28px; font-size: 14px; color: var(--muted); line-height: 1.6; }
  .dgl-notice { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 24px; text-align: center; color: var(--muted); font-size: 14px; }

  .dgl-actionbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }
  .dgl-fav-count { font-size: 13px; color: var(--muted); }

  .dgl-section { margin-bottom: 40px; }
  .dgl-section-title { font-size: 12px; font-weight: 700; color: var(--faint); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; }
  .dgl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .dgl-grid-vid { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .dgl-tile { position: relative; border-radius: 12px; overflow: hidden; background: var(--surface-2); aspect-ratio: 4/3; cursor: pointer; }
  .dgl-tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .25s ease; }
  .dgl-tile:hover img { transform: scale(1.04); }
  .dgl-heart { position: absolute; top: 8px; right: 8px; width: 34px; height: 34px; border-radius: 50%; border: none; background: rgba(0,0,0,0.45); color: #fff; font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: transform .12s ease; }
  .dgl-heart:hover { transform: scale(1.1); }
  .dgl-heart.on { background: rgba(0,0,0,0.6); }
  .dgl-tile-dl { position: absolute; bottom: 8px; left: 8px; padding: 6px 12px; border-radius: 7px; border: none; background: rgba(0,0,0,0.55); color: #fff; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; opacity: 0; transition: opacity .15s ease; backdrop-filter: blur(4px); }
  .dgl-tile:hover .dgl-tile-dl { opacity: 1; }

  .dgl-vidcard { border-radius: 12px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); }
  .dgl-vidcard video { width: 100%; display: block; cursor: pointer; background: #000; }
  .dgl-vidbar { padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .dgl-vidname { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dgl-link { background: none; border: none; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; padding: 0; flex-shrink: 0; }

  .dgl-filelist { display: flex; flex-direction: column; gap: 8px; }
  .dgl-filerow { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .dgl-filename { font-size: 14px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .dgl-footer { text-align: center; margin-top: 40px; font-size: 12px; color: var(--faint); }

  .dgl-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 3000; padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
  .dgl-toast.ok { background: ${BRAND_GREEN}; color: #04120a; }
  .dgl-toast.err { background: #FF2D78; color: #fff; }

  .dgl-lb { position: fixed; inset: 0; z-index: 2500; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .dgl-lb-stage { position: relative; max-width: 1200px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .dgl-lb-close { position: fixed; top: 18px; right: 20px; width: 40px; height: 40px; border-radius: 50%; border: none; background: rgba(255,255,255,0.12); color: #fff; font-size: 18px; cursor: pointer; }
  .dgl-lb-nav { position: fixed; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; border: none; background: rgba(255,255,255,0.12); color: #fff; font-size: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .dgl-lb-prev { left: 16px; } .dgl-lb-next { right: 16px; }
  .dgl-lb-nav:hover, .dgl-lb-close:hover { background: rgba(255,255,255,0.22); }
  .dgl-lb-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; flex-wrap: wrap; }
  .dgl-lb-name { font-size: 13px; color: rgba(255,255,255,0.8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50%; }
  .dgl-lb-btn { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .dgl-lb-count { font-size: 12px; color: rgba(255,255,255,0.6); }

  @media (max-width: 767px) {
    .dgl-lb-name { max-width: 100%; }
    .dgl-actionbar { gap: 10px; }
    .dgl-btn-primary, .dgl-btn-ghost { min-height: 44px; }
  }
`
