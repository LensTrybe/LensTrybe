import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// ── helpers ──────────────────────────────────────────────────────────────────

const formatSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

const isImage = (file) =>
  /\.(jpg|jpeg|png|gif|webp|heic|avif|tiff?)$/i.test(file.name ?? '') ||
  (file.type ?? '').startsWith('image/')

const isVideo = (file) =>
  /\.(mp4|mov|avi|mkv|webm)$/i.test(file.name ?? '') ||
  (file.type ?? '').startsWith('video/')

function fileIcon(file) {
  if (isImage(file)) return '🖼'
  if (isVideo(file)) return '🎬'
  if (/\.zip$/i.test(file.name ?? '')) return '🗜'
  if (/\.pdf$/i.test(file.name ?? '')) return '📄'
  return '📎'
}

async function triggerDownload(url, name) {
  const a = document.createElement('a')
  a.href = url
  a.download = name || 'file'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── sub-components ────────────────────────────────────────────────────────────

function Lightbox({ file, files, onClose }) {
  const idx = files.indexOf(file)
  const [current, setCurrent] = useState(idx < 0 ? 0 : idx)

  const prev = useCallback(
    (e) => {
      e.stopPropagation()
      setCurrent((i) => (i - 1 + files.length) % files.length)
    },
    [files.length],
  )
  const next = useCallback(
    (e) => {
      e.stopPropagation()
      setCurrent((i) => (i + 1) % files.length)
    },
    [files.length],
  )

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setCurrent((i) => (i - 1 + files.length) % files.length)
      if (e.key === 'ArrowRight') setCurrent((i) => (i + 1) % files.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [files.length, onClose])

  const active = files[current]
  if (!active) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* close */}
      <button
        onClick={onClose}
        style={lbBtnStyle({ top: 16, right: 16 })}
        aria-label="Close"
      >
        ✕
      </button>

      {/* prev */}
      {files.length > 1 && (
        <button onClick={prev} style={lbBtnStyle({ left: 12, top: '50%', transform: 'translateY(-50%)' })} aria-label="Previous">
          ‹
        </button>
      )}

      <img
        src={active.url}
        alt={active.name}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '88vh',
          objectFit: 'contain',
          borderRadius: 8,
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        }}
      />

      {/* next */}
      {files.length > 1 && (
        <button onClick={next} style={lbBtnStyle({ right: 12, top: '50%', transform: 'translateY(-50%)' })} aria-label="Next">
          ›
        </button>
      )}

      {/* caption */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#aaa',
          fontSize: 13,
          background: 'rgba(0,0,0,0.7)',
          padding: '6px 14px',
          borderRadius: 20,
          backdropFilter: 'blur(6px)',
          whiteSpace: 'nowrap',
        }}
      >
        {active.name} {files.length > 1 && `· ${current + 1} / ${files.length}`}
      </div>
    </div>
  )
}

const lbBtnStyle = (pos) => ({
  position: 'fixed',
  ...pos,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff',
  borderRadius: '50%',
  width: 40,
  height: 40,
  fontSize: 22,
  lineHeight: '40px',
  textAlign: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)',
  padding: 0,
})

// ── main page ─────────────────────────────────────────────────────────────────

