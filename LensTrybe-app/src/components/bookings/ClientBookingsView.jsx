import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { bookingAction, bookingStatus, downloadBookingIcs, fmtDayLong, timeText, todayIso } from '../../lib/bookings'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'
import { imageUrl } from '../../lib/imageUrl'

/* The client's side of a booking.
 *
 * This used to be a status line and a cancel button on light only tokens, so it
 * rendered as white cards on the dark dashboard. It is now on --lt-* like the
 * rest of the signed in product, and it carries the things a client actually
 * wants on the day: what was agreed, the paperwork attached to it, the date in
 * their own calendar, and a way to say something has changed.
 */

const PINK = 'var(--lt-pink-text)'

const card = {
  background: 'var(--lt-surface)',
  border: '1px solid var(--lt-border)',
  borderRadius: 14,
  padding: '16px 18px',
}

const btn = {
  minHeight: 40,
  padding: '0 16px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: '1px solid var(--lt-border)',
  background: 'var(--lt-input-bg)',
  color: 'var(--lt-text)',
}

const primaryBtn = { ...btn, background: '#1DB954', color: '#04120a', border: 'none' }
const dangerBtn = { ...btn, color: PINK, borderColor: 'rgba(255,45,120,0.38)', background: 'transparent' }

const DOC_KINDS = [
  { key: 'quotes', label: 'Quote', href: (r) => (r.view_token ? `/doc/quote/${r.view_token}` : null) },
  { key: 'invoices', label: 'Invoice', href: (r) => (r.view_token ? `/doc/invoice/${r.view_token}` : null) },
  { key: 'contracts', label: 'Contract', href: (r) => (r.signing_token ? `/sign/${r.signing_token}` : r.contract_file_url || null) },
  { key: 'deliveries', label: 'Gallery', href: (r) => (r.files_purged_at || !r.download_token ? null : `/deliver/${r.download_token}`) },
  { key: 'shot_lists', label: 'Shot list', href: (r) => (r.client_token ? `/shot-list/${r.client_token}` : null) },
]

function StatusPill({ status }) {
  const m = bookingStatus(status)
  return (
    <span style={{
      padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
      color: m.color, background: m.bg, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {m.label}
    </span>
  )
}

function DocChip({ label, href }) {
  const inner = (
    <>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {href && <span aria-hidden style={{ opacity: 0.6 }}>›</span>}
    </>
  )
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 11px',
    borderRadius: 999, fontSize: 12.5, textDecoration: 'none',
    background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)',
    color: href ? 'var(--lt-text)' : 'var(--lt-faint)',
  }
  return href ? <a href={href} style={style}>{inner}</a> : <span style={style}>{inner}</span>
}

function Stars({ value, onChange, hover, onHover }) {
  return (
    <div style={{ display: 'flex', gap: 2 }} onMouseLeave={() => onHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => onHover(n)}
          style={{
            width: 38, height: 38, border: 'none', background: 'transparent', cursor: 'pointer',
            padding: 0, fontSize: 24, lineHeight: 1,
            color: n <= (hover ?? value) ? '#F5B544' : 'var(--lt-border)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function ReviewPrompt({ creativeName, onSubmit }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div style={{ fontSize: 13, color: 'var(--lt-green-text)', fontWeight: 600 }}>
        Thanks, your review is live on their profile.
      </div>
    )
  }

  if (!open) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        borderRadius: 12, padding: '12px 14px',
        background: 'rgba(245,181,68,0.10)', border: '1px solid rgba(245,181,68,0.32)',
      }}>
        <div style={{ flexGrow: 1, minWidth: 180, fontSize: 13.5, color: 'var(--lt-text)' }}>
          How did it go with {creativeName}?
        </div>
        <button type="button" style={primaryBtn} onClick={() => setOpen(true)}>Leave a review</button>
      </div>
    )
  }

  async function submit() {
    if (!body.trim()) { setError('Say a line or two about how it went.'); return }
    setBusy(true); setError('')
    const res = await onSubmit({ rating, body: body.trim() })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setDone(true)
  }

  return (
    <div style={{
      borderRadius: 12, padding: '14px 16px',
      background: 'rgba(245,181,68,0.08)', border: '1px solid rgba(245,181,68,0.32)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--lt-text)' }}>
        Your review of {creativeName}
      </div>
      <Stars value={rating} onChange={setRating} hover={hover} onHover={setHover} />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1500}
        placeholder="What were they like to work with?"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--lt-input-border)', background: 'var(--lt-input-bg)',
          color: 'var(--lt-text)', fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical',
        }}
      />
      {error && <div style={{ fontSize: 12.5, color: PINK }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" style={btn} onClick={() => setOpen(false)} disabled={busy}>Not now</button>
        <button type="button" style={primaryBtn} onClick={submit} disabled={busy}>
          {busy ? 'Posting…' : 'Post review'}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--lt-faint)' }}>
        Your review shows publicly on their profile with your name.
      </div>
    </div>
  )
}

