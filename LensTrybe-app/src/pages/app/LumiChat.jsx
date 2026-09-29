import { Fragment, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Icon from '../../components/Icon'
import { lumiSend, lumiError, setLumiUsage } from '../../lib/lumi'

// Lumi writes light markdown: paragraphs, lists and **bold**. Draw just that, as text, so
// nothing she says can ever become HTML on the page.
function Bold({ t }) {
  const parts = String(t).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>)
}
export function LumiText({ text }) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/)
  return blocks.map((b, i) => {
    const lines = b.split('\n').filter(l => l.trim())
    if (lines.length && lines.every(l => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
      const ordered = /^\s*\d/.test(lines[0]); const L = ordered ? 'ol' : 'ul'
      return <L key={i}>{lines.map((l, j) => <li key={j}><Bold t={l.replace(/^\s*([-*•]|\d+[.)])\s+/, '')} /></li>)}</L>
    }
    if (lines.length === 1 && /^#{1,4}\s/.test(lines[0])) return <p key={i}><b>{lines[0].replace(/^#+\s/, '')}</b></p>
    return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Bold t={l.replace(/^#+\s/, '')} /></Fragment>)}</p>
  })
}

// One conversation with Lumi. The dock and the Lumi page both use it.
// messages: [{ role: 'user' | 'assistant', content }]. A failed send shows as a note, not as Lumi.
export default function LumiChat({ convoId, messages, onChange, empty, chips = [], ask, placeholder = 'Ask Lumi', big = false }) {
  const { pathname } = useLocation()
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState('')
  const end = useRef(null), inp = useRef(null), asked = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length, busy, note])

  const send = async text => {
    const v = String(text ?? q).trim(); if (!v || busy) return
    setQ(''); setNote(''); setBusy(true)
    const before = messages
    onChange({ id: convoId, messages: [...before, { role: 'user', content: v }] })
    try {
      const r = await lumiSend(v, convoId, pathname)
      setLumiUsage(r.usage)
      onChange({ id: r.conversationId, title: r.title, messages: [...before, { role: 'user', content: v }, { role: 'assistant', content: r.reply }] })
    } catch (e) {
      // Give the words back so they can send them again.
      onChange({ id: convoId, messages: before }); setQ(v); setNote(lumiError(e))
    } finally { setBusy(false); setTimeout(() => inp.current?.focus(), 0) }
  }
  // A question handed over from the ask bar sends itself once.
  useEffect(() => { if (ask?.t && asked.current !== ask) { asked.current = ask; send(ask.t) } }, [ask]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={'lchat' + (big ? ' big' : '')}>
      <div className="lmsgs" aria-live="polite">
        {!messages.length && !busy && <div className="lempty">{empty}{chips.length > 0 && <div className="lchips">{chips.map(c => <button key={c} type="button" onClick={() => send(c)}>{c}</button>)}</div>}</div>}
        {messages.map((m, i) => <div key={i} className={'m ' + (m.role === 'user' ? 'u' : 'l')}>{m.role === 'user' ? m.content : <LumiText text={m.content} />}</div>)}
        {busy && <div className="m l typing" aria-label="Lumi is thinking"><i /><i /><i /></div>}
        {note && <div className="lnote">{note}</div>}
        <div ref={end} />
      </div>
      <form className="in" onSubmit={e => { e.preventDefault(); send() }}>
        <textarea ref={inp} rows={1} value={q} maxLength={4000} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={placeholder} aria-label="Message Lumi" />
        <button type="submit" aria-label="Send" disabled={busy || !q.trim()}><Icon name="arrow" /></button>
      </form>
    </div>
  )
}
