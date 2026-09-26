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
import { uploadAttachment } from './attachments'

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
  for (const t of c.threads) for (const m of t.messages || []) msgs.push({ at: m.created_at, who: m.sender_type === 'creative' ? 'me' : 'them', text: m.body || '', id: m.id, thread: t.id, att: Array.isArray(m.attachments) && m.attachments.length ? m.attachments : undefined })
  const docs = []
  for (const q of c.quotes) { const [st, stt] = docStatus('q', q.status); docs.push({ at: q.created_at, doc: 'Quote ' + short(q.id) + (firstItem(q.items) ? ' · ' + firstItem(q.items) : ''), d: money(q.amount) + ' incl. GST', st, stt, ref: { k: 'q', id: q.id } }) }
  for (const x of c.contracts) { const [st, stt] = docStatus('c', x.status); docs.push({ at: x.created_at, doc: 'Contract ' + (x.title || short(x.id)), d: x.project_name || x.contract_type || '', st, stt, ref: { k: 'c', id: x.id } }) }
  for (const i of c.invoices) { const [st, stt] = docStatus('inv', i.status); docs.push({ at: i.created_at, doc: 'Invoice ' + short(i.id) + (firstItem(i.items) ? ' · ' + firstItem(i.items) : ''), d: money(i.amount) + (i.due_date ? ' · due ' + nice(i.due_date) : ''), st, stt, ref: { k: 'inv', id: i.id } }) }
  for (const dl of c.deliveries) docs.push({ at: dl.created_at, doc: 'Gallery · ' + (dl.title || 'Delivery'), d: (Array.isArray(dl.files) ? dl.files.length : 0) + ' files' + (dl.downloaded_at ? ' · downloaded' : dl.opened_at ? ' · opened' : ''), st: dl.downloaded_at ? 'ok' : 'sent', stt: dl.downloaded_at ? 'Downloaded' : 'Sent' })
  const line = [...msgs.map(m => ({ [m.who]: m.text, w: when(m.at), at: m.at, mid: m.id, thread: m.thread, att: m.att })), ...docs.map(x => ({ doc: x.doc, d: x.d, st: x.st, stt: x.stt, at: x.at, ref: x.ref }))].sort((a, b) => (a.at || '') < (b.at || '') ? -1 : 1)
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
// files: File objects to attach (uploaded here, into the thread's private folder, before the insert).
export async function sendMessage(thread, text, me, files = [], onFile) {
  const body = String(text || '').trim(); if (!body && !files.length) throw new Error('Nothing to send.')
  if (body) { const mod = await moderateText(body); if (mod?.blocked) throw new Error(mod.reason || 'That message cannot be sent.') }
  let threadId = thread.live?.threads?.[0]
  if (!threadId) {
    const { data: cid } = await supabase.rpc('find_client_account_id', { p_email: thread.email }).catch(() => ({ data: null }))
    const { data: t, error } = await supabase.from('message_threads').insert({ creative_id: me.id, client_user_id: cid || null, client_name: thread.n, client_email: thread.email, subject: thread.j || 'New message' }).select().single()
    if (error) throw error
    threadId = t.id
  }
  const attachments = []
  for (let i = 0; i < files.length; i++) { attachments.push(await uploadAttachment(files[i], { threadId })); onFile?.(i) }
  const { data: m, error } = await supabase.from('messages').insert({ thread_id: threadId, sender_type: 'creative', sender_name: me.label, body, creative_id: me.id, attachments }).select('id, created_at').single()
  if (error) throw new Error(isMonthlyMessageLimitError(error) ? MONTHLY_MESSAGE_LIMIT_EXCEEDED_MESSAGE : error.message)
  try { await supabase.functions.invoke('send-message-notification', { body: { message_id: m.id } }) } catch { /* the message is saved; the email is best effort */ }
  return { id: m.id, at: m.created_at, thread: threadId, attachments }
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
export async function portalSend(token, threadId, text, creativeTier, files = [], onFile) {
  const body = String(text || '').trim(); if (!body && !files.length) throw new Error('Nothing to send.')
  if (body) {
    const mod = await moderateText(body); if (mod?.blocked) throw new Error(mod.reason || 'That message cannot be sent.')
    if (threadOwnerTierContactSharingRestricted(creativeTier) && messageBodyContainsContactDetails(body)) throw new Error(MESSAGING_CONTACT_SHARING_BLOCKED_MESSAGE)
  }
  const attachments = []
  for (let i = 0; i < files.length; i++) { attachments.push(await uploadAttachment(files[i], { threadId, token })); onFile?.(i) }
  const { data, error } = await supabase.rpc('portal_send_message_v2', { p_token: token, p_thread_id: threadId, p_body: body, p_attachments: attachments })
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

// ── Public side: the directory, a profile, an enquiry ────────────────────────────────────────
// Shaped into the same object the sample creatives use, so Directory, Ask and Creative render either.
const TAG = { Photographer: 'photo', Videographer: 'video', 'Drone Operator': 'drone', 'Video Editor': 'edit', 'Content Creator': 'content', 'Social Media Manager': 'social' }
const spec = s => { const l = low(s); return l.includes('wedding') || l.includes('elope') ? 'wedding' : l.includes('real estate') ? 'realestate' : l.includes('event') || l.includes('corporate') || l.includes('conference') ? 'event' : l.includes('portrait') || l.includes('headshot') || l.includes('family') ? 'portrait' : l.includes('brand') || l.includes('product') || l.includes('commercial') || l.includes('food') ? 'brand' : null }
export function shapeProfile(p, extra = {}) {
  const skills = p.skill_types || [], specs = [].concat(p.specialties || [], ...Object.values(p.specialties_by_type || {}).flat())
  const t = [...new Set([...skills.map(s => TAG[s] || low(s)), ...specs.map(spec).filter(Boolean)])]
  const services = (extra.services || []).map(s => [s.name, Number(s.price) || 0, s.description || ''])
  const rv = extra.reviews || [], r = rv.length ? Math.round(rv.reduce((a, x) => a + (x.rating || 0), 0) / rv.length * 10) / 10 : 0
  const from = services.length ? Math.min(...services.map(s => s[1]).filter(Boolean)) : 0
  return {
    id: p.id, live: true, n: p.business_name || 'Creative', d: p.tagline || skills.join(' and '), short: skills[0] || 'Creative', c: p.city || p.location || '', state: p.state || 'QLD', p: from, r, rv: rv.length, t,
    mood: ['golden', 'dusk', 'cool', 'forest', 'night', 'rose'][hash(p.id) % 6], seed: (hash(p.id) % 40) + 1, free: p.is_available !== false, found: !!(p.founding_member && p.show_founding_badge !== false), resp: 'about a day',
    why: [p.tagline, p.city ? 'based in ' + p.city : null].filter(Boolean).join(', ') + '.', about: p.bio || '', pk: services.length ? services : [], avatar: p.avatar_url || '', cover: p.cover_url || '', tier: p.subscription_tier || 'basic', years: p.years_experience, ig: p.instagram_url, web: p.website, areas: p.site_service_areas || [],
    photos: (extra.items || []).map(i => ({ id: i.id, url: i.image_url, title: i.headline || i.title || '', alt: i.alt_text || i.title || '', wide: !!i.featured })), reviews: rv.filter(x => x.flag_status !== 'resolved_removed').map(x => ({ id: x.id, who: x.reviewer_name || x.client_name || 'A client', r: x.rating || 5, text: x.body || x.comment || '', when: x.created_at, kind: x.project_type, verified: x.source !== 'imported', reply: x.reply || '', featured: !!x.featured })).sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)),
    busy: extra.busy || [],
  }
}
const PUB = 'id, business_name, tagline, bio, city, state, location, skill_types, specialties, specialties_by_type, avatar_url, cover_url, subscription_tier, founding_member, show_founding_badge, is_available, years_experience, instagram_url, website, site_service_areas, created_at'
export async function loadCreatives() {
  const { data, error } = await supabase.from('profiles').select(PUB).eq('is_admin', false).eq('is_listed', true).order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  const ids = (data || []).map(p => p.id)
  let rvBy = {}
  if (ids.length) { const { data: rv } = await supabase.from('reviews').select('creative_id, rating').in('creative_id', ids).eq('hidden', false); for (const x of rv || []) (rvBy[x.creative_id] = rvBy[x.creative_id] || []).push(x) }
  return (data || []).map(p => shapeProfile(p, { reviews: rvBy[p.id] || [] }))
}
export async function loadCreative(id) {
  const { data: p, error } = await supabase.from('profiles').select(PUB).eq('id', id).maybeSingle()
  if (error || !p) return null
  const [items, services, reviews, busy] = await Promise.all([
    supabase.rpc('get_public_portfolio_items', { p_creative_id: id }).then(r => r.data || []),
    supabase.from('portfolio_services').select('id, name, description, price, sort_order, image_url').eq('creative_id', id).order('sort_order').then(r => r.data || []),
    supabase.from('reviews').select('id, rating, body, comment, reviewer_name, client_name, created_at, source, project_type, reply, featured, flag_status').eq('creative_id', id).eq('hidden', false).order('created_at', { ascending: false }).then(r => r.data || []),
    supabase.rpc('creative_busy_times', { p_creative: id, p_to: iso(new Date(Date.now() + 400 * 864e5)) }).then(r => [...new Set((r.data || []).filter(x => x.all_day || x.source === 'booked').map(x => x.date))]),
  ])
  return shapeProfile(p, { items, services, reviews, busy })
}
// An enquiry from the profile page. Signed in as a client: the thread + message are inserted and
// send-enquiry notifies the creative and makes the portal (the live site's path). Anyone else:
// site-enquiry, the rate-limited anonymous function. Returns { portal } when one was made.
export async function sendEnquiry(creativeId, f, user) {
  const message = String(f.message || '').trim(); if (!message) throw new Error('Say what you need first, one sentence is enough.')
  const mod = await moderateText((f.subject || '') + '\n' + message); if (mod?.blocked) throw new Error(mod.reason || 'That message cannot be sent.')
  if (user) {
    const name = String(f.name || '').trim() || user.user_metadata?.first_name || user.email
    const contact = [f.name && 'Name: ' + f.name.trim(), f.phone && 'Phone: ' + f.phone.trim()].filter(Boolean).join('\n')
    const { data: t, error } = await supabase.from('message_threads').insert({ creative_id: creativeId, client_user_id: user.id, client_name: name, client_email: user.email, subject: f.subject || 'Enquiry' }).select().single()
    if (error) throw new Error(error.message)
    const { error: e2 } = await supabase.from('messages').insert({ thread_id: t.id, sender_type: 'client', sender_name: name, body: contact ? message + '\n\nMy contact details:\n' + contact : message })
    if (e2) throw new Error(e2.message)
    await supabase.functions.invoke('send-enquiry', { body: { thread_id: t.id } }).catch(() => {})
    return { thread: t.id }
  }
  const name = String(f.name || '').trim(), email = String(f.email || '').trim()
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Your name and a real email, so the reply can find you.')
  const { data, error } = await supabase.functions.invoke('site-enquiry', { body: { creativeId, name, email, phone: f.phone || null, message: (f.subject ? 'Subject: ' + f.subject + '\n\n' : '') + message, website: f.website || '' } })
  if (error || data?.error) throw new Error(data?.error || 'Something went wrong. Try again.')
  return { ok: true }
}

