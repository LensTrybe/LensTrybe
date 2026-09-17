import { TYPO } from '../../lib/glassTokensLight'
import { LiquidLensFilter } from '../ui/liquidGlass'
import TileField from '../ui/TileField'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * The public site's page shell: the pastel mosaic, the lens filter that makes the glass
 * refract, the scrim that fades the mosaic under the fixed header, and the centred
 * content column.
 *
 * This exists because the shell was being hand-copied into every page, and pages that
 * were written without it (the directory gate, Support, Unsubscribe, and Founding before
 * 17 Sep 2026) came out looking like a different website. Six lines are easy to forget.
 * One import is not.
 *
 * Use it for every page under a public route. `children` can be a node, or a function
 * that receives { isMobile } for pages that need to switch layout.
 *
 *   <PublicPageShell>{({ isMobile }) => (...)}</PublicPageShell>
 *
 * `centre` vertically centres a short page (a confirmation, an empty state) instead of
 * pinning it to the top.
 */
export default function PublicPageShell({ children, maxWidth = 1000, centre = false }) {
  const isMobile = useIsMobile()

  return (
    <div style={{
      background: 'transparent',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      padding: isMobile ? '48px 16px 88px' : '72px 24px 96px',
      fontFamily: 'var(--font-ui)',
      ...TYPO.body,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <LiquidLensFilter />
      {/* The mosaic stays on mobile. minColumns keeps the tiles roughly square at phone
          width instead of stretching them into stripes: see TileField for why. */}
      <TileField animated={false} opacity={0.22} minColumns={isMobile ? 2 : 6} />
      <div aria-hidden style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '220px', zIndex: 1,
        background: 'linear-gradient(180deg, rgba(246,245,243,0.9) 0%, rgba(246,245,243,0.5) 55%, rgba(246,245,243,0) 100%)',
      }} />
      <div style={{
        maxWidth,
        margin: '0 auto',
        position: 'relative',
        zIndex: 2,
        ...(centre ? { minHeight: '58vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } : null),
      }}>
        {typeof children === 'function' ? children({ isMobile }) : children}
      </div>
    </div>
  )
}
