import { useCallback, useEffect, useRef, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'
import './Portfolio.css'

const BUCKET = 'portfolio'

const CATEGORIES = [
  'Photographer',
  'Videographer',
  'Drone Pilot',
  'Video Editor',
  'Photo Editor',
  'Social Media Manager',
  'Hair and Makeup Artist',
  'UGC Creator',
]

const initialForm = {
  title: '',
  description: '',
  image_url: '',
  category: CATEGORIES[0],
}

function sanitizeStorageFileName(name) {
  const base = name.replace(/^.*[\\/]/, '').replace(/[\r\n\0]/g, '') || 'image'
  return base.slice(0, 180)
}

/**
 * Multipart POST to Storage (same as @supabase/storage-js) with XMLHttpRequest for progress.
 * Object path inside bucket: `{userId}/{timestamp}-{filename}`.
 */
function startPortfolioImageUpload(supabaseClient, file, userId, { onProgress }) {
  const xhr = new XMLHttpRequest()

  const promise = new Promise((resolve, reject) => {
    ;(async () => {
      try {
        const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        if (!projectUrl || !anonKey) {
          reject(new Error('Supabase is not configured.'))
          return
        }

        const {
          data: { session },
        } = await supabaseClient.auth.getSession()
        if (!session?.access_token) {
          reject(new Error('Not authenticated.'))
          return
        }

        const timestamp = Date.now()
        const safeName = sanitizeStorageFileName(file.name)
        const objectKey = `${userId}/${timestamp}-${safeName}`

        const pathSegments = [BUCKET, userId, `${timestamp}-${safeName}`]
        const pathEncoded = pathSegments.map(encodeURIComponent).join('/')
        const uploadUrl = `${projectUrl}/storage/v1/object/${pathEncoded}`

        const fd = new FormData()
        fd.append('cacheControl', '3600')
        fd.append('', file)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.min(100, Math.round((100 * event.loaded) / event.total)))
          } else if (onProgress) {
            onProgress(null)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const {
              data: { publicUrl },
            } = supabaseClient.storage.from(BUCKET).getPublicUrl(objectKey)
            resolve(publicUrl)
            return
          }
          let msg = `Upload failed (${xhr.status})`
          try {
            const body = JSON.parse(xhr.responseText)
            if (body?.message) {
              msg = body.message
            } else if (body?.error) {
              msg = typeof body.error === 'string' ? body.error : body.error?.message ?? msg
            }
          } catch {
            if (xhr.responseText) {
              msg = xhr.responseText.slice(0, 200)
            }
          }
          reject(new Error(msg))
        }

        xhr.onerror = () => reject(new Error('Network error during upload.'))
        xhr.onabort = () => reject(new Error('Upload cancelled.'))

        xhr.open('POST', uploadUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('apikey', anonKey)
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.send(fd)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })()
  })

  return { promise, abort: () => xhr.abort() }
}

function resolveImageUrl(item) {
  const url = item?.image_url ?? item?.imageUrl ?? item?.image ?? ''
  return typeof url === 'string' ? url.trim() : ''
}

