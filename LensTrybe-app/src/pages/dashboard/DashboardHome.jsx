import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import {
  DIVIDER_GRADIENT_STYLE,
  GLASS_CARD,
  GLASS_CARD_GREEN,
  TYPO,
  glassCardAccentBorder,
} from '../../lib/glassTokens'

function currency(n) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(n || 0))
}

function timeAgo(value) {
  if (!value) return 'Just now'
  const s = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function statusColor(status) {
  if (status === 'paid') return '#1DB954'
  if (status === 'overdue') return '#ef4444'
  if (status === 'sent') return '#3b82f6'
  return 'var(--text-muted)'
}

function Skeleton({ height = 16, width = '100%' }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
      }}
    />
  )
}

function FinancialCard({ label, value, sub, accent, red }) {
  return (
    <div
      style={{
        ...(accent ? GLASS_CARD_GREEN : GLASS_CARD),
        borderRadius: 12,
        padding: '16px 16px',
        ...(red ? glassCardAccentBorder('#ef4444') : {}),
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, ...TYPO.label }}>{label}</div>
      <div style={{ fontSize: 26, color: red ? '#fecaca' : 'var(--text-primary)', ...TYPO.stat }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: red ? '#fca5a5' : 'var(--text-muted)', marginTop: 6 }}>{sub}</div> : null}
    </div>
  )
}

