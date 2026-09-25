// The live data layer for the workspace and the client portal. Reads the real project through the
// additive functions (my_threads, portal_load_v2) and the owner-scoped tables, and shapes the rows
// into exactly what the pages already render from the sample store: threads, ledger rows, events.
// Writes go through the same path the live site uses (messages insert + send-message-notification,
// portal_send_message for the client). Nothing here runs in demo mode.
import { supabase } from '../backend/supabaseClient'
import { moderateText } from '../backend/moderateContent'
import { STAGES } from '../data/workspace'
import { threadOwnerTierContactSharingRestricted, messageBodyContainsContactDetails, MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE } from '../backend/messagingContactPolicy'
import { isMonthlyMessageLimitError, MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE } from '../backend/messageMonthlyLimit'

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
const today = () => iso(new Date())
const nice = s => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) }
const when = ts => { if (!ts) return ''; const d = new Date(ts), n = new Date(); const same = d.toDateString() === n.toDateString(); const t = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase(); return same ? 'Today, ' + t : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ', ' + t }
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-AU')
const low = s => String(s || '').toLowerCase()
const PAL = ['linear-gradient(135deg,#283047,#9ac4c5)', 'linear-gradient(135deg,#2c3a5e,#7fa8e8)', 'linear-gradient(135deg,#1c452f,#7fd0aa)', 'linear-gradient(135deg,#3d2450,#d996ba)', 'linear-gradient(135deg,#f6ccb0,#efab82)', 'linear-gradient(135deg,#472657,#c6a5e5)']
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
export const gradFor = s => PAL[hash(s) % PAL.length]
const paid = st => ['paid'].includes(low(st))
const accepted = st => ['accepted', 'approved'].includes(low(st))
const signed = st => ['signed', 'completed'].includes(low(st))

// Where a client is up to, from what exists: the furthest stage with evidence
export function stageOf(c) {
  const t = today()
  if (c.reviews.length) return 7
  if (c.deliveries.length) return 6
  const booked = c.bookings.filter(b => ['confirmed', 'accepted'].includes(low(b.status)) && !b.cancelled_at)
  if (booked.some(b => b.booking_date && b.booking_date < t)) return 6
  if (c.invoices.some(i => paid(i.status))) return booked.length ? 5 : 4
  if (c.contracts.some(x => signed(x.status))) return 3
  if (c.quotes.some(q => accepted(q.status))) return 2
  if (c.quotes.some(q => low(q.status) !== 'draft')) return 1
  return 0
}

const firstItem = items => { try { const a = Array.isArray(items) ? items : JSON.parse(items || '[]'); const i = a[0]; return i ? (i.description || i.name || i.title || i.label || '') : '' } catch { return '' } }
const docStatus = (kind, st) => {
  const s = low(st)
  if (kind === 'q') return s === 'accepted' ? ['ok', 'Accepted'] : s === 'declined' ? ['pink', 'Declined'] : s === 'viewed' ? ['viewed', 'Viewed'] : s === 'draft' ? ['grey', 'Draft'] : ['sent', 'Sent']
  if (kind === 'inv') return s === 'paid' ? ['ok', 'Paid'] : s === 'overdue' ? ['pink', 'Overdue'] : s === 'draft' ? ['grey', 'Draft'] : ['sent', 'Sent']
  return signed(s) ? ['pink', 'Signed'] : s === 'draft' ? ['grey', 'Draft'] : ['sent', 'Sent']
}
const short = id => String(id || '').slice(0, 8).toUpperCase()

