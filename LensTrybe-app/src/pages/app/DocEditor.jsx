import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, addDays } from '../../lib/store'
import { fmt } from '../../lib/format'
import { brandFor, fam, loadFont, paperOf } from '../../lib/brand'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import * as live from '../../lib/live'

// The invoice or quote, on screen, as the client will see it. Everything on the page is editable in place:
// your details come from Settings and the brand kit, the client's from Contacts, line items and the
// payment schedule are typed straight onto the paper. Save keeps a draft; Send puts it in the thread.
export const money = n => '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// a textarea that grows with its text, so a clause or a note never scrolls inside the page
const Ta = ({ v, set, ph, cls }) => { const r = useRef(); useLayoutEffect(() => { const el = r.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }, [v]); return <textarea ref={r} className={'ed ' + cls} value={v} placeholder={ph} onChange={e => set(e.target.value)} rows={1} /> }
export const Ed = ({ v, set, ph, cls = '', multi, type = 'text', right, w }) => multi
  ? <Ta v={v} set={set} ph={ph} cls={cls} />
  : <input className={'ed ' + cls + (right ? ' r' : '')} type={type} value={v} placeholder={ph} onChange={e => set(e.target.value)} style={w ? { width: w } : undefined} />

export default function DocEditor({ kind = 'inv' }) {
  const { id } = useParams(); const { state } = useLocation(); const nav = useNavigate(); const F = useFlows(); const { s, toast } = F
  const auth = useAuth(); const P = LIVE ? (auth.profile || {}) : null
  const isQ = kind === 'q', LABEL = isQ ? 'Quote' : 'Invoice', base = isQ ? '/app/quotes' : '/app/invoicing'
  const existing = id ? s.ledger.find(r => r.id === id) : null
  const raw = LIVE ? existing?.live : null
  const D = s.settings.invoice || {}
  // live: who is sending, from the real profile; demo: the sample settings
  const fromMe = () => LIVE
    ? { biz: P.business_name || '', n: [P.first_name, P.last_name].filter(Boolean).join(' ') || auth.user?.email || '', abn: P.abn || '', em: P.business_email || auth.user?.email || '', ph: P.phone || '', addr: [P.city, P.state].filter(Boolean).join(', '), pay: P.bank_bsb || P.bank_account ? ['BSB ' + (P.bank_bsb || ''), 'Acc ' + (P.bank_account || ''), P.bank_account_name || P.business_name].filter(Boolean).join(' · ') : '' }
    : { biz: s.settings.biz, n: s.profile.n, abn: s.settings.abn, em: s.settings.email, ph: s.settings.phone, addr: s.settings.addr || s.profile.city, pay: D.pay || 'BSB 484-799 · Acc 1204 5561 · ' + s.settings.biz }
  const blank = () => ({
    no: F.next(kind), issued: TODAY, client: state?.client || '', for: state?.d || '',
    from: fromMe(),
    to: { n: '', co: '', em: '', ph: '', addr: '' },
    items: state?.items || [{ d: state?.d || '', q: 1, r: state?.v || '' }],
    gstIncl: s.brand.gst !== 0, gstOn: true,
    dep: { on: LIVE ? false : isQ ? true : !!D.depOn, pct: D.depPct ?? 30, amt: '', due: TODAY }, balDue: addDays(TODAY, isQ ? (D.validDays ?? 9) : (D.balDays ?? 7)),
    notes: isQ ? (D.qnotes || 'Accept on your phone from the link in our thread and the date is yours.') : (D.notes || 'Thank you for your business.'), terms: D.terms || s.brand.terms || 'Deposit locks the date. Balance due seven days before the shoot. Card or transfer.',
  })
  // live: a saved row back into the editor's shape
  const fromRaw = r => { const [notes, ...rest] = String(r.notes || '').split('\n\n'); const isFor = /^For: /.test(notes); return { ...blank(), no: existing.id, issued: String(r.created_at || TODAY).slice(0, 10), client: existing.t || '', for: isFor ? notes.slice(5) : '', to: { n: r.client_name || '', co: '', em: r.client_email || '', ph: r.client_phone || '', addr: r.client_address || '' }, items: live.fromLiveItems(r.items), dep: { on: false, pct: 30, amt: '', due: TODAY }, balDue: (isQ ? r.valid_until || r.due_date : r.due_date) || addDays(TODAY, 7), notes: isFor ? (rest[0] || '') : notes, terms: isFor ? rest.slice(1).join('\n\n') : rest.join('\n\n') } }
  const [inv, setInv] = useState(() => raw ? fromRaw(raw) : existing?.doc ? existing.doc : blank())
  const [dirty, setDirty] = useState(false), [pct, setPct] = useState(true), [busy, setBusy] = useState('')
  const paper = useRef()
  const up = fn => { setInv(x => { const n = typeof fn === 'function' ? fn(x) : { ...x, ...fn }; return n }); setDirty(true) }
  const upFrom = (k, v) => up(x => ({ ...x, from: { ...x.from, [k]: v } })), upTo = (k, v) => up(x => ({ ...x, to: { ...x.to, [k]: v } }))
  const upItem = (i, k, v) => up(x => ({ ...x, items: x.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  // client from Contacts fills the To block, still editable after
  const pickClient = cid => { if (LIVE) { const t = s.threads.find(x => x.id === cid) || (() => { const p = s.people.find(x => x.id === cid); return p ? { n: p.n, email: p.em, ph: p.ph } : null })(); up(x => ({ ...x, client: cid, to: t ? { ...x.to, n: t.n, em: t.email || '', ph: t.ph || x.to.ph } : x.to })); return } const p = s.people.find(x => x.id === cid); up(x => ({ ...x, client: cid, to: p ? { n: p.n, co: p.co !== p.n ? p.co : '', em: p.em || '', ph: p.ph || '', addr: p.addr || '' } : x.to })) }
  useEffect(() => { if (!existing && state?.client) pickClient(state.client) }, []) // eslint-disable-line
  // totals
  const items = inv.items, sub = items.reduce((t, it) => t + (Number(it.q) || 0) * (Number(it.r) || 0), 0)
  const gst = inv.gstOn ? (inv.gstIncl ? sub / 11 : sub * 0.1) : 0, total = inv.gstIncl || !inv.gstOn ? sub : sub + gst
  const depAmt = inv.dep.on ? (pct ? Math.round(total * (Number(inv.dep.pct) || 0)) / 100 : Number(inv.dep.amt) || 0) : 0, bal = total - depAmt
  const client = LIVE ? (s.threads.find(t => t.id === inv.client) ? { id: inv.client, n: s.threads.find(t => t.id === inv.client).n, em: s.threads.find(t => t.id === inv.client).email } : null) : s.people.find(p => p.id === inv.client)
  const status = existing?.stt || 'Draft'
  // ── live: the real tables, the real emails ──
  const liveSave = async (sendIt) => {
    if (busy) return
    if (!inv.to.n.trim()) return toast('Type who it is for.')
    if (sendIt && !/\S+@\S+\.\S+/.test(inv.to.em || '')) return toast('An email address to send it to.')
    if (!items.some(it => Number(it.r) > 0)) return toast('Add at least one line with a price.')
    setBusy(sendIt ? 'send' : 'save')
    try {
      const row = await live.saveMoneyDoc(kind, inv, total, F.me, raw)
      if (sendIt) await live.sendDocLive(kind, row.id)
      setDirty(false); await F.refreshLive()
      toast(LABEL + (sendIt ? ' sent to ' + inv.to.n + ' at ' + inv.to.em + '. It is in the thread.' : ' saved as a draft.'))
      nav(sendIt ? base : (isQ ? '/app/quote/' : '/app/invoice/') + (isQ ? 'Q-' : 'INV-') + String(row.id).slice(0, 8).toUpperCase(), { replace: true })
    } catch (e) { toast(e.message) } finally { setBusy('') }
  }
  const liveStatus = async st => { if (busy || !raw) return; setBusy(st); try { await live.setDocStatus(kind, raw.id, st); await F.refreshLive(); toast(LABEL + ' marked ' + st + '.'); nav(base) } catch (e) { toast(e.message) } finally { setBusy('') } }
  // ── save / send ──
  const record = st => ({ k: kind, who: inv.to.n || client?.n || 'Client', d: inv.for || items[0]?.d || LABEL, date: isQ ? inv.balDue : (inv.dep.on ? inv.dep.due : inv.balDue), st: st === 'Sent' ? 'sent' : st === 'Accepted' || st === 'Paid' ? 'ok' : 'grey', stt: st, v: Math.round(total), t: inv.client || existing?.t, doc: inv, sched: isQ ? undefined : inv.dep.on ? [['Deposit', depAmt, inv.dep.due], ['Balance', bal, inv.balDue]] : [['Balance', total, inv.balDue]] })
  const save = (st = status === 'Draft' ? 'Draft' : status) => { if (LIVE) return liveSave(false); if (existing) F.upd('ledger', existing.id, record(st)); else { F.add('ledger', { id: inv.no, ...record(st) }, kind) } setDirty(false); return inv.no }
  const send = () => {
    if (LIVE) return liveSave(true)
    if (!inv.to.n && !client) return toast('Pick a client, or type who it is for.')
    if (!items.some(it => Number(it.r) > 0)) return toast('Add at least one line with a price.')
    const no = save('Sent'); const tid = inv.client || existing?.t
    if (tid) { F.upd('threads', tid, t => ({ docs: [...t.docs.filter(d => !d[0].includes(no)), [LABEL + ' #' + no, 'sent', 'Sent']], line: [...t.line.filter(m => !m.doc?.includes(no)), { doc: LABEL + ' #' + no + (inv.for ? ' · ' + inv.for : ''), d: money(total) + (isQ ? ' · valid until ' + nice(inv.balDue) + (inv.dep.on ? ' · ' + (pct ? inv.dep.pct + '%' : money(depAmt)) + ' deposit to book' : '') : inv.dep.on ? ' · deposit ' + money(depAmt) + ' due ' + nice(inv.dep.due) : ' · due ' + nice(inv.balDue)), st: 'sent', stt: 'Sent' }], last: LABEL + ' ' + no + ' sent', need: isQ ? false : t.need, next: isQ ? 'Quote sent, waiting' : t.next })); F.upd('threads', tid, t => ({ stage: Math.max(t.stage, isQ ? 1 : 4) })) }
    toast(LABEL + ' ' + no + ' sent to ' + (inv.to.n || client.n) + (inv.to.em ? ' at ' + inv.to.em : '') + '.'); nav(base)
  }
  const saveDefaults = () => { const days = Math.max(0, Math.round((new Date(inv.balDue) - new Date(inv.issued)) / 864e5)); F.patch('settings', { invoice: { ...D, depOn: isQ ? D.depOn : inv.dep.on, depPct: Number(inv.dep.pct) || 30, ...(isQ ? { validDays: days, qnotes: inv.notes } : { balDays: days, notes: inv.notes }), terms: inv.terms, pay: inv.from.pay }, biz: inv.from.biz, abn: inv.from.abn, email: inv.from.em, phone: inv.from.ph, addr: inv.from.addr }); toast('Saved as your defaults. Every new invoice starts like this.') }
  const print = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write('<html><head><title>' + LABEL + ' ' + inv.no + '</title><style>body{font-family:Inter,-apple-system,sans-serif;color:#14111a;padding:40px;max-width:760px;margin:auto}input,textarea{border:0;background:none;font:inherit;color:inherit;padding:0;resize:none;width:100%}.r{text-align:right}table{width:100%;border-collapse:collapse}td,th{padding:8px 0;border-bottom:1px solid #eee;text-align:left}.tot td{font-weight:700}.rm,.addl,.hint{display:none}.chip{display:none}.ptop{display:flex;justify-content:space-between}</style></head><body>' + paper.current.innerHTML + '</body></html>'); w.document.close(); setTimeout(() => w.print(), 300) }
  const del = () => F.confirm({ title: 'Delete ' + inv.no + '?', body: 'It comes out of the ledger and the thread.', cta: 'Delete', danger: true, onYes: async () => { if (LIVE && raw) { try { await live.deleteDocLive(kind, raw.id); await F.refreshLive() } catch (e) { return toast(e.message) } } else if (existing) F.removeDoc(existing.id); nav(base) } })
  const accept = () => { if (LIVE) return liveStatus('accepted'); save('Accepted'); F.markAccepted(existing.id); nav(base) }
  const paid = () => { if (LIVE) return liveStatus('paid'); F.markPaid(existing.id); nav(base) }
  const B = brandFor(s.brand, kind), acc = B.accent || '#8DF3D6', PP = paperOf(B.paper); useEffect(() => { loadFont(B.head); loadFont(B.body) }, [B.head, B.body])

  return (
    <section className="view inved">
      <div className="vh">
        <div><Link to={base} className="lnk back"><Icon name="back" size={13} />{isQ ? 'Quotes' : 'Invoicing'}</Link><h1>{existing ? LABEL : 'New ' + LABEL.toLowerCase()} <em>{inv.no}</em></h1><p>{status === 'Draft' ? 'Everything on the page is editable. Tap any text to change it.' : status + (existing?.date ? (isQ ? ' · valid until ' : ' · due ') + nice(existing.date) : '')}</p></div>
        <div className="acts">
          {existing && !isQ && status !== 'Paid' && <button className="btn g" onClick={paid} disabled={!!busy}><Icon name="check" size={15} />Mark paid</button>}{existing && isQ && status !== 'Accepted' && <button className="btn g" onClick={accept} disabled={!!busy}><Icon name="check" size={15} />Mark accepted</button>}{existing && isQ && status === 'Accepted' && <button className="btn g" onClick={() => F.invoiceFromQuote(existing.id)}><Icon name="dollar" size={15} />Invoice</button>}
          <button className="btn g" onClick={print}><Icon name="deliver" size={15} />PDF</button>
          <button className={'btn g' + (dirty ? '' : ' quiet')} onClick={() => { if (LIVE) return liveSave(false); save(); toast('Saved.') }} disabled={!!busy}>{busy === 'save' ? 'Saving' : dirty ? 'Save draft' : 'Saved'}</button>
          <button className="btn w" onClick={send} disabled={!!busy}><Icon name="arrow" size={15} />{busy === 'send' ? 'Sending' : status === 'Sent' ? 'Send again' : 'Send ' + LABEL.toLowerCase()}</button>
        </div>
      </div>
      <div className="grid">
        <div className="s8">
          <div className={'paper inv lay-' + B.layout + (B.paper === 'dark' ? ' dark' : '')} ref={paper} style={{ '--acc': acc, '--pp': PP[2], '--pi': PP[3], '--rad': (B.radius ?? 12) + 'px', fontFamily: fam(B.body || 'Inter') }}>
            <div className="ptop">
              <div className="from">
                <b>{B.logo ? <img className="blogo" src={B.logo} alt="" /> : <span className="mark" style={{ background: acc }} />}<Ed v={inv.from.biz} set={v => upFrom('biz', v)} ph="Your business" cls="big" /></b>
                <Ed v={inv.from.n} set={v => upFrom('n', v)} ph="Your name" cls="sm" />
                <Ed v={inv.from.addr} set={v => upFrom('addr', v)} ph="Address" cls="sm" />
                <Ed v={inv.from.em} set={v => upFrom('em', v)} ph="Email" cls="sm" />
                <Ed v={inv.from.ph} set={v => upFrom('ph', v)} ph="Phone" cls="sm" />
                <span className="sm abn">ABN <Ed v={inv.from.abn} set={v => upFrom('abn', v)} ph="00 000 000 000" cls="sm inline" w={130} /></span>
              </div>
              <div className="meta">
                <h3 style={{ fontFamily: fam(B.head || 'Inter') }}>{isQ ? 'Quote' : 'Tax invoice'}</h3>
                <div className="mrow"><span>Number</span><Ed v={inv.no} set={v => up({ no: v })} right w={110} /></div>
                <div className="mrow"><span>Issued</span><Ed v={inv.issued} set={v => up({ issued: v })} type="date" right w={140} /></div>
                <div className="mrow"><span>{isQ ? 'Valid until' : 'Due'}</span><Ed v={inv.balDue} set={v => up({ balDue: v })} type="date" right w={140} /></div>
                <span className={'chip ' + (status === 'Paid' || status === 'Accepted' ? 'ok' : status === 'Sent' || status.startsWith('Viewed') ? 'sent' : 'grey')}>{status}</span>
              </div>
            </div>

            <div className="to">
              <small>{isQ ? 'Quote for' : 'Bill to'}</small>
              <div className="pick"><select value={inv.client} onChange={e => pickClient(e.target.value)}><option value="">{LIVE ? 'Pick a client thread…' : 'Pick from Contacts…'}</option>{(LIVE ? [...s.threads.map(t => ({ id: t.id, n: t.n })), ...s.people.filter(p => !s.threads.some(t => t.id === p.id)).map(p => ({ id: p.id, n: p.n }))] : s.people).map(p => <option key={p.id} value={p.id}>{p.n}</option>)}</select></div>
              <Ed v={inv.to.n} set={v => upTo('n', v)} ph="Client name" cls="big" />
              <Ed v={inv.to.co} set={v => upTo('co', v)} ph="Contact or company" cls="sm" />
              <Ed v={inv.to.addr} set={v => upTo('addr', v)} ph="Address" cls="sm" />
              <Ed v={inv.to.em} set={v => upTo('em', v)} ph="Email" cls="sm" />
              <Ed v={inv.to.ph} set={v => upTo('ph', v)} ph="Phone" cls="sm" />
              <div className="forrow"><small>For</small><Ed v={inv.for} set={v => up({ for: v })} ph="Wedding · Maleny Manor · 7 Nov" /></div>
            </div>

            <table>
              <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th><th /></tr></thead>
              <tbody>
                {items.map((it, i) => <tr key={i}>
                  <td><Ed v={it.d} set={v => upItem(i, 'd', v)} ph="Full day coverage, 10 hours" /></td>
                  <td className="r"><Ed v={it.q} set={v => upItem(i, 'q', v)} type="number" right w={56} /></td>
                  <td className="r"><Ed v={it.r} set={v => upItem(i, 'r', v)} type="number" right w={96} ph="0" /></td>
                  <td className="r amt">{money((Number(it.q) || 0) * (Number(it.r) || 0))}</td>
                  <td><button type="button" className="rm" aria-label="Remove line" onClick={() => up(x => ({ ...x, items: x.items.length > 1 ? x.items.filter((_, j) => j !== i) : [{ d: '', q: 1, r: '' }] }))}><Icon name="x" size={11} /></button></td>
                </tr>)}
                <tr className="addl"><td colSpan={5}><button type="button" onClick={() => up(x => ({ ...x, items: [...x.items, { d: '', q: 1, r: '' }] }))}><Icon name="plus" size={12} />Add a line</button>{s.projects.find(p => p.t === inv.client) && <button type="button" onClick={() => { const p = s.projects.find(x => x.t === inv.client); up(x => ({ ...x, items: [...x.items.filter(it => it.d || it.r), { d: p.n.split(' · ').slice(1).join(' · ') || p.n, q: 1, r: p.v || '' }], for: x.for || p.n })) }}>From the project</button>}</td></tr>
              </tbody>
              <tfoot>
                <tr className="q"><td colSpan={3}>Subtotal{inv.gstOn && inv.gstIncl ? ' (incl. GST)' : ''}</td><td className="r">{money(sub)}</td><td /></tr>
                {inv.gstOn && <tr className="q"><td colSpan={3}>GST 10%{inv.gstIncl ? ' included' : ''}</td><td className="r">{money(gst)}</td><td /></tr>}
                <tr className="tot"><td colSpan={3}>Total{inv.gstOn ? ' incl. GST' : ''}</td><td className="r">{money(total)}</td><td /></tr>
              </tfoot>
            </table>

            {isQ ? <div className="payd sched">
              <div className="srow"><b>To book</b><span className="amt">{inv.dep.on ? money(depAmt) : money(total)}</span><span>{inv.dep.on ? (pct ? inv.dep.pct + '% deposit on acceptance' : 'deposit on acceptance') : 'in full on acceptance'}</span></div>
              {inv.dep.on && <div className="srow"><b>Balance</b><span className="amt">{money(bal)}</span><span>{D.balDays != null ? D.balDays + ' days before the shoot' : 'seven days before the shoot'}</span></div>}
              <div className="pay"><small>Accept from the link in our thread. The date is held for you until <b>{nice(inv.balDue, { year: 'numeric' })}</b>.</small></div>
            </div> :             <div className="payd sched">
              {inv.dep.on ? <>
                <div className="srow"><b>Deposit</b><span className="amt">{money(depAmt)}</span><span>due <Ed v={inv.dep.due} set={v => up(x => ({ ...x, dep: { ...x.dep, due: v } }))} type="date" cls="inline" w={130} /></span></div>
                <div className="srow"><b>Balance</b><span className="amt">{money(bal)}</span><span>due <Ed v={inv.balDue} set={v => up({ balDue: v })} type="date" cls="inline" w={130} /></span></div>
              </> : <div className="srow"><b>Amount due</b><span className="amt">{money(total)}</span><span>by <Ed v={inv.balDue} set={v => up({ balDue: v })} type="date" cls="inline" w={130} /></span></div>}
              <div className="pay"><small>Pay by card from the link in your thread, or transfer to</small><Ed v={inv.from.pay} set={v => upFrom('pay', v)} ph="BSB · Account · Name" cls="sm" /></div>
            </div>}
            <div className="notes"><small>Notes</small><Ed v={inv.notes} set={v => up({ notes: v })} multi ph="A line for the client" /></div>
            <div className="notes"><small>Terms</small><Ed v={inv.terms} set={v => up({ terms: v })} multi ph="Your terms" /></div>
            <div className="pfoot"><span style={{ color: acc }}>{s.brand.foot}</span><span>{inv.from.biz} · ABN {inv.from.abn}</span></div>
          </div>
        </div>

        <div className="s4 side sticky">
          <div className="card lg"><div className="h"><b>{isQ ? 'Booking terms' : 'Payment schedule'}</b></div>
            <div className="brows one">
              <label className="brow"><span>{isQ ? 'Deposit to book' : 'Take a deposit'}<small>{isQ ? 'Invoiced when they accept' : 'The rest is due before the shoot'}</small></span><span className={'sw2' + (inv.dep.on ? ' on' : '')} role="switch" aria-checked={inv.dep.on} onClick={() => up(x => ({ ...x, dep: { ...x.dep, on: !x.dep.on } }))}><i /></span></label>
            </div>
            {inv.dep.on && <div className="dep">
              <div className="tfilt seg3" style={{ marginBottom: 10 }}><button className={pct ? 'on' : ''} onClick={() => setPct(true)}>Percent</button><button className={!pct ? 'on' : ''} onClick={() => setPct(false)}>Amount</button></div>
              <div className="sfs">
                {pct ? <div className="sf half"><label>Deposit %</label><input type="number" min="0" max="100" value={inv.dep.pct} onChange={e => up(x => ({ ...x, dep: { ...x.dep, pct: e.target.value } }))} /></div>
                  : <div className="sf half"><label>Deposit $</label><span className="money"><i>$</i><input type="number" min="0" value={inv.dep.amt} onChange={e => up(x => ({ ...x, dep: { ...x.dep, amt: e.target.value } }))} /></span></div>}
                {!isQ && <div className="sf half"><label>Deposit due</label><input type="date" value={inv.dep.due} onChange={e => up(x => ({ ...x, dep: { ...x.dep, due: e.target.value } }))} /></div>}
                <div className="sf half"><label>{isQ ? 'Valid until' : 'Balance due'}</label><input type="date" value={inv.balDue} onChange={e => up({ balDue: e.target.value })} /></div>
                <div className="sf half"><label>&nbsp;</label><div className="kv" style={{ border: 0, padding: '10px 0' }}><span>Balance</span><b>{money(bal)}</b></div></div>
              </div>
            </div>}
            <div className="brows one" style={{ marginTop: 6 }}>
              <label className="brow"><span>Charge GST<small>10%, shown on the invoice</small></span><span className={'sw2' + (inv.gstOn ? ' on' : '')} role="switch" aria-checked={inv.gstOn} onClick={() => up({ gstOn: !inv.gstOn })}><i /></span></label>
              {inv.gstOn && <label className="brow"><span>Prices include GST<small>Off adds 10% on top</small></span><span className={'sw2' + (inv.gstIncl ? ' on' : '')} role="switch" aria-checked={inv.gstIncl} onClick={() => up({ gstIncl: !inv.gstIncl })}><i /></span></label>}
            </div>
            <button className="lnk" style={{ marginTop: 12 }} onClick={saveDefaults}>Save these as my defaults</button>
          </div>
          <div className="card lg"><div className="h"><b>Client</b>{client && <Link className="lnk" to={'/app/thread/' + client.id}>Thread <Icon name="arrow" size={12} /></Link>}</div>
            <p className="note2">{client ? client.n + ' · ' + (client.em || 'no email') + (LIVE ? '. From the thread; change anything on the ' + LABEL.toLowerCase() + ' itself.' : '. Filled from Contacts; change anything on the invoice itself.') : LIVE ? 'Pick a client thread on the ' + LABEL.toLowerCase() + ', or type the details straight in. The email is where it goes.' : 'Pick from Contacts on the invoice, or type the details straight in. '}{!client && !LIVE && <button className="lnk" onClick={() => F.newClient(r => pickClient(r.pid))}>Add a new client</button>}</p>
          </div>
          <div className="tlumi"><span className="lm" /><div>{isQ ? (s.settings.autoDep === false ? 'When they accept, tap Invoice to raise the deposit invoice.' : 'When they accept, the deposit invoice drafts itself from these lines and waits in Invoicing for you to send.') : inv.dep.on ? 'Deposit invoices get paid 2.4× faster than full ones in your history. The reminder for the balance goes out on its own three days before.' : 'A deposit locks the date and gets paid faster. Thirty percent is your usual.'}{!isQ && !inv.dep.on && <div className="acts"><button className="y" onClick={() => up(x => ({ ...x, dep: { ...x.dep, on: true } }))}>Add a 30% deposit</button></div>}</div></div>
          {existing && <button className="lnk" style={{ opacity: .6 }} onClick={del}>Delete {LABEL.toLowerCase()}</button>}
        </div>
      </div>
    </section>
  )
}
