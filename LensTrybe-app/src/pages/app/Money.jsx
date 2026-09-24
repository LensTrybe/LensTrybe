import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice } from '../../lib/store'
import { fmt } from '../../lib/format'
import Chart from './Chart'

// One ledger, five doors. Finance hub shows all of it; Invoicing, Quotes, Contracts and Expenses
// are the same ledger with one kind in focus, so nothing lives in two places.
const KIND = {
  money: { h: 'Finance hub', p: 'Everything in and out, one ledger. GST handled, Xero synced nightly.', kinds: null, tabs: [['all', 'All'], ['inv', 'Invoices'], ['q', 'Quotes'], ['c', 'Contracts'], ['exp', 'Expenses']], cta: 'New quote', mk: 'q' },
  invoicing: { h: 'Invoicing', p: 'Invoices from quotes, branded, paid by card or transfer, chased on their own.', kinds: ['inv'], tabs: [['all', 'All'], ['open', 'Open'], ['paid', 'Paid']], cta: 'New invoice', mk: 'inv' },
  quotes: { h: 'Quotes', p: 'Quotes from your packages that clients accept on their phone.', kinds: ['q'], tabs: [['all', 'All'], ['open', 'Waiting'], ['accepted', 'Accepted']], cta: 'New quote', mk: 'q' },
  contracts: { h: 'Contracts', p: 'Plain English contracts from your templates, signed on their phone. Your own paper files here too.', kinds: ['c'], tabs: [['all', 'All'], ['draft', 'Drafts'], ['sent', 'Waiting'], ['signed', 'Signed'], ['uploaded', 'Uploaded'], ['templates', 'Templates']], cta: 'New contract', mk: 'c' },
  expenses: { h: 'Expenses', p: 'Every deductible dollar, with the receipt, tagged to a project and ready for tax time.', kinds: ['exp'], tabs: [['all', 'All']], cta: 'Add expense', mk: 'exp' },
}
const IC = { inv: 'dollar', q: 'file', c: 'fileCheck', exp: 'receipt' }
const month = TODAY.slice(0, 7)
const FY0 = Number(TODAY.slice(0, 4)) - (Number(TODAY.slice(5, 7)) >= 7 ? 0 : 1) // Australian financial year starts 1 July
const fyOf = y => ({ a: y + '-07-01', b: (y + 1) + '-06-30', l: 'FY ' + y + '–' + String(y + 1).slice(2) })

