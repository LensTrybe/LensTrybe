import { useState } from 'react'
import { downloadMyData } from '../../lib/accountData'

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'

// Works on both dashboards: theme-aware --lt-* tokens first, older tokens as fallback.
const CSS = `
  .ltdata-card { display: flex; flex-direction: column; gap: 14px; padding: 24px; border-radius: 18px;
    background: var(--lt-glass-bg, var(--bg-elevated, #14141c)); border: var(--lt-glass-border, 1px solid rgba(255,255,255,0.08));
    box-shadow: var(--lt-glass-shadow, none); backdrop-filter: var(--lt-glass-blur, none); -webkit-backdrop-filter: var(--lt-glass-blur, none); }
  .ltdata-h { font-size: 15px; font-weight: 800; color: var(--lt-text, var(--text-primary, #fff)); }
  .ltdata-p { font-size: 13px; line-height: 1.6; color: var(--lt-muted, var(--text-muted, #9a9aa8)); margin: 0; }
  .ltdata-list { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.7; color: var(--lt-muted, var(--text-muted, #9a9aa8)); }
  .ltdata-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px;
    font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; background: ${GREEN}; color: ${GREEN_TEXT}; }
  .ltdata-btn:disabled { opacity: .55; cursor: not-allowed; }
  .ltdata-msg { font-size: 13px; padding: 10px 14px; border-radius: 10px; line-height: 1.5; }
  @media (max-width: 767px) { .ltdata-btn { min-height: 44px; } }
`

export default function DownloadDataCard({ kind = 'creative' }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      await downloadMyData()
      setMsg({ ok: true, text: 'Your download has started. Check your downloads folder for the ZIP file.' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ltdata-card">
      <style>{CSS}</style>
      <div className="ltdata-h">Download your data</div>
      <p className="ltdata-p">Get a copy of everything in your LensTrybe account as a ZIP file. Spreadsheet-friendly CSV files open in Excel, Numbers or Google Sheets.</p>
      <ul className="ltdata-list">
        {kind === 'creative' ? (
          <>
            <li>Your profile, portfolio, services and website content</li>
            <li>Clients, CRM, projects, bookings and meetings</li>
            <li>Quotes, invoices, contracts, expenses and finance records</li>
            <li>Messages, reviews, listings and team details</li>
            <li>A list of every file you have uploaded, with download links</li>
          </>
        ) : (
          <>
            <li>Your account details</li>
            <li>Your conversations and messages with creatives</li>
            <li>Jobs you have posted and creatives you have saved</li>
          </>
        )}
      </ul>
      {msg && (
        <div className="ltdata-msg" style={{ background: msg.ok ? 'rgba(29,185,84,0.12)' : 'rgba(239,68,68,0.12)', color: msg.ok ? GREEN : '#ef4444' }}>{msg.text}</div>
      )}
      <div>
        <button type="button" className="ltdata-btn" onClick={run} disabled={busy}>{busy ? 'Preparing your data…' : 'Download my data'}</button>
      </div>
    </div>
  )
}
