import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import Button from '../../components/ui/Button'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'

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

  useEffect(() => {
    if (user) {
      loadContracts()
      loadTemplates()
      loadBrandKit()
      loadUploadedContracts()
    }
  }, [user, loadBrandKit])

  useEffect(() => {
    window.addEventListener('focus', loadBrandKit)
    return () => window.removeEventListener('focus', loadBrandKit)
  }, [loadBrandKit])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadContracts() {
    const { data } = await supabase.from('contracts').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setContracts(data ?? [])
  }

  async function loadTemplates() {
    const { data } = await supabase.from('contract_templates').select('*').eq('creative_id', user.id).order('created_at', { ascending: false })
    setTemplates(data ?? [])
  }

  async function loadUploadedContracts() {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('uploaded_contracts')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('uploaded_contracts:', error.message)
      setUploadedContracts([])
      return
    }
    setUploadedContracts(data ?? [])
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
    if (!ft) {
      showToast('Please choose a PDF or Word (.docx) file.', 'error')
      return
    }
    setSavingExternalContract(true)
    try {
      const safeName =
        externalContractFile.name.replace(/[/\\]/g, '_').replace(/[^\w.\-()+ ]/g, '_').replace(/_+/g, '_').trim() ||
        'document'
      const path = `uploaded_contracts/${user.id}/${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(path, externalContractFile, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path)
      const publicUrl = urlData.publicUrl
      const { error } = await supabase.from('uploaded_contracts').insert({
        creative_id: user.id,
        file_url: publicUrl,
        file_name: externalContractFile.name,
        client_name: externalContractClientName.trim(),
        file_type: ft,
      })
      if (error) throw error
      await loadUploadedContracts()
      setExternalContractClientName('')
      setExternalContractFile(null)
      if (externalContractFileRef.current) externalContractFileRef.current.value = ''
      showToast('Contract file saved')
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error')
    }
    setSavingExternalContract(false)
  }

  async function deleteUploadedContract(row) {
    const ok = window.confirm(
      `Remove "${row.file_name}" from your uploaded contracts? This cannot be undone.`,
    )
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
      a.href = row.file_url
      a.download = row.file_name || 'contract'
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      window.open(row.file_url, '_blank', 'noopener,noreferrer')
    }
  }

  async function createContract(send = false) {
    setContractModerationError('')
    const contractText = [form.content, form.notes].filter(Boolean).join('\n')
    if (contractText.trim()) {
      const mod = await moderateText(contractText)
      if (mod?.blocked) {
        setContractModerationError(MODERATION_BLOCKED_USER_MESSAGE)
        return
      }
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
      await supabase.functions.invoke('send-contract', {
        body: { contract, profile }
      })
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
      console.log('Contract public URL:', publicUrl)
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
      if (mod?.blocked) {
        setTemplateModerationError(MODERATION_BLOCKED_USER_MESSAGE)
        return
      }
      if (mod?.flagged) console.warn('[moderation] Flagged contract template content', mod.reason)
    }
    setSavingTemplate(true)
    await supabase.from('contract_templates').insert({
      creative_id: user.id,
      name: templateName.trim(),
      content: showView ? showView.content : form.content,
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
  const customContractTemplateBanner = contractMerged.hasCustomTemplate ? (
    <div
      role="status"
      style={{
        marginBottom: '16px',
        padding: '10px 14px',
        borderRadius: '8px',
        border: `1px solid ${contractAccent}55`,
        background: `${contractAccent}12`,
        fontSize: '12px',
        color: '#374151',
        lineHeight: 1.45,
      }}
    >
      A custom template is active for contracts in Brand Kit. Your colours and font still apply to this layout; the uploaded file is not shown here.
    </div>
  ) : null

  const statusColor = { draft: '#6b7280', sent: '#3b82f6', signed: contractPrimary, expired: '#ef4444' }

  const viewContractUrl = showView ? (showView.file_url ?? showView.contract_file_url ?? showView.content) : null

  const s = {
    page: { background: 'transparent', padding: isMobile ? '16px' : '32px 40px', fontFamily: 'var(--font-ui)', overflowX: 'hidden' },
    header: { display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '0' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 },
    tabs: { display: 'flex', gap: '4px', ...GLASS_CARD, padding: '4px', borderRadius: '10px', marginBottom: '24px', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' },
    tab: (active) => ({ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s', ...TYPO.body }),
    table: { width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '720px' : '100%' },
    th: { ...TYPO.label, textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    td: { ...TYPO.body, padding: '14px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    modal: { position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '24px' },
    modalBox: { ...GLASS_MODAL_PANEL, borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100vw' : '780px', maxHeight: isMobile ? '100vh' : '90vh', height: isMobile ? '100vh' : 'auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    modalHeader: { padding: isMobile ? '12px 14px' : '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' },
    modalBody: { padding: isMobile ? '16px' : '28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' },
    input: { ...GLASS_NATIVE_FIELD, padding: '9px 12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', width: '100%', boxSizing: 'border-box' },
    label: { ...TYPO.label, fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' },
    grid2: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' },
    editor: { padding: '12px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', minHeight: '280px', resize: 'vertical', width: '100%', boxSizing: 'border-box', lineHeight: 1.6 },
    badge: (status) => ({ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', background: `${statusColor[status] ?? '#6b7280'}22`, color: statusColor[status] ?? '#6b7280' }),
    templateCard: { ...GLASS_CARD, borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '0' },
    emptyState: { padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' },
    fileTypeBadge: (t) => ({
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      background: t === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
      color: t === 'pdf' ? '#ef4444' : '#3b82f6',
    }),
  }

  return (
    <div style={s.page} className="contracts-page">
      <style>{`
        @media (max-width: 767px) {
          .contracts-page button { min-height: 44px; }
          .contracts-page input, .contracts-page textarea, .contracts-page select { width: 100% !important; font-size: 14px !important; }
          .contracts-page table { display: block; overflow-x: auto; }
          .contracts-page * { min-width: 0; }
        }
      `}</style>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      <div style={s.header}>
        <div style={s.title}>Contracts</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={() => setShowUpload(true)}>Upload Contract</Button>
          <Button variant="primary" style={{ background: contractPrimary, borderColor: contractPrimary, borderTopColor: contractPrimary, color: contractHeaderTextColor }} onClick={() => setShowCreate(true)}>+ New Contract</Button>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0])} />
        </div>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'contracts')} onClick={() => setTab('contracts')}>My Contracts {contracts.length > 0 && `(${contracts.length})`}</button>
        <button style={s.tab(tab === 'templates')} onClick={() => setTab('templates')}>Templates {templates.length > 0 && `(${templates.length})`}</button>
        <button style={s.tab(tab === 'uploaded_contracts')} onClick={() => setTab('uploaded_contracts')}>Uploaded Contracts {uploadedContracts.length > 0 && `(${uploadedContracts.length})`}</button>
      </div>

      {tab === 'contracts' && (
        contracts.length === 0 ? (
          <div style={s.emptyState}>No contracts yet. Create your first contract or upload an existing one.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Client</th>
                <th style={s.th}>Project</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Date</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setShowView(c)}>
                  <td style={s.td}>{c.client_name}</td>
                  <td style={s.td}>{c.project_name ?? c.title ?? 'Not set'}</td>
                  <td style={s.td}>{c.contract_type === 'uploaded' ? ' Uploaded' : ' Written'}</td>
                  <td style={s.td}><span style={s.badge(c.status)}>{c.status}</span></td>
                  <td style={s.td}>{new Date(c.created_at).toLocaleDateString('en-AU')}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <Button variant="danger" size="sm" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => deleteContract(c.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'templates' && (
        templates.length === 0 ? (
          <div style={s.emptyState}>No templates saved yet. Create a contract and save it as a template for reuse.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {templates.map((t) => (
              <div key={t.id} style={s.templateCard}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString('en-AU')}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="secondary" onClick={() => useTemplate(t)}>Use Template</Button>
                  <Button variant="danger" onClick={() => deleteTemplate(t.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'uploaded_contracts' && (
        <>
          <div
            style={{
              ...GLASS_CARD,
              borderRadius: '12px',
              padding: '20px 24px',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
              Store agreements you prepared outside LensTrybe. Files are kept in your account for reference only. They are not sent to clients from here.
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={s.label}>Client name</label>
              <input
                style={s.input}
                value={externalContractClientName}
                onChange={(e) => setExternalContractClientName(e.target.value)}
                placeholder="Who this agreement is for"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Contract file</label>
              <input
                ref={externalContractFileRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) {
                    setExternalContractFile(null)
                    return
                  }
                  const lower = f.name.toLowerCase()
                  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
                    showToast('Please choose a PDF or Word (.docx) file.', 'error')
                    e.target.value = ''
                    setExternalContractFile(null)
                    return
                  }
                  setExternalContractFile(f)
                }}
              />
              <Button type="button" variant="secondary" style={{ marginBottom: '10px' }} onClick={() => externalContractFileRef.current?.click()}>
                Choose file
              </Button>
              {externalContractFile ? (
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{externalContractFile.name}</div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PDF or Word (.docx) only</div>
              )}
            </div>
            <Button
              type="button"
              variant="primary"
              style={{ background: contractPrimary, borderColor: contractPrimary, borderTopColor: contractPrimary, color: contractHeaderTextColor }}
              onClick={uploadExternalContract}
              disabled={savingExternalContract || !externalContractFile || !externalContractClientName.trim()}
            >
              {savingExternalContract ? 'Uploading…' : 'Upload'}
            </Button>
          </div>

          {uploadedContracts.length === 0 ? (
            <div style={s.emptyState}>No uploaded contracts yet. Add a PDF or Word file above.</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>File name</th>
                  <th style={s.th}>Client name</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>Upload date</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {uploadedContracts.map((row) => (
                  <tr key={row.id}>
                    <td style={s.td}>{row.file_name}</td>
                    <td style={s.td}>{row.client_name}</td>
                    <td style={s.td}>
                      <span style={s.fileTypeBadge(row.file_type === 'docx' ? 'docx' : 'pdf')}>
                        {row.file_type === 'docx' ? 'Word' : 'PDF'}
                      </span>
                    </td>
                    <td style={s.td}>{new Date(row.created_at).toLocaleDateString('en-AU')}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button type="button" variant="secondary" size="sm" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => downloadUploadedContract(row)}>
                          Download
                        </Button>
                        <Button type="button" variant="danger" size="sm" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => deleteUploadedContract(row)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Create Contract Modal */}
      {showCreate && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>New Contract</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button variant="secondary" size="sm" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setShowSaveTemplate(true)}>
                   Save as Template
                </Button>
                <Button variant="secondary" size="sm" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => createContract(false)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Draft'}
                </Button>
                <Button variant="primary" size="sm" style={{ fontSize: '12px', padding: '6px 12px', background: contractPrimary, borderColor: contractPrimary, borderTopColor: contractPrimary, color: contractHeaderTextColor }} onClick={() => createContract(true)} disabled={saving || !form.client_email}>
                  {saving ? 'Sending…' : 'Send to Client'}
                </Button>
                <button onClick={() => { setShowCreate(false); resetForm() }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Client Name</label>
                  <input style={s.input} value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" />
                </div>
                <div>
                  <label style={s.label}>Client Email</label>
                  <input style={s.input} value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} placeholder="client@email.com" />
                </div>
              </div>
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Project Name</label>
                  <input style={s.input} value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} placeholder="e.g. Wedding Photography" />
                </div>
                <div>
                  <label style={s.label}>Project Date (optional)</label>
                  <input type="date" style={s.input} value={form.project_date} onChange={e => setForm(p => ({ ...p, project_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={s.label}>Contract Content</label>
                <textarea
                  style={{ ...s.editor, outline: 'none' }}
                  value={form.content}
                  onChange={e => { setContractModerationError(''); setForm(p => ({ ...p, content: e.target.value })) }}
                  placeholder="Write your contract terms here."
                />
              </div>
              <div>
                <label style={s.label}>Notes (optional)</label>
                <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => { setContractModerationError(''); setForm(p => ({ ...p, notes: e.target.value })) }} placeholder="Additional notes..." />
              </div>
              {contractModerationError ? (
                <div style={{ fontSize: '13px', color: '#f87171', fontFamily: 'var(--font-ui)' }}>{contractModerationError}</div>
              ) : null}
              <div style={{ padding: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', fontSize: '12px', color: '#ef4444' }}>
                 LensTrybe provides tools to create and send contracts but does not provide legal advice. You are responsible for your contract content. Consult a legal professional if unsure.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Contract Modal */}
      {showView && (
        <div style={s.modal}>
          <div style={{ ...s.modalBox, maxWidth: '680px' }}>
            <div style={s.modalHeader}>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>Contract</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button variant="secondary" size="sm" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setShowSaveTemplate(true)}>Save as Template</Button>
                {showView.status !== 'signed' && (
                  <Button variant="primary" size="sm" style={{ fontSize: '12px', padding: '6px 12px', background: contractPrimary, borderColor: contractPrimary, borderTopColor: contractPrimary, color: contractHeaderTextColor }} onClick={() => sendContract(showView)}>
                    {showView.status === 'sent' ? 'Resend' : 'Send to Client'}
                  </Button>
                )}
                <Button variant="danger" size="sm" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => deleteContract(showView.id)}>Delete</Button>
                <button onClick={() => setShowView(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={contractDocSurface}>
              {customContractTemplateBanner}
              <div style={{ margin: isMobile ? '-16px -16px 16px -16px' : '-40px -48px 24px -48px', padding: isMobile ? '14px 16px' : '20px 48px', ...contractHeaderBg, color: contractHeaderTextColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '10px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {contractBrandLogo && <img src={contractBrandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px', fontFamily: contractBrandFontStack }}>{profile?.business_name ?? 'Creative'}</div>
                      <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: contractBrandFontStack }}>CONTRACT</div>
                    <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>#{showView.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '13px', opacity: 0.85 }}>{new Date(showView.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: contractAccent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Between</div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{profile?.business_name}</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>and</div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '8px' }}>{showView.client_name}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>{showView.client_email}</div>
              </div>
              {showView.project_name && (
                <div style={{ marginBottom: '24px', padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', borderLeft: `4px solid ${contractAccent}` }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: contractAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project: </span>
                  <span style={{ fontSize: '14px', color: '#111' }}>{showView.project_name}</span>
                  {showView.project_date && <span style={{ fontSize: '13px', color: '#666', marginLeft: '12px' }}>· {new Date(showView.project_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                </div>
              )}
              <div style={{ borderTop: `1px solid ${contractAccent}33`, paddingTop: '24px', marginBottom: '32px' }}>
                {showView.contract_type === 'uploaded' && !viewContractUrl ? (
                  <div style={{ fontSize: '14px', color: '#666' }}>No document link is stored for this contract.</div>
                ) : showView.contract_type === 'uploaded' && viewContractUrl ? (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uploaded Document</div>
                    {viewContractUrl.match(/\.(pdf)$/i) ? (
                      <>
                        <iframe
                          src={viewContractUrl}
                          style={{ width: '100%', height: '500px', border: '1px solid var(--border-default)', borderRadius: '8px' }}
                          title="Contract document"
                        />
                        <a
                          href={viewContractUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', color: contractPrimary, textDecoration: 'none', fontFamily: 'var(--font-ui)' }}
                        >
                           Open full screen
                        </a>
                      </>
                    ) : (
                      <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}></div>
                        <div style={{ fontSize: '14px', color: '#374151', marginBottom: '16px' }}>This document cannot be previewed in the browser.</div>
                        <a
                          href={viewContractUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ padding: '10px 20px', background: contractPrimary, borderRadius: '8px', color: contractHeaderTextColor, fontSize: '13px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}
                        >
                          Open Document
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', lineHeight: 1.8, color: '#111' }}>{showView.content}</div>
                )}
              </div>
              {showView.notes && (
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '24px', borderLeft: `4px solid ${contractAccent}` }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: contractAccent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Notes</div>
                  <div style={{ fontSize: '13px', color: '#374151' }}>{showView.notes}</div>
                </div>
              )}
              <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: `1px solid ${contractAccent}33`, fontSize: '12px', color: '#999', textAlign: 'center' }}>
                This contract was created via LensTrybe · {profile?.business_name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveTemplate && (
        <div style={{ ...s.modal, zIndex: 1100 }}>
          <div style={{ ...GLASS_MODAL_PANEL, borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Save as Template</div>
            <label style={s.label}>Template Name</label>
            <input
              style={{ ...s.input, marginBottom: '16px' }}
              value={templateName}
              onChange={e => { setTemplateModerationError(''); setTemplateName(e.target.value) }}
              placeholder="e.g. Wedding Photography Contract"
              autoFocus
            />
            {templateModerationError ? (
              <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px', fontFamily: 'var(--font-ui)' }}>{templateModerationError}</div>
            ) : null}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateModerationError('') }}>Cancel</Button>
              <Button variant="primary" style={{ background: contractPrimary, borderColor: contractPrimary, borderTopColor: contractPrimary, color: contractHeaderTextColor }} onClick={saveAsTemplate} disabled={savingTemplate || !templateName.trim()}>
                {savingTemplate ? 'Saving…' : 'Save Template'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div style={s.modal}>
          <div style={{ ...GLASS_MODAL_PANEL, borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Upload Contract</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={s.label}>Client Name</label>
                <input style={s.input} value={uploadForm.client_name} onChange={e => setUploadForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" />
              </div>
              <div>
                <label style={s.label}>Client Email</label>
                <input style={s.input} value={uploadForm.client_email} onChange={e => setUploadForm(p => ({ ...p, client_email: e.target.value }))} placeholder="client@email.com" />
              </div>
              <div>
                <label style={s.label}>Project Name (optional)</label>
                <input style={s.input} value={uploadForm.project_name} onChange={e => setUploadForm(p => ({ ...p, project_name: e.target.value }))} placeholder="e.g. Wedding Photography" />
              </div>
              <div>
                <label style={s.label}>Contract File (PDF, DOC, DOCX)</label>
                <div
                  style={{ border: '2px dashed var(--border-default)', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = contractPrimary }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
                >
                  {uploadFile ? (
                    <div style={{ fontSize: '14px', color: contractPrimary, fontWeight: 600 }}>✓ {uploadFile.name}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}></div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Click to select a file</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>PDF, DOC or DOCX</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => { setShowUpload(false); setUploadFile(null); setUploadForm({ client_name: '', client_email: '', project_name: '' }) }}>Cancel</Button>
              <Button variant="primary" style={{ background: contractPrimary, borderColor: contractPrimary, borderTopColor: contractPrimary, color: contractHeaderTextColor }} onClick={uploadContract} disabled={saving || !uploadFile || !uploadForm.client_name}>
                {saving ? 'Uploading…' : 'Upload Contract'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
