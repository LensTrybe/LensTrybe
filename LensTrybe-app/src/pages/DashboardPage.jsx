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

function StatCard({ icon, label, value, valueClassName = '' }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-label">{label}</div>
        <div className={`stat-card-value ${valueClassName}`.trim()}>{value}</div>
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
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  dollar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  percent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
}

export default function DashboardPage() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const name = displayNameFromUser(user)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-intro">
          <h1 className="dashboard-title">Welcome, {name}</h1>
          <span className="dashboard-badge">+ Founding Member</span>
        </div>
      </header>

      <section className="dashboard-section" aria-label="Overview stats">
        <div className="dashboard-grid">
          <StatCard icon={ICONS.calendar} label="Total Bookings" value="0" />
          <StatCard icon={ICONS.message} label="Active Enquiries" value="0" />
          <StatCard icon={ICONS.eye} label="Profile Views" value="0" />
          <StatCard icon={ICONS.star} label="Platform Reviews" value="0" />
        </div>
      </section>

      <section className="dashboard-section" aria-label="Revenue and performance">
        <div className="dashboard-grid">
          <StatCard
            icon={ICONS.dollar}
            label="This Month Revenue"
            value="AUD 0.00"
            valueClassName="stat-card-value--muted"
          />
          <StatCard
            icon={ICONS.trend}
            label="YTD Revenue"
            value="AUD 0.00"
            valueClassName="stat-card-value--muted"
          />
          <StatCard icon={ICONS.inbox} label="Enquiries This Month" value="0" />
          <StatCard icon={ICONS.percent} label="Conversion Rate" value="0%" />
        </div>
      </section>
    </div>
  )
}
