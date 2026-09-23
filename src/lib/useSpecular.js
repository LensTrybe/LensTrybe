import { useEffect } from 'react'
// Specular highlight that follows the pointer across every .lg panel, and a
// small tilt on .tilt panels. One listener for the page, rects cached.
export function useSpecular(deps = []) {
  useEffect(() => {
    if (matchMedia('(pointer:coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let els = [], rects = [], raf = 0, px = 0, py = 0
    const collect = () => { els = [...document.querySelectorAll('.lg')]; rects = els.map(e => e.getBoundingClientRect()) }
    const recache = () => { rects = els.map(e => e.getBoundingClientRect()) }
    collect()
    const mo = new MutationObserver(() => { clearTimeout(mo.t); mo.t = setTimeout(collect, 150) })
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    const tick = () => {
      raf = 0
      for (let i = 0; i < els.length; i++) {
        const r = rects[i], el = els[i]; if (!r || !r.width) continue
        const near = px > r.left && px < r.right && py > r.top && py < r.bottom
        if (!near) { if (el.dataset.on) { el.style.setProperty('--lg-on', 0); el.dataset.on = '' } continue }
        el.dataset.on = '1'
        el.style.setProperty('--mx', ((px - r.left) / r.width * 100).toFixed(1) + '%')
        el.style.setProperty('--my', ((py - r.top) / r.height * 100).toFixed(1) + '%')
        el.style.setProperty('--lg-on', 1)
        
      }
    }
    const onMove = e => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(tick) }
    addEventListener('pointermove', onMove); addEventListener('resize', collect); addEventListener('scroll', recache, { passive: true, capture: true })
    return () => { mo.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('resize', collect); removeEventListener('scroll', recache, { capture: true }); cancelAnimationFrame(raf) }
  }, deps)
}
