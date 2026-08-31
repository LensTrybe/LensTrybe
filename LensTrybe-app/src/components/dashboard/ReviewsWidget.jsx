import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, GREEN, AnalyticsTile, CenterModal } from './widgetKit'
import { monthBuckets, monthKeyOf, trendPct, Sparkline, BarRow } from './analyticsKit'
import { isDemoMode, demoReviews, demoBookings } from '../../lib/demoMode'

const ACCENT = '#f59e0b'

export default function ReviewsWidget({ userId, hostName }) {
  const [reviews, setReviews] = useState([])
  const [clients, setClients] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (isDemoMode()) { setReviews(demoReviews()); setClients(demoBookings()); return }
    supabase.from('reviews').select('rating, created_at, client_name, reviewer_name').eq('creative_id', userId).then(({ data }) => setReviews(data ?? []))
    Promise.all([
      supabase.from('bookings').select('client_name, client_email, created_at').eq('creative_id', userId),
      supabase.from('invoices').select('client_name, client_email, created_at').eq('creative_id', userId),
    ]).then(([b, i]) => setClients([...(b.data ?? []), ...(i.data ?? [])]))
  }, [userId])

  const count = reviews.length
  const avg = count ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0

  const series = useMemo(() => {
    const months = monthBuckets(6); const c = {}
    for (const r of reviews) { const k = monthKeyOf(r.created_at); if (k) c[k] = (c[k] || 0) + 1 }
    return months.map((m) => c[m.key] || 0)
  }, [reviews])
  const trend = trendPct(series)

  const dist = useMemo(() => { const d = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }; for (const r of reviews) { const n = Math.round(Number(r.rating || 0)); if (d[n] != null) d[n] += 1 } return d }, [reviews])
  const distMax = Math.max(1, ...Object.values(dist))

  const awaiting = useMemo(() => {
    const reviewed = new Set()
    for (const r of reviews) { if (r.client_name) reviewed.add(r.client_name.trim().toLowerCase()); if (r.reviewer_name) reviewed.add(r.reviewer_name.trim().toLowerCase()) }
    const byEmail = {}
    for (const c of clients) {
      const email = (c.client_email || '').trim(); const name = (c.client_name || '').trim()
      if (!email || !name) continue
      if (reviewed.has(name.toLowerCase())) continue
      if (!byEmail[email.toLowerCase()]) byEmail[email.toLowerCase()] = { name, email }
    }
    return Object.values(byEmail).slice(0, 12)
  }, [reviews, clients])

  function requestReview(c) {
    const who = hostName || 'us'
    const subject = encodeURIComponent(`Quick favour — a review for ${who}?`)
    const body = encodeURIComponent(`Hi ${c.name},\n\nThank you so much for working with ${who}! If you have a spare minute, I'd really appreciate a short review about your experience — it makes a big difference.\n\nThank you!\n${who}`)
    window.open(`mailto:${c.email}?subject=${subject}&body=${body}`, '_blank')
  }

  return (
    <>
      <AnalyticsTile title="Reviews" value={count ? `★ ${avg.toFixed(1)}` : '—'} sub={count ? `${count} review${count > 1 ? 's' : ''}` : 'no reviews'} trend={trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={series.length ? series : [0, 0]} color={ACCENT} />
      </AnalyticsTile>

      {open ? (
        <CenterModal title="Reviews" subtitle={count ? `${count} review${count > 1 ? 's' : ''}` : 'No reviews yet'} width={720} onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '4px 8px' }}>
              <div style={{ fontSize: 46, fontWeight: 700, color: TEXT, fontFamily: FONT, lineHeight: 1 }}>{count ? avg.toFixed(1) : '—'}</div>
              <div style={{ fontSize: 15, color: '#ffd54a', marginTop: 4 }}>{'★'.repeat(Math.round(avg)) || '—'}</div>
              <div style={{ fontSize: 12.5, color: MUTED, fontFamily: FONT, marginTop: 4 }}>{count} review{count === 1 ? '' : 's'}</div>
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
              {[5, 4, 3, 2, 1].map((st) => <BarRow key={st} label={`${st}★`} value={dist[st]} max={distMax} color={ACCENT} />)}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, marginBottom: 8 }}>Clients who haven&apos;t reviewed yet</div>
            {awaiting.length === 0 ? (
              <div style={{ fontSize: 13.5, color: MUTED, fontFamily: FONT }}>Nobody waiting — everyone with an email on file has reviewed. Nice.</div>
            ) : awaiting.map((c) => (
              <div key={c.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--lt-surface-2)' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, color: TEXT, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: FAINT, fontFamily: FONT }}>{c.email}</span>
                </span>
                <button type="button" onClick={() => requestReview(c)} style={{ flexShrink: 0, background: `${GREEN}22`, border: `1px solid ${GREEN}55`, color: GREEN, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Request review</button>
              </div>
            ))}
          </div>
        </CenterModal>
      ) : null}
    </>
  )
}
