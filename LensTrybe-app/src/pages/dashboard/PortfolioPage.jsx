import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const DEFAULT_CATEGORY = 'Other'

function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url.trim())
}

function fileBaseName(name) {
  const base = name.replace(/^.*[\\/]/, '') || 'Media'
  return base.replace(/\.[^.]+$/, '') || base
}

export default function PortfolioPage() {
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const fileInputRef = useRef(null)

  const PAGE = {
    bg: '#0a0a0f',
    text: 'rgb(242, 242, 242)',
    card: '#13131a',
    border: '#1e1e1e',
    dash: '#202027',
    muted: '#555',
    label: '#888',
    green: '#39ff14',
  }

  const font = { fontFamily: 'Inter, sans-serif' }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchItems = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('creative_id', user.id)
      .order('sort_order', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return
    fetchItems()
  }, [user, fetchItems])

  const photoCount = items.filter((i) => i.image_url && !isVideoUrl(i.image_url)).length
  const videoCount = items.filter((i) => i.image_url && isVideoUrl(i.image_url)).length

  const openFilePicker = () => fileInputRef.current?.click()

  const uploadFile = async (file) => {
    if (!user?.id || !file) return
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    const { error } = await supabase.storage.from('portfolio').upload(path, file)
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from('portfolio').getPublicUrl(path)
    return data.publicUrl
  }

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length || !user?.id) return
    setUploading(true)
    try {
      let nextOrder = items.length
      const newRows = []
      for (const file of files) {
        const publicUrl = await uploadFile(file)
        const title = fileBaseName(file.name)
        const payload = {
          creative_id: user.id,
          title,
          description: '',
          category: DEFAULT_CATEGORY,
          tags: [],
          featured: false,
          image_url: publicUrl,
          sort_order: nextOrder,
        }
        nextOrder += 1
        const { data, error } = await supabase.from('portfolio_items').insert(payload).select().single()
        if (error) throw new Error(error.message)
        if (data) newRows.push(data)
      }
      if (newRows.length) setItems((prev) => [...prev, ...newRows])
    } catch {
      /* upload/insert failed — keep UI stable */
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const persistSortOrder = async (ordered) => {
    setItems(ordered)
    await Promise.all(
      ordered.map((row, i) => supabase.from('portfolio_items').update({ sort_order: i }).eq('id', row.id)),
    )
  }

  const onDragStart = (e, id) => {
    setDraggingId(id)
    try {
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.effectAllowed = 'move'
    } catch { /* ignore */ }
  }

  const onDragEnd = () => setDraggingId(null)

  const onDragOver = (e) => {
    e.preventDefault()
    try {
      e.dataTransfer.dropEffect = 'move'
    } catch { /* ignore */ }
  }

  const onDrop = (e, targetId) => {
    e.preventDefault()
    const sourceId = draggingId || (() => {
      try {
        return e.dataTransfer.getData('text/plain')
      } catch {
        return null
      }
    })()
    setDraggingId(null)
    if (!sourceId || sourceId === targetId) return
    const ix = items.findIndex((i) => i.id === sourceId)
    const iy = items.findIndex((i) => i.id === targetId)
    if (ix < 0 || iy < 0) return
    const next = [...items]
    const [removed] = next.splice(ix, 1)
    next.splice(iy, 0, removed)
    persistSortOrder(next)
  }

  const deleteItem = async (id) => {
    await supabase.from('portfolio_items').delete().eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setPendingDelete(null)
  }

  const barPct = (n) => Math.min(100, (n / 30) * 100)

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
      <Link
        to="/dashboard"
        style={{
          display: 'inline-block',
          marginBottom: 10,
          fontSize: 13,
          color: PAGE.label,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        ← Back
      </Link>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>Portfolio</h1>
        <button
          type="button"
          onClick={openFilePicker}
          disabled={uploading || !user}
          style={{
            background: PAGE.green,
            color: '#000',
            fontWeight: 700,
            borderRadius: 8,
            padding: '8px 18px',
            border: 'none',
            fontSize: 14,
            cursor: uploading || !user ? 'not-allowed' : 'pointer',
            opacity: uploading || !user ? 0.6 : 1,
            ...font,
          }}
        >
          {uploading ? 'Uploading…' : '+ Add Media'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            color: '#aaa',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            minWidth: 0,
            ...font,
          }}
        >
          <span>
            <span style={{ color: '#aaa' }}>Photos: </span>
            <span style={{ color: PAGE.green, fontWeight: 700 }}>{photoCount}</span>
            <span style={{ color: '#aaa' }}> / ∞</span>
          </span>
          <div
            style={{
              width: 120,
              height: 4,
              background: '#1a1a24',
              borderRadius: 2,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div style={{ width: `${barPct(photoCount)}%`, height: '100%', background: PAGE.green, borderRadius: 2 }} />
          </div>
        </div>
        <div
          style={{
            background: PAGE.card,
            border: `1px solid ${PAGE.border}`,
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            color: '#aaa',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            minWidth: 0,
            ...font,
          }}
        >
          <span>
            <span style={{ color: '#aaa' }}>Videos: </span>
            <span style={{ color: PAGE.green, fontWeight: 700 }}>{videoCount}</span>
            <span style={{ color: '#aaa' }}> / ∞</span>
          </span>
          <div
            style={{
              width: 120,
              height: 4,
              background: '#1a1a24',
              borderRadius: 2,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div style={{ width: `${barPct(videoCount)}%`, height: '100%', background: PAGE.green, borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: PAGE.muted, margin: 0 }}>Loading…</p>
      ) : items.length === 0 ? (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={uploading || !user}
          style={{
            width: '100%',
            maxWidth: 720,
            margin: '0 auto',
            display: 'block',
            background: PAGE.card,
            border: `2px dashed ${PAGE.dash}`,
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
            cursor: uploading || !user ? 'not-allowed' : 'pointer',
            ...font,
          }}
        >
          <div style={{ fontSize: 48, color: PAGE.green, marginBottom: 16 }} aria-hidden>
            ⬆️
          </div>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Upload photos or videos to get started</div>
          <div style={{ color: PAGE.muted, fontSize: 13 }}>Drag to reorder after uploading</div>
        </button>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 16,
          }}
        >
          {items.map((item) => {
            const url = item.image_url
            const video = url && isVideoUrl(url)
            const showOverlay = hoveredId === item.id
            const isDragging = draggingId === item.id

            return (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  draggable
                  onDragStart={(e) => onDragStart(e, item.id)}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: 'relative',
                    background: PAGE.card,
                    border: `1px solid ${PAGE.border}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    aspectRatio: '1',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    outline: 'none',
                    opacity: isDragging ? 0.85 : 1,
                  }}
                >
                  {url && !video && (
                    <img src={url} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                  {url && video && (
                    <>
                      <video
                        src={url}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        <span
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.5)',
                            color: '#fff',
                            fontSize: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                          }}
                          aria-hidden
                        >
                          ▶
                        </span>
                      </div>
                    </>
                  )}
                  {!url && (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#1a1a24',
                        color: PAGE.label,
                        fontSize: 32,
                      }}
                    >
                      🖼️
                    </div>
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.55)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 12px',
                      opacity: showOverlay ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                      pointerEvents: showOverlay ? 'auto' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        color: '#fff',
                        cursor: 'grab',
                        userSelect: 'none',
                        lineHeight: 1,
                      }}
                      title="Drag to reorder"
                      aria-hidden
                    >
                      ☰
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDelete({ id: item.id, title: item.title || 'this item' })
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.45)',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 20,
                        cursor: 'pointer',
                        padding: '6px 10px',
                        lineHeight: 1,
                      }}
                      aria-label="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: PAGE.label,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingLeft: 2,
                  }}
                  title={item.title || ''}
                >
                  {item.title || 'Untitled'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-confirm-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => setPendingDelete(null)}
        >
          <div
            style={{
              background: PAGE.card,
              border: `1px solid ${PAGE.border}`,
              borderRadius: 12,
              padding: 20,
              maxWidth: 320,
              width: '100%',
              ...font,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="del-confirm-title" style={{ margin: '0 0 16px', color: '#fff', fontSize: 14, fontWeight: 600 }}>
              Delete this item?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${PAGE.border}`,
                  background: 'transparent',
                  color: PAGE.label,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => deleteItem(pendingDelete.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
