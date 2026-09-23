import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFlows } from '../../lib/flows'
import { DIALS } from '../../data/workspace'
import { answer } from './CommandBar'

// Lumi's own page: the dials that say what she may do on her own, and a place to ask.
export default function Lumi() {
  const F = useFlows(); const { s, toast } = F; const [p] = useSearchParams()
  const d = s.settings.dials || DIALS.map(x => x[2])
  const [chat, setChat] = useState([{ u: 'How did August go?' }, { l: answer('august', s) }])
  useEffect(() => { const q = p.get('q'); if (q) { setChat(c => [...c, { u: q }]); setTimeout(() => setChat(c => [...c, { l: answer(q, s) }]), 500) } }, [p]) // eslint-disable-line
  const week = { replied: s.threads.filter(t => t.line.some(m => m.me && m.at === 'Just now')).length + 3, held: s.events.filter(e => e.k === 'p').length, chased: s.ledger.filter(r => r.stt === 'Chased' || r.stt === 'Nudged').length + 1, quotes: s.ledger.filter(r => r.k === 'q' && r.date >= '2026-09-15').length }
  return (
    <section className="view on">
      <div className="vh"><div><h1><span className="lm" style={{ verticalAlign: -2, marginRight: 8 }} />Lumi</h1><p>Reads your threads, calendar, money and inbox. Acts inside the dials you set. Everything logged, everything undoable.</p></div></div>
      <div className="grid">
        <div className="card lg" style={{ gridColumn: 'span 7' }}><div className="h"><b>Autonomy dials</b><small style={{ color: 'var(--ink-3)' }}>Do it · Ask me · Never</small></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>{DIALS.map(([n, sub], i) => <div key={n} className="dial"><b>{n}</b><small>{sub}</small><div className="seg">{['Do it', 'Ask me', 'Never'].map((o, j) => <button key={o} className={(d[i] === j ? 'on' : '') + (d[i] === j && j === 0 ? ' auto' : '')} onClick={() => { F.patch('settings', { dials: d.map((v, k) => k === i ? j : v) }); toast('Saved. ' + n + ': ' + o) }}>{o}</button>)}</div></div>)}</div></div>
        <div className="card lg" style={{ gridColumn: 'span 5' }}><div className="h"><b>This week, Lumi</b></div>
          <div className="kv"><span>Replied to enquiries</span><b>4 drafts, {week.replied} sent</b></div><div className="kv"><span>Dates held</span><b>{week.held}</b></div><div className="kv"><span>Invoices chased</span><b>{week.chased} · 1 paid</b></div><div className="kv"><span>Quotes drafted</span><b>{week.quotes}</b></div><div className="kv"><span>Hours saved, estimate</span><b>6.5</b></div>
          <div className="chat" style={{ marginTop: 14 }}>{chat.map((m, i) => <div key={i} className={'m ' + (m.u ? 'u' : 'l')}>{m.u || m.l}</div>)}</div></div>
      </div>
    </section>
  )
}
