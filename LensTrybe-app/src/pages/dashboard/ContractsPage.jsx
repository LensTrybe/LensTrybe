import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const BLUE = '#4A9EFF'

function mergeContractBrand(brandKit) {
  const base = brandKit || {}
  const raw = base.document_brand_settings
  const docs = raw && typeof raw === 'object' ? raw : {}
  const c = docs.contract && typeof docs.contract === 'object' ? docs.contract : {}
  const primary = c.primary_colour ?? c.primary_color ?? base.primary_color ?? '#1DB954'
  const accent = '#ffffff'
  const font = c.font ?? base.font ?? 'Inter'
  const logo = c.logo_url || base.logo_url || ''
  const secondary = base.secondary_color ?? '#ffffff'
  const hasCustomTemplate = Boolean(c.custom_template_url)
  const fontStack = font.includes(' ') ? `"${font}", sans-serif` : `${font}, sans-serif`
  return { primary, accent, font, logo, secondary, hasCustomTemplate, fontStack }
}

const STATUS_META = {
  signed: { label: 'Signed', color: GREEN, bg: 'rgba(29,185,84,0.14)' },
  sent: { label: 'Sent', color: BLUE, bg: 'rgba(74,158,255,0.16)' },
  expired: { label: 'Expired', color: PINK, bg: 'rgba(255,45,120,0.14)' },
  draft: { label: 'Draft', color: 'var(--lt-muted)', bg: 'var(--lt-surface-2)' },
}
function statusMeta(s) { return STATUS_META[s] || STATUS_META.draft }

function StyleBlock() {
  return (
    <style>{`
      .ltk-page { display: flex; flex-direction: column; gap: 22px; overflow-x: hidden; }
      .ltk-input { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 13.5px; color: var(--lt-text); background: var(--lt-input-bg); border: 1px solid var(--lt-input-border); border-radius: 9px; padding: 10px 12px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
      .ltk-input:focus { border-color: ${GREEN}; box-shadow: 0 0 0 3px rgba(29,185,84,0.16); }
      textarea.ltk-input { resize: vertical; line-height: 1.6; }
      .ltk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltk-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltk-btn-primary:hover { filter: brightness(1.06); }
      .ltk-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltk-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltk-btn:disabled { opacity: 0.5; cursor: default; }
      .ltk-chip { padding: 7px 15px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); }
      .ltk-chip.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltk-row { border-top: 1px solid var(--lt-hairline); transition: background .12s ease; cursor: pointer; }
      .ltk-row:hover { background: var(--lt-surface-2); }
      .ltk-th { text-align: left; padding: 11px 16px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--lt-faint); white-space: nowrap; }
      .ltk-td { padding: 13px 16px; font-size: 13.5px; color: var(--lt-text); vertical-align: middle; }
      .ltk-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltk-modal { width: 100%; max-width: 780px; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); }
      .ltk-mhead { padding: 14px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .ltk-mbody { padding: 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
      .ltk-label { font-size: 12px; font-weight: 600; color: var(--lt-faint); margin-bottom: 5px; display: block; }
      .ltk-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 767px) {
        .ltk-grid2 { grid-template-columns: 1fr; }
        .ltk-overlay { padding: 0; }
        .ltk-modal { max-width: 100vw; max-height: 100vh; height: 100vh; border-radius: 0; }
        .ltk-page button { min-height: 40px; }
        .ltk-tablewrap table { min-width: 640px; }
      }
    `}</style>
  )
}

