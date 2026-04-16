import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

export default function ClientDashboardPage() {
  const { user, clientAccount } = useAuth()
  const navigate = useNavigate()
  const [threads, setThreads] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    if (!user) return
    const [threadsRes, jobsRes] = await Promise.all([
      supabase.from('message_threads').select('*').eq('client_user_id', user.id).order('updated_at', { ascending: false }).limit(5),
      supabase.from('job_listings').select('*').eq('posted_by', user.id).order('created_at', { ascending: false }),
    ])
    setThreads(threadsRes.data ?? [])
    setJobs(jobsRes.data ?? [])
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const displayName = `${clientAccount?.first_name ?? ''} ${clientAccount?.last_name ?? ''}`.trim() || user?.email || 'there'

  const [hoveredAction, setHoveredAction] = useState(null)

  const quickActions = [
    { icon: '🔍', label: 'Find a Creative', sub: 'Search and hire creatives', path: '/creatives' },
    { icon: '📋', label: 'Post a Job', sub: 'Let creatives come to you', path: '/creatives' },
    { icon: '💬', label: 'My Enquiries', sub: 'View your conversations', path: null },
  ]

  const styles = {
    page: { minHeight: '100vh', background: 'var(--bg-base)' },
    nav: { position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' },
    logo: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', cursor: 'pointer' },
    navRight: { display: 'flex', alignItems: 'center', gap: '16px' },
    userEmail: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    content: { maxWidth: '1280px', margin: '0 auto', padding: '40px' },
    greeting: { fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--text-primary)', fontWeight: 400, marginBottom: '8px' },
    greetingSub: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: '40px' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', marginBottom: '16px' },
    card: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px' },
    threadItem: { padding: '14px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
    threadName: { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    threadSub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '2px' },
    jobItem: { padding: '14px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    jobTitle: { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    jobSub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '2px' },
    emptyState: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', padding: '24px 0', textAlign: 'center' },
    quickActions: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' },
    actionCard: (hovered) => ({ padding: '20px', background: hovered ? 'var(--bg-overlay)' : 'var(--bg-elevated)', border: `1px solid ${hovered ? 'var(--green)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-xl)', cursor: 'pointer', transition: 'all var(--transition-base)', display: 'flex', flexDirection: 'column', gap: '8px' }),
    actionIcon: { fontSize: '24px' },
    actionLabel: (hovered) => ({ fontSize: '14px', fontWeight: 500, color: hovered ? 'var(--green)' : 'var(--text-primary)', fontFamily: 'var(--font-ui)' }),
    actionSub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.logo} onClick={() => navigate('/')}>LensTrybe</div>
        <div style={styles.navRight}>
          <span style={styles.userEmail}>{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
        </div>
      </nav>

      <div style={styles.content}>
        <div style={styles.greeting}>Good to see you, {displayName.split(' ')[0]}.</div>
        <div style={styles.greetingSub}>Find and hire the right creative for your next project.</div>

        <div style={styles.quickActions}>
          {quickActions.map((action, i) => (
            <div
              key={i}
              style={styles.actionCard(hoveredAction === i)}
              onMouseEnter={() => setHoveredAction(i)}
              onMouseLeave={() => setHoveredAction(null)}
              onClick={() => action.path && navigate(action.path)}
            >
              <div style={styles.actionIcon}>{action.icon}</div>
              <div style={styles.actionLabel(hoveredAction === i)}>{action.label}</div>
              <div style={styles.actionSub}>{action.sub}</div>
            </div>
          ))}
        </div>

        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Recent Enquiries</div>
            {loading ? (
              <div style={styles.emptyState}>Loading…</div>
            ) : threads.length === 0 ? (
              <div style={styles.emptyState}>No enquiries yet. Find a creative to get started.</div>
            ) : threads.map((t, i) => (
              <div key={t.id} style={{ ...styles.threadItem, borderBottom: i === threads.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={styles.threadName}>{t.subject ?? 'Enquiry'}</div>
                  <div style={styles.threadSub}>{new Date(t.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>My Posted Jobs</div>
            {loading ? (
              <div style={styles.emptyState}>Loading…</div>
            ) : jobs.length === 0 ? (
              <div style={styles.emptyState}>No jobs posted yet.</div>
            ) : jobs.map((j, i) => (
              <div key={j.id} style={{ ...styles.jobItem, borderBottom: i === jobs.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={styles.jobTitle}>{j.title}</div>
                  <div style={styles.jobSub}>Posted {new Date(j.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                </div>
                <Badge variant={j.status === 'active' ? 'green' : 'default'} size="sm">{j.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
