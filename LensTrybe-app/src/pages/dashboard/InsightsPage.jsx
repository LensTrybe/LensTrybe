import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

function StatCard({ label, value, sub, icon, accent = '#1DB954' }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
      borderRadius: '12px', padding: '24px 28px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</span>
        {sub && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
      <div style={{ fontSize: '28px', opacity: 0.25 }}>{icon}</div>
    </div>
  )
}

export default function InsightsPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadStats() }, [user])

  async function loadStats() {
    setLoading(true)
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

    const [
      { data: invoices },
      { data: threads },
      { data: bookings },
      { data: reviews },
    ] = await Promise.all([
      supabase.from('invoices').select('amount, status, created_at').eq('creative_id', user.id),
      supabase.from('message_threads').select('id, created_at').eq('creative_id', user.id),
      supabase.from('bookings').select('id, created_at, status').eq('creative_id', user.id),
      supabase.from('reviews').select('rating').eq('creative_id', user.id),
    ])

    const paid = (invoices ?? []).filter(i => i.status === 'paid')
    const thisMonthRevenue = paid.filter(i => i.created_at >= thisMonthStart).reduce((s, i) => s + Number(i.amount ?? 0), 0)
    const ytdRevenue = paid.filter(i => i.created_at >= new Date(now.getFullYear(), 0, 1).toISOString()).reduce((s, i) => s + Number(i.amount ?? 0), 0)
    const totalRevenue = paid.reduce((s, i) => s + Number(i.amount ?? 0), 0)
    const thisMonthEnquiries = (threads ?? []).filter(t => t.created_at >= thisMonthStart).length
    const lastMonthEnquiries = (threads ?? []).filter(t => t.created_at >= lastMonthStart && t.created_at < thisMonthStart).length
    const activeEnquiries = (threads ?? []).length
    const confirmedBookings = (bookings ?? []).filter(b => b.status === 'confirmed').length
    const totalBookings = (bookings ?? []).length
    const conversionRate = activeEnquiries > 0 ? Math.round((confirmedBookings / activeEnquiries) * 100) : 0
    const avgRating = reviews?.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'
    const avgProjectValue = confirmedBookings > 0 ? (totalRevenue / confirmedBookings).toFixed(2) : '0.00'

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { label: d.toLocaleString('default', { month: 'short' }), month: d.getMonth(), year: d.getFullYear() }
    })

    const chartData = months.map(m => ({
      name: m.label,
      Bookings: (bookings ?? []).filter(b => { const d = new Date(b.created_at); return d.getMonth() === m.month && d.getFullYear() === m.year }).length,
      Enquiries: (threads ?? []).filter(t => { const d = new Date(t.created_at); return d.getMonth() === m.month && d.getFullYear() === m.year }).length,
    }))

    setStats({ thisMonthRevenue, ytdRevenue, thisMonthEnquiries, lastMonthEnquiries, activeEnquiries, confirmedBookings, totalBookings, conversionRate, avgRating, avgProjectValue, totalReviews: reviews?.length ?? 0, chartData })
    setLoading(false)
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading insights…</div>

  const s = stats

  return (
    <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 400 }}>Insights</div>

      {/* Row 1 — 4 top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label="Total Bookings" value={s.totalBookings} icon="📅" />
        <StatCard label="Active Enquiries" value={s.activeEnquiries} icon="💬" />
        <StatCard label="Profile Views" value="0" icon="👁" />
        <StatCard label="Platform Reviews" value={s.totalReviews} icon="⭐" />
      </div>

      {/* Row 2 — Revenue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label="This Month Revenue" value={`AUD ${s.thisMonthRevenue.toFixed(2)}`} icon="💰" />
        <StatCard label="YTD Revenue" value={`AUD ${s.ytdRevenue.toFixed(2)}`} icon="📈" />
        <StatCard label="Enquiries This Month" value={s.thisMonthEnquiries} sub={`vs ${s.lastMonthEnquiries} last month`} icon="📥" />
        <StatCard label="Conversion Rate" value={`${s.conversionRate}%`} icon="🎯" />
      </div>

      {/* Row 3 — Business metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label="Most Enquired" value="N/A" icon="🏆" />
        <StatCard label="Average Project Value" value={`AUD ${s.avgProjectValue}`} icon="💵" />
        <StatCard label="Client Return Rate" value="0%" icon="🔄" />
      </div>

      {/* Row 4 — More metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label="Profile Views This Month" value="0" sub="vs 0 last month" icon="👁" />
        <StatCard label="Search Appearances" value="0" icon="🔍" />
        <StatCard label="Total Clients" value={s.activeEnquiries} sub={`${s.totalBookings} total bookings`} icon="👥" />
      </div>

      {/* Chart */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Bookings Trend (Last 6 Months)</div>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#1DB954' }} />
            Bookings
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#a855f7' }} />
            Enquiries
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '160px', padding: '0 8px' }}>
          {s.chartData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', justifyContent: 'center', flex: 1 }}>
                <div style={{ width: '40%', background: '#1DB954', borderRadius: '3px 3px 0 0', height: `${Math.max((d.Bookings / Math.max(...s.chartData.map(x => x.Bookings), 1)) * 100, d.Bookings > 0 ? 4 : 0)}%`, minHeight: d.Bookings > 0 ? '4px' : '0' }} />
                <div style={{ width: '40%', background: '#a855f7', borderRadius: '3px 3px 0 0', height: `${Math.max((d.Enquiries / Math.max(...s.chartData.map(x => x.Enquiries), 1)) * 100, d.Enquiries > 0 ? 4 : 0)}%`, minHeight: d.Enquiries > 0 ? '4px' : '0' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
