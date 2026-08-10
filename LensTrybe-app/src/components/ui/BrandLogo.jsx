import { useId } from 'react'

/**
 * LensTrybe lens mark — pastel gradient camera barrel around a frosted glass lens.
 * Matches the light glassmorphic site theme.
 */
export function LensMark({ size = 28, style }) {
  const raw = useId()
  const uid = raw.replace(/[^a-zA-Z0-9]/g, '')
  const glass = `lt-glass-${uid}`
  const barrel = `lt-barrel-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={style}>
      <defs>
        <radialGradient id={glass} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#c1e9d4" />
          <stop offset="0.7" stopColor="#f4aecb" />
          <stop offset="1" stopColor="#c1acf2" />
        </radialGradient>
        <linearGradient id={barrel} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7f9fb8" />
          <stop offset="0.5" stopColor="#a76d84" />
          <stop offset="1" stopColor="#7f77dd" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="none" stroke={`url(#${barrel})`} strokeWidth="6" />
      <circle cx="32" cy="32" r="19" fill={`url(#${glass})`} />
      <ellipse cx="26" cy="25" rx="7" ry="4.5" fill="rgba(255,255,255,0.65)" />
    </svg>
  )
}

/**
 * Full brand lockup: lens mark + "LensTrybe" wordmark
 * (sans "Lens" + italic serif gradient "Trybe").
 */
export default function BrandLogo({
  markSize = 28,
  fontSize = 19,
  showMark = true,
  showWordmark = true,
  gap = 9,
  style,
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, lineHeight: 1, ...style }}>
      {showMark && <LensMark size={markSize} />}
      {showWordmark && (
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#14111a',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          Lens
          <span
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: 'italic',
              fontWeight: 400,
              backgroundImage: 'linear-gradient(120deg, #1DB954, #d4537e 60%, #7f77dd)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            Trybe
          </span>
        </span>
      )}
    </span>
  )
}
