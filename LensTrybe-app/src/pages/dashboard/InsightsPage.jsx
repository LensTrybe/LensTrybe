import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'

function StatCard({ label, value, sub, icon }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</span>
        {sub && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
      <div style={{ fontSize: '28px', opacity: 0.25 }}>{icon}</div>
    </div>
  )
}

function QuickAction({ icon, label, path, navigate }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => navigate(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${hovered ? '#1DB954' : 'var(--border-default)'}`, background: hovered ? 'rgba(29,185,84,0.08)' : 'var(--bg-elevated)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '12px' }}
    >
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: hovered ? '#1DB954' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{label}</span>
    </div>
  )
}

export default function InsightsPage() {
  const { user, profile } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recentInvoices, setRecentInvoices] = useState([])
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

    const recent = await supabase.from('invoices').select('id, amount, status, created_at, client_name').eq('creative_id', user.id).order('created_at', { ascending: false }).limit(5)
    setRecentInvoices(recent.data ?? [])

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
    const avgProjectValue = confirmedBookings > 0 ? (totalRevenue / confirmedBookings).toFixed(2) : '0.00'
    const totalReviews = reviews?.length ?? 0

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { label: d.toLocaleString('default', { month: 'short' }), month: d.getMonth(), year: d.getFullYear() }
    })
    const chartData = months.map(m => ({
      name: m.label,
      Bookings: (bookings ?? []).filter(b => { const d = new Date(b.created_at); return d.getMonth() === m.month && d.getFullYear() === m.year }).length,
      Enquiries: (threads ?? []).filter(t => { const d = new Date(t.created_at); return d.getMonth() === m.month && d.getFullYear() === m.year }).length,
    }))

    setStats({ thisMonthRevenue, ytdRevenue, thisMonthEnquiries, lastMonthEnquiries, activeEnquiries, confirmedBookings, totalBookings, conversionRate, avgProjectValue, totalReviews, chartData })
    setLoading(false)
  }

  const tierColors = { basic: 'var(--text-muted)', pro: '#1DB954', expert: '#a855f7', elite: '#EAB308' }
  const tierColor = tierColors[tier] ?? 'var(--text-muted)'
  const displayName = profile?.business_name ?? user?.email ?? 'there'
  const isFoundingMember = profile?.founding_member === true

  function statusColor(status) {
    if (status === 'paid') return '#1DB954'
    if (status === 'overdue') return '#ef4444'
    if (status === 'sent') return '#3b82f6'
    return 'var(--text-muted)'
  }

  const quickActions = [
    { icon: '✉', label: 'New Message', path: '/dashboard/clients/messages' },
    { icon: '◎', label: 'New Invoice', path: '/dashboard/finance/invoicing' },
    { icon: '▦', label: 'Add Portfolio', path: '/dashboard/portfolio-design/portfolio' },
    { icon: '⬆', label: 'New Delivery', path: '/dashboard/portfolio-design/deliver' },
  ]

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>

  const s = stats

  return (
    <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-ui)' }}>

      {/* Greeting */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>
            Good to see you, {displayName.split(' ')[0]}.
          </h1>
          <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: `${tierColor}22`, border: `1px solid ${tierColor}44`, color: tierColor }}>
            {tier?.charAt(0).toUpperCase() + tier?.slice(1)} Plan
          </span>
          {isFoundingMember && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: 'linear-gradient(90deg, rgba(29,185,84,0.2), rgba(234,179,8,0.2))', border: '1px solid rgba(234,179,8,0.4)', color: '#EAB308' }}>✦ Founding Member</span>
          )}
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>Here's what's happening with your business.</p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {quickActions.map((a, i) => <QuickAction key={i} {...a} navigate={navigate} />)}
      </div>

      {/* Row 1 — Core stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label="Total Bookings" value={s.totalBookings} icon="📅" />
        <StatCard label="Active Enquiries" value={s.activeEnquiries} icon="💬" />
        <StatCard label="Platform Reviews" value={s.totalReviews} icon="⭐" />
        <StatCard label="Conversion Rate" value={`${s.conversionRate}%`} icon="🎯" />
      </div>

      {/* Row 2 — Revenue */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label="This Month Revenue" value={`$${s.thisMonthRevenue.toFixed(2)}`} icon="💰" />
        <StatCard label="YTD Revenue" value={`$${s.ytdRevenue.toFixed(2)}`} icon="📈" />
        <StatCard label="Enquiries This Month" value={s.thisMonthEnquiries} sub={`vs ${s.lastMonthEnquiries} last month`} icon="📥" />
        <StatCard label="Avg Project Value" value={`$${s.avgProjectValue}`} icon="💵" />
      </div>

      {/* Chart + Recent Invoices side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Chart */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Bookings & Enquiries (Last 6 Months)</div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#1DB954' }} /> Bookings
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#a855f7' }} /> Enquiries
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px' }}>
            {s.chartData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', justifyContent: 'center', flex: 1 }}>
                  <div style={{ width: '45%', background: '#1DB954', borderRadius: '3px 3px 0 0', height: `${Math.max((d.Bookings / Math.max(...s.chartData.map(x => x.Bookings), 1)) * 100, d.Bookings > 0 ? 4 : 0)}%`, minHeight: d.Bookings > 0 ? '4px' : '0' }} />
                  <div style={{ width: '45%', background: '#a855f7', borderRadius: '3px 3px 0 0', height: `${Math.max((d.Enquiries / Math.max(...s.chartData.map(x => x.Enquiries), 1)) * 100, d.Enquiries > 0 ? 4 : 0)}%`, minHeight: d.Enquiries > 0 ? '4px' : '0' }} />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{d.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Invoices */}
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Invoices</div>
            <button type="button" onClick={() => navigate('/dashboard/finance/invoicing')} style={{ fontSize: '12px', color: '#1DB954', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>View all →</button>
          </div>
          {recentInvoices.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No invoices yet.</div>
          ) : (
            recentInvoices.map((inv, i) => (
              <div key={i} style={{ padding: '12px 20px', borderBottom: i < recentInvoices.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{inv.client_name ?? 'Client'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(inv.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>${inv.amount?.toFixed(2) ?? '0.00'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: `${statusColor(inv.status)}22`, color: statusColor(inv.status), border: `1px solid ${statusColor(inv.status)}44` }}>{inv.status ?? 'draft'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile completion nudge */}
      {!profile?.bio && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Complete your profile to get discovered by more clients. Add a bio, portfolio photos and your specialties.</div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard/profile/edit-profile')}>Complete Profile</Button>
        </div>
      )}
    </div>
  )
}