export default function ContractsPage() {
  const { user, profile } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [contracts, setContracts] = useState([])
  const [templates, setTemplates] = useState([])
  const [tab, setTab] = useState('contracts')
  const [showCreate, setShowCreate] = useState(false)
  const [showView, setShowView] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const fileInputRef = useRef()
  const externalContractFileRef = useRef(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadedContracts, setUploadedContracts] = useState([])
  const [externalContractClientName, setExternalContractClientName] = useState('')
  const [externalContractFile, setExternalContractFile] = useState(null)
  const [savingExternalContract, setSavingExternalContract] = useState(false)
  const [uploadForm, setUploadForm] = useState({ client_name: '', client_email: '', project_name: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [brandKit, setBrandKit] = useState(null)
  const [contractModerationError, setContractModerationError] = useState('')
  const [templateModerationError, setTemplateModerationError] = useState('')

  const [form, setForm] = useState({
    client_name: '', client_email: '', project_name: '',
    project_date: '', content: '', notes: '', contract_type: 'written',
  })

  const loadBrandKit = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle()
    setBrandKit(data ?? null)
  }, [user])

  const loadContracts = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('contracts').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setContracts(data ?? [])
  }, [user])

  const loadTemplates = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('contract_templates').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setTemplates(data ?? [])
  }, [user])

  const loadUploadedContracts = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await supabase.from('uploaded_contracts').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    if (error) { console.warn('uploaded_contracts:', error.message); setUploadedContracts([]); return }
    setUploadedContracts(data ?? [])
  }, [user])

  useEffect(() => {
    if (user) { loadContracts(); loadTemplates(); loadBrandKit(); loadUploadedContracts() }
  }, [user, loadContracts, loadTemplates, loadBrandKit, loadUploadedContracts])
  useEffect(() => {
    window.addEventListener('focus', loadBrandKit)
    return () => window.removeEventListener('focus', loadBrandKit)
  }, [loadBrandKit])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function storagePathFromContractsPublicUrl(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return null
    const marker = '/object/public/contracts/'
    const i = fileUrl.indexOf(marker)
    return i >= 0 ? decodeURIComponent(fileUrl.slice(i + marker.length).split('?')[0]) : null
  }

  function fileTypeFromName(name) {
    const lower = (name || '').toLowerCase()
    if (lower.endsWith('.docx')) return 'docx'
    if (lower.endsWith('.pdf')) return 'pdf'
    return null
  }

  async function uploadExternalContract() {
    if (!user?.id || !externalContractFile || !externalContractClientName.trim()) return
    const ft = fileTypeFromName(externalContractFile.name)
    if (!ft) { showToast('Please choose a PDF or Word (.docx) file.', 'error'); return }
    setSavingExternalContract(true)
    try {
      const safeName = externalContractFile.name.replace(/[/\\]/g, '_').replace(/[^\w.\-()+ ]/g, '_').replace(/_+/g, '_').trim() || 'document'
      const path = `uploaded_contracts/${user.id}/${safeName}`
      const { error: uploadError } = await supabase.storage.from('contracts').upload(path, externalContractFile, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path)
      const publicUrl = urlData.publicUrl
      const { error } = await supabase.from('uploaded_contracts').insert({
        creative_id: user.id, file_url: publicUrl, file_name: externalContractFile.name,
        client_name: externalContractClientName.trim(), file_type: ft,
      })
      if (error) throw error
      await loadUploadedContracts()
      setExternalContractClientName(''); setExternalContractFile(null)
      if (externalContractFileRef.current) externalContractFileRef.current.value = ''
      showToast('Contract file saved')
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error')
    }
    setSavingExternalContract(false)
  }

  async function deleteUploadedContract(row) {
    const ok = window.confirm(`Remove "${row.file_name}" from your uploaded contracts? This cannot be undone.`)
    if (!ok) return
    try {
      const storagePath = storagePathFromContractsPublicUrl(row.file_url)
      if (storagePath) {
        const { error: rmErr } = await supabase.storage.from('contracts').remove([storagePath])
        if (rmErr) console.warn('Storage remove:', rmErr.message)
      }
      const { error } = await supabase.from('uploaded_contracts').delete().eq('id', row.id).eq('creative_id', user.id)
      if (error) throw error
      setUploadedContracts((prev) => prev.filter((r) => r.id !== row.id))
      showToast('Uploaded contract removed')
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error')
    }
  }

  function downloadUploadedContract(row) {
    try {
      const a = document.createElement('a')
      a.href = row.file_url; a.download = row.file_name || 'contract'; a.target = '_blank'; a.rel = 'noopener noreferrer'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch {
      window.open(row.file_url, '_blank', 'noopener,noreferrer')
    }
  }

  async function createContract(send = false) {
    setContractModerationError('')
    const contractText = [form.content, form.notes].filter(Boolean).join('\n')
    if (contractText.trim()) {
      const mod = await moderateText(contractText)
      if (mod?.blocked) { setContractModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
      if (mod?.flagged) console.warn('[moderation] Flagged contract body', mod.reason)
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('contracts').insert({
        creative_id: user.id,
        client_name: form.client_name,
        client_email: form.client_email,
        title: form.project_name || 'Contract',
        project_name: form.project_name || null,
        project_date: form.project_date || null,
        content: form.content,
        notes: form.notes || null,
        status: send ? 'sent' : 'draft',
        download_token: crypto.randomUUID(),
        contract_type: 'written',
      }).select().single()
      if (error) throw error
      await loadContracts()
      if (send && data) await sendContract(data)
      setShowCreate(false)
      resetForm()
      showToast(send ? 'Contract sent successfully' : 'Contract saved as draft')
    } catch (err) {
      showToast('Failed to save contract: ' + err.message, 'error')
    }
    setSaving(false)
  }

  async function sendContract(contract) {
    try {
      const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-contract', { body: { contract_id: contract.id } })
      if (sendErr || sendData?.error) throw new Error('send failed')
      await supabase.from('contracts').update({ status: 'sent' }).eq('id', contract.id)
      await loadContracts()
      if (showView) setShowView(prev => ({ ...prev, status: 'sent' }))
      showToast('Contract sent successfully')
    } catch (err) {
      showToast('Failed to send contract', 'error')
    }
  }

  async function uploadContract() {
    if (!uploadFile) return
    setSaving(true)
    try {
      const path = `contracts/${user.id}/${Date.now()}_${uploadFile.name}`
      const { error: uploadError } = await supabase.storage.from('contracts').upload(path, uploadFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path)
      const publicUrl = urlData.publicUrl
      const { error } = await supabase.from('contracts').insert({
        creative_id: user.id,
        client_name: uploadForm.client_name,
        client_email: uploadForm.client_email,
        title: uploadForm.project_name || uploadFile.name,
        project_name: uploadForm.project_name || null,
        contract_file_url: publicUrl,
        status: 'draft',
        download_token: crypto.randomUUID(),
        contract_type: 'uploaded',
      })
      if (error) throw error
      await loadContracts()
      showToast('Contract uploaded successfully')
      setShowUpload(false)
      setUploadForm({ client_name: '', client_email: '', project_name: '' })
      setUploadFile(null)
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error')
    }
    setSaving(false)
  }

  async function saveAsTemplate() {
    if (!templateName.trim()) return
    setTemplateModerationError('')
    const contentToSave = showView ? showView.content : form.content
    if (contentToSave && String(contentToSave).trim()) {
      const mod = await moderateText(String(contentToSave))
      if (mod?.blocked) { setTemplateModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
      if (mod?.flagged) console.warn('[moderation] Flagged contract template content', mod.reason)
    }
    setSavingTemplate(true)
    await supabase.from('contract_templates').insert({
      creative_id: user.id, name: templateName.trim(), content: showView ? showView.content : form.content,
    })
    await loadTemplates()
    setSavingTemplate(false)
    setShowSaveTemplate(false)
    setTemplateName('')
    showToast('Template saved')
  }

  async function deleteContract(id) {
    await supabase.from('contracts').delete().eq('id', id)
    setContracts(prev => prev.filter(c => c.id !== id))
    setShowView(null)
    showToast('Contract deleted')
  }

  async function deleteTemplate(id) {
    await supabase.from('contract_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    showToast('Template deleted')
  }

  function useTemplate(template) {
    setForm(prev => ({ ...prev, content: template.content }))
    setTab('contracts')
    setShowCreate(true)
  }

  function resetForm() {
    setForm({ client_name: '', client_email: '', project_name: '', project_date: '', content: '', notes: '', contract_type: 'written' })
  }

  const contractMerged = useMemo(() => mergeContractBrand(brandKit), [brandKit])
  const contractPrimary = contractMerged.primary
  const contractAccent = contractMerged.accent
  const contractBrandFontStack = contractMerged.fontStack
  const contractHeaderBg = { background: contractPrimary }
  const contractBrandLogo = contractMerged.logo
  const contractHeaderTextColor = contractMerged.secondary
  const contractDocSurface = { padding: isMobile ? '16px' : '40px 48px', overflowY: 'auto', flex: 1, background: '#fff', color: '#111', fontFamily: contractBrandFontStack }
  const viewContractUrl = showView ? (showView.file_url ?? showView.contract_file_url ?? showView.content) : null

  const stats = useMemo(() => ({
    total: contracts.length,
    sent: contracts.filter(c => c.status === 'sent').length,
    signed: contracts.filter(c => c.status === 'signed').length,
    templates: templates.length,
  }), [contracts, templates])

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18 }
  const stat = { ...GLASS, flex: '1 1 150px', borderRadius: 16, padding: '16px 18px' }

  const tabs = [
    { key: 'contracts', label: `Contracts${contracts.length ? ` (${contracts.length})` : ''}` },
    { key: 'templates', label: `Templates${templates.length ? ` (${templates.length})` : ''}` },
    { key: 'uploaded_contracts', label: `Uploaded${uploadedContracts.length ? ` (${uploadedContracts.length})` : ''}` },
  ]

  return (
    <>
      <StyleBlock />
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : '#ef4444', color: toast.type === 'success' ? GREEN_DARK : '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, boxShadow: '0 10px 30px -8px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      <div className="ltk-page">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: isMobile ? 24 : 27, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Contracts</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Write, send and store client agreements.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="ltk-btn ltk-btn-ghost" onClick={() => setShowUpload(true)}>Upload contract</button>
            <button type="button" className="ltk-btn ltk-btn-primary" onClick={() => setShowCreate(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New contract
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0])} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{stats.total}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Contracts</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: BLUE }}>{stats.sent}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Sent</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{stats.signed}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Signed</div></div>
          <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{stats.templates}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Templates</div></div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button key={t.key} type="button" className={`ltk-chip${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* My Contracts */}
        {tab === 'contracts' && (
          <div style={{ ...card, overflow: 'hidden' }}>
            {contracts.length === 0 ? (
              <div style={{ padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No contracts yet. Create your first, or upload an existing one.</div>
            ) : (
              <div className="ltk-tablewrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="ltk-th">Client</th>
                      <th className="ltk-th">Project</th>
                      <th className="ltk-th">Type</th>
                      <th className="ltk-th">Status</th>
                      <th className="ltk-th">Date</th>
                      <th className="ltk-th" />
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map(c => {
                      const m = statusMeta(c.status)
                      return (
                        <tr key={c.id} className="ltk-row" onClick={() => setShowView(c)}>
                          <td className="ltk-td" style={{ fontWeight: 600 }}>{c.client_name}</td>
                          <td className="ltk-td" style={{ color: 'var(--lt-muted)' }}>{c.project_name ?? c.title ?? 'Not set'}</td>
                          <td className="ltk-td" style={{ color: 'var(--lt-muted)' }}>{c.contract_type === 'uploaded' ? 'Uploaded' : 'Written'}</td>
                          <td className="ltk-td"><span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: m.color, background: m.bg }}>{m.label}</span></td>
                          <td className="ltk-td" style={{ color: 'var(--lt-muted)', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString('en-AU')}</td>
                          <td className="ltk-td" onClick={e => e.stopPropagation()}>
                            <button className="ltk-btn ltk-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)', padding: '6px 12px' }} onClick={() => deleteContract(c.id)}>Delete</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Templates */}
        {tab === 'templates' && (
          templates.length === 0 ? (
            <div style={{ ...card, padding: '48px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No templates saved yet. Create a contract and save it as a template for reuse.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {templates.map((t) => (
                <div key={t.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--lt-faint)' }}>{new Date(t.created_at).toLocaleDateString('en-AU')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ltk-btn ltk-btn-ghost" onClick={() => useTemplate(t)}>Use template</button>
                    <button className="ltk-btn ltk-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => deleteTemplate(t.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Uploaded */}
        {tab === 'uploaded_contracts' && (
          <>
            <div style={{ ...card, padding: '20px 22px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginBottom: 14, lineHeight: 1.5 }}>Store agreements you prepared outside LensTrybe. Files are kept in your account for reference only. They are not sent to clients from here.</div>
              <div style={{ marginBottom: 12 }}>
                <label className="ltk-label">Client name</label>
                <input className="ltk-input" value={externalContractClientName} onChange={(e) => setExternalContractClientName(e.target.value)} placeholder="Who this agreement is for" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="ltk-label">Contract file</label>
                <input ref={externalContractFileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) { setExternalContractFile(null); return }
                    const lower = f.name.toLowerCase()
                    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) { showToast('Please choose a PDF or Word (.docx) file.', 'error'); e.target.value = ''; setExternalContractFile(null); return }
                    setExternalContractFile(f)
                  }} />
                <button type="button" className="ltk-btn ltk-btn-ghost" style={{ marginBottom: 10 }} onClick={() => externalContractFileRef.current?.click()}>Choose file</button>
                {externalContractFile ? <div style={{ fontSize: 13, color: 'var(--lt-text)', fontWeight: 600 }}>{externalContractFile.name}</div> : <div style={{ fontSize: 12, color: 'var(--lt-faint)' }}>PDF or Word (.docx) only</div>}
              </div>
              <button type="button" className="ltk-btn ltk-btn-primary" onClick={uploadExternalContract} disabled={savingExternalContract || !externalContractFile || !externalContractClientName.trim()}>{savingExternalContract ? 'Uploading…' : 'Upload'}</button>
            </div>

            {uploadedContracts.length === 0 ? (
              <div style={{ ...card, padding: '40px 18px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No uploaded contracts yet. Add a PDF or Word file above.</div>
            ) : (
              <div style={{ ...card, overflow: 'hidden' }}>
                <div className="ltk-tablewrap" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th className="ltk-th">File name</th><th className="ltk-th">Client</th><th className="ltk-th">Type</th><th className="ltk-th">Uploaded</th><th className="ltk-th" />
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedContracts.map((row) => (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--lt-hairline)' }}>
                          <td className="ltk-td" style={{ fontWeight: 600 }}>{row.file_name}</td>
                          <td className="ltk-td" style={{ color: 'var(--lt-muted)' }}>{row.client_name}</td>
                          <td className="ltk-td"><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: row.file_type === 'docx' ? BLUE : PINK, background: row.file_type === 'docx' ? 'rgba(74,158,255,0.16)' : 'rgba(255,45,120,0.14)' }}>{row.file_type === 'docx' ? 'Word' : 'PDF'}</span></td>
                          <td className="ltk-td" style={{ color: 'var(--lt-muted)', whiteSpace: 'nowrap' }}>{new Date(row.created_at).toLocaleDateString('en-AU')}</td>
                          <td className="ltk-td">
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" className="ltk-btn ltk-btn-ghost" style={{ padding: '6px 12px' }} onClick={() => downloadUploadedContract(row)}>Download</button>
                              <button type="button" className="ltk-btn ltk-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)', padding: '6px 12px' }} onClick={() => deleteUploadedContract(row)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="ltk-overlay">
          <div className="ltk-modal">
            <div className="ltk-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>New contract</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="ltk-btn ltk-btn-ghost" onClick={() => setShowSaveTemplate(true)}>Save as template</button>
                <button className="ltk-btn ltk-btn-ghost" onClick={() => createContract(false)} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
                <button className="ltk-btn ltk-btn-primary" onClick={() => createContract(true)} disabled={saving || !form.client_email}>{saving ? 'Sending…' : 'Send to client'}</button>
                <button onClick={() => { setShowCreate(false); resetForm() }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
            </div>
            <div className="ltk-mbody">
              <div className="ltk-grid2">
                <div><label className="ltk-label">Client name</label><input className="ltk-input" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" /></div>
                <div><label className="ltk-label">Client email</label><input className="ltk-input" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} placeholder="client@email.com" /></div>
              </div>
              <div className="ltk-grid2">
                <div><label className="ltk-label">Project name</label><input className="ltk-input" value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} placeholder="e.g. Wedding photography" /></div>
                <div><label className="ltk-label">Project date (optional)</label><input type="date" className="ltk-input" value={form.project_date} onChange={e => setForm(p => ({ ...p, project_date: e.target.value }))} /></div>
              </div>
              <div>
                <label className="ltk-label">Contract content</label>
                <textarea className="ltk-input" style={{ minHeight: 280 }} value={form.content} onChange={e => { setContractModerationError(''); setForm(p => ({ ...p, content: e.target.value })) }} placeholder="Write your contract terms here." />
              </div>
              <div>
                <label className="ltk-label">Notes (optional)</label>
                <textarea className="ltk-input" style={{ minHeight: 80 }} value={form.notes} onChange={e => { setContractModerationError(''); setForm(p => ({ ...p, notes: e.target.value })) }} placeholder="Additional notes…" />
              </div>
              {contractModerationError ? <div style={{ fontSize: 13, color: '#f87171' }}>{contractModerationError}</div> : null}
              <div style={{ padding: 12, background: 'rgba(255,45,120,0.08)', border: '1px solid rgba(255,45,120,0.25)', borderRadius: 10, fontSize: 12, color: PINK, lineHeight: 1.5 }}>
                LensTrybe provides tools to create and send contracts but does not provide legal advice. You are responsible for your contract content. Consult a legal professional if unsure.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {showView && (
        <div className="ltk-overlay">
          <div className="ltk-modal" style={{ maxWidth: 680 }}>
            <div className="ltk-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>Contract</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="ltk-btn ltk-btn-ghost" onClick={() => setShowSaveTemplate(true)}>Save as template</button>
                {showView.status !== 'signed' && <button className="ltk-btn ltk-btn-primary" onClick={() => sendContract(showView)}>{showView.status === 'sent' ? 'Resend' : 'Send to client'}</button>}
                <button className="ltk-btn ltk-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={() => deleteContract(showView.id)}>Delete</button>
                <button onClick={() => setShowView(null)} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
            </div>
            <div style={contractDocSurface}>
              <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...contractHeaderBg, color: contractHeaderTextColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {contractBrandLogo && <img src={contractBrandLogo} alt="Logo" style={{ height: 48, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, fontFamily: contractBrandFontStack }}>{profile?.business_name ?? 'Creative'}</div>
                      <div style={{ fontSize: 13, opacity: 0.85 }}>{profile?.business_email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 30, fontWeight: 800, fontFamily: contractBrandFontStack }}>CONTRACT</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>#{showView.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{new Date(showView.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: contractAccent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Between</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{profile?.business_name}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>and</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8, color: '#111' }}>{showView.client_name}</div>
                <div style={{ fontSize: 13, color: '#666' }}>{showView.client_email}</div>
              </div>
              {showView.project_name && (
                <div style={{ marginBottom: 24, padding: '12px 16px', background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${contractAccent}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: contractAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project: </span>
                  <span style={{ fontSize: 14, color: '#111' }}>{showView.project_name}</span>
                  {showView.project_date && <span style={{ fontSize: 13, color: '#666', marginLeft: 12 }}>· {new Date(showView.project_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                </div>
              )}
              <div style={{ borderTop: `1px solid ${contractAccent}33`, paddingTop: 24, marginBottom: 32 }}>
                {showView.contract_type === 'uploaded' && !viewContractUrl ? (
                  <div style={{ fontSize: 14, color: '#666' }}>No document link is stored for this contract.</div>
                ) : showView.contract_type === 'uploaded' && viewContractUrl ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uploaded document</div>
                    {viewContractUrl.match(/\.(pdf)$/i) ? (
                      <>
                        <iframe src={viewContractUrl} style={{ width: '100%', height: 500, border: '1px solid #e5e7eb', borderRadius: 8 }} title="Contract document" />
                        <a href={viewContractUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: contractPrimary, textDecoration: 'none' }}>Open full screen</a>
                      </>
                    ) : (
                      <div style={{ padding: 20, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>This document cannot be previewed in the browser.</div>
                        <a href={viewContractUrl} target="_blank" rel="noreferrer" style={{ padding: '10px 20px', background: contractPrimary, borderRadius: 8, color: contractHeaderTextColor, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>Open document</a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.8, color: '#111', whiteSpace: 'pre-wrap' }}>{showView.content}</div>
                )}
              </div>
              {showView.notes && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 24, borderLeft: `4px solid ${contractAccent}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: contractAccent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Notes</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>{showView.notes}</div>
                </div>
              )}
              <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${contractAccent}33`, fontSize: 12, color: '#999', textAlign: 'center' }}>This contract was created via LensTrybe · {profile?.business_name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Save as template modal */}
      {showSaveTemplate && (
        <div className="ltk-overlay" style={{ zIndex: 1100 }}>
          <div className="ltk-modal" style={{ maxWidth: 440 }}>
            <div className="ltk-mbody">
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Save as template</div>
              <div>
                <label className="ltk-label">Template name</label>
                <input className="ltk-input" value={templateName} onChange={e => { setTemplateModerationError(''); setTemplateName(e.target.value) }} placeholder="e.g. Wedding photography contract" autoFocus />
              </div>
              {templateModerationError ? <div style={{ fontSize: 13, color: '#f87171' }}>{templateModerationError}</div> : null}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="ltk-btn ltk-btn-ghost" onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateModerationError('') }}>Cancel</button>
                <button className="ltk-btn ltk-btn-primary" onClick={saveAsTemplate} disabled={savingTemplate || !templateName.trim()}>{savingTemplate ? 'Saving…' : 'Save template'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="ltk-overlay">
          <div className="ltk-modal" style={{ maxWidth: 480 }}>
            <div className="ltk-mbody">
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Upload contract</div>
              <div><label className="ltk-label">Client name</label><input className="ltk-input" value={uploadForm.client_name} onChange={e => setUploadForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" /></div>
              <div><label className="ltk-label">Client email</label><input className="ltk-input" value={uploadForm.client_email} onChange={e => setUploadForm(p => ({ ...p, client_email: e.target.value }))} placeholder="client@email.com" /></div>
              <div><label className="ltk-label">Project name (optional)</label><input className="ltk-input" value={uploadForm.project_name} onChange={e => setUploadForm(p => ({ ...p, project_name: e.target.value }))} placeholder="e.g. Wedding photography" /></div>
              <div>
                <label className="ltk-label">Contract file (PDF, DOC, DOCX)</label>
                <div style={{ border: '2px dashed var(--lt-border)', borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  {uploadFile ? <div style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>✓ {uploadFile.name}</div> : (
                    <>
                      <div style={{ fontSize: 14, color: 'var(--lt-muted)' }}>Click to select a file</div>
                      <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 4 }}>PDF, DOC or DOCX</div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="ltk-btn ltk-btn-ghost" onClick={() => { setShowUpload(false); setUploadFile(null); setUploadForm({ client_name: '', client_email: '', project_name: '' }) }}>Cancel</button>
                <button className="ltk-btn ltk-btn-primary" onClick={uploadContract} disabled={saving || !uploadFile || !uploadForm.client_name}>{saving ? 'Uploading…' : 'Upload contract'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
