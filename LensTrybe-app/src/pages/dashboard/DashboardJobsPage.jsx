import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthUser from '../../hooks/useAuthUser'
import { supabase } from '../../lib/supabaseClient'
import { formatJobBudget } from '../../lib/jobPricing.js'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'
import Button from '../../components/ui/Button'

const PAGE = {
  bg: '#0a0a0f',
  text: 'rgb(242, 242, 242)',
  card: '#13131a',
  border: '1px solid #1e1e1e',
  muted: '#666',
  sub: '#aaa',
  pink: '#D946EF',
}

const font = { fontFamily: 'Inter, sans-serif' }

export default function DashboardJobsPage() {
  const { user, loading: authLoading } = useAuthUser()
  const [posted, setPosted] = useState([])
  const [applications, setApplications] = useState([])
  const [jobById, setJobById] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !user?.id) {
      setPosted([])
      setApplications([])
      setJobById({})
      setLoading(false)
      return
    }
    setLoading(true)

    const [{ data: postedRows }, { data: appRows }] = await Promise.all([
      supabase.from('job_listings').select('*').eq('posted_by', user.id).order('created_at', { ascending: false }),
      supabase.from('job_applications').select('*').eq('creative_id', user.id).order('created_at', { ascending: false }),
    ])

    setPosted(Array.isArray(postedRows) ? postedRows : [])
    const apps = Array.isArray(appRows) ? appRows : []
    setApplications(apps)

    const ids = [...new Set(apps.map((a) => a.job_id).filter(Boolean))]
    if (ids.length) {
      const { data: jobs } = await supabase.from('job_listings').select('*').in('id', ids)
      const map = {}
      ;(jobs || []).forEach((j) => {
        map[j.id] = j
      })
      setJobById(map)
    } else {
      setJobById({})
    }

    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, load])

  const sectionTitle = {
    ...TYPO.heading,
    margin: '0 0 14px',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    ...font,
  }

  const cardStyle = {
    ...GLASS_CARD,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    ...font,
  }

  return (
    <section
      style={{
        background: 'transparent',
        minHeight: '100%',
        padding: '28px 28px 48px',
        color: PAGE.text,
        boxSizing: 'border-box',
        ...font,
      }}
    >
      <Link
        to="/dashboard"
        style={{ display: 'inline-block', marginBottom: 16, fontSize: 13, color: PAGE.sub, textDecoration: 'none', fontWeight: 600 }}
      >
        ← Back
      </Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
        <h1 style={{ ...TYPO.heading, margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>Jobs</h1>
        <Link
          to="/dashboard/job-board"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 16px',
            borderRadius: 8,
            background: PAGE.pink,
            color: '#000',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Job board
        </Link>
      </div>
      <p style={{ margin: '0 0 28px', color: PAGE.muted, fontSize: 14, maxWidth: 560 }}>
        Jobs you&apos;ve posted and jobs you&apos;ve applied for.
      </p>

      {loading ? (
        <p style={{ color: PAGE.muted, margin: 0 }}>Loading…</p>
      ) : (
        <>
          <section style={{ marginBottom: 36 }}>
            <h2 style={sectionTitle}>Jobs you&apos;ve posted</h2>
            {!posted.length ? (
              <div style={{ ...cardStyle, color: PAGE.muted, marginBottom: 0 }}>You haven&apos;t posted any jobs yet.</div>
            ) : (
              posted.map((job) => (
                <div key={job.id} style={cardStyle}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 8 }}>{job.title}</div>
                  {job.budget_range ? (
                    <div style={{ fontSize: 14, fontWeight: 700, color: PAGE.pink, marginBottom: 6 }}>{formatJobBudget(job.budget_range)}</div>
                  ) : null}
                  <div style={{ fontSize: 12, color: PAGE.sub, marginBottom: 4 }}>
                    Status: <span style={{ color: '#ccc' }}>{job.status || '—'}</span>
                    {job.location ? ` · ${job.location}` : ''}
                  </div>
                  {job.job_date ? (
                    <div style={{ fontSize: 12, color: PAGE.sub }}>Job date: {new Date(job.job_date).toLocaleDateString('en-AU')}</div>
                  ) : null}
                </div>
              ))
            )}
          </section>

          <section>
            <h2 style={sectionTitle}>Jobs you&apos;ve applied for</h2>
            {!applications.length ? (
              <div style={{ ...cardStyle, color: PAGE.muted, marginBottom: 0 }}>No applications yet. Browse the job board to apply.</div>
            ) : (
              applications.map((app) => {
                const job = jobById[app.job_id]
                return (
                  <div key={app.id} style={cardStyle}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 8 }}>
                      {job?.title || 'Job listing'}
                    </div>
                    {app.quoted_budget ? (
                      <div style={{ ...TYPO.stat, fontSize: 14, fontWeight: 700, color: PAGE.pink, marginBottom: 6 }}>Your quote: {formatJobBudget(app.quoted_budget)}</div>
                    ) : job?.budget_range ? (
                      <div style={{ fontSize: 12, color: PAGE.sub, marginBottom: 6 }}>
                        Listing budget: {formatJobBudget(job.budget_range)}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 12, color: PAGE.sub, marginBottom: 8 }}>
                      Applied {app.created_at ? new Date(app.created_at).toLocaleDateString('en-AU') : '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#bbb', lineHeight: 1.5, marginBottom: 10 }}>{app.message}</div>
                    <Link to="/dashboard/job-board" style={{ fontSize: 13, color: PAGE.pink, fontWeight: 600 }}>
                      Open job board →
                    </Link>
                  </div>
                )
              })
            )}
          </section>
        </>
      )}
    </section>
  )
}
