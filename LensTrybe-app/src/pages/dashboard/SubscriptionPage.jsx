import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { payWithRevolut } from '../../lib/revolut.js'
import { useAuth } from '../../context/AuthContext'
import { useSubscription } from '../../context/SubscriptionContext'

const GREEN = '#1DB954'
const GREEN_TEXT = '#04120a'

const PLANS = [
  { id: 'basic', name: 'Basic', monthlyPrice: 0, annualPrice: 0, color: '#8a8a9a',
    features: ['Public profile', '5 portfolio photos', '5 message replies/month', 'Gear marketplace access'] },
  { id: 'pro', name: 'Pro', monthlyPrice: 24.99, annualPrice: 249.90, color: GREEN,
    features: ['20 portfolio photos', '1 portfolio video', '20 message replies/month', 'Invoicing & quotes', 'Booking system', 'Review requests'] },
  { id: 'expert', name: 'Expert', monthlyPrice: 74.99, annualPrice: 749.90, color: '#a855f7',
    features: ['40 portfolio photos', '5 portfolio videos', 'Unlimited messages', 'Contracts & CRM', 'Client portal', 'Brand kit', 'LensTrybe Deliver (50GB)', 'Business insights'] },
  { id: 'elite', name: 'Elite', monthlyPrice: 149.99, annualPrice: 1499.90, color: '#EAB308',
    features: ['Unlimited portfolio', 'Unlimited messages', 'Team members (up to 5)', 'LensTrybe Deliver (200GB)', 'Elite spotlight', 'Multi-page portfolio website', 'Everything in Expert'] },
]
const RANK = { basic: 0, pro: 1, expert: 2, elite: 3 }
const LIVE = ['active', 'trialing', 'past_due']

function fmtAUD(minorOrDollars, isMinor) {
  const v = isMinor ? Number(minorOrDollars) / 100 : Number(minorOrDollars)
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v) } catch { return `$${v.toFixed(2)}` }
}
function fmtDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' }
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

function Modal({ open, onClose, title, children, busy }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])
  if (!open) return null
  return (
    <div className="lts-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="lts-modal" role="dialog" aria-modal="true">
        <div className="lts-modal-head">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--lt-text)' }}>{title}</h2>
          <button type="button" className="lts-x" onClick={() => !busy && onClose()} aria-label="Close">✕</button>
        </div>
        <div className="lts-modal-body">{children}</div>
      </div>
    </div>
  )
}

