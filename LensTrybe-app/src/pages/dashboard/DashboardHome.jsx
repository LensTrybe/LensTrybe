import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import DashboardTasks from '../../components/dashboard/DashboardTasks'
import WidgetGrid, { nextSize } from '../../components/dashboard/WidgetGrid'
import { LiquidLensFilter } from '../../components/ui/liquidGlass'
import WorkspaceSearch from '../../components/dashboard/WorkspaceSearch'
import ScatteredSquares from '../../components/dashboard/ScatteredSquares'
import { themeTokens } from '../../lib/dashboardTheme'

const FONT = "'Inter', sans-serif"

function currency(n) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(n || 0))
}
function timeAgo(v) {
  if (!v) return ''
  const s = Math.max(1, Math.floor((Date.now() - new Date(v).getTime()) / 1000))
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
function shortDate(v) {
  return new Date(v).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function JumpRow({ t, left, sub, right, onClick, dot }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: t.rowBorder, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        {dot ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, boxShadow: t.dark ? `0 0 8px ${dot}` : 'none' }} /> : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: t.text, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{left}</div>
          {sub ? <div style={{ fontSize: 12, color: t.textMuted, fontFamily: FONT }}>{sub}</div> : null}
        </div>
      </div>
      {right ? <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, whiteSpace: 'nowrap', fontFamily: FONT }}>{right}</div> : null}
    </div>
  )
}

const DEFAULT_LAYOUT = [
  { id: 'needs_today', size: 'lg', hidden: false },
  { id: 'this_week', size: 'md', hidden: false },
  { id: 'money', size: 'md', hidden: false },
  { id: 'board', size: 'lg', hidden: false },
  { id: 'job_matches', size: 'md', hidden: false },
  { id: 'visibility', size: 'md', hidden: false },
  { id: 'deliverables', size: 'sm', hidden: false },
  { id: 'reviews', size: 'sm', hidden: false },
  { id: 'leads', size: 'sm', hidden: false },
  { id: 'goal', size: 'sm', hidden: false },
  { id: 'lumi', size: 'sm', hidden: false },
  { id: 'quick_actions', size: 'md', hidden: false },
]

function mergeLayout(saved, ids) {
  const valid = Array.isArray(saved) ? saved.filter((l) => ids.includes(l.id)) : []
  const base = valid.length ? valid : DEFAULT_LAYOUT.filter((l) => ids.includes(l.id))
  const baseSeen = new Set(base.map((l) => l.id))
  const missing = DEFAULT_LAYOUT.filter((l) => ids.includes(l.id) && !baseSeen.has(l.id))
  return [...base, ...missing].map((l) => ({ id: l.id, size: l.size || 'md', hidden: !!l.hidden }))
}

