import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('subscription')
  const [showCancel, setShowCancel] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [cancelStep, setCancelStep] = useState(1)
  const [deleteStep, setDeleteStep] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [exitReason, setExitReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  const tierColors = { basic: 'var(--text-muted)', pro: 'var(--green)', expert: 'var(--silver)', elite: '#EAB308' }
  const tierColor = tierColors[tier] ?? 'var(--text-muted)'

  const EXIT_REASONS = [
    'Too expensive',
    'Not getting enough enquiries',
    'Missing a feature I need',
    'Using a different platform',
    'Temporary break — I will be back',
    'Other',
  ]

  async function openBillingPortal() {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-portal', {
        body: {
          userId: user.id,
          email: user.email,
          name: profile?.business_name ?? user.email,
          returnUrl: 'https://app.lenstrybe.com/dashboard/settings',
        },
      })
      console.log('Portal response:', data, error)
      if (data?.url) {
        window.location.href = data.url
      } else {
        alert('Error: ' + (data?.error ?? JSON.stringify(data) ?? error?.message ?? 'Unknown'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function cancelSubscription() {
    setLoading(true)
    await supabase.functions.invoke('cancel-subscription', {
      body: { userId: user.id, reason: exitReason }
    })
    setShowCancel(false)
    setCancelStep(1)
    setLoading(false)
    navigate('/dashboard')
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setLoading(true)
    await supabase.functions.invoke('delete-account', {
      body: { userId: user.id }
    })
    await supabase.auth.signOut()
    navigate('/')
    setLoading(false)
  }

  async function updateEmail() {
    if (!newEmail || !newEmail.includes('@')) { setEmailMsg({ text: 'Please enter a valid email.', error: true }); return }
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      setEmailMsg({ text: error.message, error: true })
    } else {
      setEmailMsg({ text: 'Confirmation sent to your new email address. Click the link to confirm the change.', error: false })
      setNewEmail('')
    }
    setEmailLoading(false)
  }

  const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: '32px' },
    title: { fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 400 },
    subtitle: { fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    tabs: { display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', width: 'fit-content' },
    tab: (active) => ({ padding: '8px 20px', border: 'none', background: active ? 'var(--bg-overlay)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all var(--transition-fast)', fontWeight: active ? 500 : 400 }),
    card: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' },
    sectionSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' },
    tierCard: { background: 'var(--bg-overlay)', border: `1px solid ${tierColor}`, borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
    tierName: { fontFamily: 'var(--font-display)', fontSize: '28px', color: tierColor, fontWeight: 400 },
    tierSub: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginTop: '4px' },
    dangerCard: { background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-xl)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
    dangerTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--error)', fontFamily: 'var(--font-ui)' },
    dangerText: { fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
    stepTitle: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-primary)', fontWeight: 400 },
    stepText: { fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.7 },
    reasonOption: (selected) => ({ padding: '12px 16px', borderRadius: 'var(--radius-lg)', border: `1px solid ${selected ? 'var(--green)' : 'var(--border-default)'}`, background: selected ? 'var(--green-dim)' : 'var(--bg-subtle)', cursor: 'pointer', fontSize: '13px', color: selected ? 'var(--green)' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)', transition: 'all var(--transition-fast)' }),
    modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    featureList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    featureItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' },
  }

  const tierFeatures = {
    basic: ['Public profile', '5 portfolio photos', '5 message replies/month'],
    pro: ['20 portfolio photos', '20 message replies', 'Invoicing & quotes', 'Booking system'],
    expert: ['40 portfolio photos', 'Unlimited messages', 'Contracts', 'CRM', 'Brand kit', 'Deliver 50GB', 'Insights'],
    elite: ['Unlimited everything', 'Team members', 'Studio profile', 'Elite spotlight', 'Deliver 200GB'],
  }

  return (
    <div style={styles.page}>
      <div>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Manage your subscription, password and account.</p>
      </div>

      <div style={styles.tabs}>
        {['subscription', 'password', 'danger'].map(t => (
          <button key={t} style={styles.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t === 'danger' ? 'Danger Zone' : (t === 'password' ? 'Email & Password' : t.charAt(0).toUpperCase() + t.slice(1))}
          </button>
        ))}
      </div>

      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.tierCard}>
            <div>
              <div style={styles.tierName}>{tier.charAt(0).toUpperCase() + tier.slice(1)} Plan</div>
              <div style={styles.tierSub}>
                {tier === 'basic' ? 'Free forever' : 'Billed monthly or annually'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {tier !== 'elite' && (
                <Button variant="primary" size="sm" onClick={() => navigate('/pricing')}>Upgrade Plan</Button>
              )}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>What's included in your plan</div>
            <div style={styles.featureList}>
              {(tierFeatures[tier] ?? []).map((f, i) => (
                <div key={i} style={styles.featureItem}>
                  <span style={{ color: 'var(--green)', fontSize: '12px' }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            {tier !== 'elite' && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/pricing')}>
                See full feature comparison →
              </Button>
            )}
          </div>

          {tier !== 'basic' && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.sectionTitle}>Billing</div>
                  <div style={styles.sectionSub}>Manage your payment method, invoices and billing details.</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void openBillingPortal()}
                    style={{ padding: '9px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-ui)', opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? 'Loading…' : 'Manage Billing'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/settings/subscription')}
                    style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                  >
                    Change Plan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'password' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Update Email</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>A confirmation link will be sent to your new email address.</div>
            {emailMsg && (
              <div style={{ fontSize: '13px', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: emailMsg.error ? 'rgba(239,68,68,0.1)' : 'rgba(29,185,84,0.1)', color: emailMsg.error ? '#ef4444' : '#1DB954' }}>
                {emailMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="New email address"
                type="email"
                style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none' }}
              />
              <button
                onClick={updateEmail}
                disabled={emailLoading}
                style={{ padding: '9px 18px', background: '#1DB954', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', opacity: emailLoading ? 0.6 : 1 }}
              >
                {emailLoading ? 'Sending…' : 'Update Email'}
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Change Password</div>
            <div style={styles.sectionSub}>Send a password reset link to your email address.</div>
            <div style={styles.row}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                {user?.email}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await supabase.auth.resetPasswordForEmail(user.email)
                  alert('Password reset email sent. Check your inbox.')
                }}
              >
                Send Reset Email
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tier !== 'basic' && (
            <div style={styles.dangerCard}>
              <div style={styles.dangerTitle}>Cancel Subscription</div>
              <div style={styles.dangerText}>
                Cancel your subscription and downgrade to Basic. You keep access until the end of your current billing period.
              </div>
              <div>
                <Button variant="secondary" size="sm" onClick={() => { setShowCancel(true); setCancelStep(1) }}>
                  Cancel Subscription
                </Button>
              </div>
            </div>
          )}

          <div style={styles.dangerCard}>
            <div style={styles.dangerTitle}>Delete Account</div>
            <div style={styles.dangerText}>
              Permanently delete your account. Your profile is removed from search immediately. All data is deleted after 30 days. This cannot be undone.
            </div>
            <div>
              <Button variant="danger" size="sm" onClick={() => { setShowDelete(true); setDeleteStep(1) }}>
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      <Modal isOpen={showCancel} onClose={() => { setShowCancel(false); setCancelStep(1) }} title="Cancel Subscription" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {cancelStep === 1 && (
            <>
              <div style={styles.stepTitle}>What you'll lose</div>
              <div style={styles.featureList}>
                {(tierFeatures[tier] ?? []).map((f, i) => (
                  <div key={i} style={{ ...styles.featureItem, color: 'var(--error)' }}>
                    <span style={{ color: 'var(--error)', fontSize: '12px' }}>✗</span>
                    {f}
                  </div>
                ))}
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowCancel(false)}>Keep My Plan</Button>
                <Button variant="secondary" onClick={() => setCancelStep(2)}>Continue to Cancel →</Button>
              </div>
            </>
          )}
          {cancelStep === 2 && (
            <>
              <div style={styles.stepTitle}>Downgrade to Basic instead?</div>
              <div style={styles.stepText}>
                Basic is free and keeps your profile live. You lose business tools but stay discoverable to clients.
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setCancelStep(3)}>No, cancel my subscription</Button>
                <Button variant="primary" onClick={async () => {
                  await supabase.from('profiles').update({ subscription_tier: 'basic' }).eq('id', user.id)
                  setShowCancel(false)
                }}>Downgrade to Basic</Button>
              </div>
            </>
          )}
          {cancelStep === 3 && (
            <>
              <div style={styles.stepTitle}>Why are you leaving?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {EXIT_REASONS.map(r => (
                  <div key={r} style={styles.reasonOption(exitReason === r)} onClick={() => setExitReason(r)}>{r}</div>
                ))}
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowCancel(false)}>Keep My Plan</Button>
                <Button variant="danger" disabled={loading} onClick={cancelSubscription}>
                  {loading ? 'Cancelling…' : 'Confirm Cancellation'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDelete} onClose={() => { setShowDelete(false); setDeleteStep(1); setDeleteConfirm('') }} title="Delete Account" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {deleteStep === 1 && (
            <>
              <div style={styles.stepTitle}>Are you sure?</div>
              <div style={styles.stepText}>
                Deleting your account will immediately remove your profile from search results. All your data — portfolio, invoices, messages, reviews — will be permanently deleted after 30 days. You have a 30-day window to reactivate.
              </div>
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
                <Button variant="danger" onClick={() => setDeleteStep(2)}>I understand, continue →</Button>
              </div>
            </>
          )}
          {deleteStep === 2 && (
            <>
              <div style={styles.stepTitle}>Type DELETE to confirm</div>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
              />
              <div style={styles.modalActions}>
                <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
                <Button variant="danger" disabled={deleteConfirm !== 'DELETE' || loading} onClick={deleteAccount}>
                  {loading ? 'Deleting…' : 'Delete My Account'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