function QuickAction({ icon, label, path, navigate, compact }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => navigate(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...GLASS_CARD,
        borderRadius: 10,
        ...(hovered ? glassCardAccentBorder('#1DB954') : {}),
        background: hovered
          ? 'linear-gradient(135deg, rgba(29,185,84,0.14) 0%, rgba(29,185,84,0.05) 100%)'
          : GLASS_CARD.background,
        padding: compact ? '10px 6px' : '16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '4px' : '10px',
        flex: compact ? 1 : undefined,
        minWidth: 0,
        flexDirection: compact ? 'column' : 'row',
      }}
    >
      <span style={{ fontSize: compact ? 16 : 18, lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontSize: compact ? 11 : 13,
          color: hovered ? '#1DB954' : 'var(--text-secondary)',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export default function DashboardHome() {
  const { user, profile } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [liveTime, setLiveTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [recentInvoices, setRecentInvoices] = useState([])
  const [quickActions, setQuickActions] = useState([])
  const [editingQuickActions, setEditingQuickActions] = useState(false)
  const [draftQuickActions, setDraftQuickActions] = useState([])
  const [quickActionsError, setQuickActionsError] = useState('')
  const [isAvailable, setIsAvailable] = useState(profile?.is_available ?? false)
  const [availabilityColumn, setAvailabilityColumn] = useState(null)
  const [availabilityError, setAvailabilityError] = useState('')
  const [toast, setToast] = useState(null)
  const [availabilitySaving, setAvailabilitySaving] = useState(false)

  const DEFAULT_QUICK_ACTION_LABELS = ['New Message', 'New Invoice', 'Add Portfolio', 'New Delivery', 'New Contract', 'New Booking']
  const AVAILABLE_QUICK_ACTIONS = [
    { icon: '✉', label: 'New Message', path: '/dashboard/clients/messages' },
    { icon: '◎', label: 'New Invoice', path: '/dashboard/finance/invoicing' },
    { icon: '◌', label: 'New Quote', path: '/dashboard/finance/quotes' },
    { icon: '✍', label: 'New Contract', path: '/dashboard/finance/contracts' },
    { icon: '▦', label: 'Add Portfolio', path: '/dashboard/portfolio-design/portfolio-website' },
    { icon: '⬆', label: 'New Delivery', path: '/dashboard/portfolio-design/deliver' },
    { icon: '👥', label: 'Add Client', path: '/dashboard/clients/crm' },
    { icon: '📅', label: 'New Booking', path: '/dashboard/my-work/my-bookings' },
    { icon: '🕒', label: 'View Availability', path: '/dashboard/my-work/availability' },
    { icon: '💼', label: 'Job Board', path: '/dashboard/my-work/jobs' },
  ]

  useEffect(() => {
    const t = window.setInterval(() => setLiveTime(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (user?.id) {
      void loadQuickActions()
      void loadDashboard()
      void loadAvailability()
    }
  }, [user?.id])

  useEffect(() => {
    if (!profile) return
    if (availabilityColumn === 'available') {
      if (typeof profile.available === 'boolean') setIsAvailable(profile.available)
      return
    }
    if (availabilityColumn === 'availability_status') {
      if (typeof profile.availability_status === 'string') {
        setIsAvailable(profile.availability_status.toLowerCase() === 'available')
      }
      return
    }
    if (typeof profile.is_available === 'boolean') {
      setIsAvailable(profile.is_available)
    } else {
      setIsAvailable(false)
    }
  }, [profile, availabilityColumn])

  function showToast(msg, type = 'error') {
    setToast({ msg, type })
    window.setTimeout(() => setToast(null), 3500)
  }

  async function resolveAvailabilityColumn() {
    const candidates = ['is_available', 'available', 'availability_status']
    for (const col of candidates) {
      const { error } = await supabase.from('profiles').select(col).eq('id', user.id).limit(1).maybeSingle()
      if (!error) return col
      const text = String(error?.message || '').toLowerCase()
      if (text.includes('column') || text.includes('schema cache')) continue
      return null
    }
    return null
  }

  async function loadAvailability() {
    try {
      const col = await resolveAvailabilityColumn()
      if (!col) {
        setAvailabilityColumn(null)
        setAvailabilityError('Availability field is missing on your profile schema. Please contact support.')
        return
      }
      setAvailabilityColumn(col)
      setAvailabilityError('')
      const { data, error } = await supabase.from('profiles').select(col).eq('id', user.id).maybeSingle()
      if (error) throw error
      if (col === 'availability_status') {
        setIsAvailable(String(data?.availability_status || '').toLowerCase() === 'available')
      } else {
        const value = col === 'available' ? data?.available : data?.is_available
        setIsAvailable(typeof value === 'boolean' ? value : false)
      }
    } catch {
      setIsAvailable(false)
      setAvailabilityError('Could not load availability status right now.')
    }
  }

  async function loadQuickActions() {
    const defaultActions = AVAILABLE_QUICK_ACTIONS.filter((a) => DEFAULT_QUICK_ACTION_LABELS.includes(a.label))
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('dashboard_quick_actions')
        .eq('id', user.id)
        .maybeSingle()
      if (error) throw error
      const labels = Array.isArray(data?.dashboard_quick_actions) ? data.dashboard_quick_actions : []
      if (!labels.length) {
        setQuickActions(defaultActions)
        setDraftQuickActions(defaultActions)
        return
      }
      const mapped = labels.map((label) => AVAILABLE_QUICK_ACTIONS.find((a) => a.label === label)).filter(Boolean)
      const selected = mapped.length ? mapped : defaultActions
      setQuickActions(selected)
      setDraftQuickActions(selected)
    } catch {
      setQuickActions(defaultActions)
      setDraftQuickActions(defaultActions)
    }
  }

  async function loadDashboard() {
    setLoading(true)
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const thisYearStart = new Date(now.getFullYear(), 0, 1).toISOString()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 7)
    const weekStartIso = weekStart.toISOString()

    const [
      invoicesRes,
      threadsRes,
      bookingsRes,
      reviewsRes,
      quotesRes,
      contractsRes,
      portfolioCountRes,
      messagesRes,
      crmRes,
      deliveriesRes,
      recentBookingsRes,
      recentReviewsRes,
      profileViewsRes,
    ] = await Promise.all([
      supabase.from('invoices').select('id, amount, status, created_at, due_date, client_name, paid_at').eq('creative_id', user.id),
      supabase.from('message_threads').select('id, created_at, updated_at, client_name, subject').eq('creative_id', user.id).order('updated_at', { ascending: false }).limit(20),
      supabase.from('bookings').select('id, created_at, status, booking_date, date, client_name, job_type').eq('creative_id', user.id).order('created_at', { ascending: false }),
      supabase.from('reviews').select('rating, created_at').eq('creative_id', user.id),
      supabase.from('quotes').select('id, amount, status, created_at, client_name').eq('creative_id', user.id),
      supabase.from('contracts').select('id, status, created_at, client_name').eq('creative_id', user.id),
      supabase.from('portfolio_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('messages').select('thread_id, body, created_at, sender_type, is_read, read_at').eq('creative_id', user.id).order('created_at', { ascending: false }).limit(120),
      supabase.from('crm_contacts').select('id, created_at, updated_at, last_contact_at').eq('creative_id', user.id),
      supabase.from('deliveries').select('id, created_at, sent_at').eq('creative_id', user.id),
      supabase.from('bookings').select('id, booking_date, date, client_name, job_type, status').eq('creative_id', user.id),
      supabase.from('reviews').select('created_at, rating').eq('creative_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('profile_views').select('id').eq('creative_id', user.id).gte('created_at', weekStartIso),
    ])

    const invoices = invoicesRes.data ?? []
    const threads = threadsRes.data ?? []
    const bookings = bookingsRes.data ?? []
    const reviews = reviewsRes.data ?? []
    const quotes = quotesRes.data ?? []
    const contracts = contractsRes.data ?? []
    const messages = messagesRes.data ?? []
    const crmContacts = crmRes.data ?? []
    const deliveries = deliveriesRes.data ?? []
    const recentBookings = (recentBookingsRes.data ?? []).slice(0, 3)
    const recentReviewRows = recentReviewsRes.data ?? []

    const paidInvoices = invoices.filter((i) => i.status === 'paid')
    const thisMonthRevenue = paidInvoices
      .filter((i) => (i.paid_at ?? i.created_at) >= thisMonthStart)
      .reduce((sum, i) => sum + Number(i.amount || 0), 0)
    const ytdRevenue = paidInvoices
      .filter((i) => (i.paid_at ?? i.created_at) >= thisYearStart)
      .reduce((sum, i) => sum + Number(i.amount || 0), 0)
    const overdueInvoices = invoices.filter((i) => i.due_date && i.status !== 'paid' && new Date(i.due_date) < now)
    const outstandingInvoices = invoices.filter((i) => i.status !== 'paid')
    const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0)

    const quotePendingStatuses = new Set(['sent', 'pending', 'awaiting_approval'])
    const pendingQuotes = quotes.filter((q) => quotePendingStatuses.has(String(q.status || '').toLowerCase()))
    const quotesPipelineValue = pendingQuotes.reduce((sum, q) => sum + Number(q.amount || 0), 0)
    const awaitingContracts = contracts.filter((c) =>
      ['sent', 'pending_signature', 'awaiting_signature'].includes(String(c.status || '').toLowerCase()),
    )

    const reviewsAverage = reviews.length
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length
      : 0
    const enquiries = threads.length
    const conversionRate = enquiries > 0 ? (bookings.length / enquiries) * 100 : 0
    const unreadMessages = messages.filter((m) => {
      if (m.sender_type && m.sender_type !== 'client') return false
      if ('is_read' in m) return m.is_read !== true
      if ('read_at' in m) return !m.read_at
      return false
    })
    const unreadThreadIds = new Set(unreadMessages.map((m) => m.thread_id).filter(Boolean))
    const unreadCount = unreadThreadIds.size

    const threadSummaries = threads.slice(0, 5).map((t) => {
      const firstMsg = messages.find((m) => m.thread_id === t.id)
      return {
        ...t,
        preview: String(firstMsg?.body || t.subject || 'No message yet').slice(0, 60),
        unread: unreadThreadIds.has(t.id),
        when: t.updated_at || t.created_at,
      }
    })

    const oldClientsCount = crmContacts.filter((c) => {
      const last = c.last_contact_at || c.updated_at || c.created_at
      return last && (now.getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24) > 30
    }).length

    const upcomingThisWeek = recentBookings
      .filter((b) => {
        const d = b.booking_date || b.date
        if (!d) return false
        const dt = new Date(d)
        const in7 = new Date(now)
        in7.setDate(in7.getDate() + 7)
        return dt >= now && dt <= in7
      })
      .slice(0, 3)

    const overdueList = overdueInvoices
      .slice(0, 3)
      .map((i) => ({ ...i, days: Math.max(1, Math.floor((now - new Date(i.due_date)) / (1000 * 60 * 60 * 24))) }))

    const recentPayments = paidInvoices
      .sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))
      .slice(0, 3)

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { label: d.toLocaleString('default', { month: 'short' }), month: d.getMonth(), year: d.getFullYear() }
    })
    const chartData = months.map((m) => ({
      name: m.label,
      Bookings: bookings.filter((b) => {
        const d = new Date(b.created_at)
        return d.getMonth() === m.month && d.getFullYear() === m.year
      }).length,
      Enquiries: threads.filter((t) => {
        const d = new Date(t.created_at)
        return d.getMonth() === m.month && d.getFullYear() === m.year
      }).length,
    }))

    const events = [
      ...messages.slice(0, 6).map((m) => ({
        at: m.created_at,
        icon: '✉',
        text: 'New message received',
      })),
      ...invoices.slice(0, 6).map((i) => ({
        at: i.created_at,
        icon: i.status === 'paid' ? '✓' : '◎',
        text: i.status === 'paid' ? `Invoice paid by ${i.client_name || 'client'}` : `Invoice created for ${i.client_name || 'client'}`,
      })),
      ...bookings.slice(0, 6).map((b) => ({
        at: b.created_at,
        icon: '📅',
        text: `Booking added${b.client_name ? ` for ${b.client_name}` : ''}`,
      })),
      ...recentReviewRows.slice(0, 6).map((r) => ({
        at: r.created_at,
        icon: '⭐',
        text: `New review received (${Number(r.rating || 0).toFixed(1)}★)`,
      })),
      ...contracts.slice(0, 6).map((c) => ({
        at: c.created_at,
        icon: '✍',
        text: `Contract ${String(c.status || 'updated').replace('_', ' ')}`,
      })),
    ]
      .filter((e) => e.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8)

    const recent = await supabase
      .from('invoices')
      .select('id, amount, status, created_at, client_name')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentInvoices(recent.data ?? [])

    const viewsWeek = profileViewsRes.error ? null : (profileViewsRes.data ?? []).length
    const portfolioCount = portfolioCountRes.count ?? 0

    setDashboard({
      financial: {
        thisMonthRevenue,
        outstandingTotal,
        quotesPipelineValue,
        ytdRevenue,
        totalBookings: bookings.length,
        activeEnquiries: enquiries,
        reviewsAverage,
        reviewCount: reviews.length,
        conversionRate,
      },
      alerts: {
        overdueInvoices: overdueInvoices.length,
        unreadMessages: unreadCount,
        quotesAwaiting: pendingQuotes.length,
        contractsAwaiting: awaitingContracts.length,
      },
      pipeline: {
        threadSummaries,
        oldClientsCount,
        upcomingThisWeek,
        pendingContractsCount: awaitingContracts.length,
        deliveriesUnsentCount: deliveries.filter((d) => !d.sent_at).length,
        pendingQuotesCount: pendingQuotes.length,
        overdueList,
        recentPayments,
      },
      profileHealth: {
        portfolioCount,
        viewsWeek,
        chartData,
      },
      activity: events,
    })
    setLoading(false)
  }

  function toggleDraftQuickAction(action) {
    const exists = draftQuickActions.some((a) => a.label === action.label)
    if (exists) {
      setDraftQuickActions(draftQuickActions.filter((a) => a.label !== action.label))
      return
    }
    setDraftQuickActions([...draftQuickActions, action])
  }

  async function saveQuickActions() {
    try {
      const labels = draftQuickActions.map((a) => a.label)
      const { error } = await supabase.from('profiles').update({ dashboard_quick_actions: labels }).eq('id', user.id)
      if (error) throw error
      setQuickActions(draftQuickActions)
      setEditingQuickActions(false)
      setQuickActionsError('')
    } catch (err) {
      setQuickActionsError(err?.message || 'Could not save quick actions right now.')
    }
  }

  async function handleToggleAvailability() {
    if (!availabilityColumn) {
      const msg =
        availabilityError ||
        'Availability column was not found in profiles table. Expected one of: is_available, available, availability_status.'
      showToast(msg, 'error')
      return
    }
    const previous = isAvailable
    const next = !isAvailable
    setIsAvailable(next)
    setAvailabilitySaving(true)
    try {
      const payload =
        availabilityColumn === 'availability_status'
          ? { availability_status: next ? 'available' : 'unavailable' }
          : { [availabilityColumn]: next }
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (error) throw error
    } catch (err) {
      setIsAvailable(previous)
      showToast(err?.message || 'Could not update availability right now.', 'error')
    } finally {
      setAvailabilitySaving(false)
    }
  }

  const tierColors = { basic: 'var(--text-muted)', pro: '#1DB954', expert: '#a855f7', elite: '#EAB308' }
  const tierColor = tierColors[tier] ?? 'var(--text-muted)'
  const displayName = profile?.business_name ?? user?.email ?? 'there'
  const isFoundingMember = profile?.founding_member === true && profile?.show_founding_badge !== false

  const profileChecklist = useMemo(() => {
    if (!profile || !dashboard) return []
    const items = [
      { key: 'avatar', ok: !!profile.avatar_url, label: 'Add profile photo', path: '/dashboard/profile/edit-profile' },
      { key: 'bio', ok: !!String(profile.bio || '').trim(), label: 'Add bio', path: '/dashboard/profile/edit-profile' },
      { key: 'tagline', ok: !!String(profile.tagline || '').trim(), label: 'Add tagline', path: '/dashboard/profile/edit-profile' },
      {
        key: 'specialties',
        ok: Array.isArray(profile.specialties) && profile.specialties.length > 0,
        label: 'Add specialties',
        path: '/dashboard/profile/edit-profile',
      },
      {
        key: 'skills',
        ok: Array.isArray(profile.skill_types) && profile.skill_types.length > 0,
        label: 'Add creative skill types',
        path: '/dashboard/profile/edit-profile',
      },
      {
        key: 'location',
        ok: !!(profile.city || profile.state || profile.country || profile.location),
        label: 'Add location',
        path: '/dashboard/profile/edit-profile',
      },
      {
        key: 'portfolio',
        ok: (dashboard.profileHealth.portfolioCount || 0) > 0,
        label: 'Upload portfolio photos',
        path: '/dashboard/portfolio-design/portfolio-website',
      },
    ]
    return items
  }, [profile, dashboard])

  const profileCompletion = useMemo(() => {
    if (!profileChecklist.length) return 0
    const done = profileChecklist.filter((x) => x.ok).length
    return Math.round((done / profileChecklist.length) * 100)
  }, [profileChecklist])

  const tierLabel = { basic: 'Standard listing', pro: 'Enhanced listing', expert: 'Priority listing', elite: 'Featured listing' }[tier] || 'Standard listing'
  const nextTierMap = {
    basic: { tier: 'Pro', price: '$24.99/mo', missing: ['Booking requests', 'Quotes and invoicing', '20 portfolio photos'] },
    pro: { tier: 'Expert', price: '$74.99/mo', missing: ['Contracts and CRM', 'Brand kit tools', 'Priority profile visibility'] },
  }

  const tipsByTier = {
    basic: [
      'Add portfolio photos to get discovered',
      'Complete your profile to appear in search',
      'Upgrade to Pro to unlock booking requests',
    ],
    pro: [
      'Enable availability calendar to get more bookings',
      'Send your first quote to a client',
      'Use the CRM to track your client relationships',
    ],
    expert: [
      'Share your portfolio website link',
      'Check your Collaborate feed for collab opportunities',
      'Your Elite spotlight is active on the homepage',
    ],
    elite: [
      'Share your portfolio website link',
      'Check your Collaborate feed for collab opportunities',
      'Your Elite spotlight is active on the homepage',
    ],
  }

  const d = dashboard

  return (
    <div
      style={{
        background: 'transparent',
        padding: isMobile ? '20px 16px' : '32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 18 : 24,
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {toast ? (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 1000,
            padding: '10px 14px',
            borderRadius: 10,
            background: toast.type === 'error' ? '#ef4444' : '#1DB954',
            color: '#fff',
            fontSize: 12,
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          {toast.msg}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 26 : 32, color: 'var(--text-primary)', margin: 0 }}>
            Good to see you, {String(displayName).split(' ')[0]}.
          </h1>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: `${tierColor}22`,
              border: `1px solid ${tierColor}44`,
              color: tierColor,
            }}
          >
            {String(tier || '').charAt(0).toUpperCase() + String(tier || '').slice(1)} Plan
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
            }}
          >
            Profile {profileCompletion}%
          </span>
          {isFoundingMember ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'linear-gradient(90deg, rgba(29,185,84,0.2), rgba(234,179,8,0.2))',
                border: '1px solid rgba(234,179,8,0.4)',
                color: '#EAB308',
              }}
            >
              ✦ Founding Member
            </span>
          ) : null}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {liveTime.toLocaleTimeString('en-AU')} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          </span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Here is what is happening with your business.</p>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          {!editingQuickActions ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              style={{ borderRadius: 999 }}
              onClick={() => {
                setDraftQuickActions(quickActions)
                setQuickActionsError('')
                setEditingQuickActions(true)
              }}
            >
              ✎ Customise
            </Button>
          ) : null}
        </div>
        <div style={isMobile ? { display: 'flex', flexWrap: 'wrap', gap: 8 } : { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {(quickActions.length ? quickActions : AVAILABLE_QUICK_ACTIONS.filter((a) => DEFAULT_QUICK_ACTION_LABELS.includes(a.label))).map((a) => (
            <QuickAction key={a.label} {...a} navigate={navigate} compact={isMobile} />
          ))}
        </div>
        {editingQuickActions ? (
          <div style={{ marginTop: 12, ...GLASS_CARD, borderRadius: 10, padding: isMobile ? 12 : 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 14px' }}>
              {AVAILABLE_QUICK_ACTIONS.map((action) => {
                const checked = draftQuickActions.some((a) => a.label === action.label)
                return (
                  <label key={action.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleDraftQuickAction(action)} />
                    {action.label}
                  </label>
                )
              })}
            </div>
            {quickActionsError ? <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 12 }}>{quickActionsError}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingQuickActions(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={saveQuickActions}>
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {!loading && d && (
        <div style={{ ...GLASS_CARD, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {d.alerts.overdueInvoices > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/invoicing')} style={{ borderRadius: 999, borderColor: 'rgba(239,68,68,0.5)', color: '#fca5a5' }}>
              {d.alerts.overdueInvoices} overdue invoice{d.alerts.overdueInvoices > 1 ? 's' : ''}
            </Button>
          ) : null}
          {d.alerts.unreadMessages > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/clients/messages')} style={{ borderRadius: 999, borderColor: 'rgba(29,185,84,0.5)', color: '#86efac' }}>
              {d.alerts.unreadMessages} unread message thread{d.alerts.unreadMessages > 1 ? 's' : ''}
            </Button>
          ) : null}
          {d.alerts.quotesAwaiting > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/quotes')} style={{ borderRadius: 999, borderColor: 'rgba(250,204,21,0.5)', color: '#fde68a' }}>
              {d.alerts.quotesAwaiting} quote{d.alerts.quotesAwaiting > 1 ? 's' : ''} awaiting approval
            </Button>
          ) : null}
          {d.alerts.contractsAwaiting > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/contracts')} style={{ borderRadius: 999, borderColor: 'rgba(250,204,21,0.5)', color: '#fde68a' }}>
              {d.alerts.contractsAwaiting} contract{d.alerts.contractsAwaiting > 1 ? 's' : ''} awaiting signature
            </Button>
          ) : null}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={96} />)
        ) : (
          <>
            <FinancialCard label="This month revenue" value={currency(d.financial.thisMonthRevenue)} accent />
            <FinancialCard
              label="Outstanding invoices total"
              value={currency(d.financial.outstandingTotal)}
              sub={d.alerts.overdueInvoices > 0 ? `${d.alerts.overdueInvoices} overdue` : 'Up to date'}
              red={d.alerts.overdueInvoices > 0}
            />
            <FinancialCard label="Quotes pipeline value" value={currency(d.financial.quotesPipelineValue)} />
            <FinancialCard label="YTD revenue" value={currency(d.financial.ytdRevenue)} accent />
            <FinancialCard label="Total bookings" value={String(d.financial.totalBookings)} />
            <FinancialCard label="Active enquiries" value={String(d.financial.activeEnquiries)} />
            <FinancialCard label="Platform reviews average" value={`${d.financial.reviewsAverage.toFixed(1)}★`} sub={`${d.financial.reviewCount} reviews`} />
            <FinancialCard label="Conversion rate" value={`${d.financial.conversionRate.toFixed(1)}%`} />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr 1fr', gap: 12 }}>
        <div style={{ ...GLASS_CARD, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, ...TYPO.heading }}>Client activity</div>
          {loading ? (
            <>
              <Skeleton height={48} />
              <div style={{ height: 8 }} />
              <Skeleton height={48} />
            </>
          ) : d.pipeline.threadSummaries.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No message threads yet.</div>
          ) : (
            d.pipeline.threadSummaries.map((t) => (
              <div key={t.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t.client_name || 'Client'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t.unread ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1DB954' }} /> : null}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(t.when)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t.preview}</div>
              </div>
            ))
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Clients with no activity in 30+ days: <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/clients/crm')}>{d?.pipeline.oldClientsCount ?? 0}</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/clients/messages')} style={{ marginTop: 8 }}>View all messages →</Button>
        </div>

        <div style={{ ...GLASS_CARD, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, ...TYPO.heading }}>Work pipeline</div>
          {loading ? (
            <Skeleton height={90} />
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Upcoming bookings this week</div>
              {d.pipeline.upcomingThisWeek.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No bookings in the next 7 days.</div>
              ) : (
                d.pipeline.upcomingThisWeek.map((b) => (
                  <div key={b.id} style={{ paddingBottom: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{b.client_name || 'Client'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {(b.job_type || 'Booking').toString()} · {new Date(b.booking_date || b.date).toLocaleDateString('en-AU')}
                    </div>
                  </div>
                ))
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                Pending contracts awaiting signature: <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/contracts')}>{d.pipeline.pendingContractsCount}</Button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Deliveries not yet sent: <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/portfolio-design/deliver')}>{d.pipeline.deliveriesUnsentCount}</Button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Pending quotes: <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/quotes')}>{d.pipeline.pendingQuotesCount}</Button>
              </div>
            </>
          )}
        </div>

        <div style={{ ...GLASS_CARD, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, ...TYPO.heading }}>Financial actions</div>
          {loading ? (
            <Skeleton height={90} />
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Overdue invoices</div>
              {d.pipeline.overdueList.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No overdue invoices.</div>
              ) : (
                d.pipeline.overdueList.map((i) => (
                  <div key={i.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: '#fecaca' }}>{i.client_name || 'Client'} · {currency(i.amount)}</div>
                    <div style={{ fontSize: 11, color: '#fca5a5' }}>{i.days} day{i.days > 1 ? 's' : ''} overdue</div>
                  </div>
                ))
              )}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Recent payments received</div>
              {d.pipeline.recentPayments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No payments received yet.</div>
              ) : (
                d.pipeline.recentPayments.map((i) => (
                  <div key={i.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: '#86efac' }}>{i.client_name || 'Client'} · {currency(i.amount)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(i.paid_at || i.created_at).toLocaleDateString('en-AU')}</div>
                  </div>
                ))
              )}
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/invoicing')}>View all invoices →</Button>
        </div>
      </div>

      <div style={{ ...GLASS_CARD, borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, ...TYPO.heading }}>Profile health</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
              <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle
                cx="44"
                cy="44"
                r="36"
                fill="none"
                stroke="#1DB954"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(profileCompletion / 100) * (2 * Math.PI * 36)} ${2 * Math.PI * 36}`}
                transform="rotate(-90 44 44)"
              />
            </svg>
            <div>
              <div style={{ fontSize: 28, color: 'var(--text-primary)', ...TYPO.stat }}>{profileCompletion}%</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Profile complete</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {profileChecklist.filter((x) => !x.ok).length === 0 ? (
              <div style={{ fontSize: 12, color: '#86efac' }}>Everything looks complete.</div>
            ) : (
              profileChecklist
                .filter((x) => !x.ok)
                .map((item) => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(item.path)}>Complete</Button>
                  </div>
                ))
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10, ...TYPO.heading }}>Discoverability</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Search ranking: <span style={{ color: 'var(--text-primary)' }}>{tierLabel}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Portfolio photos: <span style={{ color: 'var(--text-primary)' }}>{d?.profileHealth.portfolioCount ?? 0}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Profile views this week: <span style={{ color: 'var(--text-primary)' }}>{d?.profileHealth.viewsWeek == null ? 'Coming soon' : d.profileHealth.viewsWeek}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Reviews: <span style={{ color: 'var(--text-primary)' }}>{d?.financial.reviewCount ?? 0}</span> ·
            <span style={{ color: 'var(--text-primary)' }}> {(d?.financial.reviewsAverage ?? 0).toFixed(1)}★</span>
          </div>
          <button
            type="button"
            disabled={availabilitySaving}
            onClick={handleToggleAvailability}
            style={{
              ...GLASS_CARD,
              borderRadius: 999,
              border: `1px solid ${isAvailable ? 'rgba(29,185,84,0.4)' : 'rgba(255,255,255,0.18)'}`,
              background: isAvailable ? 'linear-gradient(135deg, rgba(29,185,84,0.2), rgba(29,185,84,0.08))' : 'rgba(255,255,255,0.03)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 28,
                height: 16,
                borderRadius: 999,
                background: isAvailable ? 'rgba(29,185,84,0.35)' : 'rgba(255,255,255,0.2)',
                position: 'relative',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  top: 2,
                  left: isAvailable ? 14 : 2,
                  background: isAvailable ? '#1DB954' : '#cbd5e1',
                  transition: 'left 0.2s ease',
                }}
              />
            </span>
            {isAvailable ? 'Available for work' : 'Not available'}
          </button>
          {availabilityError ? <div style={{ marginTop: 8, fontSize: 11, color: '#fca5a5' }}>{availabilityError}</div> : null}
        </div>
      </div>

      <div style={{ ...GLASS_CARD, borderRadius: 12, padding: 16 }}>
        {(tier === 'basic' || tier === 'pro') && nextTierMap[tier] ? (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 14, alignItems: isMobile ? 'stretch' : 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current tier: {String(tier).toUpperCase()}</div>
              <div style={{ fontSize: 16, color: 'var(--text-primary)', margin: '4px 0 8px', ...TYPO.heading }}>
                Unlock {nextTierMap[tier].tier}
              </div>
              {nextTierMap[tier].missing.map((f) => (
                <div key={f} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {f}</div>
              ))}
            </div>
            <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
              <div style={{ fontSize: 22, color: '#86efac', ...TYPO.stat }}>{nextTierMap[tier].price}</div>
              <Button variant="primary" onClick={() => navigate('/pricing')}>Upgrade now</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 15, color: 'var(--text-primary)', ...TYPO.heading }}>You are all set</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              {tier === 'elite' ? 'Elite spotlight visibility, unlimited portfolio, and full business toolkit are active.' : 'Expert features including contracts, CRM, and brand tools are active.'}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: 12 }}>
        <div style={{ ...GLASS_CARD, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, ...TYPO.heading }}>Recent activity</div>
          {loading ? (
            <>
              <Skeleton height={16} />
              <div style={{ height: 8 }} />
              <Skeleton height={16} />
            </>
          ) : d.activity.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No recent activity yet.</div>
          ) : (
            d.activity.map((e, idx) => (
              <div key={`${e.at}-${idx}`} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 20, color: '#1DB954' }}>{e.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{e.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(e.at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ ...GLASS_CARD, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, ...TYPO.heading }}>Platform tips</div>
          {(tipsByTier[tier] || tipsByTier.basic).slice(0, 4).map((tip) => (
            <div key={tip} style={{ ...GLASS_CARD, borderRadius: 10, padding: '10px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tip}</div>
              <span style={{ color: '#1DB954' }}>→</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
        <div style={{ ...GLASS_CARD, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16, ...TYPO.heading }}>Bookings and enquiries (Last 6 months)</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#1DB954' }} /> Bookings
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#a855f7' }} /> Enquiries
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 4 : 8, height: 140 }}>
            {(d?.profileHealth.chartData || []).map((x) => (
              <div key={x.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'center', flex: 1 }}>
                  <div
                    style={{
                      width: '45%',
                      background: '#1DB954',
                      borderRadius: '3px 3px 0 0',
                      height: `${Math.max((x.Bookings / Math.max(...(d?.profileHealth.chartData || [{ Bookings: 1 }]).map((k) => k.Bookings), 1)) * 100, x.Bookings > 0 ? 4 : 0)}%`,
                    }}
                  />
                  <div
                    style={{
                      width: '45%',
                      background: '#a855f7',
                      borderRadius: '3px 3px 0 0',
                      height: `${Math.max((x.Enquiries / Math.max(...(d?.profileHealth.chartData || [{ Enquiries: 1 }]).map((k) => k.Enquiries), 1)) * 100, x.Enquiries > 0 ? 4 : 0)}%`,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{x.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...GLASS_CARD, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', ...TYPO.heading }}>Recent invoices</div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/finance/invoicing')}>View all →</Button>
          </div>
          <div style={DIVIDER_GRADIENT_STYLE} aria-hidden />
          {loading ? (
            <div style={{ padding: 20 }}>
              <Skeleton height={18} />
              <div style={{ height: 8 }} />
              <Skeleton height={18} />
            </div>
          ) : recentInvoices.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No invoices yet.</div>
          ) : (
            recentInvoices.map((inv, i) => (
              <div key={inv.id || i}>
                <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{inv.client_name ?? 'Client'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(inv.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{currency(inv.amount)}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${statusColor(inv.status)}22`, color: statusColor(inv.status), border: `1px solid ${statusColor(inv.status)}44` }}>
                      {inv.status ?? 'draft'}
                    </span>
                  </div>
                </div>
                {i < recentInvoices.length - 1 ? <div style={DIVIDER_GRADIENT_STYLE} aria-hidden /> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
