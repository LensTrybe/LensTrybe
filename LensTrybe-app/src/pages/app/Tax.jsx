import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { fmt } from '../../lib/format'

// Tax hub: GST, BAS and end of year, worked out from the ledger you already keep. Nothing to enter twice.
const Q = [
  { id: 'q1', n: 'Jul to Sep 2026', due: '28 Oct', st: 'open', inc: 24140, exp: 3860, gstIn: 2195, gstOut: 351 },
  { id: 'q4', n: 'Apr to Jun 2026', due: '28 Jul', st: 'lodged', inc: 19800, exp: 4120, gstIn: 1800, gstOut: 375 },
  { id: 'q3', n: 'Jan to Mar 2026', due: '28 Apr', st: 'lodged', inc: 16200, exp: 2980, gstIn: 1473, gstOut: 271 },
  { id: 'q2', n: 'Oct to Dec 2025', due: '28 Feb', st: 'lodged', inc: 21300, exp: 5200, gstIn: 1936, gstOut: 473 },
]
const CATS = [['Gear', 1780, 'Cards, tripod plate, batteries'], ['Travel', 940, '1,068 km at 88c'], ['Software', 610, 'Adobe, LensTrybe, Pixieset legacy'], ['Insurance', 380, 'Gear and public liability'], ['Marketing', 150, 'Prints for the café wall']]

export default function Tax() {
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
