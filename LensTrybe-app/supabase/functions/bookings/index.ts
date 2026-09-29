// Supabase Edge Function: bookings
// Client-facing (verify_jwt = false), authenticated INSIDE with the caller's JWT.
// Every booking action that involves the other party goes through here so they are
// notified (bell + branded email) and the rules are checked in one place.
//
// Actions (POST body { action, ... }):
//   request     (client)   { creativeId, date, allDay, startTime, endTime, service, location, message, name, phone }
//                          Sends a booking request. Refused when the time is already booked or blocked.
//   respond     (creative) { bookingId, decision: 'accept' | 'decline', note, force }
//                          Accepting a time that overlaps another confirmed booking needs force: true.
//   create      (creative) { clientName, clientEmail, clientPhone, service, date, allDay, startTime, endTime,
//                            location, notes, notifyClient, force }  Adds a confirmed booking.
//   reschedule  (creative) { bookingId, date, allDay, startTime, endTime, location, service, note, notifyClient, force }
//   complete    (creative) { bookingId }
//   cancel      (either)   { bookingId, reason }
//
// Each plan has a monthly confirm cap (Basic 3, Pro 5, Expert and Elite unlimited),
// enforced by the bookings_guard trigger and surfaced here as
// { error, code: 'BOOKING_LIMIT' }. Requests always arrive whatever the plan; the cap
// only limits what the creative can confirm.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { requestToCreativeHtml, requestToClientHtml, createdToClientHtml, responseToClientHtml, rescheduleToClientHtml, creativeCancelledHtml, clientCancelledHtml } from './emails.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

// ---- LensTrybe shared email template (inlined) ----
const FROM = 'LensTrybe <noreply@mail.lenstrybe.com>'
async function sendEmail(resendKey: string, args: { to: string; subject: string; html: string; replyTo?: string }) {
  const body: Record<string, unknown> = { from: FROM, to: [args.to], subject: args.subject, html: args.html }
  if (args.replyTo) body.reply_to = args.replyTo
  try {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) console.error('bookings: resend failed', res.status)
  } catch (e) { console.error('bookings: resend error', e instanceof Error ? e.message : e) }
}
// ---- end shared ----

const APP = 'https://lenstrybe.com'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LIMIT_MSG = "You've confirmed every booking your plan allows this month. Upgrade to confirm more."

