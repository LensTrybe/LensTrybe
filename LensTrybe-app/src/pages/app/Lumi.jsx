import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { DIALS } from '../../data/workspace'
import { answer } from './CommandBar'
import { LIVE } from '../../lib/mode'
import LumiChat from './LumiChat'
import { lumiList, lumiDelete, lumiPin, lumiRename, useLumiUsage, usageLine } from '../../lib/lumi'

export default function Lumi() { return LIVE ? <LiveLumi /> : <DemoLumi /> }

const when = iso => { if (!iso) return ''; const d = new Date(iso), now = new Date(); const days = Math.floor((now - d) / 86400000); if (days < 1 && d.getDate() === now.getDate()) return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase(); if (days < 7) return d.toLocaleDateString('en-AU', { weekday: 'short' }); return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) }
const CHIPS = ['Who owes me money?', 'What needs a reply?', "What's coming up this month?", 'How do I send a quote?', 'Write a follow up for my oldest unpaid invoice']

// Live (item 18): a real chat with history. Conversations on the left, newest first, pinned on
// top; the chat on the right. On a phone, the list then the chat, like Threads. A question typed
// in the ask bar arrives as ?q= and starts a new chat; ?c= opens one from the dock.
function LiveLumi() {
  const [p, setP] = useSearchParams(); const loc = useLocation(); const { toast, confirm } = useFlows(); const u = useLumiUsage()
  const [list, setList] = useState(null), [cur, setCur] = useState({ id: null, messages: [] }), [opened, setOpened] = useState(false), [ask, setAsk] = useState(null)
  const load = () => lumiList().then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [])
  // Arrivals from the ask bar or the dock.
  useEffect(() => {
    const q = p.get('q'), c = p.get('c')
    if (q) { setCur({ id: null, messages: [] }); setAsk({ t: q }); setOpened(true); setP({}, { replace: true }) }
    else if (c) {
      // From the dock: show what it had straight away, then fetch the list so the chat is in it.
      const m = loc.state?.messages; if (m) { setCur({ id: c, messages: m }); setOpened(true) }
      lumiList().then(l => { setList(l); const x = l.find(v => v.id === c); if (x) { setCur({ id: x.id, messages: x.messages || [] }); setOpened(true) } }).catch(() => {})
      setP({}, { replace: true })
    }
  }, [p]) // eslint-disable-line react-hooks/exhaustive-deps
  const change = n => {
    setCur(o => ({ ...o, ...n, id: n.id || o.id }))
    // Keep the list in step without another round trip: new chats appear on top with their title.
    if (n.id) setList(l => { const rest = (l || []).filter(v => v.id !== n.id); const old = (l || []).find(v => v.id === n.id); const row = { ...(old || { pinned: false, title: 'New conversation' }), id: n.id, title: n.title || old?.title || 'New conversation', messages: n.messages, updated_at: new Date().toISOString() }; const pinned = rest.filter(v => v.pinned); return row.pinned ? [row, ...rest] : [...pinned, row, ...rest.filter(v => !v.pinned)] })
  }
  const fresh = () => { setCur({ id: null, messages: [] }); setAsk(null); setOpened(true) }
  const pick = x => { setCur({ id: x.id, messages: x.messages || [] }); setAsk(null); setOpened(true) }
  const row = list?.find(v => v.id === cur.id)
  const pin = async () => { if (!row) return; const v = !row.pinned; try { await lumiPin(row.id, v); setList(l => l.map(x => x.id === row.id ? { ...x, pinned: v } : x).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))); toast(v ? 'Pinned to the top.' : 'Unpinned.') } catch { toast('That didn\'t save. Try again.') } }
  const rename = async t => { if (!row || !t.trim() || t === row.title) return; try { await lumiRename(row.id, t.trim()); setList(l => l.map(x => x.id === row.id ? { ...x, title: t.trim() } : x)) } catch { toast('That didn\'t save. Try again.') } }
  const remove = () => row && confirm({ title: 'Delete this chat?', body: row.title, cta: 'Delete', danger: true, onYes: async () => { await lumiDelete(row.id); setList(l => l.filter(x => x.id !== row.id)); setCur({ id: null, messages: [] }); setOpened(false); toast('Chat deleted.') } })
  return (
    <section className="view fill">
      <div className={'tw lumi' + (opened ? ' open' : '')}>
        <aside className="tlist lg">
          <div className="tlh"><h1><span className="lm" style={{ verticalAlign: -2, marginRight: 8 }} />Lumi</h1><button className="btn w sm" onClick={fresh}><Icon name="plus" size={14} />New chat</button></div>
          {u && <p className="lusage">{usageLine(u)}</p>}
          <div className="trows">
            {list === null && <div className="tempty">Loading your chats</div>}
            {list?.map(x => <button key={x.id} type="button" className={'tli' + (cur.id === x.id ? ' on' : '')} onClick={() => pick(x)}><span className="nic"><Icon name={x.pinned ? 'star' : 'spark'} size={15} /></span><div className="tx"><div className="r1"><b>{x.title || 'New conversation'}</b><small>{when(x.updated_at)}</small></div><span className="r2">{(x.messages || []).filter(m => m.role === 'assistant').slice(-1)[0]?.content?.replace(/[*#]/g, '').slice(0, 90) || 'No answer yet'}</span></div></button>)}
            {list && !list.length && <div className="tempty">No chats yet. Ask Lumi anything on the right.</div>}
          </div>
        </aside>
        <div className="tp lg lpane">
          <div className="tph">
            <button type="button" className="tback" aria-label="All chats" onClick={() => setOpened(false)}><Icon name="back" size={16} /></button>
            <div className="tx">{row ? <input className="ntitle" defaultValue={row.title} key={row.id + row.title} onBlur={e => rename(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Chat name" /> : <b className="ltitle">New chat</b>}<p>Lumi reads your own invoices, bookings, quotes, clients and enquiries. Nothing she reads leaves your account.</p></div>
            {row && <div className="acts"><button className={'ic2' + (row.pinned ? ' on' : '')} title={row.pinned ? 'Unpin' : 'Pin to the top'} aria-label="Pin" onClick={pin}><Icon name="star" size={15} /></button><button className="ic2" title="Delete" aria-label="Delete chat" onClick={remove}><Icon name="x" size={15} /></button></div>}
          </div>
          <LumiChat big convoId={cur.id} messages={cur.messages} onChange={change} ask={ask}
            empty={<><b>What can Lumi help with?</b><p>Ask about your numbers, get a reply drafted to a client, or ask how something in LensTrybe works.</p></>}
            chips={CHIPS} placeholder="Ask Lumi anything" />
        </div>
      </div>
    </section>
  )
}

// The demo: the dials that say what she may do on her own, and a place to ask.
function DemoLumi() {
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
