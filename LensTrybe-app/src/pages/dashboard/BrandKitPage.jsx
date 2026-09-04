import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { renderDocumentHtml, DOC_FONTS, DOC_TEMPLATES } from '../../lib/documentTemplate'

const TABS = [{ id: 'invoice', name: 'Invoice' }, { id: 'quote', name: 'Quote' }]

function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const CSS = `
.ltbk{padding:28px 32px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--lt-text);max-width:1400px;margin:0 auto}
.ltbk *{box-sizing:border-box}
.ltbk .title{font-size:26px;font-weight:800;letter-spacing:-0.02em;margin:0}
.ltbk .sub{font-size:13.5px;color:var(--lt-muted);margin-top:4px;max-width:640px;line-height:1.5}
.ltbk .h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--lt-faint);margin:26px 0 12px}
.ltbk .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:22px;align-items:start}
.ltbk .card{background:var(--lt-glass-bg);border:var(--lt-glass-border);box-shadow:var(--lt-glass-shadow);backdrop-filter:var(--lt-glass-blur);-webkit-backdrop-filter:var(--lt-glass-blur);border-radius:16px;padding:20px 22px}
.ltbk .field{margin-bottom:15px}
.ltbk .lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--lt-faint);display:block;margin-bottom:7px}
.ltbk .hint{font-size:11.5px;color:var(--lt-faint);margin-top:5px;line-height:1.5}
.ltbk .inp{width:100%;background:var(--lt-surface);border:1px solid var(--lt-input-border);border-radius:10px;padding:10px 12px;color:var(--lt-text);font-family:inherit;font-size:14px;outline:none}
.ltbk .inp:focus{border-color:#1DB954}
.ltbk textarea.inp{min-height:70px;resize:vertical;line-height:1.5}
.ltbk select.inp{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239b99a8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.ltbk .colorrow{display:flex;gap:10px;align-items:center}
.ltbk .swatch{width:44px;height:44px;border-radius:10px;border:1px solid var(--lt-input-border);padding:0;cursor:pointer;flex:0 0 auto;overflow:hidden}
.ltbk .swatch::-webkit-color-swatch-wrapper{padding:0}
.ltbk .swatch::-webkit-color-swatch{border:none;border-radius:8px}
.ltbk .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ltbk .tpls{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ltbk .tpl{border:1px solid var(--lt-border);border-radius:12px;padding:12px 12px 11px;cursor:pointer;background:var(--lt-surface);transition:.14s}
.ltbk .tpl:hover{background:var(--lt-surface-2)}
.ltbk .tpl.on{border-color:#1DB954;box-shadow:0 0 0 1px #1DB954 inset}
.ltbk .tpl .tn{font-size:13px;font-weight:700;margin-bottom:6px}
.ltbk .tpl .th{font-size:11px;color:var(--lt-faint);line-height:1.45}
.ltbk .wire{height:46px;border-radius:7px;border:1px solid var(--lt-hairline);margin-bottom:9px;padding:7px 8px;background:var(--lt-surface-2);overflow:hidden}
.ltbk .toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--lt-hairline)}
.ltbk .toggle:first-of-type{border-top:none}
.ltbk .toggle .tl{font-size:13.5px;font-weight:600;color:var(--lt-text)}
.ltbk .toggle .td{font-size:11.5px;color:var(--lt-faint);margin-top:2px}
.ltbk .sw{width:44px;height:26px;border-radius:99px;background:var(--lt-track);border:none;cursor:pointer;position:relative;transition:.16s;flex:0 0 auto}
.ltbk .sw.on{background:#1DB954}
.ltbk .sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.16s;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
.ltbk .sw.on::after{left:21px}
.ltbk .btn{font-family:inherit;font-size:13px;font-weight:700;border-radius:10px;padding:10px 18px;cursor:pointer;border:1px solid transparent;transition:.15s}
.ltbk .btn.primary{background:#1DB954;color:#04120a;border-color:#1DB954}
.ltbk .btn.primary:disabled{opacity:.55;cursor:default}
.ltbk .btn.ghost{background:var(--lt-surface);color:var(--lt-text);border-color:var(--lt-border)}
.ltbk .btn.ghost:hover{background:var(--lt-surface-2)}
.ltbk .tabs{display:inline-flex;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:11px;padding:3px;margin-bottom:16px}
.ltbk .tabs button{font-family:inherit;font-size:13.5px;font-weight:700;padding:8px 20px;border-radius:8px;border:none;background:none;color:var(--lt-muted);cursor:pointer}
.ltbk .tabs button.on{background:#1DB954;color:#04120a}
.ltbk .logo{border:1px dashed var(--lt-input-border);border-radius:12px;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;background:var(--lt-surface);color:var(--lt-faint);font-size:12.5px;text-align:center;padding:12px;position:relative}
.ltbk .logo img{max-height:60px;max-width:180px;object-fit:contain}
.ltbk .logo .rm{position:absolute;top:6px;right:8px;font-size:11px;color:#f0516d;cursor:pointer;font-weight:600}
.ltbk .link{background:none;border:none;color:var(--lt-muted);font-size:12px;cursor:pointer;text-decoration:underline;padding:0;font-family:inherit}
.ltbk .previewwrap{position:sticky;top:20px}
.ltbk .frame{width:100%;height:640px;border:1px solid var(--lt-border);border-radius:14px;background:#fff;overflow:hidden}
.ltbk .prevhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.ltbk .actions{display:flex;gap:10px;align-items:center;margin-top:18px}
.ltbk .saved{font-size:12.5px;color:#1DB954;font-weight:600}
.ltbk .toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--lt-modal-bg);border:1px solid var(--lt-border);color:var(--lt-text);padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--lt-modal-shadow);opacity:0;pointer-events:none;transition:.28s;z-index:1300}
.ltbk .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ltbk .toast.err{border-color:rgba(240,81,109,0.5)}
.ltbk .modal{position:fixed;inset:0;background:rgba(6,5,12,0.78);backdrop-filter:blur(6px);z-index:1200;display:flex;flex-direction:column;padding:24px}
.ltbk .modal .bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.ltbk .modal .fs{flex:1;border:none;border-radius:12px;background:#fff}
@media (max-width:960px){ .ltbk .grid{grid-template-columns:1fr} .ltbk .previewwrap{position:static} .ltbk .frame{height:520px} }
`

