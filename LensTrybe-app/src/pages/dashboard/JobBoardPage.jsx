import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'

const CATEGORIES = ['Photographer', 'Videographer', 'Drone Pilot', 'Video Editor', 'Photo Editor', 'Social Media Manager', 'Hair & Makeup Artist', 'UGC Creator']

function daysLeft(expiresAt) {
  return Math.ceil((new Date(expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function JobBoardPage() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [myApplications, setMyApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('browse')
  const [selected, setSelected] = useState(null)
  const [showPost, setShowPost] = useState(false)
  const [applying, setApplying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const canApply = tier !== 'basic'

  const [form, setForm] = useState({
    title: '',
    description: '',
    creative_types: [],
    location: '',
    job_date: '',
    budget: '',
  })

  useEffect(() => { loadJobs() }, [user])

  async function loadJobs() {
    const [jobsRes, appsRes] = await Promise.all([
      supabase.from('job_listings').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      user
        ? supabase.from('job_applications').select('job_id').eq('creative_id', user.id)
        : Promise.resolve({ data: [] }),
    ])
    setJobs(jobsRes.data ?? [])
    setMyApplications(appsRes.data?.map(a => a.job_id) ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ title: '', description: '', creative_types: [], location: '', job_date: '', budget: '' })
  }

  async function applyToJob(jobId) {
    if (!canApply) return
    setApplying(true)
    await supabase.from('job_applications').insert({
      job_id: jobId,
      creative_id: user.id,
    })
    setMyApplications(prev => [...prev, jobId])
    setApplying(false)
    setSelected(null)
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
    })
    await loadJobs()
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
    page: { display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto', padding: '0 40px', width: '100%', boxSizing: 'border-box' },
    pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
    tabs: { display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400 }),
    select: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '8px 14px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' },
    jobCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', cursor: 'pointer', transition: 'border-color var(--transition-fast)', minHeight: 'unset' },
    jobTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    jobDesc: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    jobMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
    jobFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' },
    jobLocation: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    jobExpiry: (days) => ({ fontSize: '11px', color: days <= 5 ? 'var(--warning)' : 'var(--text-muted)', fontFamily: 'var(--font-ui)' }),
    emptyState: { padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'var(--font-ui)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)' },
    formSection: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    label: { fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', display: 'block', marginBottom: '6px' },
    textarea: { width: '100%', minHeight: '100px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' },
    categoryWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    categoryChip: (sel) => ({ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `1px solid ${sel ? 'var(--green)' : 'var(--border-default)'}`, background: sel ? 'var(--green-dim)' : 'transparent', color: sel ? 'var(--green)' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', transition: 'all var(--transition-base)', fontFamily: 'var(--font-ui)' }),
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    viewField: { display: 'flex', flexDirection: 'column', gap: '4px' },
    viewLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    viewValue: { fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    descBox: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7, padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' },
    upgradeNote: { padding: '14px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Job Board</h1>
          <p style={styles.subtitle}>Browse and apply for jobs posted by clients looking for creatives.</p>
        </div>
        <Button variant="secondary" onClick={() => user ? setShowPost(true) : navigate('/join/client')}>+ Post a Job</Button>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.tabs}>
          <button style={styles.tab(tab === 'browse')} onClick={() => setTab('browse')}>Browse Jobs ({filtered.length})</button>
          <button style={styles.tab(tab === 'applied')} onClick={() => setTab('applied')}>Applied ({myApplications.length})</button>
        </div>
        {tab === 'browse' && (
          <select style={styles.select} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {tab === 'browse' ? (
        loading ? (
          <div style={styles.emptyState}>Loading jobs…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>No active jobs right now. Check back soon.</div>
        ) : (
          <div style={styles.grid}>
            {filtered.map(job => {
              const applied = myApplications.includes(job.id)
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
      ) : (
        <div style={styles.grid}>
          {jobs.filter(j => myApplications.includes(j.id)).length === 0 ? (
            <div style={{ ...styles.emptyState, gridColumn: '1 / -1' }}>You haven't applied to any jobs yet.</div>
          ) : jobs.filter(j => myApplications.includes(j.id)).map(job => (
            <div key={job.id} style={styles.jobCard} onClick={() => setSelected(job)}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            >
              <div style={styles.jobTitle}>{job.title}</div>
              <div style={styles.jobMeta}>
                {(job.creative_types ?? []).map(c => <Badge key={c} variant="default" size="sm">{c}</Badge>)}
                <Badge variant="green" size="sm">Applied</Badge>
              </div>
              <div style={styles.jobLocation}>{job.location || 'Location flexible'}</div>
            </div>
          ))}
        </div>
      )}

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

            {!canApply && (
              <div style={styles.upgradeNote}>
                Upgrade to Pro or above to apply for jobs.
              </div>
            )}

            <div style={styles.modalActions}>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
              {canApply && (
                myApplications.includes(selected.id)
                  ? <Badge variant="green">Already Applied</Badge>
                  : <Button variant="primary" disabled={applying} onClick={() => user ? applyToJob(selected.id) : navigate('/join/client')}>
                    {applying ? 'Applying…' : 'Apply for This Job'}
                  </Button>
              )}
            </div>
          </div>
        </Modal>
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
