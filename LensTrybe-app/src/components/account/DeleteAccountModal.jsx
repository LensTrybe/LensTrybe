import { useEffect, useState } from 'react'
import { accountAction, downloadMyData, formatDeletionDate } from '../../lib/accountData'

const RED = '#ef4444'
const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'

const REASONS = ['Not getting enough work from it', 'Too expensive', 'Missing a feature I need', 'Using a different platform', 'Taking a break', 'Other']

// Works on both dashboards: theme-aware --lt-* tokens first, older tokens as fallback.
const CSS = `
  .ltdel-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(6,6,12,0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .ltdel-modal { width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; border-radius: 20px;
    background: var(--lt-modal-bg, #14141c); border: var(--lt-modal-border, 1px solid rgba(255,255,255,0.1)); box-shadow: var(--lt-modal-shadow, 0 24px 60px -20px rgba(0,0,0,0.6));
    backdrop-filter: var(--lt-modal-blur, none); -webkit-backdrop-filter: var(--lt-modal-blur, none); color: var(--lt-text, var(--text-primary, #fff)); }
  .ltdel-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px 0; }
  .ltdel-title { margin: 0; font-size: 17px; font-weight: 800; color: var(--lt-text, var(--text-primary, #fff)); }
  .ltdel-x { background: var(--lt-surface, rgba(255,255,255,0.06)); border: 1px solid var(--lt-border, rgba(255,255,255,0.1)); color: var(--lt-muted, #9a9aa8); width: 30px; height: 30px; border-radius: 9px; cursor: pointer; font-size: 13px; }
  .ltdel-body { padding: 14px 22px 22px; display: flex; flex-direction: column; gap: 16px; }
  .ltdel-p { margin: 0; font-size: 14px; line-height: 1.65; color: var(--lt-text, var(--text-primary, #fff)); }
  .ltdel-muted { font-size: 13px; line-height: 1.6; color: var(--lt-muted, var(--text-muted, #9a9aa8)); }
  .ltdel-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; font-size: 13.5px; line-height: 1.55; color: var(--lt-text, var(--text-primary, #fff)); }
  .ltdel-warn { padding: 12px 14px; border-radius: 12px; background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.28); font-size: 13px; line-height: 1.6; color: var(--lt-text, var(--text-primary, #fff)); }
  .ltdel-box { padding: 14px; border-radius: 12px; background: var(--lt-surface, rgba(255,255,255,0.05)); border: 1px solid var(--lt-border, rgba(255,255,255,0.1)); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .ltdel-row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
  .ltdel-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; white-space: nowrap; }
  .ltdel-btn:disabled { opacity: .55; cursor: not-allowed; }
  .ltdel-ghost { background: var(--lt-surface, rgba(255,255,255,0.06)); color: var(--lt-text, var(--text-primary, #fff)); border-color: var(--lt-border, rgba(255,255,255,0.12)); }
  .ltdel-danger { background: ${RED}; color: #fff; }
  .ltdel-green { background: ${GREEN}; color: ${GREEN_TEXT}; }
  .ltdel-input { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; background: var(--lt-input-bg, rgba(255,255,255,0.05)); border: 1px solid var(--lt-input-border, rgba(255,255,255,0.14)); color: var(--lt-text, var(--text-primary, #fff)); font-size: 15px; font-family: inherit; outline: none; }
  .ltdel-code { font-size: 22px; letter-spacing: 0.4em; text-align: center; font-weight: 800; }
  .ltdel-link { background: none; border: none; padding: 0; color: ${GREEN}; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .ltdel-err { font-size: 13px; padding: 10px 14px; border-radius: 10px; background: rgba(239,68,68,0.12); color: ${RED}; line-height: 1.5; }
  .ltdel-ok { font-size: 13px; padding: 10px 14px; border-radius: 10px; background: rgba(29,185,84,0.12); color: ${GREEN}; line-height: 1.5; }
  .ltdel-select { width: 100%; box-sizing: border-box; padding: 11px 13px; border-radius: 12px; background: var(--lt-input-bg, rgba(255,255,255,0.05)); border: 1px solid var(--lt-input-border, rgba(255,255,255,0.14)); color: var(--lt-text, var(--text-primary, #fff)); font-size: 14px; font-family: inherit; }
  .ltdel-select option { color: #111; }
  @media (max-width: 767px) { .ltdel-btn { min-height: 44px; } }
`

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export default function DeleteAccountModal({ open, onClose, kind = 'creative', onDeleted }) {
  const [step, setStep] = useState('info')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [reason, setReason] = useState('')
  const [deletionDate, setDeletionDate] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep('info'); setError(''); setInfo(''); setCode(''); setCodeSent(false); setReason(''); setDeletionDate(null)
    setLoading(true)
    accountAction('preview')
      .then((d) => setPreview(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === 'Escape' && !busy && step !== 'done') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, step, onClose])

  if (!open) return null

  async function exportData() {
    setExporting(true); setError(''); setInfo('')
    try { await downloadMyData(); setInfo('Your download has started.') }
    catch (e) { setError(e.message) }
    finally { setExporting(false) }
  }

  async function sendCode() {
    setBusy(true); setError(''); setInfo('')
    try {
      const d = await accountAction('request_code')
      setCodeSent(true)
      setInfo(`We've emailed a 6-digit code to ${d.sent_to}. It expires in ${d.expires_minutes || 15} minutes.`)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function confirm() {
    setBusy(true); setError(''); setInfo('')
    try {
      const d = await accountAction('confirm', { code, reason })
      setDeletionDate(d.deletion_date)
      setStep('done')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const sub = preview?.subscription
  const impact = preview?.impact || {}
  const days = preview?.grace_days || 30
  const canClose = !busy && step !== 'done'

  return (
    <div className="ltdel-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && canClose) onClose() }}>
      <style>{CSS}</style>
      <div className="ltdel-modal" role="dialog" aria-modal="true" aria-labelledby="ltdel-title">
        <div className="ltdel-head">
          <h2 id="ltdel-title" className="ltdel-title">{step === 'done' ? 'Account scheduled for deletion' : 'Delete account'}</h2>
          {canClose && <button type="button" className="ltdel-x" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="ltdel-body">
          {step === 'info' && (
            <>
              {loading && <div className="ltdel-muted">Checking your account…</div>}
              {!loading && preview?.blocked && <div className="ltdel-err">{preview.blocked}</div>}
              {!loading && preview && !preview.blocked && (
                <>
                  <p className="ltdel-p">Here's what happens when you delete your account:</p>
                  <ul className="ltdel-list">
                    {kind === 'creative' ? (
                      <>
                        <li>Straight away, your profile is hidden from search, your portfolio website goes offline and your listings are removed.</li>
                        {sub && <li>Your {cap(sub.tier)} plan is cancelled now and will not renew. If you reactivate before {formatDeletionDate(sub.next_charge_date || sub.current_period_end)}, it picks up where it left off.</li>}
                        <li>After {days} days, everything is permanently deleted: your portfolio, clients, quotes, invoices, contracts, messages, files and reviews.</li>
                      </>
                    ) : (
                      <>
                        <li>Your account is closed straight away.</li>
                        <li>After {days} days, your account, messages and saved creatives are permanently deleted.</li>
                      </>
                    )}
                    <li>You can change your mind any time in those {days} days by signing in and choosing Reactivate.</li>
                  </ul>

                  {kind === 'creative' && (impact.client_portals > 0 || impact.active_deliveries > 0 || impact.unpaid_invoices > 0 || impact.team_members > 0) && (
                    <div className="ltdel-warn">
                      <strong>Before you go:</strong>
                      <ul className="ltdel-list" style={{ marginTop: 6 }}>
                        {impact.client_portals > 0 && <li>{plural(impact.client_portals, 'client portal', 'client portals')} will stop working when your account is deleted.</li>}
                        {impact.active_deliveries > 0 && <li>{plural(impact.active_deliveries, 'delivery link', 'delivery links')} will stop working. Make sure your clients have downloaded their files.</li>}
                        {impact.unpaid_invoices > 0 && <li>You have {plural(impact.unpaid_invoices, 'unpaid invoice', 'unpaid invoices')}. Download copies for your records.</li>}
                        {impact.team_members > 0 && <li>{plural(impact.team_members, 'team member', 'team members')} will lose the access your plan gives them.</li>}
                      </ul>
                    </div>
                  )}

                  <div className="ltdel-box">
                    <div className="ltdel-muted" style={{ flex: 1, minWidth: 180 }}>Want a copy of your data first? You can also do this any time in the next {days} days.</div>
                    <button type="button" className="ltdel-btn ltdel-ghost" onClick={exportData} disabled={exporting}>{exporting ? 'Preparing…' : 'Download my data'}</button>
                  </div>
                </>
              )}
              {error && <div className="ltdel-err">{error}</div>}
              {info && <div className="ltdel-ok">{info}</div>}
              <div className="ltdel-row">
                <button type="button" className="ltdel-btn ltdel-ghost" onClick={onClose}>Keep my account</button>
                {preview && !preview.blocked && (
                  <button type="button" className="ltdel-btn ltdel-danger" onClick={() => { setError(''); setInfo(''); setStep('code') }}>Continue</button>
                )}
              </div>
            </>
          )}

          {step === 'code' && (
            <>
              <p className="ltdel-p">To make sure it's really you, we'll email a 6-digit code to {preview?.email_masked || 'your account email'}.</p>
              {!codeSent ? (
                <div className="ltdel-row" style={{ justifyContent: 'flex-start' }}>
                  <button type="button" className="ltdel-btn ltdel-green" onClick={sendCode} disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
                </div>
              ) : (
                <>
                  <input
                    className="ltdel-input ltdel-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    aria-label="6-digit code"
                  />
                  <div>
                    <div className="ltdel-muted" style={{ marginBottom: 6 }}>Why are you leaving? (optional)</div>
                    <select className="ltdel-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="">Choose a reason</option>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <button type="button" className="ltdel-link" style={{ alignSelf: 'flex-start' }} onClick={sendCode} disabled={busy}>Send a new code</button>
                </>
              )}
              {error && <div className="ltdel-err">{error}</div>}
              {info && <div className="ltdel-ok">{info}</div>}
              <div className="ltdel-row">
                <button type="button" className="ltdel-btn ltdel-ghost" onClick={onClose} disabled={busy}>Keep my account</button>
                {codeSent && (
                  <button type="button" className="ltdel-btn ltdel-danger" onClick={confirm} disabled={busy || code.length !== 6}>{busy ? 'Deleting…' : 'Delete my account'}</button>
                )}
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <p className="ltdel-p">Your account will be permanently deleted on <strong>{formatDeletionDate(deletionDate)}</strong>. We've emailed you the details.</p>
              <p className="ltdel-muted" style={{ margin: 0 }}>Changed your mind? Sign in any time before then and choose Reactivate. Everything will be exactly as you left it.</p>
              <div className="ltdel-row">
                <button type="button" className="ltdel-btn ltdel-green" onClick={() => onDeleted?.(deletionDate)}>OK</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
