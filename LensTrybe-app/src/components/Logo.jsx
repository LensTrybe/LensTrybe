// The locked lockup. Full colour on light (ink wordmark). On dark: the full colour lens with a
// white wordmark (onDark), or the one colour white version (white) where colour can't sit.
export default function Logo({ white = false, onDark = false, height = 22 }) {
  const src = onDark ? '/logo-on-dark.svg' : white ? '/logo-white.svg' : '/logo-ink.svg'
  return <img src={src} alt="LensTrybe" style={{ height, width: 'auto' }} />
}
