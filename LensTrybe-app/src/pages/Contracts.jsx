import { useCallback, useEffect, useRef, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'

const CONTRACTS_BUCKET = 'contracts'
const SEND_CONTRACT_URL = 'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-contract'
const TEMPLATES_STORAGE_KEY = 'lenstrybe_contract_templates_v1'

const ALLOWED_MIME = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])

const initialForm = { client_name: '', client_email: '', title: '', content: '', status: 'draft' }

function sanitizeStorageFileName(name) {
  const base = name.replace(/^.*[\\/]/, '').replace(/[\r\n\0]/g, '') || 'contract'
  return base.slice(0, 180)
}

function isAllowedContractFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf', 'doc', 'docx'].includes(ext)) return true
  if (file.type && ALLOWED_MIME.has(file.type)) return true
  return false
}

function startContractFileUpload(supabaseClient, file, userId, { onProgress }) {
  const xhr = new XMLHttpRequest()
  const promise = new Promise((resolve, reject) => {
    ;(async () => {
      try {
        const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        if (!projectUrl || !anonKey) { reject(new Error('Supabase is not configured.')); return }
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session?.access_token) { reject(new Error('Not authenticated.')); return }
        const timestamp = Date.now()
        const safeName = sanitizeStorageFileName(file.name)
        const objectKey = `${userId}/${timestamp}-${safeName}`
        const pathSegments = [CONTRACTS_BUCKET, userId, `${timestamp}-${safeName}`]
        const pathEncoded = pathSegments.map(encodeURIComponent).join('/')
        const uploadUrl = `${projectUrl}/storage/v1/object/${pathEncoded}`
        const fd = new FormData()
        fd.append('cacheControl', '3600')
        fd.append('', file)
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((100 * event.loaded) / event.total)))
          else if (onProgress) onProgress(null)
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const { data: { publicUrl } } = supabaseClient.storage.from(CONTRACTS_BUCKET).getPublicUrl(objectKey)
            resolve(publicUrl); return
          }
          let msg = `Upload failed (${xhr.status})`
          try { const body = JSON.parse(xhr.responseText); if (body?.message) msg = body.message; else if (body?.error) msg = typeof body.error === 'string' ? body.error : body.error?.message ?? msg } catch { if (xhr.responseText) msg = xhr.responseText.slice(0, 200) }
          reject(new Error(msg))
        }
        xhr.onerror = () => reject(new Error('Network error during upload.'))
        xhr.onabort = () => reject(new Error('Upload cancelled.'))
        xhr.open('POST', uploadUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('apikey', anonKey)
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.send(fd)
      } catch (err) { reject(err instanceof Error ? err : new Error(String(err))) }
    })()
  })
  return { promise, abort: () => xhr.abort() }
}

function getStatusInfo(row) {
  const raw = String(row?.status ?? 'draft').toLowerCase().trim()
  if (raw === 'draft') return { variant: 'draft', label: 'draft' }
  if (raw === 'sent') return { variant: 'sent', label: 'sent' }
  if (raw === 'signed') return { variant: 'signed', label: 'signed' }
  if (raw === 'expired') return { variant: 'expired', label: 'expired' }
  return { variant: 'unknown', label: String(row?.status ?? 'unknown').trim() || 'unknown' }
}

function resolveTitle(row) { return row?.title ?? row?.contract_title ?? 'Untitled contract' }
function resolveClientName(row) { return row?.client_name ?? row?.clientName ?? row?.name ?? 'Client' }
function resolveContractFileUrl(row) { const u = row?.contract_file_url ?? ''; return typeof u === 'string' ? u.trim() : '' }

function parseDateValue(raw) {
  if (raw == null || raw === '') return null
  const d = typeof raw === 'string' ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`) : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveCreatedAt(row) { return parseDateValue(row?.created_at ?? row?.createdAt) }
function resolveSignedAt(row) { return parseDateValue(row?.signed_at ?? row?.signedAt ?? row?.signed_date ?? row?.signedDate) }

function formatDateTime(value) {
  if (value == null || !(value instanceof Date)) return '—'
  return value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDateOnly(value) {
  if (value == null || !(value instanceof Date)) return '—'
  return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function readTemplatesFromStorage() {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY)
    const p = raw ? JSON.parse(raw) : []
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function writeTemplatesToStorage(list) {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(list.slice(0, 50)))
  } catch { /* ignore */ }
}

function appendSavedContractTemplate(name, content) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Math.random().toString(36).slice(2, 11)}`
  const next = [{ id, name, content, savedAt: Date.now() }, ...readTemplatesFromStorage()]
  writeTemplatesToStorage(next)
  return readTemplatesFromStorage()
}

