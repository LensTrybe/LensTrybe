import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { acceptJobApplication, declineJobApplication, isApplicationPending } from '../../lib/posterJobApplicationActions'
import { GLASS_CARD, GLASS_CARD_GREEN, GLASS_MODAL_PANEL, GLASS_MODAL_OVERLAY_BASE, GLASS_NATIVE_FIELD, DIVIDER_GRADIENT_STYLE, TYPO, glassCardAccentBorder } from '../../lib/glassTokens'

const CATEGORIES = ['Photographer', 'Videographer', 'Drone Pilot', 'Video Editor', 'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator']

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

function jobListingState(job) {
  if (job?.state && String(job.state).trim()) {
    return String(job.state).trim().toUpperCase()
  }
  const loc = (job?.location || '').toUpperCase()
  for (const code of AU_STATES) {
    if (loc.includes(code)) return code
  }
  return null
}

function profileState(profile) {
  const s = profile?.state
  if (!s || !String(s).trim()) return null
  return String(s).trim().toUpperCase()
}

function jobIsInCreativeState(job, profile) {
  const js = jobListingState(job)
  const ps = profileState(profile)
  if (!ps) return true
  if (!js) return true
  return js === ps
}

function daysLeft(expiresAt) {
  return Math.ceil((new Date(expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function JobBoardPage() {
  const { user, profile, clientAccount } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [myApplications, setMyApplications] = useState([])
  const [myPostedJobs, setMyPostedJobs] = useState([])
  const [expandedPostedJob, setExpandedPostedJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('browse')
  const [selected, setSelected] = useState(null)
  const [showPost, setShowPost] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyingJob, setApplyingJob] = useState(null)
  const [applyForm, setApplyForm] = useState({ price: '', description: '', includes: '' })
  const [submittingApply, setSubmittingApply] = useState(false)
  const [applyToast, setApplyToast] = useState(null)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [applyUpgradeModal, setApplyUpgradeModal] = useState(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    creative_types: [],
    location: '',
    job_date: '',
    budget: '',
  })

  useEffect(() => {
    void loadJobs()
    if (user) {
      void loadMyApplications()
      void loadMyPostedJobs()
    }
  }, [user])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function acceptApplication(app, job) {
    await acceptJobApplication({
      app,
      job,
      user,
      profile,
      clientAccount,
      showToast,
      reloadPostedJobs: loadMyPostedJobs,
      reloadBrowseJobs: loadJobs,
    })
  }

  async function declineApplication(app) {
    await declineJobApplication({ app, showToast, reloadPostedJobs: loadMyPostedJobs })
  }

  async function loadJobs() {
    const { data } = await supabase.from('job_listings').select('*').eq('status', 'active').order('created_at', { ascending: false })
    const raw = data ?? []
    const posterIds = [...new Set(raw.map((j) => j.posted_by).filter(Boolean))]
    let adminPosterIds = new Set()
    if (posterIds.length > 0) {
      const { data: adminRows } = await supabase.from('profiles').select('id').in('id', posterIds).eq('is_admin', true)
      adminPosterIds = new Set((adminRows ?? []).map((r) => r.id))
    }
    setJobs(raw.filter((j) => !adminPosterIds.has(j.posted_by)))
    setLoading(false)
  }

  async function loadMyApplications() {
    if (!user) {
      setMyApplications([])
      return
    }
    const { data } = await supabase
      .from('job_applications')
      .select('*, job_listings(title, location, budget_range)')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setMyApplications(data ?? [])
  }

  async function loadMyPostedJobs() {
    if (!user) {
      setMyPostedJobs([])
      return
    }
    const { data } = await supabase
      .from('job_listings')
      .select('*, job_applications(*)')
      .eq('posted_by', user.id)
      .order('created_at', { ascending: false })
    setMyPostedJobs(data ?? [])
  }

  function resetForm() {
    setForm({ title: '', description: '', creative_types: [], location: '', job_date: '', budget: '' })
  }

  async function submitApplication() {
    if (!user || !applyingJob) return
    if (tier === 'basic') return
    if (tier === 'pro' && !jobIsInCreativeState(applyingJob, profile)) return
    if (!applyForm.price || !applyForm.description) return
    setSubmittingApply(true)

    const { data: jobListing } = await supabase
      .from('job_listings')
      .select('title, posted_by, poster_email, poster_name')
      .eq('id', applyingJob.id)
      .maybeSingle()

    let posterProfile = null
    let posterClient = null
    if (jobListing?.posted_by) {
      const [profRes, clientRes] = await Promise.all([
        supabase.from('profiles').select('business_email, business_name, full_name').eq('id', jobListing.posted_by).eq('is_admin', false).maybeSingle(),
        supabase.from('client_accounts').select('email, first_name, last_name').eq('id', jobListing.posted_by).maybeSingle(),
      ])
      posterProfile = profRes.data
      posterClient = clientRes.data
    }

    const clientDisplayName = posterClient
      ? `${[posterClient.first_name, posterClient.last_name].filter(Boolean).join(' ')}`.trim() || posterClient.email
      : null

    const posterEmail = jobListing?.poster_email ?? posterProfile?.business_email ?? posterClient?.email ?? null
    const posterName = jobListing?.poster_name ?? posterProfile?.business_name ?? posterProfile?.full_name ?? clientDisplayName ?? 'there'

    const { error } = await supabase.from('job_applications').insert({
      job_id: applyingJob.id,
      creative_id: user.id,
      creative_name: profile?.business_name ?? user.email,
      price: parseFloat(applyForm.price),
      description: applyForm.description,
      includes: applyForm.includes || null,
      message: applyForm.description,
      status: 'pending',
    })

    if (!error) {
      if (posterEmail) {
        try {
          await supabase.functions.invoke('send-message-notification', {
            body: {
              to: posterEmail,
              toName: posterName,
              fromName: profile?.business_name ?? user.email,
              subject: `New application for your job: ${jobListing?.title ?? applyingJob.title}`,
              messageBody: `${profile?.business_name ?? user.email} has applied for your job "${jobListing?.title ?? applyingJob.title}".\n\nOffer: AUD ${applyForm.price}\nWhat's included: ${applyForm.includes || '—'}\n\nCover message: ${applyForm.description}\n\nLog in to LensTrybe to view all applications.`,
              threadSubject: 'Job Application',
            },
          })
        } catch {
          /* non-blocking */
        }
      }
      await loadMyApplications()
      setShowApplyModal(false)
      setApplyingJob(null)
      setApplyForm({ price: '', description: '', includes: '' })
      setApplyToast('Application submitted!')
      setTimeout(() => setApplyToast(null), 3000)
    } else {
      setApplyToast('Failed: ' + error.message)
      setTimeout(() => setApplyToast(null), 3000)
    }
    setSubmittingApply(false)
  }

  async function postJob() {
    setSaving(true)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('job_listings').insert({
      posted_by: user.id,
      title: form.title,
      description: form.description,
      creative_types: form.creative_types,
      location: form.location,
      job_date: form.job_date || null,
      budget_range: form.budget || null,
      status: 'active',
      expires_at: expiresAt,
      poster_email: profile?.business_email ?? user?.email ?? null,
      poster_name: profile?.business_name ?? profile?.full_name ?? user?.email ?? null,
    })
    await loadJobs()
    await loadMyPostedJobs()
    setShowPost(false)
    resetForm()
    setSaving(false)
  }

  function toggleCategory(cat) {
    setForm(prev => ({
      ...prev,
      creative_types: prev.creative_types.includes(cat)
        ? prev.creative_types.filter(c => c !== cat)
        : [...prev.creative_types, cat]
    }))
  }

  const filtered = jobs.filter(j =>
    !categoryFilter || (j.creative_types ?? []).includes(categoryFilter)
  )

  const styles = {
    page: { background: 'transparent', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto', padding: '0 40px', width: '100%', boxSizing: 'border-box' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { ...TYPO.heading, fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { ...TYPO.body, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
    tabs: { display: 'flex', ...GLASS_CARD, borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400 }),
    select: { ...GLASS_NATIVE_FIELD, borderRadius: 'var(--radius-lg)', padding: '8px 14px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
    jobCard: { ...GLASS_CARD, borderRadius: 'var(--radius-xl)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', cursor: 'pointer', transition: 'border-color var(--transition-fast)', minHeight: 'unset' },
    jobTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    jobDesc: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    jobMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
    jobFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' },
    jobLocation: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    jobExpiry: (days) => ({ fontSize: '11px', color: days <= 5 ? 'var(--warning)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)' }),
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)', ...GLASS_CARD, borderRadius: 'var(--radius-xl)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    label: { ...TYPO.label, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' },
    textarea: { ...GLASS_NATIVE_FIELD, width: '100%', minHeight: '100px', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    categoryWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    categoryChip: (sel) => ({ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `1px solid ${sel ? 'var(--green)' : 'var(--border-default)'}`, background: sel ? 'var(--green-dim)' : 'transparent', color: sel ? 'var(--green)' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', transition: 'all var(--transition-base)', fontFamily: 'var(--font-ui)' }),
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    descBox: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, padding: '14px 16px', ...GLASS_CARD, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' },
  }

  return (
    <div style={styles.page}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: toast.type === 'success' ? '#1DB954' : '#ef4444', color: toast.type === 'success' ? '#000' : '#fff', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}
      {applyToast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9998, background: applyToast.startsWith('Failed') ? '#ef4444' : '#1DB954', color: applyToast.startsWith('Failed') ? '#fff' : '#000', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
          {applyToast}
        </div>
      )}

      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Job Board</h1>
          <p style={styles.subtitle}>Browse and apply for jobs posted by clients looking for creatives.</p>
        </div>
        <Button variant="secondary" onClick={() => user ? setShowPost(true) : navigate('/join/client')}>+ Post a Job</Button>
      </div>

      <div style={{ display: 'flex', gap: '4px', ...GLASS_CARD, padding: '4px', borderRadius: '10px', marginBottom: '20px', width: 'fit-content', flexWrap: 'wrap' }}>
        {['browse', 'my-applications', 'my-posted'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            style={{ padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: activeTab === t ? 'var(--bg-base)' : 'transparent', color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}
          >
            {t === 'browse' ? 'Browse Jobs' : t === 'my-applications' ? `My Applications (${myApplications.length})` : 'My Posted Jobs'}
          </button>
        ))}
      </div>

      <div style={styles.toolbar}>
        {activeTab === 'browse' && (
          <select style={styles.select} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {activeTab === 'browse' ? (
        loading ? (
          <div style={styles.emptyState}>Loading jobs…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>No active jobs right now. Check back soon.</div>
        ) : (
          <div style={styles.grid}>
            {filtered.map(job => {
              const applied = myApplications.some(a => a.job_id === job.id)
              const days = daysLeft(job.expires_at)
              return (
                <div
                  key={job.id}
                  style={styles.jobCard}
                  onClick={() => setSelected(job)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                >
                  <div style={styles.jobTitle}>{job.title}</div>
                  {job.description && <div style={styles.jobDesc}>{job.description}</div>}
                  <div style={styles.jobMeta}>
                    {(job.creative_types ?? []).map(c => <Badge key={c} variant="default" size="sm">{c}</Badge>)}
                    {applied && <Badge variant="green" size="sm">Applied</Badge>}
                  </div>
                  <div style={styles.jobFooter}>
                    <div style={styles.jobLocation}>{job.location || 'Location flexible'}</div>
                    <div style={styles.jobExpiry(days)}>{days > 0 ? `${days}d left` : 'Expired'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : activeTab === 'my-applications' ? (
        <div>
          {myApplications.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>You haven&apos;t applied to any jobs yet.</div>
          ) : (
            myApplications.map(app => (
              <div key={app.id} style={{ ...GLASS_CARD, borderRadius: '12px', padding: '16px 20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{app.job_listings?.title ?? 'Job'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{app.job_listings?.location ?? '—'} · Applied {new Date(app.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1DB954' }}>AUD {Number(app.price ?? 0).toFixed(2)}</div>
                </div>
                {app.includes && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}><strong>Includes:</strong> {app.includes}</div>}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'my-posted' ? (
        <div>
          {myPostedJobs.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>You haven&apos;t posted any jobs yet.</div>
          ) : (
            myPostedJobs.map(job => (
              <div key={job.id} style={{ ...GLASS_CARD, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
                <div
                  style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedPostedJob(expandedPostedJob === job.id ? null : job.id)}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{job.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{job.location} · {job.budget_range}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ padding: '4px 12px', ...GLASS_CARD_GREEN, borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: '#1DB954' }}>
                      {job.job_applications?.length ?? 0} application{job.job_applications?.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>{expandedPostedJob === job.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expandedPostedJob === job.id && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
                    {!job.job_applications?.length ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0' }}>No applications yet.</div>
                    ) : (
                      job.job_applications.map(app => (
                        <div key={app.id} style={{ padding: '16px', ...GLASS_CARD, borderRadius: '10px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{app.creative_name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Applied {new Date(app.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1DB954' }}>AUD {Number(app.price ?? 0).toFixed(2)}</div>
                          </div>
                          {app.includes && (
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>What&apos;s included</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{app.includes}</div>
                            </div>
                          )}
                          {app.description && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Cover message</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{app.description}</div>
                            </div>
                          )}
                          {isApplicationPending(app) && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); void acceptApplication(app, job) }}
                                style={{ padding: '8px 20px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                              >
                                ✓ Accept
                              </button>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); void declineApplication(app) }}
                                style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {app.status === 'accepted' && (
                            <div style={{ marginTop: '12px', padding: '8px 12px', ...GLASS_CARD_GREEN, borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#1DB954' }}>
                              ✓ Accepted — message thread created
                            </div>
                          )}
                          {app.status === 'declined' && (
                            <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>
                              Declined
                            </div>
                          )}
                          {app.status === 'closed' && (
                            <div style={{ marginTop: '12px', padding: '8px 12px', ...GLASS_CARD, borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                              Position filled
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected.title} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={styles.viewGrid}>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Location</div>
                <div style={styles.viewValue}>{selected.location || 'Flexible'}</div>
              </div>
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Date</div>
                <div style={styles.viewValue}>{selected.job_date ? new Date(selected.job_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Flexible'}</div>
              </div>
              {selected.budget_range && (
                <div style={styles.viewField}>
                  <div style={styles.viewLabel}>Budget</div>
                  <div style={styles.viewValue}>{selected.budget_range}</div>
                </div>
              )}
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Expires</div>
                <div style={styles.viewValue}>{daysLeft(selected.expires_at)} days left</div>
              </div>
            </div>

            {selected.description && (
              <div style={styles.viewField}>
                <div style={styles.viewLabel}>Description</div>
                <div style={styles.descBox}>{selected.description}</div>
              </div>
            )}

            <div style={styles.jobMeta}>
              {(selected.creative_types ?? []).map(c => <Badge key={c} variant="default">{c}</Badge>)}
            </div>

            <div style={styles.modalActions}>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
              {myApplications.some(a => a.job_id === selected.id) ? (
                <Badge variant="green">Already Applied</Badge>
              ) : !user ? (
                <Button variant="primary" onClick={() => navigate('/join/client')}>Apply</Button>
              ) : tier === 'basic' ? (
                <Button variant="primary" onClick={() => setApplyUpgradeModal('pricing')}>
                  Upgrade to Apply
                </Button>
              ) : tier === 'pro' && !jobIsInCreativeState(selected, profile) ? (
                <Button variant="primary" onClick={() => setApplyUpgradeModal('interstate')}>
                  Upgrade to Apply for This Job
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setApplyingJob(selected); setShowApplyModal(true) }}
                  style={{ padding: '8px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                >
                  Apply
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={!!applyUpgradeModal}
        onClose={() => setApplyUpgradeModal(null)}
        title={applyUpgradeModal === 'pricing' ? 'Upgrade to apply' : 'Apply across Australia'}
        size="sm"
      >
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, margin: 0 }}>
          {applyUpgradeModal === 'pricing'
            ? 'Job applications are available on Pro and above. Upgrade your plan to start applying.'
            : 'This job is outside your state. Upgrade to Expert or Elite to apply for jobs across Australia.'}
        </p>
        <div style={{ ...styles.modalActions, marginTop: '20px' }}>
          <Button variant="ghost" onClick={() => setApplyUpgradeModal(null)}>Close</Button>
          <Button variant="primary" onClick={() => { setApplyUpgradeModal(null); setSelected(null); navigate('/pricing') }}>
            View pricing
          </Button>
        </div>
      </Modal>

      {showApplyModal && applyingJob && (
        <div style={{ position: 'fixed', inset: 0, ...GLASS_MODAL_OVERLAY_BASE, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ ...GLASS_MODAL_PANEL, borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Apply for this job</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>{applyingJob.title}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Your Price (AUD) *</label>
                <input
                  type="number"
                  value={applyForm.price}
                  onChange={e => setApplyForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="e.g. 850"
                  style={{ ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>What&apos;s included in your price *</label>
                <textarea
                  value={applyForm.includes}
                  onChange={e => setApplyForm(p => ({ ...p, includes: e.target.value }))}
                  placeholder="e.g. 4 hours on-site, 50 edited photos delivered within 7 days, 1 round of revisions..."
                  style={{ ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: '8px', minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Cover message *</label>
                <textarea
                  value={applyForm.description}
                  onChange={e => setApplyForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Introduce yourself and explain why you're the right creative for this job..."
                  style={{ ...GLASS_NATIVE_FIELD, width: '100%', padding: '10px 12px', borderRadius: '8px', minHeight: '100px', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="button" onClick={() => { setShowApplyModal(false); setApplyingJob(null) }} style={{ padding: '9px 18px', ...GLASS_CARD, borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>Cancel</button>
              <button
                type="button"
                onClick={() => void submitApplication()}
                disabled={submittingApply || !applyForm.price || !applyForm.description}
                style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: submittingApply || !applyForm.price || !applyForm.description ? 0.5 : 1 }}
              >
                {submittingApply ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={showPost} onClose={() => { setShowPost(false); resetForm() }} title="Post a Job" size="lg">
        <div style={styles.formSection}>
          <Input label="Job title" placeholder="Wedding Photographer needed — Brisbane" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <div>
            <label style={styles.label}>Description</label>
            <textarea style={styles.textarea} placeholder="Describe the job, what you need, any requirements…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label style={styles.label}>Creative types needed</label>
            <div style={styles.categoryWrap}>
              {CATEGORIES.map(cat => (
                <div key={cat} style={styles.categoryChip(form.creative_types.includes(cat))} onClick={() => toggleCategory(cat)}>{cat}</div>
              ))}
            </div>
          </div>
          <div style={styles.formRow}>
            <Input label="Location" placeholder="Brisbane, QLD" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            <Input label="Date needed" type="date" value={form.job_date} onChange={e => setForm(p => ({ ...p, job_date: e.target.value }))} />
          </div>
          <Input label="Budget (AUD)" placeholder="e.g. $500–$2,000 or negotiable" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
          <div style={styles.modalActions}>
            <Button variant="ghost" onClick={() => { setShowPost(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" disabled={saving || !form.title || !form.description} onClick={postJob}>
              {saving ? 'Posting…' : 'Post Job'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
