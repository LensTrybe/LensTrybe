import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function ContractsPage() {
  const { user, profile } = useAuth()
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
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ client_name: '', client_email: '', project_name: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [brandKit, setBrandKit] = useState(null)

  const [form, setForm] = useState({
    client_name: '', client_email: '', project_name: '',
    project_date: '', content: '', notes: '', contract_type: 'written',
  })

  useEffect(() => { if (user) { loadContracts(); loadTemplates(); loadBrandKit() } }, [user])

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

  async function loadBrandKit() {
    if (!user) return
    const { data } = await supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle()
    setBrandKit(data ?? null)
  }

  async function createContract(send = false) {
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

  const contractBrandFont = brandKit?.font ?? 'Inter'
  const contractHeaderBg = { background: brandKit?.primary_color ?? '#1DB954' }
  const contractBrandLogo = brandKit?.logo_url || ''

  const statusColor = { draft: '#6b7280', sent: '#3b82f6', signed: '#1DB954', expired: '#ef4444' }

  const viewContractUrl = showView ? (showView.file_url ?? showView.contract_file_url ?? showView.content) : null

  const s = {
    page: { padding: '32px 40px', fontFamily: 'var(--font-ui)' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 },
    tabs: { display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', marginBottom: '24px' },
    tab: (active) => ({ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'var(--bg-base)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s' }),
    btn: (variant = 'primary') => ({ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: variant === 'primary' ? '#1DB954' : variant === 'danger' ? 'rgba(239,68,68,0.1)' : 'var(--bg-elevated)', color: variant === 'primary' ? '#000' : variant === 'danger' ? '#ef4444' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }),
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)' },
    td: { padding: '14px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' },
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
    modalBox: { background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '16px', width: '100%', maxWidth: '780px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    modalHeader: { padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    modalBody: { padding: '28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' },
    input: { padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', width: '100%', boxSizing: 'border-box' },
    label: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    editor: { padding: '12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', minHeight: '280px', resize: 'vertical', width: '100%', boxSizing: 'border-box', lineHeight: 1.6 },
    badge: (status) => ({ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', background: `${statusColor[status] ?? '#6b7280'}22`, color: statusColor[status] ?? '#6b7280' }),
    templateCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    emptyState: { padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' },
  }

  return (
    <div style={s.page}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      <div style={s.header}>
        <div style={s.title}>Contracts</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={s.btn('secondary')} onClick={() => setShowUpload(true)}>⬆ Upload Contract</button>
          <button style={s.btn('primary')} onClick={() => setShowCreate(true)}>+ New Contract</button>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0])} />
        </div>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'contracts')} onClick={() => setTab('contracts')}>My Contracts {contracts.length > 0 && `(${contracts.length})`}</button>
        <button style={s.tab(tab === 'templates')} onClick={() => setTab('templates')}>Templates {templates.length > 0 && `(${templates.length})`}</button>
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
                  <td style={s.td}>{c.project_name ?? c.title ?? '—'}</td>
                  <td style={s.td}>{c.contract_type === 'uploaded' ? '📎 Uploaded' : '✍ Written'}</td>
                  <td style={s.td}><span style={s.badge(c.status)}>{c.status}</span></td>
                  <td style={s.td}>{new Date(c.created_at).toLocaleDateString('en-AU')}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <button style={{ ...s.btn('danger'), padding: '5px 10px', fontSize: '12px' }} onClick={() => deleteContract(c.id)}>Delete</button>
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
            {templates.map(t => (
              <div key={t.id} style={s.templateCard}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString('en-AU')}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={s.btn('secondary')} onClick={() => useTemplate(t)}>Use Template</button>
                  <button style={s.btn('danger')} onClick={() => deleteTemplate(t.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create Contract Modal */}
      {showCreate && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>New Contract</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  style={{ ...s.btn('secondary'), fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => setShowSaveTemplate(true)}
                >
                  💾 Save as Template
                </button>
                <button style={{ ...s.btn('secondary'), fontSize: '12px', padding: '6px 12px' }} onClick={() => createContract(false)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button style={{ ...s.btn('primary'), fontSize: '12px', padding: '6px 12px' }} onClick={() => createContract(true)} disabled={saving || !form.client_email}>
                  {saving ? 'Sending…' : 'Send to Client'}
                </button>
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
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Write your contract terms here…"
                />
              </div>
              <div>
                <label style={s.label}>Notes (optional)</label>
                <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." />
              </div>
              <div style={{ padding: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', fontSize: '12px', color: '#ef4444' }}>
                ⚠ LensTrybe provides tools to create and send contracts but does not provide legal advice. You are responsible for your contract content. Consult a legal professional if unsure.
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
                <button style={{ ...s.btn('secondary'), fontSize: '12px', padding: '6px 12px' }} onClick={() => setShowSaveTemplate(true)}>💾 Save as Template</button>
                {showView.status !== 'signed' && (
                  <button style={{ ...s.btn('primary'), fontSize: '12px', padding: '6px 12px' }} onClick={() => sendContract(showView)}>
                    {showView.status === 'sent' ? 'Resend' : 'Send to Client'}
                  </button>
                )}
                <button style={{ ...s.btn('danger'), fontSize: '12px', padding: '6px 12px' }} onClick={() => deleteContract(showView.id)}>Delete</button>
                <button onClick={() => setShowView(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <div style={{ padding: '40px 48px', overflowY: 'auto', flex: 1, background: '#fff', color: '#111' }}>
              <div style={{ margin: '-40px -48px 24px -48px', padding: '20px 48px', ...contractHeaderBg, color: brandKit?.secondary_color ?? '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {contractBrandLogo && <img src={contractBrandLogo} alt="Logo" style={{ height: '48px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: '26px', fontWeight: 800, marginBottom: '4px', fontFamily: contractBrandFont }}>{profile?.business_name ?? 'Creative'}</div>
                      <div style={{ fontSize: '13px', opacity: 0.85 }}>{profile?.business_email}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: contractBrandFont }}>CONTRACT</div>
                    <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>#{showView.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '13px', opacity: 0.85 }}>{new Date(showView.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Between</div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{profile?.business_name}</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>and</div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '8px' }}>{showView.client_name}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>{showView.client_email}</div>
              </div>
              {showView.project_name && (
                <div style={{ marginBottom: '24px', padding: '12px 16px', background: '#f9fafb', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project: </span>
                  <span style={{ fontSize: '14px', color: '#111' }}>{showView.project_name}</span>
                  {showView.project_date && <span style={{ fontSize: '13px', color: '#666', marginLeft: '12px' }}>· {new Date(showView.project_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                </div>
              )}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginBottom: '32px' }}>
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
                          style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', color: '#1DB954', textDecoration: 'none', fontFamily: 'var(--font-ui)' }}
                        >
                          ↗ Open full screen
                        </a>
                      </>
                    ) : (
                      <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                        <div style={{ fontSize: '14px', color: '#374151', marginBottom: '16px' }}>This document cannot be previewed in the browser.</div>
                        <a
                          href={viewContractUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ padding: '10px 20px', background: '#1DB954', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}
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
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Notes</div>
                  <div style={{ fontSize: '13px', color: '#374151' }}>{showView.notes}</div>
                </div>
              )}
              <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#999', textAlign: 'center' }}>
                This contract was created via LensTrybe · {profile?.business_name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveTemplate && (
        <div style={{ ...s.modal, zIndex: 1100 }}>
          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Save as Template</div>
            <label style={s.label}>Template Name</label>
            <input
              style={{ ...s.input, marginBottom: '16px' }}
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. Wedding Photography Contract"
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={s.btn('secondary')} onClick={() => { setShowSaveTemplate(false); setTemplateName('') }}>Cancel</button>
              <button style={s.btn('primary')} onClick={saveAsTemplate} disabled={savingTemplate || !templateName.trim()}>
                {savingTemplate ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div style={s.modal}>
          <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '28px' }}>
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
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1DB954' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
                >
                  {uploadFile ? (
                    <div style={{ fontSize: '14px', color: '#1DB954', fontWeight: 600 }}>✓ {uploadFile.name}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📎</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Click to select a file</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>PDF, DOC or DOCX</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={s.btn('secondary')} onClick={() => { setShowUpload(false); setUploadFile(null); setUploadForm({ client_name: '', client_email: '', project_name: '' }) }}>Cancel</button>
              <button style={s.btn('primary')} onClick={uploadContract} disabled={saving || !uploadFile || !uploadForm.client_name}>
                {saving ? 'Uploading…' : 'Upload Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
