import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'
import DeleteAccountModal from '../../components/account/DeleteAccountModal'
import DownloadDataCard from '../../components/account/DownloadDataCard'
import NewsletterPreferenceCard from '../../components/account/NewsletterPreferenceCard'

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'
const RED = '#ef4444'
const SUB_PAGE = '/dashboard/settings/subscription'
const LIVE = ['active', 'trialing', 'past_due']

const TIER_COLOR = { basic: '#8a8a9a', pro: '#1DB954', expert: '#a855f7', elite: '#EAB308' }
const TIER_FEATURES = {
  basic: ['Public profile & listing', '5 portfolio photos', '5 message replies / month', 'Browse gear marketplace', 'Basic search placement'],
  pro: ['Everything in Basic', '20 photos + 1 video', '20 message replies / month', 'Bookings & scheduling', 'Quotes & invoicing', 'Review requests', 'Marketplace listings (5)', 'Pro badge on profile'],
  expert: ['Everything in Pro', '40 photos + 5 videos', 'Unlimited messages', 'Contracts & e-signatures', 'CRM (500 records)', 'Client portals', 'Brand kit', 'Portfolio website', 'LensTrybe Deliver (50GB)', 'Business insights'],
  elite: ['Everything in Expert', 'Unlimited photos & videos', 'Team (up to 5 members)', 'CRM (unlimited)', 'LensTrybe Deliver (200GB)', 'Multi-page website + custom domain', 'Elite spotlight', 'Studio profile page'],
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' }
}
function maskEmail(email) {
  const raw = String(email || '').trim()
  const at = raw.indexOf('@')
  if (at <= 0) return raw
  const local = raw.slice(0, at)
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}${raw.slice(at)}`
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12,
  background: 'var(--lt-input-bg)', border: '1px solid var(--lt-input-border)', color: 'var(--lt-text)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
}

function Modal({ open, onClose, title, children, busy }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])
  if (!open) return null
  return (
    <div className="ltset-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="ltset-modal" role="dialog" aria-modal="true">
        <div className="ltset-modal-head">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--lt-text)' }}>{title}</h2>
          <button type="button" className="ltset-x" onClick={() => !busy && onClose()} aria-label="Close">✕</button>
        </div>
        <div className="ltset-modal-body">{children}</div>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'subscription', label: 'Subscription' },
  { key: 'password', label: 'Email & Password' },
  { key: 'data', label: 'Your Data' },
  { key: 'danger', label: 'Danger Zone' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const { tier: ctxTier } = useSubscription()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('subscription')
  const [sub, setSub] = useState(null)
  const [toast, setToast] = useState(null)

  const [showCancel, setShowCancel] = useState(false)
  const [cancelStep, setCancelStep] = useState(1)
  const [exitReason, setExitReason] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)

  const [showDelete, setShowDelete] = useState(false)

  const [currentEmailInput, setCurrentEmailInput] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  // Access tier comes from profiles.subscription_tier (same source as the sidebar
  // and feature gating). The subscriptions row only describes billing.
  const tier = String(ctxTier || 'basic').toLowerCase()
  const tierColor = TIER_COLOR[tier] ?? '#8a8a9a'

  const loadSub = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('subscriptions')
      .select('tier, billing, status, current_period_end, next_charge_date, pending_tier, pending_billing')
      .eq('user_id', user.id).eq('provider', 'revolut').maybeSingle()
    setSub(data)
  }, [user?.id])
  useEffect(() => { loadSub() }, [loadSub])

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  async function updateEmail() {
    if (String(currentEmailInput || '').trim().toLowerCase() !== String(user?.email || '').trim().toLowerCase()) {
      setEmailMsg({ text: "That doesn't match your current email address.", error: true }); return
    }
    if (!newEmail || !newEmail.includes('@')) { setEmailMsg({ text: 'Please enter a valid email.', error: true }); return }
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) setEmailMsg({ text: error.message, error: true })
    else { setEmailMsg({ text: 'We have sent a confirmation link to both your current and new email addresses. Click both links to finish the change.', error: false }); setCurrentEmailInput(''); setNewEmail('') }
    setEmailLoading(false)
  }

  async function cancelSubscription() {
    setCancelBusy(true)
    const { data, error } = await supabase.functions.invoke('cancel-revolut-subscription')
    setCancelBusy(false)
    if (error || !data?.ok) { showToast('Could not cancel: ' + (error?.message ?? 'Unknown error'), 'error'); return }
    setShowCancel(false); setCancelStep(1)
    const until = data.accessUntil ? fmtDate(data.accessUntil) : 'the end of your billing period'
    showToast(`Subscription cancelled. You keep access until ${until}.`)
    setTimeout(() => loadSub(), 600)
  }

  async function afterDeleted() {
    setShowDelete(false)
    try { await supabase.auth.signOut() } catch { /* session already revoked server-side */ }
    navigate('/', { replace: true })
  }

  const EXIT_REASONS = ['Too expensive', 'Not getting enough enquiries', 'Missing a feature I need', 'Using a different platform', 'Temporary break: I will be back', 'Other']
  const hasLiveSub = !!(sub && LIVE.includes(sub.status))
  const billedTier = hasLiveSub ? String(sub.tier || 'basic').toLowerCase() : null
  // Access above what is billed (admin comp, founding, team seat) is complimentary.
  const isComp = tier !== 'basic' && tier !== (billedTier || 'basic') && sub?.status !== 'canceled'
  const cancelTier = billedTier || tier
  const billedWord = sub?.billing === 'annual' ? 'annually' : 'monthly'

  return (
    <div className="ltset-page">
      <style>{`
        .ltset-page { display: flex; flex-direction: column; gap: 22px; }
        .ltset-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; transition: transform .12s ease, opacity .12s ease; white-space: nowrap; }
        .ltset-btn:hover { transform: translateY(-1px); }
        .ltset-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
        .ltset-btn-primary { background: ${GREEN}; color: ${GREEN_TEXT}; }
        .ltset-btn-ghost { background: var(--lt-surface); color: var(--lt-text); border-color: var(--lt-border); }
        .ltset-btn-danger { background: ${RED}; color: #fff; }
        .ltset-card { background: var(--lt-glass-bg); border: var(--lt-glass-border); box-shadow: var(--lt-glass-shadow); backdrop-filter: var(--lt-glass-blur); -webkit-backdrop-filter: var(--lt-glass-blur); border-radius: 18px; }
        .ltset-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--lt-surface); border: 1px solid var(--lt-border); width: fit-content; flex-wrap: wrap; }
        .ltset-tab { padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: var(--lt-muted); font-family: inherit; }
        .ltset-tab.on { background: ${GREEN}; color: ${GREEN_TEXT}; }
        .ltset-h { font-size: 15px; font-weight: 800; color: var(--lt-text); }
        .ltset-sub { font-size: 13px; color: var(--lt-muted); line-height: 1.5; }
        .ltset-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(6,6,12,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ltset-modal { width: 100%; max-width: 460px; max-height: 88vh; overflow-y: auto; border-radius: 20px; background: var(--lt-modal-bg); border: var(--lt-modal-border); box-shadow: var(--lt-modal-shadow); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); }
        .ltset-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px 0; }
        .ltset-modal-body { padding: 14px 22px 22px; display: flex; flex-direction: column; gap: 16px; }
        .ltset-x { background: var(--lt-surface); border: 1px solid var(--lt-border); color: var(--lt-muted); width: 30px; height: 30px; border-radius: 9px; cursor: pointer; font-size: 13px; }
        @media (max-width: 767px) { .ltset-btn { min-height: 44px; } }
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : RED, color: toast.type === 'success' ? GREEN_TEXT : '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, maxWidth: 360, boxShadow: '0 12px 30px -12px rgba(0,0,0,0.4)' }}>{toast.msg}</div>
      )}

      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>Settings</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--lt-muted)' }}>Manage your subscription, account and preferences.</p>
      </div>

      <div className="ltset-tabs">
        {TABS.map((tb) => (
          <button key={tb.key} type="button" className={`ltset-tab${activeTab === tb.key ? ' on' : ''}`} onClick={() => setActiveTab(tb.key)}>{tb.label}</button>
        ))}
      </div>

      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="ltset-card" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderLeft: `3px solid ${tierColor}` }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: tierColor, letterSpacing: '-0.01em' }}>{cap(tier)} Plan</div>
              <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: 4 }}>
                {tier === 'basic'
                  ? 'Free forever'
                  : isComp
                    ? (billedTier && billedTier !== 'basic' ? `Complimentary access · billed as ${cap(billedTier)} ${billedWord}` : 'Complimentary access')
                    : `Billed ${billedWord}`}
                {hasLiveSub && sub?.status === 'trialing' && sub?.next_charge_date ? ` · free trial until ${fmtDate(sub.next_charge_date)}` : ''}
                {hasLiveSub && sub?.status === 'active' && sub?.current_period_end && !sub?.pending_tier ? ` · renews ${fmtDate(sub.current_period_end)}` : ''}
                {sub?.pending_tier ? ` · changes to ${cap(sub.pending_tier)} on ${fmtDate(sub.current_period_end)}` : ''}
                {sub?.status === 'canceled' && sub?.current_period_end ? ` · cancelled, access until ${fmtDate(sub.current_period_end)}` : ''}
              </div>
            </div>
            <button type="button" className="ltset-btn ltset-btn-primary" onClick={() => navigate(SUB_PAGE)}>{tier === 'basic' ? 'Upgrade plan' : 'Change plan'}</button>
          </div>

          <div className="ltset-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ltset-h">What's included in your {cap(tier)} plan</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px 20px' }}>
              {(TIER_FEATURES[tier] ?? []).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: 'var(--lt-muted)', lineHeight: 1.4 }}>
                  <span style={{ color: GREEN, flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
            </div>
            <div>
              <button type="button" className="ltset-btn ltset-btn-ghost" onClick={() => navigate(SUB_PAGE)}>Compare all plans</button>
            </div>
          </div>

          {tier !== 'basic' && (
            <div className="ltset-card" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="ltset-h">Billing</div>
                <div className="ltset-sub" style={{ marginTop: 4 }}>Manage your plan, payment method and invoices.</div>
              </div>
              <button type="button" className="ltset-btn ltset-btn-ghost" onClick={() => navigate(SUB_PAGE)}>Manage billing</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'password' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 620 }}>
          <div className="ltset-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="ltset-h">Update email</div>
              <div className="ltset-sub" style={{ marginTop: 4 }}>For security, we send a confirmation link to both your current and new email addresses.</div>
            </div>
            {emailMsg && (
              <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 10, background: emailMsg.error ? 'rgba(239,68,68,0.12)' : 'rgba(29,185,84,0.12)', color: emailMsg.error ? RED : GREEN, lineHeight: 1.5 }}>{emailMsg.text}</div>
            )}
            <input style={inputStyle} type="email" placeholder="Current email" value={currentEmailInput} onChange={(e) => setCurrentEmailInput(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 180 }} type="email" placeholder="New email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <button type="button" className="ltset-btn ltset-btn-primary" onClick={updateEmail} disabled={emailLoading}>{emailLoading ? 'Sending…' : 'Update email'}</button>
            </div>
          </div>
          <div className="ltset-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="ltset-h">Change password</div>
              <div className="ltset-sub" style={{ marginTop: 4 }}>Send a password reset link to your email address.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, color: 'var(--lt-muted)' }}>{maskEmail(user?.email)}</div>
              <button type="button" className="ltset-btn ltset-btn-ghost" onClick={async () => { await supabase.auth.resetPasswordForEmail(user.email); showToast('Password reset email sent. Check your inbox.') }}>Send reset email</button>
            </div>
          </div>
          <NewsletterPreferenceCard />
        </div>
      )}

      {activeTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
          <DownloadDataCard kind="creative" />
          <div className="ltset-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ltset-h">Documents as PDFs</div>
            <div className="ltset-sub">Branded PDF copies of individual invoices, quotes and contracts can be downloaded from the Invoicing, Quotes and Contracts pages.</div>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasLiveSub && (
            <div className="ltset-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, border: `1px solid ${RED}44` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: RED }}>Cancel subscription</div>
              <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6 }}>Cancel your subscription and move to the free Basic plan. You keep {cap(cancelTier)} access until the end of your current billing period.{isComp ? ` Your complimentary ${cap(tier)} access is not affected.` : ''} Part periods aren't refunded, except that annual plans can be refunded in full within 14 days of your first annual payment (see our <a href="/refunds" target="_blank" rel="noreferrer" style={{ color: GREEN, fontWeight: 700 }}>Refund Policy</a>). This doesn't affect your rights under the Australian Consumer Law.</div>
              <div><button type="button" className="ltset-btn ltset-btn-ghost" onClick={() => { setShowCancel(true); setCancelStep(1) }}>Cancel subscription</button></div>
            </div>
          )}
          <div className="ltset-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, border: `1px solid ${RED}44` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: RED }}>Delete account</div>
            <div style={{ fontSize: 13, color: 'var(--lt-muted)', lineHeight: 1.6 }}>Permanently delete your account. Your profile is hidden from search straight away and any paid plan is cancelled. Everything (portfolio, clients, invoices, messages, files and reviews) is permanently deleted after 30 days. You can reactivate any time within those 30 days by signing in. We'll email you a code to confirm it's you.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="ltset-btn ltset-btn-danger" onClick={() => setShowDelete(true)}>Delete account</button>
              <button type="button" className="ltset-btn ltset-btn-ghost" onClick={() => setActiveTab('data')}>Download my data first</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={showCancel} onClose={() => { setShowCancel(false); setCancelStep(1) }} title="Cancel subscription" busy={cancelBusy}>
        {cancelStep === 1 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--lt-text)', fontWeight: 700 }}>What you'll lose on {cap(cancelTier)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(TIER_FEATURES[cancelTier] ?? []).filter((f) => !f.startsWith('Everything in')).map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: 'var(--lt-muted)' }}><span style={{ color: RED }}>✕</span>{f}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="ltset-btn ltset-btn-ghost" onClick={() => setShowCancel(false)}>Keep my plan</button>
              <button type="button" className="ltset-btn ltset-btn-ghost" onClick={() => setCancelStep(2)}>Continue</button>
            </div>
          </>
        )}
        {cancelStep === 2 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.6 }}>Basic keeps your profile live and discoverable for free. You'd lose the business tools but stay on LensTrybe. Cancelling moves you to Basic at the end of your current period.</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)', marginTop: 4 }}>Why are you leaving? (optional)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EXIT_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setExitReason(r)} style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, border: `1px solid ${exitReason === r ? GREEN : 'var(--lt-border)'}`, background: exitReason === r ? 'rgba(29,185,84,0.12)' : 'var(--lt-surface)', color: exitReason === r ? GREEN : 'var(--lt-text)' }}>{r}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="ltset-btn ltset-btn-ghost" onClick={() => setShowCancel(false)} disabled={cancelBusy}>Keep my plan</button>
              <button type="button" className="ltset-btn ltset-btn-danger" onClick={cancelSubscription} disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}</button>
            </div>
          </>
        )}
      </Modal>

      <DeleteAccountModal open={showDelete} onClose={() => setShowDelete(false)} kind="creative" onDeleted={afterDeleted} />
    </div>
  )
}
