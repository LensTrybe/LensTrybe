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
    photos: (extra.items || []).map(i => ({ id: i.id, url: i.image_url, title: i.headline || i.title || '', alt: i.alt_text || i.title || '', wide: !!i.featured })), reviews: rv.map(x => ({ id: x.id, who: x.reviewer_name || x.client_name || 'A client', r: x.rating || 5, text: x.body || x.comment || '', when: x.created_at, kind: x.project_type, verified: x.source !== 'imported' })),
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
    supabase.from('reviews').select('id, rating, body, comment, reviewer_name, client_name, created_at, source, project_type').eq('creative_id', id).eq('hidden', false).order('created_at', { ascending: false }).then(r => r.data || []),
    supabase.rpc('creative_unavailable_dates', { p_creative: id }).then(r => (r.data || []).map(x => x.date)),
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
