import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import './DashboardPage.css'

function displayNameFromUser(user) {
  if (!user) return 'there'
  const meta = user.user_metadata ?? {}
  const fromMeta = meta.full_name ?? meta.name ?? meta.display_name
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  const local = user.email?.split('@')[0]
  return local || 'there'
}

function StatCard({ icon, label, value, valueClassName = '', sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-label">{label}</div>
        <div className={`stat-card-value ${valueClassName}`.trim()}>{value}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  )
}

const ICONS = {
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  dollar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
}

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentBookings, setRecentBookings] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (!user) return
    fetchStats()
  }, [user])

  const fetchStats = async () => {
    setLoading(true)
    const [bookings, invoices, quotes, contracts, contacts, messages, portfolio, deliveries] = await Promise.all([
      supabase.from('bookings').select('id, status').eq('creative_id', user.id),
      supabase.from('invoices').select('id, amount, status').eq('creative_id', user.id),
      supabase.from('quotes').select('id, status').eq('creative_id', user.id),
      supabase.from('contracts').select('id, status').eq('creative_id', user.id),
      supabase.from('crm_contacts').select('id').eq('creative_id', user.id),
      supabase.from('message_threads').select('id, unread_count').eq('creative_id', user.id),
      supabase.from('portfolio_items').select('id').eq('creative_id', user.id),
      supabase.from('deliveries').select('id').eq('creative_id', user.id),
    ])

    const invData = invoices.data || []
    const totalRevenue = invData.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    const pendingRevenue = invData.filter(i => i.status === 'sent').reduce((s, i) => s + Number(i.amount || 0), 0)
    const unread = (messages.data || []).reduce((s, t) => s + (t.unread_count || 0), 0)

    setStats({
      totalRevenue,
      pendingRevenue,
      totalBookings: (bookings.data || []).length,
      upcomingBookings: (bookings.data || []).filter(b => b.status === 'confirmed').length,
      totalInvoices: invData.length,
      unpaidInvoices: invData.filter(i => i.status === 'sent').length,
      totalQuotes: (quotes.data || []).length,
      totalContracts: (contracts.data || []).length,
      signedContracts: (contracts.data || []).filter(c => c.status === 'signed').length,
      totalContacts: (contacts.data || []).length,
      unreadMessages: unread,
      totalThreads: (messages.data || []).length,
      portfolioItems: (portfolio.data || []).length,
      deliveries: (deliveries.data || []).length,
    })

    // Recent bookings
    const { data: rb } = await supabase
      .from('bookings')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4)
    setRecentBookings(rb || [])

    // Recent invoices
    const { data: ri } = await supabase
      .from('invoices')
      .select('*')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4)
    setRecentInvoices(ri || [])

    setLoading(false)
  }

  const formatCurrency = (n) => '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatDate = (ts) => ts ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'

  const statusColor = (status) => {
    const map = { paid: '#39ff14', draft: '#666', sent: '#facc15', overdue: '#f87171', confirmed: '#39ff14', pending: '#facc15', cancelled: '#f87171', signed: '#39ff14', declined: '#f87171', converted: '#a78bfa' }
    return map[status] || '#666'
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <h1>Welcome back, {displayNameFromUser(user)} 👋</h1>
        <p>Here's what's happening with your business today.</p>
      </div>

      {loading ? (
        <div style={{ color: '#444', fontSize: 14, padding: '40px 0' }}>Loading your stats...</div>
      ) : (
        <>
          <div className="stat-cards">
            <StatCard
              icon={ICONS.dollar}
              label="Total Revenue"
              value={formatCurrency(stats.totalRevenue)}
              valueClassName="green"
              sub={`${formatCurrency(stats.pendingRevenue)} pending`}
            />
            <StatCard
              icon={ICONS.calendar}
              label="Bookings"
              value={stats.totalBookings}
              sub={`${stats.upcomingBookings} confirmed`}
            />
            <StatCard
              icon={ICONS.file}
              label="Invoices"
              value={stats.totalInvoices}
              sub={`${stats.unpaidInvoices} unpaid`}
              valueClassName={stats.unpaidInvoices > 0 ? 'yellow' : ''}
            />
            <StatCard
              icon={ICONS.users}
              label="Contacts"
              value={stats.totalContacts}
              sub={`${stats.deliveries} deliveries sent`}
            />
            <StatCard
              icon={ICONS.message}
              label="Messages"
              value={stats.totalThreads}
              sub={stats.unreadMessages > 0 ? `${stats.unreadMessages} unread` : 'All read'}
              valueClassName={stats.unreadMessages > 0 ? 'yellow' : ''}
            />
            <StatCard
              icon={ICONS.eye}
              label="Portfolio"
              value={stats.portfolioItems}
              sub={`${stats.signedContracts} contracts signed`}
            />
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="dashboard-card-title">Recent Bookings</div>
              {recentBookings.length === 0 ? (
                <div className="dashboard-empty">No bookings yet</div>
              ) : (
                <div className="dashboard-list">
                  {recentBookings.map((b) => (
                    <div key={b.id} className="dashboard-list-row">
                      <div className="dashboard-list-avatar">{b.client_name?.[0]?.toUpperCase() || '?'}</div>
                      <div className="dashboard-list-info">
                        <div className="dashboard-list-name">{b.client_name}</div>
                        <div className="dashboard-list-sub">{b.service || '—'}</div>
                      </div>
                      <div className="dashboard-list-date">{formatDate(b.booking_date || b.created_at)}</div>
                      <span className="dashboard-status-badge" style={{ color: statusColor(b.status), borderColor: statusColor(b.status) + '44' }}>{b.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-card">
              <div className="dashboard-card-title">Recent Invoices</div>
              {recentInvoices.length === 0 ? (
                <div className="dashboard-empty">No invoices yet</div>
              ) : (
                <div className="dashboard-list">
                  {recentInvoices.map((inv) => (
                    <div key={inv.id} className="dashboard-list-row">
                      <div className="dashboard-list-avatar">{inv.client_name?.[0]?.toUpperCase() || '?'}</div>
                      <div className="dashboard-list-info">
                        <div className="dashboard-list-name">{inv.client_name}</div>
                        <div className="dashboard-list-sub">{formatDate(inv.created_at)}</div>
                      </div>
                      <div className="dashboard-list-amount" style={{ color: inv.status === 'paid' ? '#39ff14' : '#e8e8e8' }}>
                        {formatCurrency(inv.amount)}
                      </div>
                      <span className="dashboard-status-badge" style={{ color: statusColor(inv.status), borderColor: statusColor(inv.status) + '44' }}>{inv.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}