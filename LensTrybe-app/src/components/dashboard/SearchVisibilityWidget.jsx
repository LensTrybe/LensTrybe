import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { FONT, TEXT, MUTED, FAINT, GREEN, DANGER, AnalyticsTile, CenterModal } from './widgetKit'
import { AreaChart, Sparkline } from './analyticsKit'
import { isDemoMode, demoProfileViews, demoSearchImpressions, demoVisibilityStanding } from '../../lib/demoMode'

const ACCENT = '#FF2D78'
const TIER_ORDER = { elite: 1, expert: 2, pro: 3, basic: 4 }

function weekBuckets(n) {
  const out = []
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const day = now.getDay() // 0 Sun
  const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7))
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(monday); start.setDate(monday.getDate() - i * 7)
    out.push({ start, label: start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) })
  }
  return out
}
function bucketByWeek(rows, weeks) {
  const counts = weeks.map(() => 0)
  for (const r of rows) {
    const t = new Date(r.created_at).getTime()
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (t >= weeks[i].start.getTime()) { counts[i]++; break }
    }
  }
  return counts
}

const card = { flex: '1 1 130px', background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: 14, padding: '13px 15px' }
const cardLabel = { fontSize: 11.5, color: MUTED, fontFamily: FONT }
const cardValue = { fontSize: 23, fontWeight: 700, color: TEXT, fontFamily: FONT, letterSpacing: '-0.02em', marginTop: 3 }
const secLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, fontFamily: FONT, margin: '18px 0 8px' }

function TrendPill({ pct }) {
  if (pct == null) return null
  const up = pct >= 0
  return <span style={{ fontSize: 12, fontWeight: 600, color: up ? GREEN : DANGER, fontFamily: FONT }}>{up ? '↑' : '↓'} {Math.abs(pct)}%</span>
}

