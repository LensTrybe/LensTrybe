import { useState } from 'react'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { answer } from './CommandBar'

// Lumi, docked: approvals first, questions second. Each approval runs the real flow, so a yes here
// is the same as a yes on Today or in the thread.
export default function Dock({ onClose }) {
  const F = useFlows(); const { s, toast, upd } = F
  const [tab, setTab] = useState(0), [chat, setChat] = useState([{ l: 'Ask me anything about your business. I read the threads, the calendar, the money and your inbox before I answer.' }]), [q, setQ] = useState('')
  const acts = s.actions, left = acts.filter(a => !a.done).length
  const mark = (id, skipped) => upd('actions', id, { done: true, skipped })
  const decide = (a, yes) => {
    const ok = () => mark(a.id, false), no = () => mark(a.id, true)
    if (a.id === 1) { if (yes) { ok(); toast('Kept. 14 Nov stays pencilled for Coastline.') } else { const e = s.events.find(x => x.d === '2026-11-14'); if (e) F.releaseEvent(e.id); no() } return }
    if (a.id === 2) { if (yes) F.nudge('coastline', { then: ok }); else { F.wait('coastline'); no() } return }
    if (a.id === 4) { if (yes) F.replyRuby(ok); else { F.nav('/app/thread/ruby'); no() } return }
    if (a.id === 5) { if (yes) F.offerGap(ok); else { no(); toast('Not now. Lumi asks again Thursday.') } return }
    if (yes) { ok(); toast('Done. Logged, undoable for 24 hours.') } else { no(); toast('Skipped. Lumi will not ask again.') }
  }
  const ask = () => { const v = q.trim(); if (!v) return; setQ(''); setTab(1); setChat(c => [...c, { u: v }]); setTimeout(() => setChat(c => [...c, { l: answer(v, s) }]), 600) }
  return (
    <aside className="dock lg" aria-label="Lumi">
      <div className="dh"><span className="lm" /><div><b>Lumi</b><small>{left ? left + ' waiting for your yes' : 'All caught up. Nothing needs you.'}</small></div><button className="hide" onClick={onClose} aria-label="Put Lumi away" title="Put Lumi away"><Icon name="x" size={15} /></button></div>
      <div className="tabs"><button className={tab === 0 ? 'on' : ''} onClick={() => setTab(0)}>Approvals{left > 0 && <i className="n">{left}</i>}</button><button className={tab === 1 ? 'on' : ''} onClick={() => setTab(1)}>Ask</button></div>
      <div className="body">
        <div className={'pane' + (tab === 0 ? ' on' : '')}>{acts.map(a => <div key={a.id} className={'act' + (a.done ? (a.skipped ? ' no' : ' ok') : '')}><span className="t">{a.t}</span><b>{a.b}</b><p>{a.p}</p><div className="do">{a.done ? <span className={'st ' + (a.skipped ? 'grey' : 'ok')}>{a.skipped ? 'Skipped' : 'Done'}</span> : <><button className="y" onClick={() => decide(a, true)}>{a.y}</button><button onClick={() => decide(a, false)}>{a.n}</button></>}</div></div>)}</div>
        <div className={'pane chat' + (tab === 1 ? ' on' : '')}>{chat.map((m, i) => <div key={i} className={'m ' + (m.u ? 'u' : 'l')}>{m.u || m.l}</div>)}</div>
      </div>
      <div className="in"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="Ask Lumi" /><button onClick={ask} aria-label="Send"><Icon name="arrow" /></button></div>
    </aside>
  )
}
