// The locked lockup. White on dark, full colour on light.
export default function Logo({ white = false, height = 22 }) {
  return <img src={white ? '/logo-white.svg' : '/logo-ink.svg'} alt="LensTrybe" style={{ height, width: 'auto' }} />
}
