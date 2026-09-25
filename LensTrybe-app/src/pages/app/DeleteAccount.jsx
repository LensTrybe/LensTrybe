import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { accountAction, downloadMyData, formatDeletionDate } from '../../lib/account'

// Delete account, the live site's flow, in the workspace's own glass: what it affects (from the
// delete-account preview), the offer to download everything first, a 6-digit code emailed to
// the account address, a reason, then the date it all goes. Nothing is deleted for the grace
// period; the pending page offers Reactivate the whole time.
const REASONS = ['Too expensive', 'Not getting enough enquiries', 'Missing a feature I need', 'Using a different platform', 'Temporary break: I will be back', 'Other']
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many)

export default function DeleteAccount({ kind = 'creative', demoStore, onClose, onDeleted }) {
  const [step, setStep] = useState('info'), [preview, setPreview] = useState(null), [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [info, setInfo] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false), [reason, setReason] = useState(''), [date, setDate] = useState(null), [exporting, setExporting] = useState(false)
  useEffect(() => { let on = true; accountAction('preview').then(d => on && setPreview(d)).catch(e => on && setErr(e.message)).finally(() => on && setLoading(false)); return () => { on = false } }, [])
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !busy && step !== 'done') onClose() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [busy, step, onClose])
  const days = preview?.grace_days || 30, sub = preview?.subscription, impact = preview?.impact || {}
  const exportData = async () => { setExporting(true); setErr(''); setInfo(''); try { await downloadMyData(demoStore); setInfo('Your download has started.') } catch (e) { setErr(e.message) } finally { setExporting(false) } }
  const sendCode = async () => { setBusy(true); setErr(''); setInfo(''); try { const d = await accountAction('request_code'); setSent(true); setInfo('A 6-digit code is on its way to ' + (d.sent_to || 'your account email') + '. It lasts ' + (d.expires_minutes || 15) + ' minutes.') } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const confirm = async () => { setBusy(true); setErr(''); setInfo(''); try { const d = await accountAction('confirm', { code, reason }); setDate(d.deletion_date); setStep('done') } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <div className="sheetbk on center delbk" onMouseDown={e => { if (e.target === e.currentTarget && !busy && step !== 'done') onClose() }}>
      <div className="sheet on center del" role="dialog" aria-modal="true" aria-labelledby="del-t">
        <div className="sh-h"><div><h2 id="del-t">{step === 'done' ? 'Scheduled for deletion' : 'Delete your account'}</h2>{step === 'info' && <p>Read this first. Nothing happens until you confirm with a code.</p>}</div>{step !== 'done' && <button type="button" className="x" aria-label="Close" onClick={onClose} disabled={busy}><Icon name="x" size={14} /></button>}</div>
        <div className="sh-b"><div className="sh-body">
          {step === 'info' && <>
            {loading && <p>Working out what this affects.</p>}
            {!loading && preview?.blocked && <p className="delerr">{preview.blocked}</p>}
            {!loading && preview && !preview.blocked && <>
              <p>Here is what happens when you delete your account:</p>
              <ul className="dellist">
                {kind === 'creative' ? <>
                  <li>Straight away, your profile is hidden from search and the ask, your website goes offline and your listings are removed.</li>
                  {sub && <li>Your {cap(sub.tier)} plan is cancelled now and will not renew. Reactivate before {formatDeletionDate(sub.next_charge_date || sub.current_period_end)} and it picks up where it left off.</li>}
                  <li>After {days} days, everything is permanently deleted: portfolio, clients, quotes, invoices, contracts, messages, files and reviews.</li>
                </> : <>
                  <li>Your account is closed straight away.</li>
                  <li>After {days} days, your account, messages and saved creatives are permanently deleted.</li>
                </>}
                <li>You can change your mind any time in those {days} days by logging in and choosing Reactivate.</li>
              </ul>
              {kind === 'creative' && (impact.client_portals > 0 || impact.active_deliveries > 0 || impact.unpaid_invoices > 0 || impact.team_members > 0) && <div className="delwarn"><b>Before you go</b><ul className="dellist">
                {impact.client_portals > 0 && <li>{plural(impact.client_portals, 'client portal', 'client portals')} will stop working when the account is deleted.</li>}
                {impact.active_deliveries > 0 && <li>{plural(impact.active_deliveries, 'delivery link', 'delivery links')} will stop working. Make sure those clients have their files.</li>}
                {impact.unpaid_invoices > 0 && <li>You have {plural(impact.unpaid_invoices, 'unpaid invoice', 'unpaid invoices')}. Download copies for your records.</li>}
                {impact.team_members > 0 && <li>{plural(impact.team_members, 'team member', 'team members')} will lose the access your plan gives them.</li>}
              </ul></div>}
              <div className="delbox"><span>Want a copy of your data first? You can also do this any time in the next {days} days.</span><button type="button" className="btn g sm" onClick={exportData} disabled={exporting}>{exporting ? 'Preparing' : 'Download my data'}</button></div>
            </>}
            {err && <p className="delerr">{err}</p>}{info && <p className="delok">{info}</p>}
            <div className="delrow"><button type="button" className="btn g" onClick={onClose}>Keep my account</button>{preview && !preview.blocked && <button type="button" className="btn danger" onClick={() => { setStep('code'); setErr(''); setInfo('') }}>Continue</button>}</div>
          </>}
          {step === 'code' && <>
            <p>To make sure it is really you, a 6-digit code goes to {preview?.email_masked || 'your account email'}.</p>
            {!sent ? <div className="delrow"><button type="button" className="btn g" onClick={() => setStep('info')}>Back</button><button type="button" className="btn w" onClick={sendCode} disabled={busy}>{busy ? 'Sending' : 'Email me the code'}</button></div> : <>
              <div className="sf"><label htmlFor="del-code">The code</label><input id="del-code" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" autoFocus /></div>
              <div className="sf"><label htmlFor="del-why">Why are you leaving? <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>optional</span></label><select id="del-why" value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option>{REASONS.map(r => <option key={r}>{r}</option>)}</select></div>
              <button type="button" className="lnk" onClick={sendCode} disabled={busy}>Send a new code</button>
            </>}
            {err && <p className="delerr">{err}</p>}{info && <p className="delok">{info}</p>}
            {sent && <div className="delrow"><button type="button" className="btn g" onClick={onClose} disabled={busy}>Keep my account</button><button type="button" className="btn danger" onClick={confirm} disabled={busy || code.length !== 6}>{busy ? 'Deleting' : 'Delete my account'}</button></div>}
          </>}
          {step === 'done' && <>
            <p>Your account will be permanently deleted on <b>{formatDeletionDate(date)}</b>. The details are in your email.</p>
            <p>Changed your mind before then? Log in and choose Reactivate; everything will be exactly as you left it.</p>
            <div className="delrow"><button type="button" className="btn w" onClick={() => onDeleted?.(date)}>OK</button></div>
          </>}
        </div></div>
      </div>
    </div>
  )
}
