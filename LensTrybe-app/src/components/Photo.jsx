import { useEffect, useRef, useState } from 'react'
import { imageUrl } from '../backend/imageUrl'

// A photo that blurs up (26 Oct 2026). A tiny copy from the Storage resizer (a few hundred bytes)
// shows at once, blurred, and the full photo fades in over it once it has loaded. Photos that are
// not in our Storage (a Google avatar) get a soft lens-coloured wash with a slow sheen instead.
// width is the display width in CSS pixels; the resizer is asked for that size, not the original.
// vt names the photo for a view transition (the directory card flowing into the profile cover).
const tiny = u => { try { const t = imageUrl(u, 12, 40); return t && t !== u ? t : null } catch { return null } }
const sized = (u, w) => { try { return (w && imageUrl(u, w)) || u } catch { return u } }

export default function Photo({ src, width, alt = '', eager = false, className = '', style, onError, referrerPolicy, vt }) {
  const [on, setOn] = useState(false)
  const ref = useRef(null)
  const lq = tiny(src)
  // Already in the browser cache (preloaded on hover, or seen before): show it straight away.
  useEffect(() => { const i = ref.current; setOn(!!(i && i.complete && i.naturalWidth)) }, [src])
  return (
    <span className={'phx' + (lq ? ' lq' : '') + (on ? ' on' : '') + (className ? ' ' + className : '')} style={vt ? { ...style, viewTransitionName: vt } : style}>
      {lq && <i aria-hidden="true" style={{ backgroundImage: `url("${lq}")` }} />}
      <img ref={ref} src={sized(src, width)} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} referrerPolicy={referrerPolicy} onLoad={() => setOn(true)} onError={onError} />
    </span>
  )
}