// ── Token pages: sign, meeting, gallery, review ───────────────────────────────────────────────
// Each link in a client email is a token. The token is the key, checked server side, no login.
const fnErr = (error, data, fallback) => { if (error) return new Error(fallback); if (data?.error) return new Error(typeof data.error === 'string' && data.error.length < 80 && !/^[a-z_]+$/.test(data.error) ? data.error : fallback); return null }

// Contract signing: contract_for_signing → { contract, business_name }; the file (if any) through contract-file.
export async function loadSigning(token) {
  const { data, error } = await supabase.rpc('contract_for_signing', { p_token: token })
  if (error || !data?.contract) return null
  const c = data.contract
  let fileUrl = null
  if (c.contract_file_url) { try { const { data: f } = await supabase.functions.invoke('contract-file', { body: { token } }); fileUrl = f?.url || null } catch { /* text still renders */ } }
  let creative = null
  try { const { data: p } = await supabase.from('profiles').select('id, business_name, avatar_url, tagline, city').eq('id', c.creative_id).maybeSingle(); creative = p } catch { /* optional */ }
  return { contract: c, business: data.business_name || creative?.business_name || 'Your creative', creative, fileUrl }
}
export async function signContract(token, contractId) {
  const { data, error } = await supabase.rpc('sign_contract', { p_token: token })
  if (error) throw new Error(error.message || 'Could not sign right now. Try again.')
  try { await supabase.functions.invoke('notify-contract-signed', { body: { contract_id: contractId } }) } catch { /* best effort */ }
  return data
}

