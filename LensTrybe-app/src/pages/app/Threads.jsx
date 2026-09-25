import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { STAGES } from '../../data/workspace'
import { fmt } from '../../lib/format'
import { LIVE } from '../../lib/mode'
import * as live from '../../lib/live'

const FILTERS = [['need', 'Needs me', t => t.need], ['active', 'Active', t => t.stage < 6], ['quoted', 'Quoted', t => t.stage === 1], ['delivered', 'Delivered', t => t.stage >= 6], ['all', 'All', () => true]]

// Threads: the list on the left, the open thread on the right, one screen. A job is one thread
// from enquiry to review, and the client sees the same thread on their phone.
export default function Threads() {
  const { id } = useParams(); const nav = useNavigate(); const F = useFlows(); const { s } = F
  const [f, setF] = useState('need'), [q, setQ] = useState('')
  const T = s.threads
  const list = useMemo(() => { const fn = FILTERS.find(x => x[0] === f)[2]; return T.filter(t => fn(t) && (!q || (t.n + ' ' + t.j).toLowerCase().includes(q.toLowerCase()))) }, [T, f, q])
  const cur = T.find(t => t.id === id) || list[0] || T[0]
  useEffect(() => { if (id && !T.find(t => t.id === id)) nav('/app/threads', { replace: true }) }, [id, nav, T])
  return (
    <section className="view fill">
      <div className="tw">
        <aside className="tlist lg">
          <div className="tlh">
            <h1>Threads</h1>
            <button className="btn w sm" onClick={F.newThread}><Icon name="plus" size={14} />New</button>
          </div>
          <label className="tsearch"><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a client or job" aria-label="Search threads" /></label>
          <div className="tfilt">{FILTERS.map(([k, l, fn]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}<i>{T.filter(fn).length}</i></button>)}</div>
          <div className="trows">
            {list.map(t => (
              <button key={t.id} type="button" className={'tli' + (cur?.id === t.id ? ' on' : '') + (t.need ? ' need' : '')} onClick={() => nav('/app/thread/' + t.id)}>
                <span className="av" style={{ background: t.g }} />
                <div className="tx"><div className="r1"><b>{t.n}</b><small>{t.d}</small></div><span className="r2">{t.j}</span><span className="r3">{t.need ? <i>{t.next}</i> : t.next}</span></div>
                <div className="stg" aria-label={STAGES[t.stage]}>{STAGES.map((_, i) => <i key={i} className={i < t.stage ? 'd' : i === t.stage ? 'c' : ''} />)}</div>
              </button>
            ))}
            {!list.length && <div className="tempty">Nothing here. <button className="lnk" onClick={() => setF('all')}>Show all threads</button></div>}
          </div>
        </aside>
        {cur ? <ThreadPane t={cur} key={cur.id} F={F} /> : <div className="tp lg"><div className="tempty" style={{ padding: 60 }}>No threads yet. <button className="lnk" onClick={F.newThread}>Start one</button></div></div>}
      </div>
    </section>
  )
}