function BookingCard({ b, creative, docs, highlight, reviewable, onCancelled, onMessage, onReview }) {
  const navigate = useNavigate()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canCancel = b.status === 'pending' || b.status === 'confirmed'
  const name = creative?.business_name || 'Your creative'

  async function cancel() {
    setBusy(true); setError('')
    const res = await bookingAction('cancel', { bookingId: b.id, reason })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    onCancelled(res.booking)
    setCancelling(false)
  }

  return (
    <div
      id={`booking-${b.id}`}
      style={{
        ...card,
        border: highlight ? '2px solid #1DB954' : card.border,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          {creative?.avatar_url
            ? <img loading="lazy" decoding="async" src={imageUrl(creative.avatar_url, 42)} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div aria-hidden style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(29,185,84,0.16)', color: 'var(--lt-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{name.charAt(0)}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{name}</div>
            <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: 2 }}>
              {b.booking_date ? fmtDayLong(b.booking_date) : 'Date to be confirmed'} · {timeText(b)}
            </div>
          </div>
        </div>
        <StatusPill status={b.status} />
      </div>

      {(b.service || b.location) && (
        <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>
          {[b.service, b.location].filter(Boolean).join(' · ')}
        </div>
      )}

      {b.status === 'pending' && (
        <div style={{ fontSize: 12.5, color: 'var(--lt-faint)' }}>
          Waiting for {name} to accept. Nothing is booked until they do.
        </div>
      )}

      {b.response_note && (b.status === 'confirmed' || b.status === 'declined' || (b.status === 'cancelled' && b.cancelled_by === 'creative')) && (
        <div style={{ fontSize: 13, color: 'var(--lt-text)', background: 'var(--lt-surface-2)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          <strong>{b.status === 'cancelled' ? 'Reason: ' : `Note from ${name}: `}</strong>{b.response_note}
        </div>
      )}

      {b.status === 'cancelled' && (
        <div style={{ fontSize: 12.5, color: 'var(--lt-faint)' }}>
          Cancelled by {b.cancelled_by === 'client' ? 'you' : name}.
        </div>
      )}

      {docs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--lt-faint)', marginBottom: 7 }}>
            Attached to this booking
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {docs.map((d) => <DocChip key={d.id} label={d.label} href={d.href} />)}
          </div>
        </div>
      )}

      {reviewable && <ReviewPrompt creativeName={name} onSubmit={onReview} />}

      {cancelling ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={`Let ${name} know why (optional)`}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--lt-input-border)', background: 'var(--lt-input-bg)',
              color: 'var(--lt-text)', fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical',
            }}
          />
          {error && <div style={{ fontSize: 12.5, color: PINK }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={() => setCancelling(false)} disabled={busy}>Keep it</button>
            <button type="button" style={dangerBtn} onClick={cancel} disabled={busy}>
              {busy ? 'Cancelling…' : b.status === 'pending' ? 'Withdraw request' : 'Cancel booking'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {b.booking_date && b.status === 'confirmed' && (
            <button type="button" style={btn} onClick={() => downloadBookingIcs(b, name)}>Add to calendar</button>
          )}
          {onMessage && canCancel && (
            <button type="button" style={btn} onClick={() => onMessage(b.creative_id)}>Request a change</button>
          )}
          <button type="button" style={btn} onClick={() => navigate(`/creatives/${b.creative_id}`)}>View profile</button>
          {canCancel && (
            <button type="button" style={dangerBtn} onClick={() => setCancelling(true)}>
              {b.status === 'pending' ? 'Withdraw request' : 'Cancel booking'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientBookingsView({ userId, highlightId, onMessageCreative }) {
  const navigate = useNavigate()
  const { user, clientAccount } = useAuth()
  const [bookings, setBookings] = useState([])
  const [creatives, setCreatives] = useState({})
  const [documents, setDocuments] = useState(null)
  const [reviewed, setReviewed] = useState([])
  const [loading, setLoading] = useState(true)

  // Everything lands in one pass, and a response that arrives after the view has
  // gone is dropped rather than setting state on a component that is not there.
  useEffect(() => {
    if (!userId) return undefined
    let ignore = false
    const email = (user?.email || '').toLowerCase()

    async function load() {
      const { data } = await supabase.rpc('my_client_bookings')
      const rows = data ?? []
      if (ignore) return
      setBookings(rows)

      const ids = [...new Set(rows.map((b) => b.creative_id).filter(Boolean))]
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, business_name, avatar_url').in('id', ids)
        if (ignore) return
        const map = {}
        for (const p of profs ?? []) map[p.id] = p
        setCreatives(map)

        // Which of these creatives has this person already reviewed? Reviews
        // carry no booking id, so creative plus reviewer email is the key.
        if (email) {
          const { data: mine } = await supabase
            .from('reviews').select('creative_id').in('creative_id', ids).ilike('reviewer_email', email)
          if (ignore) return
          setReviewed((mine ?? []).map((r) => r.creative_id))
        }
      }

      const { data: docs } = await supabase.rpc('client_documents')
      if (ignore) return
      setDocuments(docs || null)
      setLoading(false)
    }

    load()
    return () => { ignore = true }
  }, [userId, user?.email])

  useEffect(() => {
    if (!highlightId || loading) return
    const el = document.getElementById(`booking-${highlightId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, loading])

  const today = todayIso()

  const groups = useMemo(() => {
    const active = bookings.filter((b) => (b.status === 'pending' || b.status === 'confirmed') && (!b.booking_date || b.booking_date >= today))
    const past = bookings.filter((b) => !active.includes(b)).sort((a, b) => String(b.booking_date || '').localeCompare(String(a.booking_date || '')))
    return { active, past }
  }, [bookings, today])

  // Paperwork lines up with a booking through the project they share.
  const docsFor = useCallback((booking) => {
    if (!documents || !booking.project_id) return []
    const out = []
    for (const kind of DOC_KINDS) {
      for (const row of documents[kind.key] || []) {
        if (row.project_id !== booking.project_id) continue
        out.push({ id: `${kind.key}:${row.id}`, label: kind.label, href: kind.href(row) })
      }
    }
    return out
  }, [documents])

  // A shoot that has happened, or been marked done, is one worth reviewing. A
  // review is about the creative rather than the booking, so only the most
  // recent eligible shoot with each creative carries the prompt. Asking twice on
  // the same page for the same person reads as a bug.
  const reviewTargets = useMemo(() => {
    if (!user?.email) return new Map()
    const best = new Map()
    for (const b of bookings) {
      if (reviewed.includes(b.creative_id)) continue
      const done = b.status === 'completed'
        || (b.status === 'confirmed' && Boolean(b.booking_date) && b.booking_date < today)
      if (!done) continue
      const current = best.get(b.creative_id)
      if (!current || String(b.booking_date || '') > String(current.date || '')) {
        best.set(b.creative_id, { id: b.id, date: b.booking_date })
      }
    }
    return best
  }, [bookings, reviewed, today, user?.email])

  const reviewable = useCallback(
    (b) => reviewTargets.get(b.creative_id)?.id === b.id,
    [reviewTargets],
  )

  const reviewerName = clientAccount
    ? `${clientAccount.first_name ?? ''} ${clientAccount.last_name ?? ''}`.trim()
    : ''

  const submitReview = useCallback(async (creativeId, { rating, body }) => {
    const mod = await moderateText(body)
    if (mod?.blocked) return { ok: false, error: MODERATION_BLOCKED_USER_MESSAGE }

    const name = reviewerName || (user?.email || '').split('@')[0]
    const { data, error } = await supabase.from('reviews').insert({
      creative_id: creativeId,
      reviewer_name: name,
      reviewer_email: user?.email || '',
      client_name: name,
      rating,
      body,
      comment: body,
      source: 'platform',
    }).select()

    if (error) return { ok: false, error: 'We could not post that just then. Try again in a moment.' }

    const id = Array.isArray(data) ? data[0]?.id : null
    if (id) supabase.functions.invoke('notify-review', { body: { review_id: id } }).catch(() => {})
    setReviewed((prev) => [...prev, creativeId])
    return { ok: true }
  }, [reviewerName, user?.email])

  function replace(u) { setBookings((prev) => prev.map((b) => (b.id === u.id ? u : b))) }

  const render = (b) => (
    <BookingCard
      key={b.id}
      b={b}
      creative={creatives[b.creative_id]}
      docs={docsFor(b)}
      highlight={b.id === highlightId}
      reviewable={reviewable(b)}
      onCancelled={replace}
      onMessage={onMessageCreative}
      onReview={(payload) => submitReview(b.creative_id, payload)}
    />
  )

  const heading = {
    fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--lt-faint)',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 760 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>
          My Bookings
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--lt-muted)', margin: '0 0 18px', lineHeight: 1.55 }}>
          Requests you have sent, and bookings creatives have confirmed with you.
        </p>

        {loading ? (
          <div style={{ color: 'var(--lt-muted)', fontSize: 14 }}>Loading…</div>
        ) : bookings.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '32px 18px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--lt-text)' }}>No bookings yet</div>
            <div style={{ fontSize: 13.5, color: 'var(--lt-muted)', marginBottom: 14 }}>
              Find a creative and tap Request a Booking on their profile.
            </div>
            <button type="button" style={primaryBtn} onClick={() => navigate('/creatives')}>Find a creative</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.active.length > 0 && <div style={heading}>Upcoming and requested</div>}
            {groups.active.map(render)}
            {groups.past.length > 0 && <div style={{ ...heading, marginTop: 10 }}>Past, declined and cancelled</div>}
            {groups.past.map(render)}
          </div>
        )}
      </div>
    </div>
  )
}