// Meeting request: meeting-respond get / respond
export async function loadMeeting(token) {
  const { data, error } = await supabase.functions.invoke('meeting-respond', { body: { action: 'get', token } })
  if (error || !data?.meeting) return null
  return data.meeting
}
export async function respondMeeting(token, response, extra = {}) {
  const { data, error } = await supabase.functions.invoke('meeting-respond', { body: { action: 'respond', token, response, proposed_date: extra.date || null, proposed_time: extra.time || null, message: extra.message || null } })
  const e = fnErr(error, data, 'Could not save your response. Try again.'); if (e) throw e
  return data
}

// Gallery: the deliver function does everything (signed file links, password, tracking, favourites)
export async function loadDelivery(token) {
  const { data, error } = await supabase.functions.invoke('deliver', { body: { action: 'load', token } })
  if (error || !data || data.error) return null
  return data
}
export async function unlockDelivery(token, password) {
  const { data, error } = await supabase.functions.invoke('deliver', { body: { action: 'unlock', token, password } })
  if (error || !data?.ok) throw new Error(data?.error === 'too_many_attempts' ? 'Too many tries. Wait a few minutes and try again.' : 'That password is not right.')
  return data
}
export function trackDownload(token, name, password) { supabase.functions.invoke('deliver', { body: { action: 'track', token, file_name: name, password: password || undefined } }).catch(() => {}) }
export async function sendFavourites(token, favourites, password) {
  const { data, error } = await supabase.functions.invoke('deliver', { body: { action: 'favourites', token, favourites, password: password || undefined } })
  if (error || !data?.ok) throw new Error('Could not send your picks. Try again.')
  return data
}

// Review: a client posting to a creative's profile (reviews insert, anon allowed; notify-review emails the creative)
export async function loadCreativeLite(id) {
  const { data } = await supabase.from('profiles').select('id, business_name, avatar_url, tagline, city, skill_types, is_listed').eq('id', id).maybeSingle()
  return data || null
}
export async function submitReview(creativeId, f) {
  const text = [f.name, f.body].filter(Boolean).join('\n')
  const mod = await moderateText(text); if (mod?.blocked) throw new Error(mod.reason || 'That review cannot be posted.')
  const { data, error } = await supabase.from('reviews').insert({ creative_id: creativeId, reviewer_name: f.name, reviewer_email: f.email, client_name: f.name, rating: f.rating, body: f.body, comment: f.body, source: 'platform', project_type: f.job || null }).select('id').single()
  if (error) throw new Error(/already reviewed/i.test(error.message) ? 'You have already reviewed this creative recently.' : /too many/i.test(error.message) ? 'Too many reviews right now. Try again later.' : 'Could not post your review. Try again.')
  if (data?.id) supabase.functions.invoke('notify-review', { body: { review_id: data.id } }).catch(() => {})
  return data
}

// ── Money documents from the workspace: quotes, invoices, contracts ──────────────────────────
// Same tables and functions as the live site. items = [{ description, quantity, rate }], amount = total.
// The editor's shape is { items:[{d,q,r}], to:{n,em,ph,addr}, for, notes, terms, balDue, dep } and
// these two helpers translate. Tier gating is the database's (guard_tier_feature); we say it nicely.
const TABLE = { q: 'quotes', inv: 'invoices', c: 'contracts' }
const NAMES = { q: 'Quotes', inv: 'Invoicing', c: 'Contracts' }
export const docError = (e, kind) => { const m = String(e?.message || e || ''); if (/TIER_REQUIRED/i.test(m)) return NAMES[kind] + ' are on the Expert plan and above. Upgrade in Account to send them.'; return m || 'Could not save. Try again.' }
export const toLiveItems = items => (items || []).filter(it => it.d || Number(it.r)).map(it => ({ description: String(it.d || ''), quantity: Number(it.q) || 1, rate: Number(it.r) || 0 }))
export const fromLiveItems = items => { const a = Array.isArray(items) ? items : []; return a.length ? a.map(it => ({ d: it.description || it.name || it.title || '', q: it.quantity ?? it.qty ?? 1, r: it.rate ?? it.price ?? it.amount ?? '' })) : [{ d: '', q: 1, r: '' }] }