export default function SubscriptionPage() {
  const { user, profile } = useAuth()
  const { tier: ctxTier } = useSubscription()
  const navigate = useNavigate()

  const [sub, setSub] = useState(null)
  const [subLoading, setSubLoading] = useState(true)
  const [billing, setBilling] = useState('monthly')
  const [busyPlan, setBusyPlan] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null) // { plan, preview }
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)

  const loadSub = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('subscriptions')
      .select('tier, billing, status, current_period_end, next_charge_date, pending_tier, pending_billing, founding_member')
      .eq('user_id', user.id)
      .eq('provider', 'revolut')
      .maybeSingle()
    setSub(data)
    if (data && LIVE.includes(data.status) && data.billing) setBilling(data.billing)
    setSubLoading(false)
  }, [user?.id])

  useEffect(() => { loadSub() }, [loadSub])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  const currentTier = (sub && LIVE.includes(sub.status) ? sub.tier : ctxTier) || 'basic'
  const currentBilling = sub?.billing || 'monthly'
  const hasLiveSub = !!(sub && LIVE.includes(sub.status))
  const founding = !!sub?.founding_member

  async function onSelect(plan) {
    if (!user?.id || busyPlan) return

    // Cancel → Basic
    if (plan.id === 'basic') {
      if (currentTier === 'basic') return
      setCancelOpen(true)
      return
    }

    // Already exactly on this plan (same tier + same billing): nothing to do,
    // unless a downgrade is scheduled, in which case this undoes it.
    if (plan.id === currentTier && billing === currentBilling && hasLiveSub) {
      if (sub?.pending_tier) {
        setBusyPlan(plan.id)
        const { data, error } = await supabase.functions.invoke('change-subscription', { body: { tier: plan.id, billing } })
        setBusyPlan(null)
        if (error || !data?.ok) showToast('Could not update: ' + (error?.message ?? 'Unknown error'), 'error')
        else { showToast('Scheduled change cancelled. Staying on your current plan.'); loadSub() }
      }
      return
    }

    // No live subscription → first-time subscribe via the card popup (saves card + starts trial).
    if (!hasLiveSub) {
      setBusyPlan(plan.id)
      try {
        const result = await payWithRevolut({ user: { id: user.id, email: user.email }, tier: plan.id, billing, fullName: profile?.business_name ?? user.email })
        if (result === 'success') { showToast('Subscription started!'); setTimeout(() => window.location.reload(), 1200) }
      } catch (e) { showToast('Could not start checkout: ' + (e?.message ?? 'Unknown error'), 'error') }
      setBusyPlan(null)
      return
    }

    // Existing subscriber → preview the change (proration / schedule), then confirm.
    setBusyPlan(plan.id)
    const { data, error } = await supabase.functions.invoke('change-subscription', { body: { tier: plan.id, billing, preview: true } })
    setBusyPlan(null)
    if (error || !data || data.error) { showToast('Could not load change: ' + (error?.message ?? data?.error ?? 'Unknown error'), 'error'); return }
    if (data.change === 'none') { showToast('You are already on this plan.'); return }
    setConfirm({ plan, preview: data })
  }

  async function commitChange() {
    if (!confirm) return
    setConfirmBusy(true)
    const { data, error } = await supabase.functions.invoke('change-subscription', { body: { tier: confirm.plan.id, billing } })
    setConfirmBusy(false)
    if (error || !data?.ok) { showToast('Change failed: ' + (error?.message ?? data?.error ?? 'Unknown error'), 'error'); return }
    setConfirm(null)
    if (data.change === 'upgrade') showToast(data.chargeNow > 0 ? `Upgraded. ${fmtAUD(data.chargeNow, true)} charged today.` : 'Upgraded.')
    else if (data.change === 'downgrade') showToast('Downgrade scheduled for the end of your billing period.')
    setTimeout(() => window.location.reload(), 1300)
  }

  async function doCancel() {
    setCancelBusy(true)
    const { data, error } = await supabase.functions.invoke('cancel-revolut-subscription')
    setCancelBusy(false)
    if (error || !data?.ok) { showToast('Could not cancel: ' + (error?.message ?? 'Unknown error'), 'error'); return }
    setCancelOpen(false)
    const until = data.accessUntil ? fmtDate(data.accessUntil) : 'the end of your billing period'
    showToast(`Subscription cancelled. You keep access until ${until}.`)
    setTimeout(() => loadSub(), 800)
  }

  function planLabel(plan) {
    if (plan.id === currentTier && billing === currentBilling && hasLiveSub) {
      return sub?.pending_tier ? 'Keep this plan' : 'Current plan'
    }
    if (plan.id === 'basic') return currentTier === 'basic' ? 'Current plan' : 'Cancel to Free'
    if (!hasLiveSub) return `Choose ${plan.name}`
    const up = RANK[plan.id] > RANK[currentTier] || (plan.id === currentTier && currentBilling === 'monthly' && billing === 'annual')
    return up ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`
  }
  function planDisabled(plan) {
    return plan.id === currentTier && billing === currentBilling && hasLiveSub && !sub?.pending_tier
  }

  const pendingName = sub?.pending_tier ? cap(sub.pending_tier) : null

  return (
    <div className="lts-page">
      <style>{`
        .lts-page { display: flex; flex-direction: column; gap: 22px; }
        .lts-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; transition: transform .12s ease, opacity .12s ease; white-space: nowrap; }
        .lts-btn:hover { transform: translateY(-1px); }
        .lts-btn:disabled { opacity: .55; cursor: default; transform: none; }
        .lts-btn-primary { background: ${GREEN}; color: ${GREEN_TEXT}; }
        .lts-btn-ghost { background: var(--lt-surface); color: var(--lt-text); border-color: var(--lt-border); }
        .lts-card { background: var(--lt-glass-bg); border: var(--lt-glass-border); box-shadow: var(--lt-glass-shadow); backdrop-filter: var(--lt-glass-blur); -webkit-backdrop-filter: var(--lt-glass-blur); border-radius: 18px; }
        .lts-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: stretch; }
        .lts-toggle { display: inline-flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--lt-surface); border: 1px solid var(--lt-border); width: fit-content; }
        .lts-toggle button { padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: var(--lt-muted); font-family: inherit; }
        .lts-toggle button.on { background: ${GREEN}; color: ${GREEN_TEXT}; }
        .lts-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(6,6,12,0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .lts-modal { width: 100%; max-width: 460px; max-height: 88vh; overflow-y: auto; border-radius: 20px; background: var(--lt-modal-bg); border: var(--lt-modal-border); box-shadow: var(--lt-modal-shadow); backdrop-filter: var(--lt-modal-blur); -webkit-backdrop-filter: var(--lt-modal-blur); }
        .lts-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px 0; }
        .lts-modal-body { padding: 14px 22px 22px; display: flex; flex-direction: column; gap: 16px; }
        .lts-x { background: var(--lt-surface); border: 1px solid var(--lt-border); color: var(--lt-muted); width: 30px; height: 30px; border-radius: 9px; cursor: pointer; font-size: 13px; }
        @media (max-width: 900px) { .lts-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 520px) { .lts-grid { grid-template-columns: 1fr; } }
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: toast.type === 'success' ? GREEN : '#ef4444', color: toast.type === 'success' ? GREEN_TEXT : '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, maxWidth: 360, boxShadow: '0 12px 30px -12px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>Subscription</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, color: 'var(--lt-muted)' }}>Current plan:</span>
          <span style={{ padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, background: 'rgba(29,185,84,0.14)', border: `1px solid ${GREEN}55`, color: GREEN }}>
            {cap(currentTier)}{hasLiveSub && currentTier !== 'basic' ? ` · ${cap(currentBilling)}` : ''}{founding ? ' · Founding' : ''}
          </span>
          {hasLiveSub && sub?.status === 'trialing' && sub?.next_charge_date && (
            <span style={{ fontSize: 12.5, color: 'var(--lt-faint)' }}>Free trial until {fmtDate(sub.next_charge_date)}</span>
          )}
          {hasLiveSub && sub?.status === 'active' && sub?.current_period_end && !sub?.pending_tier && (
            <span style={{ fontSize: 12.5, color: 'var(--lt-faint)' }}>Renews {fmtDate(sub.current_period_end)}</span>
          )}
          {sub?.status === 'canceled' && sub?.current_period_end && (
            <span style={{ fontSize: 12.5, color: 'var(--lt-faint)' }}>Cancelled · access until {fmtDate(sub.current_period_end)}</span>
          )}
        </div>
      </div>

      {sub?.pending_tier && (
        <div className="lts-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13.5, color: 'var(--lt-text)', lineHeight: 1.5 }}>
            Scheduled change: your plan moves to <strong>{pendingName}{sub.pending_billing ? ` (${cap(sub.pending_billing)})` : ''}</strong> on <strong>{fmtDate(sub.pending_change_at || sub.current_period_end)}</strong>. You keep {cap(currentTier)} until then.
          </div>
          <button type="button" className="lts-btn lts-btn-ghost" disabled={busyPlan === currentTier} onClick={() => onSelect(PLANS.find((p) => p.id === currentTier))}>
            {busyPlan === currentTier ? 'Working…' : 'Keep my current plan'}
          </button>
        </div>
      )}

      <div className="lts-toggle">
        {['monthly', 'annual'].map((b) => (
          <button key={b} type="button" className={billing === b ? 'on' : ''} onClick={() => setBilling(b)}>
            {b === 'monthly' ? 'Monthly' : 'Annual'}{b === 'annual' ? ' · 2 months free' : ''}
          </button>
        ))}
      </div>

      <div className="lts-grid">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentTier && billing === currentBilling && hasLiveSub
          const price = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice
          const loading = busyPlan === plan.id
          return (
            <div key={plan.id} className="lts-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', border: isCurrent ? `1.5px solid ${plan.color}` : undefined }}>
              {isCurrent && (
                <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', padding: '3px 14px', background: plan.color, borderRadius: 999, fontSize: 11, fontWeight: 800, color: plan.id === 'pro' || plan.id === 'elite' || plan.id === 'basic' ? '#04120a' : '#fff', whiteSpace: 'nowrap' }}>Current plan</div>
              )}
              <div style={{ minHeight: 96 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: plan.color, marginBottom: 6 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 27, fontWeight: 800, color: 'var(--lt-text)', lineHeight: 1 }}>{price === 0 ? 'Free' : fmtAUD(price)}</span>
                  {price > 0 && <span style={{ fontSize: 13, color: 'var(--lt-muted)' }}>/{billing === 'annual' ? 'yr' : 'mo'}</span>}
                </div>
                {billing === 'annual' && price > 0 && <div style={{ fontSize: 12, color: 'var(--lt-faint)', marginTop: 3 }}>{fmtAUD(price / 12)}/mo equivalent</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--lt-muted)', lineHeight: 1.4 }}>
                    <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button type="button" className={`lts-btn ${plan.id === currentTier && !isCurrent ? 'lts-btn-ghost' : isCurrent ? 'lts-btn-ghost' : 'lts-btn-primary'}`} style={!isCurrent && plan.id !== 'basic' ? { background: plan.color, color: plan.id === 'pro' || plan.id === 'elite' ? '#04120a' : '#fff', borderColor: 'transparent' } : undefined} disabled={planDisabled(plan) || loading} onClick={() => onSelect(plan)}>
                {loading ? 'Working…' : planLabel(plan)}
              </button>
            </div>
          )
        })}
      </div>

      <div className="lts-card" style={{ padding: '16px 18px', fontSize: 12.5, color: 'var(--lt-muted)', lineHeight: 1.7 }}>
        Prices are in AUD. Annual plans are paid upfront. <strong style={{ color: 'var(--lt-text)' }}>Upgrades</strong> take effect immediately and you pay only the prorated difference for the rest of your current period. <strong style={{ color: 'var(--lt-text)' }}>Downgrades</strong> and <strong style={{ color: 'var(--lt-text)' }}>cancellations</strong> take effect at the end of your current billing period, and you keep full access until then. We don't offer refunds for change of mind, and this does not affect your rights under the Australian Consumer Law.
        {' '}
        <button type="button" onClick={() => navigate('/dashboard/settings')} style={{ background: 'none', border: 'none', color: GREEN, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', padding: 0, fontWeight: 700 }}>Back to Settings</button>
      </div>

      {/* Change confirm */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm ? (confirm.preview.change === 'upgrade' ? `Upgrade to ${confirm.plan.name}` : `Downgrade to ${confirm.plan.name}`) : ''} busy={confirmBusy}>
        {confirm && (
          <>
            {confirm.preview.change === 'upgrade' ? (
              confirm.preview.trialing ? (
                <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.65 }}>
                  You're on a free trial, so there's no charge now. Your plan changes to <strong>{confirm.plan.name} ({cap(billing)})</strong> immediately, and you'll be charged {fmtAUD(billing === 'annual' ? confirm.plan.annualPrice : confirm.plan.monthlyPrice)} when your trial ends{confirm.preview.nextChargeDate ? ` on ${fmtDate(confirm.preview.nextChargeDate)}` : ''}.
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.65 }}>
                  Your plan changes to <strong>{confirm.plan.name} ({cap(billing)})</strong> immediately. You'll be charged <strong style={{ color: GREEN }}>{fmtAUD(confirm.preview.chargeNow, true)}</strong> today, prorated for the rest of your current period. From then it's {fmtAUD(billing === 'annual' ? confirm.plan.annualPrice : confirm.plan.monthlyPrice)}/{billing === 'annual' ? 'yr' : 'mo'}{confirm.preview.newPeriodEnd ? `, renewing ${fmtDate(confirm.preview.newPeriodEnd)}` : ''}.
                </div>
              )
            ) : (
              confirm.preview.trialing ? (
                <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.65 }}>
                  Your plan changes to <strong>{confirm.plan.name} ({cap(billing)})</strong> immediately (free trial, no charge now). You'll be charged {fmtAUD(billing === 'annual' ? confirm.plan.annualPrice : confirm.plan.monthlyPrice)} when your trial ends.
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.65 }}>
                  You'll keep <strong>{cap(currentTier)}</strong> until <strong>{fmtDate(confirm.preview.effectiveAt)}</strong>, then move to <strong>{confirm.plan.name} ({cap(billing)})</strong> at {fmtAUD(billing === 'annual' ? confirm.plan.annualPrice : confirm.plan.monthlyPrice)}/{billing === 'annual' ? 'yr' : 'mo'}. No refund for the current period.
                </div>
              )
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="lts-btn lts-btn-ghost" onClick={() => setConfirm(null)} disabled={confirmBusy}>Cancel</button>
              <button type="button" className="lts-btn lts-btn-primary" onClick={commitChange} disabled={confirmBusy}>{confirmBusy ? 'Confirming…' : confirm.preview.change === 'upgrade' ? (confirm.preview.trialing ? 'Confirm change' : `Pay ${fmtAUD(confirm.preview.chargeNow, true)} & upgrade`) : 'Schedule downgrade'}</button>
            </div>
          </>
        )}
      </Modal>

      {/* Cancel confirm */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel your subscription" busy={cancelBusy}>
        <div style={{ fontSize: 14, color: 'var(--lt-text)', lineHeight: 1.65 }}>
          You'll keep <strong>{cap(currentTier)}</strong> access until <strong>{fmtDate(sub?.current_period_end)}</strong>, then move to the free Basic plan. We don't refund the remaining period, and you can resubscribe anytime. This doesn't affect your rights under the Australian Consumer Law.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="lts-btn lts-btn-ghost" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>Keep my plan</button>
          <button type="button" className="lts-btn" style={{ background: '#ef4444', color: '#fff' }} onClick={doCancel} disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Cancel subscription'}</button>
        </div>
      </Modal>
    </div>
  )
}
