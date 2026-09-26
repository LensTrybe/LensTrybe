import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { fmt } from '../../lib/format'
import { LIVE } from '../../lib/mode'
import { TODAY, nice } from '../../lib/store'
import * as live from '../../lib/live'

// Tax hub: GST, BAS and end of year, worked out from the ledger you already keep. Nothing to enter twice.
const Q = [
  { id: 'q1', n: 'Jul to Sep 2026', due: '28 Oct', st: 'open', inc: 24140, exp: 3860, gstIn: 2195, gstOut: 351 },
  { id: 'q4', n: 'Apr to Jun 2026', due: '28 Jul', st: 'lodged', inc: 19800, exp: 4120, gstIn: 1800, gstOut: 375 },
  { id: 'q3', n: 'Jan to Mar 2026', due: '28 Apr', st: 'lodged', inc: 16200, exp: 2980, gstIn: 1473, gstOut: 271 },
  { id: 'q2', n: 'Oct to Dec 2025', due: '28 Feb', st: 'lodged', inc: 21300, exp: 5200, gstIn: 1936, gstOut: 473 },
]
const CATS = [['Gear', 1780, 'Cards, tripod plate, batteries'], ['Travel', 940, '1,068 km at 88c'], ['Software', 610, 'Adobe, LensTrybe, Pixieset legacy'], ['Insurance', 380, 'Gear and public liability'], ['Marketing', 150, 'Prints for the café wall']]

export default function Tax() { return LIVE ? <TaxLive /> : <TaxDemo /> }