// Save a quote or invoice (draft). raw = the existing row to update, or null to insert. Returns the row.
export async function saveMoneyDoc(kind, inv, total, me, raw) {
  const notes = [inv.notes, inv.terms].filter(x => x && x.trim()).join('\n\n') || null
  const row = { client_name: (inv.to.n || '').trim() || 'Client', client_email: (inv.to.em || '').trim().toLowerCase() || null, client_phone: (inv.to.ph || '').trim() || null, client_address: (inv.to.addr || '').trim() || null, notes, items: toLiveItems(inv.items), amount: Math.round(total * 100) / 100 }
  if (kind === 'q') { row.valid_until = inv.balDue || null; row.due_date = inv.balDue || null } else { row.due_date = inv.dep?.on ? (inv.dep.due || inv.balDue || null) : (inv.balDue || null) }
  if (inv.for && inv.for.trim()) row.notes = ['For: ' + inv.for.trim(), row.notes].filter(Boolean).join('\n\n')
  const text = [row.client_name, ...row.items.map(i => i.description), row.notes].filter(Boolean).join('\n')
  const mod = await moderateText(text); if (mod?.blocked) throw new Error(mod.reason || 'That text cannot be sent.')
  if (raw?.id) {
    const { data, error } = await supabase.from(TABLE[kind]).update(row).eq('id', raw.id).select().single()
    if (error) throw new Error(docError(error, kind)); return data
  }
  const { data, error } = await supabase.from(TABLE[kind]).insert({ ...row, creative_id: me.id, status: 'draft', download_token: crypto.randomUUID() }).select().single()
  if (error) throw new Error(docError(error, kind)); return data
}
// Email it to the client (send-quote / send-invoice / send-contract) and mark it sent.
export async function sendDocLive(kind, id) {
  const fn = kind === 'q' ? 'send-quote' : kind === 'inv' ? 'send-invoice' : 'send-contract'
  const key = kind === 'q' ? 'quote_id' : kind === 'inv' ? 'invoice_id' : 'contract_id'
  const { data, error } = await supabase.functions.invoke(fn, { body: { [key]: id } })
  if (error || data?.error) throw new Error(typeof data?.error === 'string' && data.error.length < 120 ? data.error : 'Could not send the email. The document is saved as a draft; try Send again.')
  await supabase.from(TABLE[kind]).update({ status: 'sent' }).eq('id', id)
}
export async function setDocStatus(kind, id, status, extra = {}) {
  const { error } = await supabase.from(TABLE[kind]).update({ status, ...extra }).eq('id', id)
  if (error) throw new Error(docError(error, kind))
}
export async function deleteDocLive(kind, id) {
  const { error } = await supabase.from(TABLE[kind]).delete().eq('id', id)
  if (error) throw new Error(docError(error, kind))
}
// Contracts: title, project, date, the text, notes. contract_type 'written'; the signing link is the row's token.
export async function saveContractLive(c, me, raw) {
  const row = { client_name: (c.to?.n || c.client_name || '').trim() || 'Client', client_email: (c.to?.em || c.client_email || '').trim().toLowerCase() || null, title: (c.title || 'Contract').trim(), project_name: c.project || null, project_date: c.date || null, content: c.content || '', notes: c.notes || null, contract_type: 'written' }
  const mod = await moderateText([row.title, row.content, row.notes].filter(Boolean).join('\n')); if (mod?.blocked) throw new Error(mod.reason || 'That text cannot be sent.')
  if (raw?.id) { const { data, error } = await supabase.from('contracts').update(row).eq('id', raw.id).select().single(); if (error) throw new Error(docError(error, 'c')); return data }
  const { data, error } = await supabase.from('contracts').insert({ ...row, creative_id: me.id, status: 'draft', download_token: crypto.randomUUID() }).select().single()
  if (error) throw new Error(docError(error, 'c')); return data
}

