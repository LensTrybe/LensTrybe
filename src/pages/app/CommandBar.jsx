import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { fmt } from '../../lib/format'
import { nice, iso } from '../../lib/store'

const IDX = [{ k: 'Do', n: 'Invoice Coastline Realty $1,026', m: 'from quote Q-0418' }, { k: 'Do', n: 'Block 3 Dec', m: 'calendar' }, { k: 'Do', n: 'Book Harper', m: 'new booking' }, { k: 'Do', n: 'Quote Northshore', m: 'new quote' }, { k: 'Do', n: 'Chase INV-0220', m: 'money' }, { k: 'Do', n: 'Note: keys for Coastline', m: 'notes' }, { k: 'Ask', n: 'How did August go', m: 'Lumi' }, { k: 'Ask', n: 'What Saturdays are free in December', m: 'Lumi' }, { k: 'Open', n: 'Harper and Leo', m: 'thread' }, { k: 'Open', n: 'Blackwood Events', m: 'thread' }, { k: 'Open', n: 'Open calendar', m: 'view' }, { k: 'Open', n: 'Open money', m: 'view' }, { k: 'Open', n: 'Open inventory', m: 'view' }]
// Lumi's answers, read from the store so they are true to what is on screen.
export function answer(q, s) {
  q = q.toLowerCase()
  if (q.includes('august')) return '$8,340 paid across 5 jobs, up 12% on July. Real estate was 40% of it. Your best day was the Coastline shoot at $1,520. One invoice went 9 days late and I chased it on day 3 and 8.'
  if (s && (q.includes('free') || q.includes('open') || q.includes('saturday'))) { const sats = []; const d = new Date(2026, 9, 3); while (sats.length < 6) { const k = iso(d); const e = s.events.find(x => x.d === k); sats.push(nice(k) + (e ? (e.k === 'p' ? ' is pencilled' : e.k === 'x' ? ' is blocked' : ' is booked') : ' is open')); d.setDate(d.getDate() + 7) } return 'Saturdays: ' + sats.join(', ') + '.' }
  if (s && (q.includes('owe') || q.includes('outstanding') || q.includes('overdue'))) { const o = s.ledger.filter(r => r.k === 'inv' && r.st !== 'ok'); return o.length ? 'Nothing overdue. ' + o.map(r => fmt(r.v) + ' from ' + r.who + ' is due ' + nice(r.date)).join('; ') + '. Reminders go on their own.' : 'Nothing owed to you right now.' }
  if (s && (q.includes('quote') || q.includes('waiting'))) { const o = s.ledger.filter(r => r.k === 'q' && r.st !== 'ok'); return o.length ? o.length + ' quotes waiting: ' + o.map(r => r.who + ' (' + fmt(r.v) + ', ' + r.stt.toLowerCase() + ')').join(', ') + '.' : 'No quotes waiting.' }
  if (s && (q.includes('today') || q.includes('on today'))) { const e = s.events.filter(x => x.d === '2026-09-22' && x.k !== 'x'); return e.length ? 'Today: ' + e.map(x => x.n + ' · ' + x.s).join('; ') + '.' : 'Nothing on the calendar today.' }
  if (s && q.includes('need')) { const n = s.threads.filter(t => t.need); return n.length ? n.length + ' waiting on you: ' + n.map(t => t.n + ' (' + t.next.toLowerCase() + ')').join(', ') + '.' : 'Nothing needs you right now.' }
  return 'I read your threads, calendar, money and inbox before answering. Try: how did August go, what Saturdays are free, who owes me, what needs me.'
}
// One field that does the work: actions run, questions go to Lumi.
export default function CommandBar() {
  const [q, setQ] = useState(''), [open, setOpen] = useState(false), [think, setThink] = useState(false)
  const nav = useNavigate(); const F = useFlows(); const { s, toast } = F; const ref = useRef(null)
  useEffect(() => { const k = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); ref.current?.select() } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])
  useEffect(() => { const c = e => { if (!e.target.closest('.cmd')) setOpen(false) }; document.addEventListener('click', c); return () => document.removeEventListener('click', c) }, [])
  const hits = q.trim() ? IDX.filter(x => (x.n + ' ' + x.m).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : []
  const run = v => {
    const l = v.toLowerCase(); setThink(true); setOpen(false)
    setTimeout(() => {
      setThink(false)
      const who = s.people.find(p => l.includes(p.n.split(' ')[0].toLowerCase()) || l.includes(p.id))
      const money = l.match(/\$?(\d[\d,]*)/); const amt = money ? Number(money[1].replace(/,/g, '')) : ''
      if (l.startsWith('invoice')) { const q = who && s.ledger.find(r => r.t === who.id && r.k === 'q' && r.st === 'ok'); if (q) F.invoiceFromQuote(q.id); else F.newDoc('inv', { client: who?.id, v: amt }) }
      else if (l.startsWith('quote')) F.newDoc('q', { client: who?.id, v: amt })
      else if (l.startsWith('contract')) F.newDoc('c', { client: who?.id, v: amt })
      else if (l.startsWith('expense') || l.startsWith('log ')) F.newDoc('exp', { v: amt })
      else if (l.startsWith('block')) { const m = l.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?/); const mo = m?.[2] ? ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2]) + 1 : 12; if (m) F.blockDay((mo < 9 ? '2027' : '2026') + '-' + String(mo).padStart(2, '0') + '-' + m[1].padStart(2, '0'), () => nav('/app/bookings')); else nav('/app/bookings') }
      else if (l.startsWith('book')) F.newBooking('', { client: who?.id, v: amt })
      else if (l.includes('call sheet')) nav('/app/thread/' + (who?.id || 'harper'))
      else if (l.startsWith('chase')) { const inv = s.ledger.find(r => r.k === 'inv' && r.st !== 'ok' && (!who || r.t === who.id) && (!l.match(/inv-\d+/) || r.id.toLowerCase() === l.match(/inv-\d+/)[0])); if (inv) F.chase(inv.id); else toast('Nothing to chase.') }
      else if (l.includes('nudge')) { if (who) F.nudge(who.id); else nav('/app/quotes') }
      else if (l.startsWith('reply') || l.startsWith('message')) { if (who) F.reply(who.id); else nav('/app/threads') }
      else if (l.startsWith('note')) F.newNote({ t: v.replace(/^note:?\s*/i, '') })
      else if (l.startsWith('meet') || l.startsWith('call ')) F.newMeeting({ client: who?.id })
      else if (l.startsWith('post')) F.newPost({ t: v.replace(/^post:?\s*/i, '') })
      else if (l.startsWith('open ') || l.startsWith('go to ')) { const n = l.replace(/^(open|go to) /, ''); const t = s.threads.find(x => x.n.toLowerCase().includes(n)); const page = ['today', 'threads', 'bookings', 'calendar', 'projects', 'notes', 'inventory', 'meetings', 'clients', 'crm', 'money', 'finance', 'invoicing', 'quotes', 'contracts', 'expenses', 'tax', 'brand-kit', 'website', 'deliver', 'content-calendar', 'content-ideas', 'reviews', 'marketplace', 'collaborate', 'team', 'insights', 'availability', 'jobs', 'profile', 'subscription', 'referrals', 'founding', 'settings', 'support', 'lumi'].find(k => n.replace(/ /g, '-').startsWith(k) || k.startsWith(n.replace(/ /g, '-'))); if (t) nav('/app/thread/' + t.id); else if (page) nav('/app/' + (page === 'calendar' ? 'bookings' : page === 'finance' ? 'money' : page)); else toast('Nothing called ' + n + ' yet.') }
      else if (who && s.threads.find(t => t.id === who.id)) nav('/app/thread/' + who.id)
      else if (l.startsWith('how') || l.startsWith('what') || l.startsWith('who') || l.startsWith('which') || l.endsWith('?')) { nav('/app/lumi?q=' + encodeURIComponent(v)) }
      else toast('Not sure yet. Try: invoice, quote, book, block, chase, note, open, or ask a question.')
      setQ('')
    }, 500)
  }
  return (
    <form className={'cmd lg chroma' + (think ? ' think' : '')} onSubmit={e => { e.preventDefault(); if (q.trim()) run(q.trim()) }} autoComplete="off">
      <span className="ring" aria-hidden="true" />
      <input ref={ref} value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Ask or do anything. Try: invoice Coastline, block 3 Dec, how did August go" aria-label="Command" />
      <kbd>⌘K</kbd>
      <button className="go" type="submit"><span>Do it</span><Icon name="arrow" size={14} className="ar" /></button>
      {open && hits.length > 0 && <div className="sugg lg" role="listbox">{hits.map(h => <div key={h.n} className="s" role="option" onClick={() => run(h.n)}><span className="k">{h.k}</span><span>{h.n}</span><span className="m">{h.m}</span></div>)}</div>}
    </form>
  )
}
