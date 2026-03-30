import { useCallback, useEffect, useRef, useState } from 'react'
import useAuthUser from '../hooks/useAuthUser'
import { supabase } from '../lib/supabaseClient'
import './Contracts.css'

const CONTRACTS_BUCKET = 'contracts'

const STATUS_OPTIONS = ['draft', 'sent', 'signed']
const SEND_CONTRACT_URL =
  'https://lqafxisymvrazipaozfk.supabase.co/functions/v1/send-contract'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const initialForm = {
  client_name: '',
  client_email: '',
  title: '',
  content: '',
  status: 'draft',
}

function sanitizeStorageFileName(name) {
  const base = name.replace(/^.*[\\/]/, '').replace(/[\r\n\0]/g, '') || 'contract'
  return base.slice(0, 180)
}

function isAllowedContractFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf', 'doc', 'docx'].includes(ext)) {
    return true
  }
  if (file.type && ALLOWED_MIME.has(file.type)) {
    return true
  }
  return false
}

function startContractFileUpload(supabaseClient, file, userId, { onProgress }) {
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

        const pathSegments = [CONTRACTS_BUCKET, userId, `${timestamp}-${safeName}`]
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
            } = supabaseClient.storage.from(CONTRACTS_BUCKET).getPublicUrl(objectKey)
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

function getStatusInfo(row) {
  const raw = String(row?.status ?? 'draft').toLowerCase().trim()
  if (raw === 'draft') {
    return { variant: 'draft', label: 'draft' }
  }
  if (raw === 'sent') {
    return { variant: 'sent', label: 'sent' }
  }
  if (raw === 'signed') {
    return { variant: 'signed', label: 'signed' }
  }
  const label = String(row?.status ?? 'unknown').trim() || 'unknown'
  return { variant: 'unknown', label }
}

function resolveTitle(row) {
  return (
    row?.title ??
    row?.contract_title ??
    row?.contractTitle ??
    'Untitled contract'
  )
}

function resolveClientName(row) {
  return row?.client_name ?? row?.clientName ?? row?.name ?? 'Client'
}

function resolveContractFileUrl(row) {
  const u = row?.contract_file_url ?? row?.contractFileUrl ?? ''
  return typeof u === 'string' ? u.trim() : ''
}