export default function DashboardHome() {
  const { user, profile } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const outlet = useOutletContext() || {}
  const dark = !!outlet.dark
  const toggleTheme = outlet.toggleTheme || (() => {})
  const t = themeTokens(dark)

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [m, setM] = useState(null)
  const [available, setAvailable] = useState(profile?.is_available ?? true)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [editing, setEditing] = useState(false)
  const [today] = useState(() => new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }))

  const muted = { fontSize: 12, color: t.textMuted, fontFamily: FONT }
  const bigNum = { fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: t.text, fontFamily: FONT }
  const emptyS = { ...muted, padding: '10px 0' }
  const linkBtn = { marginTop: 4, alignSelf: 'flex-start', background: 'none', border: 'none', color: t.green, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', padding: 0 }

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (profile && Array.isArray(profile.dashboard_layout)) {
      setLayout(mergeLayout(profile.dashboard_layout, DEFAULT_LAYOUT.map((l) => l.id)))
    }
  }, [profile])

  async function load() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const [invRes, bookRes, msgRes, threadRes, quoteRes, contractRes, reviewRes, delRes, jobRes, portRes] = await Promise.all([
      supabase.from('invoices').select('amount, status, created_at, due_date, client_name').eq('creative_id', user.id),
      supabase.from('bookings').select('booking_date, client_name, service, status, created_at').eq('creative_id', user.id),
      supabase.from('messages').select('thread_id, sender_type, read, created_at').eq('creative_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('message_threads').select('id').eq('creative_id', user.id),
      supabase.from('quotes').select('status, amount').eq('creative_id', user.id),
      supabase.from('contracts').select('status').eq('creative_id', user.id),
      supabase.from('reviews').select('rating, created_at').eq('creative_id', user.id),
      supabase.from('deliveries').select('id, is_final, created_at, client_name, title').eq('creative_id', user.id),
      supabase.from('job_listings').select('id, title, location, created_at, posted_by').eq('status', 'active').order('created_at', { ascending: false }).limit(25),
      supabase.from('portfolio_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    const invoices = invRes.data ?? []
    const bookings = bookRes.data ?? []
    const messages = msgRes.data ?? []
    const threads = threadRes.data ?? []
    const quotes = quoteRes.data ?? []
    const contracts = contractRes.data ?? []
    const reviews = reviewRes.data ?? []
    const deliveries = delRes.data ?? []
    const jobs = jobRes.data ?? []

    const paid = invoices.filter((i) => i.status === 'paid')
    const thisMonthRevenue = paid.filter((i) => i.created_at >= monthStart).reduce((s, i) => s + Number(i.amount || 0), 0)
    const outstandingTotal = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    const overdue = invoices.filter((i) => i.due_date && i.status !== 'paid' && new Date(i.due_date) < now)
    const pendingQuotes = quotes.filter((q) => ['sent', 'pending', 'awaiting_approval'].includes(String(q.status || '').toLowerCase()))
    const comingIn = pendingQuotes.reduce((s, q) => s + Number(q.amount || 0), 0)

    const upcomingList = bookings.filter((b) => b.booking_date && new Date(b.booking_date) >= now).sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date)).slice(0, 5)
    const in7 = new Date(now); in7.setDate(in7.getDate() + 7)
    const weekCount = bookings.filter((b) => b.booking_date && new Date(b.booking_date) >= now && new Date(b.booking_date) <= in7).length

    const unreadThreads = new Set(messages.filter((x) => (!x.sender_type || x.sender_type === 'client') && x.read !== true).map((x) => x.thread_id).filter(Boolean)).size
    const contractsAwaiting = contracts.filter((c) => ['sent', 'pending_signature', 'awaiting_signature'].includes(String(c.status || '').toLowerCase())).length
    const deliverablesList = deliveries.filter((d) => d.is_final !== true).slice(0, 5)

    const jobMatches = jobs.filter((j) => j.posted_by !== user.id).slice(0, 5)
    const enquiries = threads.length
    const conversion = enquiries ? Math.round((bookings.length / enquiries) * 100) : 0

    const reviewCount = reviews.length
    const reviewsAvg = reviewCount ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviewCount : 0

    setM({
      thisMonthRevenue, outstandingTotal, comingIn, overdueCount: overdue.length,
      upcomingList, weekCount, unreadThreads, contractsAwaiting, pendingQuotesCount: pendingQuotes.length,
      deliverablesList, deliverablesCount: deliveries.filter((d) => d.is_final !== true).length,
      jobMatches, enquiries, bookingsCount: bookings.length, conversion,
      reviewsAvg, reviewCount, portfolioCount: portRes.count ?? 0,
    })
  }

  useEffect(() => { if (user?.id) void load() }, [user?.id])

  async function toggleAvailable() {
    const next = !available
    setAvailable(next)
    try { await supabase.from('profiles').update({ is_available: next }).eq('id', user.id) } catch { /* ignore */ }
  }

  function reorder(from, to) { setLayout((p) => { const a = [...p]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a }) }
  function resize(id) { setLayout((p) => p.map((l) => (l.id === id ? { ...l, size: nextSize(l.size) } : l))) }
  function hide(id) { setLayout((p) => p.map((l) => (l.id === id ? { ...l, hidden: true } : l))) }
  function show(id) { setLayout((p) => p.map((l) => (l.id === id ? { ...l, hidden: false } : l))) }
  async function saveLayout() {
    setEditing(false)
    try { await supabase.from('profiles').update({ dashboard_layout: layout }).eq('id', user.id) } catch { /* ignore */ }
  }

  const firstName = String(profile?.business_name ?? user?.email ?? 'there').split(' ')[0]
  const avatarLabel = String(profile?.business_name ?? user?.email ?? 'U').charAt(0).toUpperCase()
  const tierLabel = { basic: 'Standard listing', pro: 'Enhanced listing', expert: 'Priority listing', elite: 'Featured listing' }[tier] || 'Standard listing'

  const profileCompletion = useMemo(() => {
    if (!profile) return 0
    const checks = [!!profile.avatar_url, !!String(profile.bio || '').trim(), !!String(profile.tagline || '').trim(), Array.isArray(profile.specialties) && profile.specialties.length > 0, Array.isArray(profile.skill_types) && profile.skill_types.length > 0, !!(profile.city || profile.state || profile.country || profile.location), (m?.portfolioCount || 0) > 0]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [profile, m])

  const goal = Number(profile?.income_goal || 5000)

  const REG = {
    needs_today: {
      title: 'Needs you today',
      content: (() => {
        const items = [
          m?.overdueCount ? { text: `${m.overdueCount} overdue invoice${m.overdueCount > 1 ? 's' : ''}`, sub: 'Chase payment', dot: t.danger, to: '/dashboard/finance/invoicing' } : null,
          m?.unreadThreads ? { text: `${m.unreadThreads} unread message${m.unreadThreads > 1 ? 's' : ''}`, sub: 'Reply before leads go cold', dot: '#3b82f6', to: '/dashboard/clients/messages' } : null,
          m?.deliverablesCount ? { text: `${m.deliverablesCount} to deliver`, sub: 'Clients are waiting', dot: '#a855f7', to: '/dashboard/portfolio-design/deliver' } : null,
          m?.contractsAwaiting ? { text: `${m.contractsAwaiting} contract${m.contractsAwaiting > 1 ? 's' : ''} unsigned`, sub: 'Lock in the job', dot: '#EAB308', to: '/dashboard/finance/contracts' } : null,
          m?.pendingQuotesCount ? { text: `${m.pendingQuotesCount} quote${m.pendingQuotesCount > 1 ? 's' : ''} awaiting reply`, sub: 'Follow up to win it', dot: '#f59e0b', to: '/dashboard/finance/quotes' } : null,
        ].filter(Boolean)
        if (items.length === 0) return <div style={{ ...emptyS, color: t.green }}>You&apos;re all caught up ✨</div>
        return items.map((it, i) => <JumpRow key={i} t={t} left={it.text} sub={it.sub} dot={it.dot} right="→" onClick={() => navigate(it.to)} />)
      })(),
    },
    this_week: {
      title: 'This week',
      content: (!m?.upcomingList || m.upcomingList.length === 0)
        ? <div style={emptyS}>No upcoming shoots booked.</div>
        : m.upcomingList.map((b, i) => <JumpRow key={i} t={t} left={b.client_name || 'Client'} sub={b.service || 'Booking'} right={shortDate(b.booking_date)} onClick={() => navigate('/dashboard/my-work/my-bookings')} />),
    },
    money: {
      title: 'Money',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><div style={muted}>Earned</div><div style={{ ...bigNum, color: t.green }}>{currency(m?.thisMonthRevenue ?? 0)}</div><div style={muted}>this month</div></div>
            <div><div style={muted}>Owed</div><div style={{ ...bigNum, color: m?.overdueCount ? t.danger : t.text }}>{currency(m?.outstandingTotal ?? 0)}</div><div style={muted}>{m?.overdueCount ? `${m.overdueCount} overdue` : 'to you'}</div></div>
            <div><div style={muted}>Coming</div><div style={bigNum}>{currency(m?.comingIn ?? 0)}</div><div style={muted}>in quotes</div></div>
          </div>
          <button type="button" onClick={() => navigate('/dashboard/finance/invoicing')} style={linkBtn}>Open invoicing →</button>
        </div>
      ),
    },
    board: { title: 'Work board', content: <DashboardTasks userId={user?.id} avatarLabel={avatarLabel} hideHeading t={t} /> },
    job_matches: {
      title: 'New jobs for you',
      content: (!m?.jobMatches || m.jobMatches.length === 0)
        ? <div style={emptyS}>No new jobs right now — check back soon.</div>
        : m.jobMatches.map((j) => <JumpRow key={j.id} t={t} left={j.title} sub={j.location || 'Australia'} right={timeAgo(j.created_at)} onClick={() => navigate('/dashboard/my-work/jobs')} />),
    },
    visibility: {
      title: 'Visibility',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <JumpRow t={t} left="Search ranking" right={tierLabel} />
          <JumpRow t={t} left="Profile views this week" right="Coming soon" />
          <JumpRow t={t} left="Profile completeness" right={`${profileCompletion}%`} onClick={() => navigate('/dashboard/profile/edit-profile')} />
          {profileCompletion < 100 ? <button type="button" onClick={() => navigate('/dashboard/profile/edit-profile')} style={linkBtn}>Finish profile →</button> : null}
        </div>
      ),
    },
    deliverables: {
      title: 'Deliverables',
      content: (!m?.deliverablesList || m.deliverablesList.length === 0)
        ? <div style={emptyS}>Nothing to send. Nice.</div>
        : m.deliverablesList.map((d) => <JumpRow key={d.id} t={t} left={d.title || 'Gallery'} sub={d.client_name || 'Client'} right="send" dot="#a855f7" onClick={() => navigate('/dashboard/portfolio-design/deliver')} />),
    },
    reviews: {
      title: 'Reviews',
      content: m?.reviewCount
        ? <div><div style={{ ...bigNum, fontSize: 30, color: t.dark ? '#ffd54a' : t.text }}>★ {m.reviewsAvg.toFixed(1)}</div><div style={muted}>{m.reviewCount} review{m.reviewCount > 1 ? 's' : ''}</div><button type="button" onClick={() => navigate('/dashboard/business/reviews')} style={linkBtn}>View reviews →</button></div>
        : <div style={emptyS}>No reviews yet — they&apos;ll appear here.</div>,
    },
    leads: {
      title: 'Leads',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <JumpRow t={t} left="Enquiries" right={String(m?.enquiries ?? 0)} onClick={() => navigate('/dashboard/clients/messages')} />
          <JumpRow t={t} left="Booked" right={String(m?.bookingsCount ?? 0)} onClick={() => navigate('/dashboard/my-work/my-bookings')} />
          <JumpRow t={t} left="Conversion" right={`${m?.conversion ?? 0}%`} />
        </div>
      ),
    },
    goal: {
      title: 'Monthly goal',
      content: (() => {
        const pct = Math.min(100, Math.round(((m?.thisMonthRevenue ?? 0) / goal) * 100))
        return (
          <div>
            <div style={{ ...bigNum, fontSize: 26 }}>{pct}%</div>
            <div style={muted}>{currency(m?.thisMonthRevenue ?? 0)} of {currency(goal)}</div>
            <div style={{ height: 8, borderRadius: 999, background: t.dark ? 'rgba(120,190,255,0.14)' : 'rgba(20,17,26,0.08)', marginTop: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${t.accent}, ${t.green})`, borderRadius: 999, boxShadow: t.dark ? `0 0 12px ${t.accent}` : 'none' }} />
            </div>
          </div>
        )
      })(),
    },
    lumi: {
      title: 'Lumi AI',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: t.textSecondary, fontFamily: FONT }}>Ask Lumi to draft a quote, reply to a client, or price a job.</div>
          <button type="button" onClick={() => navigate('/dashboard/lumi')} style={{ alignSelf: 'flex-start', background: t.dark ? t.accent : '#14111a', color: t.dark ? '#04121f' : '#fff', border: 'none', padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, boxShadow: t.dark ? `0 0 16px -2px ${t.accent}` : 'none' }}>Ask Lumi ✦</button>
        </div>
      ),
    },
    quick_actions: {
      title: 'Quick actions',
      content: (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['New invoice', '/dashboard/finance/invoicing'], ['New quote', '/dashboard/finance/quotes'], ['Send delivery', '/dashboard/portfolio-design/deliver'], ['Add client', '/dashboard/clients/crm'], ['New booking', '/dashboard/my-work/my-bookings']].map(([l, to]) => (
            <button key={l} type="button" onClick={() => navigate(to)} style={{ padding: '8px 14px', borderRadius: 999, border: t.pillBorder, background: t.pillBg, color: t.pillText, fontSize: 13, fontFamily: FONT, cursor: 'pointer', whiteSpace: 'nowrap' }}>{l}</button>
          ))}
        </div>
      ),
    },
  }

  const items = layout.filter((l) => !l.hidden && REG[l.id]).map((l) => ({ id: l.id, size: l.size, title: REG[l.id].title, content: REG[l.id].content }))
  const hiddenItems = layout.filter((l) => l.hidden && REG[l.id])

  const roundBtn = { padding: '9px 14px', borderRadius: 999, border: t.pillBorder, background: t.pillBg, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8 }

  return (
    <div style={{ position: 'relative', padding: isMobile ? '20px 16px' : '32px 40px', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', fontFamily: FONT }}>
      <LiquidLensFilter />
      <ScatteredSquares dark={dark} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 26 : 30, fontWeight: 600, color: t.text, margin: 0, lineHeight: 1.15 }}>Welcome back, {firstName}</div>
            <div style={{ ...muted, fontSize: 14, marginTop: 4 }}>{today}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {!editing ? (
              <>
                <WorkspaceSearch userId={user?.id} navigate={navigate} isMobile={isMobile} t={t} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: available ? t.green : t.textMuted, fontFamily: FONT, whiteSpace: 'nowrap' }}>{available ? 'Available' : 'Away'}</span>
                  <button type="button" onClick={toggleAvailable} aria-label="Toggle availability" style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: available ? t.accent : (t.dark ? 'rgba(120,190,255,0.18)' : 'rgba(20,17,26,0.16)'), position: 'relative', transition: 'background 0.2s ease', flexShrink: 0, padding: 0, boxShadow: available && t.dark ? `0 0 12px -2px ${t.accent}` : 'none' }}>
                    <span style={{ position: 'absolute', top: 3, left: available ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s ease' }} />
                  </button>
                </div>
                <button type="button" onClick={toggleTheme} aria-label="Toggle theme" title={dark ? 'Light mode' : 'Dark mode'} style={{ ...roundBtn, padding: '9px 12px' }}>{dark ? '☀' : '☾'}</button>
              </>
            ) : null}
            <button type="button" onClick={() => (editing ? saveLayout() : setEditing(true))} style={{ ...roundBtn, border: editing ? 'none' : t.pillBorder, background: editing ? (t.dark ? t.accent : '#14111a') : t.pillBg, color: editing ? (t.dark ? '#04121f' : '#fff') : t.text }}>
              {editing ? 'Done' : 'Edit dashboard'}
            </button>
          </div>
        </div>

        {editing ? <div style={{ fontSize: 12, color: t.textMuted, fontFamily: FONT }}>Drag widgets to reorder · ⤢ resize · – hide. Tap Done to save.</div> : null}

        <WidgetGrid items={items} editing={editing} onReorder={reorder} onResize={resize} onHide={hide} t={t} />

        {editing && hiddenItems.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingTop: 6 }}>
            <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>Hidden:</span>
            {hiddenItems.map((l) => (
              <button key={l.id} type="button" onClick={() => show(l.id)} style={{ padding: '7px 14px', borderRadius: 999, border: `1px dashed ${t.dark ? 'rgba(120,190,255,0.35)' : 'rgba(20,17,26,0.25)'}`, background: t.pillBg, color: t.textSecondary, fontSize: 12, fontFamily: FONT, cursor: 'pointer' }}>
                + {REG[l.id]?.title || l.id}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
