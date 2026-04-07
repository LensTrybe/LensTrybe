import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const BUCKET = 'deliveries'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fileIcon(type) {
  if (!type) return '📎'
  if (type.startsWith('image/')) return '🖼️'
  if (type.startsWith('video/')) return '🎬'
  if (type === 'application/pdf') return '📄'
  if (type.includes('zip') || type.includes('rar')) return '🗜️'
  return '📎'
}

function sanitizeStorageFileName(name) {
  const base = String(name ?? '')
    .replace(/^.*[\\/]/, '')
    .replace(/[\r\n\0]/g, '')
    .trim()
  return base.slice(0, 180) || 'file'
}

function startStorageUpload(supabaseClient, { bucket, objectKey, file, onProgress }) {
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

        const pathSegments = [bucket, ...objectKey.split('/')]
        const pathEncoded = pathSegments.map(encodeURIComponent).join('/')
        const uploadUrl = `${projectUrl}/storage/v1/object/${pathEncoded}`

        const fd = new FormData()
        fd.append('cacheControl', '3600')
        fd.append('', file)

        xhr.upload.onprogress = (event) => {
          if (!onProgress) return
          if (event.lengthComputable) {
            onProgress(Math.min(100, Math.round((100 * event.loaded) / event.total)))
          } else {
            onProgress(null)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const {
              data: { publicUrl },
            } = supabaseClient.storage.from(bucket).getPublicUrl(objectKey)
            resolve(publicUrl)
            return
          }
          let msg = `Upload failed (${xhr.status})`
          try {
            const body = JSON.parse(xhr.responseText)
            if (body?.message) msg = body.message
            else if (body?.error)
              msg = typeof body.error === 'string' ? body.error : body.error?.message ?? msg
          } catch {
            if (xhr.responseText) msg = xhr.responseText.slice(0, 200)
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

const initialForm = {
  client_name: '',
  client_email: '',
  title: '',
  message: '',
  notify: true,
  password_enabled: false,
  password: '',
  watermark_enabled: false,
}

export default function DeliverPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState(initialForm)
  const [selectedFiles, setSelectedFiles] = useState([])
  const fileInputRef = useRef(null)

  const [editingId, setEditingId] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadIndeterminate, setUploadIndeterminate] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [actionFeedback, setActionFeedback] = useState(null) // { id, kind, message }
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchDeliveries = async (uid) => {
    if (!supabase || !uid) return
    setLoading(true)
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('creative_id', uid)
      .order('created_at', { ascending: false })
    setDeliveries(data || [])
    setLoading(false)
  }

  const fetchProfile = async (uid) => {
    if (!supabase || !uid) return
    const { data } = await supabase
      .from('profiles')
      .select('business_name, business_email')
      .eq('id', uid)
      .single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    if (!user) return
    fetchDeliveries(user.id)
    fetchProfile(user.id)
  }, [user])

  useEffect(() => {
    return () => {
      // cleanup: nothing to abort globally (uploads are awaited serially)
    }
  }, [])

  const canSubmit = useMemo(() => {
    if (!user) return false
    if (!form.client_name.trim()) return false
    if (!form.title.trim()) return false
    if (!selectedFiles.length) return false
    if (form.password_enabled && !form.password) return false
    return true
  }, [form, selectedFiles.length, user])

  const handlePickFiles = (fileList) => {
    const next = Array.from(fileList || []).map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
    }))
    setSelectedFiles((prev) => [...prev, ...next])
  }

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const resetForm = () => {
    setForm(initialForm)
    setSelectedFiles([])
    setEditingId(null)
    setShowPassword(false)
    setUploadIndeterminate(false)
    setUploadPercent(null)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const buildDeliveryUrl = (token) => `${window.location.origin}/deliver/${token}`

  const copyLink = async (token) => {
    const url = buildDeliveryUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(token)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }

  const uploadAllFiles = async () => {
    if (!supabase || !user) return []
    if (!selectedFiles.length) return []

    setUploading(true)
    setUploadIndeterminate(false)
    setUploadPercent(0)

    const totalBytes = selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0) || null
    let uploadedBytes = 0

    const uploaded = []
    for (const f of selectedFiles) {
      const ts = Date.now()
      const safeName = sanitizeStorageFileName(f.name)
      const objectKey = `${user.id}/${ts}-${safeName}`

      const { promise } = startStorageUpload(supabase, {
        bucket: BUCKET,
        objectKey,
        file: f.file,
        onProgress: (pct) => {
          if (pct === null || totalBytes == null) {
            setUploadIndeterminate(true)
            setUploadPercent(null)
            return
          }
          setUploadIndeterminate(false)
          const currentFileUploaded = (pct / 100) * (f.size || 0)
          const overall = Math.min(100, Math.round((100 * (uploadedBytes + currentFileUploaded)) / totalBytes))
          setUploadPercent(overall)
        },
      })

      const url = await promise
      uploaded.push({ name: f.name, url, size: f.size, type: f.type })
      uploadedBytes += f.size || 0
      if (totalBytes != null) {
        setUploadPercent(Math.min(100, Math.round((100 * uploadedBytes) / totalBytes)))
      }
    }

    setUploading(false)
    setUploadIndeterminate(false)
    setUploadPercent(100)
    return uploaded
  }

  const upsertDelivery = async () => {
    if (!supabase || !user) return
    if (!canSubmit) return

    setSubmitting(true)
    setActionFeedback(null)

    let uploadedFiles = []
    try {
      uploadedFiles = await uploadAllFiles()
    } catch (err) {
      setSubmitting(false)
      setUploading(false)
      setActionFeedback({
        id: 'form',
        kind: 'error',
        message: err instanceof Error ? err.message : 'Upload failed.',
      })
      return
    }

    const payload = {
      creative_id: user.id,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      title: form.title.trim(),
      message: form.message.trim() || null,
      files: uploadedFiles,
      // Optional Base44-ish fields (will work if columns exist)
      password: form.password_enabled ? form.password : null,
      watermark: !!form.watermark_enabled,
    }

    let delivery = null
    let error = null

    if (editingId) {
      const res = await supabase
        .from('deliveries')
        .update(payload)
        .eq('id', editingId)
        .eq('creative_id', user.id)
        .select()
        .maybeSingle()
      delivery = res.data
      error = res.error
    } else {
      const res = await supabase.from('deliveries').insert(payload).select().single()
      delivery = res.data
      error = res.error
    }

    if (error || !delivery) {
      setSubmitting(false)
      setActionFeedback({
        id: 'form',
        kind: 'error',
        message: error?.message || 'Could not save delivery.',
      })
      return
    }

    // Email notify (existing pattern)
    if (form.notify && form.client_email && delivery.download_token) {
      try {
        await supabase.functions.invoke('send-delivery', {
          body: {
            client_name: form.client_name.trim(),
            client_email: form.client_email.trim(),
            title: form.title.trim(),
            message: form.message.trim(),
            download_url: buildDeliveryUrl(delivery.download_token),
            business_name: profile?.business_name || 'Your Creative',
          },
        })
      } catch {
        // ignore email errors to keep UX smooth
      }
    }

    await fetchDeliveries(user.id)
    resetForm()
    setSubmitting(false)
    setActionFeedback({
      id: 'form',
      kind: 'success',
      message: editingId ? 'Delivery updated.' : 'Delivery sent.',
    })
    window.setTimeout(() => {
      setActionFeedback((cur) => (cur?.id === 'form' ? null : cur))
    }, 2500)
  }

  const handleEdit = (row) => {
    setEditingId(row.id)
    setForm((prev) => ({
      ...prev,
      client_name: row.client_name ?? '',
      client_email: row.client_email ?? '',
      title: row.title ?? '',
      message: row.message ?? '',
      notify: true,
      password_enabled: !!row.password,
      password: row.password ?? '',
      watermark_enabled: !!row.watermark,
    }))
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSendEmail = async (row) => {
    if (!supabase || !user || !row?.download_token) return
    if (!row.client_email) {
      setActionFeedback({ id: row.id, kind: 'error', message: 'No client email on file.' })
      return
    }
    setSendingId(row.id)
    setActionFeedback(null)
    try {
      await supabase.functions.invoke('send-delivery', {
        body: {
          client_name: row.client_name,
          client_email: row.client_email,
          title: row.title,
          message: row.message,
          download_url: buildDeliveryUrl(row.download_token),
          business_name: profile?.business_name || 'Your Creative',
        },
      })
      setActionFeedback({ id: row.id, kind: 'success', message: 'Sent!' })
      window.setTimeout(() => {
        setActionFeedback((cur) => (cur?.id === row.id ? null : cur))
      }, 2500)
    } catch (err) {
      setActionFeedback({
        id: row.id,
        kind: 'error',
        message: err instanceof Error ? err.message : 'Send failed.',
      })
    } finally {
      setSendingId(null)
    }
  }

  const handleMarkFinal = async (row) => {
    if (!supabase || !user || !row?.id) return
    const { error } = await supabase
      .from('deliveries')
      .update({ is_final: true })
      .eq('id', row.id)
      .eq('creative_id', user.id)
    if (error) {
      setActionFeedback({ id: row.id, kind: 'error', message: error.message })
      return
    }
    await fetchDeliveries(user.id)
    setActionFeedback({ id: row.id, kind: 'success', message: 'Marked final.' })
    window.setTimeout(() => {
      setActionFeedback((cur) => (cur?.id === row.id ? null : cur))
    }, 2500)
  }

  const handleDelete = async (row) => {
    if (!supabase || !user || !row?.id) return
    await supabase.from('deliveries').delete().eq('id', row.id).eq('creative_id', user.id)
    setDeliveries((prev) => prev.filter((d) => d.id !== row.id))
  }

  const styles = `
    .deliver-page { padding: 28px 32px; background: #080810; min-height: 100vh; color: #fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; box-sizing: border-box; }
    .deliver-header { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom: 18px; }
    .deliver-header h1 { margin:0; font-size: 1.75rem; font-weight: 700; color: #d946ef; }
    .deliver-header p { margin:6px 0 0; color: rgba(255,255,255,0.55); font-size: 0.9375rem; }

    .deliver-layout { display:grid; gap: 18px; align-items:start; }
    @media (min-width: 980px) { .deliver-layout { grid-template-columns: minmax(320px, 34rem) 1fr; } }

    .panel { border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 16px 16px 18px; background: rgba(255,255,255,0.03); }
    .panel h2 { margin:0 0 12px; font-size: 1rem; font-weight: 700; color:#d946ef; }
    .grid { display:grid; grid-template-columns: 1fr; gap: 12px; }
    @media (min-width: 520px) { .grid.two { grid-template-columns: 1fr 1fr; } }

    .field label { display:block; margin:0 0 6px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.7); }
    .field input, .field textarea { width:100%; box-sizing:border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(74,222,128,0.35); background: rgba(255,255,255,0.05); color:#fff; font-size: 0.95rem; font-family: inherit; outline: none; }
    .field textarea { resize: vertical; min-height: 92px; line-height: 1.45; }
    .field input:focus, .field textarea:focus { border-color: #4ade80; box-shadow: 0 0 0 2px rgba(74,222,128,0.2); }

    .toggleRow { display:flex; flex-wrap: wrap; gap: 10px; align-items:center; }
    .toggle { display:flex; align-items:center; gap: 10px; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(0,0,0,0.22); }
    .toggle input { width: 16px; height: 16px; accent-color: #4ade80; }
    .toggleText { font-size: 0.9rem; color: rgba(255,255,255,0.85); }
    .toggleHint { font-size: 0.8rem; color: rgba(255,255,255,0.55); margin-top: 2px; }

    .passwordRow { display:flex; gap: 8px; align-items:center; }
    .eyeBtn { border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); border-radius: 10px; padding: 10px 12px; cursor:pointer; font-weight: 700; }
    .eyeBtn:hover { border-color: rgba(255,255,255,0.25); }

    .drop { border: 2px dashed rgba(255,255,255,0.12); border-radius: 12px; padding: 14px; background: rgba(0,0,0,0.18); cursor:pointer; }
    .drop:hover { border-color: rgba(74,222,128,0.45); }
    .dropTop { display:flex; align-items:center; gap: 10px; }
    .dropIcon { width: 38px; height: 38px; border-radius: 10px; display:flex; align-items:center; justify-content:center; background: rgba(74,222,128,0.12); border:1px solid rgba(74,222,128,0.25); }
    .dropTitle { font-weight: 700; }
    .dropSub { color: rgba(255,255,255,0.55); font-size: 0.85rem; margin-top: 2px; }

    .filesList { display:flex; flex-direction:column; gap: 8px; margin-top: 10px; }
    .fileRow { display:flex; align-items:center; gap: 10px; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(0,0,0,0.18); }
    .fileMeta { flex:1; min-width: 0; }
    .fileName { font-weight: 700; font-size: 0.92rem; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fileSize { color: rgba(255,255,255,0.55); font-size: 0.82rem; margin-top: 2px; }
    .fileRemove { border: none; background: transparent; color: rgba(255,255,255,0.55); cursor:pointer; font-weight: 900; }
    .fileRemove:hover { color: #f87171; }

    .progress { margin-top: 10px; }
    .progressTop { display:flex; justify-content:space-between; font-size: 0.82rem; color: rgba(255,255,255,0.65); }
    .track { margin-top: 6px; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow:hidden; border: 1px solid rgba(255,255,255,0.12); }
    .fill { height: 100%; background: linear-gradient(90deg, #4ade80, #d946ef); width: 0%; transition: width 0.15s ease; }
    .indeterminate .fill { width: 40%; animation: move 1.1s ease-in-out infinite; }
    @keyframes move { 0% { transform: translateX(-120%);} 100% { transform: translateX(300%);} }

    .actions { display:flex; gap: 10px; justify-content:flex-end; margin-top: 14px; align-items:center; flex-wrap: wrap; }
    .btn { border-radius: 10px; padding: 10px 14px; font-weight: 800; cursor:pointer; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
    .btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.25); }
    .btnPrimary { background: #4ade80; border-color: #4ade80; color: #080810; }
    .btnPrimary:hover:not(:disabled) { opacity: 0.92; }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btnGhost { background: transparent; }

    .listTitle { margin:0 0 12px; font-size: 1rem; font-weight: 700; color: #d946ef; }
    .empty { border: 1px dashed rgba(255,255,255,0.12); border-radius: 12px; padding: 28px 18px; color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.03); text-align:center; }

    .card { border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 14px 16px; background: rgba(255,255,255,0.03); display:grid; gap: 10px; }
    .cardTop { display:flex; align-items:flex-start; justify-content:space-between; gap: 10px; }
    .cardTitle { margin:0; font-weight: 800; font-size: 1rem; }
    .cardMeta { margin:4px 0 0; color: rgba(255,255,255,0.55); font-size: 0.86rem; }
    .badge { display:inline-flex; align-items:center; gap: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.65); }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: #facc15; }
    .dot.ok { background: #4ade80; }
    .chips { display:flex; flex-wrap: wrap; gap: 6px; }
    .chip { display:inline-flex; align-items:center; gap: 6px; padding: 4px 8px; font-size: 0.75rem; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; }

    .cardActions { display:flex; flex-wrap: wrap; gap: 8px; align-items:center; }
    .smallBtn { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); cursor:pointer; font-weight: 800; font-size: 0.82rem; }
    .smallBtn:hover:not(:disabled) { border-color: rgba(255,255,255,0.25); }
    .smallBtn:disabled { opacity: 0.55; cursor:not-allowed; }
    .smallPrimary { background: rgba(74,222,128,0.12); border-color: rgba(74,222,128,0.35); color: #4ade80; }
    .smallDanger { background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.35); color: #f87171; }
    .smallPurple { background: rgba(217,70,239,0.12); border-color: rgba(217,70,239,0.35); color: #d946ef; }

    .feedbackOk { color: #4ade80; font-weight: 800; font-size: 0.82rem; }
    .feedbackErr { color: #f87171; font-weight: 800; font-size: 0.82rem; }
  `

  if (!supabase) {
    return (
      <div className="deliver-page">
        <style>{styles}</style>
        <div className="panel">
          <h2>Deliver</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0 }}>
            Supabase is not configured.
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="deliver-page">
        <style>{styles}</style>
        <div className="panel">
          <h2>Deliver</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0 }}>
            Sign in to send deliveries.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="deliver-page">
      <style>{styles}</style>

      <div className="deliver-header">
        <div>
          <h1>Deliver</h1>
          <p>
            Send files to clients with a secure link. Add a password or watermark, then email the link.
          </p>
        </div>
      </div>

      <div className="deliver-layout">
        <div className="panel">
          <h2>{editingId ? 'Edit delivery' : 'New delivery'}</h2>

          <div className="grid two">
            <div className="field">
              <label>Client name *</label>
              <input
                value={form.client_name}
                onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))}
                placeholder="Jane Smith"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label>Client email</label>
              <input
                value={form.client_email}
                onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))}
                placeholder="jane@example.com"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid">
            <div className="field">
              <label>Delivery title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Wedding Photos — June 2026"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Hi! Your files are ready. Click the link below to download."
              />
            </div>
          </div>

          <div className="toggleRow" style={{ marginTop: 10 }}>
            <div className="toggle">
              <input
                type="checkbox"
                checked={form.password_enabled}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    password_enabled: e.target.checked,
                    password: e.target.checked ? p.password : '',
                  }))
                }
              />
              <div>
                <div className="toggleText">Password protect</div>
                <div className="toggleHint">Require a password to open the link</div>
              </div>
            </div>
            <div className="toggle">
              <input
                type="checkbox"
                checked={form.watermark_enabled}
                onChange={(e) =>
                  setForm((p) => ({ ...p, watermark_enabled: e.target.checked }))
                }
              />
              <div>
                <div className="toggleText">Watermark</div>
                <div className="toggleHint">Mark preview downloads with your brand</div>
              </div>
            </div>
            <div className="toggle">
              <input
                type="checkbox"
                checked={form.notify}
                onChange={(e) => setForm((p) => ({ ...p, notify: e.target.checked }))}
              />
              <div>
                <div className="toggleText">Email client</div>
                <div className="toggleHint">Send link to the client’s email</div>
              </div>
            </div>
          </div>

          {form.password_enabled && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Password *</label>
              <div className="passwordRow">
                <input
                  value={form.password}
                  type={showPassword ? 'text' : 'password'}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Enter a password"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="eyeBtn"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <label>Files *</label>
            <div className="drop" onClick={() => fileInputRef.current?.click()}>
              <div className="dropTop">
                <div className="dropIcon">⬆️</div>
                <div>
                  <div className="dropTitle">Upload files</div>
                  <div className="dropSub">
                    Add photos, videos, ZIPs, PDFs — you can add multiple batches
                  </div>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handlePickFiles(e.target.files)}
            />

            {selectedFiles.length > 0 && (
              <div className="filesList">
                {selectedFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="fileRow">
                    <span style={{ fontSize: 18 }}>{fileIcon(f.type)}</span>
                    <div className="fileMeta">
                      <div className="fileName">{f.name}</div>
                      <div className="fileSize">{formatSize(f.size)}</div>
                    </div>
                    <button
                      type="button"
                      className="fileRemove"
                      onClick={() => removeSelectedFile(i)}
                      aria-label={`Remove ${f.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(uploading || uploadPercent != null) && (
              <div className="progress">
                <div className="progressTop">
                  <span>{uploading ? 'Uploading…' : 'Upload complete'}</span>
                  <span>{uploadIndeterminate || uploadPercent == null ? '—' : `${uploadPercent}%`}</span>
                </div>
                <div className={`track ${uploadIndeterminate ? 'indeterminate' : ''}`}>
                  <div
                    className="fill"
                    style={
                      !uploadIndeterminate && uploadPercent != null
                        ? { width: `${uploadPercent}%` }
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="actions">
            {editingId && (
              <button type="button" className="btn btnGhost" onClick={resetForm}>
                Cancel edit
              </button>
            )}
            <button
              type="button"
              className="btn btnPrimary"
              disabled={submitting || uploading || !canSubmit}
              onClick={upsertDelivery}
            >
              {submitting ? 'Saving…' : editingId ? 'Update Delivery' : 'Send Delivery'}
            </button>
          </div>

          {actionFeedback?.id === 'form' && (
            <div style={{ marginTop: 10 }}>
              <span className={actionFeedback.kind === 'success' ? 'feedbackOk' : 'feedbackErr'}>
                {actionFeedback.message}
              </span>
            </div>
          )}
        </div>

        <div>
          <h2 className="listTitle">Deliveries</h2>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : deliveries.length === 0 ? (
            <div className="empty">No deliveries yet. Create one using the form.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {deliveries.map((d) => {
                const url = d.download_token ? buildDeliveryUrl(d.download_token) : ''
                const downloaded = !!d.downloaded_at
                const isFinal = !!d.is_final
                const feedback = actionFeedback?.id === d.id ? actionFeedback : null

                return (
                  <div key={d.id} className="card">
                    <div className="cardTop">
                      <div style={{ minWidth: 0 }}>
                        <h3 className="cardTitle">
                          {d.title}{' '}
                          {isFinal && (
                            <span style={{ color: '#4ade80', fontSize: '0.78rem' }}>
                              (Final)
                            </span>
                          )}
                        </h3>
                        <div className="cardMeta">
                          {d.client_name}
                          {d.client_email ? ` · ${d.client_email}` : ''}
                        </div>
                        <div className="badge" style={{ marginTop: 6 }}>
                          <span className={`dot ${downloaded ? 'ok' : ''}`} />
                          <span>{downloaded ? 'Downloaded' : 'Pending'}</span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>Sent {formatDate(d.created_at)}</span>
                        </div>
                      </div>

                      {url && (
                        <button
                          type="button"
                          className={`smallBtn smallPrimary`}
                          onClick={() => copyLink(d.download_token)}
                        >
                          {copied === d.download_token ? 'Copied!' : 'Copy Link'}
                        </button>
                      )}
                    </div>

                    {Array.isArray(d.files) && d.files.length > 0 && (
                      <div className="chips">
                        {d.files.slice(0, 6).map((f, i) => (
                          <span key={i} className="chip">
                            {fileIcon(f.type)} {f.name}
                            {f.size ? ` (${formatSize(f.size)})` : ''}
                          </span>
                        ))}
                        {d.files.length > 6 && (
                          <span className="chip">+{d.files.length - 6} more</span>
                        )}
                      </div>
                    )}

                    <div className="cardActions">
                      <button
                        type="button"
                        className="smallBtn"
                        disabled={!url}
                        onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                      >
                        View
                      </button>
                      <button type="button" className="smallBtn" onClick={() => handleEdit(d)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="smallBtn smallPurple"
                        disabled={sendingId === d.id}
                        onClick={() => handleSendEmail(d)}
                      >
                        {sendingId === d.id ? 'Sending…' : 'Send'}
                      </button>
                      <button
                        type="button"
                        className="smallBtn"
                        disabled={isFinal}
                        onClick={() => handleMarkFinal(d)}
                      >
                        Mark Final
                      </button>
                      <button
                        type="button"
                        className="smallBtn smallDanger"
                        onClick={() => handleDelete(d)}
                      >
                        Delete
                      </button>

                      {feedback && (
                        <span
                          className={feedback.kind === 'success' ? 'feedbackOk' : 'feedbackErr'}
                        >
                          {feedback.message}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