export default function DeliverDownloadPage() {
  const { token } = useParams()

  // fetch state
  const [delivery, setDelivery] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // password gate
  const [needsPassword, setNeedsPassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  // download state
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  // gallery / lightbox
  const [lightboxFile, setLightboxFile] = useState(null)

  // ── fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setFetchError('Invalid download link.')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setFetchError(null)

      const { data, error: err } = await supabase
        .from('deliveries')
        .select('*')
        .eq('download_token', token)
        .maybeSingle()

      if (cancelled) return

      if (err) {
        setFetchError('Something went wrong loading your files. Please try again.')
        setLoading(false)
        return
      }

      if (!data) {
        setFetchError('This download link is invalid or has been removed.')
        setLoading(false)
        return
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setFetchError(
          'This download link has expired. Please contact your photographer for a new link.',
        )
        setLoading(false)
        return
      }

      setDelivery(data)

      // password gate — check before showing files
      if (data.password) {
        setNeedsPassword(true)
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('business_name, avatar_url, tagline')
        .eq('id', data.creative_id)
        .maybeSingle()

      if (!cancelled) {
        if (profileData) setProfile(profileData)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  // ── password check ───────────────────────────────────────────────────────

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (!delivery) return
    if (passwordInput === delivery.password) {
      setUnlocked(true)
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password. Please try again.')
    }
  }

  // ── downloads ────────────────────────────────────────────────────────────

  const markDownloaded = async () => {
    if (!delivery || delivery.downloaded_at) return
    await supabase
      .from('deliveries')
      .update({ downloaded_at: new Date().toISOString() })
      .eq('id', delivery.id)
    setDelivery((prev) => ({ ...prev, downloaded_at: new Date().toISOString() }))
  }

  const handleDownloadAll = async () => {
    if (!delivery?.files?.length) return
    setDownloading(true)
    for (const file of delivery.files) {
      if (file.url) {
        await triggerDownload(file.url, file.name)
        await new Promise((r) => setTimeout(r, 300))
      }
    }
    await markDownloaded()
    setDownloaded(true)
    setDownloading(false)
  }

  const handleDownloadSingle = async (file) => {
    if (!file.url) return
    await triggerDownload(file.url, file.name)
    await markDownloaded()
  }

  // ── render states ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.5 }}>⏳</div>
            <p style={{ color: '#666', fontSize: 14 }}>Loading your files…</p>
          </div>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 10, margin: '0 0 12px' }}>
              Link Unavailable
            </h2>
            <p style={{ color: '#666', fontSize: 14, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
              {fetchError}
            </p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // ── password gate ─────────────────────────────────────────────────────────

  if (needsPassword && !unlocked) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <CreativeHeader profile={profile} />
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#1e1e1e',
                border: '1px solid #2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                margin: '0 auto 16px',
              }}
            >
              🔐
            </div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
              {delivery?.title || 'Protected Gallery'}
            </h2>
            <p style={{ color: '#666', fontSize: 14, margin: 0 }}>
              This delivery is password protected.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value)
                setPasswordError('')
              }}
              placeholder="Enter password"
              autoFocus
              style={inputStyle}
            />
            {passwordError && (
              <p style={{ color: '#f87171', fontSize: 13, margin: '8px 0 0' }}>{passwordError}</p>
            )}
            <button
              type="submit"
              disabled={!passwordInput}
              style={{
                ...primaryBtnStyle,
                marginTop: 16,
                opacity: passwordInput ? 1 : 0.4,
                cursor: passwordInput ? 'pointer' : 'not-allowed',
              }}
            >
              Unlock Gallery
            </button>
          </form>
        </div>
        <Footer />
      </div>
    )
  }

  // ── main gallery ──────────────────────────────────────────────────────────

  const files = Array.isArray(delivery.files) ? delivery.files : []
  const imageFiles = files.filter(isImage)
  const otherFiles = files.filter((f) => !isImage(f))
  const fileCount = files.length

  return (
    <>
      {lightboxFile && (
        <Lightbox
          file={lightboxFile}
          files={imageFiles}
          onClose={() => setLightboxFile(null)}
        />
      )}

      <div style={pageStyle}>
        <div style={{ ...cardStyle, maxWidth: imageFiles.length > 0 ? 760 : 520 }}>
          <CreativeHeader profile={profile} />

          {/* Title block */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#39ff1420',
                color: '#39ff14',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                marginBottom: 12,
              }}
            >
              📦 FILES READY
            </div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>
              {delivery.title}
            </h1>
            <p style={{ color: '#666', fontSize: 14, margin: 0 }}>
              {fileCount} file{fileCount !== 1 ? 's' : ''} for{' '}
              {delivery.client_name || delivery.client_email}
            </p>
            {delivery.expires_at && (
              <p style={{ color: '#444', fontSize: 13, marginTop: 6 }}>
                Link expires {formatDate(delivery.expires_at)}
              </p>
            )}
          </div>

          {/* Personal message */}
          {delivery.message && (
            <div
              style={{
                background: '#1e1e1e',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 24,
                color: '#bbb',
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              {delivery.message}
            </div>
          )}

          {/* Image gallery grid */}
          {imageFiles.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={sectionLabelStyle}>Gallery</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: imageFiles.length === 1
                    ? '1fr'
                    : imageFiles.length === 2
                    ? '1fr 1fr'
                    : 'repeat(3, 1fr)',
                  gap: 6,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {imageFiles.map((file, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxFile(file)}
                    title={file.name}
                    style={{
                      padding: 0,
                      border: 'none',
                      background: '#1a1a1a',
                      cursor: 'pointer',
                      aspectRatio: '1',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={file.url}
                      alt={file.name}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                  </button>
                ))}
              </div>
              <p style={{ color: '#444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                Click any photo to view full size
              </p>
            </div>
          )}

          {/* Download all */}
          <button
            onClick={handleDownloadAll}
            disabled={downloading || fileCount === 0}
            style={{
              ...primaryBtnStyle,
              background: downloaded ? 'transparent' : '#39ff14',
              color: downloaded ? '#39ff14' : '#0a0a0a',
              border: downloaded ? '1px solid #39ff14' : 'none',
              opacity: downloading || fileCount === 0 ? 0.5 : 1,
              cursor: downloading || fileCount === 0 ? 'not-allowed' : 'pointer',
              marginBottom: 20,
            }}
          >
            {downloading
              ? '⏳ Starting downloads…'
              : downloaded
              ? '✓ Downloaded!'
              : `⬇ Download All${fileCount > 1 ? ` (${fileCount} files)` : ' File'}`}
          </button>

          {/* Individual files — always show non-images; show images only if > 1 */}
          {(otherFiles.length > 0 || (imageFiles.length > 1)) && (
            <div>
              <div style={sectionLabelStyle}>
                {imageFiles.length > 0 && otherFiles.length > 0
                  ? 'All Files'
                  : 'Download Individually'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((file, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#1a1a1a',
                      border: '1px solid #242424',
                      borderRadius: 10,
                      padding: '11px 14px',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(file)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: '#e0e0e0',
                            fontSize: 14,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.name}
                        </div>
                        {file.size ? (
                          <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>
                            {formatSize(file.size)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadSingle(file)}
                      style={{
                        background: '#1e1e1e',
                        color: '#39ff14',
                        border: '1px solid #39ff1433',
                        padding: '6px 14px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ⬇ Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previously downloaded notice */}
          {delivery.downloaded_at && !downloaded && (
            <p style={{ color: '#444', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
              Previously downloaded on {formatDate(delivery.downloaded_at)}
            </p>
          )}
        </div>

        <Footer />
      </div>
    </>
  )
}

// ── shared sub-components ─────────────────────────────────────────────────────

function CreativeHeader({ profile }) {
  if (!profile) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
        paddingBottom: 20,
        borderBottom: '1px solid #1e1e1e',
      }}
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.business_name}
          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#222',
            border: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          📷
        </div>
      )}
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
          {profile.business_name || 'Your photographer'}
        </div>
        {profile.tagline && (
          <div style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{profile.tagline}</div>
        )}
      </div>
    </div>
  )
}

function Footer() {
  return (
    <p style={{ color: '#2a2a2a', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
      Secure file delivery by{' '}
      <span style={{ color: '#39ff14', fontWeight: 700 }}>LensTrybe</span>
    </p>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const pageStyle = {
  minHeight: '100vh',
  background: '#0a0a0a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 16px',
  fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
}

const cardStyle = {
  width: '100%',
  maxWidth: 520,
  background: '#141414',
  border: '1px solid #1e1e1e',
  borderRadius: 20,
  padding: '28px 28px 32px',
}

const primaryBtnStyle = {
  width: '100%',
  background: '#39ff14',
  color: '#0a0a0a',
  border: 'none',
  borderRadius: 12,
  padding: '15px',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  transition: 'opacity 0.15s',
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 10,
  padding: '12px 14px',
  color: '#fff',
  fontSize: 15,
  outline: 'none',
  fontFamily: 'inherit',
}

const sectionLabelStyle = {
  color: '#444',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10,
}