function parseDateValue(raw) {
  if (raw == null || raw === '') {
    return null
  }
  const d =
    typeof raw === 'string'
      ? new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
      : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveCreatedAt(row) {
  return parseDateValue(row?.created_at ?? row?.createdAt)
}

function resolveSignedAt(row) {
  return parseDateValue(
    row?.signed_at ?? row?.signedAt ?? row?.signed_date ?? row?.signedDate,
  )
}

function formatDateTime(value) {
  if (value == null || !(value instanceof Date)) {
    return '—'
  }
  return value.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function Contracts() {
  const { user, loading: authLoading } = useAuthUser()
  const userId = user?.id ?? null

  const contractFileInputRef = useRef(null)
  const uploadAbortRef = useRef(null)

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

  const loadContracts = useCallback(async () => {
    if (!supabase || !userId) {
      setContracts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('creative_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setContracts([])
    } else {
      setContracts(data ?? [])
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    loadContracts()
  }, [authLoading, loadContracts])

  const clearUploadedFile = () => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setContractFileUrl('')
    setUploadedFileName('')
    setIsUploading(false)
    setUploadIndeterminate(false)
    setUploadPercent(null)
    if (contractFileInputRef.current) {
      contractFileInputRef.current.value = ''
    }
  }

  const setModeType = () => {
    setInputMode('type')
    clearUploadedFile()
  }

  const setModeUpload = () => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setInputMode('upload')
  }

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleContractFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!supabase || !userId) {
      setErrorMessage('Supabase is not configured or you are not signed in.')
      event.target.value = ''
      return
    }

    if (!isAllowedContractFile(file)) {
      setErrorMessage('Please choose a PDF or Word file (.pdf, .doc, .docx).')
      event.target.value = ''
      return
    }

    setErrorMessage('')
    setSuccessMessage('')
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null

    setContractFileUrl('')
    setUploadedFileName(file.name)
    setIsUploading(true)
    setUploadIndeterminate(true)
    setUploadPercent(null)

    const { promise, abort } = startContractFileUpload(supabase, file, userId, {
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
        setContractFileUrl(publicUrl)
        setSuccessMessage('Contract file uploaded.')
      })
      .catch((err) => {
        if (err.message !== 'Upload cancelled.') {
          setErrorMessage(err.message ?? 'Upload failed.')
        }
        setUploadedFileName('')
      })
      .finally(() => {
        setIsUploading(false)
        setUploadIndeterminate(false)
        setUploadPercent(null)
        uploadAbortRef.current = null
        if (contractFileInputRef.current) {
          contractFileInputRef.current.value = ''
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
      setErrorMessage('Wait for the file upload to finish.')
      return
    }

    if (!form.client_name.trim()) {
      setErrorMessage('Client name is required.')
      return
    }

    if (!form.title.trim()) {
      setErrorMessage('Contract title is required.')
      return
    }

    if (inputMode === 'upload') {
      if (!contractFileUrl.trim()) {
        setErrorMessage('Upload a contract file before creating.')
        return
      }
    }

    setSubmitting(true)
    setErrorMessage('')

    const payload = {
      creative_id: userId,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      title: form.title.trim(),
      content: inputMode === 'type' ? form.content.trim() || null : null,
      contract_file_url: inputMode === 'upload' ? contractFileUrl.trim() : null,
      status: form.status,
    }

    const { error } = await supabase.from('contracts').insert(payload)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Contract created.')
      setForm(initialForm)
      setInputMode('type')
      clearUploadedFile()
      await loadContracts()
    }

    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!supabase || !id) {
      return
    }

    setSuccessMessage('')
    setDeletingId(id)
    setErrorMessage('')

    const { error } = await supabase.from('contracts').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setSuccessMessage('Contract removed.')
      setContracts((current) => current.filter((row) => row.id !== id))
    }

    setDeletingId(null)
  }

  const handleSendForSigning = async (row) => {
    if (!supabase || !userId || !row?.id) {
      return
    }

    setSendContractFeedback(null)
    setSendingId(row.id)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (sessionError || !accessToken) {
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message:
          sessionError?.message ?? 'Could not read your session. Try signing in again.',
      })
      setSendingId(null)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_name, business_email')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message: profileError.message,
      })
      setSendingId(null)
      return
    }

    const businessName = profile?.business_name?.trim() ?? ''
    const business_email = profile?.business_email?.trim() ?? ''

    if (!businessName) {
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message: 'Add your business name in your profile before sending.',
      })
      setSendingId(null)
      return
    }

    if (!business_email || !business_email.includes('@')) {
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message: 'Add a valid business email in your profile before sending.',
      })
      setSendingId(null)
      return
    }

    const to =
      typeof row.client_email === 'string'
        ? row.client_email.trim()
        : String(row.client_email ?? '').trim()

    if (!to) {
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message: 'This contract needs a client email before you can send it.',
      })
      setSendingId(null)
      return
    }

    const clientName =
      typeof row.client_name === 'string'
        ? row.client_name.trim()
        : String(row.client_name ?? '').trim()

    const contractTitle =
      typeof row.title === 'string' ? row.title.trim() : String(row.title ?? '').trim()

    const contractContent =
      typeof row.content === 'string' ? row.content : row.content == null ? '' : String(row.content)

    const { data: tokenRow, error: tokenError } = await supabase
      .from('contracts')
      .select('signing_token')
      .eq('id', row.id)
      .maybeSingle()

    if (tokenError) {
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message: tokenError.message,
      })
      setSendingId(null)
      return
    }

    const signingToken =
      typeof tokenRow?.signing_token === 'string' ? tokenRow.signing_token.trim() : ''

    if (!signingToken) {
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message: 'This contract is missing a signing token.',
      })
      setSendingId(null)
      return
    }

    const payload = {
      to,
      clientName,
      businessName,
      replyTo: business_email,
      contractTitle,
      contractContent,
      signingToken,
    }

    try {
      const response = await fetch(SEND_CONTRACT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      let result = null
      try {
        result = await response.json()
      } catch {
        result = null
      }

      if (!response.ok) {
        const msg =
          result && typeof result.error === 'string'
            ? result.error
            : `Send failed (${response.status})`
        setSendContractFeedback({
          contractId: row.id,
          kind: 'error',
          message: msg,
        })
        setSendingId(null)
        return
      }

      if (result?.success) {
        setSendContractFeedback({
          contractId: row.id,
          kind: 'success',
          message: 'Sent!',
        })
        setSendingId(null)
        window.setTimeout(() => {
          setSendContractFeedback((current) =>
            current?.contractId === row.id && current?.kind === 'success' ? null : current,
          )
        }, 2500)
      } else {
        const msg =
          result && typeof result.error === 'string' ? result.error : 'Send failed.'
        setSendContractFeedback({
          contractId: row.id,
          kind: 'error',
          message: msg,
        })
        setSendingId(null)
      }
    } catch (err) {
      console.error(err)
      setSendContractFeedback({
        contractId: row.id,
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error while sending.',
      })
      setSendingId(null)
    }
  }

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
    }
  }, [])

  if (authLoading) {
    return (
      <section className="contracts-page">
        <p className="contracts-page__subtitle">Loading session…</p>
      </section>
    )
  }

  if (!userId) {
    return (
      <section className="contracts-page">
        <h1 className="contracts-page__title">Contracts</h1>
        <p className="contracts-page__subtitle">Sign in to manage contracts.</p>
      </section>
    )
  }

  return (
    <section className="contracts-page">
      <h1 className="contracts-page__title">Contracts</h1>
      <p className="contracts-page__subtitle">
        Draft agreements for clients, track sent and signed status — type terms or upload a PDF or
        Word file.
      </p>

      <div className="contracts-page__layout">
        <div className="contracts-page__panel">
          <h2 className="contracts-page__panel-title">New contract</h2>
          <form onSubmit={handleSubmit}>
            <div className="contracts-page__field">
              <label className="contracts-page__label" htmlFor="contract-client-name">
                Client name
              </label>
              <input
                id="contract-client-name"
                name="client_name"
                className="contracts-page__input"
                value={form.client_name}
                onChange={handleFormChange}
                required
                autoComplete="off"
              />
            </div>
            <div className="contracts-page__field">
              <label className="contracts-page__label" htmlFor="contract-client-email">
                Client email
              </label>
              <input
                id="contract-client-email"
                name="client_email"
                type="email"
                className="contracts-page__input"
                value={form.client_email}
                onChange={handleFormChange}
                autoComplete="off"
              />
            </div>
            <div className="contracts-page__field">
              <label className="contracts-page__label" htmlFor="contract-title">
                Contract title
              </label>
              <input
                id="contract-title"
                name="title"
                className="contracts-page__input"
                value={form.title}
                onChange={handleFormChange}
                required
                autoComplete="off"
              />
            </div>

            <div className="contracts-page__field">
              <span className="contracts-page__label" id="contract-body-mode-label">
                Contract body
              </span>
              <div className="contracts-page__toggle" role="group" aria-labelledby="contract-body-mode-label">
                <button
                  type="button"
                  className={`contracts-page__toggle-btn${inputMode === 'type' ? ' contracts-page__toggle-btn--active' : ''}`}
                  onClick={setModeType}
                >
                  Type contract
                </button>
                <button
                  type="button"
                  className={`contracts-page__toggle-btn${inputMode === 'upload' ? ' contracts-page__toggle-btn--active' : ''}`}
                  onClick={setModeUpload}
                >
                  Upload contract file
                </button>
              </div>

              {inputMode === 'type' && (
                <>
                  <label className="contracts-page__label" htmlFor="contract-content">
                    Contract content
                  </label>
                  <textarea
                    id="contract-content"
                    name="content"
                    className="contracts-page__textarea"
                    value={form.content}
                    onChange={handleFormChange}
                    placeholder="Full terms and conditions…"
                    rows={12}
                  />
                </>
              )}

              {inputMode === 'upload' && (
                <>
                  <input
                    ref={contractFileInputRef}
                    id="contract-file"
                    className="contracts-page__file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    aria-label="Choose contract file"
                    onChange={handleContractFileChange}
                  />
                  <div className="contracts-page__file-row">
                    <label htmlFor="contract-file" className="contracts-page__file-button">
                      Choose file
                    </label>
                    {contractFileUrl && !isUploading && (
                      <button
                        type="button"
                        className="contracts-page__clear-file"
                        onClick={clearUploadedFile}
                      >
                        Remove file
                      </button>
                    )}
                  </div>
                  <p className="contracts-page__file-hint">PDF or Word (.pdf, .doc, .docx)</p>
                  {uploadedFileName && (
                    <p className="contracts-page__file-name">{uploadedFileName}</p>
                  )}
                  {isUploading && (
                    <div className="contracts-page__upload-progress" aria-live="polite">
                      <div className="contracts-page__upload-progress-label">
                        <span>Uploading…</span>
                        {!uploadIndeterminate && uploadPercent !== null && (
                          <span>{uploadPercent}%</span>
                        )}
                      </div>
                      <div
                        className={`contracts-page__progress-track${uploadIndeterminate || uploadPercent === null ? ' contracts-page__progress-track--indeterminate' : ''}`}
                      >
                        <div
                          className="contracts-page__progress-fill"
                          style={
                            !uploadIndeterminate && uploadPercent !== null
                              ? { width: `${uploadPercent}%` }
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="contracts-page__field">
              <label className="contracts-page__label" htmlFor="contract-status">
                Status
              </label>
              <select
                id="contract-status"
                name="status"
                className="contracts-page__select"
                value={form.status}
                onChange={handleFormChange}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="contracts-page__submit"
              disabled={submitting || loading || isUploading}
            >
              {submitting ? 'Creating…' : 'Create contract'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="contracts-page__section-heading">Your contracts</h2>
          {loading ? (
            <p className="contracts-page__subtitle">Loading contracts…</p>
          ) : contracts.length === 0 ? (
            <p className="contracts-page__empty">
              No contracts yet. Create your first contract using the form.
            </p>
          ) : (
            <ul className="contracts-page__list">
              {contracts.map((row) => {
                const { variant, label } = getStatusInfo(row)
                const statusClass =
                  variant === 'draft'
                    ? 'contracts-page__status--draft'
                    : variant === 'sent'
                      ? 'contracts-page__status--sent'
                      : variant === 'signed'
                        ? 'contracts-page__status--signed'
                        : 'contracts-page__status--unknown'

                const created = resolveCreatedAt(row)
                const signedAt = resolveSignedAt(row)
                const showSigned =
                  signedAt != null || String(row?.status ?? '').toLowerCase() === 'signed'
                const fileUrl = resolveContractFileUrl(row)
                const rowSendFeedback =
                  sendContractFeedback?.contractId === row.id ? sendContractFeedback : null

                return (
                  <li key={row.id} className="contracts-page__row">
                    <div className="contracts-page__row-header">
                      <h2 className="contracts-page__row-title">{resolveTitle(row)}</h2>
                      <span className={`contracts-page__status ${statusClass}`}>{label}</span>
                    </div>
                    <p className="contracts-page__row-client">{resolveClientName(row)}</p>
                    <p className="contracts-page__row-meta">
                      Created: {formatDateTime(created)}
                    </p>
                    {showSigned && (
                      <p className="contracts-page__row-meta">
                        Signed: {signedAt ? formatDateTime(signedAt) : '—'}
                      </p>
                    )}
                    {fileUrl && (
                      <p className="contracts-page__row-meta">
                        <a
                          className="contracts-page__view-contract"
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Contract
                        </a>
                      </p>
                    )}
                    <div className="contracts-page__row-actions">
                      {!showSigned && (
                        <div className="contracts-page__send-inline">
                          <button
                            type="button"
                            className="contracts-page__btn-send-signing"
                            disabled={sendingId === row.id || deletingId === row.id}
                            onClick={() => handleSendForSigning(row)}
                          >
                            {sendingId === row.id ? 'Sending...' : 'Send for Signing'}
                          </button>
                          {rowSendFeedback && (
                            <span
                              className={
                                rowSendFeedback.kind === 'success'
                                  ? 'contracts-page__send-feedback contracts-page__send-feedback--ok'
                                  : 'contracts-page__send-feedback contracts-page__send-feedback--err'
                              }
                              role={rowSendFeedback.kind === 'error' ? 'alert' : 'status'}
                            >
                              {rowSendFeedback.message}
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        className="contracts-page__delete"
                        disabled={deletingId === row.id || sendingId === row.id}
                        onClick={() => handleDelete(row.id)}
                      >
                        {deletingId === row.id ? 'Removing…' : 'Delete'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="contracts-page__message" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && !errorMessage && (
        <p className="contracts-page__message contracts-page__message--ok" role="status">
          {successMessage}
        </p>
      )}
    </section>
  )
}

export default Contracts
