/** Shared glass + typography tokens for public pages (matches HomePage / Modal / Input). */

export const GLASS_CARD = {
  backdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderTop: '1px solid rgba(255,255,255,0.2)',
  borderLeft: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
}

export const GLASS_CARD_GREEN = {
  backdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.1)',
  background: 'linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(29,185,84,0.06) 100%)',
  border: '1px solid rgba(29,185,84,0.35)',
  borderTop: '1px solid rgba(29,185,84,0.5)',
  borderLeft: '1px solid rgba(29,185,84,0.4)',
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(29,185,84,0.15), inset 0 1px 0 rgba(255,255,255,0.2)',
}

export const GLASS_MODAL_PANEL = {
  backdropFilter: 'blur(60px) saturate(180%)',
  WebkitBackdropFilter: 'blur(60px) saturate(180%)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderTop: '1px solid rgba(255,255,255,0.25)',
  borderRadius: '24px',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
}

export const GLASS_MODAL_OVERLAY_BASE = {
  background: 'rgba(6,6,16,0.65)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}

export const DIVIDER_GRADIENT_STYLE = {
  height: '1px',
  width: '100%',
  border: 'none',
  flexShrink: 0,
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
}

export const TYPO = {
  heading: { fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.6 },
  stat: { fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.6 },
  label: {
    fontWeight: 400,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 1.6,
    fontFamily: 'var(--font-ui)',
  },
  body: { fontWeight: 400, lineHeight: 1.6, fontFamily: 'var(--font-ui)' },
}

/** Native inputs / selects — rest state (matches Input.jsx glass row). */
export const GLASS_NATIVE_FIELD = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderTop: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  boxSizing: 'border-box',
  outline: 'none',
  color: '#ffffff',
  fontFamily: 'var(--font-ui)',
  fontSize: '14px',
  fontWeight: 400,
  lineHeight: 1.6,
}

export function glassCardAccentBorder(borderColor) {
  return {
    ...GLASS_CARD,
    border: `1px solid ${borderColor}`,
    borderTop: `1px solid ${borderColor}`,
    borderLeft: `1px solid ${borderColor}`,
  }
}