function Contracts() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const PAGE = {
    bg: '#0a0a0f',
    text: 'rgb(242, 242, 242)',
    card: '#13131a',
    border: '#1e1e1e',
    inner: '#1a1a24',
    innerBorder: '#202027',
    muted: '#555',
    label: '#888',
    green: '#39ff14',
    amber: '#f59e0b',
    amberBg: '#1e1800',
    yellow: '#facc15',
    red: '#f87171',
  }

  const font = { fontFamily: 'Inter, sans-serif' }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${PAGE.innerBorder}`,
    background: PAGE.inner,
    color: '#fff',
    ...font,
    fontSize: 14,
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 600,
    color: PAGE.label,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    ...font,
  }

  const sectionTitleStyle = {
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 14,
    ...font,
  }

  const contractFileInputRef = useRef(null)
  const uploadAbortRef = useRef(null)
  const contentTextareaRef = useRef(null)
  const dropZoneRef = useRef(null)

  const [contracts, setContracts] = useState([])
  const [form, setForm] = useState(initialForm)
  const [inputMode, setInputMode] = useState('type')
  const [contractFileUrl, setContractFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadIndeterminate, setUploadIndeterminate] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [sendContractFeedback, setSendContractFeedback] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [brandKit, setBrandKit] = useState(null)
  const [previewContract, setPreviewContract] = useState(null)
  const [mainTab, setMainTab] = useState('create')
  const [createSubTab, setCreateSubTab] = useState('write')
  const [projectDate, setProjectDate] = useState('')
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState(() => readTemplatesFromStorage())
  const [dragActive, setDragActive] = useState(false)

  const loadContracts = useCallback(async () => {
    if (!supabase || !userId) { setContracts([]); setLoading(false); return }
    setLoading(true); setErrorMessage('')
    const { data, error } = await supabase.from('contracts').select('*').eq('creative_id', userId).order('created_at', { ascending: false })
    if (error) { setErrorMessage(error.message); setContracts([]) } else setContracts(data ?? [])
    setLoading(false)
  }, [userId])

  const loadBusinessProfile = useCallback(async () => {
    if (!supabase || !userId) { setBusinessName(''); return }
    const { data } = await supabase.from('profiles').select('business_name').eq('id', userId).maybeSingle()
    setBusinessName(data?.business_name?.trim() || '')
  }, [userId])

  const loadBrandKit = useCallback(async () => {
    if (!supabase || !userId) { setBrandKit(null); return }
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', userId).maybeSingle()
    setBrandKit(data || null)
  }, [userId])

  useEffect(() => {
    if (authLoading) return
    /* eslint-disable react-hooks/set-state-in-effect -- mount load mirrors existing data-fetch pattern */
    loadContracts()
    loadBusinessProfile()
    loadBrandKit()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [authLoading, loadContracts, loadBusinessProfile, loadBrandKit])

  const previewCloseRef = useRef(null)
  useEffect(() => {
    if (!previewContract) return undefined
    const onKeyDown = (e) => { if (e.key === 'Escape') setPreviewContract(null) }
    window.addEventListener('keydown', onKeyDown)
    previewCloseRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewContract])

  const clearUploadedFile = () => {
    uploadAbortRef.current?.abort(); uploadAbortRef.current = null
    setContractFileUrl(''); setUploadedFileName(''); setIsUploading(false); setUploadIndeterminate(false); setUploadPercent(null)
    if (contractFileInputRef.current) contractFileInputRef.current.value = ''
  }

  const setModeType = () => { setInputMode('type'); clearUploadedFile() }
  const setModeUpload = () => { uploadAbortRef.current?.abort(); uploadAbortRef.current = null; setInputMode('upload') }

  const handleFormChange = (e) => { const { name, value } = e.target; setForm((c) => ({ ...c, [name]: value })) }

  const handleContractFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!supabase || !userId) { setErrorMessage('Not signed in.'); e.target.value = ''; return }
    if (!isAllowedContractFile(file)) { setErrorMessage('Please choose a PDF or Word file (.pdf, .doc, .docx).'); e.target.value = ''; return }
    setErrorMessage(''); setSuccessMessage(''); uploadAbortRef.current?.abort(); uploadAbortRef.current = null
    setContractFileUrl(''); setUploadedFileName(file.name); setIsUploading(true); setUploadIndeterminate(true); setUploadPercent(null)
    const { promise, abort } = startContractFileUpload(supabase, file, userId, {
      onProgress: (value) => { if (value === null) { setUploadIndeterminate(true); setUploadPercent(null) } else { setUploadIndeterminate(false); setUploadPercent(value) } }
    })
    uploadAbortRef.current = { abort }
    promise.then((publicUrl) => { setContractFileUrl(publicUrl); setSuccessMessage('Contract file uploaded.') })
      .catch((err) => { if (err.message !== 'Upload cancelled.') setErrorMessage(err.message ?? 'Upload failed.'); setUploadedFileName('') })
      .finally(() => { setIsUploading(false); setUploadIndeterminate(false); setUploadPercent(null); uploadAbortRef.current = null; if (contractFileInputRef.current) contractFileInputRef.current.value = '' })
  }

  const applyFileFromDrop = (fileList) => {
    const file = fileList?.[0]
    if (!file || !contractFileInputRef.current) return
    const dt = new DataTransfer()
    dt.items.add(file)
    contractFileInputRef.current.files = dt.files
    handleContractFileChange({ target: contractFileInputRef.current })
  }

  const getSelectionInsert = () => {
    const el = contentTextareaRef.current
    if (!el) return { start: 0, end: 0, text: form.content }
    return { start: el.selectionStart, end: el.selectionEnd, text: form.content }
  }

  const setContentAndSelection = (next, selStart, selEnd) => {
    setForm((c) => ({ ...c, content: next }))
    requestAnimationFrame(() => {
      const el = contentTextareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(selStart, selEnd)
    })
  }

  const toolbarBold = () => {
    const { start, end, text } = getSelectionInsert()
    const wrapped = `${text.slice(0, start)}**${text.slice(start, end) || 'bold'}**${text.slice(end)}`
    const pad = 2
    setContentAndSelection(wrapped, start + pad, start + pad + Math.max(0, end - start || 4))
  }

  const toolbarItalic = () => {
    const { start, end, text } = getSelectionInsert()
    const wrapped = `${text.slice(0, start)}*${text.slice(start, end) || 'italic'}*${text.slice(end)}`
    const pad = 1
    setContentAndSelection(wrapped, start + pad, start + pad + Math.max(0, end - start || 6))
  }

  const toolbarBullet = () => {
    const { start, end, text } = getSelectionInsert()
    const insert = '- '
    const next = `${text.slice(0, start)}${insert}${text.slice(end)}`
    setContentAndSelection(next, start + insert.length, start + insert.length)
  }

  const toolbarNumbered = () => {
    const { start, end, text } = getSelectionInsert()
    const insert = '1. '
    const next = `${text.slice(0, start)}${insert}${text.slice(end)}`
    setContentAndSelection(next, start + insert.length, start + insert.length)
  }

  const toolbarHeading = () => {
    const { start, end, text } = getSelectionInsert()
    const insert = '# '
    const next = `${text.slice(0, start)}${insert}${text.slice(end)}`
    setContentAndSelection(next, start + insert.length, start + insert.length)
  }

  const toolbarLine = () => {
    const { start, end, text } = getSelectionInsert()
    const insert = '\n---\n'
    const next = `${text.slice(0, start)}${insert}${text.slice(end)}`
    const pos = start + insert.length
    setContentAndSelection(next, pos, pos)
  }

  const buildContentForPayload = () => {
    let contentValue = inputMode === 'type' ? form.content.trim() || null : null
    if (inputMode === 'type' && projectDate.trim()) {
      const line = `Project date: ${projectDate.trim()}`
      contentValue = contentValue ? `${line}\n\n${contentValue}` : line
    }
    return contentValue
  }

  const buildTitleForPayload = () => {
    let titleValue = form.title.trim()
    if (inputMode === 'upload' && projectDate.trim()) {
      titleValue = titleValue ? `${titleValue} — ${projectDate.trim()}` : projectDate.trim()
    }
    return titleValue
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSuccessMessage('')
    if (!supabase || !userId) { setErrorMessage('Not signed in.'); return }
    if (isUploading) { setErrorMessage('Wait for the file upload to finish.'); return }
    if (!form.client_name.trim()) { setErrorMessage('Client name is required.'); return }
    const titleForPayload = buildTitleForPayload()
    if (!titleForPayload) { setErrorMessage('Contract title is required.'); return }
    if (inputMode === 'upload' && !contractFileUrl.trim()) { setErrorMessage('Upload a contract file before creating.'); return }
    const contentForPayload = buildContentForPayload()
    setSubmitting(true); setErrorMessage('')
    const payload = { creative_id: userId, client_name: form.client_name.trim(), client_email: form.client_email.trim() || null, title: titleForPayload, content: contentForPayload, contract_file_url: inputMode === 'upload' ? contractFileUrl.trim() : null, status: form.status }
    const { error } = await supabase.from('contracts').insert(payload)
    if (error) setErrorMessage(error.message)
    else {
      setSuccessMessage('Contract created.')
      if (saveAsTemplate && inputMode === 'type' && contentForPayload) {
        setSavedTemplates(appendSavedContractTemplate(titleForPayload, contentForPayload))
      }
      setSaveAsTemplate(false)
      setForm(initialForm); setInputMode('type'); setProjectDate(''); clearUploadedFile(); await loadContracts()
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!supabase || !id) return
    setSuccessMessage(''); setDeletingId(id); setErrorMessage('')
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) setErrorMessage(error.message)
    else { setSuccessMessage('Contract removed.'); setContracts((c) => c.filter((row) => row.id !== id)) }
    setDeletingId(null)
  }

  const handleSendForSigning = async (row) => {
    if (!supabase || !userId || !row?.id) return
    setSendContractFeedback(null); setSendingId(row.id)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (sessionError || !accessToken) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: sessionError?.message ?? 'Session error.' }); setSendingId(null); return }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('business_name, business_email').eq('id', userId).maybeSingle()
    if (profileError) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: profileError.message }); setSendingId(null); return }
    const bName = profile?.business_name?.trim() ?? ''
    const bEmail = profile?.business_email?.trim() ?? ''
    if (!bName) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: 'Add your business name in your profile before sending.' }); setSendingId(null); return }
    if (!bEmail || !bEmail.includes('@')) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: 'Add a valid business email in your profile before sending.' }); setSendingId(null); return }
    const to = typeof row.client_email === 'string' ? row.client_email.trim() : String(row.client_email ?? '').trim()
    if (!to) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: 'This contract needs a client email before you can send it.' }); setSendingId(null); return }
    const { data: tokenRow, error: tokenError } = await supabase.from('contracts').select('signing_token').eq('id', row.id).maybeSingle()
    if (tokenError) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: tokenError.message }); setSendingId(null); return }
    const signingToken = typeof tokenRow?.signing_token === 'string' ? tokenRow.signing_token.trim() : ''
    if (!signingToken) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: 'This contract is missing a signing token.' }); setSendingId(null); return }
    try {
      const response = await fetch(SEND_CONTRACT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, clientName: typeof row.client_name === 'string' ? row.client_name.trim() : String(row.client_name ?? '').trim(), businessName: bName, replyTo: bEmail, contractTitle: typeof row.title === 'string' ? row.title.trim() : String(row.title ?? '').trim(), contractContent: typeof row.content === 'string' ? row.content : row.content == null ? '' : String(row.content), signingToken }),
      })
      let result = null
      try { result = await response.json() } catch { result = null }
      if (!response.ok) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: result?.error ?? `Send failed (${response.status})` }); setSendingId(null); return }
      if (result?.success) {
        setSendContractFeedback({ contractId: row.id, kind: 'success', message: 'Sent!' }); setSendingId(null)
        window.setTimeout(() => setSendContractFeedback((c) => c?.contractId === row.id && c?.kind === 'success' ? null : c), 2500)
      } else { setSendContractFeedback({ contractId: row.id, kind: 'error', message: result?.error ?? 'Send failed.' }); setSendingId(null) }
    } catch (err) { setSendContractFeedback({ contractId: row.id, kind: 'error', message: err instanceof Error ? err.message : 'Network error.' }); setSendingId(null) }
  }

  useEffect(() => { return () => { uploadAbortRef.current?.abort() } }, [])

  const brandColor = brandKit?.primary_color || '#000000'
  const brandLogo = brandKit?.logo_url || ''

  const mainTabBar = {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: 4,
    background: PAGE.card,
    border: `1px solid ${PAGE.border}`,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    ...font,
  }

  const mainTabBtn = (active) => ({
    border: active ? `1px solid ${PAGE.green}` : '1px solid transparent',
    background: active ? '#1e2a1e' : 'transparent',
    color: active ? PAGE.green : PAGE.label,
    borderRadius: 8,
    padding: '6px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    ...font,
  })

  const subTabBtn = (active) => ({
    ...mainTabBtn(active),
    padding: '5px 14px',
    fontSize: 12,
  })

  const toolbarBtn = {
    width: 34,
    height: 32,
    borderRadius: 6,
    border: `1px solid ${PAGE.innerBorder}`,
    background: PAGE.inner,
    color: PAGE.text,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    ...font,
  }

  const statusBadgeColors = (variant) => {
    const v = String(variant || '').toLowerCase()
    if (v === 'draft') return { bg: '#2a2a2a', border: '#555', color: '#555' }
    if (v === 'sent') return { bg: `${PAGE.yellow}22`, border: PAGE.yellow, color: PAGE.yellow }
    if (v === 'signed') return { bg: `${PAGE.green}22`, border: PAGE.green, color: PAGE.green }
    if (v === 'expired') return { bg: `${PAGE.red}22`, border: PAGE.red, color: PAGE.red }
    return { bg: '#2a2a2a', border: PAGE.label, color: PAGE.label }
  }

  const applyTemplate = (t) => {
    setForm((c) => ({ ...c, title: t.name || '', content: t.content || '' }))
    setCreateSubTab('write')
    setModeType()
    setProjectDate('')
  }

  if (authLoading) {
    return (
      <section style={{ background: PAGE.bg, minHeight: '100vh', padding: 32, color: PAGE.text, ...font, boxSizing: 'border-box' }}>
        <p style={{ margin: 0, color: PAGE.muted }}>Loading session…</p>
      </section>
    )
  }

  if (!userId) {
    return (
      <section style={{ background: PAGE.bg, minHeight: '100vh', padding: 32, color: PAGE.text, ...font, boxSizing: 'border-box' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Contracts</h1>
        <p style={{ margin: '10px 0 0', color: PAGE.muted, fontSize: 14 }}>Sign in to manage contracts.</p>
      </section>
    )
  }

  const renderContractCard = (row, { showSend }) => {
    const { variant, label } = getStatusInfo(row)
    const badge = statusBadgeColors(variant)
    const created = resolveCreatedAt(row)
    const signedAt = resolveSignedAt(row)
    const showSigned = signedAt != null || String(row?.status ?? '').toLowerCase() === 'signed'
    const fileUrl = resolveContractFileUrl(row)
    const rowSendFeedback = sendContractFeedback?.contractId === row.id ? sendContractFeedback : null

    return (
      <div
        key={row.id}
        style={{
          background: PAGE.inner,
          border: `1px solid ${PAGE.innerBorder}`,
          borderRadius: 10,
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, ...font }}>{resolveClientName(row)}</div>
            <div style={{ marginTop: 6, color: '#aaa', fontSize: 14, ...font }}>{resolveTitle(row)}</div>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${badge.border}`,
              background: badge.bg,
              color: badge.color,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              ...font,
            }}
          >
            {label}
          </span>
        </div>

        <div style={{ fontSize: 13, color: PAGE.label, ...font }}>
          <span style={{ fontWeight: 600 }}>Created:</span>{' '}
          <span style={{ color: PAGE.text }}>{formatDateOnly(created)}</span>
          {showSigned && (
            <>
              {' · '}
              <span style={{ fontWeight: 600 }}>Signed:</span>{' '}
              <span style={{ color: PAGE.text }}>{signedAt ? formatDateOnly(signedAt) : '—'}</span>
            </>
          )}
        </div>

        {fileUrl && (
          <div>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: PAGE.green, fontSize: 13, fontWeight: 600 }}>
              View contract file
            </a>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setPreviewContract(row)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: `1px solid ${PAGE.innerBorder}`,
              background: PAGE.inner,
              color: PAGE.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              ...font,
            }}
          >
            Preview
          </button>

          {showSend && !showSigned && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                disabled={sendingId === row.id || deletingId === row.id}
                onClick={() => handleSendForSigning(row)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${PAGE.green}`,
                  background: '#1e2a1e',
                  color: PAGE.green,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: sendingId === row.id || deletingId === row.id ? 'not-allowed' : 'pointer',
                  opacity: sendingId === row.id || deletingId === row.id ? 0.6 : 1,
                  ...font,
                }}
              >
                {sendingId === row.id ? 'Sending...' : 'Send for signing'}
              </button>
              {rowSendFeedback && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: rowSendFeedback.kind === 'success' ? PAGE.green : PAGE.red,
                    ...font,
                  }}
                  role={rowSendFeedback.kind === 'error' ? 'alert' : 'status'}
                >
                  {rowSendFeedback.message}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={deletingId === row.id || sendingId === row.id}
            onClick={() => handleDelete(row.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: `1px solid ${PAGE.red}`,
              background: 'transparent',
              color: PAGE.red,
              fontSize: 12,
              fontWeight: 700,
              cursor: deletingId === row.id || sendingId === row.id ? 'not-allowed' : 'pointer',
              opacity: deletingId === row.id || sendingId === row.id ? 0.6 : 1,
              ...font,
            }}
          >
            {deletingId === row.id ? 'Removing…' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section style={{ background: PAGE.bg, minHeight: '100vh', padding: 32, color: PAGE.text, ...font, boxSizing: 'border-box' }}>
      {errorMessage && (
        <div style={{ marginBottom: 16, color: PAGE.red, fontWeight: 700, fontSize: 13 }} role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && !errorMessage && (
        <div style={{ marginBottom: 16, color: PAGE.green, fontWeight: 700, fontSize: 13 }} role="status">
          {successMessage}
        </div>
      )}

      <div style={mainTabBar}>
        <button type="button" style={mainTabBtn(mainTab === 'create')} onClick={() => setMainTab('create')}>
          Create Contract
        </button>
        <button type="button" style={mainTabBtn(mainTab === 'my')} onClick={() => setMainTab('my')}>
          My Contracts
        </button>
        <button type="button" style={mainTabBtn(mainTab === 'all')} onClick={() => setMainTab('all')}>
          All Contracts
        </button>
      </div>

      {mainTab === 'create' && (
        <>
          <div style={{ ...mainTabBar, marginBottom: 20 }}>
            <button
              type="button"
              style={subTabBtn(createSubTab === 'write')}
              onClick={() => { setCreateSubTab('write'); setModeType() }}
            >
              Write From Scratch
            </button>
            <button
              type="button"
              style={subTabBtn(createSubTab === 'upload')}
              onClick={() => { setCreateSubTab('upload'); setModeUpload() }}
            >
              Upload File
            </button>
            <button type="button" style={subTabBtn(createSubTab === 'saved')} onClick={() => setCreateSubTab('saved')}>
              Use Saved Contract
            </button>
          </div>

          {createSubTab === 'write' && (
            <form onSubmit={handleSubmit} style={{ maxWidth: 900 }}>
              <div
                style={{
                  background: PAGE.amberBg,
                  border: `1px solid ${PAGE.amber}`,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 20,
                  color: PAGE.amber,
                  fontSize: 13,
                  lineHeight: 1.5,
                  ...font,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ flexShrink: 0, fontSize: 16 }} aria-hidden />
                <span>
                  LensTrybe provides the tools to create and send contracts but does not provide legal advice or contract templates. You are responsible for the content of your contracts. We recommend consulting a legal professional if you are unsure.
                </span>
              </div>

              <div style={sectionTitleStyle}>Client &amp; Project Details</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div>
                  <label style={labelStyle} htmlFor="contract-client-name">Client name</label>
                  <input id="contract-client-name" name="client_name" value={form.client_name} onChange={handleFormChange} required autoComplete="off" placeholder="Client name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="contract-client-email">Client email</label>
                  <input id="contract-client-email" name="client_email" type="email" value={form.client_email} onChange={handleFormChange} autoComplete="off" placeholder="Client email" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="contract-title">Project name</label>
                  <input id="contract-title" name="title" value={form.title} onChange={handleFormChange} required autoComplete="off" placeholder="Project name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="contract-project-date">Project date</label>
                  <input id="contract-project-date" type="date" value={projectDate} onChange={(e) => setProjectDate(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={sectionTitleStyle}>Contract Content</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                <button type="button" style={toolbarBtn} onClick={toolbarBold} title="Bold" aria-label="Bold">
                  B
                </button>
                <button type="button" style={{ ...toolbarBtn, fontStyle: 'italic' }} onClick={toolbarItalic} title="Italic" aria-label="Italic">
                  I
                </button>
                <button type="button" style={toolbarBtn} onClick={toolbarBullet} title="Bullet list" aria-label="Bullet list">
                  •
                </button>
                <button type="button" style={toolbarBtn} onClick={toolbarNumbered} title="Numbered list" aria-label="Numbered list">
                  1.
                </button>
                <button type="button" style={toolbarBtn} onClick={toolbarHeading} title="Heading" aria-label="Heading">
                  H
                </button>
                <button type="button" style={toolbarBtn} onClick={toolbarLine} title="Horizontal line" aria-label="Horizontal line">
                  —
                </button>
              </div>
              <textarea
                ref={contentTextareaRef}
                id="contract-content"
                name="content"
                value={form.content}
                onChange={handleFormChange}
                placeholder="Contract terms and conditions…"
                style={{
                  ...inputStyle,
                  minHeight: 300,
                  resize: 'vertical',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineHeight: 1.5,
                }}
              />

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 18,
                  marginBottom: 16,
                  color: '#fff',
                  fontSize: 14,
                  cursor: 'pointer',
                  ...font,
                }}
              >
                <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} style={{ width: 18, height: 18, accentColor: PAGE.green }} />
                Save as reusable contract template
              </label>

              <button
                type="submit"
                disabled={submitting || loading || isUploading}
                style={{
                  width: '100%',
                  background: PAGE.green,
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: 14,
                  border: 'none',
                  fontSize: 15,
                  cursor: submitting || loading || isUploading ? 'not-allowed' : 'pointer',
                  opacity: submitting || loading || isUploading ? 0.65 : 1,
                  ...font,
                }}
              >
                {submitting ? 'Creating…' : 'Create & Send Contract'}
              </button>
            </form>
          )}

          {createSubTab === 'upload' && (
            <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
              <input
                ref={contractFileInputRef}
                id="contract-file"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Choose contract file"
                onChange={handleContractFileChange}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />
              <div
                ref={dropZoneRef}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); contractFileInputRef.current?.click() } }}
                onClick={() => contractFileInputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true) }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true) }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false) }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragActive(false)
                  const f = e.dataTransfer?.files?.[0]
                  if (f) applyFileFromDrop([f])
                }}
                style={{
                  border: dragActive ? `2px dashed ${PAGE.green}` : `2px dashed ${PAGE.innerBorder}`,
                  background: PAGE.inner,
                  borderRadius: 10,
                  padding: 40,
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: 24,
                  ...font,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden></div>
                <div style={{ color: PAGE.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Upload your contract file (PDF or Word)</div>
                <div style={{ color: PAGE.label, fontSize: 13 }}>Click or drag and drop</div>
                {uploadedFileName && <div style={{ marginTop: 12, color: PAGE.green, fontSize: 13 }}>{uploadedFileName}</div>}
                {isUploading && (
                  <div style={{ marginTop: 12, color: PAGE.label, fontSize: 13 }}>
                    Uploading…{!uploadIndeterminate && uploadPercent !== null ? ` ${uploadPercent}%` : ''}
                  </div>
                )}
              </div>

              {contractFileUrl && !isUploading && (
                <button type="button" onClick={clearUploadedFile} style={{ marginBottom: 16, background: 'transparent', border: 'none', color: PAGE.red, fontWeight: 700, cursor: 'pointer', fontSize: 13, ...font }}>
                  Remove file
                </button>
              )}

              <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle} htmlFor="upload-client-name">Client name</label>
                  <input id="upload-client-name" name="client_name" value={form.client_name} onChange={handleFormChange} required autoComplete="off" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="upload-client-email">Client email</label>
                  <input id="upload-client-email" name="client_email" type="email" value={form.client_email} onChange={handleFormChange} autoComplete="off" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="upload-project-name">Project name</label>
                  <input id="upload-project-name" name="title" value={form.title} onChange={handleFormChange} required autoComplete="off" placeholder="Required for this contract" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="upload-project-date">Project date</label>
                  <input id="upload-project-date" type="date" value={projectDate} onChange={(e) => setProjectDate(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading || isUploading}
                style={{
                  width: '100%',
                  background: PAGE.green,
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: 14,
                  border: 'none',
                  fontSize: 15,
                  cursor: submitting || loading || isUploading ? 'not-allowed' : 'pointer',
                  opacity: submitting || loading || isUploading ? 0.65 : 1,
                  ...font,
                }}
              >
                {submitting ? 'Sending…' : 'Send Contract'}
              </button>
            </form>
          )}

          {createSubTab === 'saved' && (
            <div style={{ maxWidth: 720 }}>
              {savedTemplates.length === 0 ? (
                <p style={{ color: PAGE.muted, margin: 0, ...font }}>No saved templates yet. Create a contract and check &quot;Save as reusable contract template&quot;.</p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {savedTemplates.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        background: PAGE.inner,
                        border: `1px solid ${PAGE.innerBorder}`,
                        borderRadius: 10,
                        padding: 16,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, ...font }}>{t.name || 'Untitled'}</div>
                      <button
                        type="button"
                        onClick={() => applyTemplate(t)}
                        style={{
                          padding: '8px 18px',
                          borderRadius: 8,
                          border: `1px solid ${PAGE.green}`,
                          background: '#1e2a1e',
                          color: PAGE.green,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          ...font,
                        }}
                      >
                        Use This
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {mainTab === 'my' && (
        <div style={{ maxWidth: 900 }}>
          <h2 style={{ ...sectionTitleStyle, marginTop: 0 }}>My Contracts</h2>
          {loading ? (
            <p style={{ color: PAGE.muted, margin: 0 }}>Loading contracts…</p>
          ) : contracts.length === 0 ? (
            <p style={{ color: PAGE.muted, margin: 0 }}>No contracts yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>{contracts.map((row) => renderContractCard(row, { showSend: true }))}</div>
          )}
        </div>
      )}

      {mainTab === 'all' && (
        <div style={{ maxWidth: 900 }}>
          <h2 style={{ ...sectionTitleStyle, marginTop: 0 }}>All Contracts</h2>
          {loading ? (
            <p style={{ color: PAGE.muted, margin: 0 }}>Loading contracts…</p>
          ) : contracts.length === 0 ? (
            <p style={{ color: PAGE.muted, margin: 0 }}>No contracts yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>{contracts.map((row) => renderContractCard(row, { showSend: true }))}</div>
          )}
        </div>
      )}

      {previewContract && (
        <div
          role="presentation"
          onClick={() => setPreviewContract(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '24px 12px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.65)',
            boxSizing: 'border-box',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contract-preview-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 720,
              borderRadius: 12,
              background: '#fff',
              color: '#111827',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '22px 24px 24px', fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif" }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: `3px solid ${brandColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {brandLogo && <img src={brandLogo} alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />}
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>{businessName || 'Your business'}</p>
                    <h2 id="contract-preview-title" style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '0.14em', color: brandColor }}>CONTRACT</h2>
                  </div>
                </div>
                <button
                  ref={previewCloseRef}
                  type="button"
                  onClick={() => setPreviewContract(null)}
                  style={{
                    padding: '9px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#fff',
                    background: '#111827',
                    border: 'none',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>

              {(() => {
                const { variant, label } = getStatusInfo(previewContract)
                const badge = statusBadgeColors(variant)
                const signedAt = resolveSignedAt(previewContract)
                const fileUrl = resolveContractFileUrl(previewContract)
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 4px' }}>Contract title</p>
                        <p style={{ margin: 0, fontWeight: 800 }}>{resolveTitle(previewContract)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 4px' }}>Status</p>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 999,
                            border: `1px solid ${badge.border}`,
                            background: badge.bg,
                            color: badge.color,
                            fontSize: 11,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                          }}
                        >
                          {label}
                        </span>
                      </div>
                      {String(previewContract?.status ?? '').toLowerCase().trim() === 'signed' && (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 4px' }}>Signed at</p>
                          <p style={{ margin: 0, fontWeight: 800 }}>{signedAt ? formatDateTime(signedAt) : '—'}</p>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: brandColor, margin: '0 0 6px' }}>Client</p>
                      <p style={{ margin: 0, fontWeight: 800 }}>{resolveClientName(previewContract)}</p>
                      {(() => {
                        const email = typeof previewContract.client_email === 'string' ? previewContract.client_email.trim() : String(previewContract.client_email ?? '').trim()
                        return email ? <p style={{ color: '#374151', margin: '4px 0 0' }}>{email}</p> : <p style={{ color: '#9ca3af', margin: '4px 0 0', fontStyle: 'italic' }}>No email on file</p>
                      })()}
                    </div>

                    {fileUrl ? (
                      <p style={{ margin: '0 0 12px' }}>
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: brandColor, fontWeight: 700 }}>
                          View Contract File
                        </a>
                      </p>
                    ) : (
                      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, fontFamily: 'inherit' }}>{previewContract.content ?? ''}</pre>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Contracts
