const CREDENTIAL_CONFIG = {
  has_public_liability: {
    label: 'Public Liability',
    icon: '',
    color: '#3B82F6', // blue
  },
  has_blue_card: {
    label: 'Blue Card',
    icon: '',
    color: '#06B6D4', // cyan
  },
  has_police_check: {
    label: 'Police Checked',
    icon: '',
    color: '#10B981', // green
  },
  has_wwvp: {
    label: 'WWVP',
    icon: '',
    color: '#8B5CF6', // purple
  },
  has_professional_licence: {
    label: 'Licensed',
    icon: '',
    color: '#F59E0B', // amber
  },
}

const CREDENTIAL_ORDER = [
  'has_public_liability',
  'has_blue_card',
  'has_police_check',
  'has_wwvp',
  'has_professional_licence',
]

export function CredentialBadge({ type, description }) {
  const config = CREDENTIAL_CONFIG[type]
  if (!config) return null
  return (
    <span
      title={description || config.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: `${config.color}22`,
        border: `1px solid ${config.color}66`,
        color: config.color,
        fontSize: '11px',
        fontWeight: '600',
        padding: '3px 8px',
        borderRadius: '999px',
        whiteSpace: 'nowrap',
        cursor: 'default',
      }}
    >
      {config.icon} {config.label}
    </span>
  )
}

// Renders all credential badges for a profile
export function CredentialBadges({ profile }) {
  const active = CREDENTIAL_ORDER.filter((c) => profile[c] === true)
  if (active.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {active.map((c) => (
        <CredentialBadge
          key={c}
          type={c}
          description={c === 'has_professional_licence' ? profile.professional_licence_description : null}
        />
      ))}
    </div>
  )
}

/** Search / card row: max N badges, then “+X more”. */
export function CredentialBadgesCompact({ profile, maxVisible = 3 }) {
  const active = CREDENTIAL_ORDER.filter((c) => profile[c] === true)
  if (active.length === 0) return null
  const shown = active.slice(0, maxVisible)
  const more = active.length - shown.length
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
      {shown.map((c) => (
        <CredentialBadge
          key={c}
          type={c}
          description={c === 'has_professional_licence' ? profile.professional_licence_description : null}
        />
      ))}
      {more > 0 ? (
        <span
          title={`${more} more credential${more === 1 ? '' : 's'}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#9ca3af',
            whiteSpace: 'nowrap',
            cursor: 'default',
          }}
        >
          +{more} more
        </span>
      ) : null}
    </div>
  )
}