export default function SearchVisibilityWidget({ userId, tier = 'basic' }) {
  const isPro = ['pro', 'expert', 'elite'].includes(tier)
  const isExpert = ['expert', 'elite'].includes(tier)
  const [views, setViews] = useState([])
  const [impressions, setImpressions] = useState([])
  const [standing, setStanding] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (isDemoMode()) { setViews(demoProfileViews()); setImpressions(demoSearchImpressions()); return }
    const since = new Date(); since.setDate(since.getDate() - 84)
    const sinceIso = since.toISOString()
    supabase.from('profile_views').select('created_at, source').eq('creative_id', userId).gte('created_at', sinceIso).then(({ data }) => setViews(data ?? []))
    if (isPro) supabase.from('search_impressions').select('created_at').eq('creative_id', userId).gte('created_at', sinceIso).then(({ data }) => setImpressions(data ?? []))
  }, [userId, isPro])

  // Expert+: approximate search standing within primary skill + state.
  useEffect(() => {
    if (isDemoMode()) { setStanding(demoVisibilityStanding()); return }
    if (!userId || !isExpert) return
    let cancelled = false
    ;(async () => {
      const { data: me } = await supabase.from('profiles').select('skill_types, state, subscription_tier').eq('id', userId).maybeSingle()
      if (!me || cancelled) return
      const skill = Array.isArray(me.skill_types) ? me.skill_types[0] : null
      if (!skill || !me.state) { setStanding({ na: true }); return }
      const { data: peers } = await supabase.from('profiles').select('subscription_tier').eq('is_admin', false).eq('state', me.state).contains('skill_types', [skill])
      if (!peers || cancelled) return
      const myOrder = TIER_ORDER[String(me.subscription_tier || 'basic').toLowerCase()] ?? 4
      const above = peers.filter((p) => (TIER_ORDER[String(p.subscription_tier || 'basic').toLowerCase()] ?? 4) < myOrder).length
      setStanding({ skill, state: me.state, rank: above + 1, total: peers.length })
    })()
    return () => { cancelled = true }
  }, [userId, isExpert])

  const d = useMemo(() => {
    const now = Date.now()
    const in30 = (rows) => rows.filter((r) => now - new Date(r.created_at).getTime() <= 30 * 86400000).length
    const prev30 = (rows) => rows.filter((r) => { const a = now - new Date(r.created_at).getTime(); return a > 30 * 86400000 && a <= 60 * 86400000 }).length
    const v30 = in30(views), vPrev = prev30(views)
    const trend = vPrev ? Math.round(((v30 - vPrev) / vPrev) * 100) : (v30 ? 100 : null)
    const imp30 = in30(impressions)
    const ctr = imp30 ? Math.round((v30 / imp30) * 100) : null
    const bySource = {}
    for (const r of views) { const k = r.source || 'direct'; bySource[k] = (bySource[k] || 0) + 1 }
    return { v30, trend, imp30, ctr, bySource }
  }, [views, impressions])

  const weeks = useMemo(() => weekBuckets(12), [])
  const viewSeries = useMemo(() => bucketByWeek(views, weeks), [views, weeks])

  const sourceLabels = { profile: 'Direct profile', search: 'Search', explore: 'Explore', direct: 'Direct link' }

  return (
    <>
      <AnalyticsTile title="Visibility" value={d.v30} sub="views · 30d" trend={d.trend} accent={ACCENT} onClick={() => setOpen(true)}>
        <Sparkline data={viewSeries} color={ACCENT} />
      </AnalyticsTile>

      {open ? (
        <CenterModal title="Search visibility" subtitle="How clients are finding you on LensTrybe" onClose={() => setOpen(false)} width={640}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={card}>
              <div style={cardLabel}>Profile views · 30d</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={cardValue}>{d.v30}</span><TrendPill pct={d.trend} /></div>
            </div>
            <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
              <div style={cardLabel}>Search appearances · 30d</div>
              <div style={cardValue}>{isPro ? d.imp30 : '—'}</div>
              {!isPro ? <LockNote text="Pro+" /> : null}
            </div>
            <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
              <div style={cardLabel}>Click-through rate</div>
              <div style={cardValue}>{isExpert ? (d.ctr == null ? '—' : `${d.ctr}%`) : '—'}</div>
              {!isExpert ? <LockNote text="Expert+" /> : null}
            </div>
          </div>

          <div style={secLabel}>Profile views · last 12 weeks</div>
          {isPro ? (
            <AreaChart data={viewSeries} xLabels={weeks.map((w) => w.label)} color={ACCENT} width={600} height={200} yFormat={(v) => String(Math.round(v))} />
          ) : (
            <UpgradePanel navigateTo="/dashboard/settings/subscription" line="See your view trend, where clients find you, and how often you appear in search." cta="Upgrade to Pro" />
          )}

          {isPro ? (
            <>
              <div style={secLabel}>Where your views come from</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.keys(d.bySource).length === 0 ? (
                  <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>No views logged yet. As clients open your profile from search and explore, they'll show here.</div>
                ) : Object.entries(d.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', borderBottom: '1px solid var(--lt-surface-2)', fontFamily: FONT }}>
                    <span style={{ fontSize: 13.5, color: TEXT }}>{sourceLabels[k] || k}</span>
                    <span style={{ fontSize: 13.5, color: MUTED }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div style={secLabel}>Your search standing</div>
          {isExpert ? (
            standing == null ? <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>Working it out…</div>
            : standing.na ? <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>Add your main skill and state to see where you rank in search.</div>
            : (
              <div style={{ background: 'rgba(255,45,120,0.06)', border: '1px solid rgba(255,45,120,0.22)', borderRadius: 14, padding: '14px 16px', fontFamily: FONT }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em' }}>#{standing.rank} <span style={{ fontSize: 14, fontWeight: 500, color: MUTED }}>of {standing.total}</span></div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>for {standing.skill} in {standing.state}. Higher tiers and a complete profile lift you up the results.</div>
              </div>
            )
          ) : (
            <UpgradePanel navigateTo="/dashboard/settings/subscription" line="See exactly where you rank in search for your specialty and area, plus your click-through rate." cta="Upgrade to Expert" />
          )}
        </CenterModal>
      ) : null}
    </>
  )
}

function LockNote({ text }) {
  return <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#FF2D78', fontFamily: FONT, background: 'rgba(255,45,120,0.14)', borderRadius: 999, padding: '2px 7px' }}>{text}</div>
}

function UpgradePanel({ line, cta, navigateTo }) {
  const navigate = useNavigate()
  return (
    <div style={{ background: 'var(--lt-surface)', border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 14, padding: '18px 16px', textAlign: 'center', fontFamily: FONT }}>
      <div style={{ fontSize: 13.5, color: MUTED, maxWidth: 380, margin: '0 auto 12px' }}>{line}</div>
      <button type="button" onClick={() => navigate(navigateTo)} style={{ border: '1px solid #FF2D7866', background: 'rgba(255,45,120,0.18)', color: '#FF2D78', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>{cta}</button>
    </div>
  )
}
