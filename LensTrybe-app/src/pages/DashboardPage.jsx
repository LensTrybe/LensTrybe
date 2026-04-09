import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { supabase } from '../lib/supabaseClient.js'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '#1e1e1e',
  green: '#39ff14',
  purple: '#a78bfa',
  pink: '#e879f9',
  grey: '#888',
  muted: '#666',
}

const font = { fontFamily: 'Inter, sans-serif' }

const formatAUD = (n, { decimals = 2 } = {}) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n || 0))

function tierBenefits(tier) {
  const t = String(tier || 'elite').toLowerCase()
  if (t === 'pro') {
    return [
      'All Expert features',
      'Portfolio website',
      'Priority email support',
      'Quotes & invoicing',
    ]
  }
  return [
    'All Expert features',
    'Multi-page portfolio website',
    'Team management',
    'Business insights',
    'Review request system',
    'Priority support',
  ]
}

function tierLabel(tier) {
  const t = String(tier || 'elite').toLowerCase()
  if (t === 'pro') return 'Pro'
  if (t === 'vip') return 'VIP'
  return 'Elite Tier'
}

function planDisplayName(tier) {
  const t = String(tier || 'elite').toLowerCase()
  if (t === 'pro') return 'Pro'
  if (t === 'vip') return 'VIP'
  return 'Elite'
}

function IconBox({ borderColor, children }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#0f0f14',
        border: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-hidden
    >
      {children}
    </div>
  )
}

