/** Light-theme glass + typography tokens for the public marketing site.
   Mirrors the exports of glassTokens.js (which stays dark for the dashboard). */

export const GLASS_CARD = {
  backdropFilter: 'blur(14px) saturate(140%)',
  WebkitBackdropFilter: 'blur(14px) saturate(140%)',
  background: 'linear-gradient(160deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.32) 100%)',
  border: '1px solid rgba(255,255,255,0.5)',
  borderTop: '1px solid rgba(255,255,255,0.75)',
  borderLeft: '1px solid rgba(255,255,255,0.6)',
  borderRadius: '20px',
  boxShadow: '0 12px 34px -16px rgba(40,30,60,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
}

export const GLASS_CARD_AURORA = {
  ...GLASS_CARD,
  background: 'radial-gradient(circle at 100% 0%, rgba(29,185,84,0.14), transparent 42%), radial-gradient(circle at 84% 8%, rgba(255,45,120,0.1), transparent 40%), linear-gradient(160deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.32) 100%)',
  overflow: 'hidden',
}

/* LIQUID GLASS — the site-wide "Apple liquid glass" surface.
   Real liquid glass (not frost): the backdrop is refracted/lensed via the
   #liquidLens SVG displacement filter and left mostly CLEAR (very low blur) so
   the colour behind shows sharply, with a glossy specular corner sheen and a
   bright reflective bevel on all four inner edges.
   NOTE: requires the <svg><filter id="liquidLens"> to be present on the page. */
export const LIQUID_GLASS = {
  backdropFilter: 'url(#liquidLens) blur(1px) saturate(180%) brightness(1.06)',
  WebkitBackdropFilter: 'blur(7px) saturate(180%) brightness(1.06)',
  background:
    'linear-gradient(125deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.08) 26%, rgba(255,255,255,0) 52%), ' +
    'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.1) 100%)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '24px',
  boxShadow: '0 18px 50px -14px rgba(31,38,90,0.3), inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -1.5px 3px rgba(255,255,255,0.55), inset 1.5px 0 4px rgba(255,255,255,0.35), inset -1.5px 0 4px rgba(255,255,255,0.35)',
}

/* Input / select-trigger field used inside liquid-glass panels. */
export const LIQUID_FIELD = {
  flex: '1 1 150px', minWidth: 0,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(20,17,26,0.1)',
  borderRadius: '11px',
  padding: '12px 13px',
  fontSize: '14px',
  color: '#14111a',
  fontFamily: "'Inter', sans-serif",
  outline: 'none',
  colorScheme: 'light',
}

/* Performant liquid-glass for repeated content cards (cheap blur, no per-card
   refraction). Same glossy look as LIQUID_GLASS. */
export const LIQUID_GLASS_CARD = {
  ...LIQUID_GLASS,
  backdropFilter: 'blur(5px) saturate(175%) brightness(1.04)',
  WebkitBackdropFilter: 'blur(5px) saturate(175%) brightness(1.04)',
  background:
    'linear-gradient(125deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0.05) 56%), ' +
    'linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.18) 100%)',
}

export const GLASS_CARD_GREEN = {
  backdropFilter: 'blur(14px) saturate(140%)',
  WebkitBackdropFilter: 'blur(14px) saturate(140%)',
  background: 'linear-gradient(160deg, rgba(29,185,84,0.16) 0%, rgba(255,255,255,0.3) 100%)',
  border: '1px solid rgba(29,185,84,0.3)',
  borderTop: '1px solid rgba(255,255,255,0.6)',
  borderLeft: '1px solid rgba(29,185,84,0.32)',
  borderRadius: '20px',
  boxShadow: '0 12px 34px -14px rgba(29,120,70,0.2), inset 0 1px 0 rgba(255,255,255,0.55)',
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
