import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { creativeSenderDisplayName } from '../../lib/creativeDisplayName'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import { acceptJobApplication, declineJobApplication, isApplicationPending } from '../../lib/posterJobApplicationActions'
import TileField from '../../components/ui/TileField'
import { moderateText, MODERATION_BLOCKED_USER_MESSAGE } from '../../lib/moderateContent'

const GREEN = '#1DB954'
const GREEN_DARK = '#04120a'
const PINK = '#FF2D78'
const AMBER = '#f59e0b'

const CATEGORIES = ['Photographer', 'Videographer', 'Drone Pilot', 'Video Editor', 'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator']
const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

function jobListingState(job) {
  if (job?.state && String(job.state).trim()) return String(job.state).trim().toUpperCase()
  const loc = (job?.location || '').toUpperCase()
  for (const code of AU_STATES) { if (loc.includes(code)) return code }
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

// Light-mode fallback for the public /jobs page (rendered outside DashboardLayout, where --lt-* are undefined).
const PUBLIC_TOKEN_SCOPE = `
  .ltjb-public-scope {
    --lt-text: #14111a; --lt-muted: #55535f; --lt-faint: #86848f;
    --lt-glass-bg: linear-gradient(125deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.34) 42%, rgba(255,255,255,0.2) 100%);
    --lt-glass-border: 1px solid rgba(255,255,255,0.78);
    --lt-glass-shadow: 0 18px 50px -16px rgba(31,38,90,0.26), inset 0 1px 1px rgba(255,255,255,0.95);
    --lt-glass-blur: blur(12px) saturate(180%) brightness(1.05);
    --lt-modal-bg: linear-gradient(125deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.8) 100%);
    --lt-modal-border: 1px solid rgba(255,255,255,0.9);
    --lt-modal-shadow: 0 40px 100px -30px rgba(31,38,90,0.4), inset 0 1px 1px rgba(255,255,255,0.95);
    --lt-modal-blur: blur(30px) saturate(180%) brightness(1.04);
    --lt-surface: rgba(20,17,26,0.05); --lt-surface-2: rgba(20,17,26,0.07); --lt-border: rgba(20,17,26,0.12);
    --lt-input-bg: rgba(255,255,255,0.72); --lt-input-border: rgba(20,17,26,0.16); --lt-hairline: rgba(20,17,26,0.09);
  }
`

function StyleBlock() {
  return (
    <style>{`
      ${PUBLIC_TOKEN_SCOPE}
      .ltjb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 9px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; white-space: nowrap; transition: filter .15s ease, background .15s ease, opacity .15s ease; }
      .ltjb-btn-primary { background: ${GREEN}; color: ${GREEN_DARK}; }
      .ltjb-btn-primary:hover { filter: brightness(1.06); }
      .ltjb-btn-primary:disabled { opacity: .5; cursor: default; }
      .ltjb-btn-ghost { background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-border); }
      .ltjb-btn-ghost:hover { background: var(--lt-surface-2); }
      .ltjb-chip { padding: 7px 15px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); }
      .ltjb-chip.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltjb-cat { padding: 6px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--lt-border); background: var(--lt-input-bg); color: var(--lt-muted); transition: all .12s ease; }
      .ltjb-cat.on { border-color: ${GREEN}; background: rgba(29,185,84,0.14); color: ${GREEN}; }
      .ltjb-select { padding: 9px 14px; border-radius: 10px; font-size: 13.5px; font-family: inherit; outline: none; background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-input-border); }
      .ltjb-select:focus { border-color: ${GREEN}; }
      .ltjb-input, .ltjb-textarea { width: 100%; padding: 10px 12px; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; background: var(--lt-input-bg); color: var(--lt-text); border: 1px solid var(--lt-input-border); box-sizing: border-box; }
      .ltjb-textarea { min-height: 100px; resize: vertical; line-height: 1.6; }
      .ltjb-input:focus, .ltjb-textarea:focus { border-color: ${GREEN}; }
      .ltjb-input::placeholder, .ltjb-textarea::placeholder { color: var(--lt-faint); }
      .ltjb-jobcard { cursor: pointer; transition: border-color .15s ease, transform .15s ease; }
      .ltjb-jobcard:hover { transform: translateY(-2px); }
      .ltjb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .ltjb-modal { width: 100%; background: var(--lt-modal-bg); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); border: var(--lt-modal-border); border-radius: 18px; box-shadow: var(--lt-modal-shadow); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column; }
      .ltjb-mhead { padding: 16px 20px; border-bottom: 1px solid var(--lt-hairline); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
      .ltjb-mbody { padding: 22px; overflow-y: auto; }
      @media (max-width: 900px) { .ltjb-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      @media (max-width: 767px) {
        .ltjb-grid { grid-template-columns: 1fr !important; }
        .ltjb-row2 { grid-template-columns: 1fr !important; }
        .ltjb-overlay { padding: 16px; }
        .ltjb-page button { min-height: 40px; }
      }
    `}</style>
  )
}

function Pill({ children, color = 'var(--lt-muted)', bg = 'var(--lt-surface-2)' }) {
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color, background: bg, whiteSpace: 'nowrap' }}>{children}</span>
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--lt-text)' }}>{value}</div>
    </div>
  )
}