function IconCalendar({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x={3} y={5} width={18} height={16} rx={2} stroke={color} strokeWidth={1.5} />
      <path d="M3 9h18" stroke={color} strokeWidth={1.5} />
      <path d="M8 3v4M16 3v4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function IconClock({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <path d="M12 7v5l3 2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconEye({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={12} cy={12} r={2.5} stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

function IconStar({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 14.2 9l5.8.4-4.5 3.8 1.4 5.7L12 16.9 6.1 18.9l1.4-5.7L3 9.4l5.8-.4L12 3.5Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconDollar({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <path
        d="M12 6v12M9.5 9.5c0-1 1-2 2.5-2s2.5 1 2.5 2-1 2-2.5 2-2.5 1-2.5 2 1 2 2.5 2 2.5-1 2.5-2"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTrend({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 16l5-5 4 4 6-6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 9h6v6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconTarget({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <circle cx={12} cy={12} r={5} stroke={color} strokeWidth={1.5} />
      <circle cx={12} cy={12} r={1.5} fill={color} />
    </svg>
  )
}

function IconPerson({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={1.5} />
      <path
        d="M5 20c1.5-4 4.5-6 7-6s5.5 2 7 6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconDollarSquare({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x={3} y={3} width={18} height={18} rx={3} stroke={color} strokeWidth={1.5} />
      <path
        d="M12 7v10M9.5 10c0-.8.7-1.5 2-1.5s2 .7 2 1.5-.7 1.5-2 1.5-2 .8-2 1.5.7 1.5 2 1.5 2-.7 2-1.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSearch({ color }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={1.5} />
      <path d="M16 16l4 4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function IconBolt() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
        fill={PAGE.green}
        stroke={PAGE.green}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconList() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden style={{ marginRight: 6 }}>
      <path d="M8 6h13M8 12h13M8 18h13" stroke={PAGE.text} strokeWidth={1.5} strokeLinecap="round" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" stroke={PAGE.green} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx={12} cy={12} r={9} stroke="#ca8a04" strokeWidth={1.5} />
      <path d="M12 10v6M12 8h.01" stroke="#ca8a04" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  /* eslint-disable no-unused-vars -- recent lists still loaded for parity with original dashboard fetches */
  const [recentBookings, setRecentBookings] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  /* eslint-enable no-unused-vars */
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (!user) return
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchStats() {
    setLoading(true)
    const [
      bookings,
      invoices,
      quotes,
      contracts,
      contacts,
      messages,
      portfolio,
      deliveries,
      profileRes,
      reviewsRes,
    ] = await Promise.all([
      supabase.from('bookings').select('id, status, created_at').eq('creative_id', user.id),
      supabase.from('invoices').select('id, amount, status, created_at').eq('creative_id', user.id),
      supabase.from('quotes').select('id, status, service, title, description, created_at').eq('creative_id', user.id),
      supabase.from('contracts').select('id, status').eq('creative_id', user.id),
      supabase.from('crm_contacts').select('id').eq('creative_id', user.id),
      supabase.from('message_threads').select('id, unread_count, created_at').eq('creative_id', user.id),
      supabase.from('portfolio_items').select('id').eq('creative_id', user.id),
      supabase.from('deliveries').select('id').eq('creative_id', user.id),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('reviews').select('rating, created_at').eq('creative_id', user.id),
    ])

    const invData = invoices.data || []
    const bookingsData = bookings.data || []
    const quotesData = quotes.data || []
    const threadsData = messages.data || []
    const revs = reviewsRes.data || []
    const profile = profileRes.data || null

    const totalRevenue = invData.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    const pendingRevenue = invData.filter((i) => i.status === 'sent').reduce((s, i) => s + Number(i.amount || 0), 0)
    const unread = threadsData.reduce((s, t) => s + (t.unread_count || 0), 0)

    const now = new Date()
    const thisMonthIdx = now.getMonth()
    const thisYearNum = now.getFullYear()

    const prevMonthRef = new Date(now)
    prevMonthRef.setMonth(prevMonthRef.getMonth() - 1)
    const prevMonthIdx = prevMonthRef.getMonth()
    const prevYearNum = prevMonthRef.getFullYear()

    const enquiriesLastMonth = threadsData.filter((t) => {
      const d = new Date(t.created_at)
      return d.getMonth() === prevMonthIdx && d.getFullYear() === prevYearNum
    }).length

    const thisMonthRevenue = invData
      .filter((i) => {
        const d = new Date(i.created_at)
        return d.getMonth() === thisMonthIdx && d.getFullYear() === thisYearNum && i.status === 'paid'
      })
      .reduce((s, i) => s + Number(i.amount || 0), 0)

    const ytdRevenue = invData
      .filter((i) => {
        const d = new Date(i.created_at)
        return d.getFullYear() === thisYearNum && i.status === 'paid'
      })
      .reduce((s, i) => s + Number(i.amount || 0), 0)

    const enquiriesThisMonth = threadsData.filter((t) => {
      const d = new Date(t.created_at)
      return d.getMonth() === thisMonthIdx && d.getFullYear() === thisYearNum
    }).length

    const conversionRate = quotesData.length
      ? ((quotesData.filter((q) => q.status === 'accepted' || q.status === 'converted').length / quotesData.length) * 100).toFixed(0)
      : '0'

    const serviceCounts = {}
    quotesData.forEach((q) => {
      const s = (q.service || q.title || q.description || '').toString().trim() || 'General'
      serviceCounts[s] = (serviceCounts[s] || 0) + 1
    })
    const topEntry = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]
    const mostEnquired = topEntry && topEntry[1] > 0 ? topEntry[0] : null

    const byClient = {}
    bookingsData.forEach((b) => {
      const c = b.client_name || b.client_email || b.client_id
      if (!c) return
      byClient[String(c)] = (byClient[String(c)] || 0) + 1
    })
    const clientKeys = Object.keys(byClient)
    const returningClients = clientKeys.filter((k) => byClient[k] > 1).length
    const clientReturnRate = clientKeys.length > 0 ? ((returningClients / clientKeys.length) * 100).toFixed(0) : '0'

    const bookingsTrend = []
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString([], { month: 'short' })
      const year = d.getFullYear()
      const month = d.getMonth()
      const count = bookingsData.filter((b) => {
        const d2 = new Date(b.created_at)
        return d2.getMonth() === month && d2.getFullYear() === year
      }).length
      bookingsTrend.push({ label, count })
    }

    const profileViewsThisMonth = Number(profile?.profile_views ?? profile?.profile_view_count ?? 0)
    const profileViewsLastMonth = Number(profile?.profile_views_last_month ?? profile?.profile_views_prev_month ?? 0)

    const searchAppearances = Number(profile?.search_appearances ?? profile?.search_impressions ?? 0)

    const avgFromReviews = revs.length
      ? (revs.reduce((s, r) => s + (Number(r.rating) || 0), 0) / revs.length).toFixed(1)
      : null
    const avgRating =
      profile?.average_rating != null && profile.average_rating !== ''
        ? Number(profile.average_rating).toFixed(1)
        : profile?.avg_rating != null && profile.avg_rating !== ''
          ? Number(profile.avg_rating).toFixed(1)
          : avgFromReviews ?? '0.0'

    const paidInvoices = invData.filter((i) => i.status === 'paid')
    const avgInvoice = paidInvoices.length
      ? paidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0) / paidInvoices.length
      : 0

    setStats({
      totalRevenue,
      pendingRevenue,
      totalBookings: bookingsData.length,
      upcomingBookings: bookingsData.filter((b) => b.status === 'confirmed').length,
      totalInvoices: invData.length,
      unpaidInvoices: invData.filter((i) => i.status === 'sent').length,
      totalQuotes: quotesData.length,
      totalContracts: (contracts.data || []).length,
      signedContracts: (contracts.data || []).filter((c) => c.status === 'signed').length,
      totalContacts: (contacts.data || []).length,
      unreadMessages: unread,
      totalThreads: threadsData.length,
      portfolioItems: (portfolio.data || []).length,
      deliveries: (deliveries.data || []).length,
      thisMonthRevenue,
      ytdRevenue,
      enquiriesThisMonth,
      enquiriesLastMonth,
      conversionRate,
      mostEnquired,
      clientReturnRate,
      bookingsTrend,
      profileViewsThisMonth,
      profileViewsLastMonth,
      searchAppearances,
      avgRating,
      totalReviews: revs.length,
      profile,
      subscriptionTier: profile?.subscription_tier,
      subscriptionStatus: profile?.subscription_status ?? 'active',
      nextBillingDate:
        profile?.next_billing_date ||
        profile?.subscription_current_period_end ||
        profile?.billing_next_date ||
        null,
      avgInvoice,
    })

    const { data: rb } = await supabase
      .from('bookings')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4)
    setRecentBookings(rb || [])

    const { data: ri } = await supabase
      .from('invoices')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4)
    setRecentInvoices(ri || [])

    setLoading(false)
  }

  const shellStyle = {
    background: PAGE.bg,
    color: PAGE.text,
    width: '100%',
    maxWidth: '100%',
    padding: '24px 28px 40px',
    boxSizing: 'border-box',
    minHeight: '100%',
    ...font,
  }

  const cardBase = {
    background: PAGE.card,
    border: `1px solid ${PAGE.border}`,
    borderRadius: 10,
    padding: 20,
    boxSizing: 'border-box',
    position: 'relative',
    ...font,
  }

  const grid4 = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }
  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }

  const isFoundingMember = Boolean(
    user?.user_metadata?.founding_member ??
      user?.user_metadata?.is_founding_member ??
      stats?.profile?.founding_member,
  )

  const pvDelta =
    stats != null ? stats.profileViewsThisMonth - stats.profileViewsLastMonth : 0
  const pvSubColor = pvDelta > 0 ? PAGE.green : pvDelta < 0 ? '#f87171' : PAGE.muted

  const enqDelta =
    stats != null ? stats.enquiriesThisMonth - stats.enquiriesLastMonth : 0
  const enqSubColor = enqDelta > 0 ? PAGE.green : enqDelta < 0 ? '#f87171' : PAGE.muted

  const nextBillingPretty =
    stats?.nextBillingDate != null && stats.nextBillingDate !== ''
      ? new Date(stats.nextBillingDate).toLocaleDateString('en-AU', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '—'

  const statusActive =
    String(stats?.subscriptionStatus || 'active').toLowerCase() === 'active'

  const handleManageBilling = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-portal')
      if (error) throw error
      const url = data?.url
      if (url) window.location.href = url
    } catch (e) {
      const msg = e?.message || 'Could not open billing portal.'
      alert(msg)
    }
  }

  const handleCancelSubscription = async () => {
    const ok = window.confirm('Cancel your subscription? You will keep access until the end of your current billing period.')
    if (!ok) return
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription')
      if (error) throw error
      await fetchStats()
      alert('Subscription cancelled.')
    } catch (e) {
      const msg = e?.message || 'Could not cancel subscription.'
      alert(msg)
    }
  }

  const chartYMax =
    stats?.bookingsTrend?.length > 0
      ? Math.max(4, ...stats.bookingsTrend.map((d) => d.count))
      : 4

  if (loading || !stats) {
    return (
      <section style={shellStyle}>
        <div style={{ color: PAGE.muted, fontSize: 14, padding: '48px 0', textAlign: 'center' }}>
          {loading ? 'Loading insights…' : 'No data.'}
        </div>
      </section>
    )
  }

  return (
    <section style={shellStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 22,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent',
              border: 'none',
              color: PAGE.grey,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              ...font,
            }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Insights
          </h1>
        </div>
        <Link
          to="/dashboard/profile/edit-profile"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: PAGE.grey,
            textDecoration: 'none',
            ...font,
          }}
        >
          View Profile
        </Link>
      </div>

      <div style={grid4}>
        <div style={cardBase}>
          <div style={{ marginBottom: 12 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconCalendar color={PAGE.green} />
            </IconBox>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{stats.totalBookings}</div>
          <div style={{ color: PAGE.grey, fontSize: 12, fontWeight: 500, marginTop: 8 }}>Total Bookings</div>
          <div style={{ color: PAGE.muted, fontSize: 12, marginTop: 6 }}>{stats.totalBookings} total bookings</div>
        </div>
        <div style={cardBase}>
          <div style={{ marginBottom: 12 }}>
            <IconBox borderColor={`${PAGE.purple}66`}>
              <IconClock color={PAGE.purple} />
            </IconBox>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{stats.totalThreads}</div>
          <div style={{ color: PAGE.grey, fontSize: 12, fontWeight: 500, marginTop: 8 }}>Active Enquiries</div>
          <div style={{ color: enqSubColor, fontSize: 12, marginTop: 6 }}>
            vs {stats.enquiriesLastMonth} last month
            {enqDelta > 0 ? ' ↑' : enqDelta < 0 ? ' ↓' : ''}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ marginBottom: 12 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconEye color={PAGE.green} />
            </IconBox>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
            {stats.profileViewsThisMonth}
          </div>
          <div style={{ color: PAGE.grey, fontSize: 12, fontWeight: 500, marginTop: 8 }}>Profile Views</div>
          <div style={{ color: pvSubColor, fontSize: 12, marginTop: 6 }}>
            vs {stats.profileViewsLastMonth} last month
            {pvDelta > 0 ? ' ↑' : pvDelta < 0 ? ' ↓' : ''}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ marginBottom: 12 }}>
            <IconBox borderColor={`${PAGE.pink}55`}>
              <IconStar color={PAGE.pink} />
            </IconBox>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{stats.avgRating}</div>
          <div style={{ color: PAGE.grey, fontSize: 12, fontWeight: 500, marginTop: 8 }}>Platform Reviews</div>
          <div style={{ color: PAGE.muted, fontSize: 12, marginTop: 6 }}>
            {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
          </div>
        </div>
      </div>

      {isFoundingMember ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 16,
            marginBottom: 4,
            padding: '7px 16px',
            borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.28)',
            background: 'transparent',
            ...font,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: PAGE.green,
              boxShadow: `0 0 8px ${PAGE.green}`,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: PAGE.text,
            }}
          >
            FOUNDING MEMBER
          </span>
        </div>
      ) : (
        <div style={{ height: 12 }} />
      )}

      <div style={{ ...grid4, marginTop: isFoundingMember ? 12 : 16 }}>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconDollar color={PAGE.green} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            THIS MONTH REVENUE
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: PAGE.green, lineHeight: 1.15, paddingRight: 48 }}>
            {formatAUD(stats.thisMonthRevenue)}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.purple}66`}>
              <IconTrend color={PAGE.purple} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            YTD REVENUE
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {formatAUD(stats.ytdRevenue)}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconTarget color={PAGE.green} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            ENQUIRIES THIS MONTH
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {stats.enquiriesThisMonth}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.purple}66`}>
              <IconTrend color={PAGE.purple} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            CONVERSION RATE
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {stats.conversionRate}%
          </div>
        </div>
      </div>

      <div style={{ ...grid3, marginTop: 16 }}>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconPerson color={PAGE.green} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            MOST ENQUIRED
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2,
              paddingRight: 48,
              wordBreak: 'break-word',
            }}
          >
            {stats.mostEnquired || 'N/A'}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.purple}66`}>
              <IconDollarSquare color={PAGE.purple} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            AVERAGE PROJECT VALUE
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {formatAUD(stats.avgInvoice, { decimals: 0 })}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconPerson color={PAGE.green} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            CLIENT RETURN RATE
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {stats.clientReturnRate}%
          </div>
        </div>
      </div>

      <div style={{ ...grid3, marginTop: 16 }}>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconEye color={PAGE.green} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            PROFILE VIEWS THIS MONTH
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {stats.profileViewsThisMonth}
          </div>
          <div style={{ color: pvSubColor, fontSize: 12, marginTop: 8, paddingRight: 48 }}>
            vs {stats.profileViewsLastMonth} last month
            {pvDelta > 0 ? ' ↑' : pvDelta < 0 ? ' ↓' : ''}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.purple}66`}>
              <IconSearch color={PAGE.purple} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            SEARCH APPEARANCES
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {stats.searchAppearances}
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ position: 'absolute', top: 18, right: 18 }}>
            <IconBox borderColor={`${PAGE.green}55`}>
              <IconPerson color={PAGE.green} />
            </IconBox>
          </div>
          <div
            style={{
              color: PAGE.grey,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 10,
              paddingRight: 48,
            }}
          >
            TOTAL CLIENTS
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.15, paddingRight: 48 }}>
            {stats.totalContacts}
          </div>
          <div style={{ color: PAGE.muted, fontSize: 12, marginTop: 8, paddingRight: 48 }}>
            {stats.totalBookings} total bookings
          </div>
        </div>
      </div>

      <div style={{ ...cardBase, padding: 22, marginTop: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
          Bookings Trend (Last 6 Months)
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.bookingsTrend} margin={{ top: 6, right: 10, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={PAGE.border} strokeDasharray="0" vertical horizontal />
              <XAxis
                dataKey="label"
                tick={{ fill: PAGE.grey, fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                axisLine={{ stroke: PAGE.border }}
                tickLine={{ stroke: PAGE.border }}
              />
              <YAxis
                domain={[0, chartYMax]}
                allowDecimals={false}
                tick={{ fill: PAGE.grey, fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                axisLine={{ stroke: PAGE.border }}
                tickLine={{ stroke: PAGE.border }}
              />
              <Tooltip
                contentStyle={{
                  background: PAGE.card,
                  border: `1px solid ${PAGE.border}`,
                  borderRadius: 8,
                  color: PAGE.text,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                }}
                labelStyle={{ color: PAGE.grey }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={PAGE.green}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: PAGE.green, stroke: PAGE.card, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          borderRadius: 10,
          border: `1px solid rgba(57, 255, 20, 0.35)`,
          overflow: 'hidden',
          background: PAGE.card,
          boxSizing: 'border-box',
          ...font,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 20px',
            background: 'rgba(57, 255, 20, 0.06)',
            borderBottom: `1px solid ${PAGE.border}`,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBolt />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Subscription &amp; Billing</span>
          </div>
          <div
            style={{
              background: PAGE.green,
              color: '#0a0a0f',
              borderRadius: 20,
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {tierLabel(stats.subscriptionTier)}
          </div>
        </div>

        <div style={{ padding: '22px 22px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Subscription Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { k: 'Current Plan', v: planDisplayName(stats.subscriptionTier) },
              {
                k: 'Status',
                v: statusActive ? 'Active' : String(stats.subscriptionStatus || '—'),
                vColor: statusActive ? PAGE.green : PAGE.text,
              },
              { k: 'Next Billing Date', v: nextBillingPretty },
            ].map((row) => (
              <div
                key={row.k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 14,
                }}
              >
                <span style={{ color: PAGE.grey }}>{row.k}</span>
                <span style={{ color: row.vColor || '#fff', fontWeight: 700 }}>{row.v}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: PAGE.border, margin: '20px 0' }} />

          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <IconList />
            Current Benefits
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {tierBenefits(stats.subscriptionTier).map((line) => (
              <li
                key={line}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  color: PAGE.text,
                  marginBottom: 10,
                  lineHeight: 1.45,
                }}
              >
                <span style={{ color: PAGE.green, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div
            style={{
              background: '#2a2410',
              border: '1px solid rgba(202, 138, 4, 0.55)',
              borderRadius: 8,
              padding: 14,
              marginTop: 18,
              marginBottom: 18,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <IconInfo />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fcd34d', marginBottom: 6 }}>Cancel Anytime</div>
              <div style={{ fontSize: 12, color: '#d4a574', lineHeight: 1.55 }}>
                You can cancel your subscription at any time. Your access continues until the end of the current billing
                period. Australian Consumer Law may apply to your subscription; nothing in these terms limits any
                non-excludable rights you have under the ACL.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCancelSubscription}
              style={{
                flex: '1 1 200px',
                background: '#ff4d4d',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '14px 16px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                ...font,
              }}
            >
              Cancel Subscription
            </button>
            <button
              type="button"
              onClick={handleManageBilling}
              style={{
                flex: '1 1 200px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: '#0f0f14',
                border: `1px solid ${PAGE.green}`,
                color: PAGE.green,
                borderRadius: 8,
                padding: '14px 16px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                ...font,
              }}
            >
              Manage Billing
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