export default function Money({ kind = 'money' }) {
  const K = KIND[kind]; const F = useFlows(); const { s, nav } = F
  const [sp, setSp] = useSearchParams(); const file = useRef()
  const [f, setF] = useState(sp.get('tab') || 'all'), [q, setQ] = useState('')
  const [fy, setFy] = useState(FY0); const FY = fyOf(fy)
  const L = s.ledger, TPL = s.contractTemplates || [], EC = s.expCats || []
  const tabs = kind === 'expenses' ? [['all', 'All'], ...EC.map(c => [c[0], c[0]])] : K.tabs
  const rows = useMemo(() => L.filter(r => !K.kinds || K.kinds.includes(r.k)).filter(r => kind !== 'expenses' || (r.date >= FY.a && r.date <= FY.b)).filter(r => {
    if (f === 'all') return true
    if (kind === 'money') return r.k === f
    if (f === 'open') return r.st !== 'ok'
    if (f === 'paid' || f === 'accepted') return r.st === 'ok'
    if (f === 'draft') return r.st === 'grey' && !r.up
    if (f === 'sent') return r.st === 'sent'
    if (f === 'signed') return r.st === 'pink'
    if (f === 'uploaded') return !!r.up
    if (f === 'templates') return false
    return r.cat === f
  }).filter(r => !q || (r.id + r.who + r.d + (r.cat || '') + (r.notes || '')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.date < b.date ? 1 : -1), [L, K, f, q, kind, FY])
  const sum = a => a.reduce((t, r) => t + r.v, 0)
  const paidRows = L.filter(r => r.k === 'inv' && r.st === 'ok' && r.date.startsWith(month)), paid = 9840 - 2100 + sum(paidRows) // two cash jobs plus what is in the ledger
  const owed = L.filter(r => r.k === 'inv' && r.st !== 'ok'), quoted = L.filter(r => r.k === 'q' && r.st !== 'ok'), exps = L.filter(r => r.k === 'exp'), spent = exps.filter(r => r.date.startsWith(month)).reduce((t, r) => t - r.v, 0)
  const drafts = L.filter(r => r.k === 'c' && r.st === 'grey'), signed = L.filter(r => r.k === 'c' && r.st === 'pink')
  const cat = c => exps.filter(r => r.cat === c).reduce((t, r) => t - r.v, 0)
  const fyExps = exps.filter(r => r.date >= FY.a && r.date <= FY.b), fySpend = fyExps.reduce((t, r) => t - r.v, 0), fyGst = fyExps.filter(r => r.gst !== false).reduce((t, r) => t - r.v / 11, 0), fyDed = fyExps.filter(r => r.ded !== false).reduce((t, r) => t - r.v, 0)
  const went = EC.map(c => ({ n: c[0], c: c[1], v: fyExps.filter(r => r.cat === c[0]).reduce((t, r) => t - r.v, 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v), wentMax = went[0]?.v || 1
  const projName = id => { const p = s.projects.find(x => x.id === id); return p ? p.n.split(' · ')[0] : '' }
  const nextDue = owed.slice().sort((a, b) => a.date < b.date ? -1 : 1)[0]
  const tiles = kind === 'money' ? [['Paid this month', fmt(paid), paidRows.length + 2 + ' invoices · ▲ 18% on August', ''], ['Owed to you', fmt(sum(owed)), owed.length + (owed.length === 1 ? ' invoice' : ' invoices') + (nextDue ? ', due ' + nice(nextDue.date) : ''), owed.length ? 'w' : ''], ['Quoted, waiting', fmt(sum(quoted)), quoted.length + ' quotes open', 'n'], ['GST set aside', fmt(Math.round(paid / 11)), 'BAS due 28 Oct', '']]
    : kind === 'invoicing' ? [['Paid this month', fmt(paid), paidRows.length + 2 + ' invoices · ▲ 18% on August', ''], ['Owed to you', fmt(sum(owed)), nextDue ? 'due ' + nice(nextDue.date) : 'nothing open', owed.length ? 'w' : ''], ['Average days to paid', '3.2', 'down from 6 in August', ''], ['Chased by Lumi', String(L.filter(r => r.stt === 'Chased').length + 2), 'both paid within a day', 'n']]
    : kind === 'quotes' ? [['Waiting', fmt(sum(quoted)), quoted.length + ' quotes', quoted.length ? 'w' : ''], ['Accepted this quarter', fmt(9226 + sum(L.filter(r => r.k === 'q' && r.st === 'ok'))), (5 + L.filter(r => r.k === 'q' && r.st === 'ok').length) + ' of ' + (7 + L.filter(r => r.k === 'q').length - 2) + ' sent', ''], ['Acceptance rate', '71%', 'up from 60%', ''], ['Average to accept', '1.8 days', 'viewed within an hour', 'n']]
    : kind === 'contracts' ? [['Signed this year', String(9 + signed.length), 'all on a phone', ''], ['Drafts', String(drafts.length), drafts[0] ? drafts[0].who + ', ready to send' : 'none waiting', drafts.length ? 'w' : ''], ['Templates', String(TPL.length), TPL.slice(0, 3).map(t => t.n.split(' ·')[0].split(',')[0]).join(' · '), 'n'], ['Average to sign', '4 hours', 'sent with the quote', '']]
    : [['Total spend', fmt(Math.round(fySpend)), FY.l, '', 'rose'], ['GST paid', fmt(Math.round(fyGst)), 'claimable on BAS', '', 'amber'], ['Deductible', fmt(Math.round(fyDed)), 'reduces taxable income', '', 'green'], ['Logged', String(fyExps.length), fyExps.length === 1 ? 'expense this year' : 'expenses this year', '', 'blue']]
  return (
    <section className="view">
      <div className="vh">
        <div><h1>{K.h}</h1><p>{K.p}</p></div>
        <div className="acts">{kind === 'expenses' && <div className="fypick"><button type="button" aria-label="Previous year" onClick={() => setFy(fy - 1)}><Icon name="back" size={13} /></button><span>{FY.l}</span><button type="button" aria-label="Next year" disabled={fy >= FY0} onClick={() => setFy(fy + 1)}><Icon name="chev" size={13} /></button></div>}<button className="btn g" onClick={() => F.exportCsv(rows, kind)}><Icon name="deliver" size={15} />Export</button>{kind === 'contracts' && <><input ref={file} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" hidden onChange={e => { const fl = e.target.files?.[0]; e.target.value = ''; if (fl) F.uploadContract(fl) }} /><button className="btn g" onClick={() => file.current?.click()}><Icon name="folder" size={15} />Upload contract</button></>}{kind !== 'money' && <button className="btn w" onClick={() => F.newDoc(K.mk)}><Icon name="plus" size={15} />{K.cta}</button>}</div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">{tiles.map(([l, v, e, w, c]) => <div key={l} className={'k lg' + (c ? ' acc ' + c : '')}>{c && <i className="accb" />}<small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>

        <div className="card lg s8">
          <div className="h">
            <div className="tfilt" style={{ padding: 0 }}>{tabs.map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => { setF(k); if (kind === 'contracts') setSp(k === 'all' ? {} : { tab: k }, { replace: true }) }}>{l}</button>)}{kind === 'expenses' && <>{f !== 'all' && <button type="button" className="addcat edit" onClick={() => F.editExpCat(f, n => setF(n === 'All' ? 'all' : n))}><Icon name="edit" size={12} />Edit {f}</button>}<button type="button" className="addcat" onClick={() => F.editExpCat(null, n => setF(n))}><Icon name="plus" size={12} />Category</button></>}</div>
            <label className="tsearch" style={{ margin: 0, height: 34, width: 220 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find" aria-label="Search the ledger" /></label>
          </div>
          {f === 'templates' ? <div className="ledger tpll">
            {TPL.map(t => <div key={t.id} className="lr go" onClick={() => F.newDoc('c', { tpl: t.id })}>
              <span className="ic"><Icon name="doc" size={15} /></span>
              <div><b>{t.n}</b><small>{t.clauses.length} clauses{t.sub ? ' · ' + t.sub : ''}</small></div>
              <small className="dt">{L.filter(r => r.k === 'c' && r.doc?.template === t.id).length || ''}{L.filter(r => r.k === 'c' && r.doc?.template === t.id).length ? ' sent' : ''}</small>
              <span className="acts2" onClick={e => e.stopPropagation()}><button className="act2" onClick={() => F.editTemplate(t.id)}>Rename</button><button className="act2" onClick={() => F.newDoc('c', { tpl: t.id })}>Use</button></span>
            </div>)}
            <div className="tempty">Open any contract and tap <b>Save this as a template</b> to add one. <button className="lnk" onClick={() => F.newDoc('c')}>Start a contract</button></div>
          </div> : <div className="ledger">
            {rows.map(r => (
              <div key={r.id} className={'lr' + (r.t ? ' go' : '')} onClick={() => F.openDoc(r)}>
                <span className="ic"><Icon name={r.up ? 'folder' : IC[r.k]} size={15} /></span>
                <div><b>{r.who}</b><small>{r.id}{r.k === 'exp' ? <> · <i className={'cdot ' + (EC.find(c => c[0] === r.cat)?.[1] || 'grey')} />{r.cat}{r.d && ' · ' + r.d}{r.proj && projName(r.proj) && ' · ' + projName(r.proj)}{r.ded === false && <em className="nd"> · not deductible</em>}</> : <> · {r.d}</>}{r.up && <> · {r.up.name}</>}{r.sched?.length > 1 && <> · deposit {fmt(r.sched[0][1])} {nice(r.sched[0][2])}, balance {nice(r.sched[1][2])}</>}</small></div>
                <small className="dt">{nice(r.date)}</small>
                {r.k === 'exp' ? <span className="gstc" title="GST in this expense">{r.gst === false ? '—' : 'GST ' + fmt(Math.round(-r.v / 11))}</span> : <span className={'st ' + r.st}>{r.stt}</span>}
                <span className={'amt' + (r.v < 0 ? ' neg' : '')}>{r.v < 0 ? '−' + fmt(-r.v) : r.v ? fmt(r.v) : '—'}</span>
                <span className="acts2" onClick={e => e.stopPropagation()}>
                  {r.k === 'inv' && r.st !== 'ok' && <button className="act2" onClick={() => F.markPaid(r.id)}>Paid</button>}
                  {r.k === 'q' && r.st !== 'ok' && <button className="act2" onClick={() => F.markAccepted(r.id)}>Accepted</button>}
                  {r.k === 'c' && r.st === 'sent' && <button className="act2" onClick={() => F.markSigned(r.id)}>Signed</button>}
                  {r.k === 'exp' && <button className={'act2 ic' + (r.rcpt ? ' has' : '')} title={r.rcpt ? 'View receipt' : 'No receipt'} aria-label="Receipt" onClick={() => r.rcpt ? F.openReceipt(r) : F.editExpense(r.id)}><Icon name="image" size={13} /></button>}
                  {r.up ? <button className="act2" onClick={() => F.downloadUpload(r)}>Download</button> : <button className="act2" onClick={() => F.docAction(r)}>{F.docActionLabel(r)}</button>}
                </span>
              </div>
            ))}
            {!rows.length && <div className="tempty">Nothing here yet. <button className="lnk" onClick={() => f === 'uploaded' ? file.current?.click() : F.newDoc(K.mk)}>{f === 'uploaded' ? 'Upload a contract' : K.cta}</button></div>}
          </div>}
        </div>

        <div className="s4 side">
          {kind === 'money' && <div className="card lg"><div className="h"><b>Money this year</b><Link to="/app/tax">Tax hub <Icon name="arrow" size={12} /></Link></div><Chart id="m" /></div>}
          <div className="card lg"><div className="h"><b>{kind === 'expenses' ? 'Where your money went' : 'Owed to you'}</b>{kind === 'expenses' ? <span className="mute">{FY.l}</span> : <Link to="/app/invoicing">Invoices <Icon name="arrow" size={12} /></Link>}</div>
            {kind === 'expenses' ? <div className="went">{went.map(x => <button type="button" key={x.n} className={'wr' + (f === x.n ? ' on' : '')} onClick={() => setF(f === x.n ? 'all' : x.n)}><span className="wl"><i className={'cdot ' + x.c} />{x.n}</span><b>{fmt(Math.round(x.v))}</b><span className="bar"><i className={x.c} style={{ width: (x.v / wentMax * 100) + '%' }} /></span></button>)}{!went.length && <p className="tempty">Nothing logged in {FY.l} yet.</p>}</div>
              : <div className="tl">{owed.map(r => <div key={r.id} className="e" onClick={() => nav('/app/thread/' + r.t)}><span className="t">{nice(r.date)}</span><div><b>{r.who}</b><small>{r.id} · {r.d}{r.sched?.length > 1 && <> · deposit {fmt(r.sched[0][1])} {nice(r.sched[0][2])}, balance {nice(r.sched[1][2])}</>}</small></div><span className="st sent">{fmt(r.v)}</span></div>)}{!owed.length && <p className="tempty">Nothing outstanding.</p>}</div>}
          </div>
          {kind === 'expenses'
            ? <div className="tlumi"><span className="lm" /><div>{fyExps.filter(r => !r.rcpt).length ? fyExps.filter(r => !r.rcpt).length + ' of ' + fyExps.length + ' expenses this year have no receipt. Snap them on your phone and I file them against the right one.' : 'Every expense this year has its receipt. Tax time will be quick.'}{fyExps.some(r => !r.rcpt) && <div className="acts"><button className="y" onClick={() => F.editExpense(fyExps.find(r => !r.rcpt).id)}>Attach one now</button></div>}</div></div>
            : quoted.some(r => r.stt?.startsWith('Viewed')) ? <div className="tlumi"><span className="lm" /><div>{owed.length ? '' : 'Nothing is overdue. '}{quoted.find(r => r.stt?.startsWith('Viewed')).who}'s quote has been viewed without a reply. Want a friendly nudge in your words?<div className="acts"><button className="y" onClick={() => F.nudge(quoted.find(r => r.stt?.startsWith('Viewed')).t)}>Send nudge</button><button onClick={() => F.wait(quoted.find(r => r.stt?.startsWith('Viewed')).t)}>Leave it</button></div></div></div>
            : <div className="tlumi"><span className="lm" /><div>Nothing needs you here. {owed.length ? 'I chase from day 3, in your words.' : 'Nothing is overdue.'}</div></div>}
        </div>
      </div>
    </section>
  )
}
