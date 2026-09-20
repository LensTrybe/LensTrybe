import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { fmtDay, todayIso } from '../../lib/bookings'
import { imageUrl } from '../../lib/imageUrl'

/* The people a client has actually worked with.
 *
 * This was a grid of whoever they had messaged, with a name and a button, which
 * told them nothing they did not already know. A client's question about a
 * creative is always the same one: what have we done together, and is anything
 * still open. So that is what the card answers.
 */

const money = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(n) || 0)

const prettySkills = (list) =>
  (list ?? [])
    .map((t) => String(t).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
    .join(', ')

const btn = {
  minHeight: 40, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 700, border: '1px solid var(--lt-border)',
  background: 'var(--lt-input-bg)', color: 'var(--lt-text)',
}
const greenBtn = {
  ...btn, background: 'rgba(29,185,84,0.14)',
  border: '1px solid rgba(29,185,84,0.42)', color: 'var(--lt-green-text)',
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--lt-faint)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 14.5, fontWeight: 700, marginTop: 3,
        color: tone === 'pink' ? 'var(--lt-pink-text)' : tone === 'green' ? 'var(--lt-green-text)' : 'var(--lt-text)',
      }}>
        {value}
      </div>
    </div>
  )
}

function CreativeCard({ c, onMessage }) {
  const navigate = useNavigate()
  const skills = prettySkills(c.skill_types)
  const where = [c.city, c.state].filter(Boolean).join(', ')

  return (
    <div style={{
      background: 'var(--lt-surface)', border: '1px solid var(--lt-border)',
      borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', gap: 13, alignItems: 'center', minWidth: 0 }}>
        <div aria-hidden style={{
          width: 48, height: 48, flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
          background: 'rgba(29,185,84,0.16)', color: 'var(--lt-green-text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800,
        }}>
          {c.avatar_url
            ? <img loading="lazy" decoding="async" src={imageUrl(c.avatar_url, 48)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (c.business_name?.[0] ?? '?').toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>
            {c.business_name || 'A creative'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>
            {[skills, where].filter(Boolean).join(' · ') || 'On LensTrybe'}
          </div>
        </div>
      </div>

      {c.nextDate ? (
        <div style={{
          borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 600,
          background: 'rgba(29,185,84,0.12)', border: '1px solid rgba(29,185,84,0.34)',
          color: 'var(--lt-green-text)',
        }}>
          Next shoot {fmtDay(c.nextDate, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      ) : c.lastDate ? (
        <div style={{ fontSize: 13, color: 'var(--lt-muted)' }}>
          Last worked together {fmtDay(c.lastDate, { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--lt-faint)' }}>
          No shoots booked yet
        </div>
      )}

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <Stat label="Shoots" value={c.shoots} />
        <Stat label="Paid" value={money(c.paid)} tone={c.paid > 0 ? 'green' : undefined} />
        {c.owing > 0 && <Stat label="Outstanding" value={money(c.owing)} tone="pink" />}
        <Stat label="Documents" value={c.docs} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {c.hasThread && onMessage && (
          <button type="button" style={greenBtn} onClick={() => onMessage(c.id)}>Message</button>
        )}
        <button type="button" style={btn} onClick={() => navigate(`/creatives/${c.id}`)}>
          {c.shoots > 0 ? 'Book again' : 'View profile'}
        </button>
      </div>
    </div>
  )
}

export default function ClientCreativesView({ userId, threadCreatives, onMessage, onFindCreative }) {
  const [bookings, setBookings] = useState([])
  const [documents, setDocuments] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!userId) return undefined
    let ignore = false

    async function load() {
      const [bkRes, docRes] = await Promise.all([
        supabase.rpc('my_client_bookings'),
        supabase.rpc('client_documents'),
      ])
      if (bkRes.error) throw bkRes.error
      if (docRes.error) throw docRes.error
      if (ignore) return
      setBookings(bkRes.data ?? [])
      setDocuments(docRes.data || null)
      setLoading(false)
    }

    load().catch(() => {
      if (ignore) return
      setFailed(true)
      setLoading(false)
    })
    return () => { ignore = true }
  }, [userId, attempt])

  if (failed) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 14.5, color: 'var(--lt-text)' }}>
          We could not load your creatives just then. Try again in a moment.
        </div>
        <button
          type="button"
          onClick={() => { setFailed(false); setLoading(true); setAttempt((n) => n + 1) }}
          style={{
            marginTop: 14, minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none',
            background: '#1DB954', color: '#04120a', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 24, fontSize: 14, color: 'var(--lt-muted)' }}>Loading…</div>
  }

  const today = todayIso()
  const threads = threadCreatives ?? []
  const docCreatives = documents?.creatives ?? []

  // One row per creative, whoever they came from: a thread, a booking, or a
  // document. A client who was only ever sent an invoice still counts.
  const byId = new Map()
  const seed = (id, base) => {
    if (!id) return null
    if (!byId.has(id)) {
      byId.set(id, {
        id, business_name: '', avatar_url: null, city: null, state: null, skill_types: [],
        shoots: 0, paid: 0, owing: 0, docs: 0, lastDate: null, nextDate: null, hasThread: false,
      })
    }
    const row = byId.get(id)
    for (const [k, v] of Object.entries(base || {})) {
      if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) row[k] = v
    }
    return row
  }

  for (const c of docCreatives) {
    seed(c.id, { business_name: c.business_name, avatar_url: c.avatar_url, city: c.city, state: c.state })
  }
  for (const c of threads) {
    const row = seed(c.id, {
      business_name: c.business_name, avatar_url: c.avatar_url,
      city: c.city, state: c.state, skill_types: c.skill_types,
    })
    if (row) row.hasThread = true
  }

  for (const b of bookings) {
    const row = seed(b.creative_id, {})
    if (!row) continue
    const done = b.status === 'completed' || (b.status === 'confirmed' && b.booking_date && b.booking_date < today)
    const upcoming = b.status === 'confirmed' && b.booking_date && b.booking_date >= today
    if (done) {
      row.shoots += 1
      if (!row.lastDate || b.booking_date > row.lastDate) row.lastDate = b.booking_date
    }
    if (upcoming && (!row.nextDate || b.booking_date < row.nextDate)) row.nextDate = b.booking_date
  }

  for (const kind of ['invoices', 'quotes', 'contracts', 'deliveries', 'shot_lists']) {
    for (const d of documents?.[kind] ?? []) {
      const row = seed(d.creative_id, {})
      if (!row) continue
      row.docs += 1
      if (kind !== 'invoices') continue
      const amount = Number(d.amount) || 0
      if (String(d.status || '').toLowerCase() === 'paid') row.paid += amount
      else row.owing += amount
    }
  }

  const rows = [...byId.values()].sort((a, b) => {
    if (a.nextDate && !b.nextDate) return -1
    if (b.nextDate && !a.nextDate) return 1
    if (a.nextDate && b.nextDate) return a.nextDate.localeCompare(b.nextDate)
    if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate)
    if (a.lastDate) return -1
    if (b.lastDate) return 1
    return (a.business_name || '').localeCompare(b.business_name || '')
  })

  if (rows.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>
            No creatives yet
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--lt-muted)', marginTop: 8 }}>
            Once you message or book someone, they stay here with everything you have done together.
          </div>
          {onFindCreative && (
            <button type="button" onClick={onFindCreative} style={{
              marginTop: 18, minHeight: 44, padding: '0 20px', borderRadius: 10, border: 'none',
              background: '#1DB954', color: '#04120a', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              Find a creative
            </button>
          )}
        </div>
      </div>
    )
  }

  const totalPaid = rows.reduce((sum, r) => sum + r.paid, 0)
  const totalOwing = rows.reduce((sum, r) => sum + r.owing, 0)
  const totalShoots = rows.reduce((sum, r) => sum + r.shoots, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>
        My Creatives
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--lt-muted)', margin: '0 0 18px', lineHeight: 1.55 }}>
        {rows.length} {rows.length === 1 ? 'creative' : 'creatives'}, {totalShoots} {totalShoots === 1 ? 'shoot' : 'shoots'}, {money(totalPaid)} paid
        {totalOwing > 0 ? `, ${money(totalOwing)} outstanding` : ''}.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {rows.map((c) => <CreativeCard key={c.id} c={c} onMessage={onMessage} />)}
      </div>
    </div>
  )
}