function TaxDemo() {
  const F = useFlows(); const { s, toast } = F
  const [sel, setSel] = useState('q1')
  // this quarter is live: what is in the ledger since 1 July moves the numbers
  const ledgerInc = s.ledger.filter(r => r.k === 'inv' && r.st === 'ok' && r.date >= '2026-07-01').reduce((t, r) => t + r.v, 0)
  const ledgerExp = s.ledger.filter(r => r.k === 'exp' && r.date >= '2026-07-01').reduce((t, r) => t - r.v, 0)
  const Qs = Q.map(x => x.id === 'q1' ? { ...x, inc: 20560 + ledgerInc, exp: 3531 + ledgerExp, gstIn: Math.round((20560 + ledgerInc) / 11), gstOut: Math.round((3531 + ledgerExp) / 11), st: s.settings.basLodged ? 'lodged' : 'open' } : x)
  const q = Qs.find(x => x.id === sel), net = q.gstIn - q.gstOut
  const YEAR = { inc: Qs[0].inc, exp: Qs[0].exp, put: Math.round(Qs[0].inc * 0.25) }
  const rate = s.settings.setAside || 30
  const byCat = CATS.map(([n, v, d]) => [n, v + s.ledger.filter(r => r.k === 'exp' && r.cat === n && r.created).reduce((t, r) => t - r.v, 0), d])
  const csv = () => { const rows = s.ledger.filter(r => r.date >= '2026-07-01').map(r => [r.id, r.k, r.who, r.d, r.date, r.stt, r.v].map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['id,kind,who,description,date,status,amount\n' + rows], { type: 'text/csv' })); a.download = 'bas-' + q.id + '-2026.csv'; a.click() }
  const sendPack = () => F.open({ title: 'Send to your accountant', sub: 'The quarter pack: every line with the invoice behind it, as CSV and PDF.', cta: 'Send', fields: [{ k: 'em', l: 'Accountant', type: 'email', required: true, value: s.settings.accountant || '' }, { k: 'q', l: 'Quarter', type: 'select', value: q.id, options: Qs.map(x => [x.id, x.n]) }, { k: 'remind', l: 'Remind me on the 21st', type: 'toggle', value: true }, { k: 'note', l: 'A note', type: 'textarea', rows: 2 }], submit: v => { F.patch('settings', { accountant: v.em, basReminder: v.remind ? '2026-10-21' : '' }); toast('Pack sent to ' + v.em + (v.remind ? '. Reminder set for 21 Oct.' : '.')) } })
  const prepare = () => F.open({ title: 'Prepare BAS · ' + q.n, sub: 'Check the four numbers, then lodge in myGov or through your accountant.', cta: 'Mark as lodged', body: <div className="kvs"><div className="kv"><span>G1 Sales incl. GST</span><b>{fmt(q.inc)}</b></div><div className="kv"><span>1A GST on sales</span><b>{fmt(q.gstIn)}</b></div><div className="kv"><span>G11 Purchases</span><b>{fmt(q.exp)}</b></div><div className="kv"><span>1B GST on purchases</span><b>{fmt(q.gstOut)}</b></div><div className="kv tot"><span>Net GST to pay</span><b>{fmt(net)}</b></div></div>, alt: { l: 'Download worksheet', on: () => { csv(); toast('Worksheet downloaded.'); return false } }, submit: () => { F.patch('settings', { basLodged: true }); toast(q.n + ' marked as lodged. ' + fmt(net) + ' due 28 Oct.') } })
  const changeRate = () => F.open({ title: 'Set aside', sub: 'Every time a client pays, this much goes to the tax note on the ledger.', cta: 'Save', fields: [{ k: 'rate', l: 'Percent of every payment', type: 'number', value: rate, min: 0, max: 60, required: true }], submit: v => { F.patch('settings', { setAside: v.rate }); toast('Set aside changed to ' + v.rate + '%.') } })
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Tax hub</h1><p>GST, BAS and end of year from the ledger you already keep. Nothing entered twice.</p></div>
        <div className="acts"><button className="btn g" onClick={sendPack}><Icon name="deliver" size={15} />Send to accountant</button><button className="btn w" onClick={prepare}>{q.st === 'open' ? 'Prepare BAS' : 'BAS lodged'} <Icon name={q.st === 'open' ? 'arrow' : 'check'} size={14} /></button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['GST to pay this quarter', fmt(Qs[0].gstIn - Qs[0].gstOut), Qs[0].st === 'open' ? 'BAS due 28 Oct' : 'Lodged', Qs[0].st === 'open' ? 'w' : ''], ['Set aside so far', fmt(Math.round(Qs[0].inc * rate / 100 * 0.42)), 'covers the BAS, the rest toward income tax', ''], ['Claimable this year', fmt(YEAR.exp), 'across 5 categories', 'n'], ['Income, financial year', fmt(YEAR.inc), 'since 1 July', '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s7">
          <div className="h"><b>Quarters</b><Link to="/app/money">Finance hub <Icon name="arrow" size={12} /></Link></div>
          <div className="qs">
            {Qs.map(x => <button key={x.id} type="button" className={'qr' + (sel === x.id ? ' on' : '')} onClick={() => setSel(x.id)}>
              <div className="tx"><b>{x.n}</b><small>BAS due {x.due}</small></div>
              <div className="qn"><small>Income</small><b>{fmt(x.inc)}</b></div>
              <div className="qn"><small>Expenses</small><b>{fmt(x.exp)}</b></div>
              <div className="qn"><small>GST net</small><b>{fmt(x.gstIn - x.gstOut)}</b></div>
              <span className={'st ' + (x.st === 'open' ? 'viewed' : 'ok')}>{x.st === 'open' ? 'Open' : 'Lodged'}</span>
            </button>)}
          </div>
          <div className="h" style={{ marginTop: 22 }}><b>Expenses by category · this year</b><Link to="/app/expenses">Expenses <Icon name="arrow" size={12} /></Link></div>
          <div className="cats">
            {byCat.map(([n, v, d]) => <div key={n} className="cat" style={{ cursor: 'pointer' }} onClick={() => F.nav('/app/expenses')}><div className="r"><b>{n}</b><span>{fmt(v)}</span></div><div className="bar"><i style={{ width: (v / Math.max(...byCat.map(c => c[1])) * 100) + '%' }} /></div><small>{d}</small></div>)}
          </div>
        </div>

        <div className="s5 side">
          <div className="card lg">
            <div className="h"><b>{q.n}</b><span className={'st ' + (q.st === 'open' ? 'viewed' : 'ok')}>{q.st === 'open' ? 'Open · due ' + q.due : 'Lodged'}</span></div>
            <div className="kv"><span>Sales incl. GST (G1)</span><b>{fmt(q.inc)}</b></div>
            <div className="kv"><span>GST on sales (1A)</span><b>{fmt(q.gstIn)}</b></div>
            <div className="kv"><span>Purchases (G11)</span><b>{fmt(q.exp)}</b></div>
            <div className="kv"><span>GST on purchases (1B)</span><b>{fmt(q.gstOut)}</b></div>
            <div className="kv tot"><span>Net GST {net >= 0 ? 'to pay' : 'refund'}</span><b>{fmt(Math.abs(net))}</b></div>
            {q.id === 'q1' && q.st === 'open' && <p className="note2" style={{ marginTop: 10 }}>Eight days of the quarter left. Coastline's quote and the Northshore shoot would land inside it if accepted.</p>}
            <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              <button className="btn w sm" onClick={() => { csv(); toast('BAS worksheet downloaded.') }}>Download worksheet</button>
              <Link className="btn g sm" to="/app/money">See the lines</Link>
            </div>
          </div>
          <div className="card lg">
            <div className="h"><b>Set aside</b><small className="lumi-by">{rate}% of every payment</small></div>
            <p className="note2">Every time a client pays, {rate} percent goes to a note on the ledger and the rest is yours. {fmt(Math.round(Qs[0].inc * rate / 100 * 0.42))} is set aside against {fmt(Qs[0].gstIn - Qs[0].gstOut)} due on 28 Oct, and the year's income tax estimate is {fmt(YEAR.put)}.</p>
            <div className="bar2"><i style={{ width: Math.min(100, Math.round(Qs[0].inc * rate / 100 * 0.42 / (YEAR.put + (Qs[0].gstIn - Qs[0].gstOut)) * 100)) + '%' }} /></div>
            <div className="ctas" style={{ display: 'flex', gap: 6, marginTop: 12 }}><button className="btn g sm" onClick={changeRate}>Change the rate</button><Link className="btn g sm" to="/app/settings">Connect a bank</Link></div>
          </div>
          {!s.settings.basReminder && <div className="tlumi"><span className="lm" /><div>Your BAS is due in five weeks. Everything in it is from the ledger, so the worksheet is ready now. Want me to send the quarter pack to your accountant and remind you on the 21st?<div className="acts"><button className="y" onClick={sendPack}>Send and remind</button><button onClick={() => toast("I'll ask again on 14 Oct.")}>Not yet</button></div></div></div>}
        </div>
      </div>
    </section>
  )
}

