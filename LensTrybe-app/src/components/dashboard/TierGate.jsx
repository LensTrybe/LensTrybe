import { Link } from 'react-router-dom'
import { useSubscription } from '../../context/SubscriptionContext'
import { TIER_META, lowestTierWith } from '../../lib/tierFeatures'

// Locked features are shown, not hidden. A creative on a lower plan sees the real page or
// widget behind a blur with an upgrade panel across the face, so they can see exactly what
// they would get. This is also the security boundary: the sidebar used to hide links while
// the pages themselves had no check, which left every paid page open at its address.
//
// Usage:
//   <TierGate feature="contracts">            wraps a whole page
//   <TierGate feature="cashflow" compact>     wraps a dashboard widget
//
// The children still render, so never put anything secret inside a gate. Paid pages load
// the creative's own rows through RLS, so a gated page shows an empty shell, which is the
// point: it demonstrates the feature without leaking anyone's data.

export const UPGRADE_PATH = '/dashboard/settings/subscription'

const LOCK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

/**
 * The panel that sits over blurred content. Exported so pages that already draw their own
 * shell (the bookings list, for instance) can drop it in without the wrapper.
 */
export function UpgradePanel({ title, body, tier, compact = false }) {
  const meta = TIER_META[tier] || TIER_META.expert
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 8 : 12,
        textAlign: 'center',
        maxWidth: compact ? 260 : 380,
        padding: compact ? '18px 16px' : '28px 26px',
        borderRadius: 16,
        background: 'var(--lt-modal-bg)',
        border: 'var(--lt-modal-border)',
        boxShadow: 'var(--lt-modal-shadow)',
        backdropFilter: 'var(--lt-modal-blur)',
      }}
    >
      <span style={{ color: meta.colour, display: 'flex' }}>{LOCK_ICON}</span>
      <div style={{ fontSize: compact ? 14 : 17, fontWeight: 600, color: 'var(--lt-text)', lineHeight: 1.3 }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: compact ? 12.5 : 14, color: 'var(--lt-muted)', lineHeight: 1.5 }}>
          {body}
        </div>
      )}
      <Link
        to={UPGRADE_PATH}
        style={{
          marginTop: 2,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compact ? '8px 16px' : '11px 22px',
          borderRadius: 999,
          background: '#1DB954',
          color: '#04120a',
          fontWeight: 600,
          fontSize: compact ? 13 : 14.5,
          textDecoration: 'none',
        }}
      >
        Upgrade to {meta.name}
      </Link>
    </div>
  )
}

export default function TierGate({
  feature,
  children,
  compact = false,
  title,
  body,
  minHeight,
  // For gates that a single feature key cannot describe, such as a dashboard widget whose
  // required plan depends on which widget it is. Pass both together.
  locked,
  tier,
}) {
  const { hasFeature } = useSubscription()

  const isLocked = locked != null ? locked : !!feature && !hasFeature(feature)
  if (!isLocked) return children

  const needed = tier || (feature && lowestTierWith(feature)) || 'expert'
  const meta = TIER_META[needed] || TIER_META.expert

  // The preview is clipped rather than blurred at full length. A gated page can be several
  // screens tall, and centring the panel in all of that would park it below the fold.
  return (
    <div
      style={{
        position: 'relative',
        // A gated widget fills the cell the board gave it, so the packing grid is
        // unaffected. A gated page clips its preview instead (see below).
        height: compact ? '100%' : undefined,
        minHeight: minHeight || (compact ? undefined : 340),
        maxHeight: compact ? undefined : 'min(620px, 72vh)',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        inert=""
        style={{
          filter: compact ? 'blur(4px)' : 'blur(6px)',
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
          height: '100%',
        }}
      >
        {children}
      </div>
      {!compact && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 120,
            background: 'linear-gradient(to bottom, transparent, var(--lt-bg))',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 2,
        }}
      >
        <UpgradePanel
          tier={needed}
          compact={compact}
          title={title || 'Upgrade to view'}
          body={body || `Part of the ${meta.name} plan, $${meta.monthly} a month.`}
        />
      </div>
    </div>
  )
}
