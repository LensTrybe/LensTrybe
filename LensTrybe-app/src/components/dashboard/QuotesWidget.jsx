import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, GREEN, DANGER, AnalyticsTile, CenterModal } from './widgetKit'
import { currency, monthBuckets, monthKeyOf, trendPct, Sparkline } from './analyticsKit'
import { isDemoMode, demoQuotes } from '../../lib/demoMode'

const ACCENT = '#38bdf8'
const STALE_DAYS = 5

const AWAITING = ['sent', 'viewed']

function daysAgo(v) {
  if (!v) return 0
  return Math.floor((Date.now() - new Date(v).getTime()) / 86400000)
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function statusChip(status) {
  const s = String(status || '').toLowerCase()
  const map = {
    draft: { bg: 'var(--lt-border)', fg: MUTED, label: 'Draft' },
    sent: { bg: 'rgba(56,189,248,0.18)', fg: ACCENT, label: 'Sent' },
    viewed: { bg: 'rgba(245,158,11,0.18)', fg: '#f59e0b', label: 'Viewed' },
    accepted: { bg: 'rgba(29,185,84,0.18)', fg: GREEN, label: 'Accepted' },
    declined: { bg: 'rgba(224,106,120,0.18)', fg: DANGER, label: 'Declined' },
  }
  const c = map[s] || map.draft
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.fg, fontFamily: FONT }}>{c.label}</span>
}

const card = { flex: '1 1 130px', background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 14, padding: '13px 15px' }
const cardLabel = { fontSize: 11.5, color: MUTED, fontFamily: FONT }
const cardValue = { fontSize: 23, fontWeight: 700, color: TEXT, fontFamily: FONT, letterSpacing: '-0.02em', marginTop: 3 }
const secLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, margin: '18px 0 8px' }

export default function QuotesWidget({ userId }) {
  const [quotes, setQuotes] = useState([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) return
    if (isDemoMode()) { setQuotes(demoQuotes()); return }
    supabase.from('quotes')
      .select('id, client_name, client_email, amount, status, valid_until, created_at')
      .eq('creative_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setQuotes(data ?? []))
  }, [userId])

  const d = useMemo(() => {
    const today = todayStr()
    const awaiting = quotes.filter((q) => AWAITING.includes(String(q.status).toLowerCase()))
    const accepted = quotes.filter((q) => String(q.status).toLowerCase() === 'accepted')
    const declined = quotes.filter((q) => String(q.status).toLowerCase() === 'declined')
    const awaitingValue = awaiting.reduce((a, q) => a + Number(q.amount || 0), 0)
    const followUps = awaiting
      .map((q) => ({ ...q, age: daysAgo(q.created_at), expired: q.valid_until && q.valid_until < today }))
      .filter((q) => q.age >= STALE_DAYS || q.expired)
      .sort((a, b) => b.age - a.age)
    const decided = accepted.length + declined.length
    const winRate = decided ? Math.round((accepted.length / decided) * 100) : null
    const months = monthBuckets(6); const cnt = {}
    for (const q of quotes) { const k = monthKeyOf(q.created_at); if (k) cnt[k] = (cnt[k] || 0) + 1 }
    const series = months.map((m) => cnt[m.key] || 0)
    return { awaiting, accepted, declined, awaitingValue, followUps, winRate, series, trend: trendPct(series) }
  }, [quotes])

  function go(path) { setOpen(false); navigate(path) }

  function followUpMailto(q) {
    const subject = encodeURIComponent(`Following up on your quote${q.amount ? ` (${currency(q.amount)})` : ''}`)
    const body = encodeURIComponent(`Hi ${q.client_name || 'there'},\n\nJust following up on the quote I sent through${q.age ? ` a little while ago` : ''}. Happy to answer any questions or adjust anything to suit.\n\nLooking forward to hearing from you.\n\nAll the best`)
    return `mailto:${q.client_email || ''}?subject=${subject}&body=${body}`
  }

  return (
    <>
      <AnalyticsTile title="Quotes" value={d.awaiting.length || '0'} sub={d.followUps.length ? `${d.followUps.length} to chase` : (d.awaiting.length ? 'awaiting reply' : 'all responded')} trend={d.trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={d.series} color={ACCENT} />
      </AnalyticsTile>

      {open ? (
        <CenterModal title="Quotes pipeline" subtitle="Track quotes and chase the ones going cold" onClose={() => setOpen(false)} width={620} headerRight={<button type="button" onClick={() => go('/dashboard/finance/quotes')} style={{ border: '1px solid var(--lt-input-border)', background: 'var(--lt-surface-2)', color: TEXT, borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontFamily: FONT, cursor: 'pointer' }}>Open quotes →</button>}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={card}><div style={cardLabel}>Awaiting reply</div><div style={cardValue}>{d.awaiting.length}</div><div style={{ fontSize: 12, color: MUTED, fontFamily: FONT, marginTop: 2 }}>{currency(d.awaitingValue)} in play</div></div>
            <div style={card}><div style={cardLabel}>Accepted</div><div style={{ ...cardValue, color: GREEN }}>{d.accepted.length}</div></div>
            <div style={card}><div style={cardLabel}>Win rate</div><div style={cardValue}>{d.winRate == null ? '—' : `${d.winRate}%`}</div><div style={{ fontSize: 12, color: MUTED, fontFamily: FONT, marginTop: 2 }}>{d.accepted.length} won · {d.declined.length} lost</div></div>
          </div>

          <div style={secLabel}>Needs a follow-up</div>
          {d.followUps.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT, padding: '4px 0 8px' }}>Nothing going cold. Quotes show here once they've sat unanswered for {STALE_DAYS}+ days or passed their valid-until date.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.followUps.map((q) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 12, padding: '11px 13px', fontFamily: FONT }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.client_name || 'Unnamed client'}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{currency(q.amount)} · {q.expired ? 'quote expired' : `sent ${q.age} days ago`}</div>
                  </div>
                  <a href={followUpMailto(q)} style={{ flexShrink: 0, textDecoration: 'none', border: `1px solid ${ACCENT}66`, background: `${ACCENT}22`, color: ACCENT, borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 600 }}>Follow up</a>
                </div>
              ))}
            </div>
          )}

          <div style={secLabel}>All quotes</div>
          {quotes.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>No quotes yet. Create one from the Quotes page to start tracking your pipeline.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {quotes.slice(0, 40).map((q) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderBottom: '1px solid var(--lt-surface-2)', fontFamily: FONT }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.client_name || 'Unnamed client'}</div>
                    <div style={{ fontSize: 11.5, color: FAINT, marginTop: 1 }}>{new Date(q.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <span style={{ fontSize: 13.5, color: TEXT, fontFamily: FONT }}>{currency(q.amount)}</span>
                  {statusChip(q.status)}
                </div>
              ))}
            </div>
          )}
        </CenterModal>
      ) : null}
    </>
  )
}