// One client from my_threads() → a thread the Threads page can render, plus its ledger rows and events
export function shapeClient(c, me) {
  const id = c.email
  const name = c.name || c.email
  const first = name.split(' ')[0]
  const upcoming = c.bookings.filter(b => b.booking_date && b.booking_date >= today() && !b.cancelled_at).sort((a, b) => a.booking_date < b.booking_date ? -1 : 1)[0]
  const anyBooking = upcoming || c.bookings[0]
  const stage = stageOf(c)
  const quote = c.quotes.find(q => accepted(q.status)) || c.quotes[0]
  const job = anyBooking?.service || (quote && firstItem(quote.items)) || c.threads[0]?.subject || 'Enquiry'
  const d = upcoming ? nice(upcoming.booking_date) : anyBooking?.booking_date ? nice(anyBooking.booking_date) : 'TBC'
  const value = quote?.amount || c.invoices.reduce((s, i) => s + Number(i.amount || 0), 0) || 0
  // the timeline: every message across the client's threads, in order, with documents dropped in where they happened
  const msgs = []
  for (const t of c.threads) for (const m of t.messages || []) msgs.push({ at: m.created_at, who: m.sender_type === 'creative' ? 'me' : 'them', text: m.body, id: m.id, thread: t.id })
  const docs = []
  for (const q of c.quotes) { const [st, stt] = docStatus('q', q.status); docs.push({ at: q.created_at, doc: 'Quote ' + short(q.id) + (firstItem(q.items) ? ' · ' + firstItem(q.items) : ''), d: money(q.amount) + ' incl. GST', st, stt, ref: { k: 'q', id: q.id } }) }
  for (const x of c.contracts) { const [st, stt] = docStatus('c', x.status); docs.push({ at: x.created_at, doc: 'Contract ' + (x.title || short(x.id)), d: x.project_name || x.contract_type || '', st, stt, ref: { k: 'c', id: x.id } }) }
  for (const i of c.invoices) { const [st, stt] = docStatus('inv', i.status); docs.push({ at: i.created_at, doc: 'Invoice ' + short(i.id) + (firstItem(i.items) ? ' · ' + firstItem(i.items) : ''), d: money(i.amount) + (i.due_date ? ' · due ' + nice(i.due_date) : ''), st, stt, ref: { k: 'inv', id: i.id } }) }
  for (const dl of c.deliveries) docs.push({ at: dl.created_at, doc: 'Gallery · ' + (dl.title || 'Delivery'), d: (Array.isArray(dl.files) ? dl.files.length : 0) + ' files' + (dl.downloaded_at ? ' · downloaded' : dl.opened_at ? ' · opened' : ''), st: dl.downloaded_at ? 'ok' : 'sent', stt: dl.downloaded_at ? 'Downloaded' : 'Sent' })
  const line = [...msgs.map(m => ({ [m.who]: m.text, w: when(m.at), at: m.at, mid: m.id, thread: m.thread })), ...docs.map(x => ({ doc: x.doc, d: x.d, st: x.st, stt: x.stt, at: x.at, ref: x.ref }))].sort((a, b) => (a.at || '') < (b.at || '') ? -1 : 1)
  if (!line.length) line.push({ sys: 'Thread opened' })
  const last = msgs[msgs.length - 1]
  const unread = c.threads.reduce((s, t) => s + (t.unread_count || 0), 0)
  const need = unread > 0 || (last && last.who === 'them')
  const next = need ? 'Reply to ' + first : last ? 'Waiting on ' + first : upcoming ? 'Shoot ' + nice(upcoming.booking_date) : c.quotes.some(q => !accepted(q.status) && low(q.status) !== 'draft') ? 'Quote sent, waiting' : 'Nothing waiting'
  const portal = c.portal_token ? location.origin + '/portal/' + c.portal_token : ''
  const thread = {
    id, n: name, email: c.email, j: job, d, stage, next, v: Number(value) || 0, need, g: gradFor(c.email), unread,
    s: [job, upcoming ? nice(upcoming.booking_date) : null, upcoming?.location].filter(Boolean).join(' · ') || STAGES[stage],
    job: [['Package', job], ['Date', d], ...(quote ? [['Quoted', money(quote.amount)]] : []), ['Client link', portal ? portal.replace(/^https?:\/\//, '') : 'Sent with the first reply']],
    docs: docs.map(x => [x.doc, x.st, x.stt]), line, live: { threads: c.threads.map(t => t.id), portal_token: c.portal_token, client_user_id: c.client_user_id, name, me },
  }
  const ledger = [
    ...c.quotes.map(q => { const [st, stt] = docStatus('q', q.status); return { id: 'Q-' + short(q.id), k: 'q', who: name, d: firstItem(q.items) || 'Quote', date: String(q.created_at || '').slice(0, 10), st, stt, v: Number(q.amount) || 0, t: id, live: q } }),
    ...c.invoices.map(i => { const [st, stt] = docStatus('inv', i.status); return { id: 'INV-' + short(i.id), k: 'inv', who: name, d: firstItem(i.items) || 'Invoice', date: String(i.created_at || '').slice(0, 10), due: i.due_date, st, stt, v: Number(i.amount) || 0, t: id, live: i } }),
    ...c.contracts.map(x => { const [st, stt] = docStatus('c', x.status); return { id: 'C-' + short(x.id), k: 'c', who: name, d: x.title || 'Contract', date: String(x.created_at || '').slice(0, 10), st, stt, v: 0, t: id, live: x } }),
  ]
  const events = c.bookings.filter(b => b.booking_date && !b.cancelled_at).map(b => ({ id: 'b-' + b.id, d: b.booking_date, k: ['confirmed', 'accepted'].includes(low(b.status)) ? 'b' : 'p', n: name + ' · ' + (b.service || 'booking'), s: [b.location, low(b.status)].filter(Boolean).join(' · '), time: b.start_time ? String(b.start_time).slice(0, 5) : undefined, dur: b.all_day ? 'day' : (b.start_time && b.end_time ? Math.max(30, (toMin(b.end_time) - toMin(b.start_time))) : 120), where: b.location || '', v: 0, t: id, live: b }))
  return { thread, ledger, events }
}
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0) }

// Everything for the workspace in one go: my_threads() plus every message in those threads
export async function loadThreads(me) {
  const { data, error } = await supabase.rpc('my_threads')
  if (error) throw error
  const clients = data || []
  const ids = clients.flatMap(c => c.threads.map(t => t.id))
  let byThread = {}
  if (ids.length) {
    const { data: msgs } = await supabase.from('messages').select('id, thread_id, sender_type, sender_name, body, created_at, read, attachments').in('thread_id', ids).order('created_at', { ascending: true })
    for (const m of msgs || []) (byThread[m.thread_id] = byThread[m.thread_id] || []).push(m)
  }
  for (const c of clients) for (const t of c.threads) t.messages = byThread[t.id] || []
  const shaped = clients.map(c => shapeClient(c, me))
  const threads = shaped.map(x => x.thread).sort((a, b) => (b.need ? 1 : 0) - (a.need ? 1 : 0) || ((b.line[b.line.length - 1]?.at || '') > (a.line[a.line.length - 1]?.at || '') ? 1 : -1))
  return { threads, ledger: shaped.flatMap(x => x.ledger), events: shaped.flatMap(x => x.events) }
}

// Send a message to a client as the creative: moderation, insert, notify. Creates the thread if the
// client has none yet (a client we only have a booking or quote with). Returns the new message row.
export async function sendMessage(thread, text, me) {
  const body = String(text || '').trim(); if (!body) throw new Error('Nothing to send.')
  const mod = await moderateText(body); if (mod?.blocked) throw new Error(mod.reason || 'That message cannot be sent.')
  let threadId = thread.live?.threads?.[0]
  if (!threadId) {
    const { data: cid } = await supabase.rpc('find_client_account_id', { p_email: thread.email }).catch(() => ({ data: null }))
    const { data: t, error } = await supabase.from('message_threads').insert({ creative_id: me.id, client_user_id: cid || null, client_name: thread.n, client_email: thread.email, subject: thread.j || 'New message' }).select().single()
    if (error) throw error
    threadId = t.id
  }
  const { data: m, error } = await supabase.from('messages').insert({ thread_id: threadId, sender_type: 'creative', sender_name: me.label, body, creative_id: me.id }).select('id, created_at').single()
  if (error) throw new Error(isMonthlyMessageLimitError(error) ? MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE : error.message)
  try { await supabase.functions.invoke('send-message-notification', { body: { message_id: m.id } }) } catch { /* the message is saved; the email is best effort */ }
  return { id: m.id, at: m.created_at, thread: threadId }
}

// Mark a client's threads read (the bell and the "needs me" count)
export async function markRead(thread) {
  const ids = thread.live?.threads || []; if (!ids.length) return
  await supabase.from('message_threads').update({ unread_count: 0, last_read_at: new Date().toISOString() }).in('id', ids)
}

// The client side, by portal token. No login: the token is the key, as on the live site.
export async function loadPortal(token) {
  const { data, error } = await supabase.rpc('portal_load_v2', { p_token: token })
  if (error) throw error
  if (!data) return null
  const threads = data.threads || []
  for (const t of threads) { const { data: ms } = await supabase.rpc('portal_thread_messages', { p_token: token, p_thread_id: t.id }); t.messages = ms || [] }
  return { ...data, threads, quotes: data.quotes || [], contracts: data.contracts || [], invoices: data.invoices || [], bookings: data.bookings || [], deliveries: data.deliveries || [], meetings: data.meetings || [], reviews: data.reviews || [] }
}
// The client sends. Same two rules as the live portal: moderation, and on a Basic-plan creative's
// thread no phone numbers or emails in the body (the plan's messaging stays inside LensTrybe).
export async function portalSend(token, threadId, text, creativeTier) {
  const body = String(text || '').trim(); if (!body) throw new Error('Nothing to send.')
  const mod = await moderateText(body); if (mod?.blocked) throw new Error(mod.reason || 'That message cannot be sent.')
  if (threadOwnerTierContactSharingRestricted(creativeTier) && messageBodyContainsContactDetails(body)) throw new Error(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE)
  const { data, error } = await supabase.rpc('portal_send_message', { p_token: token, p_thread_id: threadId, p_body: body })
  if (error) throw new Error('Could not send your message. Try again.')
  return data
}
// The client accepts or declines a quote (respond-quote, the live function)
export async function portalRespondQuote(token, quoteId, action) {
  const { data, error } = await supabase.functions.invoke('respond-quote', { body: { quote_id: quoteId, portal_token: token, action } })
  if (error || data?.error) throw new Error(data?.error || 'Could not update the quote. Try again.')
  return data
}
export const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''))
export { when, nice, money, today }
