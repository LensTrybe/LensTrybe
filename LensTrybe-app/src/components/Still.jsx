import { useEffect, useRef } from 'react'
import { paintStill } from '../lib/stills'
// A dark cinematic frame. Paints once it has a size, repaints on resize.
export default function Still({ seed = 1, mood = 'dusk', className = '', style }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    let done = false
    const paint = () => { done = paintStill(cv, seed, mood) }
    paint()
    const ro = new ResizeObserver(() => { clearTimeout(ro.t); ro.t = setTimeout(paint, 120) })
    ro.observe(cv)
    if (!done) requestAnimationFrame(paint)
    return () => ro.disconnect()
  }, [seed, mood])
  return <canvas ref={ref} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }} aria-hidden="true" />
}
