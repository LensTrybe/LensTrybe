import TileField from '../ui/TileField'
import { DASH_TOKENS, DARK_SCRIM, DARK_WRAP, LIGHT_SCRIM, LIGHT_WRAP } from './dashSurface'

/* The tokens and the background that every signed in page sits on.
 *
 * Render once, above the page content. Anything inside can then use the
 * --lt-* tokens and will read correctly in both themes, and the frosted glass
 * has the pastel mosaic to refract, which is the thing that makes a card look
 * like part of LensTrybe rather than a grey box.
 */
export default function DashSurface({ dark, isMobile, vivid = false }) {
  return (
    <>
      <style>{DASH_TOKENS}</style>
      {dark ? (
        <div aria-hidden style={DARK_WRAP}>
          <TileField dark opacity={vivid ? 0.85 : 0.3} animated={vivid} minColumns={isMobile ? 2 : 6} />
          <div style={{ position: 'absolute', inset: 0, background: DARK_SCRIM }} />
        </div>
      ) : (
        <div aria-hidden style={LIGHT_WRAP}>
          <TileField opacity={vivid ? 1 : 0.22} animated={vivid} minColumns={isMobile ? 2 : 6} />
          <div style={{ position: 'absolute', inset: 0, background: LIGHT_SCRIM }} />
        </div>
      )}
    </>
  )
}
