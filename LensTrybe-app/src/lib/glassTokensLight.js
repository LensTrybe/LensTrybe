/** Light-theme glass + typography tokens for the public marketing site.
   Mirrors the exports of glassTokens.js (which stays dark for the dashboard). */

export const GLASS_CARD = {
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)',
  border: '1px solid rgba(20,17,26,0.07)',
  borderTop: '1px solid rgba(255,255,255,0.9)',
  borderLeft: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '20px',
  boxShadow: '0 10px 30px -12px rgba(40,30,60,0.16), inset 0 1px 0 rgba(255,255,255,0.85)',
}

export const GLASS_CARD_AURORA = {
  ...GLASS_CARD,
  background: 'radial-gradient(circle at 100% 0%, rgba(29,185,84,0.16), transparent 42%), radial-gradient(circle at 84% 8%, rgba(255,45,120,0.12), transparent 40%), linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)',
  overflow: 'hidden',
}

export const GLASS_CARD_GREEN = {
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(29,185,84,0.12) 0%, rgba(255,255,255,0.55) 100%)',
  border: '1px solid rgba(29,185,84,0.28)',
  borderTop: '1px solid rgba(29,185,84,0.4)',
  borderLeft: '1px solid rgba(29,185,84,0.32)',
  borderRadius: '20px',
  boxShadow: '0 12px 34px -12px rgba(29,120,70,0.2), inset 0 1px 0 rgba(255,255,255,0.85)',
}

export const GLASS_MODAL_PANEL = {
  backdropFilter: 'blur(30px) saturate(150%)',
  WebkitBackdropFilter: 'blur(30px) saturate(150%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.7) 100%)',
  border: '1px solid rgba(20,17,26,0.08)',
  borderTop: '1px solid rgba(255,255,255,0.9)',
  borderRadius: '24px',
  boxShadow: '0 24px 64px -20px rgba(40,30,60,0.35), inset 0 1px 0 rgba(255,255,255,0.9)',
}

export const GLASS_MODAL_OVERLAY_BASE = {
  background: 'rgba(20,17,26,0.35)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
}

export const DIVIDER_GRADIENT_STYLE = {
  height: '1px',
  width: '100%',
  border: 'none',
  flexShrink: 0,
  background: 'linear-gradient(90deg, transparent, rgba(20,17,26,0.08), transparent)',
}

export const TYPO = {
  heading: { fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.6, color: 'var(--text-primary)' },
  stat: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.6, color: 'var(--text-primary)' },
  label: {
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    fontFamily: 'var(--font-ui)',
  },
  body: { fontWeight: 400, lineHeight: 1.6, fontFamily: 'var(--font-ui)' },
}

/** Native inputs / selects — light rest state. */
export const GLASS_NATIVE_FIELD = {
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  background: 'rgba(255,255,255,0.75)',
  border: '1px solid rgba(20,17,26,0.12)',
  borderTop: '1px solid rgba(20,17,26,0.1)',
  borderRadius: '10px',
  boxSizing: 'border-box',
  outline: 'none',
  color: '#14111a',
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
