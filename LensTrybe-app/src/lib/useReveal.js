import { useEffect } from 'react'
// Sections below the fold rise in as they arrive. Everything is visible at rest
// after a few seconds regardless, so nothing is ever stuck hidden.
export function useReveal(deps = []) {
  useEffect(() => {
    const els = [...document.querySelectorAll('.rv')]
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    els.forEach(el => { if (el.getBoundingClientRect().top > innerHeight) el.classList.add('pre') })
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target) } }), { threshold: .12 })
    els.forEach(el => io.observe(el))
    const t = setTimeout(() => els.forEach(el => el.classList.remove('pre')), 4000)
    return () => { io.disconnect(); clearTimeout(t) }
  }, deps)
}