// ── Live: every number from the ledger (paid invoices, logged expenses). Australian quarters, BAS due
// on the 28th of the month after (Oct, Feb, Apr, Jul). GST only when the creative is registered.
const pad2 = n => String(n).padStart(2, '0')
const QDUE = { 7: [10, 28], 10: [2, 28], 1: [4, 28], 4: [7, 28] }
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function quarterOf(y, m) { const s0 = m >= 7 ? (m >= 10 ? 10 : 7) : (m >= 4 ? 4 : 1); const e = s0 + 2; const [dm, dd] = QDUE[s0]; const dy = s0 === 10 ? y + 1 : y; return { id: y + '-' + pad2(s0), a: y + '-' + pad2(s0) + '-01', b: y + '-' + pad2(e) + '-' + (e === 9 || e === 6 ? '30' : '31'), n: MN[s0 - 1] + ' to ' + MN[e - 1] + ' ' + y, due: dy + '-' + pad2(dm) + '-' + pad2(dd) } }
function lastQuarters(n) { const out = []; let y = Number(TODAY.slice(0, 4)), m = Number(TODAY.slice(5, 7)); for (let i = 0; i < n; i++) { const q = quarterOf(y, m); out.push(q); const s0 = Number(q.a.slice(5, 7)) - 3; if (s0 < 1) { y -= 1; m = s0 + 12 } else m = s0 } return out }

