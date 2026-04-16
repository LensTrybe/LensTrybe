import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Badge from '../../components/ui/Badge'

function StatCard({ label, value, sub, accent, prefix, suffix }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: accent ?? 'var(--text-primary)', lineHeight: 1 }}>
        {prefix}{value}{suffix}
      </div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data, label }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>{d.value}</div>
            <div style={{
              width: '100%',
              height: `${Math.max(4, (d.value / max) * 100)}%`,
              background: 'var(--green)',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              opacity: 0.8,
              transition: 'height var(--transition-slow)',
            }} />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function InsightsPage() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    revenueThisMonth: 0,
    totalEnquiries: 0,
    enquiriesThisMonth: 0,
    totalBookings: 0,
    avgProjectValue: 0,
    totalReviews: 0,
    avgRating: 0,
    conversionRate: 0,
    monthlyRevenue: [],
    monthlyEnquiries: [],
  })

  useEffect(() => { loadStats() }, [user])

  async function loadStats() {
    if (!user) return
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [invoices, threads, bookings, reviews] = await Promise.all([
      supabase.from('invoices').select('amount, status, created_at').eq('creative_id', user.id),
      supabase.from('message_threads').select('created_at').eq('creative_id', user.id),
      supabase.from('bookings').select('id').eq('creative_id', user.id),
      supabase.from('reviews').select('rating').eq('creative_id', user.id),
    ])

    const allInvoices = invoices.data ?? []
    const paidInvoices = allInvoices.filter(i => i.status === 'paid')
    const totalRevenue = paidInvoices.reduce((s, i) => s + (i.amount ?? 0), 0)
    const revenueThisMonth = paidInvoices
      .filter(i => i.created_at >= monthStart)
      .reduce((s, i) => s + (i.amount ?? 0), 0)

    const allThreads = threads.data ?? []
    const enquiriesThisMonth = allThreads.filter(t => t.created_at >= monthStart).length

    const allReviews = reviews.data ?? []
    const avgRating = allReviews.length > 0
      ? (allReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / allReviews.length).toFixed(1)
      : 0

    const avgProjectValue = paidInvoices.length > 0
      ? (totalRevenue / paidInvoices.length).toFixed(0)
      : 0

    const conversionRate = allThreads.length > 0
      ? ((bookings.data?.length ?? 0) / allThreads.length * 100).toFixed(0)
      : 0

    const monthlyRevenue = MONTHS.map((label, i) => {
      const value = paidInvoices
        .filter(inv => new Date(inv.created_at).getMonth() === i && new Date(inv.created_at).getFullYear() === now.getFullYear())
        .reduce((s, inv) => s + (inv.amount ?? 0), 0)
      return { label, value: Math.round(value) }
    })

    const monthlyEnquiries = MONTHS.map((label, i) => {
      const value = allThreads.filter(t => new Date(t.created_at).getMonth() === i && new Date(t.created_at).getFullYear() === now.getFullYear()).length
      return { label, value }
    })

    setStats({
      totalRevenue,
      revenueThisMonth,
      totalEnquiries: allThreads.length,
      enquiriesThisMonth,
      totalBookings: bookings.data?.length ?? 0,
      avgProjectValue,
      totalReviews: allReviews.length,
      avgRating,
      conversionRate,
      monthlyRevenue,
      monthlyEnquiries,
    })
    setLoading(false)
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
    chartGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    chartCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: '4px' },
    sectionSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: '24px' },
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading insights…</div>

  return (
    <div style={styles.page}>
      <div>
        <h1 style={styles.title}>Insights</h1>
        <p style={styles.subtitle}>Your business performance at a glance.</p>
      </div>

      <div>
        <div style={styles.sectionTitle}>Revenue</div>
        <div style={styles.sectionSub}>Based on invoices marked as paid.</div>
        <div style={styles.statsGrid}>
          <StatCard label="Total Revenue" value={stats.totalRevenue.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} prefix="$" accent="var(--green)" sub="All time paid invoices" />
          <StatCard label="This Month" value={stats.revenueThisMonth.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} prefix="$" sub="Revenue this calendar month" />
          <StatCard label="Avg Project Value" value={`$${Number(stats.avgProjectValue).toLocaleString()}`} sub="Per paid invoice" />
          <StatCard label="Total Bookings" value={stats.totalBookings} sub="All time" />
        </div>
      </div>

      <div>
        <div style={styles.sectionTitle}>Enquiries</div>
        <div style={styles.sectionSub}>Message threads from clients.</div>
        <div style={styles.statsGrid}>
          <StatCard label="Total Enquiries" value={stats.totalEnquiries} sub="All time" />
          <StatCard label="This Month" value={stats.enquiriesThisMonth} sub="New enquiries this month" />
          <StatCard label="Conversion Rate" value={stats.conversionRate} suffix="%" sub="Enquiries that became bookings" accent={stats.conversionRate > 20 ? 'var(--green)' : 'var(--text-primary)'} />
          <StatCard label="Reviews" value={stats.totalReviews} sub={stats.avgRating > 0 ? `Avg rating: ${stats.avgRating} ★` : 'No reviews yet'} accent={stats.avgRating >= 4.5 ? 'var(--green)' : 'var(--text-primary)'} />
        </div>
      </div>

      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <BarChart data={stats.monthlyRevenue} label={`Revenue by month — ${new Date().getFullYear()}`} />
        </div>
        <div style={styles.chartCard}>
          <BarChart data={stats.monthlyEnquiries} label={`Enquiries by month — ${new Date().getFullYear()}`} />
        </div>
      </div>
    </div>
  )
}