// ── The creative's own profile: edit, photo, portfolio, packages ───────────────────────────────
// Same rows the live site edits: profiles (text fields, skill_types, specialties, avatar_url),
// portfolio_items in the portfolio bucket, portfolio_services for packages. Uploads go to the
// creative's own folder (<uid>/...) which storage RLS allows; every image is moderated first.
export async function loadMyProfileExtras(uid) {
  const [items, services] = await Promise.all([
    supabase.from('portfolio_items').select('id, image_url, file_url, file_type, featured, sort_order, headline, title, alt_text').eq('creative_id', uid).order('sort_order').then(r => r.data || []),
    supabase.from('portfolio_services').select('id, name, description, price, sort_order').eq('creative_id', uid).order('sort_order').then(r => r.data || []),
  ])
  return { items: items.filter(i => i.file_type !== 'video').map(i => ({ id: i.id, url: i.image_url || i.file_url, featured: !!i.featured })), packages: services.map(s => [s.name || '', Number(s.price) || 0, s.description || '', s.id]) }
}
const splitPlace = s => { const [a, ...b] = String(s || '').split(','); return { city: a.trim(), state: (b.join(',').trim() || 'QLD').toUpperCase().slice(0, 3) } }
export async function saveProfileLive(uid, p, packages) {
  const text = [p.n, p.h, p.bio, ...packages.map(x => x[0] + ' ' + x[2])].filter(Boolean).join('\n')
  const mod = await moderateText(text); if (mod?.blocked) throw new Error(mod.reason || 'That text cannot be published.')
  const { city, state } = splitPlace(p.city)
  const skills = p.disc === 'Both' ? ['Photographer', 'Videographer'] : p.disc ? [p.disc] : []
  const row = { business_name: (p.n || '').trim(), tagline: (p.h || '').trim() || null, bio: (p.bio || '').trim() || null, city: city || null, state: city ? state : null, phone: (p.ph || '').trim() || null, website: (p.web || '').trim() || null, instagram_url: (p.ig || '').trim() ? (/^https?:/.test(p.ig.trim()) ? p.ig.trim() : 'https://instagram.com/' + p.ig.trim().replace(/^@/, '')) : null, skill_types: skills, specialties: p.kinds || [], avatar_url: p.avatar && p.avatar !== 'seed' ? p.avatar : null, show_founding_badge: p.tog?.badge !== 0, is_available: p.tog?.avail !== 0 }
  const { error } = await supabase.from('profiles').update(row).eq('id', uid)
  if (error) throw new Error(error.message)
  // packages: replace the set (small list, keeps order exact)
  const keep = packages.filter(x => String(x[0] || '').trim())
  const { data: old } = await supabase.from('portfolio_services').select('id').eq('creative_id', uid)
  const oldIds = (old || []).map(x => x.id), keepIds = keep.map(x => x[3]).filter(Boolean)
  const gone = oldIds.filter(id => !keepIds.includes(id)); if (gone.length) await supabase.from('portfolio_services').delete().in('id', gone)
  for (let i = 0; i < keep.length; i++) {
    const [name, price, description, id] = keep[i]; const rec = { creative_id: uid, name: name.trim(), price: price ? String(price) : null, description: (description || '').trim() || null, sort_order: i }
    if (id) await supabase.from('portfolio_services').update(rec).eq('id', id); else await supabase.from('portfolio_services').insert(rec)
  }
}
// One image into the creative's folder of a public bucket; returns its public URL.
async function putImage(uid, file, bucket, prefix) {
  const { moderateImage } = await import('../backend/moderateContent'); const { resizeImage } = await import('../backend/resizeImage')
  const r = await moderateImage(file); if (r?.blocked) throw new Error('That image cannot be used here.')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${uid}/${prefix}${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, await resizeImage(file), { upsert: false, contentType: file.type || undefined })
  if (error) throw new Error('Could not upload ' + file.name + '.')
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
export const uploadAvatar = (uid, file) => putImage(uid, file, 'avatars', 'avatar-')
export async function addPortfolioPhotos(uid, files, startOrder = 0) {
  const out = []
  for (let i = 0; i < files.length; i++) {
    const url = await putImage(uid, files[i], 'portfolio', 'p-')
    const { data, error } = await supabase.from('portfolio_items').insert({ creative_id: uid, user_id: uid, image_url: url, file_url: url, file_type: 'image', sort_order: startOrder + i, featured: false }).select('id').single()
    if (error) throw new Error(error.message)
    out.push({ id: data.id, url, featured: false })
  }
  return out
}
export async function removePortfolioPhoto(id) { const { error } = await supabase.from('portfolio_items').delete().eq('id', id); if (error) throw new Error(error.message) }
export async function setCoverPhoto(uid, id) { await supabase.from('portfolio_items').update({ featured: false }).eq('creative_id', uid); await supabase.from('portfolio_items').update({ featured: true }).eq('id', id) }

// ── Bookings and blocked days from the workspace ──────────────────────────────────────────────
// The live `bookings` function does the work (clash check, client account link, confirmation
// email); the calendar reads bookings back through my_threads. Blocked days are availability rows.
const bookErr = (error, data, fallback) => { if (data?.conflict) { const c = data.clashes || []; const e = new Error('That clashes with ' + (c[0] ? (c[0].client_name || 'a booking') + (c[0].service ? ' · ' + c[0].service : '') : 'another booking') + '.'); e.conflict = true; return e } return new Error(data?.error || (error ? 'Could not save the booking. Try again.' : fallback)) }
async function bookings(body) {
  const { data, error } = await supabase.functions.invoke('bookings', { body })
  if (error) { try { const j = await error.context?.json?.(); if (j) return { data: j, error } } catch { /* fall through */ } }
  return { data, error }
}
export async function createBooking(v, force = false) {
  const { data, error } = await bookings({ action: 'create', clientName: v.name, clientEmail: v.email || '', clientPhone: v.phone || '', service: v.service, location: v.location || '', notes: v.notes || '', date: v.date, allDay: !!v.allDay, startTime: v.start || '', endTime: v.end || '', notifyClient: !!v.notify, force })
  if (error || !data?.ok) throw bookErr(error, data, 'Could not save the booking.')
  return data.booking
}
export async function rescheduleBooking(id, v, force = false) {
  const { data, error } = await bookings({ action: 'reschedule', bookingId: id, date: v.date, allDay: !!v.allDay, startTime: v.start || '', endTime: v.end || '', location: v.location, service: v.service, note: v.note || '', notifyClient: v.notify !== false, force })
  if (error || !data?.ok) throw bookErr(error, data, 'Could not move the booking.')
  return data.booking
}
export async function cancelBooking(id, reason = '') {
  const { data, error } = await bookings({ action: 'cancel', bookingId: id, reason })
  if (error || !data?.ok) throw bookErr(error, data, 'Could not cancel the booking.')
  return data.booking
}
export async function respondBooking(id, accept, note = '', force = false) {
  const { data, error } = await bookings({ action: 'respond', bookingId: id, decision: accept ? 'accept' : 'decline', note, force })
  if (error || !data?.ok) throw bookErr(error, data, 'Could not answer the request.')
  return data.booking
}
export async function completeBooking(id) {
  const { data, error } = await bookings({ action: 'complete', bookingId: id })
  if (error || !data?.ok) throw bookErr(error, data, 'Could not mark it done.')
  return data.booking
}
// Blocked days (availability rows with is_available false). Read for the calendar, write from Block a day.
export async function loadBlocked(uid) {
  const { data } = await supabase.from('availability').select('id, date, notes, all_day, start_time, end_time').eq('creative_id', uid).eq('is_available', false).order('date')
  return (data || []).map(b => ({ id: 'x-' + b.id, d: b.date, k: 'x', n: b.notes || 'Blocked', s: b.all_day === false && b.start_time ? String(b.start_time).slice(0, 5) + ' to ' + String(b.end_time || '').slice(0, 5) : 'All day', dur: b.all_day === false ? undefined : 'day', v: 0, live: b }))
}
export async function blockDates(uid, dates, note) {
  const rows = dates.map(d => ({ creative_id: uid, date: d, is_available: false, all_day: true, notes: note || null }))
  const { error } = await supabase.from('availability').insert(rows)
  if (error) throw new Error(error.message)
}
export async function unblockDate(id) { const { error } = await supabase.from('availability').delete().eq('id', id); if (error) throw new Error(error.message) }

// ── Meetings from the workspace ───────────────────────────────────────────────────────────────
// meetings rows, proposed by the creative (send-meeting emails the client a /meeting/<token> link),
// answered by the client (accepted / reschedule / declined), confirmed by the creative.
const HOW = { video: 'Video', phone: 'Phone', in_person: 'In person' }
const HOW_BACK = { Video: 'video', Phone: 'phone', 'In person': 'in_person' }
export function shapeMeeting(m) {
  const st = low(m.status), date = m.meeting_date || m.client_proposed_date || ''
  const time = String(m.start_time || m.client_proposed_time || '09:00').slice(0, 5)
  return { id: 'm-' + m.id, who: m.client_name || m.client_email || 'Client', t: '', when: date + 'T' + time, how: HOW[m.meeting_type] || m.meeting_type || 'Video', st: ['declined', 'cancelled'].includes(st) || (date && date < today()) ? 'done' : 'up', status: st, th: low(m.client_email), prep: m.description || '', notes: m.client_message || '', g: gradFor(low(m.client_email || m.client_name || 'x')), title: m.title, where: m.location, proposed: m.client_proposed_date ? { d: m.client_proposed_date, t: String(m.client_proposed_time || '').slice(0, 5) } : null, live: m }
}
export async function loadMeetings(uid) {
  const { data } = await supabase.from('meetings').select('*').eq('creative_id', uid).order('meeting_date', { ascending: true })
  return (data || []).map(shapeMeeting)
}
export async function createMeeting(uid, v) {
  const mod = await moderateText([v.title, v.description].filter(Boolean).join('\n')); if (mod?.blocked) throw new Error(mod.reason || 'That text cannot be sent.')
  const addMin = (t, n) => { const [h, m] = t.split(':').map(Number); const x = Math.min(23 * 60 + 59, h * 60 + m + n); return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0') }
  const end = v.end || (v.time ? addMin(v.time, v.minutes || 30) : null)
  const row = { creative_id: uid, title: v.title || 'Meeting', meeting_type: HOW_BACK[v.how] || 'video', meeting_date: v.date || null, start_time: v.time || null, end_time: end, location: v.location || null, description: v.description || null, client_name: v.name || null, client_email: (v.email || '').toLowerCase() || null, status: 'draft', origin: 'creative', updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('meetings').insert(row).select().single()
  if (error) throw new Error(error.message)
  if (v.send !== false && row.client_email) { const { error: e2 } = await supabase.functions.invoke('send-meeting', { body: { meetingId: data.id } }); if (e2) throw new Error('Saved, but the invite email did not go. Try Send again from Meetings.'); await supabase.from('meetings').update({ status: 'sent' }).eq('id', data.id) }
  return data
}
export async function sendMeetingLive(id) { const { error } = await supabase.functions.invoke('send-meeting', { body: { meetingId: id } }); if (error) throw new Error('Could not send the invite. Try again.'); await supabase.from('meetings').update({ status: 'sent' }).eq('id', id) }
export async function rescheduleMeeting(id, date, time, how) {
  const patch = { meeting_date: date, start_time: time, updated_at: new Date().toISOString(), ...(how ? { meeting_type: HOW_BACK[how] || 'video' } : {}) }
  const { error } = await supabase.from('meetings').update(patch).eq('id', id); if (error) throw new Error(error.message)
  await sendMeetingLive(id)
}
// The creative confirms (their time, or the one the client suggested); client is emailed a confirmation.
export async function confirmMeeting(m, useProposed) {
  const date = useProposed ? m.client_proposed_date : m.meeting_date, start = useProposed ? m.client_proposed_time : m.start_time
  if (!date) throw new Error('Set a date first.')
  const { error } = await supabase.from('meetings').update({ status: 'accepted', meeting_date: date, start_time: start || null, updated_at: new Date().toISOString() }).eq('id', m.id); if (error) throw new Error(error.message)
  try { await supabase.functions.invoke('meeting-notify', { body: { meetingId: m.id, kind: 'confirmed' } }) } catch { /* best effort */ }
}
export async function declineMeeting(id) {
  const { error } = await supabase.from('meetings').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', id); if (error) throw new Error(error.message)
  try { await supabase.functions.invoke('meeting-notify', { body: { meetingId: id, kind: 'declined' } }) } catch { /* best effort */ }
}
export async function deleteMeeting(id) { const { error } = await supabase.from('meetings').delete().eq('id', id); if (error) throw new Error(error.message) }

// ── Deliver: galleries in the private deliveries bucket ───────────────────────────────────────
// Same rows and paths as the live site (<uid>/<delivery id>/<time>-<name>); the client opens them
// through the deliver function by download token; send-delivery emails the link.
const DBUCKET = 'deliveries'
const dPath = (uid, did, name) => `${uid}/${did}/${Date.now()}-${String(name || 'file').replace(/[\\/:*?"<>|]/g, '_')}`
const isImgF = f => /^image\//.test(f?.type || '') || /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(f?.name || '')
export function shapeDelivery(d, coverUrl) {
  const files = Array.isArray(d.files) ? d.files : []
  const photos = files.filter(isImgF).length, films = files.filter(f => /^video\//.test(f.type || '')).length
  const gb = Math.round(files.reduce((t, f) => t + (f.size || 0), 0) / 1e9 * 100) / 100
  const days = d.expires_at ? Math.max(0, Math.ceil((new Date(d.expires_at) - Date.now()) / 864e5)) : 999
  const log = [d.downloaded_at && [when(d.downloaded_at), 'Downloaded'], d.last_opened_at && [when(d.last_opened_at), 'Opened by the client'], d.favourites_submitted_at && [when(d.favourites_submitted_at), (d.favourites || []).length + ' favourites sent back'], [when(d.created_at), 'Gallery created']].filter(Boolean)
  return { id: 'd-' + d.id, n: d.client_name || d.client_email || 'Client', d: d.title || 'Gallery', k: d.files_purged_at ? 'done' : files.length ? (d.downloaded_at ? 'done' : 'live') : 'wait', files: photos || files.length, films, gb, p: 100, m: 'golden', s: 3, opened: d.opened_at ? 1 : 0, dl: d.download_count || 0, exp: days, link: location.origin.replace(/^https?:\/\//, '') + '/deliver/' + d.download_token, url: location.origin + '/deliver/' + d.download_token, t: low(d.client_email), em: d.client_email || '', msg: d.message || '', pw: d.password_protected ? (d.password || '') : '', cover: coverUrl || '', log, live: d }
}
export async function loadDeliveries(uid) {
  const { data } = await supabase.from('deliveries').select('*').eq('creative_id', uid).order('created_at', { ascending: false })
  const rows = data || []
  const covers = rows.map(d => d.cover_url).filter(p => p && !/^https?:/.test(p))
  let signed = {}
  if (covers.length) { const { data: s } = await supabase.storage.from(DBUCKET).createSignedUrls(covers, 3600); for (const x of s || []) if (x.signedUrl) signed[x.path] = x.signedUrl }
  return rows.map(d => shapeDelivery(d, d.cover_url ? (signed[d.cover_url] || (/^https?:/.test(d.cover_url) ? d.cover_url : '')) : ''))
}
// Upload files into a delivery, one by one (onEach(i, total) for progress). Returns the new file records.
export async function uploadDeliveryFiles(uid, did, files, onEach) {
  const out = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i], path = dPath(uid, did, f.name)
    const { error } = await supabase.storage.from(DBUCKET).upload(path, f, { contentType: f.type || undefined, upsert: false })
    if (!error) out.push({ name: f.name, path, type: f.type, size: f.size })
    onEach?.(i + 1, files.length)
  }
  return out
}
export async function createDelivery(uid, v, onEach) {
  const { data: d, error } = await supabase.from('deliveries').insert({ creative_id: uid, title: v.title, client_name: v.name, client_email: (v.email || '').toLowerCase() || null, message: v.message || null, password_protected: !!v.password, password: v.password || null, download_token: crypto.randomUUID(), expires_at: v.days ? new Date(Date.now() + v.days * 864e5).toISOString() : null, files: [] }).select().single()
  if (error) throw new Error(error.message)
  if (v.files?.length) {
    const up = await uploadDeliveryFiles(uid, d.id, v.files, onEach)
    const first = up.find(isImgF)
    await supabase.from('deliveries').update({ files: up, cover_url: first ? first.path : null }).eq('id', d.id)
    if (up.length < v.files.length) throw new Error((v.files.length - up.length) + ' file(s) did not upload. The gallery is saved; add them again from Add files.')
  }
  if (v.send && d.client_email) await sendDeliveryLive(d.id)
  return d
}
export async function addDeliveryFiles(uid, d, files, onEach) {
  const up = await uploadDeliveryFiles(uid, d.id, files, onEach)
  const all = [...(Array.isArray(d.files) ? d.files : []), ...up], first = all.find(isImgF)
  const { error } = await supabase.from('deliveries').update({ files: all, cover_url: d.cover_url || (first ? first.path : null) }).eq('id', d.id)
  if (error) throw new Error(error.message)
  return up.length
}
export async function sendDeliveryLive(id) {
  const { data, error } = await supabase.functions.invoke('send-delivery', { body: { delivery_id: id } })
  if (error || data?.error) throw new Error('Could not email the link. Try Send link again.')
}
export async function extendDelivery(id, days = 30) {
  const { error } = await supabase.from('deliveries').update({ expires_at: new Date(Date.now() + days * 864e5).toISOString(), expiry_reminder_sent: false }).eq('id', id)
  if (error) throw new Error(error.message)
}
export async function updateDelivery(id, v) {
  const { error } = await supabase.from('deliveries').update({ title: v.title, message: v.message || null, password_protected: !!v.password, password: v.password || null }).eq('id', id)
  if (error) throw new Error(error.message)
}
// Files first, then the row: never orphan objects in the bucket.
export async function deleteDelivery(d) {
  const paths = (Array.isArray(d.files) ? d.files : []).map(f => f.path).filter(Boolean)
  if (paths.length) { const { error } = await supabase.storage.from(DBUCKET).remove(paths); if (error) throw new Error('Could not remove the files, so the gallery was kept. Try again.') }
  const { error } = await supabase.from('deliveries').delete().eq('id', d.id)
  if (error) throw new Error(error.message)
}

// ── Contacts: crm_contacts, merged with everyone you have a thread with ─────────────────────────
// A saved contact is a crm_contacts row (tier-capped by the database). Anyone you have messages,
// quotes or bookings with shows too, unsaved, so the list is never missing a real client.
const crmErr = e => { const m = String(e?.message || e || ''); if (/TIER_LIMIT:crm_records/i.test(m)) return new Error('Your plan has hit its saved-contact limit. Upgrade in Account to save more.'); return new Error(m || 'Could not save the contact.') }
export async function loadContacts(uid) {
  const { data } = await supabase.from('crm_contacts').select('*').eq('creative_id', uid).order('created_at', { ascending: false })
  return data || []
}
// Build the people list from crm rows + threads + ledger + events (all already loaded)
export function shapePeople(rows, threads, ledger, events) {
  const byEmail = new Map(), out = []
  const jobsFor = tid => {
    const bk = events.filter(e => e.t === tid && e.live && (e.k === 'b' || e.k === 'p')).map(e => [e.live.service || 'Booking', nice(e.d), 0, e.k === 'p' ? 'Requested' : low(e.live.status) === 'completed' ? 'Done' : 'Booked'])
    const inv = ledger.filter(r => r.t === tid && r.k === 'inv').map(r => [r.d || 'Invoice', nice(r.date), r.v, r.stt])
    return [...bk, ...inv]
  }
  const paidFor = tid => ledger.filter(r => r.t === tid && r.k === 'inv' && r.st === 'ok').reduce((t, r) => t + r.v, 0)
  const lastFor = tid => { const ds = [...events.filter(e => e.t === tid).map(e => e.d), ...ledger.filter(r => r.t === tid).map(r => r.date)].filter(Boolean).sort(); return ds[ds.length - 1] || '' }
  for (const c of rows) {
    const em = low(c.email).trim(), id = em || 'crm-' + c.id, th = em ? threads.find(t => t.id === em) : null
    const jobs = em ? jobsFor(em) : []
    const p = { id, n: c.name || em || 'Client', co: c.company || c.name || '', t: [c.status || 'Lead', c.company].filter(Boolean).join(' · '), kind: (c.tags || [])[0] || '', j: jobs.length, v: em ? paidFor(em) : Number(c.total_spent) || 0, l: (em && lastFor(em)) || String(c.last_contacted_at || c.created_at || '').slice(0, 10), tags: c.tags || [], g: gradFor(id), em: c.email || '', ph: c.phone || '', social: { ...(c.instagram ? { ig: c.instagram } : {}), ...(c.website ? { web: c.website } : {}) }, notes: c.notes || '', jobs, crm: c, thread: !!th }
    out.push(p); if (em) byEmail.set(em, p)
  }
  for (const t of threads) {
    if (byEmail.has(t.id)) continue
    const jobs = jobsFor(t.id)
    out.push({ id: t.id, n: t.n, co: t.n, t: 'From your threads · not saved', kind: '', j: jobs.length, v: paidFor(t.id), l: lastFor(t.id), tags: [], g: t.g, em: t.email, ph: '', social: {}, notes: '', jobs, crm: null, thread: true })
  }
  return out.sort((a, b) => (b.l || '') > (a.l || '') ? 1 : -1)
}
const crmRow = v => ({ name: (v.n || '').trim(), company: (v.co || '').trim() || null, email: (v.em || '').trim().toLowerCase() || null, phone: (v.ph || '').trim() || null, notes: v.notes ?? undefined, tags: v.tags ?? undefined, instagram: v.ig ?? undefined, website: v.web ?? undefined, status: v.status ?? undefined })
const clean = o => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined))
export async function saveContact(uid, v, existing) {
  const row = clean(crmRow(v))
  if (existing?.id) { const { error } = await supabase.from('crm_contacts').update(row).eq('id', existing.id); if (error) throw crmErr(error); return }
  const { error } = await supabase.from('crm_contacts').insert({ ...row, creative_id: uid, status: row.status || 'Lead', last_contacted_at: new Date().toISOString() })
  if (error) throw crmErr(error)
}
export async function deleteContact(id) { const { error } = await supabase.from('crm_contacts').delete().eq('id', id); if (error) throw crmErr(error) }
export async function importContacts(uid, list, tag) {
  const rows = list.map(([name, email, phone]) => ({ creative_id: uid, name, email: (email || '').toLowerCase() || null, phone: phone || null, status: 'Lead', tags: tag ? [tag] : [], last_contacted_at: new Date().toISOString() }))
  let n = 0
  for (const r of rows) { const { error } = await supabase.from('crm_contacts').insert(r); if (error) { if (n === 0) throw crmErr(error); break } n++ }
  return n
}

// ── The workspace's own settings (no live-site table): one jsonb row per creative ──────────────
export const SYNC_KEYS = ['avail', 'meetingTypes', 'stages', 'checklistTemplates', 'contractTemplates', 'expCats', 'gearCats', 'reviewRules', 'reviewRequests', 'waitlist', 'settings', 'setup']
export async function loadWorkspaceState(uid) {
  const { data } = await supabase.from('workspace_state').select('data').eq('creative_id', uid).maybeSingle()
  return data?.data || null
}
export async function saveWorkspaceState(uid, data) {
  const { error } = await supabase.from('workspace_state').upsert({ creative_id: uid, data, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

// ── Reviews: the creative's side. Core words are frozen by the database; the creative can reply,
// pin up to three, flag, and add (up to five) or remove their own imported ones.
const RV_G = ['linear-gradient(135deg,#1DB954,#0f6b34)', 'linear-gradient(135deg,#7c5cff,#3b2a99)', 'linear-gradient(135deg,#ff8a5c,#b23c17)', 'linear-gradient(135deg,#3cb4ff,#155d99)', 'linear-gradient(135deg,#ff5ca8,#99185a)']
const FLAG_WHY = { never: 'This person was never a client', abuse: 'Abusive or discriminatory', spam: 'Spam or a competitor', private: 'Shares private information', other: 'Something else' }
export function shapeReview(x, i = 0) {
  const date = (x.created_at || '').slice(0, 10), imported = x.source === 'imported'
  const flagged = !!x.flagged && x.flag_status === 'pending'
  return { id: x.id, live: true, who: x.reviewer_name || x.client_name || 'A client', job: x.project_type || 'Job', d: date ? new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '', date, n: x.rating || 5, t: x.body || x.comment || '', reply: x.reply || '', src: imported ? 'Imported' : 'LensTrybe', imported: imported ? 1 : 0, g: RV_G[i % RV_G.length], st: flagged ? 'flagged' : 'public', featured: x.featured ? 1 : 0, flag: flagged ? { why: x.flag_reason || 'other', at: (x.flagged_at || '').slice(0, 10) } : null, removed: x.flag_status === 'resolved_removed' }
}
export async function loadReviews(uid) {
  const { data, error } = await supabase.from('reviews').select('id, rating, body, comment, reviewer_name, client_name, created_at, source, project_type, flagged, flag_reason, flag_status, flagged_at, reply, featured').eq('creative_id', uid).eq('hidden', false).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(shapeReview).filter(r => !r.removed)
}
const rvErr = e => new Error(/FEATURE_LIMIT/.test(e.message) ? 'Three featured is the limit. Unpin one first.' : /IMPORT_LIMIT/.test(e.message) ? 'You can add up to five past reviews.' : /reviews_reply_len/.test(e.message) ? 'Keep the reply under 2000 characters.' : 'Could not save that. Try again.')
export async function replyReviewLive(id, text) { const { error } = await supabase.from('reviews').update({ reply: text || null }).eq('id', id); if (error) throw rvErr(error) }
export async function featureReviewLive(id, on) { const { error } = await supabase.from('reviews').update({ featured: !!on }).eq('id', id); if (error) throw rvErr(error) }
export async function flagReviewLive(id, why, more) {
  const reason = [FLAG_WHY[why] || why, (more || '').trim()].filter(Boolean).join(': ').slice(0, 1000)
  const { error } = await supabase.from('reviews').update({ flagged: true, flag_reason: reason, flag_status: 'pending', flagged_at: new Date().toISOString() }).eq('id', id); if (error) throw rvErr(error)
}
export async function unflagReviewLive(id) { const { error } = await supabase.from('reviews').update({ flagged: false, flag_status: 'none', flag_reason: null, flagged_at: null }).eq('id', id); if (error) throw rvErr(error) }
export async function addPastReviewLive(uid, v) {
  const { error } = await supabase.from('reviews').insert({ creative_id: uid, source: 'imported', rating: Number(v.n) || 5, reviewer_name: v.who.trim().slice(0, 120), client_name: v.who.trim().slice(0, 120), body: v.t.trim().slice(0, 3000), comment: v.t.trim().slice(0, 3000), project_type: (v.job || '').trim().slice(0, 60) || null })
  if (error) throw rvErr(error)
}
export async function removeReviewLive(id) { const { error } = await supabase.from('reviews').delete().eq('id', id).eq('source', 'imported'); if (error) throw rvErr(error) }
export async function requestReviewLive(name, email, message) {
  const { data, error } = await supabase.functions.invoke('send-review-request', { body: { client_name: name, client_email: email, message } })
  if (error) { let m = ''; try { m = (await error.context?.json())?.error } catch { /* */ } throw new Error(m || 'Could not send the review request. Try again.') }
  return data
}