function TaxLive() {
  const F = useFlows(); const { s, toast, me } = F
  const gst = !!s.settings.gstReg, rate = s.settings.setAside || 30, lodged = s.settings.lodged || {}
  const QS = lastQuarters(4).map(q => {
    const inv = s.ledger.filter(r => r.k === 'inv' && r.st === 'ok' && r.date >= q.a && r.date <= q.b), exp = s.ledger.filter(r => r.k === 'exp' && r.date >= q.a && r.date <= q.b)
    const inc = inv.reduce((t, r) => t + r.v, 0), ex = exp.reduce((t, r) => t - r.v, 0)
    return { ...q, inv, exp, inc, ex, gstIn: gst ? Math.round(inc / 11 * 100) / 100 : 0, gstOut: gst ? Math.round(exp.filter(r => r.gst !== false).reduce((t, r) => t - r.v, 0) / 11 * 100) / 100 : 0, st: lodged[q.id] ? 'lodged' : q.b >= TODAY ? 'open' : q.due >= TODAY ? 'due' : 'past' }
  })
  const [sel, setSel] = useState(QS[0].id); const q = QS.find(x => x.id === sel) || QS[0], net = q.gstIn - q.gstOut
  const fy0 = Number(TODAY.slice(5, 7)) >= 7 ? Number(TODAY.slice(0, 4)) : Number(TODAY.slice(0, 4)) - 1, FA = fy0 + '-07-01', FB = (fy0 + 1) + '-06-30', FYL = 'FY ' + fy0 + '–' + String(fy0 + 1).slice(2)
  const fyInc = s.ledger.filter(r => r.k === 'inv' && r.st === 'ok' && r.date >= FA && r.date <= FB).reduce((t, r) => t + r.v, 0)
  const fyExp = s.ledger.filter(r => r.k === 'exp' && r.date >= FA && r.date <= FB)
  const fyDed = fyExp.filter(r => r.ded !== false).reduce((t, r) => t - r.v, 0)
  const byCat = Object.entries(fyExp.filter(r => r.ded !== false).reduce((a, r) => ({ ...a, [r.cat]: [(a[r.cat]?.[0] || 0) - r.v, (a[r.cat]?.[1] || 0) + 1] }), {})).sort((a, b) => b[1][0] - a[1][0])
  const catMax = byCat[0]?.[1][0] || 1
  const aside = Math.round(fyInc * rate / 100)
  const openQ = QS.find(x => x.st === 'due') || QS[0]
  const csv = x => { const rows = [...x.inv, ...x.exp].sort((a, b) => a.date < b.date ? -1 : 1).map(r => [r.date, r.k === 'inv' ? 'Income' : 'Expense', r.who, r.d, r.k === 'exp' ? r.cat : '', r.k === 'exp' ? (r.gst === false ? 'No' : 'Yes') : '', Math.abs(r.v).toFixed(2), gst && (r.k === 'inv' || r.gst !== false) ? (Math.abs(r.v) / 11).toFixed(2) : '0.00'].map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['date,type,who,description,category,has GST,amount incl GST,GST\n' + rows.join('\n')], { type: 'text/csv' })); a.download = 'lenstrybe-' + x.id + '.csv'; a.click() }
  const sendPack = () => F.open({ title: 'Send to your accountant', sub: 'Downloads the quarter as a spreadsheet, then opens an email to your accountant. Attach the file and send.', cta: 'Download and write email', fields: [{ k: 'em', l: 'Accountant', type: 'email', required: true, value: s.settings.accountant || '' }, { k: 'q', l: 'Quarter', type: 'select', value: q.id, options: QS.map(x => [x.id, x.n]) }], submit: v => { const x = QS.find(y => y.id === v.q) || q; F.patch('settings', { accountant: v.em }); csv(x); window.location.href = 'mailto:' + encodeURIComponent(v.em) + '?subject=' + encodeURIComponent('Quarter ' + x.n + ' from LensTrybe') + '&body=' + encodeURIComponent('Hi,\n\nAttached is my income and expenses for ' + x.n + '.\n\nIncome: ' + fmt(x.inc) + '\nExpenses: ' + fmt(x.ex) + (gst ? '\nGST on sales: ' + fmt(x.gstIn) + '\nGST on purchases: ' + fmt(x.gstOut) : '') + '\n\nThanks'); toast('Downloaded. Attach it to the email.') } })
  const prepare = () => F.open({ title: 'BAS · ' + q.n, sub: 'Check the numbers, then lodge in myGov or through your accountant. Due ' + nice(q.due) + '.', cta: q.st === 'lodged' ? 'Mark as not lodged' : 'Mark as lodged', body: <div className="kvs"><div className="kv"><span>G1 Sales incl. GST</span><b>{fmt(q.inc)}</b></div><div className="kv"><span>1A GST on sales</span><b>{fmt(q.gstIn)}</b></div><div className="kv"><span>G11 Purchases</span><b>{fmt(q.ex)}</b></div><div className="kv"><span>1B GST on purchases</span><b>{fmt(q.gstOut)}</b></div><div className="kv tot"><span>Net GST {net >= 0 ? 'to pay' : 'refund'}</span><b>{fmt(Math.abs(net))}</b></div></div>, alt: { l: 'Download worksheet', on: () => { csv(q); toast('Worksheet downloaded.'); return false } }, submit: () => { const next = { ...lodged }; if (next[q.id]) delete next[q.id]; else next[q.id] = TODAY; F.patch('settings', { lodged: next }); toast(next[q.id] ? q.n + ' marked as lodged.' : q.n + ' back to open.') } })
  const saveFin = async (patch, local, done) => { try { await live.saveFinanceSettings(me.id, patch); F.patch('settings', local); toast(done) } catch (e) { toast(e.message); return false } }
  const changeRate = () => F.open({ title: 'Set aside', sub: 'A share of every payment to put away for tax. It is a guide, not a bank transfer.', cta: 'Save', working: 'Saving', fields: [{ k: 'rate', l: 'Percent of every payment', type: 'number', value: rate, min: 0, max: 60, required: true }], submit: v => saveFin({ set_aside_percent: Number(v.rate) || 0 }, { setAside: Number(v.rate) || 0 }, 'Set aside changed to ' + v.rate + '%.') })
  const toggleGst = () => F.open({ title: gst ? 'Not registered for GST?' : 'Registered for GST?', sub: gst ? 'Turns off the BAS numbers. You can switch it back any time.' : 'Once you earn $75,000 a year you must register. Turning this on works out GST on sales and purchases for each quarter.', cta: gst ? 'I am not registered' : 'I am registered', working: 'Saving', fields: [], submit: () => saveFin({ gst_registered: !gst }, { gstReg: !gst }, gst ? 'GST off.' : 'GST on. Your quarters now show the BAS.') })
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Tax hub</h1><p>GST, BAS and end of year from the ledger you already keep. Nothing entered twice.</p></div>
        <div className="acts"><button className="btn g" onClick={sendPack}><Icon name="deliver" size={15} />Send to accountant</button>{gst ? <button className="btn w" onClick={prepare}>{q.st === 'lodged' ? 'BAS lodged' : 'Prepare BAS'} <Icon name={q.st === 'lodged' ? 'check' : 'arrow'} size={14} /></button> : <button className="btn w" onClick={toggleGst}>I'm registered for GST</button>}</div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[[gst ? 'GST this quarter' : 'Income this quarter', fmt(gst ? QS[0].gstIn - QS[0].gstOut : QS[0].inc), gst ? 'BAS due ' + nice(QS[0].due) : QS[0].n, gst ? 'w' : ''], ['Set aside so far', fmt(aside), rate + '% of what was paid this year', ''], ['Claimable this year', fmt(Math.round(fyDed)), byCat.length ? 'across ' + byCat.length + (byCat.length === 1 ? ' category' : ' categories') : 'nothing logged yet', 'n'], ['Income, financial year', fmt(fyInc), FYL + ', paid invoices', '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s7">
          <div className="h"><b>Quarters</b><Link to="/app/money">Finance hub <Icon name="arrow" size={12} /></Link></div>
          <div className="qs">
            {QS.map(x => <button key={x.id} type="button" className={'qr' + (sel === x.id ? ' on' : '')} onClick={() => setSel(x.id)}>
              <div className="tx"><b>{x.n}</b><small>{gst ? 'BAS due ' + nice(x.due) : x.inv.length + ' paid · ' + x.exp.length + ' expenses'}</small></div>
              <div className="qn"><small>Income</small><b>{fmt(x.inc)}</b></div>
              <div className="qn"><small>Expenses</small><b>{fmt(x.ex)}</b></div>
              {gst && <div className="qn"><small>GST net</small><b>{fmt(x.gstIn - x.gstOut)}</b></div>}
              {gst ? <span className={'st ' + (x.st === 'lodged' ? 'ok' : x.st === 'due' ? 'pink' : x.st === 'past' ? 'grey' : 'viewed')}>{x.st === 'lodged' ? 'Lodged' : x.st === 'due' ? 'To lodge' : x.st === 'past' ? 'Closed' : 'Open'}</span> : <span className="st grey">{x.b < TODAY ? 'Closed' : 'Now'}</span>}
            </button>)}
          </div>
          <div className="h" style={{ marginTop: 22 }}><b>Deductions by category · {FYL}</b><Link to="/app/expenses">Expenses <Icon name="arrow" size={12} /></Link></div>
          <div className="cats">
            {byCat.map(([n, [v, c]]) => <div key={n} className="cat" style={{ cursor: 'pointer' }} onClick={() => F.nav('/app/expenses')}><div className="r"><b>{n}</b><span>{fmt(Math.round(v))}</span></div><div className="bar"><i style={{ width: (v / catMax * 100) + '%' }} /></div><small>{c} {c === 1 ? 'expense' : 'expenses'}</small></div>)}
            {!byCat.length && <p className="tempty">Nothing logged this year. <button className="lnk" onClick={() => F.newDoc('exp')}>Add an expense</button></p>}
          </div>
        </div>

        <div className="s5 side">
          <div className="card lg">
            <div className="h"><b>{q.n}</b>{gst ? <span className={'st ' + (q.st === 'lodged' ? 'ok' : q.st === 'due' ? 'pink' : 'viewed')}>{q.st === 'lodged' ? 'Lodged ' + nice(lodged[q.id]) : q.st === 'past' ? 'Was due ' + nice(q.due) : 'Due ' + nice(q.due)}</span> : null}</div>
            <div className="kv"><span>{gst ? 'Sales incl. GST (G1)' : 'Income, paid invoices'}</span><b>{fmt(q.inc)}</b></div>
            {gst && <div className="kv"><span>GST on sales (1A)</span><b>{fmt(q.gstIn)}</b></div>}
            <div className="kv"><span>{gst ? 'Purchases (G11)' : 'Expenses'}</span><b>{fmt(q.ex)}</b></div>
            {gst && <div className="kv"><span>GST on purchases (1B)</span><b>{fmt(q.gstOut)}</b></div>}
            {gst ? <div className="kv tot"><span>Net GST {net >= 0 ? 'to pay' : 'refund'}</span><b>{fmt(Math.abs(net))}</b></div> : <div className="kv tot"><span>Profit</span><b>{fmt(q.inc - q.ex)}</b></div>}
            {!gst && <p className="note2" style={{ marginTop: 10 }}>Not registered for GST, so there is no BAS to lodge. <button className="lnk" onClick={toggleGst}>Registered?</button></p>}
            <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              <button className="btn w sm" onClick={() => { csv(q); toast('Downloaded.') }}>Download the quarter</button>
              {gst && <button className="btn g sm" onClick={toggleGst}>GST settings</button>}
            </div>
          </div>
          <div className="card lg">
            <div className="h"><b>Set aside</b><small className="lumi-by">{rate}% of every payment</small></div>
            <p className="note2">Put {rate} percent of each payment away for tax. So far this year that is {fmt(aside)} of {fmt(fyInc)} paid{gst && openQ.st !== 'lodged' && openQ.st !== 'past' ? ', and the next BAS is ' + fmt(Math.max(0, openQ.gstIn - openQ.gstOut)) + ' due ' + nice(openQ.due) : ''}.</p>
            <div className="ctas" style={{ display: 'flex', gap: 6, marginTop: 12 }}><button className="btn g sm" onClick={changeRate}>Change the rate</button></div>
          </div>
          {gst && openQ.st === 'due' && <div className="tlumi"><span className="lm" /><div>{openQ.n} has closed and the BAS is due {nice(openQ.due)}. The numbers are ready.<div className="acts"><button className="y" onClick={() => setSel(openQ.id)}>Show me</button></div></div></div>}
        </div>
      </div>
    </section>
  )
}
