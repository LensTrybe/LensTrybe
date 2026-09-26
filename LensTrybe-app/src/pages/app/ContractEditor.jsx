import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, addDays } from '../../lib/store'
import { Ed, money } from './DocEditor'
import { brandFor, fam, loadFont, paperOf } from '../../lib/brand'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import * as live from '../../lib/live'

// The contract, on screen, as the client will read it on their phone. Parties and the job sit at the top
// so the clauses can stay in plain, generic English ("the Photographer", "the Client"). Start from one
// of your templates, change any word, save the result back as a template for next time.
const SIG = 'M6 52c14-30 26-38 30-30 4 8-10 30 0 30s24-34 30-30c6 4-6 30 2 30 10 0 30-40 40-30 8 8-4 30 6 30 12 0 30-36 46-30 8 4 2 20 10 22 8 2 22-14 40-16 14-2 30 8 60 4'
const clauseObj = ([h, b]) => ({ h, b })
const isoish = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '')

export default function ContractEditor() {
  const { id } = useParams(); const { state } = useLocation(); const nav = useNavigate(); const F = useFlows(); const { s, toast } = F
  const T = s.contractTemplates, D = s.settings.invoice || {}, base = '/app/contracts'
  const existing = id ? s.ledger.find(r => r.id === id) : null
  const auth = useAuth(); const P = LIVE ? (auth.profile || {}) : null; const raw = LIVE ? existing?.live : null
  const [busy, setBusy] = useState('')
  const from = () => LIVE ? { biz: P.business_name || '', n: [P.first_name, P.last_name].filter(Boolean).join(' ') || auth.user?.email || '', abn: P.abn || '', em: P.business_email || auth.user?.email || '', ph: P.phone || '', addr: [P.city, P.state].filter(Boolean).join(', ') } : { biz: s.settings.biz, n: s.profile.n, abn: s.settings.abn, em: s.settings.email, ph: s.settings.phone, addr: s.settings.addr || s.profile.city }
  const toOf = p => p ? { n: p.n, co: p.co !== p.n ? p.co : '', em: p.em || '', ph: p.ph || '', addr: p.addr || '' } : { n: '', co: '', em: '', ph: '', addr: '' }
  const blank = () => {
    const t = T.find(x => x.id === state?.tpl) || T.find(x => (state?.d || '').toLowerCase().includes(x.n.split(' ')[0].toLowerCase())) || T[0]
    const p = s.people.find(x => x.id === state?.client)
    return { no: F.next('c'), issued: TODAY, client: state?.client || '', template: t?.id || '', title: t?.title || 'Photography agreement', for: state?.d || '', d: state?.date || '', hours: '', where: '', fee: state?.v || '', depPct: D.depPct ?? 30, balDays: D.balDays ?? 7, until: addDays(TODAY, D.validDays ?? 9), from: from(), to: toOf(p), clauses: (t?.clauses || []).map(clauseObj), sig: { me: '', them: '' } }
  }
  // seeded contracts have no saved doc yet: build one from the row so it opens like the rest
  const fromRow = r => { const t = T.find(x => r.d.toLowerCase().includes(x.n.split(' ')[0].toLowerCase())) || T[0]; const p = s.people.find(x => x.id === r.t); const pj = s.projects.find(x => x.t === r.t); return { ...blank(), no: r.id, issued: r.date, client: r.t || '', template: t.id, title: t.title, for: pj ? pj.n.split(' · ').slice(1).join(' · ') || pj.n : r.d, d: isoish(pj?.d) ? pj.d : '', where: pj?.at || '', fee: r.v || '', to: toOf(p), clauses: t.clauses.map(clauseObj), sig: { me: r.st !== 'grey' ? r.date : '', them: r.st === 'pink' ? r.date : '' } } }
  // live: a saved contract row back into clauses. The preamble (parties, job) is rebuilt on send.
  const fromRaw = r => { const blocks = String(r.content || '').split(/\n{2,}/); const first = blocks.findIndex(b => /^\d+\.\s/.test(b)); const cl = (first >= 0 ? blocks.slice(first) : blocks).filter(Boolean).map(b => { const m = /^(?:\d+\.\s+)?(.*)\n([\s\S]*)$/.exec(b); return m && /^\d+\.\s/.test(b) ? { h: m[1], b: m[2] } : { h: '', b: b } }); const th = s.threads.find(x => x.id === existing.t); return { ...blank(), no: existing.id, issued: String(r.created_at || TODAY).slice(0, 10), client: existing.t || '', template: '', title: r.title || 'Contract', for: r.project_name || '', d: r.project_date || '', to: { n: r.client_name || '', co: '', em: r.client_email || th?.email || '', ph: '', addr: '' }, clauses: cl.length ? cl : [{ h: '', b: '' }], notes: r.notes || '', sig: { me: r.status !== 'draft' ? String(r.created_at || '').slice(0, 10) : '', them: r.signed_at ? String(r.signed_at).slice(0, 10) : '' } } }
  const [c, setC] = useState(() => raw ? fromRaw(raw) : existing ? (existing.doc || fromRow(existing)) : blank())
  const [dirty, setDirty] = useState(false)
  const paper = useRef()
  const up = fn => { setC(x => typeof fn === 'function' ? fn(x) : { ...x, ...fn }); setDirty(true) }
  const upFrom = (k, v) => up(x => ({ ...x, from: { ...x.from, [k]: v } })), upTo = (k, v) => up(x => ({ ...x, to: { ...x.to, [k]: v } }))
  const upCl = (i, k, v) => up(x => ({ ...x, clauses: x.clauses.map((cl, j) => j === i ? { ...cl, [k]: v } : cl) }))
  const moveCl = (i, d) => up(x => { const a = x.clauses.slice(); const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, clauses: a } })
  // the client's project (or thread) fills the job details too, all still editable
  const pickClient = cid => { if (LIVE) { const th = s.threads.find(x => x.id === cid) || (() => { const p = s.people.find(x => x.id === cid); return p ? { n: p.n, email: p.em } : null })(); up(x => ({ ...x, client: cid, to: th ? { ...x.to, n: th.n, em: th.email || '' } : x.to, for: x.for || th?.j || '', fee: x.fee || th?.v || '' })); return } const p = s.people.find(x => x.id === cid); const pj = s.projects.find(x => x.t === cid && x.k !== 'done') || s.projects.find(x => x.t === cid); const th = s.threads.find(x => x.id === cid); const ev = s.events.find(e => e.t === cid && e.k !== 'x'); up(x => ({ ...x, client: cid, to: p ? toOf(p) : x.to, for: x.for || (pj ? pj.n.split(' · ').slice(1).join(' · ') || pj.n : th?.j || ''), d: x.d || (isoish(pj?.d) ? pj.d : isoish(ev?.d) ? ev.d : isoish(th?.d) ? th.d : ''), where: x.where || pj?.at || ev?.where || '', fee: x.fee || pj?.v || th?.v || '' })) }
  useEffect(() => { if (!existing && state?.client) pickClient(state.client) }, []) // eslint-disable-line
  const applyTemplate = tid => { const t = T.find(x => x.id === tid); if (!t) return; up(x => ({ ...x, template: tid, title: t.title || x.title, clauses: t.clauses.map(clauseObj) })); toast(t.n + ' applied. Change any word.') }
  const fee = Number(c.fee) || 0, dep = Math.round(fee * (Number(c.depPct) || 0)) / 100, bal = fee - dep
  const client = LIVE ? (s.threads.find(t => t.id === c.client) ? { id: c.client, n: s.threads.find(t => t.id === c.client).n, em: s.threads.find(t => t.id === c.client).email } : null) : s.people.find(p => p.id === c.client)
  const status = existing?.stt || 'Draft'
  // ── live: the contracts table, send-contract, the real signing link ──
  const contentText = () => [c.title, 'Between ' + (c.from.biz || c.from.n) + ' ("the Photographer") and ' + c.to.n + ' ("the Client").', [c.for ? 'Job: ' + c.for : null, isoish(c.d) ? 'Date: ' + nice(c.d, { year: 'numeric' }) : null, c.where ? 'Where: ' + c.where : null, fee ? 'Fee: ' + money(fee) + ' incl. GST' : null, fee && Number(c.depPct) ? 'Deposit: ' + c.depPct + '% (' + money(dep) + ') to book, balance ' + money(bal) + ' due ' + c.balDays + ' days before' : null].filter(Boolean).join(' · '), ...c.clauses.filter(cl => cl.h || cl.b).map((cl, i) => (cl.h ? (i + 1) + '. ' + cl.h + '\n' : '') + cl.b)].filter(Boolean).join('\n\n')
  const liveSave = async sendIt => {
    if (busy) return
    if (!c.to.n.trim()) return toast('Type who it is for.')
    if (sendIt && !/\S+@\S+\.\S+/.test(c.to.em || '')) return toast('An email address to send it to.')
    if (!c.clauses.some(cl => cl.b.trim())) return toast('Add at least one clause.')
    setBusy(sendIt ? 'send' : 'save')
    try {
      const row = await live.saveContractLive({ to: c.to, title: c.title, project: c.for, date: isoish(c.d) ? c.d : null, content: contentText(), notes: c.notes }, F.me, raw)
      if (sendIt) await live.sendDocLive('c', row.id)
      setDirty(false); await F.refreshLive()
      toast(sendIt ? 'Contract sent to ' + c.to.n + ' at ' + c.to.em + '. They sign on their phone.' : 'Contract saved as a draft.')
      nav(sendIt ? base : '/app/contract/C-' + String(row.id).slice(0, 8).toUpperCase(), { replace: true })
    } catch (e) { toast(e.message) } finally { setBusy('') }
  }
  const tpl = T.find(t => t.id === c.template)
  // ── save / send / sign ──
  const record = st => ({ k: 'c', who: c.to.n || client?.n || 'Client', d: (tpl?.n || c.title) + (c.for ? ' · ' + c.for : ''), date: isoish(c.d) ? c.d : c.issued, st: st === 'Sent' ? 'sent' : st === 'Signed' ? 'pink' : 'grey', stt: st, v: Math.round(fee), t: c.client || existing?.t, doc: c })
  const save = (st = status) => { if (LIVE) return liveSave(false); if (existing) F.upd('ledger', existing.id, record(st)); else F.add('ledger', { id: c.no, ...record(st) }, 'c'); setDirty(false); return c.no }
  const send = () => {
    if (LIVE) return liveSave(true)
    if (!c.to.n && !client) return toast('Pick a client, or type who it is for.')
    if (!c.clauses.length) return toast('Add at least one clause.')
    const signed = { ...c, sig: { ...c.sig, me: c.sig.me || TODAY } }; setC(signed)
    const no = c.no; const tid = c.client || existing?.t
    const rec = { ...record('Sent'), doc: signed }; if (existing) F.upd('ledger', existing.id, rec); else F.add('ledger', { id: no, ...rec }, 'c'); setDirty(false)
    if (tid) { F.upd('threads', tid, t => ({ docs: [...t.docs.filter(d => !d[0].includes(no)), ['Contract #' + no, 'sent', 'Sent']], line: [...t.line.filter(m => !m.doc?.includes(no)), { doc: 'Contract #' + no + (c.for ? ' · ' + c.for : ''), d: c.clauses.length + ' clauses · plain English · ' + (fee ? money(fee) + ' · ' : '') + 'sign on your phone', st: 'sent', stt: 'Sent' }], last: 'Contract ' + no + ' sent', need: false, next: 'Contract sent, waiting on signature', stage: Math.max(t.stage, 2) })) }
    toast('Contract ' + no + ' sent to ' + (c.to.n || client.n) + (c.to.em ? ' at ' + c.to.em : '') + '. They sign on their phone.'); nav(base)
  }
  const signed = async () => { if (LIVE) { if (!raw || busy) return; setBusy('sign'); try { await live.setDocStatus('c', raw.id, 'signed', { signed_at: new Date().toISOString() }); await F.refreshLive(); toast('Marked signed.'); nav(base) } catch (e) { toast(e.message) } finally { setBusy('') } return } save(status); F.markSigned(existing.id); setC(x => ({ ...x, sig: { ...x.sig, them: TODAY } })) }
  const copyLink = () => { const link = LIVE ? (raw?.signing_token ? location.origin + '/sign/' + raw.signing_token : '') : 'https://lenstrybe.com/sign/' + c.no.toLowerCase(); if (!link) return toast('Save the contract first.'); navigator.clipboard?.writeText(link)?.catch(() => {}); toast('Signing link copied · ' + link) }
  const print = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write('<html><head><title>Contract ' + c.no + '</title><style>body{font-family:Inter,-apple-system,sans-serif;color:#14111a;padding:40px;max-width:720px;margin:auto;line-height:1.55}input,textarea{border:0;background:none;font:inherit;color:inherit;padding:0;resize:none;width:100%}.rm,.addcl,.hint,.pick,.ctl,.chip{display:none}.ptop{display:flex;justify-content:space-between}.parties,.sigs{display:grid;grid-template-columns:1fr 1fr;gap:24px}.job{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:18px 0;padding:14px;background:#f6f5f3;border-radius:10px}.cl{margin:0 0 14px}.cl .ch{font-weight:700}textarea{height:auto}</style></head><body>' + paper.current.innerHTML + '</body></html>'); w.document.close(); setTimeout(() => w.print(), 300) }
  const del = () => F.confirm({ title: 'Delete ' + c.no + '?', body: 'It comes out of the ledger and the thread.', cta: 'Delete', danger: true, onYes: async () => { if (LIVE && raw) { try { await live.deleteDocLive('c', raw.id); await F.refreshLive() } catch (e) { return toast(e.message) } } else if (existing) F.removeDoc(existing.id); nav(base) } })
  const B = brandFor(s.brand, 'c'), acc = B.accent || '#8DF3D6', PP = paperOf(B.paper); useEffect(() => { loadFont(B.head); loadFont(B.body) }, [B.head, B.body])
  const chip = status === 'Signed' ? 'ok' : status === 'Sent' ? 'sent' : 'grey'
  return (
    <section className="view inved">
      <div className="vh">
        <div><Link to={base} className="lnk back"><Icon name="back" size={13} />Contracts</Link><h1>{existing ? 'Contract' : 'New contract'} <em>{c.no}</em></h1><p>{status === 'Draft' ? 'This is what the client reads and signs. Tap any word to change it.' : status === 'Sent' ? 'Sent ' + nice(existing.date) + ' · waiting on a signature' : 'Signed' + (c.sig.them ? ' ' + nice(c.sig.them) : '')}</p></div>
        <div className="acts">
          {existing && status === 'Sent' && <button className="btn g" onClick={signed} disabled={!!busy}><Icon name="sign" size={15} />Mark signed</button>}
          {existing && status !== 'Draft' && <button className="btn g" onClick={copyLink}><Icon name="globe" size={15} />Signing link</button>}
          <button className="btn g" onClick={print}><Icon name="deliver" size={15} />PDF</button>
          {status !== 'Signed' && <button className={'btn g' + (dirty ? '' : ' quiet')} onClick={() => { if (LIVE) return liveSave(false); save(); toast('Saved.') }} disabled={!!busy}>{busy === 'save' ? 'Saving' : dirty ? 'Save draft' : 'Saved'}</button>}
          {status !== 'Signed' && <button className="btn w" onClick={send} disabled={!!busy}><Icon name="arrow" size={15} />{busy === 'send' ? 'Sending' : status === 'Sent' ? 'Send again' : 'Send for signing'}</button>}
        </div>
      </div>
      <div className="grid">
        <div className="s8">
          <div className={'paper inv con lay-' + B.layout + (B.paper === 'dark' ? ' dark' : '')} ref={paper} style={{ '--acc': acc, '--pp': PP[2], '--pi': PP[3], '--rad': (B.radius ?? 12) + 'px', fontFamily: fam(B.body || 'Inter') }}>
            <div className="ptop">
              <div className="from">
                <b>{B.logo ? <img className="blogo" src={B.logo} alt="" /> : <span className="mark" style={{ background: acc }} />}<Ed v={c.from.biz} set={v => upFrom('biz', v)} ph="Your business" cls="big" /></b>
                <Ed v={c.from.addr} set={v => upFrom('addr', v)} ph="Address" cls="sm" />
                <Ed v={c.from.em} set={v => upFrom('em', v)} ph="Email" cls="sm" />
                <span className="sm abn">ABN <Ed v={c.from.abn} set={v => upFrom('abn', v)} ph="00 000 000 000" cls="sm inline" w={130} /></span>
              </div>
              <div className="meta">
                <h3 style={{ fontFamily: fam(B.head || 'Inter') }}>Agreement</h3>
                <div className="mrow"><span>Number</span><Ed v={c.no} set={v => up({ no: v })} right w={110} /></div>
                <div className="mrow"><span>Dated</span><Ed v={c.issued} set={v => up({ issued: v })} type="date" right w={140} /></div>
                <span className={'chip ' + chip}>{status}</span>
              </div>
            </div>

            <Ed v={c.title} set={v => up({ title: v })} ph="Wedding photography agreement" cls="ctitle" />
            <div className="parties">
              <div className="party">
                <small>Between</small>
                <Ed v={c.from.biz} set={v => upFrom('biz', v)} ph="Your business" cls="big" />
                <Ed v={c.from.n} set={v => upFrom('n', v)} ph="Your name" cls="sm" />
                <Ed v={c.from.ph} set={v => upFrom('ph', v)} ph="Phone" cls="sm" />
                <em>the Photographer</em>
              </div>
              <div className="party to">
                <small>And</small>
                <div className="pick"><select value={c.client} onChange={e => pickClient(e.target.value)}><option value="">{LIVE ? 'Pick a client thread…' : 'Pick from Contacts…'}</option>{(LIVE ? [...s.threads.map(t => ({ id: t.id, n: t.n })), ...s.people.filter(p => !s.threads.some(t => t.id === p.id)).map(p => ({ id: p.id, n: p.n }))] : s.people).map(p => <option key={p.id} value={p.id}>{p.n}</option>)}</select></div>
                <Ed v={c.to.n} set={v => upTo('n', v)} ph="Client name" cls="big" />
                <Ed v={c.to.co} set={v => upTo('co', v)} ph="Contact or company" cls="sm" />
                <Ed v={c.to.addr} set={v => upTo('addr', v)} ph="Address" cls="sm" />
                <Ed v={c.to.em} set={v => upTo('em', v)} ph="Email" cls="sm" />
                <Ed v={c.to.ph} set={v => upTo('ph', v)} ph="Phone" cls="sm" />
                <em>the Client</em>
              </div>
            </div>

            <div className="job">
              <div className="jr"><small>The job</small><Ed v={c.for} set={v => up({ for: v })} ph="Wedding · Maleny Manor" /></div>
              <div className="jr"><small>Date</small><Ed v={c.d} set={v => up({ d: v })} type="date" /></div>
              <div className="jr"><small>Location</small><Ed v={c.where} set={v => up({ where: v })} ph="Maleny Manor, then Noosa Main Beach" /></div>
              <div className="jr"><small>Hours</small><Ed v={c.hours} set={v => up({ hours: v })} ph="10 hours, 12 pm to 10 pm" /></div>
              <div className="jr"><small>Fee incl. GST</small><span className="jm"><i>$</i><Ed v={c.fee} set={v => up({ fee: v })} type="number" ph="0" w={110} /></span></div>
              <div className="jr"><small>Deposit</small><span className="jm"><Ed v={c.depPct} set={v => up({ depPct: v })} type="number" w={34} right /><i>%</i><span className="calc">{fee ? money(dep) + ' to book' : 'to book'}</span></span></div>
              <div className="jr"><small>Balance</small><span className="jm"><span className="calc">{fee ? money(bal) + ' due' : 'due'}</span><Ed v={c.balDays} set={v => up({ balDays: v })} type="number" w={30} right /><span className="calc">days before</span></span></div>
              {status === 'Draft' && <div className="jr"><small>Offer open until</small><Ed v={c.until} set={v => up({ until: v })} type="date" /></div>}
            </div>

            <ol className="clist">
              {c.clauses.map((cl, i) => <li key={i} className="cl">
                <div className="chd"><span className="n">{i + 1}.</span><Ed v={cl.h} set={v => upCl(i, 'h', v)} ph="Clause heading" cls="ch" />
                  <span className="ctl"><button type="button" aria-label="Move up" onClick={() => moveCl(i, -1)} disabled={i === 0}><Icon name="chev" size={11} style={{ transform: 'rotate(-90deg)' }} /></button><button type="button" aria-label="Move down" onClick={() => moveCl(i, 1)} disabled={i === c.clauses.length - 1}><Icon name="chev" size={11} style={{ transform: 'rotate(90deg)' }} /></button><button type="button" className="rm" aria-label="Remove clause" onClick={() => up(x => ({ ...x, clauses: x.clauses.filter((_, j) => j !== i) }))}><Icon name="x" size={11} /></button></span></div>
                <Ed v={cl.b} set={v => upCl(i, 'b', v)} multi ph="What this clause says, in plain English." cls="cb" />
              </li>)}
            </ol>
            <div className="addcl"><button type="button" onClick={() => up(x => ({ ...x, clauses: [...x.clauses, { h: '', b: '' }] }))}><Icon name="plus" size={12} />Add a clause</button>{tpl && <button type="button" onClick={() => applyTemplate(tpl.id)}>Reset to {tpl.n}</button>}</div>

            <div className="sigs">
              <div className="sig"><small>The Photographer</small>{c.sig.me ? <svg viewBox="0 0 300 70" preserveAspectRatio="none"><path d={SIG} /></svg> : <span className="line" />}<b>{c.from.n || c.from.biz}</b><span>{c.sig.me ? 'Signed ' + nice(c.sig.me, { year: 'numeric' }) : 'Signs when sent'}</span></div>
              <div className="sig"><small>The Client</small>{c.sig.them ? <svg viewBox="0 0 300 70" preserveAspectRatio="none"><path d={SIG} /></svg> : <span className="line" />}<b>{c.to.n || 'Client'}</b><span>{c.sig.them ? 'Signed ' + nice(c.sig.them, { year: 'numeric' }) : 'Signs on their phone from the link in the thread'}</span></div>
            </div>
            <div className="pfoot"><span style={{ color: acc }}>{s.brand.foot}</span><span>{c.from.biz} · ABN {c.from.abn}</span></div>
          </div>
        </div>

        <div className="s4 side sticky">
          <div className="card lg"><div className="h"><b>Template</b><Link className="lnk" to="/app/contracts?tab=templates">All templates <Icon name="arrow" size={12} /></Link></div>
            <div className="tpls">{T.map(t => <button key={t.id} type="button" className={'tpl' + (c.template === t.id ? ' on' : '')} onClick={() => applyTemplate(t.id)}><b>{t.n}</b><small>{t.clauses.length} clauses{t.sub ? ' · ' + t.sub : ''}</small></button>)}</div>
            <button className="lnk" style={{ marginTop: 10 }} onClick={() => F.saveTemplate(c, tid => up({ template: tid }))}><Icon name="plus" size={12} /> Save this as a template</button>
          </div>
          <div className="card lg"><div className="h"><b>Client</b>{client && <Link className="lnk" to={'/app/thread/' + client.id}>Thread <Icon name="arrow" size={12} /></Link>}</div>
            <p className="note2">{client ? client.n + ' · ' + (client.em || 'no email') + '. Filled from Contacts; change anything on the contract itself.' : 'Pick from Contacts on the contract, or type the details straight in. '}{!client && <button className="lnk" onClick={() => F.newClient(r => pickClient(r.pid))}>Add a new client</button>}</p>
          </div>
          <div className="tlumi"><span className="lm" /><div>{status === 'Draft' ? 'Sending puts it in the thread with a link. They read it on their phone, tap to sign, and you both get a PDF. I nudge them after 48 hours if it is still open.' : status === 'Sent' ? 'Waiting on ' + (c.to.n || 'the client') + '. I will nudge after 48 hours. If they signed on paper, mark it signed here.' : 'Signed and locked. Any change now is a new contract.'}{status === 'Draft' && c.clauses.length > 14 && <> This one is getting long; the ones that get signed fastest are under a dozen clauses.</>}</div></div>
          {existing && status !== 'Signed' && <button className="lnk" style={{ opacity: .6 }} onClick={del}>Delete contract</button>}
        </div>
      </div>
    </section>
  )
}