function ThreadPane({ t, F }) {
  const { s, toast, say } = F; const [v, setV] = useState(''), [info, setInfo] = useState(false); const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [t.line.length])
  useEffect(() => { if (LIVE && t.unread) { live.markRead(t); F.upd('threads', t.id, { unread: 0 }) } }, [t.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const first = t.n.split(' ')[0]
  const docs = s.ledger.filter(r => r.t === t.id)
  const quick = x => { if (x === 'Quote') F.newDoc('q', { client: t.id }); else if (x === 'Invoice') F.newDoc('inv', { client: t.id }); else if (x === 'Contract') F.newDoc('c', { client: t.id }); else if (x === 'Call sheet') callSheet(); else if (x === 'Meeting') F.newMeeting({ client: t.id }); else if (x === 'Gallery') F.newGallery({ client: t.id, d: t.j }); else if (x === 'Review') F.askReview(t.id) }
  const callSheet = () => F.open({ title: 'Call sheet · ' + t.n, sub: 'Goes into the thread. The client and crew see the same one.', cta: 'Send call sheet', fields: [{ k: 'arrive', l: 'Arrive', type: 'time', half: true, value: '09:30' }, { k: 'start', l: 'First shot', type: 'time', half: true, value: '10:00' }, { k: 'where', l: 'Where', value: t.j.split(' · ')[1] || '' }, { k: 'notes', l: 'Notes', type: 'textarea', rows: 4, placeholder: 'Timings, parking, who to find on arrival' }], submit: x => { say(t.id, 'doc', 'Call sheet', { d: 'Arrive ' + x.arrive + ' · first shot ' + x.start + (x.where ? ' · ' + x.where : ''), st: 'ok', stt: 'Sent' }); F.upd('threads', t.id, { need: false, next: 'Call sheet sent' }); toast('Call sheet sent to ' + t.n + '.') } })
  // Lumi's suggested actions in the timeline, wired to the real thing
  const lumiAct = a => {
    const l = a.toLowerCase()
    if (l.includes('reply')) return t.id === 'ruby' ? F.replyRuby() : F.reply(t.id, '', { cta: a })
    if (l.includes('nudge')) return F.nudge(t.id)
    if (l.includes('contract')) return F.sendContract(t.id)
    if (l.includes('call sheet')) return callSheet()
    if (l === 'wait') return F.wait(t.id)
    if (l === 'discard') { F.upd('threads', t.id, tt => ({ need: false, next: 'Draft discarded', line: tt.line.map(m => m.acts ? { ...m, acts: undefined } : m) })); return toast('Draft discarded.') }
    if (l === 'edit') return F.reply(t.id, '', { cta: 'Send' })
    toast(a + ': done')
  }
  const send = () => {
    const x = v.trim(); if (!x) return
    if (x.startsWith('/')) { const c = x.slice(1).split(' ')[0].toLowerCase(); const map = { quote: 'Quote', invoice: 'Invoice', contract: 'Contract', callsheet: 'Call sheet', meeting: 'Meeting', gallery: 'Gallery', review: 'Review' }; if (map[c]) { quick(map[c]); setV(''); return } toast('Try /quote, /invoice, /contract, /callsheet, /meeting, /gallery or /review'); return }
    // stay on this thread even when the reply takes it off the "Needs me" list
    if (location.pathname !== '/app/thread/' + t.id) F.nav('/app/thread/' + t.id, { replace: true })
    setV(''); F.sendMessage(t.id, x).then(ok => { if (!ok) setV(x) })
  }
  return (
    <div className="tp lg">
      <div className="tph">
        <span className="av" style={{ background: t.g }} />
        <div className="tx"><h2>{t.n}</h2><p>{t.s}</p></div>
        <div className="acts">
          <button className="ic2" title="Job details" aria-label="Job details" aria-pressed={info} onClick={() => setInfo(i => !i)}><Icon name="doc" size={15} /></button>
          <button className="ic2" title="Copy client link" aria-label="Copy client link" onClick={() => { const link = LIVE ? (t.live?.portal_token ? location.origin + '/portal/' + t.live.portal_token : '') : 'https://' + t.id + '.lenstrybe.com'; if (!link) return toast('No client link yet. It is made when you first reply.'); try { navigator.clipboard?.writeText(link)?.catch(() => {}) } catch {} toast('Client link copied · ' + link) }}><Icon name="globe" size={15} /></button>
          <button className="btn w sm" onClick={() => { const e = s.events.find(e => e.t === t.id && e.d >= '2026-09-22'); if (e) F.nav('/app/bookings'); else F.newBooking('', { client: t.id, what: t.j, v: t.v }) }}><Icon name="cal" size={14} />{t.d}</button>
        </div>
      </div>
      <div className="stages">{STAGES.map((st, i) => <button type="button" key={st} className={i < t.stage ? 'd' : i === t.stage ? 'c' : ''} onClick={() => { F.upd('threads', t.id, { stage: i }); toast('Stage: ' + st) }} title={'Set stage to ' + st}><i />{st}</button>)}</div>
      <div className={'tpb' + (info ? ' info' : '')}>
        <div className="tline">
          {t.line.map((m, i) => m.them ? <div key={i} className="tm them">{m.them}<span className="w">{m.w || m.at}</span></div> : m.me ? <div key={i} className="tm me">{m.me}<span className="w">{m.w || m.at}</span></div> : m.sys ? <div key={i} className="tsys">{m.sys}</div> : m.doc ? <div key={i} className="tdoc"><span className="ic"><Icon name="doc" /></span><div><b>{m.doc}</b><small>{m.d}</small></div><span className={'st ' + m.st}>{m.stt}</span></div> : <div key={i} className="tlumi"><span className="lm" /><div>{m.lumi}{m.acts && <div className="acts">{m.acts.map((a, j) => <button key={a} className={j ? '' : 'y'} onClick={() => lumiAct(a)}>{a}</button>)}</div>}</div></div>)}
          <div ref={end} />
        </div>
        <aside className="tinfo">
          <div className="blk"><b>Job</b>{t.job.map(([k, val]) => <div key={k} className="kv"><span>{k}</span><b>{val}</b></div>)}{!t.job.some(j => j[0] === 'Total') && t.v > 0 && <div className="kv"><span>Total</span><b>{fmt(t.v)}</b></div>}</div>
          {docs.length > 0 && <div className="blk"><b>Documents</b>{docs.map(r => <div key={r.id} className="kv" style={{ cursor: 'pointer' }} onClick={() => F.docAction(r)} title={F.docActionLabel(r)}><span>{r.id}</span><span className={'st ' + r.st}>{r.stt}</span></div>)}</div>}
          <div className="blk"><b>Quick</b><div className="qk">{['Quote', 'Invoice', 'Contract', 'Call sheet', 'Meeting', 'Gallery', 'Review'].map(x => <button key={x} className="chip" onClick={() => quick(x)}>{x}</button>)}</div></div>
          <div className="blk"><b>Client</b><Link className="lnk" to="/app/clients" onClick={() => { try { sessionStorage.setItem('lt-client', t.id) } catch {} }}>Open contact <Icon name="arrow" size={12} /></Link></div>
        </aside>
      </div>
      <div className="compose"><span className="lm" aria-hidden="true" /><input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={`Message ${first}, or type / for a quote, invoice, contract or call sheet`} /><button onClick={send} aria-label="Send"><Icon name="arrow" /></button></div>
    </div>
  )
}
