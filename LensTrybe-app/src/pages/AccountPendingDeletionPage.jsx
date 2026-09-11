import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { accountAction, downloadMyData, formatDeletionDate } from '../lib/accountData'

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'

const CSS = `
  .ltpd-page { min-height: 100vh; box-sizing: border-box; background: radial-gradient(900px 600px at 20% -10%, #14132a 0%, transparent 60%), #0a0a0f; color: #fff; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; padding: 32px 16px; }
  .ltpd-card { width: 100%; max-width: 520px; background: #14141c; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px 28px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 30px 80px -30px rgba(0,0,0,0.7); }
  .ltpd-logo { font-size: 20px; font-weight: 800; color: ${GREEN}; letter-spacing: -0.02em; }
  .ltpd-kicker { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #FF2D78; }
  .ltpd-h { margin: 0; font-size: 24px; line-height: 1.25; font-weight: 800; }
  .ltpd-p { margin: 0; font-size: 15px; line-height: 1.6; color: #b4b4c2; }
  .ltpd-date { padding: 14px 16px; border-radius: 12px; background: #1b1b26; border: 1px solid rgba(255,255,255,0.08); font-size: 14px; color: #fff; }
  .ltpd-date span { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6a6a78; margin-bottom: 3px; }
  .ltpd-row { display: flex; gap: 10px; flex-wrap: wrap; }
  .ltpd-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 18px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; min-height: 44px; }
  .ltpd-btn:disabled { opacity: .55; cursor: not-allowed; }
  .ltpd-green { background: ${GREEN}; color: ${GREEN_TEXT}; }
  .ltpd-ghost { background: rgba(255,255,255,0.06); color: #fff; border-color: rgba(255,255,255,0.14); }
  .ltpd-link { background: none; border: none; color: #9a9aa8; font-size: 13px; cursor: pointer; font-family: inherit; padding: 0; align-self: flex-start; text-decoration: underline; }
  .ltpd-msg { font-size: 13px; padding: 10px 14px; border-radius: 10px; line-height: 1.5; }
`

export default function AccountPendingDeletionPage() {
  const { user, profile, clientAccount, fetchUserData } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [msg, setMsg] = useState(null)

  const isCreative = !!profile
  const when = formatDeletionDate(isCreative ? profile?.deletion_scheduled_at : clientAccount?.deletion_scheduled_at)

  async function reactivate() {
    setBusy(true); setMsg(null)
    try {
      await accountAction('reactivate')
      await fetchUserData(user.id, { silent: true })
      navigate(isCreative ? '/dashboard' : '/client-dashboard', { replace: true })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
      setBusy(false)
    }
  }

  async function exportData() {
    setExporting(true); setMsg(null)
    try { await downloadMyData(); setMsg({ ok: true, text: 'Your download has started. Check your downloads folder for the ZIP file.' }) }
    catch (e) { setMsg({ ok: false, text: e.message }) }
    finally { setExporting(false) }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="ltpd-page">
      <style>{CSS}</style>
      <div className="ltpd-card">
        <div className="ltpd-logo">LensTrybe</div>
        <div>
          <div className="ltpd-kicker">Deletion scheduled</div>
          <h1 className="ltpd-h" style={{ marginTop: 8 }}>Your account is scheduled for deletion</h1>
        </div>
        <p className="ltpd-p">
          {isCreative
            ? 'Your profile is hidden and your paid plan has been cancelled. Reactivate now and everything will be exactly as you left it.'
            : 'Reactivate now and your account will be exactly as you left it.'}
        </p>
        {when && <div className="ltpd-date"><span>Permanent deletion on</span>{when}</div>}
        {msg && (
          <div className="ltpd-msg" style={{ background: msg.ok ? 'rgba(29,185,84,0.12)' : 'rgba(239,68,68,0.12)', color: msg.ok ? GREEN : '#ef4444' }}>{msg.text}</div>
        )}
        <div className="ltpd-row">
          <button type="button" className="ltpd-btn ltpd-green" onClick={reactivate} disabled={busy}>{busy ? 'Reactivating…' : 'Reactivate my account'}</button>
          <button type="button" className="ltpd-btn ltpd-ghost" onClick={exportData} disabled={exporting}>{exporting ? 'Preparing…' : 'Download my data'}</button>
        </div>
        <p className="ltpd-p" style={{ fontSize: 13 }}>
          {isCreative
            ? 'If you reactivate before your paid period ends, your plan continues as normal. Otherwise you will be on the free Basic plan and can choose a plan again from Settings.'
            : 'If you are happy for your account to be deleted, you do not need to do anything.'}
        </p>
        <button type="button" className="ltpd-link" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