function Toggle({ label, desc, on, onChange }) {
  return (
    <div className="toggle">
      <div><div className="tl">{label}</div>{desc && <div className="td">{desc}</div>}</div>
      <button type="button" className={`sw ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />
    </div>
  )
}

function ColorField({ label, value, placeholder, onChange, onClear }) {
  return (
    <div className="field">
      <label className="lab">{label}</label>
      <div className="colorrow">
        <input type="color" className="swatch" value={value || '#1DB954'} onChange={(e) => onChange(e.target.value)} />
        <input className="inp" value={value || ''} placeholder={placeholder || '#1DB954'} onChange={(e) => onChange(e.target.value)} />
      </div>
      {onClear && <button type="button" className="link" style={{ marginTop: 6 }} onClick={onClear}>Use brand base</button>}
    </div>
  )
}

function FontSelect({ label, value, baseLabel, onChange }) {
  return (
    <div className="field">
      <label className="lab">{label}</label>
      <select className="inp" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        {baseLabel && <option value="">{baseLabel}</option>}
        {DOC_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  )
}

export default function BrandKitPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState({})
  const [brandRow, setBrandRow] = useState(null)
  const [rawDs, setRawDs] = useState({})
  const [base, setBase] = useState({ logoUrl: null, accent: '#1DB954', headingFont: 'Playfair Display', bodyFont: 'Inter', footer: 'Thank you for your business', showPhone: true, showWebsite: true })
  const [docs, setDocs] = useState({ invoice: {}, quote: {} })
  const [tab, setTab] = useState('invoice')
  const [savingBase, setSavingBase] = useState(false)
  const [savingDoc, setSavingDoc] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const toastTimer = useRef(null)
  const baseLogoInput = useRef(null)
  const docLogoInput = useRef(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type }); clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => { if (user) load() }, [user])
  async function load() {
    setLoading(true)
    const [{ data: bk }, { data: prof }] = await Promise.all([
      supabase.from('brand_kit').select('*').eq('creative_id', user.id).maybeSingle(),
      supabase.from('profiles').select('business_name, business_email, phone, website, city, state, abn, bank_name, bank_account_name, bank_bsb, bank_account').eq('id', user.id).maybeSingle(),
    ])
    setProfile(prof || {})
    setBrandRow(bk || null)
    const ds = (bk?.document_brand_settings && typeof bk.document_brand_settings === 'object') ? bk.document_brand_settings : {}
    setRawDs(ds)
    const b = ds.base || {}
    setBase({
      logoUrl: b.logoUrl ?? bk?.logo_url ?? null,
      accent: b.accent ?? bk?.primary_color ?? '#1DB954',
      headingFont: b.headingFont ?? bk?.heading_font ?? bk?.font ?? 'Playfair Display',
      bodyFont: b.bodyFont ?? bk?.body_font ?? bk?.font ?? 'Inter',
      footer: b.footer ?? 'Thank you for your business',
      showPhone: b.showPhone !== false,
      showWebsite: b.showWebsite !== false,
    })
    setDocs({ invoice: ds.invoice || {}, quote: ds.quote || {} })
    setLoading(false)
  }

  function setDoc(key, val) { setDocs((p) => ({ ...p, [tab]: { ...p[tab], [key]: val } })) }

  async function uploadLogo(file, scope) {
    if (!file) return
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${user.id}/brand-kit/${scope}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('portfolio').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('portfolio').getPublicUrl(path)
      if (scope === 'base') setBase((b) => ({ ...b, logoUrl: data.publicUrl }))
      else setDoc('logoUrl', data.publicUrl)
      showToast('Logo uploaded')
    } catch (e) { showToast(e.message || 'Upload failed', 'error') }
    setUploading(false)
  }

  function buildDs() {
    return {
      ...rawDs,
      base: { logoUrl: base.logoUrl, accent: base.accent, headingFont: base.headingFont, bodyFont: base.bodyFont, footer: base.footer, showPhone: base.showPhone, showWebsite: base.showWebsite },
      invoice: docs.invoice,
      quote: docs.quote,
    }
  }

  async function persist(nextDs) {
    const payload = {
      creative_id: user.id,
      logo_url: base.logoUrl,
      primary_color: base.accent,
      heading_font: base.headingFont,
      body_font: base.bodyFont,
      font: base.bodyFont,
      document_brand_settings: nextDs,
    }
    const { data: existing } = await supabase.from('brand_kit').select('id').eq('creative_id', user.id).maybeSingle()
    if (existing) return supabase.from('brand_kit').update(payload).eq('creative_id', user.id)
    return supabase.from('brand_kit').insert({ ...payload, user_id: user.id })
  }

  async function saveBase() {
    setSavingBase(true)
    const ds = buildDs()
    const { error } = await persist(ds)
    setSavingBase(false)
    if (error) { showToast(error.message, 'error'); return }
    setRawDs(ds); showToast('Brand base saved')
  }
  async function saveDoc() {
    setSavingDoc(true)
    const ds = buildDs()
    const { error } = await persist(ds)
    setSavingDoc(false)
    if (error) { showToast(error.message, 'error'); return }
    setRawDs(ds); showToast(`${TABS.find((t) => t.id === tab).name} settings saved`)
  }
  function resetDoc() {
    setDocs((p) => ({ ...p, [tab]: {} }))
    showToast('Reset to brand base. Remember to save.')
  }

  // Live preview reflects unsaved edits.
  const previewHtml = useMemo(() => {
    const brand = { primary_color: base.accent, heading_font: base.headingFont, body_font: base.bodyFont, logo_url: base.logoUrl, document_brand_settings: { base: { logoUrl: base.logoUrl, accent: base.accent, headingFont: base.headingFont, bodyFont: base.bodyFont, footer: base.footer, showPhone: base.showPhone, showWebsite: base.showWebsite }, invoice: docs.invoice, quote: docs.quote } }
    const sampleDoc = {
      id: 'preview01', client_name: 'Jane Smith', client_email: 'jane@example.com', client_phone: '0400 000 000',
      amount: 1100, created_at: new Date().toISOString(),
      due_date: tab === 'invoice' ? daysFromNow(14) : daysFromNow(30),
      line_items: [{ description: 'Creative fee', quantity: 1, rate: 880 }, { description: 'Licence and usage', quantity: 1, rate: 220 }],
      notes: '',
    }
    try { return renderDocumentHtml({ type: tab, doc: sampleDoc, profile, brand }) } catch { return '<p>Preview unavailable</p>' }
  }, [base, docs, tab, profile])

  const d = docs[tab] || {}

  if (loading) return <div className="ltbk"><div style={{ padding: 40, color: 'var(--lt-faint)' }}>Loading brand kit...</div></div>

  return (
    <div className="ltbk">
      <style>{CSS}</style>

      <h1 className="title">Brand kit</h1>
      <p className="sub">Set your brand once, then fine-tune how each client document looks. Invoices and quotes are sent as branded PDFs using these settings.</p>

      <div className="grid">
        {/* LEFT: controls */}
        <div>
          <div className="h2">Brand base</div>
          <div className="card">
            <div className="field">
              <label className="lab">Logo</label>
              <div className="logo" onClick={() => baseLogoInput.current?.click()}>
                {base.logoUrl ? (<>
                  <span className="rm" onClick={(e) => { e.stopPropagation(); setBase((b) => ({ ...b, logoUrl: null })) }}>Remove</span>
                  <img src={base.logoUrl} alt="logo" />
                </>) : (<><div style={{ fontWeight: 700, color: 'var(--lt-muted)' }}>Click to upload</div><div>PNG or SVG recommended</div></>)}
              </div>
              <input ref={baseLogoInput} type="file" accept="image/*" hidden onChange={(e) => uploadLogo(e.target.files?.[0], 'base')} />
            </div>
            <ColorField label="Accent colour" value={base.accent} onChange={(v) => setBase((b) => ({ ...b, accent: v }))} />
            <div className="row2">
              <FontSelect label="Heading font" value={base.headingFont} onChange={(v) => setBase((b) => ({ ...b, headingFont: v || 'Playfair Display' }))} />
              <FontSelect label="Body font" value={base.bodyFont} onChange={(v) => setBase((b) => ({ ...b, bodyFont: v || 'Inter' }))} />
            </div>
            <div className="field">
              <label className="lab">Footer line</label>
              <input className="inp" value={base.footer} onChange={(e) => setBase((b) => ({ ...b, footer: e.target.value }))} placeholder="Thank you for your business" />
            </div>
            <div style={{ marginTop: 6 }}>
              <Toggle label="Show phone on documents" on={base.showPhone} onChange={(v) => setBase((b) => ({ ...b, showPhone: v }))} />
              <Toggle label="Show website on documents" on={base.showWebsite} onChange={(v) => setBase((b) => ({ ...b, showWebsite: v }))} />
            </div>
            <div className="hint" style={{ marginTop: 10 }}>Business name, email{profile.abn ? ', ABN' : ''} and payment details come from your profile. Update them in Settings.</div>
            <div className="actions">
              <button className="btn primary" disabled={savingBase} onClick={saveBase}>{savingBase ? 'Saving...' : 'Save brand base'}</button>
            </div>
          </div>

          <div className="h2">Per-document design</div>
          <div className="tabs">
            {TABS.map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.name}</button>)}
          </div>

          <div className="card">
            <div className="field">
              <label className="lab">Template style</label>
              <div className="tpls">
                {DOC_TEMPLATES.map((tp) => {
                  const active = (d.template || 'classic') === tp.id
                  return (
                    <div key={tp.id} className={`tpl ${active ? 'on' : ''}`} onClick={() => setDoc('template', tp.id)}>
                      <div className="wire">
                        {tp.id === 'band' && <div style={{ height: 16, borderRadius: 4, background: base.accent, marginBottom: 5 }} />}
                        {tp.id === 'classic' && <div style={{ display: 'flex', justifyContent: 'space-between' }}><div style={{ width: 30, height: 8, borderRadius: 3, background: 'var(--lt-border)' }} /><div style={{ width: 22, height: 8, borderRadius: 3, background: base.accent }} /></div>}
                        {tp.id === 'minimal' && <div style={{ borderBottom: `2px solid ${base.accent}`, paddingBottom: 4, display: 'flex', justifyContent: 'space-between' }}><div style={{ width: 26, height: 7, borderRadius: 3, background: 'var(--lt-border)' }} /><div style={{ width: 20, height: 7, borderRadius: 3, background: 'var(--lt-border)' }} /></div>}
                        <div style={{ height: 4, background: 'var(--lt-hairline)', borderRadius: 2, marginTop: 6 }} />
                        <div style={{ height: 4, background: 'var(--lt-hairline)', borderRadius: 2, marginTop: 4, width: '70%' }} />
                      </div>
                      <div className="tn">{tp.name}</div>
                      <div className="th">{tp.hint}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <ColorField label="Accent override" value={d.accent} placeholder={base.accent} onChange={(v) => setDoc('accent', v)} onClear={d.accent ? () => setDoc('accent', null) : null} />
            <div className="row2">
              <FontSelect label="Heading font" value={d.headingFont} baseLabel={`Use base (${base.headingFont})`} onChange={(v) => setDoc('headingFont', v)} />
              <FontSelect label="Body font" value={d.bodyFont} baseLabel={`Use base (${base.bodyFont})`} onChange={(v) => setDoc('bodyFont', v)} />
            </div>

            <div className="field">
              <label className="lab">Logo override</label>
              <div className="logo" style={{ minHeight: 72 }} onClick={() => docLogoInput.current?.click()}>
                {d.logoUrl ? (<><span className="rm" onClick={(e) => { e.stopPropagation(); setDoc('logoUrl', null) }}>Remove</span><img src={d.logoUrl} alt="logo" /></>) : (<div>Uses your brand base logo. Click to set a different one.</div>)}
              </div>
              <input ref={docLogoInput} type="file" accept="image/*" hidden onChange={(e) => uploadLogo(e.target.files?.[0], tab)} />
            </div>

            <div className="row2">
              <div className="field"><label className="lab">Number prefix</label><input className="inp" value={d.numberPrefix || ''} placeholder={tab === 'invoice' ? 'INV' : 'QUO'} onChange={(e) => setDoc('numberPrefix', e.target.value)} /></div>
            </div>

            <div className="field">
              <label className="lab">{tab === 'invoice' ? 'Payment terms' : 'Terms / acceptance note'}</label>
              <textarea className="inp" value={d.terms || ''} onChange={(e) => setDoc('terms', e.target.value)} placeholder={tab === 'invoice' ? 'e.g. Payment due within 14 days. A 50% deposit secures your booking.' : 'e.g. This quote is valid for 30 days. Accepting confirms your booking.'} />
            </div>

            <div style={{ marginTop: 6 }}>
              {tab === 'invoice' && <>
                <Toggle label="Show ABN" desc="Adds your ABN so it reads as a tax invoice. Optional." on={d.showAbn === true} onChange={(v) => setDoc('showAbn', v)} />
                <Toggle label="Show GST (10%)" desc="Shows a GST line, treating the total as GST inclusive." on={d.showGst === true} onChange={(v) => setDoc('showGst', v)} />
                <Toggle label="Show payment details" desc="Your bank details from Settings." on={d.showBank !== false} onChange={(v) => setDoc('showBank', v)} />
              </>}
              {tab === 'quote' && <Toggle label="Show payment details" desc="Include your bank details on quotes." on={d.showBank === true} onChange={(v) => setDoc('showBank', v)} />}
            </div>

            <div className="actions" style={{ justifyContent: 'space-between' }}>
              <button className="btn primary" disabled={savingDoc} onClick={saveDoc}>{savingDoc ? 'Saving...' : `Save ${TABS.find((t) => t.id === tab).name}`}</button>
              <button className="link" onClick={resetDoc}>Reset to brand base</button>
            </div>
          </div>
        </div>

        {/* RIGHT: live preview */}
        <div className="previewwrap">
          <div className="prevhead">
            <div className="h2" style={{ margin: 0 }}>Live preview &middot; {TABS.find((t) => t.id === tab).name}</div>
            <button className="btn ghost" onClick={() => setPreviewOpen(true)}>Full screen</button>
          </div>
          <iframe title="Document preview" className="frame" srcDoc={previewHtml} />
          {uploading && <div className="hint" style={{ marginTop: 8 }}>Uploading logo...</div>}
        </div>
      </div>

      {previewOpen && (
        <div className="modal">
          <div className="bar">
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{TABS.find((t) => t.id === tab).name} preview</div>
            <button className="btn ghost" onClick={() => setPreviewOpen(false)}>Close</button>
          </div>
          <iframe title="Full preview" className="fs" srcDoc={previewHtml} />
        </div>
      )}

      {toast && <div className={`toast show ${toast.type === 'error' ? 'err' : ''}`}>{toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}</div>}
    </div>
  )
}
