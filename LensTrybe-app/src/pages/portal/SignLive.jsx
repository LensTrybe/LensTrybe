import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { TokenShell, TokenState, Loading, NotOurs } from './TokenShell'
import { loadSigning, signContract, when, nice, isUuid } from '../../lib/live'
import { downloadDocumentPdf } from '../../backend/downloadDocumentPdf'

// /sign/:token — the client reads and signs. Same rules as the live site: the token is the key
// (contract_for_signing), a tick plus a button signs (sign_contract), the creative is emailed
// (notify-contract-signed), and a signed copy is a PDF away. A contract written as text shows here;
// one uploaded as a file opens through a one-hour link from contract-file.
export default function SignLive() {
  const { token } = useParams()
  const [d, setD] = useState(undefined), [agree, setAgree] = useState(false), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [just, setJust] = useState(false)
  useEffect(() => { let on = true; if (!isUuid(token)) return setD(null); loadSigning(token).then(x => on && setD(x)).catch(() => on && setD(null)); return () => { on = false } }, [token])
  if (d === undefined) return <Loading text="Opening your contract." />
  if (d === null) return <NotOurs what="contract link" />
  const c = d.contract, signed = ['signed', 'completed'].includes(String(c.status || '').toLowerCase())
  const sign = async () => { if (!agree || busy) return; setBusy('sign'); setErr(''); try { const r = await signContract(token, c.id); setD(x => ({ ...x, contract: { ...x.contract, status: 'signed', signed_at: r?.signed_at || new Date().toISOString() } })); setJust(true) } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const pdf = async () => { setBusy('pdf'); setErr(''); try { await downloadDocumentPdf({ type: 'contract', id: c.id, signingToken: token }) } catch (e) { setErr(e.message || 'Could not make the PDF.') } finally { setBusy('') } }
  return (
    <TokenShell creative={d.creative} sub="Contract for signing">
      <div className="pjob lg tdoc">
        <div className="pjhead"><div><p className="eb g">{signed ? 'Signed' : 'To sign'}</p><h1>{c.title || 'Contract'}</h1><p className="sub">{[c.project_name, c.project_date ? nice(String(c.project_date).slice(0, 10)) : null, c.contract_type].filter(Boolean).join(' · ') || 'From ' + d.business}</p></div>
          <div className="pnext"><small>{signed ? 'Signed' : 'Between'}</small><b>{signed ? when(c.signed_at) : (c.client_name || 'You') + ' and ' + d.business}</b>{!signed && c.client_email && <span>{c.client_email}</span>}</div></div>
        {d.fileUrl ? <a className="pcard lg" href={d.fileUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><i className="pk"><Icon name="doc" size={13} /></i><div><b>Open the contract</b><small>Opens in a new tab. The link lasts an hour; reload this page for a fresh one.</small></div><span className="pbtn">Open <Icon name="out" size={12} /></span></a>
          : c.contract_file_url ? <div className="tsys">Preparing the contract file. If nothing appears, reload the page.</div>
          : <div className="tread" aria-label="Contract text">{String(c.content || '').split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
        {c.notes && <p className="fine">{c.notes}</p>}
        {signed ? <div className="tdone"><span className="tick"><Icon name="check" size={16} /></span><div><b>{just ? 'Signed. Thank you.' : 'This contract is signed.'}</b><small>{d.business} has {just ? 'been told' : 'a copy'}. Download yours any time from this link.</small></div></div>
          : <label className="tagree"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} disabled={!!busy} /><span>I{c.client_name ? ', ' + c.client_name + ',' : ''} have read this contract and agree to its terms. Ticking this and pressing Sign is my signature.</span></label>}
        {err && <p className="fine" style={{ color: 'var(--pink-t)' }}>{err}</p>}
        <div className="trow">
          {!signed && <button className="btn p" onClick={sign} disabled={!agree || !!busy}>{busy === 'sign' ? 'Signing' : 'Sign contract'} <Icon name="arrow" size={14} /></button>}
          {!c.contract_file_url && <button className="btn g" onClick={pdf} disabled={!!busy}>{busy === 'pdf' ? 'Preparing PDF' : signed ? 'Download signed copy (PDF)' : 'Download a copy (PDF)'}</button>}
        </div>
      </div>
      <p className="fine" style={{ textAlign: 'center', marginTop: 18 }}>Questions about the wording? Reply to the email it came in and {d.business} will see it. <Link to="/" style={{ color: 'var(--green-t)' }}>lenstrybe.com</Link></p>
    </TokenShell>
  )
}
