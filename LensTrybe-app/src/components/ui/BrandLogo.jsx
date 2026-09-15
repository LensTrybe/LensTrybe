import { useId } from 'react'

/**
 * The LensTrybe lens mark.
 *
 * Same geometry as the master files in branding/logo/svg, so what the app draws and
 * what a printer receives are the same drawing. The dark barrel behind the ring is
 * part of the mark, not a background: it is what gives the lens its depth and what
 * lets the pale ring hold its edge on a light page.
 *
 * No drop shadow. A baked in shadow stops a logo sitting cleanly on anything that is
 * not the colour it was drawn against.
 */
export function LensMark({ size = 28, style }) {
  const raw = useId()
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '')
  const ring = `lt-ring-${uid}`
  const glass = `lt-glass-${uid}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 412 412"
      role="img"
      aria-label="LensTrybe"
      style={{ display: 'block', flex: 'none', ...style }}
    >
      <defs>
        <linearGradient id={ring} x1="-64" y1="-92" x2="476" y2="504" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9AC4C5" />
          <stop offset="0.48" stopColor="#D996BA" />
          <stop offset="1" stopColor="#C6A5E5" />
        </linearGradient>
        <radialGradient id={glass} cx="37%" cy="31%" r="78%">
          <stop offset="0" stopColor="#FFFDF4" />
          <stop offset="0.36" stopColor="#C8EBDE" />
          <stop offset="0.72" stopColor="#F5B0CD" />
          <stop offset="1" stopColor="#C9ACE8" />
        </radialGradient>
      </defs>
      <circle cx="206" cy="206" r="206" fill="#2A2C3A" />
      <circle cx="206" cy="206" r="181" fill="none" stroke={`url(#${ring})`} strokeWidth="31" />
      <circle cx="206" cy="206" r="132" fill={`url(#${glass})`} />
      <circle cx="206" cy="206" r="132" fill="none" stroke="#DBE6E1" strokeOpacity="0.82" strokeWidth="9" />
      <ellipse cx="160" cy="151" rx="54" ry="37" fill="#ffffff" opacity="0.31" />
    </svg>
  )
}

// The wordmark is Inter Light in caps at 0.30em tracking. The tracking is part of the
// logo rather than a styling choice, so it is fixed here and not exposed as a prop.
const TRACKING = 0.3

// Cap height sits at 0.31 of the mark's diameter in the master lockups. Inter's caps
// are 0.7275 of its em, so this is the font size that reproduces that proportion.
// Derived rather than passed in, otherwise every call site gets to invent its own
// version of the logo.
const SIZE_FROM_MARK = 0.31 / 0.7275

/**
 * The horizontal lockup: lens, then LENSTRYBE.
 *
 * `color` defaults to ink for light pages. Anything on a dark surface passes its own,
 * usually the theme's text token.
 */
export default function BrandLogo({
  markSize = 28,
  fontSize,
  showMark = true,
  showWordmark = true,
  gap,
  color = '#16151c',
  style,
}) {
  const wordSize = fontSize ?? markSize * SIZE_FROM_MARK
  const space = gap ?? markSize * 0.3

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showMark && showWordmark ? space : 0,
        lineHeight: 1,
        ...style,
      }}
    >
      {showMark && <LensMark size={markSize} />}
      {showWordmark && (
        <span
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontWeight: 300,
            fontSize: wordSize,
            letterSpacing: `${TRACKING}em`,
            // Letter spacing is added after the final letter too, which would leave a
            // gap of dead space on the right and push the lockup off centre.
            marginRight: `${-TRACKING}em`,
            color,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          LENSTRYBE
        </span>
      )}
    </span>
  )
}
