import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

function StatCard({ label, value, sub, accent }) {
  const styles = {
    card: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    label: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.05em', textTransform: 'uppercase' },
    value: { fontFamily: 'var(--font-display)', fontSize: '36px', color: accent ?? 'var(--text-primary)', lineHeight: 1 },
    sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
  }
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
      {sub && <div style={styles.sub}>{sub}</div>}
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
      style={{
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${hovered ? 'var(--green)' : 'var(--border-default)'}`,
        background: hovered ? 'var(--green-dim)' : 'var(--bg-elevated)',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span style={{ fontSize: '13px', fontWeight: 500, color: hovered ? 'var(--green)' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{label}</span>
    </div>
  )
}

export default function DashboardHome() {
  const { profile, user } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ invoices: 0, messages: 0, bookings: 0, reviews: 0 })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  const tierColors = { basic: 'var(--text-muted)', pro: 'var(--green)', expert: 'var(--silver)', elite: '#EAB308' }
  const tierColor = tierColors[tier] ?? 'var(--text-muted)'

  useEffect(() => {
    async function load() {
      if (!user) return
      const id = user.id

      const [inv, msg, book, rev] = await Promise.all([
        supabase.from('invoices').select('id, amount, status, created_at').eq('creative_id', id).order('created_at', { ascending: false }).limit(5),
        supabase.from('message_threads').select('id', { count: 'exact' }).eq('creative_id', id),
        supabase.from('bookings').select('id', { count: 'exact' }).eq('creative_id', id),
        supabase.from('reviews').select('id', { count: 'exact' }).eq('creative_id', id),
      ])

      setStats({
        invoices: inv.data?.length ?? 0,
        messages: msg.count ?? 0,
        bookings: book.count ?? 0,
        reviews: rev.count ?? 0,
      })
      setRecentInvoices(inv.data ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  const displayName = profile?.business_name ?? profile?.full_name ?? user?.email ?? 'there'
  const isFoundingMember = profile?.founding_member === true

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '40px' },
    greeting: { display: 'flex', flexDirection: 'column', gap: '8px' },
    greetingTop: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    name: { fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--text-primary)', fontWeight: 400 },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
    section: { display: 'flex', flexDirection: 'column', gap: '16px' },
    sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
    tableWrap: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
    },
    tableHeader: {
      display: 'grid',
      gridTemplateColumns: '1fr 120px 100px 100px',
      padding: '12px 20px',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: '11px',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
    tableRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 120px 100px 100px',
      padding: '14px 20px',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: '13px',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-ui)',
      alignItems: 'center',
    },
    emptyState: {
      padding: '48px 24px',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: '14px',
      fontFamily: 'var(--font-ui)',
    },
    profileBanner: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-xl)',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    },
    bannerText: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
  }

  function statusVariant(status) {
    if (status === 'paid') return 'green'
    if (status === 'overdue') return 'error'
    if (status === 'sent') return 'info'
    return 'default'
  }

  const quickActions = [
    { icon: '✉', label: 'New Message', path: '/dashboard/clients/messages' },
    { icon: '◎', label: 'New Invoice', path: '/dashboard/finance/invoicing' },
    { icon: '▦', label: 'Add Portfolio', path: '/dashboard/portfolio-design/portfolio' },
    { icon: '⬆', label: 'New Delivery', path: '/dashboard/portfolio-design/deliver' },
  ]

  return (
    <div style={styles.page}>

      {/* Greeting */}
      <div style={styles.greeting}>
        <div style={styles.greetingTop}>
          <h1 style={styles.name}>Good to see you, {displayName.split(' ')[0]}.</h1>
          <Badge variant={tier === 'basic' ? 'default' : tier === 'pro' ? 'green' : tier === 'expert' ? 'default' : 'default'}>
            <span style={{ color: tierColor }}>{tier.charAt(0).toUpperCase() + tier.slice(1)} Plan</span>
          </Badge>
          {isFoundingMember && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(90deg, rgba(29,185,84,0.2), rgba(234,179,8,0.2))',
              border: '1px solid rgba(234,179,8,0.4)',
              color: '#EAB308',
              fontFamily: 'var(--font-ui)',
            }}>✦ Founding Member</span>
          )}
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          Here's what's happening with your business.
        </p>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard label="Invoices" value={loading ? '—' : stats.invoices} sub="Total created" />
        <StatCard label="Messages" value={loading ? '—' : stats.messages} sub="Conversations" />
        <StatCard label="Bookings" value={loading ? '—' : stats.bookings} sub="All time" />
        <StatCard label="Reviews" value={loading ? '—' : stats.reviews} sub="On your profile" accent="var(--green)" />
      </div>

      {/* Quick actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Quick actions</div>
        <div style={styles.quickGrid}>
          {quickActions.map((a, i) => (
            <QuickAction key={i} {...a} navigate={navigate} />
          ))}
        </div>
      </div>

      {/* Recent invoices */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>Recent invoices</div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/invoicing')}>View all →</Button>
        </div>
        <div style={styles.tableWrap}>
          <div style={styles.tableHeader}>
            <span>Invoice</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {recentInvoices.length === 0 ? (
            <div style={styles.emptyState}>No invoices yet — create your first one.</div>
          ) : (
            recentInvoices.map((inv, i) => (
              <div key={i} style={{ ...styles.tableRow, borderBottom: i === recentInvoices.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>INV-{String(i + 1).padStart(3, '0')}</span>
                <span>${inv.amount?.toFixed(2) ?? '0.00'}</span>
                <Badge variant={statusVariant(inv.status)} size="sm">{inv.status ?? 'draft'}</Badge>
                <span>{new Date(inv.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile completion nudge */}
      {!profile?.bio && (
        <div style={styles.profileBanner}>
          <div style={styles.bannerText}>
            Complete your profile to get discovered by more clients. Add a bio, portfolio photos and your specialties.
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard/profile/edit-profile')}>
            Complete Profile
          </Button>
        </div>
      )}

    </div>
  )
}