export default function JobBoardPage() {
  const { user, profile, clientAccount } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const location = useLocation()
  const isPublic = location.pathname === '/jobs'

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
  const [jobPostModerationError, setJobPostModerationError] = useState('')
  const [jobApplyModerationError, setJobApplyModerationError] = useState('')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)

  const [form, setForm] = useState({ title: '', description: '', creative_types: [], location: '', job_date: '', budget: '' })

  useEffect(() => {
    void loadJobs()
    if (user) { void loadMyApplications(); void loadMyPostedJobs() }
  }, [user])
  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function acceptApplication(app, job) {
    await acceptJobApplication({ app, job, user, profile, clientAccount, showToast, reloadPostedJobs: loadMyPostedJobs, reloadBrowseJobs: loadJobs })
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
    if (!user) { setMyApplications([]); return }
    const { data } = await supabase
      .from('job_applications')
      .select('*, job_listings(title, location, budget_range)')
      .eq('creative_id', user.id)
      .order('created_at', { ascending: false })
    setMyApplications(data ?? [])
  }

  async function loadMyPostedJobs() {
    if (!user) { setMyPostedJobs([]); return }
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
    setJobApplyModerationError('')
    const applyText = [applyForm.description, applyForm.includes].filter(Boolean).join('\n')
    const applyMod = await moderateText(applyText)
    if (applyMod?.blocked) { setJobApplyModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
    if (applyMod?.flagged) console.warn('[moderation] Flagged job application text', applyMod.reason)
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
    const creativeLabel = creativeSenderDisplayName(profile, user)

    const { error } = await supabase.from('job_applications').insert({
      job_id: applyingJob.id,
      creative_id: user.id,
      creative_name: creativeLabel,
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
              fromName: creativeLabel,
              subject: `New application for your job: ${jobListing?.title ?? applyingJob.title}`,
              messageBody: `${creativeLabel} has applied for your job "${jobListing?.title ?? applyingJob.title}".\n\nOffer: AUD ${applyForm.price}\nWhat's included: ${applyForm.includes || '—'}\n\nCover message: ${applyForm.description}\n\nLog in to LensTrybe to view all applications.`,
              threadSubject: 'Job Application',
            },
          })
        } catch { /* non-blocking */ }
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
    setJobPostModerationError('')
    if (!user?.id) { setJobPostModerationError('Your session expired — please sign in again to post.'); return }
    const jobText = [form.title, form.description, form.location, form.budget].filter(Boolean).join('\n')
    const jobMod = await moderateText(jobText)
    if (jobMod?.blocked) { setJobPostModerationError(MODERATION_BLOCKED_USER_MESSAGE); return }
    if (jobMod?.flagged) console.warn('[moderation] Flagged job listing text', jobMod.reason)
    setSaving(true)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error: postError } = await supabase.from('job_listings').insert({
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
    if (postError) { setJobPostModerationError('Could not post job: ' + postError.message); setSaving(false); return }
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
        : [...prev.creative_types, cat],
    }))
  }

  const filtered = jobs.filter(j => !categoryFilter || (j.creative_types ?? []).includes(categoryFilter))

  const stats = useMemo(() => ({
    active: jobs.length,
    applications: myApplications.length,
    posted: myPostedJobs.length,
  }), [jobs, myApplications, myPostedJobs])

  const GLASS = { background: 'var(--lt-glass-bg)', border: 'var(--lt-glass-border)', boxShadow: 'var(--lt-glass-shadow)', backdropFilter: 'var(--lt-glass-blur)', WebkitBackdropFilter: 'var(--lt-glass-blur)' }
  const card = { ...GLASS, borderRadius: 18 }
  const stat = { ...GLASS, flex: '1 1 150px', borderRadius: 16, padding: '16px 18px' }
  const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--lt-muted)', display: 'block', marginBottom: 6 }

  const content = (
    <>
      <StyleBlock />
      <div className="ltjb-page" style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowX: 'hidden' }}>
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : PINK, color: toast.type === 'success' ? GREEN_DARK : '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>{toast.msg}</div>
        )}
        {applyToast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9998, background: applyToast.startsWith('Failed') ? PINK : GREEN, color: applyToast.startsWith('Failed') ? '#fff' : GREEN_DARK, padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>{applyToast}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: isPublic ? 'clamp(28px, 3.4vw, 44px)' : (isMobile ? 24 : 27), fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--lt-text)' }}>Job board</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--lt-muted)' }}>Browse and apply for jobs posted by clients looking for creatives.</p>
          </div>
          <button type="button" className="ltjb-btn ltjb-btn-primary" onClick={() => user ? setShowPost(true) : navigate('/join/client')}>+ Post a job</button>
        </div>

        {!isPublic && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{stats.active}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Active jobs</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{stats.applications}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>My applications</div></div>
            <div style={stat}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lt-text)' }}>{stats.posted}</div><div style={{ fontSize: 12.5, color: 'var(--lt-muted)', marginTop: 2 }}>Jobs I posted</div></div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'browse', label: 'Browse jobs' },
            { key: 'my-applications', label: `My applications (${myApplications.length})` },
            { key: 'my-posted', label: 'My posted jobs' },
          ].map(t => (
            <button key={t.key} type="button" className={`ltjb-chip${activeTab === t.key ? ' on' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {activeTab === 'browse' && (
          <div>
            <select className="ltjb-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {activeTab === 'browse' ? (
          loading ? (
            <div style={{ ...card, padding: '56px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>Loading jobs…</div>
          ) : filtered.length === 0 ? (
            <div style={{ ...card, padding: '56px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>No active jobs right now. Check back soon.</div>
          ) : (
            <div className="ltjb-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {filtered.map(job => {
                const applied = myApplications.some(a => a.job_id === job.id)
                const days = daysLeft(job.expires_at)
                return (
                  <div key={job.id} className="ltjb-jobcard" style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={() => setSelected(job)}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--lt-text)' }}>{job.title}</div>
                    {job.description && <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{job.description}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {(job.creative_types ?? []).map(c => <Pill key={c}>{c}</Pill>)}
                      {applied && <Pill color={GREEN} bg="rgba(29,185,84,0.14)">Applied</Pill>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: 'var(--lt-faint)' }}>{job.location || 'Location flexible'}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: days <= 5 ? AMBER : 'var(--lt-faint)' }}>{days > 0 ? `${days}d left` : 'Expired'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : activeTab === 'my-applications' ? (
          myApplications.length === 0 ? (
            <div style={{ ...card, padding: '56px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>You haven't applied to any jobs yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myApplications.map(app => (
                <div key={app.id} style={{ ...card, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{app.job_listings?.title ?? 'Job'}</div>
                      <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 4 }}>{app.job_listings?.location ?? '—'} · Applied {new Date(app.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>AUD {Number(app.price ?? 0).toFixed(2)}</div>
                  </div>
                  {app.includes && <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: 8 }}><strong style={{ color: 'var(--lt-text)' }}>Includes:</strong> {app.includes}</div>}
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'my-posted' ? (
          myPostedJobs.length === 0 ? (
            <div style={{ ...card, padding: '56px 24px', textAlign: 'center', color: 'var(--lt-muted)', fontSize: 14 }}>You haven't posted any jobs yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myPostedJobs.map(job => (
                <div key={job.id} style={{ ...card, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12 }} onClick={() => setExpandedPostedJob(expandedPostedJob === job.id ? null : job.id)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{job.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 4 }}>{job.location}{job.budget_range ? ` · ${job.budget_range}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <Pill color={GREEN} bg="rgba(29,185,84,0.14)">{job.job_applications?.length ?? 0} application{job.job_applications?.length !== 1 ? 's' : ''}</Pill>
                      <span style={{ color: 'var(--lt-muted)', fontSize: 13 }}>{expandedPostedJob === job.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expandedPostedJob === job.id && (
                    <div style={{ borderTop: '1px solid var(--lt-hairline)', padding: '16px 20px' }}>
                      {!job.job_applications?.length ? (
                        <div style={{ fontSize: 13, color: 'var(--lt-muted)', padding: '8px 0' }}>No applications yet.</div>
                      ) : (
                        job.job_applications.map(app => (
                          <div key={app.id} style={{ padding: 16, background: 'var(--lt-surface-2)', border: '1px solid var(--lt-hairline)', borderRadius: 12, marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lt-text)' }}>{app.creative_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 2 }}>Applied {new Date(app.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>AUD {Number(app.price ?? 0).toFixed(2)}</div>
                            </div>
                            {app.includes && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>What's included</div>
                                <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.5 }}>{app.includes}</div>
                              </div>
                            )}
                            {app.description && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Cover message</div>
                                <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.5 }}>{app.description}</div>
                              </div>
                            )}
                            {isApplicationPending(app) && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lt-hairline)' }}>
                                <button type="button" className="ltjb-btn ltjb-btn-primary" onClick={e => { e.stopPropagation(); void acceptApplication(app, job) }}>✓ Accept</button>
                                <button type="button" className="ltjb-btn ltjb-btn-ghost" style={{ color: PINK, borderColor: 'rgba(255,45,120,0.4)' }} onClick={e => { e.stopPropagation(); void declineApplication(app) }}>Decline</button>
                              </div>
                            )}
                            {app.status === 'accepted' && <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(29,185,84,0.14)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: GREEN }}>✓ Accepted: message thread created</div>}
                            {app.status === 'declined' && <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,45,120,0.1)', border: '1px solid rgba(255,45,120,0.22)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: PINK }}>Declined</div>}
                            {app.status === 'closed' && <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--lt-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--lt-muted)' }}>Position filled</div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>

      {/* View job modal */}
      {selected && (
        <div className="ltjb-overlay" onClick={() => setSelected(null)}>
          <div className="ltjb-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="ltjb-mhead">
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>{selected.title}</span>
              <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltjb-mbody" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="ltjb-row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Location" value={selected.location || 'Flexible'} />
                <Field label="Date" value={selected.job_date ? new Date(selected.job_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Flexible'} />
                {selected.budget_range && <Field label="Budget" value={selected.budget_range} />}
                <Field label="Expires" value={`${daysLeft(selected.expires_at)} days left`} />
              </div>
              {selected.description && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--lt-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.7, padding: '14px 16px', background: 'var(--lt-surface-2)', border: '1px solid var(--lt-border)', borderRadius: 12 }}>{selected.description}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(selected.creative_types ?? []).map(c => <Pill key={c}>{c}</Pill>)}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="ltjb-btn ltjb-btn-ghost" onClick={() => setSelected(null)}>Close</button>
                {myApplications.some(a => a.job_id === selected.id) ? (
                  <Pill color={GREEN} bg="rgba(29,185,84,0.14)">Already applied</Pill>
                ) : !user ? (
                  <button type="button" className="ltjb-btn ltjb-btn-primary" onClick={() => navigate('/join/client')}>Apply</button>
                ) : tier === 'basic' ? (
                  <button type="button" className="ltjb-btn ltjb-btn-primary" onClick={() => setApplyUpgradeModal('pricing')}>Upgrade to apply</button>
                ) : tier === 'pro' && !jobIsInCreativeState(selected, profile) ? (
                  <button type="button" className="ltjb-btn ltjb-btn-primary" onClick={() => setApplyUpgradeModal('interstate')}>Upgrade to apply for this job</button>
                ) : (
                  <button type="button" className="ltjb-btn ltjb-btn-primary" onClick={() => { setApplyingJob(selected); setShowApplyModal(true) }}>Apply</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      {applyUpgradeModal && (
        <div className="ltjb-overlay" onClick={() => setApplyUpgradeModal(null)}>
          <div className="ltjb-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="ltjb-mhead">
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>{applyUpgradeModal === 'pricing' ? 'Upgrade to apply' : 'Apply across Australia'}</span>
              <button type="button" onClick={() => setApplyUpgradeModal(null)} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltjb-mbody">
              <p style={{ fontSize: 14, color: 'var(--lt-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
                {applyUpgradeModal === 'pricing'
                  ? 'Job applications are available on Pro and above. Upgrade your plan to start applying.'
                  : 'This job is outside your state. Upgrade to Expert or Elite to apply for jobs across Australia.'}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ltjb-btn ltjb-btn-ghost" onClick={() => setApplyUpgradeModal(null)}>Close</button>
                <button type="button" className="ltjb-btn ltjb-btn-primary" onClick={() => { setApplyUpgradeModal(null); setSelected(null); navigate('/pricing') }}>View pricing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply modal */}
      {showApplyModal && applyingJob && (
        <div className="ltjb-overlay" onClick={() => { setShowApplyModal(false); setApplyingJob(null); setJobApplyModerationError('') }}>
          <div className="ltjb-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="ltjb-mhead">
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Apply for this job</div>
                <div style={{ fontSize: 13, color: 'var(--lt-faint)', marginTop: 2 }}>{applyingJob.title}</div>
              </div>
              <button type="button" onClick={() => { setShowApplyModal(false); setApplyingJob(null); setJobApplyModerationError('') }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltjb-mbody" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Your price (AUD) *</label>
                <input className="ltjb-input" type="number" value={applyForm.price} onChange={e => setApplyForm(p => ({ ...p, price: e.target.value }))} placeholder="e.g. 850" />
              </div>
              <div>
                <label style={labelStyle}>What's included in your price *</label>
                <textarea className="ltjb-textarea" style={{ minHeight: 80 }} value={applyForm.includes} onChange={e => { setJobApplyModerationError(''); setApplyForm(p => ({ ...p, includes: e.target.value })) }} placeholder="e.g. 4 hours on-site, 50 edited photos delivered within 7 days, 1 round of revisions" />
              </div>
              <div>
                <label style={labelStyle}>Cover message *</label>
                <textarea className="ltjb-textarea" value={applyForm.description} onChange={e => { setJobApplyModerationError(''); setApplyForm(p => ({ ...p, description: e.target.value })) }} placeholder="Introduce yourself and explain why you're the right creative for this job" />
              </div>
              {jobApplyModerationError && <div style={{ fontSize: 13, color: PINK }}>{jobApplyModerationError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ltjb-btn ltjb-btn-ghost" onClick={() => { setShowApplyModal(false); setApplyingJob(null); setJobApplyModerationError('') }}>Cancel</button>
                <button type="button" className="ltjb-btn ltjb-btn-primary" disabled={submittingApply || !applyForm.price || !applyForm.description} onClick={() => void submitApplication()}>{submittingApply ? 'Submitting…' : 'Submit application'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post job modal */}
      {showPost && (
        <div className="ltjb-overlay" onClick={() => { setShowPost(false); resetForm(); setJobPostModerationError('') }}>
          <div className="ltjb-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="ltjb-mhead">
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--lt-text)' }}>Post a job</span>
              <button type="button" onClick={() => { setShowPost(false); resetForm(); setJobPostModerationError('') }} style={{ background: 'none', border: 'none', color: 'var(--lt-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div className="ltjb-mbody" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Job title</label>
                <input className="ltjb-input" placeholder="Wedding photographer needed, Brisbane" value={form.title} onChange={e => { setJobPostModerationError(''); setForm(p => ({ ...p, title: e.target.value })) }} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea className="ltjb-textarea" placeholder="Describe the job, what you need, any requirements" value={form.description} onChange={e => { setJobPostModerationError(''); setForm(p => ({ ...p, description: e.target.value })) }} />
              </div>
              {jobPostModerationError && <div style={{ fontSize: 13, color: PINK }}>{jobPostModerationError}</div>}
              <div>
                <label style={labelStyle}>Creative types needed</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(cat => (
                    <button type="button" key={cat} className={`ltjb-cat${form.creative_types.includes(cat) ? ' on' : ''}`} onClick={() => toggleCategory(cat)}>{cat}</button>
                  ))}
                </div>
              </div>
              <div className="ltjb-row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Location</label>
                  <input className="ltjb-input" placeholder="Brisbane, QLD" value={form.location} onChange={e => { setJobPostModerationError(''); setForm(p => ({ ...p, location: e.target.value })) }} />
                </div>
                <div>
                  <label style={labelStyle}>Date needed</label>
                  <input className="ltjb-input" type="date" value={form.job_date} onChange={e => setForm(p => ({ ...p, job_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Budget (AUD)</label>
                <input className="ltjb-input" placeholder="e.g. $500–$2,000 or negotiable" value={form.budget} onChange={e => { setJobPostModerationError(''); setForm(p => ({ ...p, budget: e.target.value })) }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="ltjb-btn ltjb-btn-ghost" onClick={() => { setShowPost(false); resetForm(); setJobPostModerationError('') }}>Cancel</button>
                <button type="button" className="ltjb-btn ltjb-btn-primary" disabled={saving || !form.title || !form.description} onClick={() => void postJob()}>{saving ? 'Posting…' : 'Post job'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (isPublic) {
    return (
      <div className="ltjb-public-scope" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', padding: '24px 0 80px' }}>
        <TileField animated={false} opacity={0.22} />
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 1, background: 'linear-gradient(180deg, rgba(246,245,243,0.92) 0%, rgba(246,245,243,0.5) 55%, rgba(246,245,243,0) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '0 40px', width: '100%', boxSizing: 'border-box' }}>
          {content}
        </div>
      </div>
    )
  }

  return content
}