function plain(s: unknown, max: number) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }
function multi(s: unknown, max: number) { return String(s ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) }
function brisbaneToday() { return new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10) }
function addDays(d: string, n: number) { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
function toMin(t: string | null) { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
function fmtTime(t: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, '0')}${ap}`
}
function fmtDate(d: string) {
  try { return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) } catch { return d }
}
function whenText(b: { booking_date: string; all_day: boolean; start_time: string | null; end_time: string | null }) {
  const day = fmtDate(b.booking_date)
  return b.all_day || !b.start_time ? `${day} (all day)` : `${day}, ${fmtTime(b.start_time)} to ${fmtTime(b.end_time)}`
}

type Slot = { date: string; allDay: boolean; start: string | null; end: string | null }
function parseSlot(body: Record<string, unknown>): Slot | string {
  const date = String(body.date || '')
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return 'Please choose a date.'
  const allDay = body.allDay === true || body.allDay === 'true'
  if (allDay) return { date, allDay: true, start: null, end: null }
  const start = String(body.startTime || '').slice(0, 5)
  const end = String(body.endTime || '').slice(0, 5)
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return 'Please choose a start and finish time, or pick All day.'
  if (toMin(end)! <= toMin(start)!) return 'The finish time needs to be after the start time.'
  return { date, allDay: false, start, end }
}
function overlaps(a: Slot, b: { all_day: boolean; start_time: string | null; end_time: string | null }) {
  if (a.allDay || b.all_day || !b.start_time || !b.end_time) return true
  const s1 = toMin(a.start)!, e1 = toMin(a.end)!, s2 = toMin(String(b.start_time).slice(0, 5))!, e2 = toMin(String(b.end_time).slice(0, 5))!
  return s1 < e2 && s2 < e1
}

// Confirmed bookings (and, for client requests, blocked availability) that clash with a slot.
async function clashes(sb: SupabaseClient, creativeId: string, slot: Slot, opts: { excludeId?: string; includeBlocked: boolean }) {
  const { data: bookings } = await sb.from('bookings')
    .select('id, client_name, service, all_day, start_time, end_time')
    .eq('creative_id', creativeId).eq('status', 'confirmed').eq('booking_date', slot.date)
  const hits: Array<Record<string, unknown>> = (bookings || []).filter((b) => b.id !== opts.excludeId && overlaps(slot, b as never)).map((b) => ({ ...b, source: 'booked' }))
  if (opts.includeBlocked) {
    const { data: blocks } = await sb.from('availability')
      .select('all_day, start_time, end_time, is_available')
      .eq('creative_id', creativeId).eq('date', slot.date)
    for (const a of blocks || []) {
      if (a.is_available) continue
      const allDay = a.all_day !== false
      if (overlaps(slot, { all_day: allDay, start_time: a.start_time, end_time: a.end_time })) hits.push({ source: 'blocked' })
    }
  }
  return hits
}

async function notify(sb: SupabaseClient, userId: string | null, title: string, body: string, link: string, meta: Record<string, unknown>) {
  if (!userId) return
  try { await sb.from('notifications').insert({ user_id: userId, type: 'booking', title, body, link, meta }) } catch (_e) { /* best effort */ }
}

// What a client may see of a booking: never the creative's private notes.
function forClient(b: Record<string, unknown> | null) {
  if (!b) return b
  const { notes: _notes, ...rest } = b
  return rest
}

function isLimitError(e: { message?: string } | null) { return !!e && String(e.message || '').includes('BOOKING_LIMIT') }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY') || ''
  if (!supabaseUrl || !serviceKey) return json({ error: 'Bookings are not available right now.' }, 500)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token === serviceKey) return json({ error: 'Please sign in to continue.' }, 401)
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return json({ error: 'Please sign in to continue.' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid request.' }, 400) }
  const action = String(body.action || '')

  const rate = async (key: string, max: number, win: number) => {
    const { data } = await sb.rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: win })
    return data !== false
  }

  // The creative's name + email for messages and reply-to.
  async function creativeInfo(creativeId: string) {
    const { data: p } = await sb.from('profiles').select('id, business_name, business_email, pending_deletion, is_admin').eq('id', creativeId).maybeSingle()
    let email = p?.business_email ? String(p.business_email) : ''
    if (!email) {
      const { data: u } = await sb.auth.admin.getUserById(creativeId)
      email = String(u?.user?.email || '')
    }
    return { profile: p, name: plain(p?.business_name || 'Your creative', 80), email }
  }

  async function loadOwned(bookingId: string) {
    if (!UUID_RE.test(bookingId)) return null
    const { data } = await sb.from('bookings').select('*').eq('id', bookingId).maybeSingle()
    return data
  }

  const creativeLink = (id: string) => `/dashboard/my-work/my-bookings?booking=${id}`
  const clientLink = (id: string) => `/client-dashboard?view=bookings&booking=${id}`

  try {
    // =====================================================================
    // Client: request a booking
    // =====================================================================
    if (action === 'request') {
      const creativeId = String(body.creativeId || '')
      if (!UUID_RE.test(creativeId)) return json({ error: 'Creative not found.' }, 400)
      if (creativeId === user.id) return json({ error: "You can't book yourself." }, 400)
      const slot = parseSlot(body)
      if (typeof slot === 'string') return json({ error: slot }, 400)
      const today = brisbaneToday()
      if (slot.date < today) return json({ error: 'Please choose a date from today onwards.' }, 400)
      if (slot.date > addDays(today, 365)) return json({ error: 'Bookings can be requested up to a year ahead.' }, 400)

      const c = await creativeInfo(creativeId)
      if (!c.profile || c.profile.pending_deletion || c.profile.is_admin) return json({ error: 'This creative is not taking bookings right now.' }, 404)
      const { data: active } = await sb.rpc('account_is_active', { p_uid: creativeId })
      if (active === false) return json({ error: 'This creative is not taking bookings right now.' }, 404)

      if (!await rate(`booking-request:${user.id}`, 10, 86400)) return json({ error: "You've sent a lot of booking requests today. Please try again tomorrow." }, 429)
      const { count: openCount } = await sb.from('bookings').select('id', { count: 'exact', head: true })
        .eq('creative_id', creativeId).eq('client_user_id', user.id).eq('status', 'pending')
      if ((openCount || 0) >= 3) return json({ error: `You already have 3 requests waiting for ${c.name} to reply.` }, 429)

      const hits = await clashes(sb, creativeId, slot, { includeBlocked: true })
      if (hits.length) return json({ error: `${c.name} is already booked at that time. Please choose another time or date.`, code: 'UNAVAILABLE' }, 409)

      const { data: ca } = await sb.from('client_accounts').select('first_name, last_name, company_name, pending_deletion').eq('id', user.id).maybeSingle()
      if (ca?.pending_deletion) return json({ error: 'Your account is scheduled for deletion. Reactivate it to make bookings.' }, 403)
      const caName = ca ? plain([ca.first_name, ca.last_name].filter(Boolean).join(' ') || ca.company_name || '', 120) : ''
      const clientName = plain(body.name, 120) || caName || String(user.email || '').split('@')[0]
      const service = plain(body.service, 120)
      const location = plain(body.location, 200)
      const message = multi(body.message, 2000)
      const phone = plain(body.phone, 40)

      const { data: booking, error } = await sb.from('bookings').insert({
        creative_id: creativeId,
        client_user_id: user.id,
        client_name: clientName,
        client_email: String(user.email || '').toLowerCase(),
        client_phone: phone || null,
        service: service || null,
        location: location || null,
        message: message || null,
        booking_date: slot.date,
        all_day: slot.allDay,
        start_time: slot.start,
        end_time: slot.end,
        status: 'pending',
        origin: 'client',
      }).select('*').single()
      if (error || !booking) { console.error('bookings: request insert failed', error?.message); return json({ error: 'Could not send your request. Please try again.' }, 500) }

      await notify(sb, creativeId, `Booking request from ${clientName}`, `${whenText(booking)}${service ? ` · ${service}` : ''}`, creativeLink(booking.id), { booking_id: booking.id })

      if (resendKey && c.email) {
        await sendEmail(resendKey, {
          to: c.email,
          replyTo: booking.client_email || undefined,
          subject: plain(`New booking request from ${clientName}`, 150),
          html: requestToCreativeHtml({ when: whenText(booking), service: booking.service, location: booking.location, clientName, clientEmail: booking.client_email || '', phone, message, url: `${APP}${creativeLink(booking.id)}` }),
        })
      }
      if (resendKey && booking.client_email) {
        await sendEmail(resendKey, {
          to: booking.client_email,
          replyTo: c.email || undefined,
          subject: plain(`Your booking request to ${c.name} has been sent`, 150),
          html: requestToClientHtml({ when: whenText(booking), service: booking.service, location: booking.location, creativeName: c.name, url: `${APP}${clientLink(booking.id)}` }),
        })
      }
      return json({ ok: true, booking: forClient(booking) })
    }

    // =====================================================================
    // Creative: add a booking
    // =====================================================================
    if (action === 'create') {
      const { data: me } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle()
      if (!me) return json({ error: 'Only creatives can add bookings.' }, 403)
      const slot = parseSlot(body)
      if (typeof slot === 'string') return json({ error: slot }, 400)
      const clientName = plain(body.clientName, 120)
      const clientEmail = plain(body.clientEmail, 200).toLowerCase()
      if (!clientName) return json({ error: "Please add the client's name." }, 400)
      if (clientEmail && !EMAIL_RE.test(clientEmail)) return json({ error: "That email address doesn't look right." }, 400)
      if (!await rate(`booking-create:${user.id}`, 60, 3600)) return json({ error: 'Too many bookings at once. Please wait a moment.' }, 429)

      const hits = await clashes(sb, user.id, slot, { includeBlocked: false })
      if (hits.length && body.force !== true) return json({ conflict: true, clashes: hits.map((h) => ({ client_name: h.client_name, service: h.service, all_day: h.all_day, start_time: h.start_time, end_time: h.end_time })) }, 409)

      // Link to a LensTrybe client account with this email so it shows in their dashboard.
      let clientUserId: string | null = null
      if (clientEmail) {
        const { data: ca } = await sb.from('client_accounts').select('id, email').ilike('email', clientEmail.replace(/[\\%_]/g, (m) => `\\${m}`)).limit(1).maybeSingle()
        if (ca?.id && ca.id !== user.id) clientUserId = String(ca.id)
      }

      const { data: booking, error } = await sb.from('bookings').insert({
        creative_id: user.id,
        client_user_id: clientUserId,
        client_name: clientName,
        client_email: clientEmail || null,
        client_phone: plain(body.clientPhone, 40) || null,
        service: plain(body.service, 120) || null,
        location: plain(body.location, 200) || null,
        notes: multi(body.notes, 4000) || null,
        booking_date: slot.date,
        all_day: slot.allDay,
        start_time: slot.start,
        end_time: slot.end,
        status: 'confirmed',
        origin: 'creative',
      }).select('*').single()
      if (isLimitError(error)) return json({ error: LIMIT_MSG, code: 'BOOKING_LIMIT' }, 403)
      if (error || !booking) { console.error('bookings: create failed', error?.message); return json({ error: 'Could not add the booking. Please try again.' }, 500) }

      if (body.notifyClient === true && clientEmail && resendKey) {
        const c = await creativeInfo(user.id)
        await notify(sb, clientUserId, `${c.name} booked you in`, whenText(booking), clientLink(booking.id), { booking_id: booking.id })
        await sendEmail(resendKey, {
          to: clientEmail,
          replyTo: c.email || undefined,
          subject: plain(`Your booking with ${c.name} is confirmed`, 150),
          html: createdToClientHtml({ when: whenText(booking), service: booking.service, location: booking.location, creativeName: c.name, clientName, url: clientUserId ? `${APP}${clientLink(booking.id)}` : undefined }),
        })
      }
      return json({ ok: true, booking })
    }

    // Everything below acts on an existing booking.
    const b = await loadOwned(String(body.bookingId || ''))
    if (!b) return json({ error: 'Booking not found.' }, 404)
    const isCreative = b.creative_id === user.id
    const isClient = !!b.client_user_id && b.client_user_id === user.id
    if (!isCreative && !isClient) return json({ error: 'Booking not found.' }, 404)

    // =====================================================================
    // Creative: accept or decline a request
    // =====================================================================
    if (action === 'respond') {
      if (!isCreative) return json({ error: 'Only the creative can respond to a request.' }, 403)
      if (b.status !== 'pending') return json({ error: 'This request has already been answered.' }, 409)
      const accept = body.decision === 'accept'
      const note = multi(body.note, 1000)
      if (accept && b.booking_date) {
        const slot: Slot = { date: b.booking_date, allDay: b.all_day, start: b.start_time ? String(b.start_time).slice(0, 5) : null, end: b.end_time ? String(b.end_time).slice(0, 5) : null }
        const hits = await clashes(sb, user.id, slot, { excludeId: b.id, includeBlocked: false })
        if (hits.length && body.force !== true) return json({ conflict: true, clashes: hits.map((h) => ({ client_name: h.client_name, service: h.service, all_day: h.all_day, start_time: h.start_time, end_time: h.end_time })) }, 409)
      }
      const { data: upd, error } = await sb.from('bookings').update({ status: accept ? 'confirmed' : 'declined', response_note: note || null })
        .eq('id', b.id).eq('status', 'pending').select('*').maybeSingle()
      if (isLimitError(error)) return json({ error: LIMIT_MSG, code: 'BOOKING_LIMIT' }, 403)
      if (error) { console.error('bookings: respond failed', error.message); return json({ error: 'Could not update the booking. Please try again.' }, 500) }
      if (!upd) return json({ error: 'This request has already been answered.' }, 409)

      const c = await creativeInfo(user.id)
      await notify(sb, upd.client_user_id, accept ? `${c.name} accepted your booking` : `${c.name} can't take your booking`, whenText(upd), clientLink(upd.id), { booking_id: upd.id })
      if (resendKey && upd.client_email) {
        await sendEmail(resendKey, {
          to: upd.client_email,
          replyTo: c.email || undefined,
          subject: plain(accept ? `${c.name} accepted your booking` : `${c.name} can't take your booking`, 150),
          html: responseToClientHtml({ when: whenText(upd), service: upd.service, location: upd.location, accept, creativeName: c.name, note, url: accept ? `${APP}${clientLink(upd.id)}` : `${APP}/creatives` }),
        })
      }
      return json({ ok: true, booking: upd })
    }

    // =====================================================================
    // Creative: move a booking (date / time / details)
    // =====================================================================
    if (action === 'reschedule') {
      if (!isCreative) return json({ error: 'Only the creative can change a booking.' }, 403)
      if (b.status !== 'confirmed' && b.status !== 'pending') return json({ error: 'Only upcoming bookings can be changed.' }, 409)
      const slot = parseSlot(body)
      if (typeof slot === 'string') return json({ error: slot }, 400)
      if (b.status === 'confirmed') {
        const hits = await clashes(sb, user.id, slot, { excludeId: b.id, includeBlocked: false })
        if (hits.length && body.force !== true) return json({ conflict: true, clashes: hits.map((h) => ({ client_name: h.client_name, service: h.service, all_day: h.all_day, start_time: h.start_time, end_time: h.end_time })) }, 409)
      }
      const patch: Record<string, unknown> = { booking_date: slot.date, all_day: slot.allDay, start_time: slot.start, end_time: slot.end }
      if (body.location !== undefined) patch.location = plain(body.location, 200) || null
      if (body.service !== undefined) patch.service = plain(body.service, 120) || null
      const { data: upd, error } = await sb.from('bookings').update(patch).eq('id', b.id).select('*').single()
      if (error || !upd) { console.error('bookings: reschedule failed', error?.message); return json({ error: 'Could not change the booking. Please try again.' }, 500) }
      const note = multi(body.note, 1000)
      const moved = b.booking_date !== upd.booking_date || String(b.start_time || '') !== String(upd.start_time || '') || String(b.end_time || '') !== String(upd.end_time || '') || b.all_day !== upd.all_day
      if (body.notifyClient === true && upd.client_email) {
        const c = await creativeInfo(user.id)
        await notify(sb, upd.client_user_id, `${c.name} updated your booking`, whenText(upd), clientLink(upd.id), { booking_id: upd.id })
        if (resendKey) {
          await sendEmail(resendKey, {
            to: upd.client_email,
            replyTo: c.email || undefined,
            subject: plain(`Your booking with ${c.name} has been updated`, 150),
            html: rescheduleToClientHtml({ when: whenText(upd), service: upd.service, location: upd.location, creativeName: c.name, moved, previously: whenText(b as never), note, url: upd.client_user_id ? `${APP}${clientLink(upd.id)}` : undefined }),
          })
        }
      }
      return json({ ok: true, booking: upd })
    }

    // =====================================================================
    // Creative: mark completed
    // =====================================================================
    if (action === 'complete') {
      if (!isCreative) return json({ error: 'Only the creative can complete a booking.' }, 403)
      if (b.status !== 'confirmed') return json({ error: 'Only confirmed bookings can be marked completed.' }, 409)
      const { data: upd, error } = await sb.from('bookings').update({ status: 'completed' }).eq('id', b.id).select('*').single()
      if (error) return json({ error: 'Could not update the booking. Please try again.' }, 500)
      return json({ ok: true, booking: upd })
    }

    // =====================================================================
    // Either side: cancel
    // =====================================================================
    if (action === 'cancel') {
      if (b.status !== 'pending' && b.status !== 'confirmed') return json({ error: 'This booking can no longer be cancelled.' }, 409)
      const reason = multi(body.reason, 1000)
      const { data: upd, error } = await sb.from('bookings').update({ status: 'cancelled', cancelled_by: isCreative ? 'creative' : 'client', response_note: isCreative && reason ? reason : b.response_note })
        .eq('id', b.id).in('status', ['pending', 'confirmed']).select('*').maybeSingle()
      if (error || !upd) return json({ error: 'Could not cancel the booking. Please try again.' }, 500)
      const c = await creativeInfo(b.creative_id)
      const wasRequest = b.status === 'pending'

      if (isCreative) {
        await notify(sb, upd.client_user_id, `${c.name} cancelled your booking`, whenText(upd), clientLink(upd.id), { booking_id: upd.id })
        if (resendKey && upd.client_email) {
          await sendEmail(resendKey, {
            to: upd.client_email,
            replyTo: c.email || undefined,
            subject: plain(`${c.name} has cancelled your booking`, 150),
            html: creativeCancelledHtml({ when: whenText(upd), service: upd.service, location: upd.location, creativeName: c.name, reason, url: `${APP}/creatives` }),
          })
        }
      } else {
        const who = plain(upd.client_name || 'Your client', 80)
        await notify(sb, upd.creative_id, wasRequest ? `${who} withdrew their booking request` : `${who} cancelled their booking`, whenText(upd), creativeLink(upd.id), { booking_id: upd.id })
        if (resendKey && c.email) {
          await sendEmail(resendKey, {
            to: c.email,
            replyTo: upd.client_email || undefined,
            subject: plain(wasRequest ? `${who} withdrew their booking request` : `${who} cancelled their booking`, 150),
            html: clientCancelledHtml({ when: whenText(upd), service: upd.service, location: upd.location, who, wasRequest, reason, url: `${APP}${creativeLink(upd.id)}` }),
          })
        }
      }
      return json({ ok: true, booking: isCreative ? upd : forClient(upd) })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('bookings error:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