function PortfolioCardImage({ src }) {
  const [broken, setBroken] = useState(false)

  if (!src || broken) {
    return (
      <div className="portfolio-page__card-placeholder">
        {!src ? 'No image URL' : 'Image failed to load'}
      </div>
    )
  }

  return (
    <img
      className="portfolio-page__card-image"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}

function Portfolio() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const fileInputRef = useRef(null)
  const uploadAbortRef = useRef(null)
  const blobPreviewUrlRef = useRef(null)

  const [items, setItems] = useState([])
  const [form, setForm] = useState(initialForm)
  const [blobPreviewUrl, setBlobPreviewUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadIndeterminate, setUploadIndeterminate] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const formPreviewSrc = blobPreviewUrl || form.image_url.trim() || null

  const loadItems = useCallback(async () => {
    if (!supabase || !userId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('creative_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setItems([])
    } else {
      setItems(data ?? [])
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    loadItems()
  }, [authLoading, loadItems])

  useEffect(() => {
    blobPreviewUrlRef.current = blobPreviewUrl
  }, [blobPreviewUrl])

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
      if (blobPreviewUrlRef.current) {
        URL.revokeObjectURL(blobPreviewUrlRef.current)
      }
    }
  }, [])

  const clearImageSelection = () => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    if (blobPreviewUrl) {
      URL.revokeObjectURL(blobPreviewUrl)
      setBlobPreviewUrl(null)
    }
    setForm((current) => ({ ...current, image_url: '' }))
    setIsUploading(false)
    setUploadIndeterminate(false)
    setUploadPercent(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!supabase || !userId) {
      setErrorMessage('Supabase is not configured or you are not signed in.')
      event.target.value = ''
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please choose an image file.')
      event.target.value = ''
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null

    if (blobPreviewUrl) {
      URL.revokeObjectURL(blobPreviewUrl)
    }
    const objectUrl = URL.createObjectURL(file)
    setBlobPreviewUrl(objectUrl)
    setForm((current) => ({ ...current, image_url: '' }))

    setIsUploading(true)
    setUploadIndeterminate(true)
    setUploadPercent(null)

    const { promise, abort } = startPortfolioImageUpload(supabase, file, userId, {
      onProgress: (value) => {
        if (value === null) {
          setUploadIndeterminate(true)
          setUploadPercent(null)
        } else {
          setUploadIndeterminate(false)
          setUploadPercent(value)
        }
      },
    })
    uploadAbortRef.current = { abort }

    promise
      .then((publicUrl) => {
        setForm((current) => ({ ...current, image_url: publicUrl }))
        setBlobPreviewUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev)
          }
          return null
        })
        setSuccessMessage('Image uploaded.')
      })
      .catch((err) => {
        if (err.message !== 'Upload cancelled.') {
          setErrorMessage(err.message ?? 'Upload failed.')
        }
        setBlobPreviewUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev)
          }
          return null
        })
        setForm((current) => ({ ...current, image_url: '' }))
      })
      .finally(() => {
        setIsUploading(false)
        setUploadIndeterminate(false)
        setUploadPercent(null)
        uploadAbortRef.current = null
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSuccessMessage('')

    if (!supabase || !userId) {
      setErrorMessage('Supabase is not configured or you are not signed in.')
      return
    }

    if (isUploading) {
      setErrorMessage('Wait for the image upload to finish.')
      return
    }

    if (!form.title.trim()) {
      setErrorMessage('Title is required.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const payload = {
      creative_id: userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      category: form.category,
    }

    const { error } = await supabase.from('portfolio_items').insert(payload)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Portfolio item added.')
      setForm(initialForm)
      if (blobPreviewUrl) {
        URL.revokeObjectURL(blobPreviewUrl)
        setBlobPreviewUrl(null)
      }
      await loadItems()
    }

    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!supabase || !userId || !id) {
      return
    }

    setSuccessMessage('')
    setDeletingId(id)
    setErrorMessage('')

    const { error } = await supabase.from('portfolio_items').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Item removed.')
      setItems((current) => current.filter((item) => item.id !== id))
    }

    setDeletingId(null)
  }

  if (authLoading) {
    return (
      <section className="portfolio-page">
        <p className="portfolio-page__subtitle">Loading session…</p>
      </section>
    )
  }

  if (!userId) {
    return (
      <section className="portfolio-page">
        <h1 className="portfolio-page__title">Portfolio</h1>
        <p className="portfolio-page__subtitle">Sign in to manage your portfolio.</p>
      </section>
    )
  }

  return (
    <section className="portfolio-page">
      <h1 className="portfolio-page__title">Portfolio</h1>
      <p className="portfolio-page__subtitle">
        Add work with a title, description, image from your device, and category.
      </p>

      <div className="portfolio-page__layout">
        <div className="portfolio-page__panel">
          <h2 className="portfolio-page__panel-title">Add new item</h2>
          <form onSubmit={handleSubmit}>
            <div className="portfolio-page__field">
              <label className="portfolio-page__label" htmlFor="portfolio-title">
                Title
              </label>
              <input
                id="portfolio-title"
                name="title"
                className="portfolio-page__input"
                value={form.title}
                onChange={handleFormChange}
                required
                autoComplete="off"
              />
            </div>
            <div className="portfolio-page__field">
              <label className="portfolio-page__label" htmlFor="portfolio-description">
                Description
              </label>
              <textarea
                id="portfolio-description"
                name="description"
                className="portfolio-page__textarea"
                value={form.description}
                onChange={handleFormChange}
                rows={4}
              />
            </div>
            <div className="portfolio-page__field">
              <span className="portfolio-page__label" id="portfolio-image-label">
                Image
              </span>
              <input
                ref={fileInputRef}
                id="portfolio-image-file"
                className="portfolio-page__file-input"
                type="file"
                accept="image/*"
                aria-labelledby="portfolio-image-label"
                onChange={handleFileChange}
              />
              <div className="portfolio-page__file-actions">
                <label
                  htmlFor="portfolio-image-file"
                  className="portfolio-page__file-button"
                >
                  {form.image_url || blobPreviewUrl ? 'Replace image' : 'Choose image'}
                </label>
                {(form.image_url || blobPreviewUrl) && (
                  <button
                    type="button"
                    className="portfolio-page__file-button portfolio-page__file-button--ghost"
                    onClick={clearImageSelection}
                    disabled={isUploading}
                  >
                    Remove
                  </button>
                )}
              </div>

              {isUploading && (
                <div className="portfolio-page__upload-progress" aria-live="polite">
                  <div className="portfolio-page__upload-progress-label">
                    <span>Uploading…</span>
                    {!uploadIndeterminate && uploadPercent !== null && (
                      <span>{uploadPercent}%</span>
                    )}
                  </div>
                  <div
                    className={`portfolio-page__progress-track${uploadIndeterminate || uploadPercent === null ? ' portfolio-page__progress-track--indeterminate' : ''}`}
                  >
                    <div
                      className="portfolio-page__progress-fill"
                      style={
                        !uploadIndeterminate && uploadPercent !== null
                          ? { width: `${uploadPercent}%` }
                          : undefined
                      }
                    />
                  </div>
                </div>
              )}

              {formPreviewSrc && (
                <div className="portfolio-page__preview">
                  <img src={formPreviewSrc} alt="" />
                </div>
              )}
            </div>
            <div className="portfolio-page__field">
              <label className="portfolio-page__label" htmlFor="portfolio-category">
                Category
              </label>
              <select
                id="portfolio-category"
                name="category"
                className="portfolio-page__select"
                value={form.category}
                onChange={handleFormChange}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="portfolio-page__submit"
              disabled={submitting || loading || isUploading}
            >
              {submitting ? 'Adding…' : 'Add to portfolio'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="portfolio-page__section-heading">Your work</h2>
          {loading ? (
            <p className="portfolio-page__subtitle">Loading items…</p>
          ) : items.length === 0 ? (
            <p className="portfolio-page__empty">No portfolio items yet. Add your first piece.</p>
          ) : (
            <div className="portfolio-page__grid">
              {items.map((item) => {
                const imageSrc = resolveImageUrl(item)
                return (
                  <article key={item.id} className="portfolio-page__card">
                    <div className="portfolio-page__card-image-wrap">
                      <PortfolioCardImage key={`${item.id}-${imageSrc}`} src={imageSrc} />
                    </div>
                    <div className="portfolio-page__card-body">
                      <p className="portfolio-page__card-category">{item.category ?? '—'}</p>
                      <h3 className="portfolio-page__card-title">{item.title ?? 'Untitled'}</h3>
                      <p className="portfolio-page__card-desc">
                        {item.description?.trim() ? item.description : 'No description.'}
                      </p>
                      <div className="portfolio-page__card-actions">
                        <button
                          type="button"
                          className="portfolio-page__delete"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                        >
                          {deletingId === item.id ? 'Removing…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="portfolio-page__message" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && !errorMessage && (
        <p className="portfolio-page__message portfolio-page__message--ok" role="status">
          {successMessage}
        </p>
      )}
    </section>
  )
}

export default Portfolio
